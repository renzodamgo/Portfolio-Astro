// Ports of the Obstacle guide's reference (robotek-learn, tag obstacle-step-9, src/my_obstacle/my_obstacle) for the
// widgets: lane.py (the lane and the progress), plan.py (the line of the signs), corner.py (the corner search) and
// park.py (the A* parking search). Same numbers and the same order of operations as the Python, so the widgets show
// what the course's code computes. Track frame: origin at the field centre, start straight at the bottom (y = -1),
// travel +x, counter-clockwise (a clockwise round is the same seen in a mirror).

// ------------------------------------------------------------------------------------------------ car (vehicle.py)
export const WHEELBASE = 0.1174;
export const STEER_LIMIT = 0.307;            // the mission's steer_limit (the real car, 17.6 deg)
export const OUTLINE_FRONT = 0.1477;
export const OUTLINE_REAR = 0.0852;
export const HW = 0.074;                     // OUTLINE_HALF_WIDTH
export const REAR_AXLE_X = -0.0587;
export const FRONT_TRACK = 0.1335;
export const WHEEL_RADIUS = 0.0305;
export const WHEEL_WIDTH = 0.0145;
export const LENGTH = OUTLINE_FRONT + OUTLINE_REAR;   // 0.233 m

// ------------------------------------------------------------------------------------------------ lane.py
export const INNER = 0.5;
export const OUTER = 1.5;
export const UNITS_PER_LAP = 8;
export const CORNER_UNITS = Math.PI / 4;
export const ROW = 0.1;
export const SEATS = [0, 1, 2, 3].flatMap((k) => [0, 0.5, 1].map((a) => 2 * k + a));

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pmod = (a: number, n: number) => ((a % n) + n) % n;

/** (x, y, heading) of the lane centre at a progress value. */
export function lanePose(progress: number): [number, number, number] {
  progress = pmod(progress, UNITS_PER_LAP);
  const section = Math.floor(progress);
  const frac = progress - section;
  let x: number, y: number, heading: number;
  if (section % 2 === 0) {
    x = -INNER + frac; y = -1.0; heading = 0;
  } else {
    const theta = -Math.PI / 2 + (frac * Math.PI) / 2;
    x = INNER + INNER * Math.cos(theta); y = -INNER + INNER * Math.sin(theta);
    heading = theta + Math.PI / 2;
  }
  for (let k = 0; k < Math.floor(section / 2); k++) [x, y, heading] = [-y, x, heading + Math.PI / 2];
  return [x, y, wrap(heading)];
}
/** Unit vector to the left of travel: toward the island. */
export function laneNormal(progress: number): [number, number] {
  const heading = lanePose(progress)[2];
  return [-Math.sin(heading), Math.cos(heading)];
}
export function advance(progress: number, metres: number): number {
  const section = pmod(Math.floor(progress), 8);
  return progress + metres / (section % 2 === 0 ? 1 : CORNER_UNITS);
}
/** A point `offset` metres to the island side of the lane at `progress`. */
export function lanePoint(progress: number, offset: number): [number, number] {
  const [x, y] = lanePose(progress), [nx, ny] = laneNormal(progress);
  return [x + offset * nx, y + offset * ny];
}

// ------------------------------------------------------------------------------------------------ plan.py
export const UNKNOWN_OFFSET = 0.12;
export const LOOKOUT = 0.15;
export const HOLD = 0.15;
export const HORIZON = 3.0;
export const OFFSET_LIMIT = 0.36;
export const LOT_OFFSET = -0.19;
export type Colour = 'red' | 'green' | null;
export type Knot = [number, number];
/** {progress: [lateral, colour]} */
export type Signs = Map<number, [number, Colour]>;
export type SignsWithOffsets = Map<number, [number, Colour, number]>;

