const DARK = {
  canvas: '#282829',
  surface: '#3C3B3E',
  surfaceMuted: '#504F53',
  surfaceRaised: '#4C5A6F',
  surfaceSoft: '#C7C6CF',
  textPrimary: '#F9F9FA',
  textSecondary: '#DDDDE2',
  textOnLight: '#282829',
  accent: '#EF2274',
  // The accent is too dark for small text; these keep error messages legible.
  errorText: '#FF8DB5',
  errorTextOnLight: '#B0124F',
  primary: '#4C5A6F',
  primaryStrong: '#262D37',
  controlContainer: '#3C3B3E',
  controlActive: '#C7C6CF',
  controlOnActive: '#282829',
  neutral2: '#E9E8EC',
  neutral3: '#DDDDE2',
  neutral5: '#C7C6CF',
  neutral8: '#504F53',
  neutral85: '#3C3B3E',
  neutral9: '#282829',
  neutral05: '#F9F9FA',
  success: '#4C5A6F',
  info: '#4C5A6F',
  dangerSurface: '#262D37',
  warning: '#EF2274',
  danger: '#262D37',
  neutral: '#504F53',
  // Accents of HaNet Eventos (Figma "Accents/Mint" and "Accents/Yellow"): perks and featured lines.
  accentMint: '#00C8B3',
  accentYellow: '#FFCC00',
  // The warm end of the error screen's sunset card (Figma "[sunsetting beta error]").
  sunset: '#FFBF33',
  // The scratch card's darker stripe over the accent (see `Stripes`).
  stripe: '#D81D68',
  // The accent at 18 %: the square behind a pink icon, a "done" status.
  accentTint: 'rgba(239,34,116,0.18)',
  // A barely-there line around a card on the canvas, or between columns.
  hairline: 'rgba(255,255,255,0.08)',
  // The dividers between rows of a grouped list, and the dimming behind a sheet.
  separator: 'rgba(249,249,250,0.12)',
  scrim: 'rgba(0,0,0,0.55)',
  // A light "paper" sheet (create an event, a day change, edit the profile)
  // and the dark text on it, in both themes.
  paper: '#E9E8EC',
  textOnPaper: '#282829',
  textOnPaperMuted: '#3C3B3E',
  // Hint text inside an empty field.
  placeholder: 'rgba(221,221,226,0.4)',
  // A faint fill over a surface: a chip inside a card, a pressed row.
  overlay: 'rgba(255,255,255,0.12)',
  // Translucent canvas behind floating bars and pills, and its edge.
  glassFill: 'rgba(40,40,41,0.6)',
  glassBorder: 'rgba(255,255,255,0.15)',
  // A faint fill on an active control (a field inside the open search pill).
  onControlOverlay: 'rgba(40,40,41,0.12)',
  // A cancelled class or event in the Calendar.
  cancelledSurface: '#4A3535',
  // Hint text in the quieter fields (forms on a sheet), and on an active control.
  placeholderMuted: '#504F53',
  placeholderOnControl: 'rgba(40,40,41,0.6)',
};

/**
 * The light theme (an option in Configuraciones → Apariencia; dark stays the
 * default). Same roles, same pink: grey canvas, white cards, and the "light"
 * controls of the dark theme (active pills, soft tiles) turn near-black, so
 * text on them (`textOnLight`, `controlOnActive`) turns white.
 */
const LIGHT: Palette = {
  canvas: '#F2F2F5',
  surface: '#FFFFFF',
  surfaceMuted: '#E4E3E9',
  surfaceRaised: '#D8DEE7',
  surfaceSoft: '#3C3B3E',
  textPrimary: '#1F1F21',
  textSecondary: '#5C5B61',
  textOnLight: '#F9F9FA',
  accent: '#EF2274',
  errorText: '#B0124F',
  errorTextOnLight: '#B0124F',
  primary: '#DCE1EA',
  primaryStrong: '#C9D0DB',
  controlContainer: '#E4E3E9',
  controlActive: '#282829',
  controlOnActive: '#F9F9FA',
  neutral2: '#3C3B3E',
  neutral3: '#504F53',
  neutral5: '#6E6D73',
  neutral8: '#C7C6CF',
  neutral85: '#E4E3E9',
  neutral9: '#F2F2F5',
  neutral05: '#1F1F21',
  success: '#4C5A6F',
  info: '#4C5A6F',
  dangerSurface: '#F6DCE6',
  warning: '#EF2274',
  danger: '#262D37',
  neutral: '#C7C6CF',
  accentMint: '#00A896',
  accentYellow: '#F5B700',
  sunset: '#FFBF33',
  stripe: '#D81D68',
  accentTint: 'rgba(239,34,116,0.12)',
  hairline: 'rgba(31,31,33,0.08)',
  separator: 'rgba(31,31,33,0.12)',
  scrim: 'rgba(0,0,0,0.35)',
  paper: '#F2F2F5',
  textOnPaper: '#282829',
  textOnPaperMuted: '#3C3B3E',
  placeholder: 'rgba(31,31,33,0.35)',
  overlay: 'rgba(31,31,33,0.06)',
  glassFill: 'rgba(242,242,245,0.72)',
  glassBorder: 'rgba(31,31,33,0.08)',
  onControlOverlay: 'rgba(249,249,250,0.16)',
  cancelledSurface: '#F5E3E8',
  placeholderMuted: '#A3A2AA',
  placeholderOnControl: 'rgba(249,249,250,0.6)',
};

type Palette = { [K in keyof typeof DARK]: string };

export type AppScheme = 'dark' | 'light';

/**
 * The colors of the theme in use. They are filled in before any screen
 * loads (see `index.tsx` and `applyColorScheme`), so module-level
 * StyleSheets read the right theme; changing it restarts HaNet.
 */
