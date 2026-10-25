// The 3D view of a lesson: the course's mini simulator (Python, lesson_runtime.py) moves the car and this draws it
// with the guide's three.js engine. Also the keyboard mode of step 0, where the browser physics drives.
import { createSim } from '../car-sim/physics';
import { WALLS, STEER_LIMITS } from '../car-sim/constants';
import { createRound } from '../car-sim/round';
import type { Engine } from '../car-sim/engine';
import type { Box, Metrics, SimGoal, World } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Pyodide = any;

export interface Outcome { passed: boolean; message: string; error?: string; metrics: Metrics }
export interface LessonSim {
  show(world: World): Promise<void>;
  /** Runs my_open/drive.py in the world until the goal passes, fails or `stop()`. */
  run(py: Pyodide, world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome>;
  /** Step 0: the student drives with the keyboard (WASD) until the goal passes or fails. */
  drive(world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome>;
  stop(): void;
  readonly running: boolean;
  focus(): void;
}

const OUTER = WALLS.slice(0, 4) as unknown as Box[];
const wallsOf = (world: World): Box[] => (world.field === 'field' ? [...WALLS] as unknown as Box[] : OUTER);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

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
    const walls = wallsOf(world);
    sim.setWalls([...walls, ...(world.rocks ?? [])]);
    e.setWorld({ walls, rocks: world.rocks ?? [], marks: world.marks ?? [], start: { x: world.start[0], y: world.start[1], yaw: world.start[2] } });
    e.setView(world.view ?? 'top');
    e.setTrail(world.trail ?? true);
    e.clearTrail();
    sim.setLocked(true);
    sim.setOverride(null);
    Object.assign(sim.state, { x: world.start[0], y: world.start[1], yaw: world.start[2], v: 0, steer: world.steer0 ?? 0, contacts: 0, time: 0, moved: false });
    sim.scan();
  }

  function newMetrics(world: World): Metrics {
    return { time: 0, x: world.start[0], y: world.start[1], yaw: world.start[2], speed: 0, steer: 0, turned: 0, still: 0, distance: 0, status: '', round: null, memo: {} };
  }

  function judge(goal: SimGoal, m: Metrics, crashed: boolean, error: string, crashMessage = 'Chocaste. Corrige el código y vuelve a intentarlo.'): Outcome | null {
    if (error) return { passed: false, message: 'Tu código lanzó un error (mira la terminal).', error, metrics: m };
    if (crashed) return { passed: false, message: crashMessage, metrics: m };
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

  async function run(py: Pyodide, world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome> {
    stop();
    await show(world);
    const runtime = py.pyimport('lesson_runtime');
    const pyWorld = py.toPy({
      walls: wallsOf(world), rocks: world.rocks ?? [], start: world.start, steer0: world.steer0 ?? 0, speed0: world.speed0 ?? 0,
      seed: world.seed ?? 0, camera: world.camera ?? null, realistic: world.realistic ?? true,
      ...(world.bias !== undefined ? { bias: world.bias } : {}),
    });
    const handle = runtime.Run(pyWorld);
    pyWorld.destroy();
    const m = newMetrics(world);
    const round = goal.round ? createRound(goal.round) : null;
    let acc = 0;
    const startError = String(handle.error ?? '');
    if (startError) {
      handle.destroy();
      return { passed: false, message: 'Tu código no se pudo cargar (mira la terminal).', error: startError, metrics: m };
    }
    return new Promise<Outcome>((resolve) => {
      const end = (o: Outcome) => {
        frame = null; abort = null;
        handle.destroy();
        resolve(o);
      };
      abort = () => end({ passed: false, message: 'Detenido.', metrics: m });
      last = 0;
      frame = (dt) => {
        acc += dt * (world.speedup ?? 1);
        const ticks = Math.floor(acc / 0.02);
        if (!ticks) return;
        acc -= ticks * 0.02;
        // Small chunks so the round judge and the goal see every few centimetres.
        let outcome: Outcome | null = null;
        for (let done = 0; done < ticks && !outcome; done += 2) {
          const n = Math.min(2, ticks - done);
          let pose: [number, number, number, number, number, number, boolean, string, string];
          try {
            const proxy = handle.advance(n * 0.02);
            pose = proxy.toJs();
            proxy.destroy();
          } catch (error) {
            end({ passed: false, message: 'El simulador falló (mira la terminal).', error: String(error), metrics: m });
            return;
          }
          const [x, y, yaw, steer, speed, time, crashed, error, status] = pose;
          update(m, goal, x, y, yaw, speed, steer, time, n * 0.02);
          m.status = status;
          if (round) {
            round.step({ x, y, yaw, v: speed, steer, wheelSpin: 0, contacts: crashed ? 1 : 0, time, moved: true, clock: time });
            m.round = round.snapshot();
          }
          Object.assign(sim.state, { x, y, yaw, v: speed, steer, time });
          if (crashed) sim.state.contacts = 1;
          outcome = judge(goal, m, crashed, error);
        }
        sim.scan();
        onFrame?.(m);
        if (outcome) end(outcome);
      };
    });
  }

  async function drive(world: World, goal: SimGoal, onFrame?: (m: Metrics) => void): Promise<Outcome> {
    stop();
    await show(world);
    sim.setStartYaw(world.start[2]);
    sim.reset();
    Object.assign(sim.state, { x: world.start[0], y: world.start[1], yaw: world.start[2] });
    sim.setLocked(false);
    sim.setMaxSpeed(0.8);                     // gentler than the 1.28 m/s of the course's keyboard_drive
    if (sim.steerLimit !== STEER_LIMITS.real) sim.toggleSteerLimit();
    const m = newMetrics(world);
    return new Promise<Outcome>((resolve) => {
      const end = (o: Outcome) => { frame = null; abort = null; sim.setLocked(true); resolve(o); };
      abort = () => end({ passed: false, message: 'Detenido.', metrics: m });
      last = 0;
      frame = (dt) => {
        const s = sim.state;
        update(m, goal, s.x, s.y, s.yaw, s.v, s.steer, m.time + (s.moved ? dt : 0), dt);
        onFrame?.(m);
        const o = judge(goal, m, s.contacts > 0, '', 'Chocaste. Vuelve a escribir el comando y prueba más despacio en las curvas.');
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
