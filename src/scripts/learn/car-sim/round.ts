// Rules of the manual challenge, pure (no DOM, no three.js) so they can be driven headlessly.
// One round = from the first movement until the car has done 24 section exits and stopped in the start section.
import type { CarState } from './physics';
import { LIDAR, WHEELBASE } from './constants';
import { createSectionJudge, footprintSection, MAX_SECTION_POINTS, type Direction } from './sections';

export const SECTIONS_PER_LAP = 8;
export const LAPS = 3;
/** What the course code scores on this field (reference run in Gazebo and in the lab). */
export const COURSE = { points: 30, gazeboTime: 34.8, labTime: 32.6 };
/** Stopped for this long inside the start section ends the round; so does this long after the 24th exit. */
export const REST_SPEED = 0.02; // m/s
export const REST_TIME = 2; // s
export const TIMEOUT = 5; // s

export interface RoundResult {
  direction: Direction;
  sections: number;
  laps: number;
  stopped: boolean;
  points: number;
  /** Seconds from the first movement to the stop (or to the 24th exit when the car did not stop in the start section). */
  time: number;
  crashes: number;
  lapTimes: number[];
}
export type RoundEvent =
  | { type: 'start' }
  | { type: 'lap'; lap: number; time: number }
  | { type: 'crash'; count: number }
  | { type: 'finish'; result: RoundResult };

export interface RoundSnapshot {
  started: boolean;
  finished: boolean;
  elapsed: number;
  laps: number;
  sections: number;
  crashes: number;
  /** Accumulated heading (rad) since the start: what a gyroscope integrating the yaw rate would say. */
  heading: number;
  lapTimes: readonly number[];
  result: RoundResult | null;
}

export function scorePoints(sections: number, stopped: boolean): { sections: number; laps: number; stop: number; points: number } {
  const s = Math.max(0, Math.min(MAX_SECTION_POINTS, Math.floor(sections)));
  const laps = Math.min(LAPS, Math.floor(s / SECTIONS_PER_LAP));
  const stop = stopped ? 3 : 0;
  return { sections: s, laps, stop, points: s + laps + stop };
}

export function createRound(direction: Direction, emit: (event: RoundEvent) => void = () => {}) {
  const judge = createSectionJudge(direction);
  const lapTimes: number[] = [];
  let startClock: number | null = null;
  let lastClock = 0;
  let lastContacts = 0;
  let lastYaw: number | null = null;
  let heading = 0;
  let exit24At: number | null = null;
  let restSince: number | null = null;
  let crashes = 0;
  let result: RoundResult | null = null;

  function finish(stopped: boolean, atClock: number, contacts: number) {
    const time = atClock - (startClock ?? atClock);
    const score = scorePoints(judge.count, stopped);
    result = { direction, sections: score.sections, laps: score.laps, stopped, points: score.points, time, crashes: contacts, lapTimes: [...lapTimes] };
    emit({ type: 'finish', result });
  }

  /** Call after every fixed physics step with the car state. */
  function step(s: CarState) {
    if (result) return;
    lastClock = s.clock;
    if (lastYaw !== null) heading += Math.atan2(Math.sin(s.yaw - lastYaw), Math.cos(s.yaw - lastYaw));
    lastYaw = s.yaw;
    if (startClock === null) {
      if (Math.abs(s.v) <= 1e-3) { judge.update(s.x, s.y, s.yaw); return; } // waiting for the first movement
      startClock = s.clock;
      emit({ type: 'start' });
    }
    const t = s.clock - startClock;
    const before = judge.count;
    const exited = judge.update(s.x, s.y, s.yaw);
    if (exited !== null) {
      const n = judge.count;
      // A skipped corner adds 2 at once: a lap ends when the count reaches a multiple of 8, not only lands on it.
      if (Math.floor(n / SECTIONS_PER_LAP) > Math.floor(before / SECTIONS_PER_LAP) && n <= LAPS * SECTIONS_PER_LAP) {
        lapTimes.push(t);
        emit({ type: 'lap', lap: n / SECTIONS_PER_LAP, time: t });
      }
      if (n >= MAX_SECTION_POINTS && exit24At === null) exit24At = s.clock;
    }
    if (s.contacts !== lastContacts) {
      lastContacts = s.contacts;
      crashes = s.contacts;
      emit({ type: 'crash', count: crashes });
    }
    if (exit24At !== null) {
      const still = Math.abs(s.v) < REST_SPEED && footprintSection(s.x, s.y, s.yaw) === 0;
      if (still) restSince ??= s.clock; else restSince = null;
      if (restSince !== null && s.clock - restSince >= REST_TIME) { finish(true, restSince, s.contacts); return; }
      if (s.clock - exit24At >= TIMEOUT) finish(restSince !== null, restSince ?? exit24At, s.contacts);
    }
  }

  function snapshot(): RoundSnapshot {
    const sections = result ? result.sections : judge.count;
    return {
      started: startClock !== null,
      finished: result !== null,
      elapsed: result ? result.time : startClock === null ? 0 : lastClock - startClock,
      laps: Math.min(LAPS, Math.floor(sections / SECTIONS_PER_LAP)),
      sections,
      crashes: result ? result.crashes : crashes,
      heading,
      lapTimes,
      result,
    };
  }
  return { step, snapshot, direction };
}
export type Round = ReturnType<typeof createRound>;

