import { ThemedText } from '@/components/themed-text';
import { NotificationRow } from '@/components/notifications/notification-row';
import { DeviceRow } from '@/components/settings/device-row';
import { SettingsGroup, SettingsLinkRow, SettingsNote } from '@/components/settings/settings-list';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { HanetButton } from '@/components/ui/hanet-button';
import { HanetDialog, HanetDialogActions, dialogStyles } from '@/components/ui/hanet-dialog';
import { MessageCard } from '@/components/ui/message-card';
import { PageHeader } from '@/components/ui/page-header';
import { useWide, widePageStyle } from '@/components/ui/wide-page';
import { AppColors, AppSpacing, AppType } from '@/constants/design-tokens';
import { useDocumentScroll } from '@/hooks/use-document-scroll';
import { t } from '@/i18n';
import { describeAuthError, resetPassword, useSession } from '@/services/auth-service';
import { useCached } from '@/services/cache';
import { getDeviceId, getMySecurity, signOutEverywhere } from '@/services/security-service';
import type { SecurityState } from '@/services/security-service';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Configuraciones → Seguridad: where the account is open, what happened to it
// lately (functions/security.js) and what to do when something looks wrong.
// The alerts land here and in the notifications section; tapping one opens this.

export default function SecurityScreen() {
  const pageScroll = useDocumentScroll();
  const insets = useSafeAreaInsets();
  const wide = useWide();
  const { user, signOut } = useSession();

  const kept = useCached<SecurityState>(user ? 'security' : null);
  const [loaded, setLoaded] = useState<SecurityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [resetState, setResetState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const load = useCallback(() => getMySecurity().then(
    value => { setLoaded(value); setError(null); setNow(Date.now()); },
    cause => setError(describeAuthError(cause, t('security.noPudimosCargarTuSeguridad'))),
  ), []);

  useEffect(() => {
    void getDeviceId().then(setThisDevice);
    void load();
  }, [load]);

  const state = loaded ?? kept ?? null;
  // The device in hand goes first.
  const devices = state
    ? [...state.devices].sort((a, b) => Number(b.id === thisDevice) - Number(a.id === thisDevice))
    : [];

  const sendReset = async () => {
    if (!user?.email || resetState === 'sending') return;
    setResetState('sending');
    try {
      await resetPassword(user.email);
      setResetState('sent');
    } catch {
      setResetState('failed');
    }
  };

  const everywhere = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOutEverywhere();
      setConfirming(false);
      await signOut();
    } catch (cause) {
      setSignOutError(describeAuthError(cause, t('security.noPudimosCerrarLasSesiones')));
      setSigningOut(false);
    }
  };

  const resetNote = resetState === 'sent'
    ? t('security.teMandamosUnCorreoA', { email: user?.email })
    : resetState === 'failed'
      ? t('security.noPudimosMandarElCorreo')
      : t('security.teMandamosUnLinkA');

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView ref={pageScroll} contentContainerStyle={withTopInset([styles.page, widePageStyle(wide, 'reading')], insets.top)} showsVerticalScrollIndicator={false}>
        <PageHeader
          eyebrow={t('common.configuraciones')}
          title={t('security.seguridad')}
          intro={t('security.teAvisamosCuandoAlguienEntra')}
          style={styles.header}
        />

        <View style={styles.sections}>
          {!state && error ? (
            <MessageCard message={error} onRetry={() => void load()} />
          ) : !state ? (
            <MessageCard message={t('common.cargando')} />
          ) : (
            <SettingsGroup
              title={t('security.dondeEstaAbiertaTuCuenta')}
              footer={devices.length
                ? t('security.siNoReconocesAlgunoCierra')
                : t('security.todaviaNoHayDispositivosEn')}
            >
              {devices.length
                ? devices.map(device => <DeviceRow key={device.id} device={device} current={device.id === thisDevice} now={now} />)
                : <DeviceRow device={{ kind: 'phone', name: t('security.esteDispositivo'), system: null, app: null, lastAt: now }} current now={now} />}
            </SettingsGroup>
          )}

          <SettingsGroup
            title={t('security.noReconocesAlgo')}
            footer={(
              <>
                <SettingsNote error={resetState === 'failed'}>{resetNote}</SettingsNote>
                {!!signOutError && <SettingsNote error>{signOutError}</SettingsNote>}
              </>
            )}
          >
            <SettingsLinkRow
              icon="key-outline"
              label={resetState === 'sending' ? t('security.enviandoCorreo') : t('security.cambiarContrasena')}
              onPress={() => void sendReset()}
            />
            <SettingsLinkRow
              icon="log-out-outline"
              label={t('security.cerrarSesionEnTodasPartes')}
              hint={t('security.incluyeEsteDispositivo')}
              onPress={() => setConfirming(true)}
            />
          </SettingsGroup>

          {!!state && (
            <View style={styles.activity}>
              <SettingsGroup title={t('security.actividadReciente')}>
                {state.events.length
                  ? state.events.map(event => (
                    <View key={event.id} style={styles.event}>
                      <NotificationRow item={{ ...event, url: null }} unread={false} now={now} />
                    </View>
                  ))
                  : <ThemedText style={styles.empty}>{t('security.aquiVanAQuedarLos')}</ThemedText>}
              </SettingsGroup>
            </View>
          )}
        </View>
      </ScrollView>

      <HanetDialog
        visible={confirming}
        onRequestClose={() => !signingOut && setConfirming(false)}
        dismissOnBackdrop={!signingOut}
        title={t('security.cerrarSesionEnTodasPartes2')}
        body={t('security.tuCuentaSeCierraEn')}
      >
        <HanetDialogActions>
          <HanetButton label={t('common.cancelar')} variant="surface" disabled={signingOut} onPress={() => setConfirming(false)} style={dialogStyles.action} />
          <HanetButton label={signingOut ? t('security.cerrando') : t('security.cerrarTodo')} variant="accent" disabled={signingOut} onPress={() => void everywhere()} style={dialogStyles.action} />
        </HanetDialogActions>
      </HanetDialog>
    </FrostedScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150 },
  header: { paddingBottom: AppSpacing.xl },
  sections: { gap: AppSpacing.xl },
  activity: { gap: AppSpacing.sm },
  event: { paddingHorizontal: 10 },
  empty: { ...AppType.footnote, color: AppColors.textSecondary, padding: AppSpacing.lg },
});
