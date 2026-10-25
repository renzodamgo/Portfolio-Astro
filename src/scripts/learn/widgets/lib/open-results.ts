// Results of the reference solution (learn: src/my_open/RESULTADOS.md): 2 Gazebo rounds and the 12 Open lab rounds.
// Simulation estimates with the published rules, not official scoring. Times run from Start to the stop, in simulated seconds.
// The lap times of the Gazebo rounds come from RESULTADOS.md; those of the Open lab rounds were measured again by running
// the standard suite with the tag step-9 (the field `laps` of open_lab.run_round, seed 0): points and times agree with the file.

export type Env = 'Gazebo' | 'Open lab';
export type Dir = 'ccw' | 'cw';

export interface RoundResult {
  env: Env;
  field: string; // '' for Gazebo
  dir: Dir;
  points: number;
  max: number;
  time: number; // s
  laps: [number, number, number]; // s, the three partial times (they do not add up to `time`: the stop comes after lap 3)
  margin?: number; // cm, Gazebo only
}

export const RESULTS: RoundResult[] = [
  { env: 'Gazebo', field: '', dir: 'ccw', points: 30, max: 30, time: 34.8, laps: [10.9, 10.6, 11.0], margin: 11.9 },
  { env: 'Gazebo', field: '', dir: 'cw', points: 30, max: 30, time: 34.9, laps: [10.9, 10.6, 11.0], margin: 11.1 },
  { env: 'Open lab', field: 'square100', dir: 'ccw', points: 30, max: 30, time: 32.58, laps: [10.4, 9.7, 10.3] },
  { env: 'Open lab', field: 'square100', dir: 'cw', points: 30, max: 30, time: 32.58, laps: [10.4, 9.7, 10.3] },
  { env: 'Open lab', field: 'square180', dir: 'ccw', points: 30, max: 30, time: 50.18, laps: [15.4, 15.2, 16.8] },
  { env: 'Open lab', field: 'square180', dir: 'cw', points: 30, max: 30, time: 50.28, laps: [15.4, 15.2, 17.0] },
  { env: 'Open lab', field: 'rect100x180', dir: 'ccw', points: 30, max: 30, time: 40.58, laps: [12.8, 12.4, 13.2] },
  { env: 'Open lab', field: 'rect100x180', dir: 'cw', points: 30, max: 30, time: 40.58, laps: [12.8, 12.4, 13.2] },
  { env: 'Open lab', field: 'rect180x100', dir: 'ccw', points: 30, max: 30, time: 42.28, laps: [13.0, 12.4, 14.2] },
  { env: 'Open lab', field: 'rect180x100', dir: 'cw', points: 30, max: 30, time: 42.28, laps: [13.0, 12.5, 14.1] },
  { env: 'Open lab', field: 'shift140', dir: 'ccw', points: 30, max: 30, time: 40.58, laps: [12.8, 12.4, 13.3] },
  { env: 'Open lab', field: 'shift140', dir: 'cw', points: 30, max: 30, time: 42.08, laps: [12.8, 12.4, 14.2] },
  { env: 'Open lab', field: 'east140x100', dir: 'ccw', points: 30, max: 30, time: 36.78, laps: [11.7, 11.2, 11.6] },
  { env: 'Open lab', field: 'east140x100', dir: 'cw', points: 30, max: 30, time: 38.28, laps: [11.7, 11.1, 12.8] },
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
