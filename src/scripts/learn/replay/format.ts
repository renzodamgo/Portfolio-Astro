// Replay file format (version 1): parsing, defensive validation and pure helpers. No DOM, no three.js.
import { OUTLINE_FRONT, OUTLINE_HALF_WIDTH, OUTLINE_REAR } from '../car-sim/constants';

export type FieldName = 'square100' | 'long-island' | 'empty';
export type Direction = 'ccw' | 'cw';

export interface Track {
  id: string;
  label: string;
  color: string;
  t: Float64Array;
  x: Float64Array;
  y: Float64Array;
  /** Yaw unwrapped along the track, so plain linear interpolation is correct. */
  yaw: Float64Array;
  steer: Float64Array;
  /** Wheel rotation (rad) from the distance driven, computed when loading. */
  spin: Float64Array;
}
export interface Scan { t: number; track: number; ranges: (number | null)[] }
export interface SceneNumbers {
  t: number; left: number | null; right: number | null; front: number | null; islandEnd: number | null;
}
export interface LabelEntry { t: number; state: string; corners: number | null }
export interface ReplayEvent { t: number; text: string }
export interface SectionExit { t: number; section: number }

export interface Replay {
  version: 1;
  step: number | null;
  title: string;
  caption: string;
  field: FieldName;
  direction: Direction;
  duration: number;
  tracks: Track[];
  trail: boolean;
  scans: Scan[];
  scene: SceneNumbers[];
  labels: LabelEntry[];
  sections: boolean;
  events: ReplayEvent[];
  /** Section exits of the main track (only when `sections` is true): the score the rules would give. */
  sectionExits: SectionExit[];
}

export class ReplayError extends Error {}

const FIELDS: readonly string[] = ['square100', 'long-island', 'empty'];
const DEFAULT_COLORS = ['#e8a33d', '#ff7a6b'];
export const MAX_SECTION_POINTS = 24;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fail = (message: string): never => { throw new ReplayError(message); };
const text = (v: unknown, fallback = '', max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);
const numOrNull = (v: unknown) => (isNum(v) ? v : null);

function parseTrack(raw: unknown, index: number): Track {
  if (!isObject(raw)) return fail(`La trayectoria ${index + 1} no es válida.`);
  const frames = raw.frames;
  if (!Array.isArray(frames) || frames.length < 2) return fail(`La trayectoria ${index + 1} necesita al menos dos muestras.`);
  const n = frames.length;
  const t = new Float64Array(n), x = new Float64Array(n), y = new Float64Array(n);
  const yaw = new Float64Array(n), steer = new Float64Array(n), spin = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const f = frames[i];
    if (!Array.isArray(f) || f.length < 4 || !isNum(f[0]) || !isNum(f[1]) || !isNum(f[2]) || !isNum(f[3])) {
      return fail(`La muestra ${i + 1} de la trayectoria ${index + 1} no tiene el formato [t, x, y, rumbo, volante].`);
    }
    if (i > 0 && f[0] <= t[i - 1]) return fail(`Los tiempos de la trayectoria ${index + 1} no van en orden creciente.`);
    t[i] = f[0]; x[i] = f[1]; y[i] = f[2];
    const wrapped = f[3];
    yaw[i] = i === 0 ? wrapped : yaw[i - 1] + Math.atan2(Math.sin(wrapped - yaw[i - 1]), Math.cos(wrapped - yaw[i - 1]));
    steer[i] = isNum(f[4]) ? f[4] : 0;
    if (i > 0) {
      const dx = x[i] - x[i - 1], dy = y[i] - y[i - 1];
      const mid = (yaw[i] + yaw[i - 1]) / 2;
      spin[i] = spin[i - 1] + (dx * Math.cos(mid) + dy * Math.sin(mid)) / 0.0305; // WHEEL_RADIUS, signed by the heading
    }
  }
  const id = text(raw.id, `t${index}`, 40) || `t${index}`;
  const color = typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color.trim()) ? raw.color.trim() : DEFAULT_COLORS[index] ?? '#9ad0ff';
  return { id, label: text(raw.label, index === 0 ? 'Coche' : `Coche ${index + 1}`, 60), color, t, x, y, yaw, steer, spin };
}