export function sideOffset(lateral: number, colour: Colour, clearance: number): number {
  if (colour === null) return lateral >= 0 ? -UNKNOWN_OFFSET : UNKNOWN_OFFSET;
  const offset = colour === 'red' ? lateral - clearance : lateral + clearance;
  return clamp(offset, -OFFSET_LIMIT, OFFSET_LIMIT);
}
export function withOffsets(signs: Signs, clearance: number): SignsWithOffsets {
  return new Map([...signs].map(([s, [lateral, colour]]) => [s, [lateral, colour, sideOffset(lateral, colour, clearance)]]));
}
export function lookouts(signs: SignsWithOffsets, phi: number): Knot[] {
  const out: Knot[] = [];
  for (const [s, [lateral, colour]] of signs) {
    const look = s - 1.5;
    if (colour !== null || Math.round(s) % 2 || look - phi < 0.1) continue;
    if ([...signs.keys()].some((other) => Math.abs(other - look) < 0.4)) continue;
    out.push([look, lateral > 0 ? LOOKOUT : 0]);
  }
  return out;
}
export function signKnots(signs: SignsWithOffsets, phi: number): Knot[] {
  const knots: Knot[] = [];
  for (const [s, sign] of signs) for (const d of [-HOLD, HOLD]) knots.push([s + d, sign[2]]);
  return knots.concat(lookouts(signs, phi));
}
export function offsetAt(knots: Knot[], progress: number): number {
  if (!knots.length) return 0;
  if (progress <= knots[0][0]) return knots[0][1];
  for (let i = 0; i + 1 < knots.length; i++) {
    const [s0, d0] = knots[i], [s1, d1] = knots[i + 1];
    if (progress <= s1) return d0 + ((d1 - d0) * (progress - s0)) / Math.max(s1 - s0, 1e-9);
  }
  return knots[knots.length - 1][1];
}
export const sortKnots = (k: Knot[]) => [...k].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

// ------------------------------------------------------------------------------------------------ corner.py
export const SIGN_HALF = 0.025;
const STEP_C = 0.02;
export const RADII = [0.5, 0.6, 0.75];
const OFFSET_GRID = 0.02;
const FREE_SHIFT = 0.1;
export const ENOUGH = 0.11;
const BEFORE = 0.15;
const AFTER = 0.15;
const linspace = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const arange = (a: number, b: number, step: number) => { const out: number[] = []; const n = Math.ceil((b - a) / step - 1e-12); for (let i = 0; i < n; i++) out.push(a + i * step); return out; };
const XS = linspace(-OUTLINE_REAR, OUTLINE_FRONT, 7), YS = linspace(-HW, HW, 3);
/** Perimeter points of the car in base_link (corner._outline). */
export const OUTLINE: [number, number][] = [
  ...XS.flatMap((x) => [[x, YS[0]], [x, YS[2]]] as [number, number][]),
  ...[XS[0], XS[6]].map((x) => [x, YS[1]] as [number, number]),
];
export const CORNERS: [number, number][] = [[OUTLINE_FRONT, HW], [-OUTLINE_REAR, HW], [-OUTLINE_REAR, -HW], [OUTLINE_FRONT, -HW]];

export interface Path { x: number[]; y: number[]; yaw: number[] }
/** Samples of the line in the first corner's frame (bottom straight -> right one, island corner (0.5, -0.5)). */
export function path(dA: number, dB: number, r: number): Path | null {
  const yA = -1 + dA, xB = 1 - dB;
  const cx = xB - r, cy = yA + r;
  const xStart = Math.min(0.5 - BEFORE, cx);
  const yEnd = Math.max(-0.5 + AFTER, cy);
  if (xStart < -0.3 || cy > 0.3) return null;
  const slip = Math.atan2(WHEELBASE / 2, Math.sqrt(Math.max(r * r - (WHEELBASE / 2) ** 2, 1e-9)));
  const lineA = arange(xStart, cx, STEP_C);
  const angles = arange(-Math.PI / 2, 0, STEP_C / r);
  const lineB = arange(cy, yEnd + 1e-9, STEP_C);
  return {
    x: [...lineA, ...angles.map((a) => cx + r * Math.cos(a)), ...lineB.map(() => xB)],
    y: [...lineA.map(() => yA), ...angles.map((a) => cy + r * Math.sin(a)), ...lineB],
    yaw: [...lineA.map(() => 0), ...angles.map((a) => a + Math.PI / 2 - slip), ...lineB.map(() => Math.PI / 2)],
  };
}
export type CornerSign = [number, Colour] | null;
const boxDistance = (px: number, py: number, bx: number, by: number) =>
  Math.hypot(Math.max(Math.abs(px - bx) - SIGN_HALF, 0), Math.max(Math.abs(py - by) - SIGN_HALF, 0));

