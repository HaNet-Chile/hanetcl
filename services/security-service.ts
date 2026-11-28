import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import type { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { APP_VERSION_LABEL } from '@/constants/app-version';
import { t } from '@/i18n';
import { cached } from './cache';
import { functions } from './firebase';
import { isInstalled } from './web-install';

// The account's security alerts (functions/security.js). Firebase Auth does
// not say when someone signs in, so the app does: right after a sign-in it
// reports this device, and the backend warns the account's other devices
// when the device is new to it. Every few hours the app reports it again,
// which keeps the list in Configuraciones → Seguridad current and lets the
// backend notice a password or email that changed.
//
// The device's id is random and lives only in this app (AsyncStorage), never
// the phone's own id; nothing here says where the device is.

export type DeviceKind = 'phone' | 'tablet' | 'computer';

export type DeviceInfo = { kind: DeviceKind; name: string; system: string | null; app: string | null };

export type SecurityDevice = DeviceInfo & {
  id: string;
  firstAt: number | null;
  lastAt: number | null;
  lastSignInAt: number | null;
  /** Whether it gets this account's push notifications. */
  push: boolean;
};

export type SecurityEvent = { id: string; kind: 'signIn' | 'account' | 'role'; title: string; body: string; at: number };

export type SecurityState = { devices: SecurityDevice[]; events: SecurityEvent[] };

const DEVICE_ID_KEY = 'hanet.deviceId';
const SEEN_KEY = 'hanet.deviceSeen';
// How often an open session reports the device again.
const TOUCH_EVERY_MS = 6 * 60 * 60 * 1000;

let deviceIdPromise: Promise<string> | null = null;

/** This install's random id, made on first use. */
export function getDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const kept = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (kept && /^[A-Za-z0-9_-]{16,64}$/.test(kept)) return kept;
      } catch {
        // A new id below; it only means this device shows up as new.
      }
      const id = Crypto.randomUUID();
      try { await AsyncStorage.setItem(DEVICE_ID_KEY, id); } catch { /* kept for this session */ }
      return id;
    })();
  }
  return deviceIdPromise;
}

function webDevice(): DeviceInfo {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const touchMac = /Macintosh/.test(agent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  const os = /iPad/.test(agent) || touchMac ? 'iPad'
    : /iPhone|iPod/.test(agent) ? 'iPhone' // i18n-ignore
      : /Android/.test(agent) ? 'Android' // i18n-ignore
        : /Windows/.test(agent) ? 'Windows' // i18n-ignore
          : /CrOS/.test(agent) ? 'ChromeOS' // i18n-ignore
            : /Mac OS X|Macintosh/.test(agent) ? 'Mac' // i18n-ignore
              : /Linux/.test(agent) ? 'Linux' : null; // i18n-ignore
  const browser = /Edg(e|A|iOS)?\//.test(agent) ? 'Edge' // i18n-ignore
    : /SamsungBrowser/.test(agent) ? 'Samsung Internet' // i18n-ignore
      : /Firefox|FxiOS/.test(agent) ? 'Firefox' // i18n-ignore
        : /OPR\//.test(agent) ? 'Opera' // i18n-ignore
          : /Chrome|CriOS/.test(agent) ? 'Chrome' // i18n-ignore
            : /Safari/.test(agent) ? 'Safari' : t('services.securityService.navegador'); // i18n-ignore
  const kind: DeviceKind = os === 'iPad' ? 'tablet' : os === 'iPhone' || os === 'Android' ? 'phone' : 'computer';
  return {
    kind,
    name: os ? t('services.securityService.browserEnOs', { browser, os }) : browser,
    system: null,
    app: isInstalled() ? t('services.securityService.hanetWebInstalada') : t('services.securityService.hanetWeb'),
  };
}

/** What this device is, in words its owner recognizes. */
export function describeThisDevice(): DeviceInfo {
  if (Platform.OS === 'web') return webDevice();
  const app = Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? 'Expo Go' : `HaNet ${APP_VERSION_LABEL}`;
  if (Platform.OS === 'ios') {
    const pad = Platform.isPad;
    return { kind: pad ? 'tablet' : 'phone', name: pad ? 'iPad' : 'iPhone', system: `iOS ${Platform.Version}`, app };
  }
  const constants = Platform.constants as { Brand?: string; Model?: string; Release?: string };
  const model = (constants.Model ?? '').trim();
  const brand = (constants.Brand ?? '').trim();
  const name = !model ? 'Android' : brand && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model;
  return { kind: 'phone', name, system: constants.Release ? `Android ${constants.Release}` : 'Android', app };
}

// While a sign-in is under way the regular report waits: if it reached the
// backend first, this device would not look new and nobody would be warned.
let signingIn = false;

async function report(signIn: boolean) {
  const deviceId = await getDeviceId();
  await httpsCallable(functions, 'reportDevice')({ deviceId, signIn, device: describeThisDevice() });
}

async function markSeen(uid: string) {
  try { await AsyncStorage.setItem(SEEN_KEY, JSON.stringify({ uid, at: Date.now() })); } catch { /* reports again next time */ }
}

/**
 * Runs a sign-in and then reports it. The report never holds up or undoes
 * the sign-in: without connection the next regular report fills the list in.
 */
export async function withSignInReport<T>(signIn: () => Promise<T>): Promise<T> {
  signingIn = true;
  try {
    const result = await signIn();
    const uid = (result as { user?: User } | undefined)?.user?.uid;
    if (uid) await markSeen(uid);
    void report(true).catch(error => console.warn('reportDevice', error instanceof Error ? error.message : error));
    return result;
  } finally {
    signingIn = false;
  }
}

/**
 * After the account itself changes how it signs in (Google added or removed):
 * reports this device now, so the account's other devices hear about it.
 */
export async function reportAccountChange() {
  try {
    await report(false);
  } catch {
    // The next regular report notices the change.
  }
}

/** On opening the app with a session: reports this device every few hours. */
export async function touchDevice(user: User) {
  if (signingIn) return;
  try {
    const kept = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? 'null') as { uid?: string; at?: number } | null;
    if (kept?.uid === user.uid && typeof kept.at === 'number' && Date.now() - kept.at < TOUCH_EVERY_MS) return;
    await markSeen(user.uid);
    await report(false);
  } catch {
    // Quietly tried again on the next start.
  }
}

/** Before signing out: this device leaves the account's list. */
export async function forgetThisDevice() {
  try {
    const deviceId = await getDeviceId();
    await Promise.all([
      httpsCallable(functions, 'forgetMyDevice')({ deviceId }),
      AsyncStorage.removeItem(SEEN_KEY),
    ]);
  } catch {
    // Signing out goes ahead; a device not seen for 90 days leaves the list anyway.
  }
}

export function getMySecurity() {
  return cached('security', async () => (await httpsCallable<void, SecurityState>(functions, 'getMySecurity')()).data);
}

/** Cuts every session of the account, this one too. Whoever calls signs out after. */
export async function signOutEverywhere() {
  await httpsCallable(functions, 'signOutEverywhere')();
}
