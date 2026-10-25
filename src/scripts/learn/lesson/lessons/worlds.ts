// Shared pieces of the lesson worlds (sim frame: x east, y north, metres). Tuned against the course's reference
// solution in the same mini simulator: the right answer passes and the usual mistakes crash or miss.
import type { Box, LessonMark, Metrics, World } from '../types';

/** A number with a decimal comma, as the guide writes them. */
export const f = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

export const GREEN = '#3fbf5a';
export const AMBER = '#e8a33d';
export const RED = '#e5484d';
export const CAR_FRONT = 0.1477;   // m ahead of base_link
export const HALF_WIDTH = 0.074;

/** n small rocks on a circle. */
export function ring(cx: number, cy: number, r: number, n: number, size: number): Box[] {
  return Array.from({ length: n }, (_, k) => [cx + r * Math.cos((2 * Math.PI * k) / n), cy + r * Math.sin((2 * Math.PI * k) / n), size, size] as Box);
}
/** Two rows of rocks along x (a corridor), from x0 to x1, centred on y, `half` from the centre line. */
export function corridorX(x0: number, x1: number, y: number, half: number, step = 0.17, size = 0.1): Box[] {
  const out: Box[] = [];
  const n = Math.round(Math.abs(x1 - x0) / step);
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    out.push([x, y + half, size, size], [x, y - half, size, size]);
  }
  return out;
}
/** Two rows of rocks along y. */
export function corridorY(y0: number, y1: number, x: number, half: number, step = 0.16, size = 0.1): Box[] {
  const out: Box[] = [];
  const n = Math.round(Math.abs(y1 - y0) / step);
  for (let k = 0; k <= n; k++) {
    const y = y0 + ((y1 - y0) * k) / n;
    out.push([x - half, y, size, size], [x + half, y, size, size]);
  }
  return out;
}
export const zone = (x: number, y: number, r: number, color = GREEN): LessonMark => ({ x, y, r, color });
export const inside = (m: Metrics, x: number, y: number, r: number) => Math.hypot(m.x - x, m.y - y) <= r;

/** The Open field with the start where the guide puts it. */
export const FIELD_START: World['start'] = [0, -1.0, 0];