/** Smallest distance of the outline to the signs, the island and the outer wall; negative on a wrong side. */
export function clearance(p: Path, signA: CornerSign, signB: CornerSign): number {
  const n = p.x.length;
  let worst = Infinity;
  // outline points and the 4 corners of every sample
  const outline = (i: number) => {
    const c = Math.cos(p.yaw[i]), s = Math.sin(p.yaw[i]);
    return OUTLINE.map(([u, v]) => [p.x[i] + c * u - s * v, p.y[i] + s * u + c * v] as [number, number]);
  };
  const corners = (i: number) => {
    const c = Math.cos(p.yaw[i]), s = Math.sin(p.yaw[i]);
    return CORNERS.map(([u, v]) => [p.x[i] + c * u - s * v, p.y[i] + s * u + c * v] as [number, number]);
  };
  const pts: [number, number][][] = [], qs: [number, number][][] = [];
  for (let i = 0; i < n; i++) {
    pts.push(outline(i)); qs.push(corners(i));
    for (const [x, y] of pts[i]) {
      const m = Math.max(Math.abs(x), Math.abs(y));
      worst = Math.min(worst, m - 0.5, 1.5 - m);
    }
  }
  const signs: [[number, Colour], number, number, (q: [number, number]) => number, (q: [number, number]) => number][] = [];
  if (signA) signs.push([signA, 0.5, -1 + signA[0], ([qx]) => qx - 0.5, ([, qy]) => qy + 1]);
  if (signB) signs.push([signB, 1 - signB[0], -0.5, ([, qy]) => qy + 0.5, ([qx]) => 1 - qx]);
  for (const [[lateral, colour], bx, by, along, side] of signs) {
    for (const row of pts) for (const [x, y] of row) worst = Math.min(worst, boxDistance(x, y, bx, by));
    if (colour === null) continue;
    // corner._cut: where each sample's outline (its 4 corners) cuts the sign's line (along = 0)
    let lowMin = Infinity, highMax = -Infinity, any = false;
    for (const q of qs) {
      let lo = Infinity, hi = -Infinity, hit = false;
      for (let k = 0; k < 4; k++) {
        const a0 = along(q[k]), a1 = along(q[(k + 1) % 4]);
        if ((a0 <= 0) !== (a1 <= 0)) {
          const s0 = side(q[k]), s1 = side(q[(k + 1) % 4]);
          const cut = s0 + ((s1 - s0) * a0) / (a0 - a1);
          lo = Math.min(lo, cut); hi = Math.max(hi, cut); hit = true;
        }
      }
      if (hit) { any = true; lowMin = Math.min(lowMin, lo); highMax = Math.max(highMax, hi); }
    }
    if (any) worst = Math.min(worst, colour === 'red' ? lateral - SIGN_HALF - highMax : lowMin - lateral - SIGN_HALF);
  }
  return worst;
}
function band(sign: CornerSign, fixed: number): number[] {
  if (sign === null) return arange(fixed - FREE_SHIFT, fixed + FREE_SHIFT + 1e-9, 0.05).filter((d) => Math.abs(d) <= 0.3);
  if (sign[1] === null) return [fixed];
  const [lateral, colour] = sign;
  const edge = SIGN_HALF + HW;
  const [lo, hi] = colour === 'red' ? [-OFFSET_LIMIT, lateral - edge] : [lateral + edge, OFFSET_LIMIT];
  const out = arange(lo, hi + 1e-9, OFFSET_GRID);
  return out.length ? out : [fixed];
}
export interface CornerPlan { gap: number; dA: number; dB: number; r: number; tried: number }
const plans = new Map<string, CornerPlan | null>();
/** Best (clearance, d_a, d_b, r) for a corner, as corner.plan (cached). */
export function planCorner(signA: CornerSign, signB: CornerSign, fixedA = 0, fixedB = 0, lowA = -1, lowB = -1): CornerPlan | null {
  const key = JSON.stringify([signA, signB, fixedA, fixedB, lowA, lowB]);
  if (plans.has(key)) return plans.get(key)!;
  let best: { score: number[]; gap: number; dA: number; dB: number; r: number } | null = null;
  const prefA = signA === null ? fixedA : 0, prefB = signB === null ? fixedB : 0;
  let tried = 0;
  const better = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };
  for (const r of RADII) {
    const as = band(signA, fixedA).filter((d) => d >= lowA);
    for (const dA of as.length ? as : [Math.max(fixedA, lowA)]) {
      const bs = band(signB, fixedB).filter((d) => d >= lowB);
      for (const dB of bs.length ? bs : [Math.max(fixedB, lowB)]) {
        const p = path(dA, dB, r);
        if (!p) continue;
        tried++;
        const gap = clearance(p, signA, signB);
        const score = gap >= ENOUGH ? [1, -Math.abs(dA - prefA) - Math.abs(dB - prefB), r] : [0, gap, r];
        if (!best || better(score, best.score)) best = { score, gap, dA, dB, r };
      }
    }
  }
  const out = best ? { gap: best.gap, dA: best.dA, dB: best.dB, r: best.r, tried } : null;
  plans.set(key, out);
  return out;
}

