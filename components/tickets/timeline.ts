// Keyframes for the ticket animations, so they follow the canvas (Entradas
// HaNet, boards Validada, Llegada and Recibir) to the millisecond: each one is
// a CSS @keyframes there, with its timing function per segment. Everything
// here runs on the UI thread.

/** A CSS cubic-bezier; null is linear. */
export type Ease = readonly [number, number, number, number] | null;

export const LINEAR: Ease = null;
export const EASE_OUT: Ease = [0, 0, 0.58, 1];
export const EASE_IN_OUT: Ease = [0.42, 0, 0.58, 1];

/** Solves a CSS cubic-bezier for progress `p` (0–1). */
export function cubic(p: number, ease: Ease): number {
  'worklet';
  if (ease === null) return p;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const [x1, y1, x2, y2] = ease;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  // Newton on x(t) = p, with bisection as the fallback.
  let t = p;
  for (let i = 0; i < 8; i++) {
    const x = ((ax * t + bx) * t + cx) * t - p;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(x) < 1e-5) break;
    if (Math.abs(d) < 1e-6) break;
    t -= x / d;
  }
  if (t < 0 || t > 1 || Math.abs(((ax * t + bx) * t + cx) * t - p) > 1e-3) {
    let lo = 0;
    let hi = 1;
    t = p;
    for (let i = 0; i < 24; i++) {
      const x = ((ax * t + bx) * t + cx) * t;
      if (Math.abs(x - p) < 1e-5) break;
      if (x < p) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
  }
  return ((ay * t + by) * t + cy) * t;
}

/**
 * The value of one property at `time` (ms): `times` and `values` are its
 * keyframes, `eases[i]` the timing of the segment that starts at keyframe i
 * (missing ones use `fallback`, like a CSS animation-timing-function).
 */
export function track(time: number, times: readonly number[], values: readonly number[], eases?: readonly Ease[], fallback?: Ease): number {
  'worklet';
  // No default parameters here: in the worklet's copy they would run before
  // its captured constants exist, and EASE_OUT would not be defined on the UI
  // thread (that closed the app, 2026-11-19).
  const segments = eases ?? [];
  const otherwise = fallback === undefined ? EASE_OUT : fallback;
  if (time <= times[0]) return values[0];
  const last = times.length - 1;
  if (time >= times[last]) return values[last];
  let i = 0;
  while (i < last - 1 && time >= times[i + 1]) i++;
  const span = times[i + 1] - times[i];
  const p = span > 0 ? (time - times[i]) / span : 1;
  const ease = i < segments.length && segments[i] !== undefined ? segments[i] : otherwise;
  return values[i] + (values[i + 1] - values[i]) * cubic(p, ease);
}
