import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaFrameContext, SafeAreaInsetsContext, type EdgeInsets, type Rect } from 'react-native-safe-area-context';
import { PaperProvider, MD3DarkTheme, MD3LightTheme, configureFonts } from 'react-native-paper';
import { useFonts, DMSans_300Light, DMSans_400Regular, DMSans_400Regular_Italic, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, DMSans_700Bold_Italic } from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';

import { GlobalTabBar } from '@/components/AppTabBar';
import { SideNav } from '@/components/SideNav';
import { EntryAside } from '@/components/EntryAside';
import { ShareIntake } from '@/components/share/share-intake';
import { LaunchSplash } from '@/components/LaunchSplash';
import { AppErrorLayer, FatalBoundary } from '@/components/errors/AppErrorLayer';
import { UpdatePrompt } from '@/components/system/update-prompt';
import { AppColors, AppTheme } from '@/constants/design-tokens';
import { sheetDetents } from '@/constants/sheets';
import { useSession } from '@/services/auth-service';
import { useLaunchContentReady } from '@/services/launch-ready';
import { hasSeenOnboarding, markOnboardingSeen } from '@/services/onboarding';
import { markWhatsNewSeen } from '@/services/whats-new-prompt';
import { listenToNotificationTaps, registerDevice } from '@/services/push-service';
import { touchDevice } from '@/services/security-service';
import { refreshDayWidgets } from '@/services/day-sync';

// The only screens reachable without an account. Everyone starts at the
// onboarding, and signing out goes back to it.
// A ticket's link opens too: a guest without HaNet gets the ticket there.
const PUBLIC_ROUTES = ['/onboarding', '/auth', '/tickets/receive'];

// The splash waits for Home's content, but never longer than this from
// launch: a slow or missing network still gets into the app.
const LAUNCH_WAIT_CAP_MS = 3000;


export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent auto-hide until fonts load
SplashScreen.preventAutoHideAsync();

const lightTheme = AppTheme.scheme === 'light';
const baseNavigationTheme = lightTheme ? DefaultTheme : DarkTheme;
const basePaperTheme = lightTheme ? MD3LightTheme : MD3DarkTheme;

const navigationTheme = {
  ...baseNavigationTheme,
  dark: !lightTheme,
  colors: {
    ...baseNavigationTheme.colors,
    primary: AppColors.accent,
    background: AppColors.canvas,
    card: AppColors.surface,
    text: AppColors.textPrimary,
    border: AppColors.surfaceMuted,
    notification: AppColors.accent,
  },
};

const paperTheme = {
  ...basePaperTheme,
  roundness: 16,
  fonts: configureFonts({ config: { fontFamily: 'DMSans_400Regular' } }),
  colors: {
    ...basePaperTheme.colors,
    primary: AppColors.accent,
    onPrimary: AppColors.textPrimary,
    primaryContainer: AppColors.surfaceRaised,
    onPrimaryContainer: AppColors.textPrimary,
    secondary: AppColors.controlActive,
    onSecondary: AppColors.controlOnActive,
    secondaryContainer: AppColors.surfaceMuted,
    onSecondaryContainer: AppColors.textPrimary,
    background: AppColors.canvas,
    onBackground: AppColors.textPrimary,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
    surfaceVariant: AppColors.surfaceMuted,
    onSurfaceVariant: AppColors.textSecondary,
    outline: AppColors.surfaceMuted,
    error: AppColors.accent,
    onError: AppColors.textPrimary,
  },
};

// Android's form sheet (react-native-screens 4.26) can open with no height,
// leaving an invisible sheet that still takes touches, and on the web Expo
// Router draws a form sheet as a whole new page. On both these screens are
// transparent modals that draw the HaNet sheet themselves (sheet-frame.tsx),
// at the same heights the iOS sheet uses.
function sheetOptions(route: string) {
  if (Platform.OS === 'ios') {
    return { presentation: 'formSheet', headerShown: false, sheetGrabberVisible: true, sheetAllowedDetents: sheetDetents(route) } as const;
  }
  return { presentation: 'transparentModal', headerShown: false, animation: Platform.OS === 'web' ? 'none' : 'fade' } as const;
}