// ------------------------------------------------------------------------------------------------ park.py
export const LOT_DEPTH = 0.2;
export const LIMIT_THICKNESS = 0.02;
export const LOT_LENGTH = 1.5 * LENGTH;
export const LOT_END = 0.48;
const FRONT_AXLE_X = WHEELBASE / 2, HALF_TRACK = FRONT_TRACK / 2, WHEEL_HALF_WIDTH = WHEEL_WIDTH / 2;
export const STEP = 0.03;
const SUBSTEPS = 3;
const GEAR_CHANGE = 0.05;
const SEARCH_LIMIT = 200000;
export const GOAL_INSIDE = 0.015;
const STEERS = [-1, -0.5, 0, 0.5, 1];
const REACH = Math.hypot(Math.max(OUTLINE_FRONT, OUTLINE_REAR), HW + 0.02);
export const GAP = 0.04;
export const AHEAD = 0.05;
export type Pose = [number, number, number];
type Poly = [number, number][];

export function footprint(x: number, y: number, th: number, front = OUTLINE_FRONT, halfWidth = HW, rear = OUTLINE_REAR): Poly {
  const c = Math.cos(th), s = Math.sin(th);
  return ([[front, halfWidth], [front, -halfWidth], [-rear, -halfWidth], [-rear, halfWidth]] as [number, number][])
    .map(([u, v]) => [x + c * u - s * v, y + s * u + c * v]);
}
export function frontWheels(x: number, y: number, th: number, steer: number): Poly[] {
  return [1, -1].map((side) => {
    const u = FRONT_AXLE_X, v = side * HALF_TRACK;
    const cx = x + Math.cos(th) * u - Math.sin(th) * v, cy = y + Math.sin(th) * u + Math.cos(th) * v;
    return footprint(cx, cy, th + steer, WHEEL_RADIUS, WHEEL_HALF_WIDTH, WHEEL_RADIUS);
  });
}
function overlaps(poly: Poly, x0: number, x1: number, y0: number, y1: number): boolean {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const [px, py] of poly) { minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py); }
  if (maxx < x0 || minx > x1 || maxy < y0 || miny > y1) return false;
  const box: Poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % 4];
    const nx = ay - by, ny = bx - ax;
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const [px, py] of poly) { const d = nx * px + ny * py; amin = Math.min(amin, d); amax = Math.max(amax, d); }
    for (const [px, py] of box) { const d = nx * px + ny * py; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
    if (amax < bmin || bmax < amin) return false;
  }
  return true;
}
/** Bicycle model about the rear axle; (x, y) is base_link. */
export function move(x: number, y: number, th: number, steer: number, ds: number): Pose {
  let rx = x + REAR_AXLE_X * Math.cos(th), ry = y + REAR_AXLE_X * Math.sin(th);
  const dth = (ds * Math.tan(steer)) / WHEELBASE;
  const mid = th + dth / 2;
  rx += ds * Math.cos(mid); ry += ds * Math.sin(mid); th += dth;
  return [rx - REAR_AXLE_X * Math.cos(th), ry - REAR_AXLE_X * Math.sin(th), th];
}
export class Lot {
  xa: number; xb: number; y0 = -OUTER; y1 = -OUTER + LOT_DEPTH;
  constructor(sign: number) {
    [this.xa, this.xb] = sign > 0 ? [LOT_END - LOT_LENGTH, LOT_END] : [-LOT_END, -LOT_END + LOT_LENGTH];
  }
  limits(margin = 0): [number, number, number, number][] {
    return [[this.xa - LIMIT_THICKNESS - margin, this.xa + margin, this.y0, this.y1 + margin],
      [this.xb - margin, this.xb + LIMIT_THICKNESS + margin, this.y0, this.y1 + margin]];
  }
  parked(x: number, y: number, th: number, inside = 0, parallel = (3 * Math.PI) / 180): boolean {
    return Math.abs(wrap(th)) <= parallel && footprint(x, y, th).every(([px, py]) =>
      this.xa + inside <= px && px <= this.xb - inside && this.y0 + inside <= py && py <= this.y1 - inside);
  }
  free(x: number, y: number, th: number, steer: number, margin: number): boolean {
    if (y - REACH > this.y1 + margin || (y - REACH > this.y0 + margin && (
      x + REACH < this.xa - LIMIT_THICKNESS - margin || x - REACH > this.xb + LIMIT_THICKNESS + margin))) return true;
    const shapes = [footprint(x, y, th), ...(steer ? frontWheels(x, y, th, steer) : [])];
    const boxes = this.limits(margin);
    for (const poly of shapes) {
      if (Math.min(...poly.map((p) => p[1])) < this.y0 + margin || boxes.some((b) => overlaps(poly, ...b))) return false;
    }
    return true;
  }
  arc(pose: Pose, steer: number, direction: number, margin: number, length = STEP): Pose | null {
    let [x, y, th] = pose;
    const steps = Math.max(1, Math.round((SUBSTEPS * length) / STEP));
    for (let i = 0; i < steps; i++) {
      [x, y, th] = move(x, y, th, steer, (direction * length) / steps);
      if (!this.free(x, y, th, steer, margin)) return null;
    }
    return [x, y, th];
  }
}

