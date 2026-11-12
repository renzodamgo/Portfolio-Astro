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
  { env: 'Gazebo', field: '', dir: 'ccw', points: 30, max: 30, time: 35.56, laps: [11.4, 11.0, 11.0], margin: 17.7 },
  { env: 'Gazebo', field: '', dir: 'cw', points: 30, max: 30, time: 35.53, laps: [11.4, 11.0, 11.0], margin: 18.0 },
  { env: 'Open lab', field: 'square100', dir: 'ccw', points: 30, max: 30, time: 33.78, laps: [11.1, 10.6, 10.6] },
  { env: 'Open lab', field: 'square100', dir: 'cw', points: 30, max: 30, time: 33.78, laps: [11.1, 10.6, 10.5] },
  { env: 'Open lab', field: 'square180', dir: 'ccw', points: 30, max: 30, time: 51.38, laps: [16.6, 16.1, 16.4] },
  { env: 'Open lab', field: 'square180', dir: 'cw', points: 30, max: 30, time: 51.28, laps: [16.5, 16.2, 16.4] },
  { env: 'Open lab', field: 'rect100x180', dir: 'ccw', points: 30, max: 30, time: 41.98, laps: [13.6, 13.4, 13.4] },
  { env: 'Open lab', field: 'rect100x180', dir: 'cw', points: 30, max: 30, time: 41.98, laps: [13.6, 13.4, 13.4] },
  { env: 'Open lab', field: 'rect180x100', dir: 'ccw', points: 30, max: 30, time: 43.18, laps: [13.9, 13.4, 13.5] },
  { env: 'Open lab', field: 'rect180x100', dir: 'cw', points: 30, max: 30, time: 43.18, laps: [13.9, 13.4, 13.5] },
  { env: 'Open lab', field: 'shift140', dir: 'ccw', points: 30, max: 30, time: 42.08, laps: [13.7, 13.4, 13.4] },
  { env: 'Open lab', field: 'shift140', dir: 'cw', points: 30, max: 30, time: 42.78, laps: [13.6, 13.4, 13.6] },
  { env: 'Open lab', field: 'east140x100', dir: 'ccw', points: 30, max: 30, time: 37.78, laps: [12.4, 11.9, 12.0] },
  { env: 'Open lab', field: 'east140x100', dir: 'cw', points: 30, max: 30, time: 38.68, laps: [12.6, 11.9, 12.0] },
];

/** The report's own summary of the 12 Open lab rounds. */
export const OPEN_LAB_SUMMARY = { valid: 12, total: 12, meanTime: 41.82 };

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
