// Python in the browser (Pyodide, loaded from the CDN only on the lesson pages). The student's files live in a
// virtual home, laid out like the course repository, so the course's own tests run unchanged:
//   ~/robotek-learn/src/my_open/my_open/*.py      the student's package (and the modules of earlier steps)
//   ~/robotek-learn/src/robotek_course/...        the course's mini simulator
//   ~/robotek-learn/course/tests/*.py             the step tests (pytest)

const PYODIDE_VERSION = '314.0.7';
const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const HOME = '/home/robotek';
export const REPO = `${HOME}/robotek-learn`;
export const PKG = `${REPO}/src/my_open/my_open`;
const PY_BASE = '/learn/py/';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Pyodide = any;
declare global { interface Window { loadPyodide?: (opts: { indexURL: string }) => Promise<Pyodide> } }

let ready: Promise<Pyodide> | null = null;
let out: (text: string) => void = () => {};

/** Where print() and the tests write (the terminal). */
export function setOutput(write: (text: string) => void) { out = write; }

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`no se pudo cargar ${src}`));
    document.head.appendChild(s);
  });
}

async function fetchText(path: string) {
  const r = await fetch(PY_BASE + path);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.text();
}

/** Starts Python once (about 10 MB the first time; the browser caches it). */
export function python(progress: (text: string) => void = () => {}): Promise<Pyodide> {
  if (ready) return ready;
  ready = (async () => {
    progress('Descargando Python (Pyodide)…');
    if (!window.loadPyodide) await loadScript(`${PYODIDE_URL}pyodide.js`);
    const py = await window.loadPyodide!({ indexURL: PYODIDE_URL });
    py.setStdout({ batched: (s: string) => out(s + '\n') });
    py.setStderr({ batched: (s: string) => out(s + '\n') });
    progress('Preparando el repositorio del curso…');
    const files: [string, string][] = [
      ['robotek_course/__init__.py', `${REPO}/src/robotek_course/robotek_course/__init__.py`],
      ['robotek_course/minisim.py', `${REPO}/src/robotek_course/robotek_course/minisim.py`],
      ['lesson_runtime.py', `${HOME}/.lesson/lesson_runtime.py`],
      ['tests/conftest.py', `${REPO}/course/tests/conftest.py`],
      ['tests/helpers.py', `${REPO}/course/tests/helpers.py`],
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`tests/test_step_${n}.py`, `${REPO}/course/tests/test_step_${n}.py`] as [string, string]),
    ];
    for (const dir of [`${REPO}/src/robotek_course/robotek_course`, `${REPO}/course/tests`, PKG, `${HOME}/.lesson`]) {
      py.FS.mkdirTree(dir);
    }
    await Promise.all(files.map(async ([src, dst]) => py.FS.writeFile(dst, await fetchText(src))));
    py.FS.writeFile(`${PKG}/__init__.py`, '');
    py.runPython(`
import os, sys
os.chdir(${JSON.stringify(REPO)})
for p in (${JSON.stringify(`${HOME}/.lesson`)}, ${JSON.stringify(`${REPO}/src/my_open`)}, ${JSON.stringify(`${REPO}/src/robotek_course`)}, ${JSON.stringify(`${REPO}/course/tests`)}):
    if p not in sys.path:
        sys.path.insert(0, p)
`);
    return py;
  })();
  ready.catch(() => { ready = null; });
  return ready;
}

/** The reference module of an earlier step (the course's solution), e.g. 'heading'. */
export const referenceModule = (name: string) => fetchText(`ref/${name}.py`);

/** numpy and pytest are only fetched when a lesson needs them. */
const loaded = new Set<string>();
export async function ensurePackages(names: string[], progress: (text: string) => void = () => {}) {
  const py = await python(progress);
  const missing = names.filter((n) => !loaded.has(n));
  if (!missing.length) return py;
  progress(`Instalando ${missing.join(', ')}…`);
  const previous = out;
  out = (text) => progress(text.trimEnd());       // the installer's chatter goes to the dim progress lines
  try {
  const native = missing.filter((n) => n !== 'pytest');
  if (native.length) await py.loadPackage(native, { messageCallback: () => {} });
  if (missing.includes('pytest')) {
    await py.loadPackage('micropip', { messageCallback: () => {} });
    await py.runPythonAsync(`import micropip\nawait micropip.install('pytest')`);
  }
  } finally {
    out = previous;
  }
  missing.forEach((n) => loaded.add(n));
  return py;
}

/** Writes the student's files into the package (path relative to my_open/my_open). */
export function writeFiles(py: Pyodide, files: Record<string, string>) {
  for (const [name, text] of Object.entries(files)) py.FS.writeFile(`${PKG}/${name}`, text);
  py.runPython(`
import importlib, sys
for name in [m for m in sys.modules if m == 'my_open' or m.startswith('my_open.')]:
    del sys.modules[name]
importlib.invalidate_caches()
`);
}

/** Byte-compiles the package: the syntax errors `colcon build` would show. Returns '' when it compiles. */
export function compileAll(py: Pyodide): string {
  return py.runPython(`
import py_compile, glob, traceback
errors = []
for f in sorted(glob.glob(${JSON.stringify(`${PKG}/*.py`)})):
    try:
        py_compile.compile(f, doraise=True)
    except py_compile.PyCompileError as e:
        errors.append(str(e.msg).replace(${JSON.stringify(REPO + '/')}, ''))
'\\n'.join(errors)
`) as string;
}

/** Runs pytest like the terminal would; returns the exit code (0: all passed). */
export async function pytest(py: Pyodide, args: string[]): Promise<number> {
  py.globals.set('_pytest_args', py.toPy(args));
  return await py.runPythonAsync(`
import pytest, sys
for name in [m for m in sys.modules if m == 'my_open' or m.startswith('my_open.') or m.startswith('test_step_')]:
    del sys.modules[name]
int(pytest.main(list(_pytest_args) + ['-p', 'no:cacheprovider', '--color=no']))
`) as number;
}

/** Runs a file or a snippet as `python3` would; returns the exit code. */
export async function runPython(py: Pyodide, code: string, filename = '<stdin>'): Promise<number> {
  py.globals.set('_src', code);
  py.globals.set('_fname', filename);
  return await py.runPythonAsync(`
import traceback, sys
for name in [m for m in sys.modules if m == 'my_open' or m.startswith('my_open.')]:
    del sys.modules[name]
_status = 0
try:
    exec(compile(_src, _fname, 'exec'), {'__name__': '__main__'})
except SystemExit as e:
    _status = e.code if isinstance(e.code, int) else (0 if e.code is None else 1)
except Exception:
    traceback.print_exc()
    _status = 1
_status
`) as number;
}
