// HaNet's entry: expo-router's own (`expo-router/entry`), plus the theme.
// Every screen's StyleSheet reads `AppColors` when its file loads, and the
// screens load when the router first renders, so the theme chosen in
// Configuraciones is read before that (see `services/color-scheme.ts`).
// `@expo/metro-runtime` must stay the first import (Fast Refresh on the web).
import '@expo/metro-runtime';
import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { useEffect, useState } from 'react';
import { prepareColorScheme, readColorSchemeSync, resolveScheme } from './services/color-scheme';

const preparing = prepareColorScheme();

// The web page comes pre-rendered in the dark theme: in the light one it is
// drawn again from scratch instead of reusing that HTML.
const webMode = readColorSchemeSync();
if (webMode && resolveScheme(webMode) === 'light') {
  (globalThis as { __EXPO_ROUTER_HYDRATE__?: boolean }).__EXPO_ROUTER_HYDRATE__ = false;
}

function Root() {
  // On the web the setting is already in (read at once); on the phone it
  // takes a moment, while the splash screen is still up.
  const [ready, setReady] = useState(webMode !== null);
  useEffect(() => {
    if (!ready) void preparing.then(() => setReady(true));
  }, [ready]);
  return ready ? <App /> : null;
}

renderRootComponent(Root);
