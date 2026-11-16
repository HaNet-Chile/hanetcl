#!/usr/bin/env node
/* global __dirname */
// Checks constants/desktop-screens.ts, the list of every screen and how it is
// drawn on a wide web window, against the screens in app/.
//
//   npm run desktop:check          -> fails if the list and the screens disagree
//   npm run desktop:check -- --list -> also prints every screen with its layout
//
// It fails when a screen in app/ is missing from the list (or the list names
// one that no longer exists), when a page marked wide, reading or custom
// doesn't use a desktop layout, and when a sheet isn't opened with
// sheetOptions in app/_layout.tsx. Screens still marked todo are listed.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const listPath = path.join(root, 'constants', 'desktop-screens.ts');
const LAYOUTS = ['wide', 'reading', 'custom', 'sheet', 'full', 'entry', 'native', 'none', 'todo'];
// What a page with a desktop layout uses: the kit, or the side navigation's measures.
const DESKTOP_HOOKS = /components\/ui\/wide-page|useSideNav|useContentWidth/;

function screensInApp(dir = path.join(root, 'app'), prefix = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...screensInApp(path.join(dir, entry.name), rel));
    else if (/\.tsx$/.test(entry.name) && !/^(_layout|\+)/.test(entry.name)) out.push(rel.replace(/\.tsx$/, ''));
  }
  return out;
}

const listed = new Map();
const problems = [];
for (const line of fs.readFileSync(listPath, 'utf8').split('\n')) {
  const match = line.match(/^\s*'([^']+)':\s*\{\s*layout:\s*'(\w+)'(?:,\s*via:\s*'([^']+)')?\s*\},?\s*$/);
  if (!match) continue;
  const [, screen, layout, via] = match;
  if (listed.has(screen)) problems.push(`${screen}: está dos veces en la lista`);
  if (!LAYOUTS.includes(layout)) problems.push(`${screen}: layout desconocido "${layout}"`);
  listed.set(screen, { layout, via });
}

const screens = screensInApp();
const layoutFile = fs.readFileSync(path.join(root, 'app', '_layout.tsx'), 'utf8');

for (const screen of screens) {
  if (!listed.has(screen)) problems.push(`app/${screen}.tsx: falta en constants/desktop-screens.ts`);
}
for (const [screen, { layout, via }] of listed) {
  const file = path.join(root, 'app', `${screen}.tsx`);
  if (!fs.existsSync(file)) {
    problems.push(`${screen}: está en la lista pero app/${screen}.tsx no existe`);
    continue;
  }
  if (['wide', 'reading', 'custom'].includes(layout)) {
    const source = fs.readFileSync(path.join(root, via ?? `app/${screen}.tsx`), 'utf8');
    if (!DESKTOP_HOOKS.test(source)) problems.push(`${screen}: marcada "${layout}" pero ${via ?? `app/${screen}.tsx`} no usa wide-page, useSideNav ni useContentWidth`);
  }
  if (layout === 'sheet' && !layoutFile.includes(`sheetOptions('${screen}')`)) {
    problems.push(`${screen}: marcada "sheet" pero app/_layout.tsx no la abre con sheetOptions('${screen}')`);
  }
  if (layout !== 'sheet' && layoutFile.includes(`sheetOptions('${screen}')`)) {
    problems.push(`${screen}: se abre como hoja; márcala "sheet"`);
  }
}

if (process.argv.includes('--list')) {
  for (const layout of LAYOUTS) {
    const names = [...listed].filter(([, item]) => item.layout === layout).map(([screen]) => screen);
    if (names.length) console.log(`${layout} (${names.length}): ${names.join(', ')}`);
  }
  console.log('');
}

const todo = [...listed].filter(([, item]) => item.layout === 'todo').map(([screen]) => screen);
if (todo.length) console.log(`Sin vista de escritorio todavía (${todo.length}): ${todo.join(', ')}`);

if (problems.length) {
  console.error(`Vista de escritorio: ${problems.length} problema(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Vista de escritorio: ${listed.size} pantallas en la lista, todo en orden.`);
