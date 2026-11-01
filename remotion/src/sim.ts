// A small TypeScript port of the Open v5 strategy (robotek_open/v5/mission.py and scene.py) driving a
// bicycle model on the WRO Open field (3 x 3 m, 1 x 1 m island). It only feeds the animations: the
// sensors are ideal (no noise, no dropouts) and the distance travelled is the true one, where the car
// uses LiDAR odometry. The numbers on screen come from the guide.

export const WHEELBASE = 0.1174; // m, as in the guide (paso 1)
export const STEER_LIMIT = 0.30718; // rad, 17.6 deg: the real servo
export const LIDAR_X = 0.128; // m ahead of base_link
export const DT = 0.02; // 50 Hz control
export const SCAN_EVERY = 5; // 10 Hz LiDAR

export const OUTER = 1.5;
export const ISLAND = 0.5;

const REAL_SPEED: [number, number][] = [
  [0, 0], [0.15, 0.18], [0.3, 0.27], [0.4, 0.3], [0.6, 0.42], [1.28, 0.6],
];
export const realSpeed = (cmd: number) => {
  const c = Math.abs(cmd);
  for (let i = 1; i < REAL_SPEED.length; i++) {
    const [x0, y0] = REAL_SPEED[i - 1];
    const [x1, y1] = REAL_SPEED[i];
    if (c <= x1) return Math.sign(cmd) * (y0 + ((c - x0) * (y1 - y0)) / (x1 - x0));
  }
  return Math.sign(cmd) * REAL_SPEED[REAL_SPEED.length - 1][1];
};

const KP = 0.8;
const DAMPING = 0.1;
const EXIT_ANGLE = 0.25;
const TURN_TOLERANCE = 0.12;
const LAST_TOLERANCE = 0.4;
const CONFIRMATIONS = 2;
const ARM_DISTANCE = 0.25;
const ISLAND_OPEN = 1.0;
const END_CLEARANCE = 0.08;
const LATERAL_GAIN = 0.3;
const LATERAL_MAX = 0.4;
const BRAKE_GAIN = 2.0;
const BRAKE_MARGIN = 0.15;
export const CORNERS = 12;
export const P = {
  cruise: 1.28, lastCorner: 0.6, gap: 0.25, turnFront: 1.19, lookahead: 0.35,
  finishSpeed: 0.15, finishLead: 0.08, stopWait: 0.9, calibrate: 0.3,
};

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const median = (v: number[]) => {
  if (!v.length) return Infinity;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---- field and LiDAR ----
type Seg = [number, number, number, number, boolean]; // x0 y0 x1 y1 island
export const WALLS: Seg[] = [
  [-OUTER, -OUTER, OUTER, -OUTER, false], [OUTER, -OUTER, OUTER, OUTER, false],
  [OUTER, OUTER, -OUTER, OUTER, false], [-OUTER, OUTER, -OUTER, -OUTER, false],
  [-ISLAND, -ISLAND, ISLAND, -ISLAND, true], [ISLAND, -ISLAND, ISLAND, ISLAND, true],
  [ISLAND, ISLAND, -ISLAND, ISLAND, true], [-ISLAND, ISLAND, -ISLAND, -ISLAND, true],
];

export const BEAM_STEP = (0.72 * Math.PI) / 180;
export const BEAMS: number[] = [];
for (let a = -110; a <= 110.001; a += 0.72) BEAMS.push((a * Math.PI) / 180);

export const raycast = (ox: number, oy: number, ang: number): [number, number] => {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  let best = Infinity, seg = -1;
  WALLS.forEach(([x0, y0, x1, y1], i) => {
    const ex = x1 - x0, ey = y1 - y0;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) return;
    const t = ((x0 - ox) * ey - (y0 - oy) * ex) / den;
    const u = ((x0 - ox) * dy - (y0 - oy) * dx) / den;
    if (t > 0.12 && u >= 0 && u <= 1 && t < best) { best = t; seg = i; }
  });
  return [best > 12 ? Infinity : best, seg];
};

export type Scene = { left: number; right: number; front: number; islandEnd: number };

