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
//
// "Cerrar HaNet en un liceo" (muxp, 2026-11-27): HNT, or the liceo's Admin
// from the web panel, closes HaNet for one institution only, for instance at
// the start of the year while the rosters and courses get fixed. Its members
// get the same closed screen, the callables refuse them and no push reaches
// them; HNT and the liceo's Admin still get in, and its teachers too if the
// closure says so (`teachers`). It can start later (`from`) and opens by
// itself at `until`. The closure is kept in institutions/{id}.closure and
// copied to config/appStatus.institutions.{id} (institutions.js writes both),
// so the gate reads the same single document as for the global state.

const { getApp, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { HttpsError } = require("firebase-functions/v2/https");

const KINDS = ["maintenance", "incident", "closed"];
const MESSAGE_MAX = 280;
// Each instance reads the state at most this often: a change reaches every
// call within this long, for one Firestore read per instance.
const CACHE_MS = 20000;
const OPEN = { open: true, kind: null, message: null, until: null };

let cached = null;
let cachedClosures = new Map();
let cachedAt = 0;
// Whose institution each account is, read only while some liceo is closed.
const USER_CACHE_MS = 120000;
const USER_CACHE_MAX = 5000;
const userCache = new Map();

function identityDb() {
  // The default app (index.js may have started it). getApps() isn't enough:
  // the Functions SDK keeps its own named app to check tokens.
  let app;
  try {
    app = getApp();
  } catch {
    app = initializeApp();
  }
  return getFirestore(app, "hn-enrollmentdata");
}

function statusRef() {
  return identityDb().collection("config").doc("appStatus");
}

function millisOf(value) {
  return value && typeof value.toMillis === "function" ? value.toMillis() : null;
}

// One institution's closure as stored (institutions/{id}.closure or its copy
// in config/appStatus), cleaned. null when there is none.
function closureOf(data) {
  if (!data || data.closed !== true) return null;
  return {
    kind: KINDS.includes(data.kind) ? data.kind : "closed",
    message: typeof data.message === "string" && data.message.trim() ? data.message.trim() : null,
    from: millisOf(data.from),
    until: millisOf(data.until),
    teachers: data.teachers === true,
    name: typeof data.name === "string" ? data.name : null,
  };
}

/** Whether a closure holds right now: it has started and hasn't reached its end. */
function closureActive(closure, now = Date.now()) {
  return Boolean(closure) && (closure.from === null || closure.from <= now) && (closure.until === null || now < closure.until);
}

// Who still gets in while their liceo is closed.
function exempt(role, closure) {
  return role === "HNT" || role === "Admin" || (role === "Profesor" && closure.teachers);
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
    const data = snapshot.exists ? snapshot.data() : null;
    cached = publicStatus(data);
    cachedClosures = new Map(Object.entries(data?.institutions || {})
      .map(([id, value]) => [id, closureOf(value)])
      .filter(([, closure]) => closure && (closure.until === null || closure.until > Date.now())));
    cachedAt = Date.now();
    return cached;
  } catch (error) {
    console.error("readAppStatus", error);
    return cached || OPEN;
  }
}

/** The institutions closed right now, by id (read with the global state). */
async function activeClosures(now = Date.now()) {
  await readAppStatus();
  return new Map([...cachedClosures].filter(([, closure]) => closureActive(closure, now)));
}

/** An institution's closure as the gate knows it (it may be scheduled or over). */
async function institutionClosure(institutionId) {
  await readAppStatus();
  return cachedClosures.get(institutionId) || null;
}

// The account's institution and role, from its profile (or its account
// before the identity link).
async function memberOf(uid) {
  const hit = userCache.get(uid);
  if (hit && Date.now() - hit.at < USER_CACHE_MS) return hit;
  const db = identityDb();
  const [user, account] = await db.getAll(db.collection("users").doc(uid), db.collection("accounts").doc(uid));
  const entry = {
    institutionId: user.get("institutionId") || account.get("institutionId") || null,
    role: user.get("role") || null,
    at: Date.now(),
  };
  if (userCache.size >= USER_CACHE_MAX) userCache.clear();
  userCache.set(uid, entry);
  return entry;
}

