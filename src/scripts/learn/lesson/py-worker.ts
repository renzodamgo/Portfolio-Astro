// The lessons' Python, in a Web Worker so the page never freezes (the Obstacle parking search can think for many
// seconds). Pyodide from the CDN; the student's files live in a virtual home laid out like the course repository,
// so the course's own tests run unchanged:
//   ~/robotek-learn/src/<package>/<package>/*.py   the student's package (my_open or my_obstacle)
//   ~/robotek-learn/src/robotek_course, robotek_common    the course's simulator, base classes and car measures
//   ~/robotek-learn/course/tests[/obstacle]/*.py   the step tests (pytest)
/* eslint-disable @typescript-eslint/no-explicit-any */

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const HOME = '/home/robotek';
const REPO = `${HOME}/robotek-learn`;
const PY_BASE = '/learn/py/';

/** public/learn/py/<source> -> path in the virtual home. */
const FILES: [string, string][] = [
  ['robotek_course/__init__.py', `${REPO}/src/robotek_course/robotek_course/__init__.py`],
  ['robotek_course/minisim.py', `${REPO}/src/robotek_course/robotek_course/minisim.py`],
  ['robotek_course/obstacle_base.py', `${REPO}/src/robotek_course/robotek_course/obstacle_base.py`],
  ['robotek_course/obstacle_vision.py', `${REPO}/src/robotek_course/robotek_course/obstacle_vision.py`],
  ['robotek_common/__init__.py', `${REPO}/src/robotek_common/robotek_common/__init__.py`],
  ['robotek_common/vehicle.py', `${REPO}/src/robotek_common/robotek_common/vehicle.py`],
  ['robotek_common/lidar_odometry.py', `${REPO}/src/robotek_common/robotek_common/lidar_odometry.py`],
  ['lesson_runtime.py', `${HOME}/.lesson/lesson_runtime.py`],
  ['obstacle_runtime.py', `${HOME}/.lesson/obstacle_runtime.py`],
  ['tests/conftest.py', `${REPO}/course/tests/conftest.py`],
  ['tests/helpers.py', `${REPO}/course/tests/helpers.py`],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`tests/test_step_${n}.py`, `${REPO}/course/tests/test_step_${n}.py`] as [string, string]),
  ['obstacle/tests/conftest.py', `${REPO}/course/tests/obstacle/conftest.py`],
  ['obstacle/tests/fieldsim.py', `${REPO}/course/tests/obstacle/fieldsim.py`],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`obstacle/tests/test_obstacle_step_${n}.py`, `${REPO}/course/tests/obstacle/test_obstacle_step_${n}.py`] as [string, string]),
];
const PACKAGES = ['my_open', 'my_obstacle'];
const PURGE = `
import importlib, sys
for _name in [m for m in sys.modules if m.split('.')[0] in ('my_open', 'my_obstacle') or m.startswith('test_step_') or m.startswith('test_obstacle_step_')]:
    del sys.modules[_name]
importlib.invalidate_caches()
`;

let py: any = null;
let starting: Promise<any> | null = null;
const loaded = new Set<string>();
let run: any = null;           // the Run of the 3D attempt in progress
let quiet = false;             // installer chatter goes to the progress lines

const post = (msg: any) => (self as unknown as Worker).postMessage(msg);
const out = (text: string) => post({ type: quiet ? 'progress' : 'out', text });

