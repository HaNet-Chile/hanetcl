const { Buffer } = require("node:buffer");
const crypto = require("node:crypto");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("./regions");
const { RESEND_API_KEY, sendEmail, panelCodeEmail } = require("./email");
const { alertAccount } = require("./security");

// The second step to enter the web panel (hanet-panel). After the password,
// the panel asks for a code: one sent to the account's email, one from an
// authenticator app (TOTP, RFC 6238) if the person set one up, or one of the
// backup codes they got when they did.
//
// It is the panel's own, not Firebase Auth's multi-factor: that one applies to
// every sign-in (the app too) and has no email codes. The step is tied to the
// sign-in it completes, by the token's `auth_time`: signing in again, from
// anywhere, starts unverified. The panel-only functions (the Administración
// area, see members.js and institutions.js) check it with requirePanelSession.
//
// hn-enrollmentdata, closed to the app (only these functions):
//   panelAuth/{uid}: {
//     sessions: [{ authTime, verifiedAt, expiresAt, method }],
//     emailCode: { hash, expiresAt, attempts, lastSentAt, windowStart, sendCount },
//     totp: { secret, enabledAt, lastStep },      // the app's secret, base32
//     pendingTotp: { secret, createdAt },         // until the first code confirms it
//     backupCodes: [hash],
//     failures: { count, windowStart },
//   }

const PANEL_ROLES = ["HNT", "Admin", "Profesor", "Directiva", "CEE"];
const CODE_MINUTES = 10;
const RESEND_WAIT_SECONDS = 60;
const SENDS_PER_HOUR = 5;
const CODE_MAX_ATTEMPTS = 5;
// Wrong codes of any kind, per account, before it has to wait.
const MAX_FAILURES = 8;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
// A verified sign-in lasts this long; then the panel asks again.
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SESSIONS = 10;
const BACKUP_CODES = 10;
const PENDING_TOTP_MS = 15 * 60 * 1000;
const ISSUER = "HaNet";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
// No 0/O, 1/l/I: backup codes are copied by hand.
const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function identityDb(getAdminApp) {
  return getFirestore(getAdminApp(), "hn-enrollmentdata");
}

function panelRef(getAdminApp, uid) {
  return identityDb(getAdminApp).collection("panelAuth").doc(uid);
}

function requirePanelRole(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  if (!PANEL_ROLES.includes(request.auth.token.role)) {
    throw new HttpsError("permission-denied", "Tu cuenta no tiene acceso al panel.");
  }
  return request.auth;
}

function authTimeOf(auth) {
  const value = Number(auth.token.auth_time);
  return Number.isFinite(value) ? value : 0;
}

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function sameHash(a, b) {
  return typeof a === "string" && typeof b === "string" && a.length === b.length
    && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function liveSessions(data, now) {
  return (Array.isArray(data?.sessions) ? data.sessions : [])
    .filter(session => (session?.expiresAt?.toMillis?.() ?? 0) > now);
}

function currentSession(data, auth, now) {
  const authTime = authTimeOf(auth);
  return liveSessions(data, now).find(session => session.authTime === authTime) || null;
}

// For the panel-only functions: the caller finished the second step for the
// sign-in this token comes from.
async function requirePanelSession(getAdminApp, request) {
  const auth = requirePanelRole(request);
  const data = (await panelRef(getAdminApp, auth.uid).get()).data();
  if (!currentSession(data, auth, Date.now())) {
    throw new HttpsError("failed-precondition", "Confirma tu entrada al panel con el segundo paso.");
  }
  return auth;
}

// ── TOTP (RFC 6238: SHA-1, 6 digits, 30 s, the step before and after) ───────

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text) {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of text.replace(/=+$/, "")) {
    const index = B32.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(number).padStart(6, "0");
}

// The step that matches, or -1. A step already used does not count twice.
function totpStep(secret, code, now, lastStep = -1) {
  const step = Math.floor(now / 30_000);
  for (const candidate of [step, step - 1, step + 1]) {
    if (candidate > lastStep && sameHash(sha(hotp(secret, candidate)), sha(code))) return candidate;
  }
  return -1;
}

function cleanDigits(value) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : "";
}

function cleanBackup(value) {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) : "";
}

