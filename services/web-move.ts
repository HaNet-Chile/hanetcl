import { Platform } from 'react-native';

import { APP_HOST, OLD_APP_HOSTS } from '@/constants/web-hosts';

/** The web app opened on its old address (hanet-app.web.app). */
export function onOldAppHost() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && OLD_APP_HOSTS.includes(window.location.hostname);
}

/**
 * Opens the same page on the new address. Installed on the home screen, the
 * old app can't become the new one (each address is its own app for the
 * browser, with its own session), so the new one opens in the browser, to be
 * added again from there.
 */
export function openNewAppHost(installed: boolean) {
  const { pathname, search, hash } = window.location;
  const target = `https://${APP_HOST}${pathname}${search}${hash}`;
  if (installed) window.open(target, '_blank');
  else window.location.assign(target);
}