export default function RootLayout() {
  const { user, initializing } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const navigationReady = !!useRootNavigationState()?.key;
  // Whether the screen under the launch splash is the right one yet: signed
  // out on a device that never saw the welcome pages goes to them first.
  const [routed, setRouted] = useState(false);
  // A device that has opened HaNet before only gets a short splash.
  const [returning, setReturning] = useState(false);
  // Signed in, the splash also waits for Home to have its content.
  const contentReady = useLaunchContentReady();
  const [waitedEnough, setWaitedEnough] = useState(false);
  const [signedInAtLaunch, setSignedInAtLaunch] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaitedEnough(true), LAUNCH_WAIT_CAP_MS);
    return () => clearTimeout(timer);
  }, []);

  const [loaded, error] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    // Italics of the feed's Markdown.
    DMSans_400Regular_Italic,
    DMSans_700Bold_Italic,
    // Google Sans Flex cuts for the Aniversario (see AppFlexFonts).
    GoogleSansFlex_300Light_ExtraCondensed: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_300Light_ExtraCondensed.ttf'),
    GoogleSansFlex_500Medium_Condensed: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_500Medium_Condensed.ttf'),
    GoogleSansFlex_700Bold: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_700Bold.ttf'),
    GoogleSansFlex_700Bold_SemiExpanded: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_700Bold_SemiExpanded.ttf'),
    GoogleSansFlex_800ExtraBold_Expanded: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_800ExtraBold_Expanded.ttf'),
    GoogleSansFlex_900Black_Condensed: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_900Black_Condensed.ttf'),
    GoogleSansFlex_900Black_ExtraExpanded: require('@/assets/fonts/google-sans-flex/GoogleSansFlex_900Black_ExtraExpanded.ttf'),
    // The variable font (weight, width and optical size), for FlexText's animation.
    GoogleSansFlexVariable: require('@/assets/fonts/google-sans-flex/GoogleSansFlex-Variable.ttf'),
  });

  // The native splash only covers the font load; HaNet's own splash takes
  // over while the session is restored.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  useEffect(() => {
    if (initializing || routed || !navigationReady) return;
    let active = true;
    (async () => {
      const seen = await hasSeenOnboarding();
      if (!active) return;
      // A ticket's link stays where it is: a guest gets the ticket there.
      if (!user && !PUBLIC_ROUTES.includes(pathname)) router.replace('/onboarding');
      // Signed in already means past the welcome pages.
      if (user && !seen) void markOnboardingSeen();
      // A fresh install starts at this version: its first Home has nothing "new" to tell.
      if (!seen) void markWhatsNewSeen();
      setReturning(seen);
      setSignedInAtLaunch(!!user);
      setRouted(true);
    })();
    return () => { active = false; };
  }, [initializing, navigationReady, pathname, routed, router, user]);

  // Push notifications: the device registers with the account (when the person
  // already allowed them), and a tapped notification opens its screen. The
  // device also stays on the account's list for the security alerts.
  useEffect(() => {
    if (!user || !routed || !navigationReady) return;
    void registerDevice();
    void touchDevice(user);
    return listenToNotificationTaps(url => router.push(url as Href));
  }, [navigationReady, routed, router, user]);

  // The widget, the evaluation reminders and the Live Activity follow the
  // course's timetable and Calendar: refreshed on opening and on coming back.
  useEffect(() => {
    if (!user || !routed) return;
    void refreshDayWidgets(user);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshDayWidgets(user);
    });
    return () => subscription.remove();
  }, [routed, user]);

  // Without an account nothing but the onboarding and sign-in is open: losing
  // the session anywhere (signing out, an expired account) lands on the
  // onboarding.
  useEffect(() => {
    if (initializing || !routed || !navigationReady || user) return;
    if (!PUBLIC_ROUTES.includes(pathname)) router.replace('/onboarding');
  }, [initializing, navigationReady, pathname, routed, router, user]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <WebSafeArea>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={paperTheme}>
        <ThemeProvider value={navigationTheme}>
          <FatalBoundary>
          {/* On a wide web window the side navigation sits beside the screens,
              and on the way in, the brand and the joining steps. */}
          <View style={styles.shell}>
          <EntryAside />
          <SideNav />
          <View style={styles.screens}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="verify-email" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="join-beta" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="link-institution" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="hnt-admin" options={{ headerShown: false }} />
            <Stack.Screen name="event-detail" options={{ headerShown: false }} />
            <Stack.Screen name="event-form" options={sheetOptions('event-form')} />
            <Stack.Screen name="event-options" options={sheetOptions('event-options')} />
            <Stack.Screen name="event-checkin" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="schedule" options={{ headerShown: false }} />
            <Stack.Screen name="feed-post" options={sheetOptions('feed-post')} />
            <Stack.Screen name="ui-showcase" options={{ headerShown: false }} />
            <Stack.Screen name="create-event" options={sheetOptions('create-event')} />
            <Stack.Screen name="day-change" options={sheetOptions('day-change')} />
            <Stack.Screen name="organize/index" options={{ headerShown: false }} />
            <Stack.Screen name="organize/events" options={{ headerShown: false }} />
            <Stack.Screen name="organize/event" options={{ headerShown: false }} />
            <Stack.Screen name="organize/tickets" options={{ headerShown: false }} />
            <Stack.Screen name="organize/new" options={sheetOptions('organize/new')} />
            <Stack.Screen name="organize/issue" options={sheetOptions('organize/issue')} />
            <Stack.Screen name="organize/send" options={sheetOptions('organize/send')} />
            <Stack.Screen name="organize/scanners" options={sheetOptions('organize/scanners')} />
            <Stack.Screen name="organize/leads" options={sheetOptions('organize/leads')} />
            <Stack.Screen name="organize/notify" options={sheetOptions('organize/notify')} />
            <Stack.Screen name="organize/groups" options={sheetOptions('organize/groups')} />
            <Stack.Screen name="organize/notices" options={{ headerShown: false }} />
            <Stack.Screen name="edit-profile" options={sheetOptions('edit-profile')} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="licenses" options={{ headerShown: false }} />
            <Stack.Screen name="whats-new" options={{ headerShown: false }} />
            <Stack.Screen name="security" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" options={{ headerShown: false }} />
            {/* A fade: its header starts drawn like the Home's, so the field seems to stay in place. */}
            <Stack.Screen name="search" options={{ headerShown: false, animation: 'fade', animationDuration: 220 }} />
            <Stack.Screen name="event-info" options={{ headerShown: false }} />
            <Stack.Screen name="anniversary/index" options={{ headerShown: false }} />
            <Stack.Screen name="anniversary/activities" options={{ headerShown: false }} />
            <Stack.Screen name="anniversary/notices" options={{ headerShown: false }} />
            <Stack.Screen name="anniversary/welcome" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="anniversary/setup" options={sheetOptions('anniversary/setup')} />
            <Stack.Screen name="anniversary/activity" options={sheetOptions('anniversary/activity')} />
            <Stack.Screen name="anniversary/detail" options={sheetOptions('anniversary/detail')} />
            <Stack.Screen name="anniversary/result" options={sheetOptions('anniversary/result')} />
            <Stack.Screen name="anniversary/points" options={sheetOptions('anniversary/points')} />
            <Stack.Screen name="anniversary/deadline" options={sheetOptions('anniversary/deadline')} />
            <Stack.Screen name="anniversary/flash" options={sheetOptions('anniversary/flash')} />
            <Stack.Screen name="anniversary/leads" options={sheetOptions('anniversary/leads')} />
            <Stack.Screen name="anniversary/score" options={sheetOptions('anniversary/score')} />
            <Stack.Screen name="tickets/index" options={{ headerShown: false }} />
            <Stack.Screen name="tickets/detail" options={sheetOptions('tickets/detail')} />
            <Stack.Screen name="tickets/validated" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="tickets/arrival" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="tickets/receive" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="tickets/scan" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="share" options={{ headerShown: false }} />
            <Stack.Screen name="tools/index" options={{ headerShown: false }} />
            <Stack.Screen name="tools/electividad/index" options={{ headerShown: false }} />
            <Stack.Screen name="tools/electividad/test" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="tools/electividad/reveal" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="tools/electividad/result" options={{ headerShown: false }} />
            <Stack.Screen name="tools/scale" options={{ headerShown: false }} />
            <Stack.Screen name="tools/grades" options={{ headerShown: false }} />
            <Stack.Screen name="tools/verbs/index" options={{ headerShown: false }} />
            <Stack.Screen name="tools/verbs/pick" options={{ headerShown: false }} />
            <Stack.Screen name="tools/verbs/play" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="grades/index" options={{ headerShown: false }} />
            <Stack.Screen name="grades/subject" options={{ headerShown: false }} />
            <Stack.Screen name="grades/reveal" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="classhall/index" options={{ headerShown: false }} />
            <Stack.Screen name="classhall/join" options={sheetOptions('classhall/join')} />
            <Stack.Screen name="classhall/create" options={sheetOptions('classhall/create')} />
            <Stack.Screen name="classhall/hall" options={{ headerShown: false }} />
            <Stack.Screen name="classhall/evaluation" options={{ headerShown: false }} />
            <Stack.Screen name="classhall/announce" options={sheetOptions('classhall/announce')} />
            <Stack.Screen name="classhall/evaluation-new" options={sheetOptions('classhall/evaluation-new')} />
            <Stack.Screen name="classhall/evaluation-form" options={sheetOptions('classhall/evaluation-form')} />
            <Stack.Screen name="classhall/grades" options={sheetOptions('classhall/grades')} />
            <Stack.Screen name="classhall/tasks" options={{ headerShown: false }} />
            <Stack.Screen name="classhall/task" options={{ headerShown: false }} />
            <Stack.Screen name="classhall/task-form" options={sheetOptions('classhall/task-form')} />
            <Stack.Screen name="classhall/submit" options={sheetOptions('classhall/submit')} />
            <Stack.Screen name="classhall/submission" options={sheetOptions('classhall/submission')} />
          </Stack>
          </View>
          </View>
          <GlobalTabBar />
          <ShareIntake ready={!!user && routed && navigationReady} />
          </FatalBoundary>
          <StatusBar style={lightTheme ? 'dark' : 'light'} />
          <LaunchSplash ready={routed && (!signedInAtLaunch || contentReady || waitedEnough)} quick={returning} />
          <AppErrorLayer />
          <UpdatePrompt />
        </ThemeProvider>
      </PaperProvider>
    </GestureHandlerRootView>
    </WebSafeArea>
  );
}

