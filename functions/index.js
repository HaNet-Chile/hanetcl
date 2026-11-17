// The backend's entry point. Identity Platform waits for watchSignIn before
// every sign-in, so its instance loads only sign-in-watch.js: the rest of
// the backend takes seconds to load and a slow answer refuses the sign-in.
// Everywhere else (and when deploying, to find every function) it is all of
// backend.js, which exports watchSignIn too.
module.exports = process.env.FUNCTION_TARGET === "watchSignIn"
  ? require("./sign-in-watch").build()
  : require("./backend");
