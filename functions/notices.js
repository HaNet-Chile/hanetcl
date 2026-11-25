const { randomUUID } = require("node:crypto");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("./regions");
const { sendPush } = require("./classhall-notify");
const { recordInbox } = require("./inbox");

// Notificaciones de Organizar (decided by muxp 2026-11-25): Admin, CEE and HNT
// send a short notice to the whole liceo, a jornada, some courses, a group
// or a few students. It rings their phones (and browsers) and stays in their
// notifications section, like any other push of HaNet.
//
// Who may send to whom:
//   Admin, HNT  everyone of their institution: the whole liceo or a jornada
//               (docentes too, if they choose), courses, Presidentes de curso,
//               the Directivas, a saved group or students picked one by one.
//   CEE         the whole liceo, a jornada, courses, Presidentes de curso and
//               the Directivas: never a student picked by name, since the CEE
//               is students too and HaNet has nothing between students.
// A notice comes from the institution's Espacio (Comunidad <liceo>, CEE
// <liceo>, HaNet), never from a person, like the Feed. Who sent it is kept
// for the record, which Admin and HNT can read in "Enviadas".
//
// In hn-enrollmentdata, closed to the app:
//   notices/{id}        institutionId, from, senderUid, senderName, senderRole,
//                       audience, label, body, url, reached, at
//   noticeGroups/{id}   institutionId, name, uids, createdBy, updatedAt
//   noticeLimits/{institutionId}__{day}   { CEE: n, Admin: n }
// The push can be turned off in Configuraciones
// (accounts/{uid}.notifications.notices); the notice still lands in the
// notifications section.
//
// Cost: a send reads the institution's people and their accounts (2 reads a
// person) and writes one inbox item each. For a liceo of 1.000 that is about
// 3.000 operations, around US$0,003; pushes through Expo and FCM are free.

const SENDERS = ["Admin", "CEE", "HNT"];
const FULL_SENDERS = ["Admin", "HNT"];
const STAFF = ["Profesor", "Admin", "HNT"];
const KINDS = ["all", "jornada", "courses", "leads", "directivas", "group", "students"];
const CEE_KINDS = ["all", "jornada", "courses", "leads", "directivas"];
// Sends a day per institution: enough for a busy day, not for a flood.
const DAILY = { CEE: 5, Admin: 30 };
const MAX_BODY = 200;
const MAX_PICKED = 300;
const MAX_GROUPS = 40;
const HISTORY = 40;

function identityDb(getAdminApp) {
  return getFirestore(getAdminApp(), "hn-enrollmentdata");
}

function text(value, max) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

async function requireSender(getAdminApp, request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const snapshot = await identityDb(getAdminApp).collection("users").doc(request.auth.uid).get();
  const profile = snapshot.data();
  if (!profile?.institutionId) throw new HttpsError("failed-precondition", "Primero vincula tu HaNet ID con tu institución.");
  if (!SENDERS.includes(profile.role)) {
    throw new HttpsError("permission-denied", "Solo la administración, el CEE y el equipo HaNet envían notificaciones.");
  }
  return { uid: request.auth.uid, ...profile };
}

/** The Espacio a notice comes from, named as the Feed names it. */
function fromName(role, institution) {
  const short = institution?.name || "";
  if (role === "CEE") return text(institution?.feed?.spaces?.cee?.name, 40) || `CEE ${short}`.trim();
  if (role === "Admin") return text(institution?.feed?.spaces?.school?.name, 40) || `Comunidad ${short}`.trim();
  return "HaNet";
}

