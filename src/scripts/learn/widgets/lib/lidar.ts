// The Open Challenge field (square100), a simulated LD19 scan and a port of perceive() from
// learn/04-build-open/solution/step_07_perception.py. No DOM here, so it can be tested from the shell.

import { gaussian, hash01 } from './common';

export const LIDAR_X = 0.128;
export const SCAN_RAYS = 306;
export const SCAN_HALF = 1.91986; // rad, +-110 deg
export const SCAN_MIN = 0.12;
export const SCAN_MAX = 12.0;

/** [centre x, centre y, size x, size y] in metres: the 8 boxes of robotek_open_field.sdf. */
export const WALLS: [number, number, number, number][] = [
  [1.52, 0.0, 0.04, 3.08], [-1.52, 0.0, 0.04, 3.08], [0.0, 1.52, 3.08, 0.04], [0.0, -1.52, 3.08, 0.04],
  [0.48, 0.0, 0.04, 1.0], [-0.48, 0.0, 0.04, 1.0], [0.0, 0.48, 1.0, 0.04], [0.0, -0.48, 1.0, 0.04],
];

export interface Scan {
  ranges: number[]; // Infinity for a lost beam
  angleMin: number;
  angleIncrement: number;
  rangeMin: number;
  rangeMax: number;
}

export interface Scene {
  left: number;
  right: number;
  frontAxis: number;
  islandEnd: number;
}

// ------------------------------------------------------------------------------- the field
function slab(o: number, d: number, lo: number, hi: number): [number, number] | null {
  if (Math.abs(d) < 1e-12) return lo <= o && o <= hi ? [-Infinity, Infinity] : null;
  const t1 = (lo - o) / d, t2 = (hi - o) / d;
  return t1 <= t2 ? [t1, t2] : [t2, t1];
}

export function rayRange(ox: number, oy: number, angle: number): number {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let best = Infinity;
  for (const [cx, cy, sx, sy] of WALLS) {
    const a = slab(ox, dx, cx - sx / 2, cx + sx / 2);
    const b = slab(oy, dy, cy - sy / 2, cy + sy / 2);
    if (!a || !b) continue;
    const enter = Math.max(a[0], b[0]), leave = Math.min(a[1], b[1]);
    if (enter <= leave && leave >= 0) best = Math.min(best, Math.max(enter, 0));
  }
  return best;
}

export interface ScanOptions {
  noise: number; // std in m
  dropout: number; // 0..1
  seed: number;
}

/** One scan from a car at (x, y, yaw). Noise and dropouts are a pure function of (seed, ray), so they stay put while you move. */
export function castScan(x: number, y: number, yaw: number, opts: ScanOptions = { noise: 0, dropout: 0, seed: 0 }): Scan {
  const ox = x + LIDAR_X * Math.cos(yaw), oy = y + LIDAR_X * Math.sin(yaw);
  const step = (2 * SCAN_HALF) / (SCAN_RAYS - 1);
  const ranges: number[] = [];
  for (let i = 0; i < SCAN_RAYS; i++) {
    let r = rayRange(ox, oy, yaw - SCAN_HALF + i * step);
    if (opts.noise > 0) {
      let n = 0;
      r += gaussian(() => hash01(opts.seed, i, 1 + n++), opts.noise);
    }
    if (opts.dropout > 0 && hash01(opts.seed, i, 7) < opts.dropout) r = Infinity;
    ranges.push(r >= SCAN_MIN && r <= SCAN_MAX ? r : Infinity);
  }
  return { ranges, angleMin: -SCAN_HALF, angleIncrement: step, rangeMin: SCAN_MIN, rangeMax: SCAN_MAX };
}

// ---------------------------------------------------------------------------- perceive()
const SIDE_HALF = 0.44; // rad around +-90 deg for the side walls
const AXIS_HALF = (3.0 * Math.PI) / 180; // rad around the track axis for the wall ahead
const FIT_HALF = (20.0 * Math.PI) / 180; // the island wall is fitted to beams within this of the side bearing
const END_FROM = (20.0 * Math.PI) / 180; // the island wall is followed from 90 deg down to this bearing
const WALL_TOLERANCE = 0.03; // m
const MAX_GAP_BEAMS = 2; // lost beams that do not end the wall
const MAX_SLOPE = Math.tan(0.3);
const LATERAL_RANGE: [number, number] = [0.15, 0.9];

const relAngle = (a: number, c: number) => Math.atan2(Math.sin(a - c), Math.cos(a - c));

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const n = v.length;
  return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
}

function near(angles: number[], ok: boolean[], centre: number, half: number): boolean[] {
  return angles.map((a, i) => ok[i] && Math.abs(relAngle(a, centre)) <= half);
}

export function medianRange(angles: number[], ranges: number[], ok: boolean[], centre: number): number {
  const chosen = near(angles, ok, centre, SIDE_HALF);
  const vals = ranges.filter((_, i) => chosen[i]);
  return vals.length ? median(vals) : Infinity;
}

