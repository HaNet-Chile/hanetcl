// Root HTML of the web build (only used by `expo export --platform web`).
// Same as Expo Router's default document, plus what a phone needs to treat
// HaNet as an app when it is added to the home screen: manifest, icon,
// standalone mode and the dark status bar color.
import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { DOCUMENT_SCROLL_CSS, DOCUMENT_SCROLL_SPACER } from '@/constants/document-scroll';

const BACKGROUND = '#282829';
const LIGHT_BACKGROUND = '#F2F2F5';

// The light theme (Configuraciones → Apariencia) is a setting of this
// browser, so the page picks its background before anything draws, without
// a dark flash. The key is the one of services/color-scheme.ts.
const THEME_SCRIPT = `try{var m=localStorage.getItem('hanet.colorScheme');if(m==='light'||(m==='system'&&matchMedia('(prefers-color-scheme: light)').matches)){var s=document.createElement('style');s.textContent='html,body{background-color:${LIGHT_BACKGROUND}!important;color-scheme:light}';document.head.appendChild(s);var t=document.querySelector('meta[name=theme-color]');if(t)t.setAttribute('content','${LIGHT_BACKGROUND}');}}catch(e){}`;

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  return (
    <html lang="es" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        {/* i18n-ignore-next-line: an HTTP header name, not interface text */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={BACKGROUND} />
        <meta name="color-scheme" content="dark" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="HaNet" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `html,body{background-color:${BACKGROUND};}${DOCUMENT_SCROLL_CSS}` }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {/* Keeps the page taller than the window (see constants/document-scroll.ts). */}
        <div id={DOCUMENT_SCROLL_SPACER} aria-hidden="true" />
        {bodyNodes}
      </body>
    </html>
  );
}
