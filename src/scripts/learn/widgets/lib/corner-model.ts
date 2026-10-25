// Port of arc_steer / ramp (learn: src/my_open/my_open/arc.py), of the MiniCar servo model (robotek_course/minisim.py)
// and of the bench run_arc (course/tests/helpers.py). One 90 degree corner at cruising speed. No DOM here.

import { PyRandom } from './pyrandom';

export const WHEELBASE = 0.1174; // m
export const STEER_LIMIT = 0.30718; // rad, 17.6 deg: full lock of the real car
export const GYRO_NOISE = 0.0019; // rad/s
const SERVO_RATE = 1.2; // rad/s
export const SERVO_DELAY = 0.06; // s
export const SERVO_TAU = 0.05; // s
const SPEED_TABLE: [number, number][] = [[0, 0], [0.15, 0.18], [0.3, 0.27], [0.4, 0.3], [0.6, 0.42], [1.28, 0.6]];
export const KP = 0.8;
export const CORNER_SPEED = 1.28; // m/s commanded (the car really reaches 0.6)
export const DAMPING = 0.1; // steering (rad) per rad/s of yaw-rate error
export const EXIT_ANGLE = 0.25; // rad: the feed-forward fades out over the last quarter radian
export const CLOSE_TOLERANCE = 0.12; // rad

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** Python's round(): halves go to the even integer. */
export function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d === 0.5) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export function realSpeed(command: number): number {
  const c = Math.abs(command);
  for (let i = 0; i + 1 < SPEED_TABLE.length; i++) {
    const [x0, y0] = SPEED_TABLE[i];
    const [x1, y1] = SPEED_TABLE[i + 1];
    if (c <= x1) return y0 + ((y1 - y0) * (c - x0)) / (x1 - x0);
  }
  return SPEED_TABLE[SPEED_TABLE.length - 1][1];
}

export function fullLockRate(speedCommand = CORNER_SPEED): number {
  return (realSpeed(speedCommand) * Math.tan(STEER_LIMIT)) / WHEELBASE;
}

/** Move the reference heading `ref` towards `goal` by at most rate * dt (the short way round). */
export function ramp(ref: number, goal: number, rate: number, dt: number): number {
  const gap = wrap(goal - ref);
  if (Math.abs(gap) <= rate * dt) return goal;
  return wrap(ref + Math.sign(gap) * rate * dt);
}

export interface ArcOptions {
  sign?: number;
  feed?: boolean;
  fade?: boolean;
  damping?: number;
}

/** One tick of a corner: the ramp plus feed-forward (with fade) and damping. Returns [steer, ref]. */
export function arcSteer(
  goal: number, ref: number, yaw: number, gyro: number, rate: number, dt: number,
  { sign = 1, feed = true, fade = true, damping = DAMPING }: ArcOptions = {},
): [number, number] {
  const ramping = ref !== goal;
  ref = ramp(ref, goal, rate, dt);
  const scale = fade ? Math.min(1, Math.max(0, sign * wrap(goal - yaw)) / EXIT_ANGLE) : 1;
  const [steerFf, rateFf] = ramping && feed ? [sign * STEER_LIMIT * scale, sign * rate * scale] : [0, 0];
  const steer = KP * wrap(ref - yaw) + steerFf - damping * (gyro - rateFf);
  return [clamp(steer, -STEER_LIMIT, STEER_LIMIT), ref];
}

/** For comparison: NO ramp (the goal is the reference at once), damping against a yaw rate of 0. */
export function jumpWithDamping(goal: number, ref: number, yaw: number, gyro: number, _rate: number, _dt: number, damping = 0.1): [number, number] {
  void ref;
  const steer = KP * wrap(goal - yaw) - damping * gyro;
  return [clamp(steer, -STEER_LIMIT, STEER_LIMIT), goal];
}

export type ArcFn = (goal: number, ref: number, yaw: number, gyro: number, rate: number, dt: number) => [number, number];

/** MiniCar(realistic=True): bicycle model with the real servo (dead time, lag, rate limit) and motor. */
export class ArcCar {
  x = 0;
  y = 0;
  yaw = 0;
  steer = 0;
  speed = 0;
  yawRate = 0;
  time = 0;
  private queue: number[] | null = null;
  private readonly rng: PyRandom;
  constructor(private readonly delay: number, private readonly tau: number, seed: number, private readonly noise: number) {
    this.rng = new PyRandom(seed);
  }

