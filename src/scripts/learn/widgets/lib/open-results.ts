// Results of the reference solution (learn: /tmp/RESULTADOS.md): 2 Gazebo rounds and the 12 Open lab rounds.
// Simulation estimates with the published rules, not official scoring. Times run from Start to the stop, in simulated seconds.

export type Env = 'Gazebo' | 'Open lab';
export type Dir = 'ccw' | 'cw';

export interface RoundResult {
  env: Env;
  field: string; // '' for Gazebo
  dir: Dir;
  points: number;
  max: number;
  time: number; // s
  laps?: [number, number, number]; // s, Gazebo only
  margin?: number; // cm, Gazebo only
}

export const RESULTS: RoundResult[] = [
  { env: 'Gazebo', field: '', dir: 'ccw', points: 30, max: 30, time: 34.8, laps: [10.9, 10.6, 11.0], margin: 11.9 },
  { env: 'Gazebo', field: '', dir: 'cw', points: 30, max: 30, time: 34.9, laps: [10.9, 10.6, 11.0], margin: 11.1 },
  { env: 'Open lab', field: 'square100', dir: 'ccw', points: 30, max: 30, time: 32.58 },
  { env: 'Open lab', field: 'square100', dir: 'cw', points: 30, max: 30, time: 32.58 },
  { env: 'Open lab', field: 'square180', dir: 'ccw', points: 30, max: 30, time: 50.18 },
  { env: 'Open lab', field: 'square180', dir: 'cw', points: 30, max: 30, time: 50.28 },
  { env: 'Open lab', field: 'rect100x180', dir: 'ccw', points: 30, max: 30, time: 40.58 },
  { env: 'Open lab', field: 'rect100x180', dir: 'cw', points: 30, max: 30, time: 40.58 },
  { env: 'Open lab', field: 'rect180x100', dir: 'ccw', points: 30, max: 30, time: 42.28 },
  { env: 'Open lab', field: 'rect180x100', dir: 'cw', points: 30, max: 30, time: 42.28 },
  { env: 'Open lab', field: 'shift140', dir: 'ccw', points: 30, max: 30, time: 40.58 },
  { env: 'Open lab', field: 'shift140', dir: 'cw', points: 30, max: 30, time: 42.08 },
  { env: 'Open lab', field: 'east140x100', dir: 'ccw', points: 30, max: 30, time: 36.78 },
  { env: 'Open lab', field: 'east140x100', dir: 'cw', points: 30, max: 30, time: 38.28 },
];

/** The report's own summary of the 12 Open lab rounds. */
export const OPEN_LAB_SUMMARY = { valid: 12, total: 12, meanTime: 40.75 };

/** The rule: more points first, then less time from Start. Negative when `a` ranks ahead of `b`. */
export function byRule(a: RoundResult, b: RoundResult): number {
  return b.points - a.points || a.time - b.time;
}

/** Rank within the same environment (equal points and time share a rank: 1, 1, 3). */
export function rankings(rows: RoundResult[]): Map<RoundResult, number> {
  const out = new Map<RoundResult, number>();
  for (const env of ['Gazebo', 'Open lab'] as Env[]) {
    const group = rows.filter((r) => r.env === env).sort(byRule);
    group.forEach((r, i) => {
      const prev = group[i - 1];
      out.set(r, prev && byRule(prev, r) === 0 ? (out.get(prev) as number) : i + 1);
    });
  }
  return out;
}
