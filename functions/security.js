const { randomUUID } = require("node:crypto");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { recordInbox } = require("./inbox");
const { sendPush } = require("./classhall-notify");

// The account's security alerts: a sign-in from a new device, a password or
// email that changed, a new way to sign in, a role that changed.
//
// Firebase Auth has no trigger for a sign-in (only the blocking functions of
// Identity Platform, which this project does not use), so the app says so:
// right after signing in it calls reportDevice with `signIn`, and every few
// hours it calls it again without it (that keeps the list of devices up to
// date). Each call also compares what Auth says about the account (email,
// sign-in methods, when the sessions were last cut) with what was seen last
// time: a password reset or an email change cut every session, so the next
// call from any device finds out.
//
// With Identity Platform there is also watchSignIn (sign-in-watch.js), which
// notes every sign-in before it happens, the app's or not. reportDevice with
// `signIn` claims (deletes) the account's notes, and alertUnclaimedSignIns
// warns about the ones nobody claimed: a sign-in from outside the app, or
// from an older version of it that does not report.
//
// An alert lands in the notifications section (inbox) and as a push to the
// account's OTHER devices, whatever the notification switches say: these are
// the account's own, not ClassHall's. No IP address or location is kept.
//
// hn-enrollmentdata, closed to the app (only these functions):
//   security/{uid}: { email, providers, tokensValidAfter, events: [{ id, kind, title, body, at }] }
//   security/{uid}/devices/{deviceId}: { kind, name, system, app, firstAt, lastAt, lastSignInAt, signIns }
// The device id is random, made by the app on first launch (never the
// phone's own id); removing the app makes a new one.

const KINDS = ["signIn", "account", "role"];
const DEVICE_KINDS = ["phone", "tablet", "computer"];
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
// A device not seen in this long counts as new again.
const NEW_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
// Devices this quiet leave the list.
const FORGET_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
// An account this young is signing in for the first time: nothing to warn about.
const NEW_ACCOUNT_MS = 60 * 60 * 1000;
const KEEP_EVENTS = 30;
const TRIM_EVENTS_AT = 50;
const MAX_DEVICES = 20;
// Android shows these in their own channel (services/push-service.ts).
const ANDROID_CHANNEL = "account";
const ROUTE = "/security";
// How long the app has to claim a sign-in before it counts as unreported.
const CLAIM_WINDOW_MS = 4 * 60 * 1000;
// A note this recent is the sign-in the app is reporting.
const CLAIM_RECENT_MS = 2 * 60 * 1000;

function identityDb(getAdminApp) {
  return getFirestore(getAdminApp(), "hn-enrollmentdata");
}

function securityRef(getAdminApp, uid) {
  return identityDb(getAdminApp).collection("security").doc(uid);
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  return request.auth;
}

function text(value, max) {
  const clean = typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  return clean.length > max ? clean.slice(0, max).trimEnd() : clean;
}

function deviceIdOf(value) {
  return typeof value === "string" && DEVICE_ID_PATTERN.test(value) ? value : null;
}

/** "14:32", in Chile's time zone. */
function clock(ms) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
}

/** What Auth says about the account, to compare with the last time. */
async function authSnapshot(getAdminApp, uid) {
  const user = await getAuth(getAdminApp()).getUser(uid);
  return {
    user,
    snapshot: {
      email: user.email || null,
      providers: [...new Set((user.providerData || []).map(item => item.providerId))].sort(),
      tokensValidAfter: user.tokensValidAfterTime ? Date.parse(user.tokensValidAfterTime) || 0 : 0,
    },
  };
}

const PROVIDER_NAMES = { "google.com": "Google", "apple.com": "Apple", "password": "correo y contraseña", "microsoft.com": "Microsoft" };

