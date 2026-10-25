// Port of the pieces of learn/04-build-open/lib/minisim.py and solution/step_02_heading.py the widgets need.

import { gaussian } from './common';

export const WHEELBASE = 0.1174; // m
export const STEER_LIMIT = 0.30718; // rad, 17.6 deg: the real car's full lock (the sim limit is 25 deg)
export const SIM_STEER_LIMIT = 0.4363; // rad, 25 deg
export const GYRO_NOISE = 0.0019; // rad/s
export const GYRO_BIAS = 0.006; // rad/s
const SERVO_DELAY = 0.06;
const SERVO_TAU = 0.05;
const SERVO_RATE = 1.2;
const SPEED_TABLE: [number, number][] = [[0, 0], [0.15, 0.18], [0.3, 0.27], [0.4, 0.3], [0.6, 0.42], [1.28, 0.6]];
export const KP = 0.8;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

export function realSpeed(command: number): number {
  const c = Math.abs(command);
  for (let i = 0; i + 1 < SPEED_TABLE.length; i++) {
    const [x0, y0] = SPEED_TABLE[i];
    const [x1, y1] = SPEED_TABLE[i + 1];
    if (c <= x1) return y0 + ((y1 - y0) * (c - x0)) / (x1 - x0);
  }
  return SPEED_TABLE[SPEED_TABLE.length - 1][1];
}

export function turnRadius(steer: number): number {
  return WHEELBASE / Math.tan(Math.abs(steer));
}

/** Bicycle-model car with the real servo (dead time, lag, rate limit) and motor. */
export class MiniCar {
  x: number;
  y: number;
  yaw: number;
  steer = 0;
  speed = 0;
  yawRate = 0;
  time = 0;
  private queue: number[] | null = null;
  private readonly opts: { bias: number; noise: number; rng: () => number };
  constructor(x: number, y: number, yaw: number, opts: { bias: number; noise: number; rng: () => number }) {
    this.x = x;
    this.y = y;
    this.yaw = yaw;
    this.opts = opts;
  }

  step(speedCommand: number, steerCommand: number, dt: number): void {
    steerCommand = clamp(steerCommand, -STEER_LIMIT, STEER_LIMIT);
    if (this.queue === null) this.queue = new Array(Math.max(1, Math.round(SERVO_DELAY / dt))).fill(0);
    this.queue.push(steerCommand);
    const target = this.queue.shift() as number;
    const change = (target - this.steer) * Math.min(1, dt / SERVO_TAU);
    this.steer += clamp(change, -SERVO_RATE * dt, SERVO_RATE * dt);
    const goal = realSpeed(speedCommand);
    this.speed += (goal - this.speed) * Math.min(1, dt / 0.15);
    this.yawRate = (this.speed * Math.tan(this.steer)) / WHEELBASE;
    this.yaw = wrap(this.yaw + this.yawRate * dt);
    this.x += this.speed * Math.cos(this.yaw) * dt;
    this.y += this.speed * Math.sin(this.yaw) * dt;
    this.time += dt;
  }

  gyro(): number {
    return this.yawRate + this.opts.bias + gaussian(this.opts.rng, this.opts.noise);
  }

  restingGyro(n = 30): number[] {
    return Array.from({ length: n }, () => this.opts.bias + gaussian(this.opts.rng, this.opts.noise));
  }
}

/** The car's heading from the gyroscope alone. */
export class GyroHeading {
  bias = 0;
  yaw = 0;
  calibrate(samples: number[]): void {
    this.bias = samples.reduce((a, b) => a + b, 0) / samples.length;
  }
  update(gyro: number, dt: number): number {
    this.yaw += (gyro - this.bias) * dt;
    return this.yaw;
  }
}

export function headingSteer(goal: number, yaw: number): number {
  return clamp(KP * wrap(goal - yaw), -STEER_LIMIT, STEER_LIMIT);
}
