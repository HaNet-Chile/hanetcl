import { BlockedScreen, FatalScreen, MovedScreen, OfflineScreen, PausedScreen, ServerScreen } from '@/components/errors/AppErrorScreens';
import { TopNotice } from '@/components/system/top-notice';
import { clearAppError, continueOffline, currentAppError, isAppErrorPreview, isBlockedError, isOfflineMode, leaveOffline, showAppError, useAppError, useOfflineMode } from '@/services/app-error';
import { useRole, useSession } from '@/services/auth-service';
import { checkConnection } from '@/services/connection';
import { endPausedPreview, fetchAppStatus, forgetInstitutionClosure, passesInstitutionClosure, pausedStatus, useKnownAppStatus, useKnownInstitutionClosure } from '@/services/app-status';
import { db } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { router } from 'expo-router';
import { onOldAppHost } from '@/services/web-move';
import { t } from '@/i18n';
import React, { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

// The address doesn't change while the page is open.
const neverChanges = () => () => {};
const notMoved = () => false;

// A resume shortly after the last check does not check again.
const RECHECK_AFTER_MS = 60_000;

// The signed-in account's institution, once it is linked to it: the closed
// screen can be a single liceo's (functions/app-status.js). Before the
// identity link there is none, so whoever is signing up can finish (the
// server lets sign-up and the link through too). Read once per account.
const institutionOf = new Map<string, string>();
async function linkedInstitution(uid: string) {
  if (institutionOf.has(uid)) return institutionOf.get(uid) ?? null;
  try {
    const id = (await getDoc(doc(db, 'users', uid))).data()?.institutionId as string | undefined;
    if (id) institutionOf.set(uid, id);
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Watches for the problems that stop the app and draws their screen over
 * everything, the tab bar included: on launch and each time the app comes
 * back to the front it checks the connection and, with a session, whether the
 * HaNet ID was blocked. After "Ver lo guardado" the app goes on offline with
 * a small notice on top, until a check finds the connection again. It also
 * asks whether the team closed HaNet to the public (services/app-status.ts):
 * then everyone but HNT gets PausedScreen, and HNT a notice on top. The same
 * goes for a closed liceo: its members get PausedScreen with the liceo's name,
 * and whoever still gets in (HNT, its Admin, its teachers if allowed) the
 * notice.
 */
export function AppErrorLayer() {
  const kind = useAppError();
  const offline = useOfflineMode();
  const { user } = useSession();
  const [retrying, setRetrying] = useState(false);
  const lastCheck = useRef(0);
  const role = useRole();
  const appStatus = useKnownAppStatus();
  const closure = useKnownInstitutionClosure();
  // "Soy del equipo" on PausedScreen: the sign-in stays reachable until someone signs in.
  const letTeamIn = useRef(false);
  // The static web page is built as "not moved"; the browser's answer comes right after hydrating.
  const moved = useSyncExternalStore(neverChanges, onOldAppHost, notMoved);

  const check = useCallback(async () => {
    lastCheck.current = Date.now();
    const status = await checkConnection();
    // Already going on offline: the notice stays, no full screen again.
    if (status === 'offline' && isOfflineMode()) return false;
    if (status !== 'ok') {
      showAppError(status);
      return false;
    }
    leaveOffline();
    if (user) {
      try {
        // Asks Firebase Auth for the account; a blocked one is disabled there.
        await user.reload();
      } catch (error) {
        if (isBlockedError(error)) {
          showAppError('blocked');
          return false;
        }
      }
    }
    const institutionId = user ? await linkedInstitution(user.uid) : null;
    const pause = await fetchAppStatus(institutionId);
    const tokenRole = user && pause && (!pause.open || pause.institution?.closed)
      ? String((await user.getIdTokenResult().catch(() => null))?.claims.role ?? '')
      : null;
    if (pause && !pause.open) {
      if (tokenRole !== 'HNT' && !(letTeamIn.current && !user)) {
        showAppError('paused');
        return false;
      }
    } else if (pause?.institution?.closed && !passesInstitutionClosure(tokenRole, pause.institution)) {
      showAppError('paused');
      return false;
    } else if (pause?.open && currentAppError() === 'paused' && !isAppErrorPreview()) {
      clearAppError();
    }
    return true;
  }, [user]);

  useEffect(() => {
    if (user) letTeamIn.current = false;
    else forgetInstitutionClosure();
  }, [user]);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() - lastCheck.current > RECHECK_AFTER_MS) void check();
    });
    // The browser says when the connection comes back.
    const online = () => { if (isOfflineMode()) void check(); };
    if (Platform.OS === 'web') window.addEventListener('online', online);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web') window.removeEventListener('online', online);
    };
  }, [check]);

  const retry = async () => {
    if (isAppErrorPreview()) {
      endPausedPreview();
      clearAppError();
      return;
    }
    setRetrying(true);
    const ok = await check();
    setRetrying(false);
    if (ok) clearAppError();
  };

  if (moved || kind === 'moved') {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.layer}>
        <MovedScreen onDismiss={clearAppError} preview={!moved && isAppErrorPreview()} />
      </Animated.View>
    );
  }

  if (!kind) {
    if (appStatus && !appStatus.open && role === 'HNT') {
      return (
        <TopNotice
          icon="construct-outline"
          text={t('components.errors.appErrorLayer.hanetEstaCerradoAlPublico')}
          action={{ label: t('components.errors.appErrorLayer.abrir'), onPress: () => router.push('/hnt-admin') }}
        />
      );
    }
    // Whoever still gets in while their liceo is closed sees that it is.
    if (closure?.closed && passesInstitutionClosure(role, closure)) {
      return (
        <TopNotice
          icon="construct-outline"
          text={closure.name ? t('components.errors.appErrorLayer.hanetEstaCerradoEnName', { name: closure.name }) : t('components.errors.appErrorLayer.hanetEstaCerradoEnTu')}
          action={role === 'HNT' ? { label: t('components.errors.appErrorLayer.abrir'), onPress: () => router.push('/hnt-admin') } : undefined}
        />
      );
    }
    return offline ? (
      <TopNotice
        icon="cloud-offline-outline"
        text={t('components.errors.appErrorLayer.sinConexionVesLoUltimo')}
        action={{ label: retrying ? t('components.errors.appErrorScreens.probando') : t('common.reintentar'), onPress: () => void retry(), disabled: retrying }}
      />
    ) : null;
  }
  const common = { onDismiss: clearAppError, signedIn: !!user, preview: isAppErrorPreview() };
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.layer}>
      {kind === 'blocked' && <BlockedScreen {...common} />}
      {kind === 'server' && <ServerScreen {...common} onRetry={retry} retrying={retrying} />}
      {kind === 'offline' && <OfflineScreen {...common} onRetry={retry} retrying={retrying} onContinue={continueOffline} />}
      {kind === 'paused' && (
        <PausedScreen
          {...common}
          status={pausedStatus()}
          onRetry={retry}
          retrying={retrying}
          onDismiss={() => {
            if (!common.preview && !user) letTeamIn.current = true;
            endPausedPreview();
            clearAppError();
          }}
        />
      )}
    </Animated.View>
  );
}

type BoundaryState = { failed: boolean };

/** Catches a crash anywhere below it and shows the fatal error screen instead of a blank app. */
export class FatalBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('HaNet se detuvo por un error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.fatal}>
        <FatalScreen onDismiss={() => this.setState({ failed: false })} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 30,
  },
  fatal: {
    flex: 1,
  },
});