/** The alerts for what changed in Auth since the last snapshot. */
function changesBetween(before, after) {
  const alerts = [];
  if (!before) return alerts;
  const emailChanged = before.email && after.email && before.email !== after.email;
  if (emailChanged) {
    alerts.push({
      kind: "account",
      title: "Cambió el correo de tu cuenta",
      body: `Ahora entras con ${after.email}. Si no fuiste tú, escríbenos a muxp@muxp.art.`,
    });
  }
  for (const provider of after.providers) {
    if ((before.providers || []).includes(provider)) continue;
    alerts.push({
      kind: "account",
      title: "Nueva forma de entrar a tu cuenta",
      body: `Ahora también puedes entrar con ${PROVIDER_NAMES[provider] || provider}. Si no fuiste tú, revisa tu cuenta.`,
    });
  }
  // A password reset (or an email change, already told above) cuts every
  // session. HaNet's own cuts save the new time first, so they don't count.
  if (!emailChanged && after.tokensValidAfter > (before.tokensValidAfter || 0) + 1000) {
    alerts.push({
      kind: "account",
      title: "Cambió tu contraseña",
      body: "Se cerró la sesión en tus otros dispositivos. Si no fuiste tú, cámbiala con “Olvidé mi contraseña” y escríbenos.",
    });
  }
  return alerts;
}

/** The account's devices that take push, except one (the one that just signed in). */
async function pushTokensOf(getAdminApp, uid, exceptDeviceId) {
  const snapshot = await identityDb(getAdminApp).collection("pushTokens").where("uid", "==", uid).get();
  return snapshot.docs
    .filter(doc => !exceptDeviceId || doc.data().deviceId !== exceptDeviceId)
    .map(doc => ({ id: doc.id, token: doc.data().token }));
}

/**
 * Tells the account something about its own security: in the notifications
 * section, in the list of the Seguridad screen and as a push to its devices
 * (all of them, or all but `exceptDeviceId`; none with `push: false`).
 * Never throws: an alert that fails must not undo what was done.
 */
async function alertAccount(getAdminApp, uid, alert, { exceptDeviceId = null, push = true } = {}) {
  try {
    if (!uid || !KINDS.includes(alert.kind)) return;
    const message = { title: alert.title, body: alert.body, data: { url: ROUTE } };
    const event = { id: randomUUID(), kind: alert.kind, title: text(alert.title, 120), body: text(alert.body, 240), at: Date.now() };
    await Promise.all([
      recordInbox(getAdminApp, [uid], alert.kind, message),
      securityRef(getAdminApp, uid).set({ events: FieldValue.arrayUnion(event) }, { merge: true }),
    ]);
    if (!push) return;
    const tokens = await pushTokensOf(getAdminApp, uid, exceptDeviceId);
    if (tokens.length) await sendPush(getAdminApp, tokens, { ...message, channelId: ANDROID_CHANNEL });
  } catch (error) {
    console.error("alertAccount", alert.kind, error.message);
  }
}

/** After HaNet itself cuts the sessions (blocking, "Cerrar sesión en todas partes"): not a password change. */
async function noteSessionsCut(getAdminApp, uid) {
  try {
    const { snapshot } = await authSnapshot(getAdminApp, uid);
    await securityRef(getAdminApp, uid).set({ tokensValidAfter: snapshot.tokensValidAfter }, { merge: true });
  } catch (error) {
    console.error("noteSessionsCut", error.message);
  }
}

/** What a user agent says about the device that signed in, in plain words. */
function deviceFromAgent(agent) {
  const ua = String(agent || "");
  const os = /iPad/.test(ua) ? "iPad"
    : /iPhone|iPod/.test(ua) ? "iPhone"
      : /Android/.test(ua) ? "Android"
        : /Windows/.test(ua) ? "Windows"
          : /CrOS/.test(ua) ? "ChromeOS"
            : /Mac OS X|Macintosh/.test(ua) ? "Mac"
              : /Linux/.test(ua) ? "Linux" : null;
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? "Edge"
    : /SamsungBrowser/.test(ua) ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua) ? "Firefox"
        : /OPR\//.test(ua) ? "Opera"
          : /Chrome|CriOS/.test(ua) ? "Chrome"
            : /Safari/.test(ua) ? "Safari" : null;
  if (browser) return os ? `${browser} en ${os}` : browser;
  // The phone app signs in without a browser.
  if (/CFNetwork|Darwin/.test(ua)) return "un iPhone";
  if (/okhttp|Dalvik/.test(ua)) return "un teléfono Android";
  return os || "un dispositivo";
}