export const AppColors: Palette = { ...DARK };

/** Which theme `AppColors` holds, and the native materials that go with it. */
export const AppTheme = {
  scheme: 'dark' as AppScheme,
  /** BlurView tint for bars and panels. */
  blurTint: 'systemUltraThinMaterialDark' as 'systemUltraThinMaterialDark' | 'systemUltraThinMaterialLight',
  /** BlurView tint for heavier chrome (sheets over content). */
  chromeTint: 'systemChromeMaterialDark' as 'systemChromeMaterialDark' | 'systemChromeMaterialLight',
};

/** The fixed palettes, for previews of each theme. */
export const AppPalettes: Record<AppScheme, Readonly<Palette>> = { dark: DARK, light: LIGHT };

/** Fills `AppColors` with one theme. Call it before the screens load. */
export function applyColorScheme(scheme: AppScheme) {
  Object.assign(AppColors, scheme === 'light' ? LIGHT : DARK);
  AppTheme.scheme = scheme;
  AppTheme.blurTint = scheme === 'light' ? 'systemUltraThinMaterialLight' : 'systemUltraThinMaterialDark';
  AppTheme.chromeTint = scheme === 'light' ? 'systemChromeMaterialLight' : 'systemChromeMaterialDark';
  AppRowPressed.backgroundColor = scheme === 'light' ? 'rgba(31,31,33,0.05)' : 'rgba(249,249,250,0.06)';
}

export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const AppRadii = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
} as const;

export const AppTouch = {
  minimum: 44,
  comfortable: 48,
} as const;

/**
 * Type scale (DM Sans). Tracking depends on size, as in the Figma file:
 * large text is pulled in (about -4 to -5 %), small text sits near 0, and
 * leading tightens as size grows. Use these instead of one-off values.
 */
export const AppType = {
  largeTitle: { fontFamily: 'DMSans_500Medium', fontSize: 34, lineHeight: 41, letterSpacing: -1.7 },
  title1: { fontFamily: 'DMSans_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -1.1 },
  title2: { fontFamily: 'DMSans_700Bold', fontSize: 24, lineHeight: 29, letterSpacing: -1.08 },
  title3: { fontFamily: 'DMSans_700Bold', fontSize: 20, lineHeight: 26, letterSpacing: -0.8 },
  headline: { fontFamily: 'DMSans_700Bold', fontSize: 16, lineHeight: 20, letterSpacing: -0.4 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  callout: { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  footnote: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
} as const;

/**
 * Google Sans Flex, for big expressive text (the Aniversario's titles and
 * scores). Still text uses these fixed cuts. `FlexText` animates with the
 * variable font instead (`variable`, its axes moved with
 * fontVariationSettings): `ramp` goes from narrow and light to wide and
 * black, and it glides from the first cut's axes to the last one's.
 */
export const AppFlexFonts = {
  ramp: [
    'GoogleSansFlex_300Light_ExtraCondensed',
    'GoogleSansFlex_500Medium_Condensed',
    'GoogleSansFlex_700Bold',
    'GoogleSansFlex_800ExtraBold_Expanded',
    'GoogleSansFlex_900Black_ExtraExpanded',
  ],
  wide: 'GoogleSansFlex_900Black_ExtraExpanded',
  numbers: 'GoogleSansFlex_900Black_Condensed',
  /** Normal width, for running text like the strips. */
  bold: 'GoogleSansFlex_700Bold',
  name: 'GoogleSansFlex_700Bold_SemiExpanded',
  /** The variable font, whose axes FlexText animates. */
  variable: 'GoogleSansFlexVariable',
} as const;

/** Each fixed cut's place on the variable font's axes (weight 1–1000, width 25–151). */
export const AppFlexAxes: Record<string, { wght: number; wdth: number }> = {
  GoogleSansFlex_300Light_ExtraCondensed: { wght: 300, wdth: 62.5 },
  GoogleSansFlex_500Medium_Condensed: { wght: 500, wdth: 75 },
  GoogleSansFlex_700Bold: { wght: 700, wdth: 100 },
  GoogleSansFlex_700Bold_SemiExpanded: { wght: 700, wdth: 112.5 },
  GoogleSansFlex_800ExtraBold_Expanded: { wght: 800, wdth: 125 },
  GoogleSansFlex_900Black_Condensed: { wght: 900, wdth: 75 },
  GoogleSansFlex_900Black_ExtraExpanded: { wght: 900, wdth: 150 },
};

/** Display sizes in Google Sans Flex. Wide cuts need less negative tracking. */
export const AppDisplay = {
  hero: { fontFamily: AppFlexFonts.wide, fontSize: 40, lineHeight: 42, letterSpacing: -1.2 },
  title: { fontFamily: AppFlexFonts.wide, fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
  section: { fontFamily: AppFlexFonts.name, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
  name: { fontFamily: AppFlexFonts.name, fontSize: 17, lineHeight: 21, letterSpacing: -0.3 },
  number: { fontFamily: AppFlexFonts.numbers, fontSize: 56, lineHeight: 58, letterSpacing: -1.5 },
  score: { fontFamily: AppFlexFonts.numbers, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
} as const;

/** Press feedback shared by every tappable surface: a light dip and press-in. */
export const AppPressed = { opacity: 0.84, transform: [{ scale: 0.97 }] } as const;
/**
 * Press feedback for a row inside a list or a grouped card: the row lights
 * up in place, as in the phone's own lists, instead of shrinking (a row that
 * shrinks pulls away from its dividers).
 */
export const AppRowPressed = { backgroundColor: 'rgba(249,249,250,0.06)' };
