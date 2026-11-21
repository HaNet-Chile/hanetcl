// Where HaNet's functions run (muxp 2026-11-21): in Santiago, next to the
// Firestore databases (southamerica-west1), so each read stays in the same
// region instead of crossing from Iowa.
//
// Callable and HTTP functions are published in both regions for now: the app
// calls Santiago, while native builds, older Expo Go updates and web pages
// cached before the move still call Iowa. Once those are gone, leave only
// Santiago in HTTPS_REGIONS and the next deploy (it runs with --force)
// deletes the Iowa copies. icalFeed keeps both for good: calendars that
// subscribed already have the Iowa address.
//
// Scheduled functions stay in Iowa: Cloud Scheduler has no location in
// Santiago (https://docs.cloud.google.com/scheduler/docs/locations), and
// nobody is waiting on them.

const https = require("firebase-functions/v2/https");

const SANTIAGO = "southamerica-west1";
const IOWA = "us-central1";
const HTTPS_REGIONS = [SANTIAGO, IOWA];
const SCHEDULE_REGION = IOWA;

// onCall and onRequest with HTTPS_REGIONS unless the function names its own.
function inRegions(trigger) {
  return (optionsOrHandler, handler) =>
    typeof optionsOrHandler === "function"
      ? trigger({ region: HTTPS_REGIONS }, optionsOrHandler)
      : trigger({ region: HTTPS_REGIONS, ...optionsOrHandler }, handler);
}

module.exports = {
  SANTIAGO,
  IOWA,
  HTTPS_REGIONS,
  SCHEDULE_REGION,
  HttpsError: https.HttpsError,
  onCall: inRegions(https.onCall),
  onRequest: inRegions(https.onRequest),
};
