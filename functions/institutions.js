const crypto = require("node:crypto");
const { onCall, HttpsError } = require("./regions");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const WORDS = require("./wordlist");
const { requireStaff } = require("./staff");
const { cityById } = require("./cities");
const { statusRef, closureOf, closureActive, resetAppStatusCache, KINDS: CLOSURE_KINDS, MESSAGE_MAX: CLOSURE_MESSAGE_MAX } = require("./app-status");

// institutions/{institutionId}
//   name, fullName, methods, inviteHash, inviteUpdatedAt, createdAt,
//   branding: { logoUrl, bannerUrl, updatedAt }   (images in Storage, see storage.rules)
//   cityId   (cities.js: the weather of the day's summary is from there)
//   closure: { closed, kind, message, from, until, teachers, updatedAt, updatedBy }
//            HaNet closed for this liceo only (app-status.js has the gate)
//   schoolYear: { start, end, secondSemester }   "YYYY-MM-DD", Chile's dates
// institutions/{institutionId}/roster/{rut}
//   rut, nombres, apellidos, curso, email, updatedAt, linkedUid?
//
// The invitation phrase leads to an institution, and the institution owns
// the roster that the identity link searches by institutional email.

const WORD_COUNT = 4;
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ROSTER_ROWS = 2000;
const WRITE_CHUNK = 400;
const DEFAULT_METHODS = ["institutional-email", "form"];
// Modules an institution can switch off (institutions/{id}.modules). Each one
// is enforced where it lives: feed and polls in feed.js, alliances (Aniversario)
// in anniversary.js, electividad in electividad.js. Without the list every
// module is on, so the pilot worked before the panel could switch them.
const MODULES = ["feed", "polls", "alliances", "electividad", "grades"];

function identityDb(getAdminApp) {
  return getFirestore(getAdminApp(), "hn-enrollmentdata");
}

function requireHnt(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  if (request.auth.token.role !== "HNT") {
    throw new HttpsError("permission-denied", "Esta acción es solo para el equipo HaNet.");
  }
  return request.auth;
}

function text(value, max) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

// Lowercase, no accents, letters only: "  Árbol " and "arbol" are the same word.
function normalizeWord(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-zñ]/g, "");
}