export const perceive = (x: number, y: number, yaw: number, forwardYaw: number, sign: number): Scene => {
  const lx = x + LIDAR_X * Math.cos(yaw), ly = y + LIDAR_X * Math.sin(yaw);
  const hits = BEAMS.map((b) => raycast(lx, ly, yaw + b));
  const side = (c: number) => median(hits.filter((_, i) => Math.abs(BEAMS[i] - c) <= 0.44 && isFinite(hits[i][0])).map((h) => h[0]));
  const front = median(hits.flatMap(([r], i) => {
    const d = wrap(BEAMS[i] - forwardYaw);
    return Math.abs(d) <= (3 * Math.PI) / 180 && isFinite(r) ? [r * Math.cos(d)] : [];
  }));
  // island end: follow the island wall beside the car from 90 deg toward 20 deg
  let islandEnd = Infinity;
  const ordered = BEAMS.map((b, i) => ({ b: sign * b, i })).filter((o) => o.b >= (20 * Math.PI) / 180 && o.b <= Math.PI / 2 + 1e-9)
    .sort((a, b) => b.b - a.b);
  const base = ordered[0] ? hits[ordered[0].i] : [Infinity, -1];
  const lateral = base[0];
  if (isFinite(lateral) && base[1] >= 4 && lateral >= 0.15 && lateral <= 0.9) {
    let last = -1;
    for (const o of ordered) { if (hits[o.i][1] === base[1]) last = o.i; else break; }
    const lb = sign * BEAMS[last];
    if (last >= 0 && lb - (20 * Math.PI) / 180 > 0.05) islandEnd = hits[last][0] * Math.cos(lb) + LIDAR_X;
  }
  return { left: side(Math.PI / 2), right: side(-Math.PI / 2), front, islandEnd };
};

// ---- the run ----
export type Sample = {
  t: number; x: number; y: number; yaw: number; steer: number; speed: number; gyro: number; myYaw: number;
  state: 'SETUP' | 'RUN' | 'STOP'; label: string; completed: number; arc: boolean;
  goal: number; ref: number; scene: Scene; hits: number; armed: boolean; travelled: number;
  frontOk: boolean; islandDone: boolean; started: boolean; direction: string;
};

export type RunOptions = { direction?: 'ccw' | 'cw'; x?: number; y?: number; yaw?: number; seconds?: number; startAt?: number; gyroSign?: number };

