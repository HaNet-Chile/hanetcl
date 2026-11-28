import { ERROR_ICONS, ErrorScreen, Strong } from '@/components/errors/ErrorScreen';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog } from '@/components/ui/hanet-dialog';
import { AppSpacing } from '@/constants/design-tokens';
import { auth } from '@/services/firebase';
import { unregisterDevice } from '@/services/push-service';
import * as Clipboard from 'expo-clipboard';
import * as Updates from 'expo-updates';
import { signOut } from 'firebase/auth';
import React, { useState } from 'react';
import { DevSettings, Linking, Platform, StyleSheet, View } from 'react-native';
import { dateLocale, t } from '@/i18n';
import { APP_HOST } from '@/constants/web-hosts';
import { isInstalled } from '@/services/web-install';
import { openNewAppHost } from '@/services/web-move';
import type { AppStatus } from '@/services/app-status';

export const SUPPORT_EMAIL = 'muxp@muxp.art';
export const STATUS_PAGE = 'status.hanet.muxp.art';

/** Starts HaNet again from scratch, as far as each platform allows. */
export async function restartApp() {
  if (Platform.OS === 'web') {
    window.location.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    // Development builds and Expo Go reload through the dev tools instead.
    DevSettings.reload();
  }
}

/** Signs out wherever the problem left the app; the root then goes to the onboarding. */
export async function leaveSession() {
  try {
    await unregisterDevice();
    await signOut(auth);
  } catch {
    // A blocked or offline session still ends locally.
  }
}

type Props = { onDismiss: () => void; signedIn: boolean; preview?: boolean };

// In a preview the buttons only close the screen: nobody gets signed out.
function endSession(onDismiss: () => void, preview?: boolean) {
  if (preview) onDismiss();
  else void leaveSession().then(onDismiss);
}

/** Blocked HaNet ID: the appeal goes by email to the HaNet team. */
export function BlockedScreen({ onDismiss, preview }: Props) {
  const [appealing, setAppealing] = useState(false);

  const openMail = () => {
    setAppealing(false);
    const subject = encodeURIComponent(t('components.errors.appErrorScreens.apelacionDeBloqueoEnHanet'));
    const body = encodeURIComponent(t('components.errors.appErrorScreens.holaQuieroApelarElBloqueo'));
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <>
      <ErrorScreen
        icon={ERROR_ICONS.lock}
        title={t('components.errors.appErrorScreens.seBloqueoTuAccesoA')}
        body={<>{t('components.errors.appErrorScreens.tuCuentaFueBloqueadaPor')}{' '}<Strong>{t('components.errors.appErrorScreens.incumplimientoDeLosTerminosY')}</Strong>{' '}{t('components.errors.appErrorScreens.siCreesQueEsUn')}</>}
        note={t('components.errors.appErrorScreens.crearOtraCuentaParaEvitar')}
        primary={{ label: t('components.errors.appErrorScreens.apelar'), onPress: () => setAppealing(true) }}
        secondary={{ label: t('common.cerrarSesion'), onPress: () => endSession(onDismiss, preview) }}
      />
      <HanetDialog
        visible={appealing}
        onRequestClose={() => setAppealing(false)}
        dismissOnBackdrop
        title={t('components.errors.appErrorScreens.seAbriraTuAppDe')}
        body={t('components.errors.appErrorScreens.desdeAhiPodrasEscribirA', { supportEmail: SUPPORT_EMAIL })}
      >
        <View style={styles.dialogActions}>
          <HanetButton label={t('components.errors.appErrorScreens.abrirCorreo')} onPress={openMail} />
          <HanetButton label={t('common.volver')} variant="surface" onPress={() => setAppealing(false)} />
        </View>
      </HanetDialog>
    </>
  );
}

type RetryProps = Props & { onRetry: () => void; retrying: boolean };

export function ServerScreen({ onDismiss, onRetry, retrying, signedIn, preview }: RetryProps) {
  return (
    <ErrorScreen
      icon={ERROR_ICONS.server}
      title={t('components.errors.appErrorScreens.pareceQueLasOficinasSe')}
      body={t('components.errors.appErrorScreens.noTePreocupesNoSe')}
      note={
        <>
          {t('components.errors.appErrorScreens.mantenteAlTantoDeErrores')}{' '}
          <Strong onPress={() => void Linking.openURL(`https://${STATUS_PAGE}`)}>{STATUS_PAGE}</Strong>
        </>
      }
      primary={{ label: retrying ? t('components.errors.appErrorScreens.probando') : t('common.reintentar'), onPress: onRetry, disabled: retrying }}
      secondary={signedIn ? { label: t('common.cerrarSesion'), onPress: () => endSession(onDismiss, preview) } : undefined}
    />
  );
}

