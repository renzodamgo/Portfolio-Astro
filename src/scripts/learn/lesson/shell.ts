// The lesson's shell: a small Ubuntu-like terminal over the course repository. Real Python (pytest, python3) runs in
// Pyodide; ROS commands are simulated just enough to follow the guide (source, colcon build, ros2 launch / run / pkg).
import type { Terminal } from './terminal';
import type { CommandEvent } from './types';

export interface ShellState {
  cwd: string;            // relative to ~ ('' is the home)
  cloned: boolean;        // ~/robotek-learn exists
  rosSourced: boolean;    // source /opt/ros/jazzy/setup.bash
  built: boolean;         // colcon build of the course packages
  wsSourced: boolean;     // source install/setup.bash
  pkgCreated: boolean;    // ros2 pkg create ... my_open
  pkgBuilt: boolean;      // my_open built after it was created
}

export interface ShellHost {
  term: Terminal;
  state: ShellState;
  /** The student's package files (name relative to my_open/my_open). */
  files(): Record<string, string>;
  openFile(name: string): boolean;
  /** Syntax check of the package ('' when it compiles). */
  compile(): Promise<string>;
  pytest(args: string[]): Promise<number>;
  python(code: string, filename: string): Promise<number>;
  testSource(name: string): Promise<string | null>;
  /** ros2 run my_open drive: the current 3D task (or the template's greeting in step 0). */
  runDrive(): Promise<void>;
  launchSim(rviz: boolean): Promise<void>;
  keyboardDrive(): Promise<void>;
  compareStep(): Promise<void>;
  interrupt(): void;
  command(e: CommandEvent): void;
  save(): void;
}

const COURSE_PACKAGES = ['robotek_common', 'robotek_course', 'robotek_description', 'robotek_evaluation', 'robotek_gazebo', 'robotek_hardware'];
const HELP = `Comandos de esta terminal (simulada, con Python de verdad):
  ls, cd, pwd, cat ARCHIVO, clear, echo
  source /opt/ros/jazzy/setup.bash    activa ROS 2 en esta terminal
  colcon build [--symlink-install] [--packages-select my_open]
  source install/setup.bash           activa lo que compilaste
  ros2 pkg list | grep robotek
  ros2 launch robotek_course sim.launch.py [rviz:=true]
  ros2 run robotek_course keyboard_drive
  ros2 pkg create --build-type ament_python my_open --node-name drive ...
  ros2 run my_open drive              corre tu código en el coche 3D
  python3 -m pytest course/tests/test_step_N.py [-k nombre]
  python3 ARCHIVO.py  |  python3 -c "print(1 + 1)"
  code ARCHIVO  (o nano)              abre el archivo en el editor
  bash tools/compare-step.sh N        compara tu código con la referencia
  Ctrl+C detiene lo que corre · Tab completa · flechas: historial`;

