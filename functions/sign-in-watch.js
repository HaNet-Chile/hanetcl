const { getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { beforeUserSignedIn } = require("firebase-functions/v2/identity");

// Identity Platform calls watchSignIn before EVERY sign-in, from the app or
// from anywhere else (the Auth API straight). It only takes a note in
// hn-enrollmentdata signInChecks/{id}: { uid, at, userAgent, provider, newUser }.
// The app claims its own sign-in a moment later (reportDevice in
// security.js), and alertUnclaimedSignIns warns the account about any note
// still there after a few minutes: a sign-in the app never reported.
//
// It must never get in the way of signing in: Auth waits for it (7 s at
// most) and a failure would refuse the sign-in. So it never throws, gives the
// write 3 seconds, and its instance loads only this file (index.js), not the
// rest of the backend. The IP address is not kept.

const WRITE_WAIT_MS = 3000;

function build() {
  const watchSignIn = beforeUserSignedIn({ timeoutSeconds: 5, memory: "256MiB" }, async (event) => {
    try {
      const uid = event.data?.uid;
      if (!uid) return;
      const app = getApps().length ? getApp() : initializeApp();
      const write = getFirestore(app, "hn-enrollmentdata").collection("signInChecks").add({
        uid,
        at: Date.now(),
        userAgent: String(event.userAgent || "").slice(0, 300),
        provider: event.additionalUserInfo?.providerId || event.credential?.providerId || null,
        newUser: event.additionalUserInfo?.isNewUser === true,
      });
      write.catch(error => console.error("watchSignIn write", error.message));
      await Promise.race([write, new Promise(resolve => setTimeout(resolve, WRITE_WAIT_MS))]);
    } catch (error) {
      console.error("watchSignIn", error.message);
    }
  });
  return { watchSignIn };
}

module.exports = { build };