// ----------------------------------------------------------------------------- best round (localStorage)
export interface Best { points: number; time: number; crashes: number }
export const bestKey = (direction: Direction) => `learn-sim-best-${direction}`;
/** Points first, then the shorter time: the same order the course uses to pick its best round. */
export function isBetter(candidate: Best, current: Best | null): boolean {
  return !current || candidate.points > current.points || (candidate.points === current.points && candidate.time < current.time);
}
export function parseBest(raw: string | null): Best | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (v && Number.isFinite(v.points) && Number.isFinite(v.time) && v.time > 0) {
      return { points: v.points, time: v.time, crashes: Number.isFinite(v.crashes) ? v.crashes : 0 };
    }
  } catch { /* corrupt value: ignore it */ }
  return null;
}
export function loadBest(direction: Direction): Best | null {
  try { return parseBest(localStorage.getItem(bestKey(direction))); } catch { return null; }
}
/** Stores the round when it beats the saved one. Returns true on a new record. */
export function saveBest(direction: Direction, candidate: Best): boolean {
  if (!isBetter(candidate, loadBest(direction))) return false;
  try { localStorage.setItem(bestKey(direction), JSON.stringify(candidate)); } catch { /* private mode */ }
  return true;
}

// ----------------------------------------------------------------------------- readouts
/** Number of the LiDAR sample closest to `angle` (rad, positive = left of the heading). */
export function sampleAt(angle: number): number {
  const step = (2 * LIDAR.halfAngle) / (LIDAR.samples - 1);
  return Math.max(0, Math.min(LIDAR.samples - 1, Math.round((angle + LIDAR.halfAngle) / step)));
}
/** Range (m) of the ray closest to `angle`, or null when nothing was hit. */
export function rangeAt(ranges: ArrayLike<number>, angle: number): number | null {
  const r = ranges[sampleAt(angle)];
  return Number.isFinite(r) && r < LIDAR.max - 0.01 ? r : null;
}
/** Turning radius of the rear axle for a steering angle (rad); null when driving straight. */
export function turnRadius(steer: number): number | null {
  return Math.abs(steer) < 0.009 ? null : WHEELBASE / Math.tan(Math.abs(steer));
}

/** Seconds spent with the island gap inside [lo, hi], and the longest streak. */
export function createBandTracker(lo: number, hi: number) {
  let total = 0, streak = 0, best = 0;
  return {
    update(gap: number | null, dt: number) {
      if (gap !== null && gap >= lo && gap <= hi) { total += dt; streak += dt; best = Math.max(best, streak); } else streak = 0;
    },
    get total() { return total; },
    get best() { return best; },
    get streak() { return streak; },
  };
}

/** Front distance at which each turn started (steering goes from straight to more than ~14 deg). */
export function createTurnTracker() {
  const START = 0.03, COMMIT = 0.25;
  let armed = true, candidate: number | null = null;
  const turns: number[] = [];
  return {
    update(steer: number, front: number, speed: number) {
      const a = Math.abs(steer);
      if (a < START) { armed = true; candidate = null; return; }
      if (!armed) return;
      if (candidate === null && Number.isFinite(front) && Math.abs(speed) > 0.2) candidate = front;
      if (a >= COMMIT && candidate !== null) { turns.push(candidate); armed = false; candidate = null; }
    },
    get last(): number | null { return turns.length ? turns[turns.length - 1] : null; },
    get mean(): number | null { return turns.length ? turns.reduce((p, c) => p + c, 0) / turns.length : null; },
    get count() { return turns.length; },
  };
}

// ----------------------------------------------------------------------------- text
export const fmt = (n: number, digits = 1) => n.toFixed(digits).replace('.', ',');
export const fmtSeconds = (t: number) => `${fmt(t)} s`;
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
