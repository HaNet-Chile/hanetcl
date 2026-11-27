import { useSecretTaps, VersionEasterEgg } from '@/components/settings/version-easter-egg';
import { AppearanceSetting } from '@/components/settings/appearance-setting';
import { HomeCalendarSetting } from '@/components/settings/home-calendar-setting';
import { MorningTimeRow, morningLabel } from '@/components/settings/morning-time-row';
import { SettingsGroup, SettingsLinkRow, SettingsNote, SettingsToggleRow } from '@/components/settings/settings-list';
import { ThemedText } from '@/components/themed-text';
import { HanetAvatar } from '@/components/ui/hanet-avatar';
import { APP_RELEASE_STAGE, APP_VERSION, APP_VERSION_LABEL } from '@/constants/app-version';
import { AppColors, AppPressed, AppRadii, AppSpacing, AppType } from '@/constants/design-tokens';
import { APP_ICONS, canChangeAppIcon, currentAppIcon, setAppIcon } from '@/services/app-icon';
import type { AppIconId } from '@/services/app-icon';
import { describeAuthError, getMyProfile, useSession } from '@/services/auth-service';
import type { MyProfile } from '@/services/auth-service';
import { useCached } from '@/services/cache';
import { dueRemindersEnabled, examRemindersEnabled, setDueRemindersEnabled, setExamRemindersEnabled } from '@/services/exam-reminders';
import { setWhatsNewPromptEnabled, whatsNewPromptEnabled } from '@/services/whats-new-prompt';
import { gradesLockAvailable, setGradesLock, useGradesLock } from '@/services/grades-lock';
import { getProfilePhotoUrl } from '@/services/profile-service';
import { canOpenNotificationSettings, enablePush, openNotificationSettings, pushPermission, pushSupport, saveAnniversaryNotifications, saveClasshallNotifications, saveFeedNotifications, saveMorningNotifications, saveMorningTime, saveNoticeNotifications, MORNING_DEFAULT } from '@/services/push-service';
import type { PushPermission } from '@/services/push-service';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FrostedScreen, withTopInset } from '@/components/ui/frosted-screen';
import { WideColumns, useWide, widePageStyle } from '@/components/ui/wide-page';
import { t } from '@/i18n';
import { useDocumentScroll } from '@/hooks/use-document-scroll';
import { InstallGuideDialog } from '@/components/web/install-guide';
import { installGuideKind, isInstalled } from '@/services/web-install';

const CONTACT = 'muxp@muxp.art';

