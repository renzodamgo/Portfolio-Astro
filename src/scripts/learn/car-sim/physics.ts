import {
  ACCEL, BRAKE, DRAG, LIDAR, MAX_SPEED, OUTLINE_FRONT, OUTLINE_HALF_WIDTH, OUTLINE_REAR, REAR_AXLE_X,
  PILLAR_SIZE, START, STEER_LIMITS, STEER_RATE, WALLS, WHEELBASE, WHEEL_RADIUS, type Pillar, type Wall,
} from './constants';

/** Pure simulation (no three.js, no DOM): the same kinematic bicycle model as the standalone simulator. */
export interface CarState {
  x: number; y: number; yaw: number; v: number; steer: number; wheelSpin: number;
  contacts: number; time: number; moved: boolean; clock: number;
}
export interface Controls { throttle: number; steer: number; brake: boolean }
export interface Pose {
  x: number; y: number; yaw: number; v: number; steer: number; contacts: number; time: number; frontRange: number;
}

export function createSim(opts: { pillars?: readonly Pillar[] } = {}) {
  /** Walls plus the traffic signs (Obstacle race): the same boxes for collisions and for the LiDAR. */
  const pillars = opts.pillars ?? [];
  const walls: readonly Wall[] = [...WALLS, ...pillars.map((p) => [p.x, p.y, PILLAR_SIZE, PILLAR_SIZE] as const)];
  const state: CarState = {
    x: START.x, y: START.y, yaw: START.yaw, v: 0, steer: 0, wheelSpin: 0, contacts: 0, time: 0, moved: false, clock: 0,
  };
  /** Keyboard and touch input. */
  const controls: Controls = { throttle: 0, steer: 0, brake: false };
  /** Input set from the guide widgets through setDirection (null = none). */
  let override: { throttle: number; steer: number } | null = null;
  let steerLimit = STEER_LIMITS.real;
  let maxSpeed = MAX_SPEED;
  /** While locked the car ignores the controls and stays on the start (the step 8 guess). */
  let locked = false;
  let lastHit = { index: -1, at: -1e9 };
  /** Where reset() puts the car (the challenge starts it facing the other way for clockwise rounds). */
  const start = { x: START.x, y: START.y, yaw: START.yaw };
  /** Optional listeners (the manual challenge): after each fixed step and after each reset. */
  let stepHook: ((state: CarState) => void) | null = null;
  let resetHook: (() => void) | null = null;
  const ranges = new Float32Array(LIDAR.samples);
  let frontRange = Infinity;

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

  function reset() {
    resetHook?.(); // first: the challenge may pick the start heading (setStartYaw) for the new round
    Object.assign(state, { x: start.x, y: start.y, yaw: start.yaw, v: 0, steer: 0, contacts: 0, time: 0, moved: false });
    lastHit = { index: -1, at: -1e9 };
    scan();
  }

  // Collision: SAT between the car outline (oriented box) and the axis-aligned walls.
  function carCorners(x: number, y: number, yaw: number) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    return [[OUTLINE_FRONT, OUTLINE_HALF_WIDTH], [OUTLINE_FRONT, -OUTLINE_HALF_WIDTH],
            [-OUTLINE_REAR, -OUTLINE_HALF_WIDTH], [-OUTLINE_REAR, OUTLINE_HALF_WIDTH]]
      .map(([lx, ly]) => [x + lx * c - ly * s, y + lx * s + ly * c]);
  }
  function hitsWall(corners: number[][], [cx, cy, sx, sy]: Wall) {
    const rect = [[cx - sx / 2, cy - sy / 2], [cx + sx / 2, cy - sy / 2], [cx + sx / 2, cy + sy / 2], [cx - sx / 2, cy + sy / 2]];
    const e = [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]];
    const f = [corners[2][0] - corners[1][0], corners[2][1] - corners[1][1]];
    const axes = [[1, 0], [0, 1], [-e[1], e[0]], [-f[1], f[0]]];
    for (const [ax, ay] of axes) {
      const proj = (pts: number[][]) => pts.map(([px, py]) => px * ax + py * ay);
      const a = proj(corners), b = proj(rect);
      if (Math.max(...a) < Math.min(...b) || Math.max(...b) < Math.min(...a)) return false;
    }
    return true;
  }
  function touchingWall(x: number, y: number, yaw: number) {
    const corners = carCorners(x, y, yaw);
    return walls.findIndex((wall) => hitsWall(corners, wall));
  }

  /** Fixed step: kinematic bicycle referenced to the rear axle. */
  function step(dt: number) {
    state.clock += dt;
    if (locked) { state.v = 0; return; }
    const input = override
      ? { throttle: clamp(controls.throttle + override.throttle, -1, 1), steer: clamp(controls.steer + override.steer, -1, 1) }
      : controls;
    const { throttle, steer: target } = input;
    if (throttle || target) state.moved = true;

    const wanted = target * steerLimit;
    const maxDelta = STEER_RATE * dt;
    state.steer += clamp(wanted - state.steer, -maxDelta, maxDelta);

    if (controls.brake) {
      state.v -= Math.sign(state.v) * Math.min(Math.abs(state.v), BRAKE * dt);
    } else if (throttle) {
      const braking = Math.sign(state.v) !== 0 && Math.sign(state.v) !== Math.sign(throttle);
      state.v += throttle * (braking ? BRAKE : ACCEL) * dt;
      state.v = clamp(state.v, -maxSpeed * 0.5, maxSpeed);
    } else {
      state.v -= Math.sign(state.v) * Math.min(Math.abs(state.v), DRAG * dt);
    }

    const hx = Math.cos(state.yaw), hy = Math.sin(state.yaw);
    const rearX = state.x + REAR_AXLE_X * hx, rearY = state.y + REAR_AXLE_X * hy;
    const yaw = state.yaw + (state.v / WHEELBASE) * Math.tan(state.steer) * dt;
    const mx = Math.cos((state.yaw + yaw) / 2), my = Math.sin((state.yaw + yaw) / 2);
    const nx = rearX + state.v * mx * dt - REAR_AXLE_X * Math.cos(yaw);
    const ny = rearY + state.v * my * dt - REAR_AXLE_X * Math.sin(yaw);

    const wallIndex = touchingWall(nx, ny, yaw);
    if (wallIndex >= 0) {
      const isNew = state.clock - lastHit.at > 0.5; // pushing against a wall is one touch, not many
      lastHit = { index: wallIndex, at: state.clock };
      if (isNew) state.contacts++;
      state.v = 0; // blocked: the car stays where it was
      stepHook?.(state);
      return;
    }
    state.x = nx; state.y = ny; state.yaw = yaw;
    state.wheelSpin += (state.v * dt) / WHEEL_RADIUS;
    if (state.moved) state.time += dt;
    stepHook?.(state);
  }

  // Distance along the ray (ox, oy, dx, dy) to the axis-aligned wall, or Infinity (slab method).
  function rayWall(ox: number, oy: number, dx: number, dy: number, [cx, cy, sx, sy]: Wall) {
    let tmin = 0, tmax = Infinity;
    for (const [o, d, lo, hi] of [[ox, dx, cx - sx / 2, cx + sx / 2], [oy, dy, cy - sy / 2, cy + sy / 2]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
      let t1 = (lo - o) / d, t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
    return tmin;
  }

  /** Casts the 306 LiDAR rays against the walls; fills `ranges` and `frontRange`. Returns the origin. */
  function scan() {
    const ox = state.x + LIDAR.x * Math.cos(state.yaw), oy = state.y + LIDAR.x * Math.sin(state.yaw);
    const stepAngle = (2 * LIDAR.halfAngle) / (LIDAR.samples - 1);
    let best = Infinity, bestAngle = Infinity;
    for (let i = 0; i < LIDAR.samples; i++) {
      const angle = -LIDAR.halfAngle + i * stepAngle, a = state.yaw + angle;
      const dx = Math.cos(a), dy = Math.sin(a);
      let range = LIDAR.max;
      for (const wall of walls) range = Math.min(range, rayWall(ox, oy, dx, dy, wall));
      if (range < LIDAR.min) range = LIDAR.min;
      if (Math.abs(angle) < bestAngle) { bestAngle = Math.abs(angle); best = range; }
      ranges[i] = range;
    }
    frontRange = best;
    return { ox, oy, stepAngle };
  }

  function getPose(): Pose {
    return {
      x: state.x, y: state.y, yaw: state.yaw, v: state.v, steer: state.steer,
      contacts: state.contacts, time: state.time, frontRange,
    };
  }

  scan(); // so getPose().frontRange is valid before the first frame

  return {
    state, controls, ranges, reset, step, scan, getPose, pillars,
    setOverride(o: { throttle: number; steer: number } | null) { override = o; },
    /** Heading reset() uses from now on (the challenge starts the car facing the other way for clockwise rounds). */
    setStartYaw(yaw: number) { start.yaw = yaw; },
    /** Top forward speed (reverse is half of it). Without a call the simulator keeps MAX_SPEED. */
    setMaxSpeed(v: number) { maxSpeed = v; state.v = clamp(state.v, -v * 0.5, v); },
    setLocked(on: boolean) { locked = on; },
    setHooks(hooks: { step?: ((state: CarState) => void) | null; reset?: (() => void) | null }) {
      stepHook = hooks.step ?? null;
      resetHook = hooks.reset ?? null;
    },
    toggleSteerLimit() { steerLimit = steerLimit === STEER_LIMITS.real ? STEER_LIMITS.rule : STEER_LIMITS.real; },
    get steerLimit() { return steerLimit; },
    get lastHit() { return lastHit; },
    get frontRange() { return frontRange; },
  };
}
export type Sim = ReturnType<typeof createSim>;
