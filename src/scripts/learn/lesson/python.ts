// The page's side of the lessons' Python: talks to py-worker.ts (Pyodide in a Web Worker). Every call is async and
// the page keeps drawing while Python thinks. `restart()` throws the worker away (Ctrl+C on a long computation).

export const HOME = '/home/robotek';
export const REPO = `${HOME}/robotek-learn`;
const PY_BASE = '/learn/py/';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();
let out: (text: string) => void = () => {};
let progress: (text: string) => void = () => {};
let packagesWanted: string[] = [];
let ready: Promise<void> | null = null;

/** Where print() and the tests write (the terminal), and the dim progress lines. */
export function setOutput(write: (text: string) => void, onProgress: (text: string) => void) {
  out = write;
  progress = onProgress;
}

function spawn() {
  worker = new Worker(new URL('./py-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data;
    if (msg.type === 'out') out(msg.text);
    else if (msg.type === 'progress') progress(msg.text);
    else if (msg.type === 'result') {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (!p) return;
      if (msg.error !== undefined) p.reject(new Error(msg.error));
      else p.resolve(msg.result);
    }
  };
  worker.onerror = (e) => { for (const p of pending.values()) p.reject(new Error(e.message || 'Python se detuvo')); pending.clear(); };
}

function call<T>(op: string, args?: unknown): Promise<T> {
  if (!worker) spawn();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    worker!.postMessage({ id, op, args });
  });
}

/** Starts Python with pytest and the lesson's packages (about 10 MB the first time; the browser caches it). */
export function start(packages: string[]) {
  packagesWanted = packages;
  ready ??= call<boolean>('init', { packages }).then(() => undefined);
  ready.catch(() => { ready = null; });
  return ready;
}

/** Throws the worker away and starts a fresh one (the student's files are written again on the next call). */
export function restart() {
  worker?.terminate();
  worker = null;
  for (const p of pending.values()) p.reject(new Error('Detenido.'));
  pending.clear();
  ready = null;
  return start(packagesWanted);
}

export const busy = () => pending.size > 0;

/** The reference module of an earlier step (the course's solution), e.g. 'heading' or 'obstacle/lane'. */
export async function referenceModule(name: string) {
  const r = await fetch(`${PY_BASE}${name.includes('/') ? name.replace('/', '/ref/') : `ref/${name}`}.py`);
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.text();
}

export const writeFiles = (pkg: string, files: Record<string, string>) => call<boolean>('write', { pkg, files });
/** Byte-compiles the package: the syntax errors `colcon build` would show ('' when it compiles). */
export const compileAll = (pkg: string) => call<string>('compile', { pkg });
/** Runs pytest like the terminal would; returns the exit code (0: all passed). */
export const pytest = (args: string[]) => call<number>('pytest', { args });
/** Runs a file or a snippet as `python3` would; returns the exit code. */
export const runPython = (code: string, filename = '<stdin>') => call<number>('python', { code, filename });
export const diff = (a: string, b: string, name: string) => call<string>('diff', { a, b, name });

/** The 3D attempt: start a Run of lesson_runtime (Open) or obstacle_runtime (Obstacle); '' or the load error. */
export const simStart = (kind: 'open' | 'obstacle', world: Record<string, unknown>) => call<string>('simStart', { kind, world });
/** Advance the attempt; the pose list of the runtime (see Run.advance). */
export const simAdvance = (seconds: number) => call<unknown[] | null>('simAdvance', { seconds });
export const simStop = () => call<boolean>('simStop');
