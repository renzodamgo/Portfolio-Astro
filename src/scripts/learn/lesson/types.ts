// The shape of an interactive lesson: files the student edits, and tiny tasks checked one by one.
import type { Box, LessonMark } from '../car-sim/engine';
import type { RoundSnapshot } from '../car-sim/round';
import type { ShellState } from './shell';

export type { Box, LessonMark };

/** A world for the 3D view and the mini simulator (sim frame: x forward/east, y left/north, metres, radians). */
/** A traffic sign of the Obstacle field (5 x 5 x 10 cm); `side` is the straight it stands on. */
export interface Sign { x: number; y: number; color: 'red' | 'green'; side: 'bottom' | 'right' | 'top' | 'left' }

export interface World {
  /** 'field': the Open field (outer walls and island); 'floor': only the outer walls; 'obstacle': the Obstacle
   * field of the rules (signs, optional parking lot), run by obstacle_runtime.py with the student's Strategy. */
  field: 'field' | 'floor' | 'obstacle';
  /** Obstacle: the signs, the lot and the direction of the round (the car starts on the start straight). */
  signs?: Sign[];
  parking?: boolean;
  direction?: 'ccw' | 'cw';
  rocks?: Box[];
  marks?: LessonMark[];
  /** Where the car starts; the Obstacle field puts it at the spawn of the rules when omitted. */
  start?: [number, number, number];
  steer0?: number;       // wheel angle at the start (rad), e.g. already on the circle
  speed0?: number;       // m/s at the start
  bias?: number;         // gyroscope bias (rad/s); the course's is 0.006
  camera?: 'ccw' | 'cw'; // the synthetic camera of the step 8 lesson
  seed?: number;
  view?: 'top' | 'chase';
  trail?: boolean;
  /** Seconds of sim time per second of real time (long rounds go faster). */
  speedup?: number;
  realistic?: boolean;
}

/** What the judge of a 3D task sees every frame. */
export interface Metrics {
  time: number; x: number; y: number; yaw: number; speed: number; steer: number;
  /** Heading change since the start, unwrapped (rad): +2*pi after one full circle to the left. */
  turned: number;
  /** Seconds the car has been standing still (|v| < 0.02 m/s). */
  still: number;
  /** Metres driven. */
  distance: number;
  status: string;
  /** Obstacle: the strategy says it is parked / done. */
  parked: boolean;
  done: boolean;
  round: RoundSnapshot | null;
  /** Free counters a task can keep (e.g. time inside a band). */
  memo: Record<string, number>;
}
export interface SimGoal {
  /** Sim seconds before the attempt counts as failed (unless `passAtTimeout`). */
  seconds: number;
  done(m: Metrics): boolean;
  /** A failure other than a crash (message), checked every frame. */
  fail?(m: Metrics): string | null;
  /** Per-frame bookkeeping in m.memo. */
  track?(m: Metrics, dt: number): void;
  /** When time runs out: pass if this returns true. */
  passAtTimeout?(m: Metrics): boolean;
  /** Feed the round judge (laps, points) in this direction. */
  round?: 'ccw' | 'cw';
  /** Shown when it passes. */
  success?(m: Metrics): string;
}

/** One command the student ran (`grep`: the pattern of a trailing `| grep`, or ''). */
export interface CommandEvent { line: string; argv: string[]; ok: boolean; grep: string }

export type Check =
  | { kind: 'command'; match(e: CommandEvent, state: ShellState, files: Record<string, string>): boolean }
  | { kind: 'pytest'; file: string; k?: string }
  /** A few asserts run in Python (when no course test isolates the piece). */
  | { kind: 'python'; code: string }
  | { kind: 'sim'; world: World; goal: SimGoal; tests?: { file: string; k?: string } }
  | { kind: 'keyboard'; world: World; goal: SimGoal }
  | { kind: 'choice'; question: string; options: string[]; answer: number; why: string };

export interface Task {
  id: string;
  title: string;
  /** HTML (Spanish). */
  body: string;
  hint?: string;
  /** Shown after 3 failed attempts (code or command). */
  solution?: string;
  /** The editor opens this file for the task. */
  file?: string;
  /** Files (re)written when the task starts for the first time, e.g. the drive.py of a 3D challenge. */
  files?: Record<string, string>;
  check: Check;
}

export interface LessonFile {
  name: string;
  /** Starting text. */
  starter?: string;
  /** Or the course's solution of an earlier step (public/learn/py/ref/<ref>.py), read-only. */
  ref?: string;
  readonly?: boolean;
  /** Exact pieces of the reference to cut out (each replaced by its TODO line): the gaps the student fills. */
  gaps?: [string, string][];
  note?: string;
}

export interface Lesson {
  /** The guide ('open-strategy' or 'obstacle-strategy') and the student's package. */
  guide?: string;
  package?: 'my_open' | 'my_obstacle';
  step: number;
  title: string;
  summary: string;
  /** The guide page of this step. */
  guideUrl: string;
  files: LessonFile[];
  /** Pyodide packages besides pytest (e.g. numpy). */
  packages?: string[];
  /** Step 0: the terminal starts from scratch (nothing sourced, no package yet). */
  fresh?: boolean;
  /** With `fresh`: what is already done (the Obstacle's step 0 starts with the repository cloned). */
  shellStart?: Partial<ShellState>;
  /** The world of `ros2 launch ... sim.launch.py` and of free keyboard driving (default: the Open field). */
  freeWorld?: World;
  tasks: Task[];
}