  step(speedCommand: number, steerCommand: number, dt: number): void {
    steerCommand = clamp(steerCommand, -STEER_LIMIT, STEER_LIMIT);
    if (this.queue === null) this.queue = new Array<number>(Math.max(1, pyRound(this.delay / dt))).fill(0);
    this.queue.push(steerCommand);
    const target = this.queue.shift() as number; // dead time
    const change = (target - this.steer) * Math.min(1, dt / this.tau); // lag
    this.steer += clamp(change, -SERVO_RATE * dt, SERVO_RATE * dt);
    const goal = realSpeed(speedCommand);
    this.speed += (goal - this.speed) * Math.min(1, dt / 0.15); // the motor takes ~0.15 s
    this.yawRate = (this.speed * Math.tan(this.steer)) / WHEELBASE;
    this.yaw = wrap(this.yaw + this.yawRate * dt);
    this.x += this.speed * Math.cos(this.yaw) * dt;
    this.y += this.speed * Math.sin(this.yaw) * dt;
    this.time += dt;
  }

  /** True yaw rate plus noise (the bias is calibrated away by now, as in run_arc). */
  gyro(): number {
    return this.yawRate + this.rng.gauss(0, this.noise);
  }
}

export interface ArcRunOptions {
  sign?: number;
  servoDelay?: number;
  servoTau?: number;
  rateFactor?: number;
  seconds?: number;
  dt?: number;
  seed?: number;
  noise?: number; // gyroscope noise (rad/s); the course bench uses 0.0019
}

export interface ArcRun {
  overshoot: number; // rad past the goal heading
  tClose: number | null; // s until within 0.12 rad of it
  t: number[];
  yaw: number[];
  steer: number[];
  ref: number[];
  x: number[];
  y: number[];
  goal: number;
  dt: number;
}

/** run_arc(): one 90 degree corner starting straight at cruising speed. `rateFactor` is what the strategy believes. */
export function runArc(arcFn: ArcFn, o: ArcRunOptions = {}): ArcRun {
  const { sign = 1, servoDelay = SERVO_DELAY, servoTau = SERVO_TAU, rateFactor = 1, seconds = 4, dt = 0.02, seed = 0, noise = GYRO_NOISE } = o;
  const car = new ArcCar(servoDelay, servoTau, seed, noise);
  for (let i = 0; i < 100; i++) car.step(CORNER_SPEED, 0, dt); // reach cruising speed on the straight
  car.x = car.y = car.yaw = car.time = 0;
  const goal = (sign * Math.PI) / 2;
  let ref = 0;
  const rate = fullLockRate() * rateFactor;
  let overshoot = 0;
  let tClose: number | null = null;
  const run: ArcRun = { overshoot: 0, tClose: null, t: [], yaw: [], steer: [], ref: [], x: [], y: [], goal, dt };
  run.t.push(0);
  run.yaw.push(0);
  run.steer.push(0);
  run.ref.push(0);
  run.x.push(0);
  run.y.push(0);
  const n = Math.trunc(seconds / dt);
  for (let i = 0; i < n; i++) {
    let steer: number;
    [steer, ref] = arcFn(goal, ref, car.yaw, car.gyro(), rate, dt);
    car.step(CORNER_SPEED, steer, dt);
    overshoot = Math.max(overshoot, sign * (car.yaw - goal));
    if (tClose === null && Math.abs(goal - car.yaw) <= CLOSE_TOLERANCE) tClose = car.time;
    run.t.push(car.time);
    run.yaw.push(car.yaw);
    run.steer.push(car.steer);
    run.ref.push(ref);
    run.x.push(car.x);
    run.y.push(car.y);
  }
  run.overshoot = overshoot;
  run.tClose = tClose;
  return run;
}

export interface CornerConfig {
  ramp: boolean;
  feed: boolean;
  fade: boolean;
  damping: boolean;
}

/** The controller the four checkboxes describe. Without the ramp it is jump_with_damping(). */
export function controllerFor(c: CornerConfig): ArcFn {
  const damping = c.damping ? DAMPING : 0;
  if (!c.ramp) return (goal, ref, yaw, gyro, rate, dt) => jumpWithDamping(goal, ref, yaw, gyro, rate, dt, damping);
  return (goal, ref, yaw, gyro, rate, dt) => arcSteer(goal, ref, yaw, gyro, rate, dt, { feed: c.feed, fade: c.fade, damping });
}