/**
 * No internet. With a session, "Ver lo guardado" goes on with what the phone
 * kept from last time (onContinue), and a small notice stays up meanwhile.
 */
export function OfflineScreen({ onRetry, retrying, signedIn, onContinue }: RetryProps & { onContinue: () => void }) {
  return (
    <ErrorScreen
      icon={ERROR_ICONS.offline}
      title={t('components.errors.appErrorScreens.pareceQueNoHayInternet')}
      body={t('components.errors.appErrorScreens.revisaElWifiOLos')}
      primary={{ label: retrying ? t('components.errors.appErrorScreens.probando') : t('common.reintentar'), onPress: onRetry, disabled: retrying }}
      secondary={signedIn ? { label: t('components.errors.appErrorScreens.verLoGuardado'), onPress: onContinue } : undefined}
    />
  );
}

/** Shown by the root error boundary when something in the app breaks. */
export function FatalScreen({ onDismiss, preview }: { onDismiss: () => void; preview?: boolean }) {
  return (
    <ErrorScreen
      icon=":("
      title={t('components.errors.appErrorScreens.upsAlgoFallo')}
      body={<>{t('components.errors.appErrorScreens.hanetTuvoQueDetenerseSi')}{' '}<Strong>{SUPPORT_EMAIL}</Strong>{' '}{t('components.errors.appErrorScreens.yCuentanosQueEstabasHaciendo')}</>}
      primary={{ label: t('components.errors.appErrorScreens.reiniciar'), onPress: () => (preview ? onDismiss() : void restartApp()) }}
      secondary={{ label: t('common.cerrarSesion'), onPress: () => endSession(onDismiss, preview) }}
    />
  );
}

/**
 * The web app moved to app.hanet.muxp.art: on the old address this is all
 * HaNet shows, with no way past it (Figma "[sunsetting beta error]"). The
 * session doesn't travel (each address keeps its own), so it says to sign in
 * again there.
 */
export function MovedScreen({ onDismiss, preview }: { onDismiss: () => void; preview?: boolean }) {
  const installed = Platform.OS === 'web' && isInstalled();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await Clipboard.setStringAsync(`https://${APP_HOST}`);
    setCopied(true);
  };

  return (
    <ErrorScreen
      icon={ERROR_ICONS.sunset}
      tone="sunset"
      title={t('components.errors.appErrorScreens.hanetSeCambioDeCasa')}
      body={<>{t('components.errors.appErrorScreens.ahoraEstamosEn')}{' '}<Strong>{APP_HOST}</Strong>{t('components.errors.appErrorScreens.tuCuentaEsLaMisma')}</>}
      note={t('components.errors.appErrorScreens.siTeniasHanetEnTu')}
      primary={preview
        ? { label: t('common.volver'), onPress: onDismiss }
        : { label: copied ? t('common.copiado') : t('organize.copiarLink'), onPress: () => void copy() }}
      secondary={{ label: t('components.errors.appErrorScreens.irALaNueva'), onPress: () => (preview ? onDismiss() : openNewAppHost(installed)) }}
    />
  );
}

// When HaNet should be back: the time today, or the day and time.
function backAt(until: number) {
  const date = new Date(until);
  const time = date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (date.toDateString() === new Date().toDateString()) return t('components.errors.appErrorScreens.volvemosCercaDeLasTime', { time });
  const day = date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return t('components.errors.appErrorScreens.volvemosCercaDelDayA', { day, time });
}

/**
 * HaNet closed to the public by the team (services/app-status.ts): for
 * maintenance, a problem, or for now. The team's message, if there is one,
 * replaces the explanation. "Reintentar" asks again; signed out, "Soy del
 * equipo" lets the team sign in, and with a session that isn't HNT the
 * screen comes back.
 */