export default function SettingsScreen() {
  // On a phone's browser the page scrolls with it, so the browser's bars shrink.
  const pageScroll = useDocumentScroll();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useSession();

  const iconsAvailable = canChangeAppIcon();
  const [icon, setIcon] = useState<AppIconId>(() => currentAppIcon());
  const [savingIcon, setSavingIcon] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);

  // ClassHall notifications: the account's switch and the phone's permission.
  const [classhallOn, setClasshallOn] = useState(true);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const support = pushSupport();
  // The day's summary and its time (saved with the account) and the evaluation reminders (this phone only).
  const [morningOn, setMorningOn] = useState(true);
  const [morningAt, setMorningAt] = useState(MORNING_DEFAULT);
  const [examsOn, setExamsOn] = useState(true);
  const [dueOn, setDueOn] = useState(true);
  // Notas behind the phone's lock: a setting of this phone.
  const gradesLock = useGradesLock();
  const [lockAvailable, setLockAvailable] = useState<boolean | null>(null);
  const [savingLock, setSavingLock] = useState(false);
  const [anniversaryOn, setAnniversaryOn] = useState(true);
  const [feedOn, setFeedOn] = useState(true);
  const [noticesOn, setNoticesOn] = useState(true);
  // The summary of a new version on the first Home after updating (this phone only).
  const [whatsNewOn, setWhatsNewOn] = useState(true);
  // The account card: what the phone kept shows until this visit's load answers.
  const keptProfile = useCached<MyProfile>(user ? 'profile' : null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    void examRemindersEnabled().then(setExamsOn);
    void dueRemindersEnabled().then(setDueOn);
    void whatsNewPromptEnabled().then(setWhatsNewOn);
    void gradesLockAvailable().then(setLockAvailable);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    // The photo is optional: failing to load it leaves the blobatar.
    getProfilePhotoUrl(user.uid).then(url => { if (active) setPhotoUrl(url); }).catch(() => undefined);
    (async () => {
      try {
        const loaded = await getMyProfile();
        if (!active) return;
        setProfile(loaded);
        setClasshallOn(loaded.classhallNotifications !== false);
        setMorningOn(loaded.morningNotifications !== false);
        setMorningAt(loaded.morningAt || MORNING_DEFAULT);
        setAnniversaryOn(loaded.anniversaryNotifications !== false);
        setFeedOn(loaded.feedNotifications !== false);
        setNoticesOn(loaded.noticeNotifications !== false);
        setPermission(await pushPermission());
      } catch (error) {
        if (active) setNotificationsError(describeAuthError(error, t('settings.noPudimosCargarTusAjustes')));
      } finally {
        if (active) setLoadingNotifications(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const chooseIcon = async (next: AppIconId) => {
    if (!iconsAvailable || savingIcon || next === icon) return;
    const previous = icon;
    setIcon(next);
    setIconError(null);
    setSavingIcon(true);
    void Haptics.selectionAsync();
    try {
      await setAppIcon(next);
    } catch {
      setIcon(previous);
      setIconError(t('settings.noPudimosCambiarElIcono'));
    } finally {
      setSavingIcon(false);
    }
  };

  // Every account switch saves the same way: flip at once, undo if the save fails.
  // Turning one on asks the phone too, if it has not been asked yet.
  const saveSwitch = async (on: boolean, current: boolean, set: (on: boolean) => void, save: (on: boolean) => Promise<unknown>) => {
    if (on === current) return;
    setNotificationsError(null);
    set(on);
    try {
      await save(on);
      if (on && permission === 'undetermined') setPermission(await enablePush());
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    } catch (error) {
      set(!on);
      setNotificationsError(describeAuthError(error, t('settings.noPudimosGuardarElCambio')));
    }
  };

  const chooseMorningTime = async (time: string) => {
    setNotificationsError(null);
    try {
      await saveMorningTime(time);
      setMorningAt(time);
      if (Platform.OS !== 'web') void Haptics.selectionAsync();
    } catch (error) {
      setNotificationsError(describeAuthError(error, t('settings.noPudimosGuardarElCambio')));
      throw error;
    }
  };

  const chooseGradesLock = async (on: boolean) => {
    if (savingLock || on === gradesLock.enabled) return;
    setSavingLock(true);
    await setGradesLock(on, on ? t('settings.confirmaParaProtegerTusNotas') : t('settings.confirmaParaQuitarLaProteccion'));
    setSavingLock(false);
  };

  const chooseWhatsNew = async (on: boolean) => {
    if (on === whatsNewOn) return;
    setWhatsNewOn(on);
    await setWhatsNewPromptEnabled(on);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const chooseExams = async (on: boolean) => {
    if (on === examsOn) return;
    setExamsOn(on);
    if (on && permission === 'undetermined') setPermission(await enablePush());
    await setExamRemindersEnabled(on);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const chooseDue = async (on: boolean) => {
    if (on === dueOn) return;
    setDueOn(on);
    if (on && permission === 'undetermined') setPermission(await enablePush());
    await setDueRemindersEnabled(on);
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  // Web only: how to add HaNet to the home screen, for whoever closed the Home's guide.
  const [installGuideAvailable] = useState(() => Platform.OS === 'web' && !isInstalled() && installGuideKind() !== 'unsupported');
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [eggOpen, setEggOpen] = useState(false);
  const tapVersion = useSecretTaps(useCallback(() => setEggOpen(true), []));

  // Any account notification on while the phone blocks or never asked: say so above the group.
  const anyPushOn = classhallOn || morningOn || anniversaryOn || feedOn || noticesOn || examsOn || dueOn;
  const name = profile?.fullName || keptProfile?.fullName || user?.email || 'HaNet ID';
  const avatarSeed = profile?.avatarSeed ?? keptProfile?.avatarSeed ?? null;

  const onWeb = Platform.OS === 'web';
  // Beside the side navigation (wide web window): the account, HaNet and the
  // session on the left, the settings beside them.
  const wide = useWide();
  const notificationsFooter = support === 'web'
    ? t('settings.esteNavegadorNoRecibeNotificaciones')
    : support === 'web-install'
      ? t('settings.paraRecibirNotificacionesEnEl')
    : support === 'expo-go-android'
      ? t('settings.enAndroidLasNotificacionesNecesitan')
      : t('settings.elFeedIgualQuedaEn');

  // At the end of the page on the phone, under the account on a wide window.
  const aboutAndSession = (
    <>
      <SettingsGroup title={t('settings.acercaDeHanet')}>
        <SettingsLinkRow icon="sparkles-outline" label={t('settings.novedades')} detail={APP_VERSION_LABEL} onPress={() => router.push('/whats-new')} />
        <SettingsToggleRow
          icon="megaphone-outline"
          label={t('settings.resumenAlActualizar')}
          detail={t('settings.loMasImportanteDeCada')}
          value={whatsNewOn}
          onChange={on => void chooseWhatsNew(on)}
        />
        <SettingsLinkRow icon="mail-outline" label={t('settings.contacto')} hint={CONTACT} onPress={() => void Linking.openURL(`mailto:${CONTACT}`)} />
        <SettingsLinkRow icon="document-text-outline" label={t('licenses.licenciasDeCodigoAbierto')} onPress={() => router.push('/licenses')} />
      </SettingsGroup>

      <View style={styles.block}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cerrarSesion')}
          accessibilityHint={user?.email ? t('settings.sesionIniciadaComoEmail', { email: user.email }) : undefined}
          onPress={() => void signOut()}
          style={({ pressed }) => [styles.signOut, pressed && AppPressed]}
        >
          <ThemedText style={styles.signOutText}>{t('common.cerrarSesion')}</ThemedText>
        </Pressable>
        {/* Looks like plain text; seven quick taps open the secret. */}
        <Pressable accessibilityLabel={`${t('settings.version')} ${APP_VERSION_LABEL}`} onPress={tapVersion} style={styles.versionTap}>
          <ThemedText style={styles.version}>HaNet {APP_VERSION_LABEL}</ThemedText>
        </Pressable>
      </View>
    </>
  );

  return (
    <FrostedScreen style={styles.screen}>
      <ScrollView ref={pageScroll} contentContainerStyle={withTopInset([styles.page, widePageStyle(wide)], insets.top)} showsVerticalScrollIndicator={false}>
        <ThemedText accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>{t('common.configuraciones')}</ThemedText>

        <WideColumns
          asideLeft
          asideFirstOnPhone
          asideWidth={360}
          stickyAside
          aside={(
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={user?.email ? `${name}, ${user.email}` : name}
                accessibilityHint={t('editProfile.editarPerfil')}
                onPress={() => router.push('/edit-profile')}
                style={({ pressed }) => [styles.account, pressed && AppPressed]}
              >
                <HanetAvatar seed={avatarSeed} photoUrl={photoUrl} fallback={initialsOf(name)} width={56} radius={16} />
                <View style={styles.accountCopy}>
                  <ThemedText numberOfLines={1} style={styles.accountName}>{name}</ThemedText>
                  {!!user?.email && <ThemedText numberOfLines={1} style={styles.accountDetail}>{user.email}</ThemedText>}
                  <ThemedText style={styles.accountAction}>{t('editProfile.editarPerfil')}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={18} color={AppColors.textSecondary} />
              </Pressable>
              {wide && aboutAndSession}
            </>
          )}
          main={(
            <>
              <View style={styles.block}>
                {support === 'supported' && anyPushOn && (permission === 'denied' || permission === 'undetermined') && (
                  <View style={styles.banner}>
                    <Ionicons name="notifications-off-outline" size={18} color={AppColors.errorText} />
                    <ThemedText style={styles.bannerText}>
                      {permission === 'denied'
                        ? (onWeb ? t('settings.lasNotificacionesEstanBloqueadasEn') : t('settings.estanBloqueadasEnEsteTelefono'))
                        : (onWeb ? t('settings.esteNavegadorTodaviaNoHa') : t('settings.esteTelefonoTodaviaNoLas'))}
                    </ThemedText>
                    {(permission !== 'denied' || canOpenNotificationSettings) && (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={permission === 'denied' ? openNotificationSettings : () => void enablePush().then(setPermission)}
                        style={({ pressed }) => pressed && styles.pressedText}
                      >
                        <ThemedText style={styles.bannerAction}>
                          {permission === 'denied' ? t('common.abrirAjustes') : t('settings.permitir')}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}
                <SettingsGroup
                  title={t('settings.notificaciones')}
                  footer={(
                    <>
                      {!!notificationsError && <SettingsNote error>{notificationsError}</SettingsNote>}
                      <SettingsNote>{notificationsFooter}</SettingsNote>
                      {/* MET Norway's data is CC BY 4.0: the credit goes where the weather is chosen. */}
                      {morningOn && <SettingsNote>{t('settings.elClimaDelResumenEs')}</SettingsNote>}
                    </>
                  )}
                >
                  <SettingsToggleRow
                    icon="school-outline"
                    label="ClassHall"
                    detail={t('settings.anunciosTareasYRevisiones')}
                    value={classhallOn}
                    onChange={on => void saveSwitch(on, classhallOn, setClasshallOn, saveClasshallNotifications)}
                    disabled={loadingNotifications}
                  />
                  <SettingsToggleRow
                    icon="sunny-outline"
                    label={t('settings.resumenDelDia')}
                    detail={t('settings.aLasMorninglabelElClima', { morningLabel: morningLabel(morningAt) })}
                    value={morningOn}
                    onChange={on => void saveSwitch(on, morningOn, setMorningOn, saveMorningNotifications)}
                    disabled={loadingNotifications}
                  />
                  {morningOn && !loadingNotifications && (
                    <MorningTimeRow value={morningAt} onSave={chooseMorningTime} />
                  )}
                  <SettingsToggleRow
                    icon="hourglass-outline"
                    label={t('settings.avisosDePruebas')}
                    detail={onWeb ? t('settings.soloEnLaAppDelTelefono') : t('settings.n24Y4HorasAntesSolo')}
                    value={examsOn}
                    onChange={on => void chooseExams(on)}
                    disabled={onWeb}
                  />
                  <SettingsToggleRow
                    icon="checkbox-outline"
                    label={t('settings.avisosDeEntregas')}
                    detail={onWeb ? t('settings.soloEnLaAppDelTelefono') : t('settings.elDiaAntesY3')}
                    value={dueOn}
                    onChange={on => void chooseDue(on)}
                    disabled={onWeb}
                  />
                  <SettingsToggleRow
                    icon="flag-outline"
                    label={t('common.aniversario')}
                    detail={t('settings.pruebasFlashYPlazosDe')}
                    value={anniversaryOn}
                    onChange={on => void saveSwitch(on, anniversaryOn, setAnniversaryOn, saveAnniversaryNotifications)}
                    disabled={loadingNotifications}
                  />
                  <SettingsToggleRow
                    icon="newspaper-outline"
                    label={t('layout.feed')}
                    detail={t('settings.publicacionesEnviadasComoNotificacion')}
                    value={feedOn}
                    onChange={on => void saveSwitch(on, feedOn, setFeedOn, saveFeedNotifications)}
                    disabled={loadingNotifications}
                  />
                  <SettingsToggleRow
                    icon="notifications-outline"
                    label={t('settings.avisosDeTuLiceo')}
                    detail={t('settings.loQueEnvianLaAdministracion')}
                    value={noticesOn}
                    onChange={on => void saveSwitch(on, noticesOn, setNoticesOn, saveNoticeNotifications)}
                    disabled={loadingNotifications}
                  />
                </SettingsGroup>
              </View>

              <HomeCalendarSetting />

              <SettingsGroup title={t('settings.cuenta')}>
                <SettingsLinkRow icon="shield-checkmark-outline" label={t('security.seguridad')} detail={t('settings.dispositivosYAlertas')} onPress={() => router.push('/security')} />
              </SettingsGroup>

              <SettingsGroup
                title={t('settings.privacidad')}
                footer={lockAvailable === false
                  ? Platform.OS === 'web'
                    ? t('settings.laProteccionDeNotasSe')
                    : t('settings.paraProtegerTusNotasEste')
                  : t('settings.valeSoloEnEsteTelefono')}
              >
                <SettingsToggleRow
                  icon="lock-closed-outline"
                  label={t('settings.protegerNotas')}
                  detail={t('settings.pideFaceIdHuellaO')}
                  value={gradesLock.enabled}
                  onChange={on => void chooseGradesLock(on)}
                  disabled={savingLock || !gradesLock.ready || !lockAvailable}
                />
              </SettingsGroup>

              <AppearanceSetting />

              <View style={styles.block}>
                <ThemedText accessibilityRole="header" style={styles.groupTitle}>{t('settings.iconoDeLaApp')}</ThemedText>
                <View accessibilityRole="radiogroup" style={[styles.iconCard, !iconsAvailable && styles.iconCardOff]}>
                  {APP_ICONS.map(option => {
                    const selected = iconsAvailable && option.id === icon;
                    return (
                      <Pressable
                        key={option.label}
                        accessibilityRole="radio"
                        accessibilityLabel={t('settings.iconoLabelValue', { label: option.label, value: option.id === null ? t('settings.predeterminado') : '' })}
                        accessibilityState={{ checked: selected, disabled: !iconsAvailable }}
                        disabled={!iconsAvailable}
                        onPress={() => void chooseIcon(option.id)}
                        style={({ pressed }) => [styles.iconOption, pressed && AppPressed]}
                      >
                        <View style={[styles.iconRing, selected && styles.iconRingSelected]}>
                          <Image source={option.preview} style={styles.iconImage} contentFit="cover" />
                        </View>
                        <ThemedText numberOfLines={1} style={[styles.iconLabel, selected && styles.iconLabelSelected]}>{option.label}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                {!!iconError && <SettingsNote error>{iconError}</SettingsNote>}
                {!iconsAvailable && (
                  <SettingsNote>
                    {Platform.OS === 'web' ? t('settings.elIconoSeCambiaDesde') : t('settings.paraCambiarElIconoNecesitas')}
                  </SettingsNote>
                )}
              </View>

              {installGuideAvailable && (
                <SettingsGroup title={t('settings.hanetWeb')}>
                  <SettingsLinkRow icon="add-circle-outline" label={t('settings.agregarHanetATuInicio')} onPress={() => setInstallGuideOpen(true)} />
                </SettingsGroup>
              )}
            </>
          )}
        />
        {!wide && aboutAndSession}
      </ScrollView>
      <VersionEasterEgg visible={eggOpen} version={APP_VERSION} stage={APP_RELEASE_STAGE} onClose={() => setEggOpen(false)} />
      <InstallGuideDialog visible={installGuideOpen} onClose={() => setInstallGuideOpen(false)} />
    </FrostedScreen>
  );
}

// Four fit side by side from 375 pt wide phones up.
const ICON_SIZE = 64;

function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() ?? '').join('');
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppColors.canvas },
  page: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: AppSpacing.lg, paddingBottom: 150, gap: AppSpacing.xl },

  title: { ...AppType.largeTitle, color: AppColors.textPrimary, paddingTop: AppSpacing.lg, paddingHorizontal: AppSpacing.xs },
  // Wide web window: the desktop title, like ClassHall's.
  titleWide: { fontFamily: 'DMSans_700Bold', fontSize: 40, lineHeight: 46, letterSpacing: -1.6, paddingTop: 0, paddingHorizontal: 0 },
  block: { gap: AppSpacing.sm },
  groupTitle: { ...AppType.footnote, fontFamily: 'DMSans_700Bold', color: AppColors.textSecondary, paddingHorizontal: AppSpacing.sm },

  account: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  accountCopy: { flex: 1, minWidth: 0 },
  accountName: { ...AppType.headline, fontSize: 17, color: AppColors.textPrimary },
  accountDetail: { ...AppType.caption, color: AppColors.textSecondary, opacity: 0.8 },
  accountAction: { ...AppType.caption, fontFamily: 'DMSans_700Bold', color: AppColors.errorText, marginTop: 2 },

  banner: { flexDirection: 'row', alignItems: 'center', gap: AppSpacing.md, paddingHorizontal: 14, paddingVertical: AppSpacing.md, borderRadius: AppRadii.md, borderCurve: 'continuous', backgroundColor: 'rgba(239,34,116,0.16)' },
  bannerText: { ...AppType.footnote, flex: 1, color: AppColors.textPrimary },
  bannerAction: { ...AppType.footnote, fontFamily: 'DMSans_700Bold', color: AppColors.errorText },
  pressedText: { opacity: 0.6 },

  iconCard: { flexDirection: 'row', justifyContent: 'space-between', gap: AppSpacing.sm, padding: 14, borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  iconCardOff: { opacity: 0.7 },
  iconOption: { flex: 1, alignItems: 'center', gap: AppSpacing.sm },
  // The ring sits outside the icon so the artwork is never covered. A fixed
  // size keeps it square: with a percentage width, aspectRatio took the
  // height from the uncapped width and the icons came out tall.
  iconRing: { width: ICON_SIZE, height: ICON_SIZE, padding: 3, borderRadius: 20, borderCurve: 'continuous', borderWidth: 2, borderColor: 'transparent' },
  iconRingSelected: { borderColor: AppColors.accent },
  iconImage: { flex: 1, borderRadius: 15, borderCurve: 'continuous' },
  iconLabel: { ...AppType.caption, color: AppColors.textSecondary, textAlign: 'center' },
  iconLabelSelected: { color: AppColors.textPrimary, fontFamily: 'DMSans_700Bold' },

  signOut: { minHeight: 54, alignItems: 'center', justifyContent: 'center', borderRadius: AppRadii.lg, borderCurve: 'continuous', backgroundColor: AppColors.surface },
  signOutText: { ...AppType.callout, fontSize: 15, fontFamily: 'DMSans_700Bold', color: AppColors.errorText },
  versionTap: { alignSelf: 'center', paddingVertical: AppSpacing.sm, paddingHorizontal: AppSpacing.lg },
  version: { ...AppType.caption, color: AppColors.textSecondary, opacity: 0.6 },
});
