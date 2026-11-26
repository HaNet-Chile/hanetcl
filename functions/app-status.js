// "Cerrar HaNet al público" (muxp, 2026-11-26): HNT can close HaNet for
// everyone but the HaNet team, from the HNT panel in the app or from the web
// panel. While it is closed:
//   - the app and the panel show a full-screen notice (maintenance, a
//     problem, or closed for now) with an optional message and time of return
//   - every callable refuses whoever isn't HNT (regions.js wraps them all)
//   - no push goes out, except security alerts and the HNT push test
//
// The state lives in hn-enrollmentdata config/appStatus, written only by
// setAppStatus. getAppStatus is public (the app asks before signing in).

const { getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");

const KINDS = ["maintenance", "incident", "closed"];
const MESSAGE_MAX = 280;
// Each instance reads the state at most this often: a change reaches every
// call within this long, for one Firestore read per instance.
const CACHE_MS = 20000;
const OPEN = { open: true, kind: null, message: null, until: null };

let cached = null;
let cachedAt = 0;

function statusRef() {
  const app = getApps().length ? getApp() : initializeApp();
  return getFirestore(app, "hn-enrollmentdata").collection("config").doc("appStatus");
}

function publicStatus(data) {
  if (!data || data.open !== false) return OPEN;
  return {
    open: false,
    kind: KINDS.includes(data.kind) ? data.kind : "maintenance",
    message: typeof data.message === "string" && data.message.trim() ? data.message.trim() : null,
    until: data.until && typeof data.until.toMillis === "function" ? data.until.toMillis() : null,
  };
}

/** The current state. If it can't be read, HaNet counts as open: a failed read never closes it. */
async function readAppStatus({ fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cachedAt < CACHE_MS) return cached;
  try {
    const snapshot = await statusRef().get();
    cached = publicStatus(snapshot.exists ? snapshot.data() : null);
    cachedAt = Date.now();
    return cached;
  } catch (error) {
    console.error("readAppStatus", error);
    return cached || OPEN;
  }
}

function isHnt(request) {
  return request?.auth?.token?.role === "HNT";
}

/** Throws for anyone but HNT while HaNet is closed. */
async function assertAppOpen(request) {
  const status = await readAppStatus();
  if (status.open || isHnt(request)) return;
  throw new HttpsError("unavailable", "HaNet está cerrado por ahora. Vuelve a intentarlo más tarde.", {
    appClosed: true,
    kind: status.kind,
  });
}

/** Whether push should be held back right now. */
async function appClosed() {
  return !(await readAppStatus()).open;
}

function build(onCall, onRequest) {
  // Public and read-only: the app asks on launch and when it comes back to
  // the front, the panel too. GET answers JSON with CORS open.
  const getAppStatus = onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Cache-Control", "no-store");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "GET") {
      res.status(405).json({ error: "method" });
      return;
    }
    res.json(await readAppStatus());
  });

  // HNT only. { open: true } opens; { open: false, kind, message?, until? } closes.
  const setAppStatus = onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    if (!isHnt(request)) throw new HttpsError("permission-denied", "Solo el equipo HaNet puede cerrar o abrir HaNet.");
    const data = request.data || {};
    if (typeof data.open !== "boolean") throw new HttpsError("invalid-argument", "Falta decir si HaNet queda abierto o cerrado.");

    let next;
    if (data.open) {
      next = { open: true, kind: null, message: null, until: null };
    } else {
      if (!KINDS.includes(data.kind)) throw new HttpsError("invalid-argument", "Elige qué pasa: mantención, un problema o cerrado.");
      const message = typeof data.message === "string" ? data.message.trim() : "";
      if (message.length > MESSAGE_MAX) throw new HttpsError("invalid-argument", `El mensaje puede tener hasta ${MESSAGE_MAX} caracteres.`);
      let until = null;
      if (data.until !== null && data.until !== undefined) {
        const millis = Number(data.until);
        if (!Number.isFinite(millis) || millis < Date.now() - 60000 || millis > Date.now() + 30 * 24 * 3600 * 1000) {
          throw new HttpsError("invalid-argument", "La hora de vuelta tiene que ser dentro de los próximos 30 días.");
        }
        until = new Date(millis);
      }
      next = { open: false, kind: data.kind, message: message || null, until };
    }

    await statusRef().set({ ...next, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
    console.log("setAppStatus", { uid: request.auth.uid, open: next.open, kind: next.kind });
    cached = null;
    return readAppStatus({ fresh: true });
  });

  return { getAppStatus, setAppStatus };
}

module.exports = { build, readAppStatus, assertAppOpen, appClosed };
