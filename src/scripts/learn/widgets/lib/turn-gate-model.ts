// Port of TurnGate (learn: src/my_open/my_open/turn_gate.py, tag step-6) and the scenes of the south corridor for the "turn-gate" widget.
// No DOM here, so it can be checked from the shell against the Python (see the notes at the end of the file).

export const TURN_FRONT = 1.19; // m: the wall ahead (along the track) must be this near
export const LOOKAHEAD = 0.35; // m: the island's end must be this near (when it is visible)
export const END_CLEARANCE = 0.08; // m: in a narrow lane the look-ahead shrinks to (distance to the island - this)
export const CONFIRMATIONS = 2; // consecutive scans that must see the island's end close
export const ARM_DISTANCE = 0.25; // m driven after a corner before the next one may start
export const ISLAND_OPEN = 1.0; // m: an island wall farther than this beside the car means the island has ended

/** What perceive() returns for one scan (the four numbers of the course's Scene, without `right`). Compared by identity, like in Python. */
export interface Scene {
  left: number;
  frontAxis: number;
  islandEnd: number;
}

/** Switches for the "Rómpelo" experiments. The defaults are the reference gate. */
export interface GateOptions {
  turnFront?: number;
  lookahead?: number;
  confirmations?: number;
  countEveryTick?: boolean; // `if True:` instead of `scene is not self._scene`
  ignoreArmed?: boolean; // the return without `self.armed and`
}

export class TurnGate {
  armed = true;
  hits = 0;
  private scene: Scene | null = null;
  private readonly turnFront: number;
  private readonly lookahead: number;
  private readonly confirmations: number;
  private readonly countEveryTick: boolean;
  private readonly ignoreArmed: boolean;

  constructor(o: GateOptions = {}) {
    this.turnFront = o.turnFront ?? TURN_FRONT;
    this.lookahead = o.lookahead ?? LOOKAHEAD;
    this.confirmations = o.confirmations ?? CONFIRMATIONS;
    this.countEveryTick = o.countEveryTick ?? false;
    this.ignoreArmed = o.ignoreArmed ?? false;
  }

  /** Returns true when the corner should start now. */
  update(scene: Scene, inner: number, travelled: number, arc: boolean): boolean {
    if (this.countEveryTick || scene !== this.scene) {
      // one count per scan, however often the tick repeats
      this.scene = scene;
      const limit = Number.isFinite(inner) ? Math.min(this.lookahead, Math.max(0, inner - END_CLEARANCE)) : this.lookahead;
      this.hits = scene.islandEnd >= 0 && scene.islandEnd <= limit ? this.hits + 1 : 0;
    }
    const seenAgain = Number.isFinite(inner) && inner < ISLAND_OPEN && travelled >= ARM_DISTANCE;
    this.armed = this.armed || (seenAgain && !arc);
    const islandOpen = Number.isFinite(inner) && inner > ISLAND_OPEN;
    return (
      (this.ignoreArmed || this.armed) && !arc && travelled >= ARM_DISTANCE && scene.frontAxis <= this.turnFront && (islandOpen || this.hits >= this.confirmations)
    );
  }

  /** Call it when the corner starts: the gate stays shut until the island is seen again. */
  cornerStarted(): void {
    this.armed = false;
  }
}

/** Every condition of the gate, computed from the current state (call it after update()). */
export interface Conditions {
  armed: boolean;
  travelled: number;
  travelledOk: boolean;
  frontAxis: number;
  frontOk: boolean;
  inner: number;
  islandOpen: boolean;
  limit: number;
  islandEnd: number;
  endNear: boolean; // this scan sees the island's end within the limit
  hits: number;
  hitsOk: boolean;
  ended: boolean; // island_open or enough confirmations
}

export function conditions(gate: TurnGate, o: Required<Pick<GateOptions, 'turnFront' | 'lookahead' | 'confirmations'>>, scene: Scene, inner: number, travelled: number, arc: boolean): Conditions {
  const limit = Number.isFinite(inner) ? Math.min(o.lookahead, Math.max(0, inner - END_CLEARANCE)) : o.lookahead;
  const islandOpen = Number.isFinite(inner) && inner > ISLAND_OPEN;
  const travelledOk = travelled >= ARM_DISTANCE;
  const frontOk = scene.frontAxis <= o.turnFront;
  const hitsOk = gate.hits >= o.confirmations;
  const ended = islandOpen || hitsOk;
  return {
    armed: gate.armed,
    travelled,
    travelledOk,
    frontAxis: scene.frontAxis,
    frontOk,
    inner,
    islandOpen,
    limit,
    islandEnd: scene.islandEnd,
    endNear: scene.islandEnd >= 0 && scene.islandEnd <= limit,
    hits: gate.hits,
    hitsOk,
    ended,
  };
}