/** Splits a command line like a shell: quotes, but no variables or globs. */
export function splitArgs(line: string): string[] {
  const out: string[] = [];
  let cur = '', quote: string | null = null, has = false;
  for (const ch of line) {
    if (quote) { if (ch === quote) quote = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { quote = ch; has = true; continue; }
    if (/\s/.test(ch)) { if (cur || has) out.push(cur); cur = ''; has = false; continue; }
    cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}

export function createShell(host: ShellHost) {
  const { term, state } = host;
  const home = '~';
  const repoDirs = () => ['src', 'course', 'tools', ...(state.built ? ['build', 'install', 'log'] : [])];
  const srcDirs = () => [...COURSE_PACKAGES, ...(state.pkgCreated ? ['my_open'] : [])];

  function prompt() {
    const where = state.cwd ? `~/${state.cwd}` : '~';
    return `robotek@ubuntu:${where}$ `;
  }

  /** The children of a directory (names ending in / are directories), or null when it does not exist. */
  function list(path: string): string[] | null {
    const p = path.replace(/\/+$/, '');
    if (p === '') return [...(state.cloned ? ['robotek-learn/'] : [])];
    if (!state.cloned) return null;
    if (p === 'robotek-learn') return [...repoDirs().map((d) => d + '/'), 'README.md'];
    if (p === 'robotek-learn/src') return srcDirs().map((d) => d + '/');
    if (p === 'robotek-learn/course') return ['tests/', 'verify_step.py'];
    if (p === 'robotek-learn/course/tests') return ['conftest.py', 'helpers.py', ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `test_step_${n}.py`)];
    if (p === 'robotek-learn/tools') return ['install-ubuntu.sh', 'macos_env.sh', 'compare-step.sh', 'setup-pi.sh'];
    if (p === 'robotek-learn/install' && state.built) return [...COURSE_PACKAGES, ...(state.pkgBuilt ? ['my_open'] : [])].map((d) => d + '/').concat(['setup.bash']);
    if (p === 'robotek-learn/src/my_open' && state.pkgCreated) return ['LICENSE', 'package.xml', 'setup.py', 'setup.cfg', 'resource/', 'my_open/', 'test/'];
    if (p === 'robotek-learn/src/my_open/my_open' && state.pkgCreated) return Object.keys(host.files()).sort();
    if (p.startsWith('robotek-learn/src/') && COURSE_PACKAGES.includes(p.split('/')[2]) && p.split('/').length === 3) {
      return ['package.xml', p.endsWith('robotek_course') ? 'robotek_course/' : 'resource/'];
    }
    return null;
  }
  function resolve(arg: string): string {
    let parts = arg.startsWith('~') ? arg.slice(1).split('/') : arg.startsWith('/') ? ['__abs__', ...arg.split('/')] : [...(state.cwd ? state.cwd.split('/') : []), ...arg.split('/')];
    if (parts[0] === '__abs__') parts = arg.replace(/^\/home\/robotek\/?/, '').split('/');
    const out: string[] = [];
    for (const part of parts) {
      if (!part || part === '.') continue;
      if (part === '..') out.pop(); else out.push(part);
    }
    return out.join('/');
  }
  /** A file of the student's package from a path, or null. */
  function packageFile(path: string): string | null {
    const m = path.match(/^robotek-learn\/src\/my_open\/my_open\/([\w.]+\.py)$/);
    if (m && state.pkgCreated && m[1] in host.files()) return m[1];
    return null;
  }
  const inRepo = () => state.cwd === 'robotek-learn' || state.cwd.startsWith('robotek-learn/');

  async function cat(arg: string): Promise<boolean> {
    const path = resolve(arg);
    const own = packageFile(path);
    if (own) { term.write(host.files()[own].replace(/\n?$/, '\n')); return true; }
    const test = path.match(/^robotek-learn\/course\/tests\/(\w+\.py)$/);
    if (test) {
      const text = await host.testSource(test[1]);
      if (text) { term.write(text.replace(/\n?$/, '\n')); return true; }
    }
    if (path === 'robotek-learn/README.md') {
      term.write('# robotek-learn\nEl curso de estrategias para la WRO Future Engineers: ROS 2 Jazzy, Gazebo y Python.\nGuía: https://www.renzodamian.com/learn/open-strategy/\n');
      return true;
    }
    term.write(`cat: ${arg}: No existe el archivo o el directorio\n`, 'err');
    return false;
  }

  function needRos(name: string) {
    if (state.rosSourced) return true;
    term.write(`${name}: orden no encontrada\n`, 'err');
    term.write('Pista: activa ROS en esta terminal con  source /opt/ros/jazzy/setup.bash\n', 'info');
    return false;
  }

  async function colcon(args: string[]) {
    if (args[0] !== 'build') { term.write('uso: colcon build [--symlink-install] [--packages-select PAQUETE]\n', 'err'); return false; }
    if (!inRepo() || state.cwd !== 'robotek-learn') {
      term.write('WARNING: no se encontraron paquetes en este directorio. Compila desde la raíz del repositorio: cd ~/robotek-learn\n', 'err');
      return false;
    }
    if (!state.rosSourced) {
      term.write('CMake Error: Could not find a package configuration file provided by "ament_cmake"\n', 'err');
      term.write('Pista: primero  source /opt/ros/jazzy/setup.bash\n', 'info');
      return false;
    }
    const select = args.indexOf('--packages-select');
    const only = select >= 0 ? args.slice(select + 1).filter((a) => !a.startsWith('-')) : null;
    const packages = only ?? [...COURSE_PACKAGES, ...(state.pkgCreated ? ['my_open'] : [])];
    const unknown = packages.filter((p) => !COURSE_PACKAGES.includes(p) && !(p === 'my_open' && state.pkgCreated));
    if (unknown.length) { term.write(`colcon: paquete desconocido: ${unknown.join(', ')}\n`, 'err'); return false; }
    for (const p of packages) term.write(`Starting >>> ${p}\n`, 'dim');
    if (packages.includes('my_open')) {
      const errors = await host.compile();
      if (errors) {
        term.write(`--- stderr: my_open\n${errors}\n---\nFailed   <<< my_open\n`, 'err');
        term.write(`\nSummary: ${packages.length - 1} packages finished\n  1 package failed: my_open\n`, 'err');
        return false;
      }
    }
    for (const p of packages) term.write(`Finished <<< ${p} [${(0.4 + Math.random() * 1.5).toFixed(2)}s]\n`, 'dim');
    term.write(`\nSummary: ${packages.length} packages finished\n`, 'ok');
    state.built = true;
    if (packages.includes('my_open')) state.pkgBuilt = true;
    return true;
  }

  async function ros2(args: string[], pipeGrep: string | null): Promise<boolean> {
    if (!needRos('ros2')) return false;
    const [sub, ...rest] = args;
    if (sub === 'pkg' && rest[0] === 'list') {
      const pkgs = ['ament_index_python', 'geometry_msgs', 'rclpy', 'ros_gz_bridge', 'ros_gz_sim', 'rviz2', 'sensor_msgs', 'std_msgs',
        ...(state.wsSourced ? COURSE_PACKAGES : []), ...(state.wsSourced && state.pkgBuilt ? ['my_open'] : [])].sort();
      const shown = pipeGrep ? pkgs.filter((p) => p.includes(pipeGrep)) : pkgs;
      term.write(shown.join('\n') + (shown.length ? '\n' : ''));
      if (pipeGrep === 'robotek' && !state.wsSourced) term.write('(nada: falta  source install/setup.bash  tras compilar)\n', 'info');
      return shown.length > 0;
    }
    if (sub === 'pkg' && rest[0] === 'create') {
      if (state.cwd !== 'robotek-learn/src') {
        term.write('Crea el paquete dentro de src/:  cd ~/robotek-learn/src\n', 'err');
        return false;
      }
      const name = rest.find((a, i) => i > 0 && !a.startsWith('-') && !['ament_python', 'ament_cmake', 'drive', 'MIT'].includes(a) && !rest[i - 1].startsWith('--'));
      if (name !== 'my_open') { term.write('En el curso el paquete se llama my_open:  ros2 pkg create --build-type ament_python my_open --node-name drive\n', 'err'); return false; }
      if (!rest.includes('ament_python')) { term.write('Falta  --build-type ament_python  (el paquete es de Python)\n', 'err'); return false; }
      if (state.pkgCreated) { term.write('Aborted!\nThe directory already exists: ./my_open\n', 'err'); return false; }
      term.write(['going to create a new package', 'package name: my_open', 'destination directory: ~/robotek-learn/src',
        'package format: 3', 'build type: ament_python', 'node_name: drive',
        'creating folder ./my_open', 'creating ./my_open/package.xml', 'creating source folder', 'creating folder ./my_open/my_open',
        'creating ./my_open/setup.py', 'creating ./my_open/setup.cfg', 'creating folder ./my_open/resource',
        'creating ./my_open/resource/my_open', 'creating ./my_open/my_open/__init__.py', 'creating folder ./my_open/test',
        'creating ./my_open/my_open/drive.py'].join('\n') + '\n', 'dim');
      state.pkgCreated = true;
      return true;
    }
    if (sub === 'launch') {
      if (rest[0] !== 'robotek_course' || !rest[1]) { term.write('uso: ros2 launch robotek_course sim.launch.py\n', 'err'); return false; }
      if (!state.wsSourced) { term.write(`Package 'robotek_course' not found\nPista: compila y luego  source install/setup.bash\n`, 'err'); return false; }
      if (rest[1] !== 'sim.launch.py') { term.write(`En esta terminal web solo está  sim.launch.py  (round.launch.py corre en tu ordenador).\n`, 'err'); return false; }
      await host.launchSim(rest.includes('rviz:=true'));
      return true;
    }
    if (sub === 'run') {
      const [pkg, exe] = rest;
      if (pkg === 'robotek_course' && exe === 'keyboard_drive') {
        if (!state.wsSourced) { term.write(`Package 'robotek_course' not found\n`, 'err'); return false; }
        await host.keyboardDrive();
        return true;
      }
      if (pkg === 'my_open' && exe === 'drive') {
        if (!state.pkgCreated || !state.pkgBuilt || !state.wsSourced) {
          term.write(`Package 'my_open' not found\n`, 'err');
          term.write(!state.pkgCreated ? 'Pista: primero crea el paquete (ros2 pkg create ...)\n'
            : !state.pkgBuilt ? 'Pista: compílalo:  colcon build --packages-select my_open\n'
              : 'Pista: carga lo compilado:  source install/setup.bash\n', 'info');
          return false;
        }
        const errors = await host.compile();
        if (errors) { term.write(errors + '\n', 'err'); return false; }
        await host.runDrive();
        return true;
      }
      term.write(`No executable found (${pkg ?? ''} ${exe ?? ''})\n`, 'err');
      return false;
    }
    if (sub === 'topic' && rest[0] === 'list') {
      term.write('/cmd_vel_raw\n/imu\n/scan\n/camera/image_raw\n/parameter_events\n/rosout\n');
      return true;
    }
    term.write('Esta terminal web entiende: ros2 pkg list | create, ros2 launch, ros2 run, ros2 topic list\n', 'err');
    return false;
  }

  async function exec(argv: string[], pipeGrep: string | null): Promise<boolean> {
    const [cmd, ...args] = argv;
    switch (cmd) {
      case undefined: return true;
      case 'help': term.write(HELP + '\n', 'info'); return true;
      case 'clear': term.clear(); return true;
      case 'pwd': term.write(`/home/robotek${state.cwd ? '/' + state.cwd : ''}\n`); return true;
      case 'whoami': term.write('robotek\n'); return true;
      case 'echo': term.write(args.join(' ') + '\n'); return true;
      case 'ls': {
        const target = resolve(args.find((a) => !a.startsWith('-')) ?? '.');
        const items = list(target);
        if (!items) { term.write(`ls: no se puede acceder a '${args[0]}': No existe el archivo o el directorio\n`, 'err'); return false; }
        const shown = pipeGrep ? items.filter((i) => i.includes(pipeGrep)) : items;
        if (shown.length) term.write(shown.join('  ') + '\n');
        return true;
      }
      case 'cd': {
        const target = resolve(args[0] ?? home);
        if (!list(target)) { term.write(`cd: ${args[0]}: No existe el directorio\n`, 'err'); return false; }
        state.cwd = target;
        return true;
      }
      case 'cat': {
        if (!args.length) { term.write('uso: cat ARCHIVO\n', 'err'); return false; }
        let ok = true;
        for (const a of args) ok = (await cat(a)) && ok;
        return ok;
      }
      case 'git': {
        if (args[0] === 'clone') {
          if (state.cloned) { term.write("fatal: la ruta de destino 'robotek-learn' ya existe y no es un directorio vacío.\n", 'err'); return false; }
          term.write("Clonando en 'robotek-learn'...\nremote: Enumerating objects: 614, done.\nRecibiendo objetos: 100% (614/614), listo.\n", 'dim');
          state.cloned = true;
          return true;
        }
        if (!inRepo()) { term.write('fatal: no es un repositorio git\n', 'err'); return false; }
        if (args[0] === 'status') { term.write('En la rama main\nnada para hacer commit (src/my_open está en .gitignore: es tu código)\n'); return true; }
        if (args[0] === 'fetch') { term.write('Desde https://github.com/renzodamgo/robotek-learn\n * [nueva etiqueta] step-0 ... step-9\n', 'dim'); return true; }
        term.write('Esta terminal web entiende git clone, git status y git fetch --tags.\n', 'err');
        return false;
      }
      case 'sudo': {
        if (args[0] === 'apt' || args[0] === 'apt-get') { term.write('Leyendo lista de paquetes... Hecho\ngit ya está en su versión más reciente.\n', 'dim'); return true; }
        term.write('sudo: en esta terminal web solo hace falta para apt.\n', 'err');
        return false;
      }
      case 'bash': {
        const script = resolve(args[0] ?? '');
        if (script === 'robotek-learn/tools/install-ubuntu.sh') {
          term.write('Instalando ros-jazzy-desktop, ros-jazzy-ros-gz, rmw_cyclonedds, pytest y colcon...\n(en la web ya está todo instalado)\nListo. Abre una terminal nueva o haz: source /opt/ros/jazzy/setup.bash\n', 'dim');
          return true;
        }
        if (script === 'robotek-learn/tools/compare-step.sh') { await host.compareStep(); return true; }
        term.write(`bash: ${args[0] ?? ''}: no existe en esta terminal web\n`, 'err');
        return false;
      }
      case 'source': case '.': {
        const target = args[0] ?? '';
        if (/^\/opt\/ros\/jazzy\/setup\.(bash|zsh|sh)$/.test(target)) { state.rosSourced = true; return true; }
        const path = resolve(target);
        if (/^robotek-learn\/install\/setup\.(bash|zsh|sh)$/.test(path)) {
          if (!state.built) { term.write(`bash: ${target}: No existe el archivo o el directorio\nPista: primero compila con colcon build\n`, 'err'); return false; }
          if (!state.rosSourced) state.rosSourced = true; // install/setup.bash also chains /opt/ros
          state.wsSourced = true;
          return true;
        }
        if (/tools\/macos_env\.sh$/.test(path)) {
          term.write('Esta terminal es Ubuntu: usa  source /opt/ros/jazzy/setup.bash  (macos_env.sh es para tu Mac).\n', 'info');
          return false;
        }
        term.write(`bash: ${target}: No existe el archivo o el directorio\n`, 'err');
        return false;
      }
      case 'colcon': return colcon(args);
      case 'ros2': return ros2(args, pipeGrep);
      case 'pytest': return run_pytest(args);
      case 'python': case 'python3': {
        if (args[0] === '-m' && args[1] === 'pytest') return run_pytest(args.slice(2));
        if (args[0] === '-c') return (await host.python(args.slice(1).join(' '), '<string>')) === 0;
        if (!args[0]) { term.write('Escribe  python3 archivo.py  o  python3 -c "print(2 + 2)"  (aquí no hay intérprete interactivo).\n', 'info'); return false; }
        const path = resolve(args[0]);
        const own = packageFile(path);
        if (!own) { term.write(`python3: no se puede abrir '${args[0]}': No existe el archivo\n`, 'err'); return false; }
        return (await host.python(host.files()[own], own)) === 0;
      }
      case 'code': case 'nano': case 'vim': case 'vi': {
        const name = (args[0] ?? '').split('/').pop() ?? '';
        if (!host.openFile(name)) { term.write(`${cmd}: ${args[0] ?? ''}: en el editor solo están los archivos de my_open/my_open\n`, 'err'); return false; }
        term.write(`Abierto en el editor: ${name} (Ctrl+S guarda)\n`, 'info');
        return true;
      }
      default:
        term.write(`${cmd}: orden no encontrada. Escribe  help  para ver qué hay.\n`, 'err');
        return false;
    }
  }

  async function run_pytest(args: string[]): Promise<boolean> {
    if (!inRepo()) { term.write('Corre las pruebas desde el repositorio:  cd ~/robotek-learn\n', 'err'); return false; }
    host.save();
    const rel = state.cwd.replace(/^robotek-learn\/?/, '');
    const mapped = args.map((a) => (a.endsWith('.py') && rel ? `${rel}/${a}` : a));
    return (await host.pytest(mapped)) === 0;
  }

  async function run(line: string) {
    const trimmed = line.trim();
    let pipeGrep: string | null = null;
    let commandLine = trimmed;
    const pipe = trimmed.match(/^(.*?)\|\s*grep\s+(\S+)\s*$/);
    if (pipe) { commandLine = pipe[1].trim(); pipeGrep = pipe[2].replace(/^["']|["']$/g, ''); }
    // `a && b`: run in order, stop at the first failure
    const parts = commandLine.split(/\s*&&\s*/);
    for (const part of parts) {
      const argv = splitArgs(part);
      const ok = await exec(argv, parts.length === 1 ? pipeGrep : null);
      host.command({ line: part, argv, ok, grep: pipeGrep ?? '' });
      if (!ok) break;
    }
  }

  function complete(word: string, first: boolean): string[] {
    if (first) {
      return ['ls', 'cd', 'cat', 'clear', 'source', 'colcon', 'ros2', 'python3', 'pytest', 'code', 'bash', 'git', 'help', 'pwd']
        .filter((c) => c.startsWith(word));
    }
    const slash = word.lastIndexOf('/');
    const dir = slash >= 0 ? word.slice(0, slash + 1) : '';
    const base = word.slice(slash + 1);
    const items = list(resolve(dir || '.')) ?? [];
    const fixed = ['/opt/ros/jazzy/setup.bash', 'install/setup.bash', 'sim.launch.py', 'robotek_course', 'keyboard_drive', 'my_open', '--symlink-install', '--packages-select'];
    return [...items.filter((i) => i.startsWith(base)).map((i) => dir + i), ...fixed.filter((f) => f.startsWith(word))];
  }

  return { prompt, run, complete, interrupt: () => host.interrupt() };
}