function cleanDevice(value) {
  const device = value && typeof value === "object" ? value : {};
  return {
    kind: DEVICE_KINDS.includes(device.kind) ? device.kind : "phone",
    name: text(device.name, 60) || "Dispositivo",
    system: text(device.system, 60) || null,
    app: text(device.app, 40) || null,
  };
}

function build(getAdminApp) {
  // { deviceId, signIn?, device: { kind, name, system, app } } → { alerts }
  // Right after signing in (signIn: true) and every few hours from the app.
  const reportDevice = onCall({ invoker: "public" }, async (request) => {
    const { uid } = requireAuth(request);
    const deviceId = deviceIdOf(request.data?.deviceId);
    if (!deviceId) throw new HttpsError("invalid-argument", "Falta el dispositivo.");
    const signIn = request.data?.signIn === true;
    const device = cleanDevice(request.data?.device);
    const now = Date.now();

    const ref = securityRef(getAdminApp, uid);
    const deviceRef = ref.collection("devices").doc(deviceId);
    const [{ user, snapshot }, stored, storedDevice] = await Promise.all([
      authSnapshot(getAdminApp, uid),
      ref.get(),
      deviceRef.get(),
    ]);

    const before = stored.exists && stored.data().providers ? stored.data() : null;
    const alerts = changesBetween(before, snapshot);

    const lastAt = storedDevice.exists ? storedDevice.data().lastAt || 0 : 0;
    const newDevice = !storedDevice.exists || now - lastAt > NEW_AFTER_MS;
    const created = Date.parse(user.metadata?.creationTime || "") || 0;
    const brandNew = now - created < NEW_ACCOUNT_MS;
    if (signIn && newDevice && !brandNew) {
      alerts.unshift({
        kind: "signIn",
        title: "Nuevo inicio de sesión",
        body: `Entraron a tu cuenta desde ${device.name}${device.system ? ` (${device.system})` : ""} a las ${clock(now)}. ¿No fuiste tú? Revisa tus dispositivos.`,
      });
    }

    await Promise.all([
      ref.set(snapshot, { merge: true }),
      deviceRef.set({
        ...device,
        lastAt: now,
        ...(storedDevice.exists ? {} : { firstAt: now }),
        ...(signIn ? { lastSignInAt: now, signIns: FieldValue.increment(1) } : {}),
      }, { merge: true }),
    ]);

    // This sign-in came from the app: its note from watchSignIn, the newest
    // one of the last two minutes, is claimed. Older notes stay, so an
    // unreported sign-in just before this one is still told.
    if (signIn) {
      const notes = await identityDb(getAdminApp).collection("signInChecks").where("uid", "==", uid).get();
      const own = notes.docs
        .filter(doc => now - (doc.data().at || 0) < CLAIM_RECENT_MS)
        .sort((a, b) => (b.data().at || 0) - (a.data().at || 0))[0];
      if (own) await own.ref.delete();
    }

    for (const alert of alerts) await alertAccount(getAdminApp, uid, alert, { exceptDeviceId: deviceId });
    return { alerts: alerts.length };
  });

  // Every 5 minutes: the sign-ins watchSignIn noted that no app claimed. One
  // alert per account, for its latest one; a brand-new account is skipped.
  const alertUnclaimedSignIns = onSchedule({ schedule: "every 5 minutes", timeoutSeconds: 120 }, async () => {
    const db = identityDb(getAdminApp);
    const now = Date.now();
    const notes = await db.collection("signInChecks").where("at", "<=", now - CLAIM_WINDOW_MS).orderBy("at", "asc").limit(200).get();
    if (notes.empty) return;

    const latest = new Map();
    for (const doc of notes.docs) {
      const data = doc.data();
      if (!data.uid || data.newUser) continue;
      latest.set(data.uid, data);
    }
    for (const [uid, data] of latest) {
      try {
        const user = await getAuth(getAdminApp()).getUser(uid);
        const created = Date.parse(user.metadata?.creationTime || "") || 0;
        if (data.at - created < NEW_ACCOUNT_MS) continue;
      } catch {
        continue;
      }
      await alertAccount(getAdminApp, uid, {
        kind: "signIn",
        title: "Nuevo inicio de sesión",
        body: `Entraron a tu cuenta desde ${deviceFromAgent(data.userAgent)} a las ${clock(data.at)}. ¿No fuiste tú? Revisa tus dispositivos.`,
      });
    }
    await Promise.all(notes.docs.map(doc => doc.ref.delete()));
    console.log("alertUnclaimedSignIns", { notes: notes.size, alerted: latest.size });
  });

  // { deviceId } — signing out on this device takes it off the list.
  const forgetMyDevice = onCall({ invoker: "public" }, async (request) => {
    const { uid } = requireAuth(request);
    const deviceId = deviceIdOf(request.data?.deviceId);
    if (deviceId) await securityRef(getAdminApp, uid).collection("devices").doc(deviceId).delete();
    return { ok: true };
  });

  // → { devices (most recent first), events (newest first) }
  const getMySecurity = onCall({ invoker: "public" }, async (request) => {
    const { uid } = requireAuth(request);
    const ref = securityRef(getAdminApp, uid);
    const db = identityDb(getAdminApp);
    const [stored, devices, tokens] = await Promise.all([
      ref.get(),
      ref.collection("devices").orderBy("lastAt", "desc").limit(MAX_DEVICES + 10).get(),
      db.collection("pushTokens").where("uid", "==", uid).get(),
    ]);

    const now = Date.now();
    const stale = devices.docs.filter((doc, index) => index >= MAX_DEVICES || now - (doc.data().lastAt || 0) > FORGET_AFTER_MS);
    if (stale.length) await Promise.all(stale.map(doc => doc.ref.delete()));
    const withPush = new Set(tokens.docs.map(doc => doc.data().deviceId).filter(Boolean));

    const events = [...(Array.isArray(stored.data()?.events) ? stored.data().events : [])].sort((a, b) => (b.at || 0) - (a.at || 0));
    if (events.length > TRIM_EVENTS_AT) await ref.set({ events: events.slice(0, KEEP_EVENTS) }, { merge: true });

    return {
      devices: devices.docs
        .filter(doc => !stale.includes(doc))
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            kind: data.kind || "phone",
            name: data.name || "Dispositivo",
            system: data.system || null,
            app: data.app || null,
            firstAt: data.firstAt || null,
            lastAt: data.lastAt || null,
            lastSignInAt: data.lastSignInAt || null,
            push: withPush.has(doc.id),
          };
        }),
      events: events.slice(0, KEEP_EVENTS),
    };
  });

  // Cuts every session of the account, this one too: no device can renew its
  // session (the open ones end within the hour) and none gets notifications.
  const signOutEverywhere = onCall({ invoker: "public" }, async (request) => {
    const { uid } = requireAuth(request);
    const db = identityDb(getAdminApp);
    const ref = securityRef(getAdminApp, uid);

    await getAuth(getAdminApp()).revokeRefreshTokens(uid);
    await noteSessionsCut(getAdminApp, uid);
    const [devices, tokens] = await Promise.all([
      ref.collection("devices").get(),
      db.collection("pushTokens").where("uid", "==", uid).get(),
    ]);
    await Promise.all([...devices.docs, ...tokens.docs].map(doc => doc.ref.delete()));
    await alertAccount(getAdminApp, uid, {
      kind: "account",
      title: "Cerraste sesión en todas partes",
      body: "Ningún dispositivo sigue con tu cuenta abierta. Si no fuiste tú, cambia tu contraseña.",
    }, { push: false });
    console.log("signOutEverywhere", { uid, devices: devices.size, tokens: tokens.size });
    return { ok: true };
  });

  return { reportDevice, forgetMyDevice, getMySecurity, signOutEverywhere, alertUnclaimedSignIns };
}

module.exports = { build, alertAccount, noteSessionsCut, changesBetween, deviceFromAgent };
