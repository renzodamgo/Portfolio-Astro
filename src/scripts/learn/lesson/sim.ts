// The 3D view of a lesson: the course's simulator (Python in the worker: lesson_runtime.py for the Open,
// obstacle_runtime.py for the Obstacle) moves the car and this draws it with the guide's three.js engine. While
// Python thinks (the parking search) the car simply waits: the page keeps drawing. Also the keyboard mode of step 0,
// where the browser physics drives.
import { createSim } from '../car-sim/physics';
import { WALLS, STEER_LIMITS } from '../car-sim/constants';
import { createRound } from '../car-sim/round';
import type { Engine } from '../car-sim/engine';
import * as PY from './python';
import type { Box, Metrics, Sign, SimGoal, World } from './types';

export interface Outcome { passed: boolean; message: string; error?: string; metrics: Metrics }
export interface LessonSim {
  show(world: World): Promise<void>;
  /** Runs the student's code in the world until the goal passes, fails or `stop()`. */
  run(world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome>;
  /** Step 0: the student drives with the keyboard (WASD) until the goal passes or fails. */
  drive(world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome>;
  stop(): void;
  readonly running: boolean;
  focus(): void;
}

const OUTER = WALLS.slice(0, 4) as unknown as Box[];
/** The parking lot of the rules (obstacle_field.PARKING_LOT): the same place in both directions. */
export const LOT = { x0: 0.48 - 1.5 * 0.2333, x1: 0.48, y0: -1.5, y1: -1.3 };
const SIGN_HALF = 0.025;
const signBoxes = (signs: Sign[] = []): Box[] => signs.map((s) => [s.x, s.y, 2 * SIGN_HALF, 2 * SIGN_HALF] as Box);
const lotBoxes = (): Box[] => [[LOT.x0 - 0.01, -1.4, 0.02, 0.2], [LOT.x1 + 0.01, -1.4, 0.02, 0.2]];
const wallsOf = (world: World): Box[] => (world.field === 'floor' ? OUTER : [...WALLS] as unknown as Box[]);
/** Every box the drawn LiDAR and the keyboard car see. */
const boxesOf = (world: World): Box[] => [...wallsOf(world), ...(world.rocks ?? []), ...signBoxes(world.signs), ...(world.parking ? lotBoxes() : [])];
export const startOf = (world: World): [number, number, number] =>
  world.start ?? (world.direction === 'cw' ? [0.25, -1.0, Math.PI] : [-0.25, -1.0, 0]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** obstacle_lab.SideWatch: a sign passed on the wrong side (red must be passed on its right, green on its left). */
export function createSideWatch(signs: Sign[], direction: 'ccw' | 'cw') {
  const T = { bottom: [1, 0], right: [0, 1], top: [-1, 0], left: [0, -1] } as const;
  const k = direction === 'ccw' ? 1 : -1;
  const before = signs.map(() => false);
  return (x: number, y: number): Sign | null => {
    for (let i = 0; i < signs.length; i++) {
      const p = signs[i];
      const tx = T[p.side][0] * k, ty = T[p.side][1] * k;
      const horizontal = p.side === 'bottom' || p.side === 'top';
      const near = horizontal ? Math.abs(x - p.x) < 0.6 && y * Math.sign(p.y) >= 0.45 : Math.abs(y - p.y) < 0.6 && x * Math.sign(p.x) >= 0.45;
      if (!near) continue;
      const along = tx * (x - p.x) + ty * (y - p.y);
      if (along < 0) before[i] = true;
      else if (before[i]) {
        before[i] = false;
        const lateral = -ty * (x - p.x) + tx * (y - p.y);
        if ((lateral > 0) === (p.color === 'red')) return p;
      }
    }
    return null;
  };
}
const wrongSideMessage = (color: string) =>
  `Pasaste una señal ${color} por el lado equivocado (la roja se deja a la izquierda del coche, la verde a la derecha).`;

export function createLessonSim(root: HTMLElement): LessonSim {
  const sim = createSim();
  sim.setMaxSpeed(1.28);
  let engine: Engine | null = null;
  let loading: Promise<Engine> | null = null;
  let frame: ((dt: number) => void) | null = null;
  /** Ends the attempt in progress as 'Detenido' (null when nothing runs). */
  let abort: (() => void) | null = null;
  let last = 0;

  function ensureEngine() {
    loading ??= import('../car-sim/engine').then(({ startEngine }) => {
      engine = startEngine({
        root, sim, compact: false, autostart: true, assetBase: '/learn/assets/',
        onTick: () => {
          const now = performance.now();
          const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
          last = now;
          frame?.(dt);
        },
      });
      engine.setVisible(true);
      return engine;
    });
    return loading;
  }

  async function show(world: World) {
    const e = await ensureEngine();
    const start = startOf(world);
    sim.setWalls(boxesOf(world));
    e.setWorld({
      walls: wallsOf(world), rocks: world.rocks ?? [], marks: world.marks ?? [], signs: world.signs ?? [],
      lot: world.parking ? LOT : null, start: { x: start[0], y: start[1], yaw: start[2] },
    });
    e.setView(world.view ?? 'top');
    e.setTrail(world.trail ?? true);
    e.clearTrail();
    sim.setLocked(true);
    sim.setOverride(null);
    Object.assign(sim.state, { x: start[0], y: start[1], yaw: start[2], v: 0, steer: world.steer0 ?? 0, contacts: 0, time: 0, moved: false });
    sim.scan();
  }

  function newMetrics(world: World): Metrics {
    const [x, y, yaw] = startOf(world);
    return { time: 0, x, y, yaw, speed: 0, steer: 0, turned: 0, still: 0, distance: 0, status: '', parked: false, done: false, round: null, memo: {} };
  }

  function judge(goal: SimGoal, m: Metrics, crash: string, error: string): Outcome | null {
    if (error) return { passed: false, message: 'Tu código lanzó un error (mira la terminal).', error, metrics: m };
    if (crash) return { passed: false, message: crash, metrics: m };
    const reason = goal.fail?.(m);
    if (reason) return { passed: false, message: reason, metrics: m };
    if (goal.done(m)) return { passed: true, message: goal.success?.(m) ?? '¡Lo lograste!', metrics: m };
    if (m.time >= goal.seconds) {
      if (goal.passAtTimeout?.(m)) return { passed: true, message: goal.success?.(m) ?? '¡Lo lograste!', metrics: m };
      return { passed: false, message: `Se acabó el tiempo (${goal.seconds} s) sin cumplir el objetivo.`, metrics: m };
    }
    return null;
  }

  function update(m: Metrics, goal: SimGoal, x: number, y: number, yaw: number, speed: number, steer: number, time: number, dt: number) {
    m.distance += Math.hypot(x - m.x, y - m.y);
    m.turned += wrap(yaw - m.yaw);
    m.still = Math.abs(speed) < 0.02 ? m.still + dt : 0;
    Object.assign(m, { x, y, yaw, speed, steer, time });
    goal.track?.(m, dt);
  }

  async function run(world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome> {
    stop();
    await show(world);
    const obstacle = world.field === 'obstacle';
    const start = startOf(world);
    const m = newMetrics(world);
    let startError: string;
    try {
      startError = await PY.simStart(obstacle ? 'obstacle' : 'open', {
        walls: wallsOf(world), rocks: world.rocks ?? [], start, steer0: world.steer0 ?? 0, speed0: world.speed0 ?? 0,
        seed: world.seed ?? 0, camera: world.camera ?? null, realistic: world.realistic ?? true,
        signs: world.signs ?? [], parking: !!world.parking, direction: world.direction ?? 'ccw',
        ...(world.bias !== undefined ? { bias: world.bias } : {}),
      });
    } catch (error) {
      return { passed: false, message: 'El simulador no arrancó (mira la terminal).', error: String(error), metrics: m };
    }
    if (startError) return { passed: false, message: 'Tu código no se pudo cargar (mira la terminal).', error: startError, metrics: m };
    const round = goal.round ? createRound(goal.round) : null;
    let acc = 0;
    let inflight = false;
    let ended = false;
    return new Promise<Outcome>((resolve) => {
      const end = (o: Outcome) => {
        if (ended) return;
        ended = true;
        frame = null; abort = null;
        if (!inflight) void PY.simStop().catch(() => {});
        resolve(o);
      };
      abort = () => {
        // A long computation (the parking search) cannot be interrupted: throw the worker away.
        if (inflight) void PY.restart().catch(() => {});
        end({ passed: false, message: 'Detenido.', metrics: m });
      };
      last = 0;
      let since = 0;
      frame = (dt) => {
        acc = Math.min(acc + dt * (world.speedup ?? 1), 0.6);
        if (inflight) {
          // Python is still on the last step (the parking search can think for a minute): say so.
          const waiting = (performance.now() - since) / 1000;
          if (waiting > 1.5) { m.memo.thinking = waiting; onFrame?.(m); }
          return;
        }
        if (acc < 0.02) return;
        since = performance.now();
        delete m.memo.thinking;
        const seconds = Math.floor(acc / 0.02) * 0.02;
        acc -= seconds;
        inflight = true;
        PY.simAdvance(seconds).then((pose) => {
          inflight = false;
          if (ended || !pose) return;
          const [x, y, yaw, steer, speed, time, crashed, error, status, samples, wrong, parked, done] =
            pose as [number, number, number, number, number, number, boolean | string, string, string, number[][], string?, boolean?, boolean?];
          m.status = status;
          m.parked = !!parked;
          m.done = !!done;
          let outcome: Outcome | null = null;
          let previous = m.time;
          for (const [sx, sy, syaw, sv, st] of samples) {
            update(m, goal, sx, sy, syaw, sv, steer, st, st - previous);
            previous = st;
            if (round) {
              round.step({ x: sx, y: sy, yaw: syaw, v: sv, steer, wheelSpin: 0, contacts: 0, time: st, moved: true, clock: st });
              m.round = round.snapshot();
            }
            outcome = judge(goal, m, '', '');
            if (outcome) break;
          }
          if (!outcome) {
            update(m, goal, x, y, yaw, speed, steer, time, 0);
            const crash = crashed
              ? `Chocaste${typeof crashed === 'string' ? ` con ${crashed}` : ''}. Corrige el código y vuelve a intentarlo.` : '';
            outcome = wrong ? { passed: false, message: wrongSideMessage(wrong), metrics: m } : judge(goal, m, crash, error);
          }
          Object.assign(sim.state, { x: m.x, y: m.y, yaw: m.yaw, v: m.speed, steer, time: m.time });
          if (crashed) sim.state.contacts = 1;
          sim.scan();
          onFrame?.(m);
          if (outcome) end(outcome);
        }).catch((error) => {
          inflight = false;
          const stopped = String(error?.message) === 'Detenido.';
          end({ passed: false, message: stopped ? 'Detenido.' : 'El simulador falló (mira la terminal).', error: stopped ? undefined : String(error), metrics: m });
        });
      };
    });
  }

  async function drive(world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome> {
    stop();
    await show(world);
    const start = startOf(world);
    sim.setStartYaw(start[2]);
    sim.reset();
    Object.assign(sim.state, { x: start[0], y: start[1], yaw: start[2] });
    sim.setLocked(false);
    sim.setMaxSpeed(0.8);                     // gentler than the 1.28 m/s of the course's keyboard_drive
    if (sim.steerLimit !== STEER_LIMITS.real) sim.toggleSteerLimit();
    const m = newMetrics(world);
    const sides = world.signs?.length ? createSideWatch(world.signs, world.direction ?? 'ccw') : null;
    return new Promise<Outcome>((resolve) => {
      const end = (o: Outcome) => { frame = null; abort = null; sim.setLocked(true); resolve(o); };
      abort = () => end({ passed: false, message: 'Detenido.', metrics: m });
      last = 0;
      frame = (dt) => {
        const s = sim.state;
        update(m, goal, s.x, s.y, s.yaw, s.v, s.steer, m.time + (s.moved ? dt : 0), dt);
        onFrame?.(m);
        const wrong = sides?.(s.x, s.y);
        const o = wrong ? { passed: false, message: wrongSideMessage(wrong.color === 'red' ? 'roja' : 'verde'), metrics: m }
          : judge(goal, m, s.contacts > 0 ? 'Chocaste. Vuelve a escribir el comando y prueba más despacio en las curvas.' : '', '');
        if (o) end(o);
      };
      root.querySelector<HTMLElement>('.cs-viewport')?.focus({ preventScroll: true });
    });
  }

  function stop() {
    abort?.();
  }

  return {
    show, run, drive, stop,
    get running() { return abort !== null; },
    focus() { root.querySelector<HTMLElement>('.cs-viewport')?.focus({ preventScroll: true }); },
  };
}