/** "2026-11-25" in Chile, for the daily limit. */
function chileDay(ms = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

function ids(list, max) {
  return [...new Set((Array.isArray(list) ? list : []).map(item => text(item, 128)).filter(Boolean))].slice(0, max);
}

/** The audience from the form, checked against what this role may use. */
function cleanAudience(input, role) {
  const kind = KINDS.includes(input?.kind) ? input.kind : null;
  if (!kind) throw new HttpsError("invalid-argument", "Elige a quién le llega.");
  if (!FULL_SENDERS.includes(role) && !CEE_KINDS.includes(kind)) {
    throw new HttpsError("permission-denied", "El CEE envía al liceo, a una jornada, a cursos, a los presidentes de curso o a las directivas.");
  }
  const staff = FULL_SENDERS.includes(role) && ["all", "jornada"].includes(kind) && input.staff === true;
  if (kind === "jornada") {
    if (!["manana", "tarde"].includes(input.jornada)) throw new HttpsError("invalid-argument", "Elige la jornada.");
    return { kind, jornada: input.jornada, staff };
  }
  if (kind === "courses") {
    const courseIds = ids(input.courseIds, 80).map(course => course.slice(0, 60));
    if (!courseIds.length) throw new HttpsError("invalid-argument", "Elige al menos un curso.");
    return { kind, courseIds };
  }
  if (kind === "group") {
    const groupId = text(input.groupId, 40);
    if (!groupId) throw new HttpsError("invalid-argument", "Elige un grupo.");
    return { kind, groupId };
  }
  if (kind === "students") {
    const uids = ids(input.uids, MAX_PICKED);
    if (!uids.length) throw new HttpsError("invalid-argument", "Elige al menos un estudiante.");
    return { kind, uids };
  }
  return staff ? { kind, staff } : { kind };
}

/** People of the institution, with what deciding needs. */
async function institutionPeople(db, institutionId) {
  const snapshot = await db.collection("users").where("institutionId", "==", institutionId).select("role", "courseId", "courseLead", "name").get();
  return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

async function accountsOf(db, uids) {
  const accounts = new Map();
  for (let start = 0; start < uids.length; start += 300) {
    const chunk = uids.slice(start, start + 300);
    const snapshots = await db.getAll(...chunk.map(uid => db.collection("accounts").doc(uid)), { fieldMask: ["jornada", "notifications"] });
    snapshots.forEach((snapshot, index) => accounts.set(chunk[index], snapshot.data() || {}));
  }
  return accounts;
}

/**
 * Who the audience reaches, without whoever sends. A student without a
 * jornada hears both, as the Feed shows them both.
 */
async function resolve(db, profile, audience) {
  const everyone = await institutionPeople(db, profile.institutionId);
  const isStudent = person => !STAFF.includes(person.role);
  let people;
  let group = null;
  if (audience.kind === "all" || audience.kind === "jornada") {
    people = everyone.filter(person => isStudent(person) || (audience.staff && person.role !== "HNT"));
  } else if (audience.kind === "courses") {
    people = everyone.filter(person => isStudent(person) && audience.courseIds.includes(person.courseId));
  } else if (audience.kind === "leads") {
    people = everyone.filter(person => isStudent(person) && person.courseLead === true);
  } else if (audience.kind === "directivas") {
    people = everyone.filter(person => person.role === "Directiva");
  } else if (audience.kind === "group") {
    const snapshot = await db.collection("noticeGroups").doc(audience.groupId).get();
    if (!snapshot.exists || snapshot.data().institutionId !== profile.institutionId) {
      throw new HttpsError("not-found", "Ese grupo ya no existe.");
    }
    group = snapshot.data();
    const members = new Set(group.uids || []);
    people = everyone.filter(person => isStudent(person) && members.has(person.uid));
  } else {
    const picked = new Set(audience.uids);
    people = everyone.filter(person => isStudent(person) && picked.has(person.uid));
  }
  people = people.filter(person => person.uid !== profile.uid);
  const accounts = await accountsOf(db, people.map(person => person.uid));
  if (audience.kind === "jornada") {
    people = people.filter(person => {
      if (!isStudent(person)) return true;
      const jornada = accounts.get(person.uid)?.jornada;
      return !["manana", "tarde"].includes(jornada) || jornada === audience.jornada;
    });
  }
  return { uids: people.map(person => person.uid), accounts, group };
}

const JORNADA_NAMES = { manana: "Jornada de la mañana", tarde: "Jornada de la tarde" };

/** How "Enviadas" names the audience. */
function audienceLabel(audience, group) {
  const withStaff = label => (audience.staff ? `${label}, con docentes` : label);
  if (audience.kind === "all") return withStaff("Todo el liceo");
  if (audience.kind === "jornada") return withStaff(JORNADA_NAMES[audience.jornada]);
  if (audience.kind === "courses") {
    return audience.courseIds.length <= 3 ? audience.courseIds.join(", ") : `${audience.courseIds.length} cursos`;
  }
  if (audience.kind === "leads") return "Presidentes de curso";
  if (audience.kind === "directivas") return "Directivas de curso";
  if (audience.kind === "group") return text(group?.name, 40) || "Un grupo";
  return audience.uids.length === 1 ? "1 estudiante" : `${audience.uids.length} estudiantes`;
}

/** Only HaNet's own screens: an event of the institution, or the Calendar. */
async function cleanLink(getAdminApp, input, profile) {
  if (input === "calendar") return "/calendar";
  if (input?.eventId) {
    const eventId = text(input.eventId, 60);
    if (!/^[A-Za-z0-9_-]{6,60}$/.test(eventId)) throw new HttpsError("invalid-argument", "Ese evento no existe.");
    const event = await getFirestore(getAdminApp(), "hn-calendar").collection("hnEvents").doc(eventId).get();
    const data = event.data();
    if (!data || data.kind !== "institution" || data.institutionId !== profile.institutionId) {
      throw new HttpsError("not-found", "Ese evento no existe.");
    }
    return `/event-detail?id=${eventId}`;
  }
  return null;
}

function noticeOut(doc, full) {
  const data = doc.data();
  return {
    id: doc.id,
    from: data.from,
    label: data.label,
    body: data.body,
    reached: data.reached || 0,
    at: data.at || 0,
    url: data.url || null,
    senderName: full ? data.senderName || null : null,
    senderRole: data.senderRole || null,
  };
}

function build(getAdminApp) {
  // { audience, body, link?, dryRun? } → { reached } (dryRun: how many it
  // would reach, without sending, for "¿Enviar a 312 personas?").
  const sendNotice = onCall({ invoker: "public" }, async (request) => {
    const profile = await requireSender(getAdminApp, request);
    const db = identityDb(getAdminApp);
    const audience = cleanAudience(request.data?.audience, profile.role);
    const body = text(request.data?.body, MAX_BODY);
    if (!body) throw new HttpsError("invalid-argument", "Escribe el mensaje.");
    const { uids, accounts, group } = await resolve(db, profile, audience);
    if (request.data?.dryRun === true) return { reached: uids.length };
    if (!uids.length) throw new HttpsError("failed-precondition", "No hay nadie a quien le llegue.");
    const url = await cleanLink(getAdminApp, request.data?.link, profile);

    // The daily limit, counted per institution and role (HNT has none).
    if (DAILY[profile.role]) {
      const limitRef = db.collection("noticeLimits").doc(`${profile.institutionId}__${chileDay()}`);
      await db.runTransaction(async (transaction) => {
        const used = (await transaction.get(limitRef)).data()?.[profile.role] || 0;
        if (used >= DAILY[profile.role]) {
          throw new HttpsError("resource-exhausted", `Por hoy ya se enviaron ${DAILY[profile.role]} notificaciones. Mañana puedes enviar más.`);
        }
        transaction.set(limitRef, { [profile.role]: used + 1 }, { merge: true });
      });
    }

    const institution = (await db.collection("institutions").doc(profile.institutionId).get()).data() || {};
    const from = fromName(profile.role, institution);
    const message = { title: from, body, data: url ? { url } : {} };
    await recordInbox(getAdminApp, uids, "notice", message);
    const wanted = uids.filter(uid => accounts.get(uid)?.notifications?.notices !== false);
    const tokens = [];
    for (let start = 0; start < wanted.length; start += 30) {
      const snapshot = await db.collection("pushTokens").where("uid", "in", wanted.slice(start, start + 30)).get();
      for (const doc of snapshot.docs) tokens.push({ id: doc.id, token: doc.data().token });
    }
    if (tokens.length) {
      try {
        await sendPush(getAdminApp, tokens, message);
      } catch (error) {
        // The notice is already in everyone's notifications section.
        console.error("sendNotice push", error.message);
      }
    }
    const id = randomUUID();
    await db.collection("notices").doc(id).set({
      institutionId: profile.institutionId,
      from,
      senderUid: profile.uid,
      senderName: text(profile.name, 80) || null,
      senderRole: profile.role,
      audience,
      label: audienceLabel(audience, group),
      body,
      url,
      reached: uids.length,
      at: Date.now(),
    });
    return { id, reached: uids.length };
  });

  // "Enviadas": the institution's notices, newest first. Admin and HNT see
  // all of them and who sent each; the CEE sees its own.
  const listNotices = onCall({ invoker: "public" }, async (request) => {
    const profile = await requireSender(getAdminApp, request);
    const full = FULL_SENDERS.includes(profile.role);
    const db = identityDb(getAdminApp);
    const [snapshot, institution] = await Promise.all([
      db.collection("notices").where("institutionId", "==", profile.institutionId).get(),
      db.collection("institutions").doc(profile.institutionId).get(),
    ]);
    const docs = snapshot.docs
      .filter(doc => full || doc.data().senderRole === "CEE")
      .sort((a, b) => (b.data().at || 0) - (a.data().at || 0))
      .slice(0, HISTORY);
    // `from`: the Espacio this person's notices come from, for the preview.
    return { notices: docs.map(doc => noticeOut(doc, full)), from: fromName(profile.role, institution.data() || {}) };
  });

  // The saved groups of the institution (Admin and HNT).
  const listNoticeGroups = onCall({ invoker: "public" }, async (request) => {
    const profile = await requireSender(getAdminApp, request);
    if (!FULL_SENDERS.includes(profile.role)) return { groups: [] };
    const db = identityDb(getAdminApp);
    const snapshot = await db.collection("noticeGroups").where("institutionId", "==", profile.institutionId).get();
    const names = new Map((await institutionPeople(db, profile.institutionId)).map(person => [person.uid, person]));
    const groups = snapshot.docs.map((doc) => {
      const data = doc.data();
      const members = (data.uids || [])
        .filter(uid => names.has(uid))
        .map(uid => ({ uid, name: text(names.get(uid).name, 80) || "Sin nombre", courseId: names.get(uid).courseId || null }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
      return { id: doc.id, name: data.name, members, updatedAt: data.updatedAt || 0 };
    }).sort((a, b) => a.name.localeCompare(b.name, "es"));
    return { groups };
  });

  // { id?, name, uids } → { id }. Only students of the institution stay in.
  const saveNoticeGroup = onCall({ invoker: "public" }, async (request) => {
    const profile = await requireSender(getAdminApp, request);
    if (!FULL_SENDERS.includes(profile.role)) throw new HttpsError("permission-denied", "Los grupos los arma la administración.");
    const db = identityDb(getAdminApp);
    const name = text(request.data?.name, 40);
    if (!name) throw new HttpsError("invalid-argument", "Ponle un nombre al grupo.");
    const students = new Set((await institutionPeople(db, profile.institutionId)).filter(person => !STAFF.includes(person.role)).map(person => person.uid));
    const uids = ids(request.data?.uids, MAX_PICKED).filter(uid => students.has(uid));
    if (!uids.length) throw new HttpsError("invalid-argument", "Elige al menos un estudiante.");
    const id = text(request.data?.id, 40);
    if (id) {
      const ref = db.collection("noticeGroups").doc(id);
      const current = await ref.get();
      if (!current.exists || current.data().institutionId !== profile.institutionId) throw new HttpsError("not-found", "Ese grupo ya no existe.");
      await ref.update({ name, uids, updatedAt: Date.now() });
      return { id };
    }
    const count = (await db.collection("noticeGroups").where("institutionId", "==", profile.institutionId).count().get()).data().count;
    if (count >= MAX_GROUPS) throw new HttpsError("resource-exhausted", `Puedes guardar hasta ${MAX_GROUPS} grupos. Borra uno que ya no uses.`);
    const ref = db.collection("noticeGroups").doc();
    await ref.set({ institutionId: profile.institutionId, name, uids, createdBy: profile.uid, updatedAt: Date.now(), createdAt: FieldValue.serverTimestamp() });
    return { id: ref.id };
  });

  const deleteNoticeGroup = onCall({ invoker: "public" }, async (request) => {
    const profile = await requireSender(getAdminApp, request);
    if (!FULL_SENDERS.includes(profile.role)) throw new HttpsError("permission-denied", "Los grupos los arma la administración.");
    const ref = identityDb(getAdminApp).collection("noticeGroups").doc(text(request.data?.id, 40) || "-");
    const current = await ref.get();
    if (current.exists && current.data().institutionId === profile.institutionId) await ref.delete();
    return { ok: true };
  });

  return { sendNotice, listNotices, listNoticeGroups, saveNoticeGroup, deleteNoticeGroup };
}

module.exports = { build };