function isHnt(request) {
  return request?.auth?.token?.role === "HNT";
}

/** Throws for anyone but HNT while HaNet is closed, and for the members of a closed liceo. */
async function assertAppOpen(request, { institution = true } = {}) {
  const status = await readAppStatus();
  if (!status.open && !isHnt(request)) {
    throw new HttpsError("unavailable", "HaNet está cerrado por ahora. Vuelve a intentarlo más tarde.", {
      appClosed: true,
      kind: status.kind,
    });
  }
  if (!institution || !request?.auth || isHnt(request)) return;
  const closures = await activeClosures();
  if (!closures.size) return;
  let member;
  try {
    member = await memberOf(request.auth.uid);
  } catch (error) {
    // Like the global state: a failed read never closes HaNet.
    console.error("assertAppOpen", error.message);
    return;
  }
  const closure = member.institutionId ? closures.get(member.institutionId) : null;
  if (!closure || exempt(request.auth.token.role || member.role, closure)) return;
  throw new HttpsError("unavailable", "HaNet está cerrado en tu liceo por ahora. Vuelve a intentarlo más tarde.", {
    institutionClosed: true,
    kind: closure.kind,
  });
}

/** Whether push should be held back right now. */
async function appClosed() {
  return !(await readAppStatus()).open;
}

/**
 * The tokens without those of the members of a closed liceo (its Admin, HNT
 * and the teachers it lets in keep theirs). tokens: [{ id, token }], the id
 * being the pushTokens document's.
 */
async function withoutClosedInstitutions(tokens) {
  const closures = await activeClosures();
  if (!closures.size || !tokens.length) return tokens;
  try {
    const db = identityDb();
    const uids = new Map();
    for (let start = 0; start < tokens.length; start += 300) {
      const docs = await db.getAll(...tokens.slice(start, start + 300).map(item => db.collection("pushTokens").doc(item.id)), { fieldMask: ["uid"] });
      docs.forEach(doc => { if (doc.exists) uids.set(doc.id, doc.get("uid")); });
    }
    const members = new Map();
    for (const uid of new Set(uids.values())) {
      if (uid) members.set(uid, await memberOf(uid));
    }
    return tokens.filter((item) => {
      const member = members.get(uids.get(item.id));
      const closure = member?.institutionId ? closures.get(member.institutionId) : null;
      return !closure || exempt(member.role, closure);
    });
  } catch (error) {
    console.error("withoutClosedInstitutions", error.message);
    return tokens;
  }
}

/** Forget the cached state, after a write. */
function resetAppStatusCache() {
  cached = null;
  cachedAt = 0;
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
    const status = await readAppStatus();
    // With ?i=<institution>, that liceo's closure too (what its members see).
    const institutionId = typeof req.query?.i === "string" ? req.query.i.slice(0, 60) : "";
    if (!institutionId) {
      res.json(status);
      return;
    }
    const closure = await institutionClosure(institutionId);
    res.json({
      ...status,
      institution: closure
        ? { closed: closureActive(closure), kind: closure.kind, message: closure.message, from: closure.from, until: closure.until, teachers: closure.teachers, name: closure.name }
        : { closed: false, kind: null, message: null, from: null, until: null, teachers: false, name: null },
    });
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

    // merge: the liceos' closures live in the same document.
    await statusRef().set({ ...next, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid }, { merge: true });
    console.log("setAppStatus", { uid: request.auth.uid, open: next.open, kind: next.kind });
    cached = null;
    return readAppStatus({ fresh: true });
  });

  return { getAppStatus, setAppStatus };
}

module.exports = {
  build,
  readAppStatus,
  assertAppOpen,
  appClosed,
  withoutClosedInstitutions,
  activeClosures,
  closureOf,
  closureActive,
  statusRef,
  resetAppStatusCache,
  KINDS,
  MESSAGE_MAX,
};