function hashPhrase(words) {
  return crypto.createHash("sha256").update(`hanet-invite:${words.join(" ")}`).digest("hex");
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Chilean RUT: digits plus a check digit computed with modulo 11.
function normalizeRut(value) {
  const clean = String(value || "").replace(/[^0-9kK]/g, "").toUpperCase();
  if (clean.length < 7 || clean.length > 9) return null;

  const body = clean.slice(0, -1);
  if (!/^\d+$/.test(body)) return null;

  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  const expected = rest === 11 ? "0" : rest === 10 ? "K" : String(rest);
  return expected === clean.slice(-1) ? clean : null;
}

const BUCKET = "hanet-edu.firebasestorage.app";
const BRANDING_KINDS = ["logo", "banner"];

// The institution's shield and banner: part of its identity, shown in Home,
// in the identity link and in the emails it sends. Missing ones are null.
function brandingOf(data) {
  return {
    logoUrl: data?.branding?.logoUrl || null,
    bannerUrl: data?.branding?.bannerUrl || null,
  };
}

// Only download URLs of this institution's own files in our bucket.
function isBrandingUrl(url, institutionId, kind) {
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(`institutions/${institutionId}/${kind}`)}`;
  return typeof url === "string" && url.length < 2000 && url.startsWith(prefix);
}

// Up to when a closure may be set ahead, and how long a school year may last.
const CLOSURE_AHEAD_MS = 400 * 24 * 3600 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MAX_DAYS = 400;

function validDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dayNumber(value) {
  return Math.round(Date.parse(`${value}T12:00:00Z`) / 86400000);
}

function schoolYearOf(data) {
  const year = data?.schoolYear;
  if (!year || !validDate(year.start) || !validDate(year.end)) return null;
  return { start: year.start, end: year.end, secondSemester: validDate(year.secondSemester) ? year.secondSemester : null };
}

// What the panels show of a closure: null when there is none or it ended.
function closureOut(data, now = Date.now()) {
  const closure = closureOf(data?.closure);
  if (!closure || (closure.until !== null && closure.until <= now)) return null;
  return { kind: closure.kind, message: closure.message, from: closure.from, until: closure.until, teachers: closure.teachers, active: closureActive(closure, now) };
}

function optionalMillis(value, label) {
  if (value === null || value === undefined) return null;
  const millis = Number(value);
  if (!Number.isFinite(millis) || millis < Date.now() - 24 * 3600 * 1000 || millis > Date.now() + CLOSURE_AHEAD_MS) {
    throw new HttpsError("invalid-argument", `${label} tiene que ser dentro del próximo año.`);
  }
  return millis;
}

function build(getAdminApp) {
  // ── Student side ──────────────────────────────────────────────────────────

  // Checks an invitation phrase and ties the account to its institution. It
  // grants nothing by itself: academic data still needs the identity link.
  const redeemInviteCode = onCall({ institutionGate: false }, async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    if (!request.auth.token.email_verified) {
      throw new HttpsError("failed-precondition", "Primero verifica tu correo.");
    }

    const raw = Array.isArray(request.data?.words) ? request.data.words : [];
    const words = raw.slice(0, WORD_COUNT).map(normalizeWord);
    if (raw.length !== WORD_COUNT || words.some(word => word.length < 2 || word.length > 24)) {
      throw new HttpsError("invalid-argument", "Escribe las cuatro palabras del código.");
    }

    const uid = request.auth.uid;
    const db = identityDb(getAdminApp);
    const attemptsRef = db.collection("inviteAttempts").doc(uid);
    const now = Date.now();

    // Count the attempt before checking it, so guessing is always paid for.
    await db.runTransaction(async (tx) => {
      const previous = (await tx.get(attemptsRef)).data();
      const windowStart = previous?.windowStart?.toMillis() ?? 0;
      const inWindow = now - windowStart < ATTEMPT_WINDOW_MS;
      const count = inWindow ? previous.count || 0 : 0;

      if (count >= MAX_ATTEMPTS) {
        throw new HttpsError("resource-exhausted", "Demasiados intentos. Espera 15 minutos y vuelve a probar.");
      }
      tx.set(attemptsRef, {
        count: count + 1,
        windowStart: inWindow ? previous.windowStart : Timestamp.fromMillis(now),
      });
    });

    const match = await db.collection("institutions")
      .where("inviteHash", "==", hashPhrase(words))
      .limit(1)
      .get();

    if (match.empty) {
      throw new HttpsError("not-found", "Ese código no coincide con ninguna institución. Revisa las palabras y su orden.");
    }

    const institution = match.docs[0];
    await db.collection("accounts").doc(uid).set(
      { institutionId: institution.id, invitedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    await attemptsRef.delete();

    return {
      institutionId: institution.id,
      name: institution.data().name,
      methods: institution.data().methods || DEFAULT_METHODS,
    };
  });

  // ── HaNet team (role HNT) ─────────────────────────────────────────────────

  // HNT: every institution. Admin: only their own (the Administración area).
  const adminListInstitutions = onCall(async (request) => {
    const staff = await requireStaff(getAdminApp, request, ["Admin"]);
    const db = identityDb(getAdminApp);
    const docs = staff.hnt
      ? (await db.collection("institutions").get()).docs
      : [await db.collection("institutions").doc(staff.institutionId).get()].filter(doc => doc.exists);

    const institutions = await Promise.all(docs.map(async (doc) => {
      const data = doc.data();
      const roster = await doc.ref.collection("roster").count().get();
      return {
        id: doc.id,
        name: data.name,
        fullName: data.fullName || "",
        rosterCount: roster.data().count,
        hasInviteCode: Boolean(data.inviteHash),
        inviteUpdatedAt: data.inviteUpdatedAt ? data.inviteUpdatedAt.toMillis() : null,
        ...brandingOf(data),
        cityId: cityById(data.cityId)?.id || null,
        // null: no list yet, so every module is on.
        modules: Array.isArray(data.modules) ? data.modules.filter(module => MODULES.includes(module)) : null,
        closure: closureOut(data),
        schoolYear: schoolYearOf(data),
      };
    }));

    return { institutions: institutions.sort((a, b) => a.name.localeCompare(b.name, "es")) };
  });

  const adminCreateInstitution = onCall(async (request) => {
    requireHnt(request);
    const name = text(request.data?.name, 40);
    const fullName = text(request.data?.fullName, 120);
    const id = slugify(name);

    if (name.length < 2 || id.length < 2) {
      throw new HttpsError("invalid-argument", "Escribe el nombre corto de la institución, por ejemplo \"LCH Temuco\".");
    }

    const ref = identityDb(getAdminApp).collection("institutions").doc(id);
    if ((await ref.get()).exists) {
      throw new HttpsError("already-exists", "Ya existe una institución con ese nombre.");
    }

    await ref.set({
      name,
      fullName,
      methods: DEFAULT_METHODS,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id };
  });

  // Replaces the institution's invitation phrase. Only the hash is stored, so
  // the phrase returned here cannot be shown again.
  const adminRotateInviteCode = onCall(async (request) => {
    const institutionId = text(request.data?.institutionId, 60);
    await requireStaff(getAdminApp, request, ["Admin"], institutionId);
    const db = identityDb(getAdminApp);
    const ref = db.collection("institutions").doc(institutionId);

    if (!institutionId || !(await ref.get()).exists) {
      throw new HttpsError("not-found", "No encontramos esa institución.");
    }

    const picked = [];
    while (picked.length < WORD_COUNT) {
      const word = WORDS[crypto.randomInt(0, WORDS.length)];
      if (!picked.includes(word)) picked.push(word);
    }

    await ref.update({
      inviteHash: hashPhrase(picked),
      inviteUpdatedAt: FieldValue.serverTimestamp(),
    });
    return { words: picked };
  });

  // Loads or updates roster rows. Rows are keyed by RUT, so importing the
  // same sheet twice updates instead of duplicating, and never touches a
  // link that already exists.
  const adminImportRoster = onCall(async (request) => {
    const institutionId = text(request.data?.institutionId, 60);
    await requireStaff(getAdminApp, request, ["Admin"], institutionId);
    const rows = Array.isArray(request.data?.rows) ? request.data.rows : [];
    const db = identityDb(getAdminApp);
    const ref = db.collection("institutions").doc(institutionId);

    if (!institutionId || !(await ref.get()).exists) {
      throw new HttpsError("not-found", "No encontramos esa institución.");
    }
    if (rows.length === 0) {
      throw new HttpsError("invalid-argument", "La lista está vacía.");
    }
    if (rows.length > MAX_ROSTER_ROWS) {
      throw new HttpsError("invalid-argument", `Carga como máximo ${MAX_ROSTER_ROWS} filas por vez.`);
    }

    const valid = new Map();
    const rejected = [];

    rows.forEach((row, index) => {
      const rut = normalizeRut(row?.rut);
      const nombres = text(row?.nombres, 80);
      const apellidos = text(row?.apellidos, 80);
      const curso = text(row?.curso, 60);
      const email = text(row?.email, 120).toLowerCase();

      const reason = !rut ? "RUT no válido"
        : !nombres || !apellidos ? "faltan nombres o apellidos"
          : !curso ? "falta el curso"
            : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "correo no válido"
              : null;

      if (reason) rejected.push({ row: index + 1, reason });
      else valid.set(rut, { rut, nombres, apellidos, curso, email });
    });

    const entries = [...valid.values()];
    for (let start = 0; start < entries.length; start += WRITE_CHUNK) {
      const batch = db.batch();
      entries.slice(start, start + WRITE_CHUNK).forEach((entry) => {
        batch.set(
          ref.collection("roster").doc(entry.rut),
          { ...entry, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      });
      await batch.commit();
    }

    // Counts only: roster contents never go to the logs.
    console.log("adminImportRoster", { institutionId, imported: entries.length, rejected: rejected.length });
    return { imported: entries.length, rejected: rejected.slice(0, 50), rejectedCount: rejected.length };
  });

  // Sets or clears the shield ("logo") or banner. The app uploads the image to
  // Storage first (HNT only, by the storage rules) and hands over its URL.
  // Explicitly public at the network level, like every callable: who may act
  // is decided inside (requireHnt). Stated here so a deploy always sets it.
  const adminSetInstitutionBranding = onCall({ invoker: "public" }, async (request) => {
    requireHnt(request);
    const institutionId = text(request.data?.institutionId, 60);
    const kind = request.data?.kind;
    const url = request.data?.url ?? null;

    if (!BRANDING_KINDS.includes(kind)) {
      throw new HttpsError("invalid-argument", "Elige el escudo o el banner.");
    }
    if (url !== null && !isBrandingUrl(url, institutionId, kind)) {
      throw new HttpsError("invalid-argument", "Esa imagen no es de esta institución.");
    }

    const ref = identityDb(getAdminApp).collection("institutions").doc(institutionId);
    if (!institutionId || !(await ref.get()).exists) {
      throw new HttpsError("not-found", "No encontramos esa institución.");
    }

    await ref.set({
      branding: {
        [`${kind}Url`]: url === null ? FieldValue.delete() : url,
        updatedAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
    return { kind, url };
  });

  // Turns the institution's modules on or off. Writes the whole list, so an
  // institution that had none (everything on) gets an explicit one.
  const setInstitutionModules = onCall({ invoker: "public" }, async (request) => {
    requireHnt(request);
    const institutionId = text(request.data?.institutionId, 60);
    const modules = Array.isArray(request.data?.modules) ? request.data.modules : null;
    if (!modules || modules.some(module => !MODULES.includes(module))) {
      throw new HttpsError("invalid-argument", "Elige módulos de la lista.");
    }
    const ref = identityDb(getAdminApp).collection("institutions").doc(institutionId);
    if (!institutionId || !(await ref.get()).exists) {
      throw new HttpsError("not-found", "No encontramos esa institución.");
    }
    const list = MODULES.filter(module => modules.includes(module));
    await ref.update({ modules: list, modulesUpdatedAt: FieldValue.serverTimestamp() });
    console.log("setInstitutionModules", { institutionId, modules: list, by: request.auth.uid });
    return { modules: list };
  });

  // The institution's city, for the weather in the summary of the day. null clears it.
  const setInstitutionCity = onCall({ invoker: "public" }, async (request) => {
    requireHnt(request);
    const institutionId = text(request.data?.institutionId, 60);
    const cityId = request.data?.cityId ?? null;
    if (cityId !== null && !cityById(cityId)) throw new HttpsError("invalid-argument", "Elige una ciudad de la lista.");
    const ref = identityDb(getAdminApp).collection("institutions").doc(institutionId);
    if (!institutionId || !(await ref.get()).exists) {
      throw new HttpsError("not-found", "No encontramos esa institución.");
    }
    await ref.update({ cityId: cityId === null ? FieldValue.delete() : cityId });
    return { cityId };
  });

  // Closes HaNet for this liceo only, now or from a later time, and opens it
  // again (by hand, or by itself at `until`). HNT, or the liceo's Admin from
  // the web panel. Written to the institution and copied to config/appStatus,
  // which is what the gate reads (app-status.js).
  const setInstitutionClosure = onCall({ invoker: "public" }, async (request) => {
    const institutionId = text(request.data?.institutionId, 60);
    await requireStaff(getAdminApp, request, ["Admin"], institutionId);
    const data = request.data || {};
    if (typeof data.closed !== "boolean") throw new HttpsError("invalid-argument", "Falta decir si HaNet queda abierto o cerrado en el liceo.");
    const db = identityDb(getAdminApp);
    const ref = db.collection("institutions").doc(institutionId);
    const snapshot = institutionId ? await ref.get() : null;
    if (!snapshot?.exists) throw new HttpsError("not-found", "No encontramos esa institución.");

    const batch = db.batch();
    if (!data.closed) {
      batch.update(ref, { closure: FieldValue.delete() });
      batch.set(statusRef(), { institutions: { [institutionId]: FieldValue.delete() } }, { merge: true });
    } else {
      if (!CLOSURE_KINDS.includes(data.kind)) throw new HttpsError("invalid-argument", "Elige qué pasa: mantención, un problema o cerrado.");
      const message = typeof data.message === "string" ? data.message.trim() : "";
      if (message.length > CLOSURE_MESSAGE_MAX) throw new HttpsError("invalid-argument", `El mensaje puede tener hasta ${CLOSURE_MESSAGE_MAX} caracteres.`);
      const from = optionalMillis(data.from, "El inicio del cierre");
      const until = optionalMillis(data.until, "La reapertura");
      if (until !== null && until <= Math.max(from ?? 0, Date.now())) {
        throw new HttpsError("invalid-argument", "La reapertura tiene que ser después del cierre.");
      }
      const closure = {
        closed: true,
        kind: data.kind,
        message: message || null,
        from: from === null ? null : Timestamp.fromMillis(from),
        until: until === null ? null : Timestamp.fromMillis(until),
        teachers: data.teachers === true,
      };
      batch.update(ref, { closure: { ...closure, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid } });
      // The copy carries the name, for the closed screen of whoever isn't signed in to it yet.
      batch.set(statusRef(), { institutions: { [institutionId]: { ...closure, name: snapshot.get("name") || null } } }, { merge: true });
    }
    await batch.commit();
    resetAppStatusCache();
    console.log("setInstitutionClosure", { institutionId, closed: data.closed, kind: data.kind || null, by: request.auth.uid });
    return { closure: closureOut((await ref.get()).data()) };
  });

  // The liceo's school year: first and last day of classes, and optionally
  // the first day of the 2nd semester (Notas splits the semesters there).
  // null clears it. HNT, or the liceo's Admin from the web panel.
  const setInstitutionSchoolYear = onCall({ invoker: "public" }, async (request) => {
    const institutionId = text(request.data?.institutionId, 60);
    await requireStaff(getAdminApp, request, ["Admin"], institutionId);
    const input = request.data?.schoolYear ?? null;
    const ref = identityDb(getAdminApp).collection("institutions").doc(institutionId);
    if (!institutionId || !(await ref.get()).exists) throw new HttpsError("not-found", "No encontramos esa institución.");

    if (input === null) {
      await ref.update({ schoolYear: FieldValue.delete() });
      return { schoolYear: null };
    }
    const start = input?.start;
    const end = input?.end;
    const second = input?.secondSemester ?? null;
    if (!validDate(start) || !validDate(end)) throw new HttpsError("invalid-argument", "Elige el primer y el último día de clases.");
    const days = dayNumber(end) - dayNumber(start);
    if (days <= 0) throw new HttpsError("invalid-argument", "El último día de clases tiene que ser después del primero.");
    if (days > YEAR_MAX_DAYS) throw new HttpsError("invalid-argument", "El año escolar no puede durar más de 13 meses.");
    if (second !== null && (!validDate(second) || dayNumber(second) <= dayNumber(start) || dayNumber(second) > dayNumber(end))) {
      throw new HttpsError("invalid-argument", "El 2° semestre tiene que empezar dentro del año escolar.");
    }
    const schoolYear = { start, end, secondSemester: second };
    await ref.update({ schoolYear: { ...schoolYear, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid } });
    console.log("setInstitutionSchoolYear", { institutionId, ...schoolYear, by: request.auth.uid });
    return { schoolYear };
  });

  // Renames the institution (the short name and the full one). HNT only. The
  // id stays: it is in every account, Hall and Calendar of the liceo.
  const setInstitutionName = onCall({ invoker: "public" }, async (request) => {
    requireHnt(request);
    const institutionId = text(request.data?.institutionId, 60);
    const name = text(request.data?.name, 40);
    const fullName = text(request.data?.fullName, 120);
    if (name.length < 2) throw new HttpsError("invalid-argument", "Escribe el nombre corto de la institución, por ejemplo \"LCH Temuco\".");
    const db = identityDb(getAdminApp);
    const ref = db.collection("institutions").doc(institutionId);
    const snapshot = institutionId ? await ref.get() : null;
    if (!snapshot?.exists) throw new HttpsError("not-found", "No encontramos esa institución.");
    const batch = db.batch();
    batch.update(ref, { name, fullName, renamedAt: FieldValue.serverTimestamp() });
    // The closed screen shows the name too.
    if (snapshot.get("closure.closed") === true) {
      batch.set(statusRef(), { institutions: { [institutionId]: { name } } }, { merge: true });
    }
    await batch.commit();
    resetAppStatusCache();
    console.log("setInstitutionName", { institutionId, by: request.auth.uid });
    return { name, fullName };
  });

  return { setInstitutionClosure, setInstitutionSchoolYear, setInstitutionName, setInstitutionCity, setInstitutionModules, redeemInviteCode, adminListInstitutions, adminCreateInstitution, adminRotateInviteCode, adminImportRoster, adminSetInstitutionBranding };
}

module.exports = { build, normalizeRut, schoolYearOf };