// ------------------------------------------------------------------------------------------------ the south corridor
export const SCAN_STEP = 0.06; // m between scans: 0.6 m/s * 0.1 s (the LiDAR gives 10 scans per second)
export const TICKS_PER_SCAN = 5; // the control runs at 50 Hz
export const X_START = -1.14; // m: the car has just finished the previous corner here (travelled = 0)
export const GAPS = [0.25, 0.3, 0.43, 0.6]; // m between the car and the island wall
export const LIDAR_X = 0.128; // m ahead of base_link

/**
 * [left, front_axis, island_end] of perceive() for scan k (car at x = X_START + k * SCAN_STEP, y = -0.5 - gap, heading 0)
 * on the 3 x 3 m field with the 1 x 1 m island, from the course mini simulator's LiDAR without noise or dropouts.
 * Generated by the Python code of the course (my_open.perception.perceive at the tag step-6); Infinity is Python's inf.
 */
const SCENES: Record<string, number[][]> = {
  '0.25': [
    [2.262, 2.512, Infinity],
    [2.261, 2.452, Infinity],
    [2.258, 2.392, Infinity],
    [2.258, 2.332, Infinity],
    [2.256, 2.272, Infinity],
    [2.255, 2.212, Infinity],
    [2.252, 2.152, Infinity],
    [2.25, 2.092, Infinity],
    [0.777, 2.032, Infinity],
    [0.26, 1.972, Infinity],
    [0.255, 1.912, Infinity],
    [0.255, 1.852, Infinity],
    [0.255, 1.792, Infinity],
    [0.255, 1.732, Infinity],
    [0.255, 1.672, Infinity],
    [0.255, 1.612, Infinity],
    [0.255, 1.552, 0.667],
    [0.255, 1.492, 0.618],
    [0.255, 1.432, 0.55],
    [0.255, 1.372, 0.495],
    [0.255, 1.312, 0.433],
    [0.255, 1.252, 0.377],
    [0.255, 1.192, 0.316],
    [0.255, 1.132, 0.259],
    [0.255, 1.072, 0.2],
    [0.266, 1.012, 0.138],
    [2.252, 0.952, Infinity],
    [2.253, 0.892, Infinity],
    [2.253, 0.832, Infinity],
    [2.255, 0.772, Infinity],
    [2.257, 0.712, Infinity],
    [2.258, 0.652, Infinity],
    [2.259, 0.592, Infinity],
    [2.261, 0.532, Infinity],
    [2.258, 0.472, Infinity],
    [2.256, 0.412, Infinity],
    [2.254, 0.352, Infinity],
  ],
  '0.30': [
    [2.311, 2.512, Infinity],
    [2.31, 2.452, Infinity],
    [2.307, 2.392, Infinity],
    [2.306, 2.332, Infinity],
    [2.305, 2.272, Infinity],
    [2.304, 2.212, Infinity],
    [2.301, 2.152, Infinity],
    [2.3, 2.092, Infinity],
    [0.777, 2.032, Infinity],
    [0.315, 1.972, Infinity],
    [0.306, 1.912, Infinity],
    [0.306, 1.852, Infinity],
    [0.306, 1.792, Infinity],
    [0.306, 1.732, Infinity],
    [0.306, 1.672, 0.797],
    [0.306, 1.612, 0.734],
    [0.306, 1.552, 0.664],
    [0.306, 1.492, 0.62],
    [0.306, 1.432, 0.557],
    [0.306, 1.372, 0.494],
    [0.306, 1.312, 0.435],
    [0.306, 1.252, 0.379],
    [0.306, 1.192, 0.315],
    [0.306, 1.132, 0.257],
    [0.306, 1.072, 0.198],
    [2.302, 1.012, 0.137],
    [2.301, 0.952, Infinity],
    [2.302, 0.892, Infinity],
    [2.303, 0.832, Infinity],
    [2.304, 0.772, Infinity],
    [2.305, 0.712, Infinity],
    [2.307, 0.652, Infinity],
    [2.308, 0.592, Infinity],
    [2.31, 0.532, Infinity],
    [2.308, 0.472, Infinity],
    [2.305, 0.412, Infinity],
    [2.303, 0.352, Infinity],
  ],
  '0.43': [
    [2.438, 2.512, Infinity],
    [2.436, 2.452, Infinity],
    [2.434, 2.392, Infinity],
    [2.434, 2.332, Infinity],
    [2.433, 2.272, Infinity],
    [2.432, 2.212, Infinity],
    [2.431, 2.152, Infinity],
    [2.43, 2.092, Infinity],
    [0.777, 2.032, Infinity],
    [0.455, 1.972, 1.086],
    [0.439, 1.912, 1.025],
    [0.439, 1.852, 0.97],
    [0.439, 1.792, 0.897],
    [0.439, 1.732, 0.853],
    [0.439, 1.672, 0.795],
    [0.439, 1.612, 0.726],
    [0.439, 1.552, 0.667],
    [0.439, 1.492, 0.614],
    [0.439, 1.432, 0.557],
    [0.439, 1.372, 0.496],
    [0.439, 1.312, 0.435],
    [0.439, 1.252, 0.374],
    [0.439, 1.192, 0.319],
    [0.439, 1.132, 0.258],
    [0.442, 1.072, 0.195],
    [2.431, 1.012, 0.135],
    [2.43, 0.952, Infinity],
    [2.431, 0.892, Infinity],
    [2.431, 0.832, Infinity],
    [2.432, 0.772, Infinity],
    [2.434, 0.712, Infinity],
    [2.434, 0.652, Infinity],
    [2.435, 0.592, Infinity],
    [2.436, 0.532, Infinity],
    [2.438, 0.472, Infinity],
    [2.435, 0.412, Infinity],
    [2.434, 0.352, Infinity],
  ],
  '0.60': [
    [2.604, 2.512, Infinity],
    [2.603, 2.452, Infinity],
    [2.602, 2.392, Infinity],
    [2.601, 2.332, Infinity],
    [2.601, 2.272, Infinity],
    [2.601, 2.212, Infinity],
    [2.6, 2.152, Infinity],
    [2.6, 2.092, Infinity],
    [0.777, 2.032, Infinity],
    [0.64, 1.972, 1.085],
    [0.62, 1.912, 1.033],
    [0.612, 1.852, 0.963],
    [0.612, 1.792, 0.92],
    [0.612, 1.732, 0.842],
    [0.612, 1.672, 0.79],
    [0.612, 1.612, 0.726],
    [0.612, 1.552, 0.669],
    [0.612, 1.492, 0.616],
    [0.612, 1.432, 0.557],
    [0.612, 1.372, 0.492],
    [0.612, 1.312, 0.432],
    [0.612, 1.252, 0.377],
    [0.612, 1.192, 0.317],
    [0.612, 1.132, 0.253],
    [0.623, 1.072, 0.198],
    [2.488, 1.012, 0.138],
    [2.6, 0.952, Infinity],
    [2.6, 0.892, Infinity],
    [2.6, 0.832, Infinity],
    [2.601, 0.772, Infinity],
    [2.601, 0.712, Infinity],
    [2.602, 0.652, Infinity],
    [2.602, 0.592, Infinity],
    [2.603, 0.532, Infinity],
    [2.604, 0.472, Infinity],
    [2.605, 0.412, Infinity],
    [2.603, 0.352, Infinity],
  ],
};