/** Throws ReplayError (Spanish message) when the file is not a usable version 1 replay. */
export function parseReplay(raw: unknown): Replay {
  if (!isObject(raw)) return fail('El archivo del reproductor no tiene el formato esperado.');
  if (raw.version !== 1) return fail('Este archivo usa una versión del reproductor que no se reconoce.');
  const field = typeof raw.field === 'string' ? raw.field : 'square100';
  if (!FIELDS.includes(field)) return fail(`El campo "${field}" no se puede dibujar.`);
  if (!Array.isArray(raw.tracks) || raw.tracks.length < 1) return fail('El archivo no trae ninguna trayectoria.');
  const tracks = raw.tracks.slice(0, 2).map(parseTrack);
  const end = Math.max(...tracks.map((tr) => tr.t[tr.t.length - 1]));
  const duration = isNum(raw.duration) && raw.duration > 0 ? raw.duration : end;
  const trackIndex = (id: unknown) => {
    const i = tracks.findIndex((tr) => tr.id === id);
    return i >= 0 ? i : 0;
  };
  const byTime = <T extends { t: number }>(list: T[]) => list.sort((a, b) => a.t - b.t);
  const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObject) : []);

  const scans = byTime(list(raw.scans).flatMap((s) => {
    if (!isNum(s.t) || !Array.isArray(s.ranges) || s.ranges.length < 2) return [];
    const ranges = s.ranges.map((r) => (isNum(r) && r > 0 ? r : null));
    return [{ t: s.t, track: trackIndex(s.track), ranges }];
  }));
  const scene = byTime(list(raw.scene).flatMap((s) => isNum(s.t)
    ? [{ t: s.t, left: numOrNull(s.left), right: numOrNull(s.right), front: numOrNull(s.front), islandEnd: numOrNull(s.island_end) }]
    : []));
  const labels = byTime(list(raw.labels).flatMap((s) => isNum(s.t) && typeof s.state === 'string'
    ? [{ t: s.t, state: text(s.state, '', 30), corners: numOrNull(s.corners) }]
    : []));
  const events = byTime(list(raw.events).flatMap((s) => isNum(s.t) && typeof s.text === 'string' && s.text.trim()
    ? [{ t: s.t, text: text(s.text) }]
    : []));

  const replay: Replay = {
    version: 1,
    step: isNum(raw.step) ? raw.step : null,
    title: text(raw.title, 'Reproductor', 120),
    caption: text(raw.caption, '', 600),
    field: field as FieldName,
    direction: raw.direction === 'cw' ? 'cw' : 'ccw',
    duration,
    tracks,
    trail: raw.trail === true,
    scans, scene, labels, events,
    sections: raw.sections === true && field === 'square100',
    sectionExits: [],
  };
  if (replay.sections) replay.sectionExits = sectionExits(tracks[0], replay.direction);
  return replay;
}

// ----------------------------------------------------------------------------- lookups
/** Index of the last entry with t <= time, or -1. */
export function latestIndex(list: readonly { t: number }[], time: number): number {
  let lo = 0, hi = list.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t <= time) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}
export function latestAt<T extends { t: number }>(list: readonly T[], time: number): T | null {
  const i = latestIndex(list, time);
  return i >= 0 ? list[i] : null;
}

export interface TrackPose { x: number; y: number; yaw: number; steer: number; spin: number }

/** Pose at `time`, linear between samples (yaw is already unwrapped). Holds the first/last sample outside the range. */
export function samplePose(track: Track, time: number, out: TrackPose = { x: 0, y: 0, yaw: 0, steer: 0, spin: 0 }): TrackPose {
  const n = track.t.length;
  if (time <= track.t[0]) return fill(out, track, 0, 0, 0);
  if (time >= track.t[n - 1]) return fill(out, track, n - 1, n - 1, 0);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (track.t[mid] <= time) lo = mid; else hi = mid;
  }
  const k = (time - track.t[lo]) / (track.t[hi] - track.t[lo]);
  return fill(out, track, lo, hi, k);
}
function fill(out: TrackPose, tr: Track, a: number, b: number, k: number): TrackPose {
  const mix = (arr: Float64Array) => arr[a] + (arr[b] - arr[a]) * k;
  out.x = mix(tr.x); out.y = mix(tr.y); out.yaw = mix(tr.yaw); out.steer = mix(tr.steer); out.spin = mix(tr.spin);
  return out;
}

/** Index of the last sample with t <= time (0 when before the start). */
export function frameIndex(track: Track, time: number): number {
  let lo = 0, hi = track.t.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track.t[mid] <= time) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// ----------------------------------------------------------------------------- mat sections
/** Fixed mat sections as in rule_judge.mat_section: 0 bottom straight, then counter-clockwise. */
export function matSection(x: number, y: number): number {
  if (y < -0.5) return x < -0.5 ? 7 : x > 0.5 ? 1 : 0;
  if (y > 0.5) return x < -0.5 ? 5 : x > 0.5 ? 3 : 4;
  return x < 0 ? 6 : 2;
}
/** The section that holds the whole car outline, or null while it straddles a boundary. */
export function footprintSection(x: number, y: number, yaw: number): number | null {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let found: number | null = null;
  for (const [lx, ly] of [[OUTLINE_FRONT, OUTLINE_HALF_WIDTH], [OUTLINE_FRONT, -OUTLINE_HALF_WIDTH],
    [-OUTLINE_REAR, -OUTLINE_HALF_WIDTH], [-OUTLINE_REAR, OUTLINE_HALF_WIDTH]]) {
    const section = matSection(x + lx * c - ly * s, y + lx * s + ly * c);
    if (found === null) found = section;
    else if (found !== section) return null;
  }
  return found;
}

/** Section exits in the round direction, following the judge: backward crossings are not counted twice. */
export function sectionExits(track: Track, direction: Direction): SectionExit[] {
  const sign = direction === 'ccw' ? 1 : -1;
  const exits: SectionExit[] = [];
  let current: number | null = null;
  let reverse = 0;
  for (let i = 0; i < track.t.length; i++) {
    const section = footprintSection(track.x[i], track.y[i], track.yaw[i]);
    if (current === null) { current = section; continue; }
    if (section === null || section === current) continue;
    if (section === (current + sign + 8) % 8) {
      if (reverse) reverse--;
      else if (exits.length < MAX_SECTION_POINTS) exits.push({ t: track.t[i], section: current });
      current = section;
    } else if (section === (current - sign + 8) % 8) {
      reverse++;
      current = section;
    }
  }
  return exits;
}
