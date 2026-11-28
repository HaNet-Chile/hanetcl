// Where HaNet's functions run (muxp 2026-11-21): in Santiago, next to the
// Firestore databases (southamerica-west1), so each read stays in the same
// region instead of crossing from Iowa. The move was a straight cut: the
// Iowa copies were deleted and testers updated the app.
//
// icalFeed is the exception and stays in Iowa too: calendars that subscribed
// before the move have the Iowa address (see index.js).
//
// Scheduled functions run in São Paulo: Cloud Scheduler has no location in
// Santiago (https://docs.cloud.google.com/scheduler/docs/locations), and São
// Paulo is the closest region that has it.

const https = require("firebase-functions/v2/https");
const { assertAppOpen } = require("./app-status");

const SANTIAGO = "southamerica-west1";
const IOWA = "us-central1";
const SAO_PAULO = "southamerica-east1";
const HTTPS_REGIONS = [SANTIAGO];
const SCHEDULE_REGION = SAO_PAULO;

// onCall and onRequest with HTTPS_REGIONS unless the function names its own.
function inRegions(trigger) {
  return (optionsOrHandler, handler) =>
    typeof optionsOrHandler === "function"
      ? trigger({ region: HTTPS_REGIONS }, optionsOrHandler)
      : trigger({ region: HTTPS_REGIONS, ...optionsOrHandler }, handler);
}

// Every callable first checks that HaNet is open (app-status.js): while it
// is closed only HNT gets through, and while a liceo is closed its members
// don't (but its Admin does). `institutionGate: false` lets a callable
// through a liceo's closure: signing up, the identity link and the account's
// own security, so whoever will prepare the liceo can still get there.
function gated(handler, institution) {
  return async (request, response) => {
    await assertAppOpen(request, { institution });
    return handler(request, response);
  };
}

const callable = inRegions(https.onCall);

function onCall(optionsOrHandler, handler) {
  if (typeof optionsOrHandler === "function") return callable(gated(optionsOrHandler, true));
  const { institutionGate = true, ...options } = optionsOrHandler;
  return callable(options, gated(handler, institutionGate));
}

module.exports = {
  SANTIAGO,
  IOWA,
  SAO_PAULO,
  HTTPS_REGIONS,
  SCHEDULE_REGION,
  HttpsError: https.HttpsError,
  onCall,
  onRequest: inRegions(https.onRequest),
};