export const SCAN_COUNT = SCENES['0.25'].length;
export const xOf = (k: number): number => Math.round((X_START + k * SCAN_STEP) * 100) / 100;

export interface TraceOptions {
  gap: number;
  startClosed: boolean; // corner_started() was just called (the real situation after a corner)
  lost: ReadonlySet<number>; // scans in which the island's end is not seen (island_end reads inf)
  gate?: GateOptions;
}

export interface Row {
  k: number;
  x: number;
  scene: Scene;
  inner: number;
  travelled: number;
  answers: boolean[]; // the gate's answer at each of the 5 ticks of this scan
  hitsBefore: number;
  conditions: Conditions; // after the last tick of this scan (or at the tick that fired)
  fired: boolean;
}

/** Feeds the gate scan after scan (5 ticks each, the same Scene object) until it fires or the scans end. */
export function trace(o: TraceOptions): Row[] {
  const table = SCENES[o.gap.toFixed(2)];
  if (!table) throw new Error(`no scenes for gap ${o.gap}`);
  const opts = { turnFront: o.gate?.turnFront ?? TURN_FRONT, lookahead: o.gate?.lookahead ?? LOOKAHEAD, confirmations: o.gate?.confirmations ?? CONFIRMATIONS };
  const gate = new TurnGate(o.gate);
  if (o.startClosed) gate.cornerStarted();
  const rows: Row[] = [];
  for (let k = 0; k < table.length; k++) {
    const [left, frontAxis, islandEnd] = table[k];
    const scene: Scene = { left, frontAxis, islandEnd: o.lost.has(k) ? Infinity : islandEnd };
    const x = xOf(k);
    const travelled = Math.round((x - X_START) * 1000) / 1000;
    const hitsBefore = gate.hits;
    const answers: boolean[] = [];
    let fired = false;
    for (let t = 0; t < TICKS_PER_SCAN; t++) {
      const a = gate.update(scene, left, travelled, false);
      answers.push(a);
      if (a) {
        fired = true;
        break;
      }
    }
    rows.push({ k, x, scene, inner: left, travelled, answers, hitsBefore, conditions: conditions(gate, opts, scene, left, travelled, false), fired });
    if (fired) break;
  }
  return rows;
}

// How this file was checked against the Python (tag step-6, my_open/turn_gate.py):
// * random sequences of update() calls (new or repeated scene objects, inf values, arc on and off) gave the same answer, hits and armed;
// * trace() fires at the same scan as the Python gate for every gap, with the end of the island lost at any scan and with each switch.