/** heapq orders the tuples (f, cost, pose, gear, path): the same order here, down to the pose. */
type Ordered = { f: number; n: number; cost?: number; pose?: Pose; gear?: number | null };
function compare(a: Ordered, b: Ordered): number {
  const ka = [a.f, a.cost ?? 0, ...(a.pose ?? [0, 0, 0]), a.gear ?? -1, a.n];
  const kb = [b.f, b.cost ?? 0, ...(b.pose ?? [0, 0, 0]), b.gear ?? -1, b.n];
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
  return 0;
}
/** A binary min-heap (heapq). */
class Heap<T extends Ordered> {
  private a: T[] = [];
  get size() { return this.a.length; }
  push(v: T) {
    const a = this.a; a.push(v);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (this.less(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break; }
  }
  pop(): T {
    const a = this.a, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
  private less(x: T, y: T) { return compare(x, y) < 0; }
}
export interface SearchResult { path: [number, number][] | null; expanded: number }
/** Weighted A* over STEP arcs to a pose GOAL_INSIDE the lot (park.search). */
export function search(lot: Lot, pose: Pose, gear: number | null, steerLimit: number, margin: number, weight = 3): SearchResult {
  const cx = (lot.xa + lot.xb) / 2, cy = (lot.y0 + lot.y1) / 2;
  type Node = { f: number; n: number; cost: number; pose: Pose; gear: number | null; path: [number, number][] };
  const queue = new Heap<Node>();
  let n = 0;
  queue.push({ f: 0, n: n++, cost: 0, pose, gear, path: [] });
  const seen = new Set<string>();
  const deg3 = (3 * Math.PI) / 180;
  while (queue.size && seen.size < SEARCH_LIMIT) {
    const { cost, pose: [x, y, th], gear: last, path } = queue.pop();
    const key = `${Math.round(x / 0.01)},${Math.round(y / 0.01)},${Math.round(th / deg3)},${last}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (lot.parked(x, y, th, GOAL_INSIDE)) return { path, expanded: seen.size };
    for (const fraction of STEERS) {
      const steer = fraction * steerLimit;
      for (const direction of [1, -1]) {
        const end = lot.arc([x, y, th], steer, direction, margin);
        if (!end) continue;
        const g = direction > 0 ? 0 : 1;
        const stepCost = STEP + (last !== null && last !== g ? GEAR_CHANGE : 0);
        const hh = Math.hypot(end[0] - cx, end[1] - cy) + 0.1 * Math.abs(wrap(end[2]));
        queue.push({ f: cost + stepCost + weight * hh, n: n++, cost: cost + stepCost, pose: end, gear: g, path: [...path, [steer, direction]] });
      }
    }
  }
  return { path: null, expanded: seen.size };
}
/** The planning pose: on the approach line, AHEAD past the lot's far limit (park.nominal_plan). */
export const planningPose = (lot: Lot): Pose => [lot.xb + AHEAD, lot.y1 + HW + GAP, 0];

// ------------------------------------------------------------------------------------------------ localizer.py
export const LIDAR_OFFSET_X = 0.128;
const RAYS = 306, HALF_ANGLE = (110 * Math.PI) / 180;
export type BoxXY = [number, number, number, number];   // xmin, xmax, ymin, ymax
/** The field of the tests (fieldsim.field_boxes): outer walls, island and the signs as boxes. */
export function fieldBoxes(signs: { x: number; y: number }[] = []): BoxXY[] {
  const W = 0.02;
  return [[-1.5 - W, 1.5 + W, -1.5 - W, -1.5], [-1.5 - W, 1.5 + W, 1.5, 1.5 + W], [-1.5 - W, -1.5, -1.5, 1.5], [1.5, 1.5 + W, -1.5, 1.5],
    [-0.5, 0.5, -0.5, 0.5], ...signs.map((s): BoxXY => [s.x - 0.025, s.x + 0.025, s.y - 0.025, s.y + 0.025])];
}
/** One LiDAR scan from base_link pose (x, y, yaw) (fieldsim.scan): 306 ranges over ±110°, Infinity when nothing. */
export function scanAt(x: number, y: number, yaw: number, boxes: BoxXY[], noise = 0, rng: () => number = Math.random): number[] {
  const ox = x + LIDAR_OFFSET_X * Math.cos(yaw), oy = y + LIDAR_OFFSET_X * Math.sin(yaw);
  const inc = (2 * HALF_ANGLE) / (RAYS - 1);
  const out: number[] = [];
  for (let i = 0; i < RAYS; i++) {
    const a = -HALF_ANGLE + inc * i + yaw, dx = Math.cos(a), dy = Math.sin(a);
    let best = Infinity;
    for (const [x0, x1, y0, y1] of boxes) {
      const tx0 = (x0 - ox) / dx, tx1 = (x1 - ox) / dx, ty0 = (y0 - oy) / dy, ty1 = (y1 - oy) / dy;
      const near = Math.max(Math.min(tx0, tx1), Math.min(ty0, ty1)), far = Math.min(Math.max(tx0, tx1), Math.max(ty0, ty1));
      if (far >= near && near > 1e-6) best = Math.min(best, near);
    }
    if (noise && Number.isFinite(best)) best += noise * Math.sqrt(-2 * Math.log(rng() || 1e-12)) * Math.cos(2 * Math.PI * rng());
    out.push(best);
  }
  return out;
}
/** Valid returns as points of the car frame, mirrored for CW (localizer.scan_points). */
export function scanPoints(ranges: number[], sign: number): [number[], number[]] {
  const inc = (2 * HALF_ANGLE) / (RAYS - 1), bx: number[] = [], by: number[] = [];
  ranges.forEach((r, i) => {
    if (!(Number.isFinite(r) && r > 0.16 && r < 4)) return;
    const a = -HALF_ANGLE + inc * i;
    bx.push(r * Math.cos(a) + LIDAR_OFFSET_X); by.push(sign * r * Math.sin(a));
  });
  return [bx, by];
}
export interface Fit { px: number[]; py: number[]; nx: number[]; ny: number[]; r: number[] }
/** Scan points near a known wall: positions, wall normals and residuals (Localizer._fit). */
export function fitWalls(bx: number[], by: number[], x: number, y: number, th: number, gate: number): Fit {
  const c = Math.cos(th), s = Math.sin(th), out: Fit = { px: [], py: [], nx: [], ny: [], r: [] };
  for (let i = 0; i < bx.length; i++) {
    const px = x + c * bx[i] - s * by[i], py = y + s * bx[i] + c * by[i];
    const ax = Math.abs(px), ay = Math.abs(py);
    const onx = ax >= ay ? Math.sign(px) : 0, ony = ax < ay ? Math.sign(py) : 0;
    const rOut = onx * px + ony * py - OUTER;
    const inx = ay <= INNER && ax > INNER - 0.05, iny = ax <= INNER && ay > INNER - 0.05;
    let nx = inx ? Math.sign(px) : iny ? 0 : onx, ny = inx ? 0 : iny ? Math.sign(py) : ony;
    const rIn = inx ? ax - INNER : iny ? ay - INNER : Infinity;
    const useIn = Math.abs(rIn) < Math.abs(rOut);
    if (!useIn) { nx = onx; ny = ony; }
    const r = useIn ? rIn : rOut;
    if (Math.abs(r) < gate) { out.px.push(px); out.py.push(py); out.nx.push(nx); out.ny.push(ny); out.r.push(r); }
  }
  return out;
}
function solve3(H: number[][], b: number[]): number[] {
  const m = H.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k];
    }
  }
  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}
export class Localizer {
  x = 0; y = 0; th = 0; inliers = 0; rms = NaN;
  /** Pull the pose toward the wall fit by `gain` (Localizer.correct). False if too few points. */
  correct(bx: number[], by: number[], gain = 1, gate = 0.08, iterations = 2, damping = 2): boolean {
    let { x, y, th } = this;
    let f: Fit = { px: [], py: [], nx: [], ny: [], r: [] };
    for (let it = 0; it < iterations; it++) {
      f = fitWalls(bx, by, x, y, th, gate);
      if (f.r.length < 20) return false;
      const H = [[damping, 0, 0], [0, damping, 0], [0, 0, damping]], g = [0, 0, 0];
      for (let i = 0; i < f.r.length; i++) {
        const w = Math.min(1, 0.02 / Math.max(Math.abs(f.r[i]), 1e-6));
        const J = [f.nx[i], f.ny[i], f.nx[i] * -(f.py[i] - y) + f.ny[i] * (f.px[i] - x)];
        for (let a = 0; a < 3; a++) { g[a] += J[a] * w * f.r[i]; for (let b = 0; b < 3; b++) H[a][b] += J[a] * w * J[b]; }
      }
      const d = solve3(H, g).map((v) => -v);
      x += d[0]; y += d[1]; th = wrap(th + d[2]);
    }
    this.inliers = f.r.length;
    this.rms = Math.sqrt(f.r.reduce((s, r) => s + r * r, 0) / f.r.length);
    this.x += gain * (x - this.x); this.y += gain * (y - this.y); this.th = wrap(this.th + gain * wrap(th - this.th));
    return true;
  }
  /** Global start on the bottom straight: three along-track guesses, the best fit (Localizer.initialize). */
  initialize(bx: number[], by: number[], heading: number): void {
    let best: [number, number, number, number] | null = null;
    for (const x0 of [-0.35, 0, 0.35]) {
      this.x = x0; this.y = -1; this.th = heading;
      for (const gate of [0.45, 0.3, 0.2, 0.12, 0.08, 0.06]) this.correct(bx, by, 1, gate, 2, 0.5);
      const f = fitWalls(bx, by, this.x, this.y, this.th, 0.05);
      const rms = f.r.length ? Math.sqrt(f.r.reduce((s, r) => s + r * r, 0) / f.r.length) : 1;
      const score = f.r.length - 2000 * rms;
      if (!best || score > best[0]) best = [score, this.x, this.y, this.th];
    }
    [, this.x, this.y, this.th] = best!;
  }
}
/** Island on the left (CCW, +1) or the right (CW, -1), and the margin (localizer.direction_from_scan). */
export function directionFromScan(ranges: number[]): { sign: number; margin: number; fractions: Record<string, number> } {
  const fractions: Record<string, number> = {};
  for (const sign of [1, -1]) {
    const [bx, by] = scanPoints(ranges, sign);
    if (bx.length < 50) return { sign: 0, margin: 0, fractions };
    const loc = new Localizer();
    loc.initialize(bx, by, 0);
    fractions[sign] = fitWalls(bx, by, loc.x, loc.y, loc.th, 0.05).r.length / bx.length;
  }
  const sign = fractions[1] >= fractions[-1] ? 1 : -1;
  return { sign, margin: fractions[sign] - fractions[-sign], fractions };
}
