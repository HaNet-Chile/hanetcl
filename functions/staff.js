const { getFirestore } = require("firebase-admin/firestore");
const { HttpsError } = require("./regions");
const { requirePanelSession } = require("./panel-auth");

// Who may manage an institution's people from the web panel.
//
// HNT manages every institution, from the panel or from the app's Panel HNT.
// Admin (the liceo's leadership) and, for a few things, CEE manage only their
// own institution, and only from the panel: these functions ask for its
// second step (panel-auth.js), which the app does not have.

function identityDb(getAdminApp) {
  return getFirestore(getAdminApp(), "hn-enrollmentdata");
}

async function callerProfile(getAdminApp, uid) {
  return (await identityDb(getAdminApp).collection("users").doc(uid).get()).data() || null;
}

// roles: the roles besides HNT allowed here. With institutionId, the caller
// must belong to it; without, the caller's own institution is returned.
async function requireStaff(getAdminApp, request, roles, institutionId = null) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  const role = request.auth.token.role;
  if (role === "HNT") return { auth: request.auth, role, hnt: true, institutionId };
  if (!roles.includes(role)) {
    throw new HttpsError("permission-denied", "Esta acción no está disponible para tu rol.");
  }
  await requirePanelSession(getAdminApp, request);
  const profile = await callerProfile(getAdminApp, request.auth.uid);
  const own = profile?.institutionId || null;
  if (!own || (institutionId && institutionId !== own)) {
    throw new HttpsError("permission-denied", "Solo puedes administrar tu institución.");
  }
  return { auth: request.auth, role, hnt: false, institutionId: own };
}

module.exports = { requireStaff, callerProfile };