export const simulate = (o: RunOptions = {}): Sample[] => {
  const dir = o.direction ?? 'ccw';
  const startAt = o.startAt ?? 0.5;
  let x = o.x ?? 0, y = o.y ?? (dir === 'ccw' ? -0.75 : -0.75), yaw = o.yaw ?? (dir === 'ccw' ? 0 : Math.PI);
  let v = 0, wheel = 0;
  const delay: number[] = Array(3).fill(0); // 0.06 s servo delay
  let state: Sample['state'] = 'SETUP', time = 0, calibrated = false, direction = '';
  const fronts: number[] = [];
  let startFront = Infinity, myYaw = 0, goal = 0, ref = 0, arc = false, armed = true, hits = 0;
  let completed = 0, travelled = 0, braking = false, rest = 0, label = 'WAIT';
  let scene: Scene = perceive(x, y, yaw, 0, 1);
  const out: Sample[] = [];
  const n = Math.round((o.seconds ?? 45) / DT);
  for (let k = 0; k < n; k++) {
    const t = k * DT;
    const started = t >= startAt;
    const sign = (direction || dir) === 'ccw' ? 1 : -1;
    const newScan = k % SCAN_EVERY === 0;
    if (newScan) scene = perceive(x, y, yaw, wrap(goal - myYaw), sign);
    const trueRate = v * Math.tan(wheel) / WHEELBASE;
    const gyro = (o.gyroSign ?? 1) * trueRate; // what the IMU reports (a flipped axis in paso 11)
    let cmd = 0, steer = 0, frontOk = false, islandDone = false;
    if (state === 'SETUP' && started) {
      time += DT; label = 'SETUP';
      if (!calibrated && time < P.calibrate) fronts.push(scene.front);
      else if (!calibrated) { calibrated = true; time = 0; startFront = median(fronts.filter(isFinite)); }
      else if (t - startAt >= 0.75) { direction = dir; state = 'RUN'; travelled = 0; }
    } else if (state === 'RUN') {
      myYaw = wrap(myYaw + gyro * DT);
      const inner = sign > 0 ? scene.left : scene.right;
      const open = isFinite(inner) && inner > ISLAND_OPEN;
      if (newScan) {
        const limit = Math.min(P.lookahead, Math.max(0, inner - END_CLEARANCE));
        hits = scene.islandEnd >= 0 && scene.islandEnd <= limit ? hits + 1 : 0;
      }
      armed = armed || (isFinite(inner) && inner < ISLAND_OPEN && travelled >= ARM_DISTANCE && !arc);
      frontOk = scene.front <= P.turnFront;
      islandDone = open || hits >= CONFIRMATIONS;
      if (completed >= CORNERS) {
        label = braking ? 'DONE' : 'FINISH';
        steer = clamp(KP * wrap(goal - myYaw) - DAMPING * gyro, -STEER_LIMIT, STEER_LIMIT);
        if (!braking && isFinite(scene.front) && scene.front > startFront + P.finishLead) cmd = P.finishSpeed;
        else if (isFinite(scene.front)) braking = true;
        if (braking) { cmd = 0; steer = 0; rest += DT; if (rest >= P.stopWait) { state = 'STOP'; label = 'DONE'; } }
      } else {
        const last = completed === CORNERS - 1;
        const cs = last ? P.lastCorner : P.cruise;
        if (armed && !arc && travelled >= ARM_DISTANCE && frontOk && islandDone) {
          goal = wrap(goal + sign * Math.PI / 2); arc = true; armed = false;
        }
        if (arc) {
          label = 'TURN';
          const rate = realSpeed(cs) * Math.tan(STEER_LIMIT) / WHEELBASE;
          const ramping = ref !== goal;
          if (ramping) {
            const g = wrap(goal - ref);
            ref = Math.abs(g) <= rate * DT ? goal : wrap(ref + Math.sign(g) * rate * DT);
          }
          const fade = Math.min(1, Math.max(0, sign * wrap(goal - myYaw)) / EXIT_ANGLE);
          const feed = ramping ? sign * STEER_LIMIT * fade : 0;
          const expected = ramping ? sign * rate * fade : 0;
          steer = clamp(KP * wrap(ref - myYaw) + feed - DAMPING * (gyro - expected), -STEER_LIMIT, STEER_LIMIT);
          if (Math.abs(wrap(goal - myYaw)) <= (last ? LAST_TOLERANCE : TURN_TOLERANCE)) {
            arc = false; ref = goal; travelled = 0; completed += 1;
          }
          cmd = cs;
        } else {
          label = 'FOLLOW';
          const bias = !isFinite(inner) || open ? 0 : clamp(sign * LATERAL_GAIN * (inner - P.gap), -LATERAL_MAX, LATERAL_MAX);
          steer = clamp(KP * wrap(goal + bias - myYaw) - DAMPING * gyro, -STEER_LIMIT, STEER_LIMIT);
          cmd = P.cruise;
          if (last && isFinite(scene.front)) cmd = Math.min(cmd, cs + BRAKE_GAIN * Math.max(0, scene.front - P.turnFront - BRAKE_MARGIN));
        }
      }
    }
    out.push({
      t, x, y, yaw, steer, speed: v, gyro, myYaw, state, label, completed, arc, goal, ref, scene, hits, armed,
      travelled, frontOk, islandDone, started, direction,
    });
    // plant: servo delay + lag, motor with acceleration limit, bicycle step
    delay.push(steer);
    const target = delay.shift()!;
    wheel += (target - wheel) * Math.min(1, DT / 0.05);
    const vt = realSpeed(cmd);
    v += clamp(vt - v, -2 * DT, 2 * DT);
    const w = v * Math.tan(wheel) / WHEELBASE;
    yaw = wrap(yaw + w * DT);
    x += v * Math.cos(yaw) * DT;
    y += v * Math.sin(yaw) * DT;
    travelled += Math.abs(v) * DT;
  }
  return out;
};

const cache = new Map<string, Sample[]>();
export const run = (o: RunOptions = {}) => {
  const key = JSON.stringify(o);
  if (!cache.has(key)) cache.set(key, simulate(o));
  return cache.get(key)!;
};
export const at = (s: Sample[], t: number) => s[Math.max(0, Math.min(s.length - 1, Math.round(t / DT)))];
export const doneTime = (s: Sample[]) => {
  const i = s.findIndex((q) => q.state === 'STOP');
  return i < 0 ? s[s.length - 1].t : s[i].t;
};