/**
 * Expo Router's own provider gives the web zero insets (so the static HTML
 * hydrates without a mismatch): installed on a phone's home screen, HaNet ran
 * under the clock and the battery and behind the home indicator. This one
 * reads the screen's real edges once the page is up. The phone apps keep
 * Expo Router's.
 *
 * The edges are the screen's, as they are: the library's web provider trims
 * them by where its view ends against window.innerHeight, and on an iPhone
 * those two disagree depending on whether the page scrolls, so the bottom
 * edge came and went between screens and the tab bar jumped with it.
 */
const NO_EDGES: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function WebSafeArea({ children }: { children: React.ReactNode }) {
  const [insets, setInsets] = useState<EdgeInsets>(NO_EDGES);
  const [frame, setFrame] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);';
    document.body.appendChild(probe);
    const read = () => {
      const style = window.getComputedStyle(probe);
      const next = {
        top: parseFloat(style.paddingTop) || 0,
        right: parseFloat(style.paddingRight) || 0,
        bottom: parseFloat(style.paddingBottom) || 0,
        left: parseFloat(style.paddingLeft) || 0,
      };
      setInsets(now => (now.top === next.top && now.right === next.right && now.bottom === next.bottom && now.left === next.left ? now : next));
      const width = window.innerWidth;
      const height = window.innerHeight;
      setFrame(now => (now.width === width && now.height === height ? now : { x: 0, y: 0, width, height }));
    };
    read();
    window.addEventListener('resize', read);
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('resize', read);
      window.removeEventListener('orientationchange', read);
      probe.remove();
    };
  }, []);

  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <SafeAreaFrameContext.Provider value={frame}>
      <SafeAreaInsetsContext.Provider value={insets}>
        <View style={styles.fill}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: AppColors.canvas,
  },
  screens: {
    flex: 1,
    // Keeps a screen's absolute layers (sheets, overlays) beside the navigation.
    overflow: 'hidden',
  },
});