export function PausedScreen({ status, onRetry, retrying, signedIn, onDismiss, preview }: RetryProps & { status: AppStatus | null }) {
  const kind = status?.kind ?? 'maintenance';
  // One liceo closed (services/app-status.ts): its own copy, and the status
  // page doesn't help there, the liceo does.
  if (status && typeof status.institutionName === 'string') {
    return <InstitutionPausedScreen status={status} kind={kind} onRetry={onRetry} retrying={retrying} signedIn={signedIn} onDismiss={onDismiss} preview={preview} />;
  }
  const titles = {
    maintenance: t('components.errors.appErrorScreens.estamosHaciendoMantencion'),
    incident: t('components.errors.appErrorScreens.algoNoAndaBienEn'),
    closed: t('components.errors.appErrorScreens.hanetEstaCerradoPorAhora'),
  };
  const bodies = {
    maintenance: t('components.errors.appErrorScreens.hanetVuelveEnUnRato'),
    incident: t('components.errors.appErrorScreens.yaLoEstamosRevisandoLo'),
    closed: t('components.errors.appErrorScreens.noTePreocupesLoTuyo'),
  };
  return (
    <ErrorScreen
      icon={kind === 'closed' ? ERROR_ICONS.sunset : kind === 'incident' ? ':/' : ERROR_ICONS.server}
      tone={kind === 'closed' ? 'sunset' : 'accent'}
      title={titles[kind]}
      body={status?.message || bodies[kind]}
      note={
        <>
          {status?.until ? <>{backAt(status.until)}{' '}</> : null}
          {t('components.errors.appErrorScreens.mantenteAlTantoDeErrores')}{' '}
          <Strong onPress={() => void Linking.openURL(`https://${STATUS_PAGE}`)}>{STATUS_PAGE}</Strong>
        </>
      }
      primary={{ label: retrying ? t('components.errors.appErrorScreens.probando') : t('common.reintentar'), onPress: onRetry, disabled: retrying }}
      secondary={preview
        ? { label: t('common.volver'), onPress: onDismiss }
        : signedIn
          ? { label: t('common.cerrarSesion'), onPress: () => endSession(onDismiss, preview) }
          : { label: t('components.errors.appErrorScreens.soyDelEquipo'), onPress: onDismiss }}
    />
  );
}

// When the liceo opens again: the time today, or the day and time.
function opensAt(until: number) {
  const date = new Date(until);
  const time = date.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (date.toDateString() === new Date().toDateString()) return t('components.errors.appErrorScreens.abreHoyALasTime', { time });
  const day = date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return t('components.errors.appErrorScreens.abreElDayALas', { day, time });
}

/**
 * HaNet closed for one liceo only, for instance at the start of the year
 * while its rosters and courses get ready. Same card as PausedScreen; the
 * liceo's name in the copy, the real opening time if it set one.
 */
function InstitutionPausedScreen({ status, kind, onRetry, retrying, signedIn, onDismiss, preview }: RetryProps & { status: AppStatus; kind: NonNullable<AppStatus['kind']> }) {
  const name = status.institutionName || '';
  const titles = {
    maintenance: name ? t('components.errors.appErrorScreens.estamosPreparandoHanetEnName', { name }) : t('components.errors.appErrorScreens.estamosPreparandoHanetEnTu'),
    incident: name ? t('components.errors.appErrorScreens.algoNoAndaBienEn2', { name }) : t('components.errors.appErrorScreens.algoNoAndaBienEn3'),
    closed: name ? t('components.errors.appErrorScreens.hanetEstaCerradoEnName', { name }) : t('components.errors.appErrorScreens.hanetEstaCerradoEnTu'),
  };
  const bodies = {
    maintenance: t('components.errors.appErrorScreens.tuLiceoEstaDejandoListos'),
    incident: t('components.errors.appErrorScreens.tuLiceoYaLoEsta'),
    closed: t('components.errors.appErrorScreens.noTePreocupesLoTuyo2'),
  };
  return (
    <ErrorScreen
      icon={kind === 'closed' ? ERROR_ICONS.sunset : kind === 'incident' ? ':/' : ERROR_ICONS.server}
      tone={kind === 'closed' ? 'sunset' : 'accent'}
      title={titles[kind]}
      body={status.message || bodies[kind]}
      note={<>{status.until ? <>{opensAt(status.until)}{' '}</> : null}{t('components.errors.appErrorScreens.siTienesDudasPreguntaEn')}</>}
      primary={{ label: retrying ? t('components.errors.appErrorScreens.probando') : t('common.reintentar'), onPress: onRetry, disabled: retrying }}
      secondary={preview
        ? { label: t('common.volver'), onPress: onDismiss }
        : signedIn
          ? { label: t('common.cerrarSesion'), onPress: () => endSession(onDismiss, preview) }
          : undefined}
    />
  );
}

/**
 * A link that leads nowhere in HaNet (an old notification, a mistyped
 * address). The path stays in small print, so a screenshot says what broke.
 */
export function NotFoundScreen({ path, onHome, onBack }: { path?: string; onHome: () => void; onBack?: () => void }) {
  return (
    <ErrorScreen
      icon=":/"
      title={t('components.errors.appErrorScreens.estaPantallaNoExiste')}
      body={<>{t('components.errors.appErrorScreens.elLinkQueAbristeNo')}</>}
      note={path ? <>{t('components.errors.appErrorScreens.siTeSiguePasandoCuentanos')}{' '}<Strong>{SUPPORT_EMAIL}</Strong>{' '}{t('components.errors.appErrorScreens.yMencionaEstaRuta')}{' '}<Strong>{path}</Strong></> : undefined}
      primary={{ label: t('components.errors.appErrorScreens.irAlInicio'), onPress: onHome }}
      secondary={onBack ? { label: t('common.volver'), onPress: onBack } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  dialogActions: {
    gap: AppSpacing.sm,
  },
});