function newBackupCodes(uid) {
  const codes = Array.from({ length: BACKUP_CODES }, () => {
    let code = "";
    for (let i = 0; i < 8; i++) code += BACKUP_ALPHABET[crypto.randomInt(0, BACKUP_ALPHABET.length)];
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
  return { codes, hashes: codes.map(code => sha(`${uid}:backup:${cleanBackup(code)}`)) };
}

// "pa****@liceo.cl": enough to know which inbox, not to read it out.
function maskEmail(email) {
  const [user, domain] = String(email || "").split("@");
  if (!user || !domain) return null;
  return `${user.slice(0, 2)}${"*".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

function failureState(data, now) {
  const windowStart = data?.failures?.windowStart?.toMillis?.() ?? 0;
  const inWindow = now - windowStart < FAILURE_WINDOW_MS;
  return { inWindow, count: inWindow ? data.failures.count || 0 : 0, windowStart };
}

function build(getAdminApp) {
  // What the panel needs to know right after the password: whether this
  // sign-in already passed the second step, which methods the person has,
  // and their institution (for the Administración area).
  const getPanelAuth = onCall({ institutionGate: false }, async (request) => {
    const auth = requirePanelRole(request);
    const db = identityDb(getAdminApp);
    const now = Date.now();
    const [panel, user] = await Promise.all([
      panelRef(getAdminApp, auth.uid).get(),
      db.collection("users").doc(auth.uid).get(),
    ]);
    const data = panel.data() || {};
    const session = currentSession(data, auth, now);

    let institution = null;
    const institutionId = user.data()?.institutionId;
    if (institutionId) {
      const doc = await db.collection("institutions").doc(institutionId).get();
      if (doc.exists) institution = { id: doc.id, name: doc.data().name || doc.id };
    }

    return {
      verified: Boolean(session),
      verifiedUntil: session ? session.expiresAt.toMillis() : null,
      totp: Boolean(data.totp?.secret),
      backupCodesLeft: Array.isArray(data.backupCodes) ? data.backupCodes.length : 0,
      email: maskEmail(auth.token.email),
      institution,
    };
  });

  // Emails a 6-digit code to the account's own address.
  const sendPanelEmailCode = onCall({ institutionGate: false, secrets: [RESEND_API_KEY] }, async (request) => {
    const auth = requirePanelRole(request);
    const email = auth.token.email;
    if (!email) throw new HttpsError("failed-precondition", "Tu cuenta no tiene un correo asociado.");

    const db = identityDb(getAdminApp);
    const ref = panelRef(getAdminApp, auth.uid);
    const now = Date.now();
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

    await db.runTransaction(async (tx) => {
      const previous = (await tx.get(ref)).data()?.emailCode;
      const lastSentAt = previous?.lastSentAt?.toMillis() ?? 0;
      const windowStart = previous?.windowStart?.toMillis() ?? 0;
      const inWindow = now - windowStart < 60 * 60 * 1000;
      const sendCount = inWindow ? previous.sendCount || 0 : 0;

      if (now - lastSentAt < RESEND_WAIT_SECONDS * 1000) {
        throw new HttpsError("resource-exhausted", "Espera un momento antes de pedir otro código.");
      }
      if (sendCount >= SENDS_PER_HOUR) {
        throw new HttpsError("resource-exhausted", "Pediste demasiados códigos. Inténtalo de nuevo en una hora.");
      }
      tx.set(ref, {
        emailCode: {
          hash: sha(`${auth.uid}:panel:${code}`),
          attempts: 0,
          expiresAt: Timestamp.fromMillis(now + CODE_MINUTES * 60 * 1000),
          lastSentAt: Timestamp.fromMillis(now),
          windowStart: inWindow ? previous.windowStart : Timestamp.fromMillis(now),
          sendCount: sendCount + 1,
        },
      }, { merge: true });
    });

    const account = (await db.collection("accounts").doc(auth.uid).get()).data() || {};
    try {
      await sendEmail({ to: email, ...panelCodeEmail({ fullName: account.fullName, code, minutes: CODE_MINUTES }) });
    } catch (error) {
      console.error("sendPanelEmailCode", error.message);
      throw new HttpsError("unavailable", "No pudimos enviar el correo. Inténtalo de nuevo en unos minutos.");
    }
    return { sentTo: maskEmail(email), minutes: CODE_MINUTES, resendInSeconds: RESEND_WAIT_SECONDS };
  });

  // Checks the second step for this sign-in: method "email", "totp" or "backup".
  const verifyPanelSignIn = onCall({ institutionGate: false }, async (request) => {
    const auth = requirePanelRole(request);
    const method = request.data?.method;
    if (!["email", "totp", "backup"].includes(method)) {
      throw new HttpsError("invalid-argument", "Elige cómo confirmar tu entrada.");
    }
    const code = method === "backup" ? cleanBackup(request.data?.code) : cleanDigits(request.data?.code);
    if (code.length < (method === "backup" ? 8 : 6)) {
      throw new HttpsError("invalid-argument", "Escribe el código completo.");
    }

    const db = identityDb(getAdminApp);
    const ref = panelRef(getAdminApp, auth.uid);
    const now = Date.now();
    const authTime = authTimeOf(auth);
    let usedBackup = false;

    // The failure count has to be saved even when the code is wrong, so the
    // transaction returns the verdict instead of throwing.
    const verdict = await db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() || {};
      const failures = failureState(data, now);
      if (failures.count >= MAX_FAILURES) return "locked";

      const update = {};
      let ok = false;

      if (method === "email") {
        const emailCode = data.emailCode;
        const expired = !emailCode?.hash || (emailCode.expiresAt?.toMillis() ?? 0) < now;
        if (expired) return "expired";
        if ((emailCode.attempts || 0) >= CODE_MAX_ATTEMPTS) return "expired";
        ok = sameHash(emailCode.hash, sha(`${auth.uid}:panel:${code}`));
        update.emailCode = ok
          ? FieldValue.delete()
          : { ...emailCode, attempts: (emailCode.attempts || 0) + 1 };
      } else if (method === "totp") {
        if (!data.totp?.secret) return "no-totp";
        const step = totpStep(data.totp.secret, code, now, data.totp.lastStep ?? -1);
        ok = step >= 0;
        if (ok) update["totp.lastStep"] = step;
      } else {
        const hashes = Array.isArray(data.backupCodes) ? data.backupCodes : [];
        const hash = sha(`${auth.uid}:backup:${code}`);
        ok = hashes.some(saved => sameHash(saved, hash));
        if (ok) {
          update.backupCodes = hashes.filter(saved => saved !== hash);
          usedBackup = true;
        }
      }

      if (!ok) {
        update.failures = {
          count: failures.count + 1,
          windowStart: failures.inWindow ? data.failures.windowStart : Timestamp.fromMillis(now),
        };
        tx.set(ref, unflatten(update), { merge: true });
        return "wrong";
      }

      const sessions = liveSessions(data, now).filter(session => session.authTime !== authTime);
      sessions.push({
        authTime,
        verifiedAt: Timestamp.fromMillis(now),
        expiresAt: Timestamp.fromMillis(now + SESSION_MS),
        method,
      });
      update.sessions = sessions.slice(-MAX_SESSIONS);
      update.failures = FieldValue.delete();
      tx.set(ref, unflatten(update), { merge: true });
      return "ok";
    });

    if (verdict === "locked") {
      throw new HttpsError("resource-exhausted", "Hubo demasiados códigos incorrectos. Espera 15 minutos e inténtalo de nuevo.");
    }
    if (verdict === "expired") {
      throw new HttpsError("deadline-exceeded", "Ese código ya venció. Pide uno nuevo.");
    }
    if (verdict === "no-totp") {
      throw new HttpsError("failed-precondition", "Todavía no tienes una app de autenticación. Usa el código por correo.");
    }
    if (verdict === "wrong") {
      throw new HttpsError("invalid-argument", "Ese código no es correcto.");
    }

    if (usedBackup) {
      await alertAccount(getAdminApp, auth.uid, {
        kind: "account",
        title: "Usaste un código de respaldo",
        body: "Entraste al panel web con un código de respaldo. Si no fuiste tú, cambia tu contraseña y crea códigos nuevos.",
      });
    }
    console.log("verifyPanelSignIn", { uid: auth.uid, method });
    return { verified: true, verifiedUntil: now + SESSION_MS };
  });

  // Starts setting up an authenticator app. Only from a sign-in that already
  // passed the second step, so a stolen password cannot add its own app.
  const startPanelTotp = onCall({ institutionGate: false }, async (request) => {
    const auth = await requirePanelSession(getAdminApp, request);
    const secret = base32Encode(crypto.randomBytes(20));
    await panelRef(getAdminApp, auth.uid).set({
      pendingTotp: { secret, createdAt: FieldValue.serverTimestamp() },
    }, { merge: true });

    const label = encodeURIComponent(`${ISSUER}:${auth.token.email || auth.uid}`);
    const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=30`;
    return { secret, uri };
  });

  // The first code from the app confirms it. Returns the backup codes, shown once.
  const confirmPanelTotp = onCall({ institutionGate: false }, async (request) => {
    const auth = await requirePanelSession(getAdminApp, request);
    const code = cleanDigits(request.data?.code);
    const ref = panelRef(getAdminApp, auth.uid);
    const now = Date.now();
    const data = (await ref.get()).data() || {};
    const pending = data.pendingTotp;

    if (!pending?.secret || now - (pending.createdAt?.toMillis?.() ?? 0) > PENDING_TOTP_MS) {
      throw new HttpsError("deadline-exceeded", "Pasó mucho rato. Vuelve a escanear el código QR.");
    }
    const step = totpStep(pending.secret, code, now);
    if (step < 0) throw new HttpsError("invalid-argument", "Ese código no es correcto. Revisa la hora del teléfono.");

    const backup = newBackupCodes(auth.uid);
    await ref.set({
      totp: { secret: pending.secret, enabledAt: FieldValue.serverTimestamp(), lastStep: step },
      pendingTotp: FieldValue.delete(),
      backupCodes: backup.hashes,
    }, { merge: true });

    await alertAccount(getAdminApp, auth.uid, {
      kind: "account",
      title: "Agregaste una app de autenticación",
      body: "Desde ahora puedes entrar al panel web con los códigos de tu app. Si no fuiste tú, escríbenos a muxp@muxp.art.",
    });
    return { backupCodes: backup.codes };
  });

  // Removes the authenticator app and its backup codes. The email code stays.
  const disablePanelTotp = onCall({ institutionGate: false }, async (request) => {
    const auth = await requirePanelSession(getAdminApp, request);
    await panelRef(getAdminApp, auth.uid).set({
      totp: FieldValue.delete(),
      pendingTotp: FieldValue.delete(),
      backupCodes: FieldValue.delete(),
    }, { merge: true });
    await alertAccount(getAdminApp, auth.uid, {
      kind: "account",
      title: "Quitaste la app de autenticación",
      body: "Para entrar al panel web ahora te pediremos un código por correo. Si no fuiste tú, cambia tu contraseña.",
    });
    return { totp: false };
  });

  // New backup codes; the old ones stop working.
  const newPanelBackupCodes = onCall({ institutionGate: false }, async (request) => {
    const auth = await requirePanelSession(getAdminApp, request);
    const ref = panelRef(getAdminApp, auth.uid);
    const data = (await ref.get()).data() || {};
    if (!data.totp?.secret) {
      throw new HttpsError("failed-precondition", "Los códigos de respaldo van con la app de autenticación.");
    }
    const backup = newBackupCodes(auth.uid);
    await ref.set({ backupCodes: backup.hashes }, { merge: true });
    return { backupCodes: backup.codes };
  });

  // On "Cerrar sesión": this sign-in stops counting as verified.
  const endPanelSession = onCall({ institutionGate: false }, async (request) => {
    const auth = requirePanelRole(request);
    const ref = panelRef(getAdminApp, auth.uid);
    const authTime = authTimeOf(auth);
    await identityDb(getAdminApp).runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data();
      if (!data) return;
      const sessions = liveSessions(data, Date.now()).filter(session => session.authTime !== authTime);
      tx.set(ref, { sessions }, { merge: true });
    });
    return { ended: true };
  });

  return {
    getPanelAuth,
    sendPanelEmailCode,
    verifyPanelSignIn,
    startPanelTotp,
    confirmPanelTotp,
    disablePanelTotp,
    newPanelBackupCodes,
    endPanelSession,
  };
}

// set(..., { merge: true }) takes nested objects, not "a.b" paths.
function unflatten(update) {
  const out = {};
  for (const [key, value] of Object.entries(update)) {
    const parts = key.split(".");
    let node = out;
    parts.slice(0, -1).forEach((part) => {
      node[part] = node[part] || {};
      node = node[part];
    });
    node[parts[parts.length - 1]] = value;
  }
  return out;
}

module.exports = { build, requirePanelSession, PANEL_ROLES, hotp, base32Encode, totpStep };
