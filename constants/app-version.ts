import Constants from 'expo-constants';

// app.json keeps the native-valid number (`version`) and the stage apart
// (`extra.releaseStage`); see scripts/version.js.
export const APP_VERSION: string = Constants.expoConfig?.version ?? '0.0.0';
export const APP_RELEASE_STAGE: string = Constants.expoConfig?.extra?.releaseStage ?? '';

/** "v0.1.0-beta", or "v1.0.0" once the stage is gone. */
export const APP_VERSION_LABEL = `v${APP_VERSION}${APP_RELEASE_STAGE ? `-${APP_RELEASE_STAGE}` : ''}`;

/** Only the numbers ("0.10.3"), for beside the app's name, which already says the stage. */
export const APP_VERSION_NUMBER = APP_VERSION;