export function frontAxis(angles: number[], ranges: number[], ok: boolean[], forwardYaw: number): number {
  const chosen = near(angles, ok, forwardYaw, AXIS_HALF);
  const vals = ranges.map((r, i) => r * Math.cos(angles[i] - forwardYaw)).filter((_, i) => chosen[i]);
  return vals.length ? median(vals) : Infinity;
}

/** What island_end() found, kept for drawing: the fit, the beams used and the last beam on the wall. */
export interface IslandFit {
  end: number;
  valid: boolean; // the line passed the slope and lateral-range checks
  slope: number | null;
  offset: number | null;
  side: boolean[]; // beams used in the fit
  onWall: boolean[]; // beams within WALL_TOLERANCE of the line
  last: number | null; // index of the last beam on the wall
  x: number[]; // beam coordinates in the lidar frame, with +y towards the island side
  y: number[];
  bearing: number[];
}

export function islandFit(angles: number[], ranges: number[], ok: boolean[], sign: number): IslandFit {
  const n = ranges.length;
  const bearing = angles.map((a) => sign * a);
  const x = ranges.map((r, i) => (ok[i] ? r * Math.cos(bearing[i]) : NaN));
  const y = ranges.map((r, i) => (ok[i] ? r * Math.sin(bearing[i]) : NaN));
  const none = (slope: number | null = null, offset: number | null = null, side = new Array<boolean>(n).fill(false)): IslandFit => ({
    end: Infinity, valid: false, slope, offset, side, onWall: new Array<boolean>(n).fill(false), last: null, x, y, bearing,
  });

  let side = bearing.map((b, i) => ok[i] && Math.abs(b - Math.PI / 2) <= FIT_HALF);
  const sideRanges = ranges.filter((_, i) => side[i]);
  if (sideRanges.length) {
    const limit = 1.5 * median(sideRanges);
    side = side.map((s, i) => s && ranges[i] <= limit); // not the beams that already passed the wall's end
  }
  const idx: number[] = [];
  side.forEach((s, i) => s && idx.push(i));
  if (idx.length < 10) return none(null, null, side);

  // least squares line y = slope * x + offset (same as np.polyfit(x, y, 1))
  const m = idx.length;
  let mx = 0, my = 0;
  for (const i of idx) { mx += x[i]; my += y[i]; }
  mx /= m; my /= m;
  let sxx = 0, sxy = 0;
  for (const i of idx) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  if (!(sxx > 1e-12)) return none(null, null, side);
  const slope = sxy / sxx, offset = my - slope * mx;
  if (Math.abs(slope) > MAX_SLOPE || !(LATERAL_RANGE[0] < offset && offset < LATERAL_RANGE[1])) return none(slope, offset, side);

  const onWall = ranges.map((_, i) => ok[i] && Math.abs(y[i] - (slope * x[i] + offset)) <= WALL_TOLERANCE);
  const order = ranges.map((_, i) => i).sort((a, b) => bearing[b] - bearing[a]); // from the side beams towards the front
  let last: number | null = null, missing = 0;
  for (const i of order) {
    if (!(END_FROM <= bearing[i] && bearing[i] <= Math.PI / 2)) continue;
    if (onWall[i]) {
      last = i;
      missing = 0;
    } else {
      missing += 1;
      if (missing > MAX_GAP_BEAMS && last !== null) break;
    }
  }
  const out: IslandFit = { end: Infinity, valid: true, slope, offset, side, onWall, last, x, y, bearing };
  if (last === null || bearing[last] <= END_FROM + 0.05) return out; // still on the wall at the limit of the view
  out.end = x[last] + LIDAR_X;
  return out;
}

function prepare(scan: Scan) {
  const ranges = scan.ranges;
  const angles = ranges.map((_, i) => scan.angleMin + i * scan.angleIncrement);
  const ok = ranges.map((r) => Number.isFinite(r) && r >= scan.rangeMin && r <= scan.rangeMax);
  return { ranges, angles, ok };
}

export function perceive(scan: Scan, forwardYaw = 0, sign = 1): Scene {
  const { ranges, angles, ok } = prepare(scan);
  return {
    left: medianRange(angles, ranges, ok, Math.PI / 2),
    right: medianRange(angles, ranges, ok, -Math.PI / 2),
    frontAxis: frontAxis(angles, ranges, ok, forwardYaw),
    islandEnd: islandFit(angles, ranges, ok, sign).end,
  };
}

/** Scene plus the details of the island fit, for drawing. */
export function perceiveDetailed(scan: Scan, forwardYaw = 0, sign = 1): { scene: Scene; fit: IslandFit; angles: number[]; ok: boolean[] } {
  const { ranges, angles, ok } = prepare(scan);
  const fit = islandFit(angles, ranges, ok, sign);
  return {
    scene: {
      left: medianRange(angles, ranges, ok, Math.PI / 2),
      right: medianRange(angles, ranges, ok, -Math.PI / 2),
      frontAxis: frontAxis(angles, ranges, ok, forwardYaw),
      islandEnd: fit.end,
    },
    fit,
    angles,
    ok,
  };
}
