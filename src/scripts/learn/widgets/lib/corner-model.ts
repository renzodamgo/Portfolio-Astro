// Port of arc_steer / damped_steer (learn: src/my_open/my_open/arc.py), of the MiniCar servo model (robotek_course/minisim.py)
// and of the bench run_arc (course/tests/helpers.py). One 90 degree corner at the corner speed. No DOM here, so it can be
// checked from the shell against the Python (see the notes at the end of the file).

import { PyRandom } from './pyrandom';

export const WHEELBASE = 0.1174; // m
export const STEER_LIMIT = 0.30718; // rad, 17.6 deg: full lock of the real car
export const GYRO_NOISE = 0.0019; // rad/s
const SERVO_RATE = 1.2; // rad/s
export const SERVO_DELAY = 0.06; // s
export const SERVO_TAU = 0.05; // s
const SPEED_TABLE: [number, number][] = [[0, 0], [0.15, 0.18], [0.3, 0.27], [0.4, 0.3], [0.6, 0.42], [1.28, 0.6]];
export const KP = 0.8;
export const CORNER_SPEED = 1.0; // m/s commanded in a corner (the car really reaches 0.53)
export const TURN_TOLERANCE = 0.3; // rad (17 deg): the full-lock part ends this short of the goal heading
export const DAMPING = 0.1; // steering (rad) taken off per rad/s the car is turning
export const CLOSE_TOLERANCE = 0.05; // rad (3 deg): run_arc's t_close is when the heading is this near the goal for good

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

/** The heading law of step 2 with a brake on the turning speed: the faster the car turns, the less it steers. */
export function dampedSteer(goal: number, yaw: number, gyro: number, damping = DAMPING): number {
  return clamp(KP * wrap(goal - yaw) - damping * gyro, -STEER_LIMIT, STEER_LIMIT);
}

/** One tick of a corner: [steering angle, whether the corner is done]. Full lock until `turnTolerance` from the goal. */
export function arcSteer(goal: number, yaw: number, gyro: number, turnTolerance = TURN_TOLERANCE, damping = DAMPING): [number, boolean] {
  const error = wrap(goal - yaw);
  if (Math.abs(error) > turnTolerance) return [Math.sign(error) * STEER_LIMIT, false];
  return [dampedSteer(goal, yaw, gyro, damping), true];
}

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
  turnTolerance?: number;
  damping?: number;
  sign?: number;
  servoDelay?: number;
  servoTau?: number;
  seconds?: number;
  dt?: number;
  seed?: number;
  noise?: number; // gyroscope noise (rad/s); the course bench uses 0.0019
}

export interface ArcRun {
  overshoot: number; // rad past the goal heading
  tClose: number | null; // s until within 0.05 rad of it and staying there
  tLock: number | null; // s at full lock
  t: number[];
  yaw: number[];
  steer: number[]; // the wheel angle the servo really reaches (helpers.run_arc's `steer`)
  cmd: number[]; // the wheel angle the controller asks for
  x: number[];
  y: number[];
  goal: number;
  dt: number;
}

/**
 * run_arc(partial(arc_steer, turn_tolerance=..., damping=...)): one 90 degree corner starting straight at the corner speed.
 * Once arc_steer says done the corner does not start again: only the damped law from there on, as in the mission.
 * The arrays start with the state at t = 0 (index i is time i * dt); Python's lists start one tick later.
 */
export function runArc(o: ArcRunOptions = {}): ArcRun {
  const { turnTolerance = TURN_TOLERANCE, damping = DAMPING, sign = 1, servoDelay = SERVO_DELAY, servoTau = SERVO_TAU, seconds = 4, dt = 0.02, seed = 0, noise = GYRO_NOISE } = o;
  const car = new ArcCar(servoDelay, servoTau, seed, noise);
  for (let i = 0; i < 100; i++) car.step(CORNER_SPEED, 0, dt); // reach the corner speed on the straight
  car.x = car.y = car.yaw = car.time = 0;
  const goal = (sign * Math.PI) / 2;
  let overshoot = 0;
  let tLock: number | null = null;
  let lastOutside: number | null = null;
  const run: ArcRun = { overshoot: 0, tClose: null, tLock: null, t: [0], yaw: [0], steer: [car.steer], cmd: [0], x: [0], y: [0], goal, dt };
  const n = Math.trunc(seconds / dt);
  for (let i = 0; i < n; i++) {
    let steer: number;
    if (tLock === null) {
      let done: boolean;
      [steer, done] = arcSteer(goal, car.yaw, car.gyro(), turnTolerance, damping);
      if (done) tLock = car.time;
    } else {
      [steer] = arcSteer(goal, car.yaw, car.gyro(), Math.PI, damping); // the corner is over: only the damped law
    }
    car.step(CORNER_SPEED, steer, dt);
    overshoot = Math.max(overshoot, sign * (car.yaw - goal));
    if (Math.abs(goal - car.yaw) > CLOSE_TOLERANCE) lastOutside = car.time;
    run.t.push(car.time);
    run.yaw.push(car.yaw);
    run.steer.push(car.steer);
    run.cmd.push(steer);
    run.x.push(car.x);
    run.y.push(car.y);
  }
  run.overshoot = overshoot;
  run.tLock = tLock;
  run.tClose = lastOutside !== null && lastOutside < car.time ? lastOutside + dt : null;
  return run;
}

/** The release angles the lesson measures (rad): 3, 7, 17, 29 and 46 degrees before the goal. */
export const TOLERANCES = [0.05, 0.12, 0.3, 0.5, 0.8];

/** The Python that reproduces a run in the course's bench (`course/tests/helpers.py`). */
export function pythonCall(turnTolerance: number, damping: boolean, servoDelay: number, servoTau: number): string {
  const args: string[] = [];
  if (Math.abs(turnTolerance - TURN_TOLERANCE) > 1e-9) args.push(`turn_tolerance=${turnTolerance.toFixed(2)}`);
  if (!damping) args.push('damping=0.0');
  const fn = args.length ? `partial(arc_steer, ${args.join(', ')})` : 'arc_steer';
  const kw: string[] = [];
  if (Math.abs(servoDelay - SERVO_DELAY) > 1e-9) kw.push(`servo_delay=${servoDelay.toFixed(2)}`);
  if (Math.abs(servoTau - SERVO_TAU) > 1e-9) kw.push(`servo_tau=${servoTau.toFixed(2)}`);
  return `run_arc(${[fn, ...kw].join(', ')})`;
}

// How this file was checked against the Python (my_open/arc.py and course/tests/helpers.py, 12 Nov 2026):
// * bundle it for node: `npx esbuild src/scripts/learn/widgets/lib/corner-model.ts --bundle --format=esm --outfile=/tmp/corner.mjs`;
// * runArc() for both servos (0.06 / 0.05 s and 0.15 / 0.10 s), the five TOLERANCES and damping 0 / 0.1 gave the overshoot,
//   t_lock and t_close of run_arc(partial(arc_steer, turn_tolerance=..., damping=...)) to the printed digit (0.1 deg, 0.01 s);
//   PyRandom gives the same gyroscope noise as random.Random(0).