async function fetchText(path: string) {
  const r = await fetch(PY_BASE + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}

async function start() {
  starting ??= (async () => {
    post({ type: 'progress', text: 'Descargando Python (Pyodide)…' });
    const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
    const p = await loadPyodide({ indexURL: PYODIDE_URL });
    p.setStdout({ batched: (s: string) => out(s + '\n') });
    p.setStderr({ batched: (s: string) => out(s + '\n') });
    post({ type: 'progress', text: 'Preparando el repositorio del curso…' });
    for (const dir of new Set(FILES.map(([, dst]) => dst.slice(0, dst.lastIndexOf('/'))))) p.FS.mkdirTree(dir);
    for (const pkg of PACKAGES) p.FS.mkdirTree(`${REPO}/src/${pkg}/${pkg}`);
    await Promise.all(FILES.map(async ([src, dst]) => p.FS.writeFile(dst, await fetchText(src))));
    const paths = [`${HOME}/.lesson`, ...PACKAGES.map((k) => `${REPO}/src/${k}`), `${REPO}/src/robotek_course`,
      `${REPO}/src/robotek_common`, `${REPO}/course/tests`];
    p.runPython(`
import os, sys
os.chdir(${JSON.stringify(REPO)})
for p in ${JSON.stringify(paths)}:
    if p not in sys.path:
        sys.path.insert(0, p)
`);
    py = p;
    return p;
  })();
  starting.catch(() => { starting = null; });
  return starting;
}

async function ensurePackages(names: string[]) {
  const p = await start();
  const missing = names.filter((n) => !loaded.has(n));
  if (!missing.length) return;
  post({ type: 'progress', text: `Instalando ${missing.join(', ')}…` });
  quiet = true;
  try {
    const native = missing.filter((n) => n !== 'pytest');
    if (native.length) await p.loadPackage(native, { messageCallback: () => {} });
    if (missing.includes('pytest')) {
      await p.loadPackage('micropip', { messageCallback: () => {} });
      await p.runPythonAsync(`import micropip\nawait micropip.install('pytest')`);
    }
  } finally {
    quiet = false;
  }
  missing.forEach((n) => loaded.add(n));
}

function writeFiles(pkg: string, files: Record<string, string>) {
  const dir = `${REPO}/src/${pkg}/${pkg}`;
  py.FS.mkdirTree(dir);
  if (!py.FS.analyzePath(`${dir}/__init__.py`).exists) py.FS.writeFile(`${dir}/__init__.py`, '');
  for (const [name, text] of Object.entries(files)) py.FS.writeFile(`${dir}/${name}`, text);
  py.runPython(PURGE);
}

const handlers: Record<string, (args: any) => any> = {
  async init({ packages }) { await ensurePackages(packages); return true; },
  async packages({ packages }) { await ensurePackages(packages); return true; },
  write({ pkg, files }) { writeFiles(pkg, files); return true; },
  compile({ pkg }) {
    return py.runPython(`
import py_compile, glob
_errors = []
for _f in sorted(glob.glob(${JSON.stringify(REPO)} + '/src/${pkg}/${pkg}/*.py')):
    try:
        py_compile.compile(_f, doraise=True)
    except py_compile.PyCompileError as e:
        _errors.append(str(e.msg).replace(${JSON.stringify(REPO + '/')}, ''))
'\\n'.join(_errors)
`);
  },
  async pytest({ args }) {
    py.globals.set('_pytest_args', py.toPy(args));
    return await py.runPythonAsync(`${PURGE}
import pytest
int(pytest.main(list(_pytest_args) + ['-p', 'no:cacheprovider', '--color=no']))
`);
  },
  async python({ code, filename }) {
    py.globals.set('_src', code);
    py.globals.set('_fname', filename);
    return await py.runPythonAsync(`${PURGE}
import traceback
_status = 0
try:
    exec(compile(_src, _fname, 'exec'), {'__name__': '__main__'})
except SystemExit as e:
    _status = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except Exception:
    traceback.print_exc()
    _status = 1
_status
`);
  },
  diff({ a, b, name }) {
    py.globals.set('_a', a);
    py.globals.set('_b', b);
    py.globals.set('_n', name);
    return py.runPython(`import difflib\n''.join(difflib.unified_diff(_a.splitlines(True), _b.splitlines(True), 'tu ' + _n, 'referencia ' + _n))`);
  },
  simStart({ kind, world }) {
    run?.destroy?.();
    const runtime = py.pyimport(kind === 'obstacle' ? 'obstacle_runtime' : 'lesson_runtime');
    const pyWorld = py.toPy(world);
    run = runtime.Run(pyWorld);
    pyWorld.destroy();
    runtime.destroy();
    return String(run.error ?? '');
  },
  simAdvance({ seconds }) {
    if (!run) return null;
    const proxy = run.advance(seconds);
    const pose = proxy.toJs();
    proxy.destroy();
    return pose;
  },
  simStop() { run?.destroy?.(); run = null; return true; },
};

self.onmessage = async (e: MessageEvent) => {
  const { id, op, args } = e.data;
  try {
    if (op !== 'init' && op !== 'packages') await start();
    const result = await handlers[op](args ?? {});
    post({ type: 'result', id, result });
  } catch (error) {
    post({ type: 'result', id, error: String((error as Error)?.message ?? error) });
  }
};
