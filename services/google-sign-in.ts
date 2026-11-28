import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  unlink,
  type OAuthCredential,
  type User,
} from 'firebase/auth';
import { Platform } from 'react-native';
import { auth } from './firebase';
import { reportAccountChange, withSignInReport } from './security-service';

// Signing in with Google, and adding or removing it as a way into a HaNet ID.
//
// The web uses Firebase's own popup. The phone opens the bridge page on the
// authDomain (hosting/google.html) in the system's secure browser sheet: it
// signs in with Google there and comes back with the Google credential, which
// the app uses here with Firebase. This works the same in Expo Go, an IPA and
// an APK, without Google's native SDK. The credential comes back encrypted
// with a one-time key that only travels in the page's fragment, so another
// app that registered the same link scheme cannot use it.

const BRIDGE_URL = 'https://id.hanet.muxp.art/google';
const GOOGLE = 'google.com';

/** Thrown when the person closes the sheet or the popup: nothing to say. */
export class GoogleCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'GoogleCancelled';
  }
}

type BridgeCredential = { credential: OAuthCredential; email: string | null };

function base64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

/** SHA-256 of key + block number, block after block (as the bridge page does). */
async function keystream(key: Uint8Array, length: number) {
  const out = new Uint8Array(length);
  for (let offset = 0, block = 0; offset < length; offset += 32, block++) {
    const input = new Uint8Array(key.length + 4);
    input.set(key);
    new DataView(input.buffer).setUint32(key.length, block);
    const hash = new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input));
    out.set(hash.subarray(0, Math.min(32, length - offset)), offset);
  }
  return out;
}

function fragmentParams(url: string) {
  const params: Record<string, string> = {};
  const fragment = url.split('#')[1] ?? '';
  for (const part of fragment.split('&')) {
    const [name, value = ''] = part.split('=');
    if (name) params[name] = decodeURIComponent(value);
  }
  return params;
}

function authError(code: string) {
  return Object.assign(new Error(code), { code: `auth/${code}` });
}

async function googleFromBridge(mode: 'signin' | 'link'): Promise<BridgeCredential> {
  const key = Crypto.getRandomBytes(32);
  const returnUrl = Linking.createURL('google-auth');
  const url = `${BRIDGE_URL}#k=${base64Url(key)}&m=${mode}&r=${encodeURIComponent(returnUrl)}`;
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
  if (result.type !== 'success') throw new GoogleCancelled();

  const params = fragmentParams(result.url);
  if (params.e) {
    if (params.e === 'cancelled' || params.e === 'popup-closed-by-user' || params.e === 'user-cancelled') throw new GoogleCancelled();
    throw authError(params.e);
  }
  if (!params.c) throw authError('internal-error');

  const sealed = fromBase64Url(params.c);
  const stream = await keystream(key, sealed.length);
  let json = '';
  sealed.forEach((byte, index) => { json += String.fromCharCode(byte ^ stream[index]); });
  const payload = JSON.parse(json) as { idToken?: string | null; accessToken?: string | null; email?: string | null; exists?: boolean };
  if (!payload.idToken && !payload.accessToken) throw authError('internal-error');
  return {
    credential: GoogleAuthProvider.credential(payload.idToken ?? null, payload.accessToken ?? null),
    email: payload.email ?? null,
  };
}

function webProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function isCancel(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled';
}

function codeOf(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
}

// A Google account whose address already has a HaNet ID with a password: the
// person signs in with the password once and Google is added right after.
let pending: BridgeCredential | null = null;

export type GoogleSignIn = { status: 'signed-in' } | { status: 'needs-password'; email: string | null };

/** Signs in (or creates the account) with Google. */
export async function continueWithGoogle(): Promise<GoogleSignIn> {
  pending = null;
  if (Platform.OS === 'web') {
    try {
      await withSignInReport(() => signInWithPopup(auth, webProvider()));
      return { status: 'signed-in' };
    } catch (error) {
      if (isCancel(error)) throw new GoogleCancelled();
      if (codeOf(error) === 'auth/account-exists-with-different-credential') {
        const credential = GoogleAuthProvider.credentialFromError(error as never);
        const email = (error as { customData?: { email?: string } }).customData?.email ?? null;
        if (credential) pending = { credential, email };
        return { status: 'needs-password', email };
      }
      throw error;
    }
  }

  const google = await googleFromBridge('signin');
  try {
    await withSignInReport(() => signInWithCredential(auth, google.credential));
    return { status: 'signed-in' };
  } catch (error) {
    if (codeOf(error) === 'auth/account-exists-with-different-credential') {
      pending = google;
      return { status: 'needs-password', email: google.email };
    }
    throw error;
  }
}

/** The address of a Google account waiting to be added after the password, if any. */
export function pendingGoogleEmail() {
  return pending ? pending.email ?? '' : null;
}

export function forgetPendingGoogle() {
  pending = null;
}

/**
 * After signing in with the password: adds the Google account that was
 * waiting. True when it was added. A failure leaves the sign-in as it is.
 */
export async function linkPendingGoogle(user: User): Promise<boolean> {
  const waiting = pending;
  pending = null;
  if (!waiting) return false;
  try {
    await linkWithCredential(user, waiting.credential);
    void reportAccountChange();
    return true;
  } catch (error) {
    if (codeOf(error) === 'auth/provider-already-linked') return true;
    console.warn('linkPendingGoogle', codeOf(error));
    return false;
  }
}

/** The Google account the HaNet ID signs in with, or null. */
export function googleAccountOf(user: User | null) {
  const google = user?.providerData.find(item => item.providerId === GOOGLE);
  return google ? { email: google.email ?? user?.email ?? null } : null;
}

/** Whether the HaNet ID also has a password. */
export function hasPassword(user: User | null) {
  return !!user?.providerData.some(item => item.providerId === 'password');
}

/** Adds Google as a way into the account in use. */
export async function linkGoogle(user: User) {
  try {
    if (Platform.OS === 'web') {
      await linkWithPopup(user, webProvider());
    } else {
      const google = await googleFromBridge('link');
      await linkWithCredential(user, google.credential);
    }
  } catch (error) {
    if (isCancel(error)) throw new GoogleCancelled();
    // The bridge page's own Google sign-in may already have added it.
    if (codeOf(error) !== 'auth/provider-already-linked') throw error;
  }
  await user.reload();
  void reportAccountChange();
}

/** Removes Google. Only when the account still has its password. */
export async function unlinkGoogle(user: User) {
  if (!hasPassword(user)) throw authError('requires-password');
  await unlink(user, GOOGLE);
  await user.reload();
  void reportAccountChange();
}
