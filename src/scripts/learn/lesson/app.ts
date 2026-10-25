// The interactive lesson page: instructions on the right, the code editor and the terminal on the left and, when the
// task has a car, the 3D view on top. Each task is checked for real: the course's tests in Python (Pyodide), the
// commands typed in the terminal, or a run of the student's drive.py in the mini simulator drawn in 3D.
import { findLesson } from './lessons';
import { createEditor, type EditorFile } from './editor';
import { createTerminal } from './terminal';
import { createShell, type ShellState } from './shell';
import { createLessonSim, type Outcome } from './sim';
import * as PY from './python';
import type { CommandEvent, Lesson, Metrics, Task, World } from './types';

interface Saved {
  files: Record<string, string>;
  done: string[];
  fails: Record<string, number>;
  seeded: string[];
  current: number;
  shell?: ShellState;
}

const $ = <T extends HTMLElement>(root: ParentNode, sel: string) => root.querySelector(sel) as T;
const FREE_WORLD: World = { field: 'field', start: [0, -1.0, 0], view: 'chase', trail: false };

export async function startLesson(root: HTMLElement) {
  const guide = root.dataset.guide ?? 'open-strategy';
  const lesson = findLesson(guide, Number(root.dataset.step));
  if (!lesson) return;
  const key = `learn-lesson-${guide}-${lesson.step}`;
  const saved: Saved = { files: {}, done: [], fails: {}, seeded: [], current: 0, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
  const save = () => localStorage.setItem(key, JSON.stringify({ ...saved, shell }));

  // ---------------------------------------------------------------- the pieces of the page
  const els = {
    list: $(root, '[data-l="tasks"]'),
    card: $(root, '[data-l="card"]'),
    title: $(root, '[data-l="task-title"]'),
    body: $(root, '[data-l="task-body"]'),
    choice: $(root, '[data-l="choice"]'),
    actions: $(root, '[data-l="actions"]'),
    feedback: $(root, '[data-l="feedback"]'),
    hint: $(root, '[data-l="hint"]'),
    progressText: $(root, '[data-l="progress-text"]'),
    progressBar: $(root, '[data-l="progress-bar"]'),
    simPanel: $(root, '[data-l="sim"]'),
    simStatus: $(root, '[data-l="sim-status"]'),
    banner: $(root, '[data-l="banner"]'),
    editorPanel: $(root, '[data-l="editor-panel"]'),
    editorEmpty: $(root, '[data-l="editor-empty"]'),
    finish: $(root, '[data-l="finish"]'),
  };

  const shell: ShellState = saved.shell ?? (lesson.fresh
    ? { cwd: '', cloned: false, rosSourced: false, built: false, wsSourced: false, pkgCreated: false, pkgBuilt: false }
    : { cwd: 'robotek-learn', cloned: true, rosSourced: true, built: true, wsSourced: true, pkgCreated: true, pkgBuilt: true });

  // Files: the student's saved text, else the starter, else the course's reference (with its gaps cut out).
  const files: EditorFile[] = await Promise.all(lesson.files.map(async (f) => {
    let text = saved.files[f.name];
    if (text === undefined) {
      text = f.starter ?? (f.ref ? await PY.referenceModule(f.ref) : '');
      for (const [cut, todo] of f.gaps ?? []) text = text.replace(cut, todo);
    }
    return { name: f.name, text, readonly: f.readonly, note: f.note };
  }));
  const fileText = () => Object.fromEntries(files.map((f) => [f.name, editor.get(f.name) ?? f.text]));

  const editor = createEditor($(root, '[data-l="editor"]'), {
    change(name, text) { if (!lesson.files.find((f) => f.name === name)?.readonly) { saved.files[name] = text; saveSoon(); } },
    save() { save(); term.write(`Guardado: ${editor.active}\n`, 'dim'); },
    run() { void primaryAction(); },
  });
  let saveTimer = 0;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = window.setTimeout(save, 400); };

  // eslint-disable-next-line prefer-const -- the terminal asks for the prompt before the shell exists
  let sh: ReturnType<typeof createShell> | null = null;
  const term = createTerminal($(root, '[data-l="terminal"]'), {
    prompt: () => sh?.prompt() ?? '$ ',
    run: (line) => sh!.run(line),
    complete: (word, first) => sh!.complete(word, first),
    interrupt: () => sim.stop(),
  });
  PY.setOutput((text) => term.write(text));

  const sim = createLessonSim($(root, '[data-lesson-sim]'));

  // ---------------------------------------------------------------- Python (loaded in the background)
  const status = (text: string) => { els.simStatus.textContent = text; };
  let pyReady: ReturnType<typeof PY.python> | null = null;
  const loadPython = () => {
    pyReady ??= (async () => {
      const py = await PY.ensurePackages(['pytest', ...(lesson.packages ?? [])], (t) => term.write(t + '\n', 'dim'));
      term.write('Python listo.\n', 'dim');
      return py;
    })();
    pyReady.catch((error) => { term.write(`No se pudo cargar Python: ${error}\n`, 'err'); pyReady = null; });
    return pyReady;
  };
  async function py() {
    const p = await loadPython();
    PY.writeFiles(p, fileText());
    return p;
  }

  // ---------------------------------------------------------------- the shell's host
  sh = createShell({
    term,
    state: shell,
    files: fileText,
    openFile(name) {
      if (!files.some((f) => f.name === name)) return false;
      editor.open(name);
      editor.focus();
      return true;
    },
    async compile() { return PY.compileAll(await py()); },
    async pytest(args) { return PY.pytest(await py(), args); },
    async python(code, filename) { return PY.runPython(await py(), code, filename); },
    async testSource(name) {
      const r = await fetch(`/learn/py/tests/${name}`);
      return r.ok ? r.text() : null;
    },
    runDrive,
    async launchSim() {
      showSim(true);
      await sim.show(FREE_WORLD);
      term.write('[gazebo] El campo del reto Open está en la vista 3D (arriba). El coche espera órdenes.\n', 'info');
      save();
    },
    async keyboardDrive() {
      showSim(true);
      const task = currentTask();
      if (task.check.kind === 'keyboard') { await attempt(task); return; }
      term.write('Conduce con W A S D en la vista 3D (haz clic en ella). Ctrl+C aquí para terminar.\n', 'info');
      await sim.drive(FREE_WORLD, { seconds: 600, done: () => false });
      term.write('keyboard_drive terminado.\n', 'dim');
    },
    async compareStep() {
      const mine = lesson.files.find((f) => !f.readonly && f.name !== 'drive.py');
      if (!mine?.name) { term.write('En este paso no hay un módulo tuyo que comparar.\n', 'info'); return; }
      const reference = await PY.referenceModule(mine.name.replace(/\.py$/, '')).catch(() => '');
      if (!reference) { term.write('No hay referencia para comparar.\n', 'info'); return; }
      const p = await py();
      p.globals.set('_a', editor.get(mine.name) ?? '');
      p.globals.set('_b', reference);
      p.globals.set('_n', mine.name);
      const diff = p.runPython(`import difflib\n''.join(difflib.unified_diff(_a.splitlines(True), _b.splitlines(True), 'tu ' + _n, 'referencia ' + _n))`) as string;
      term.write(diff || 'Tu archivo es igual a la referencia.\n', diff ? 'out' : 'ok');
    },
    interrupt() { sim.stop(); },
    command(e) { void onCommand(e); },
    save,
  });

  term.refresh();

  // ---------------------------------------------------------------- tasks
  const tasks = lesson.tasks;
  let viewing = Math.min(saved.current, tasks.length - 1);
  const firstOpen = () => { const i = tasks.findIndex((t) => !saved.done.includes(t.id)); return i < 0 ? tasks.length : i; };
  const currentTask = (): Task => tasks[Math.min(viewing, tasks.length - 1)];
  const isDone = (t: Task) => saved.done.includes(t.id);
  let running = false;

  function renderList() {
    const open = firstOpen();
    els.list.replaceChildren(...tasks.map((t, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lsn-step';
      b.dataset.state = isDone(t) ? 'done' : i === open ? 'open' : 'locked';
      b.setAttribute('aria-current', String(i === viewing));
      b.disabled = i > open;
      b.innerHTML = `<span class="lsn-dot">${isDone(t) ? '✓' : i + 1}</span><span>${t.title}</span>`;
      b.addEventListener('click', () => { viewing = i; renderTask(); });
      li.append(b);
      return li;
    }));
    const n = saved.done.length;
    els.progressText.textContent = `${n} de ${tasks.length}`;
    els.progressBar.style.width = `${(100 * n) / tasks.length}%`;
  }

  function button(label: string, cls: string, onClick: () => void) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `lsn-btn ${cls}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function setFeedback(kind: 'ok' | 'bad' | 'info' | '', html: string) {
    els.feedback.dataset.kind = kind;
    els.feedback.innerHTML = html;
    els.feedback.hidden = !html;
  }

  function renderTask() {
    const task = currentTask();
    const done = isDone(task);
    saved.current = viewing;
    save();
    renderList();
    els.finish.hidden = firstOpen() < tasks.length;
    els.title.textContent = task.title;
    els.body.innerHTML = task.body;
    els.choice.replaceChildren();
    els.choice.hidden = task.check.kind !== 'choice';
    els.hint.hidden = true;
    setFeedback('', '');

    // Files the task brings (its own drive.py), written the first time it is opened.
    if (task.files && !saved.seeded.includes(task.id) && !done) {
      for (const [name, text] of Object.entries(task.files)) { editor.set(name, text); saved.files[name] = text; }
      saved.seeded.push(task.id);
      save();
    }
    if (task.file) editor.open(task.file);

    const c = task.check;
    if (c.kind === 'choice') {
      const q = document.createElement('p');
      q.className = 'lsn-question';
      q.textContent = c.question;
      els.choice.append(q);
      c.options.forEach((option, i) => {
        const b = button(option, 'lsn-option', () => {
          if (isDone(task)) return;
          if (i === c.answer) {
            b.dataset.state = 'right';
            pass(task, c.why);
          } else {
            b.dataset.state = 'wrong';
            b.disabled = true;
            fail(task, 'No es esa. Piénsalo otra vez.');
          }
        });
        if (done && i === c.answer) b.dataset.state = 'right';
        els.choice.append(b);
      });
      if (done) setFeedback('ok', c.why);
    }

    els.actions.replaceChildren();
    if (c.kind === 'pytest' || c.kind === 'python') els.actions.append(button('Comprobar', 'lsn-primary', () => void primaryAction()));
    if (c.kind === 'sim') {
      els.actions.append(button('▶ Ejecutar en 3D', 'lsn-primary', () => void primaryAction()));
      els.actions.append(button('■ Detener', '', () => sim.stop()));
    }
    if (c.kind === 'keyboard') els.actions.append(button('Conducir', 'lsn-primary', () => void term.type('ros2 run robotek_course keyboard_drive')));
    if (c.kind === 'command') {
      const tip = document.createElement('p');
      tip.className = 'lsn-tip';
      tip.textContent = 'Escribe el comando en la terminal (abajo a la izquierda).';
      els.actions.append(tip);
    }
    if (done && firstOpen() > viewing && viewing < tasks.length - 1) els.actions.append(button('Siguiente →', 'lsn-next', () => { viewing = firstOpen(); renderTask(); }));
    if (done && c.kind !== 'choice') setFeedback('ok', 'Hecha. ✓');
    renderHelp(task);

    // The 3D view: shown for the tasks with a car, with their world waiting at the start.
    root.dataset.keyboard = String(c.kind === 'keyboard');
    if (c.kind === 'sim' || c.kind === 'keyboard') { showSim(true); void sim.show(c.world); }
    else if (!lesson.fresh && !sim.running) {
      // The world of the next 3D task waits there, so the student sees what the code is for.
      const next = tasks.slice(viewing).concat(tasks).map((t) => t.check).find((x) => x.kind === 'sim');
      showSim(!!next);
      if (next?.kind === 'sim') void sim.show(next.world);
    }
    syncEditorPanel();
  }

  function renderHelp(task: Task) {
    const fails = saved.fails[task.id] ?? 0;
    const parts: string[] = [];
    if (task.hint && fails >= 1) parts.push(`<p class="lsn-hint-title">Pista</p><pre>${escapeHtml(task.hint)}</pre>`);
    if (task.solution && fails >= 3) parts.push(`<p class="lsn-hint-title">Solución</p><pre>${escapeHtml(task.solution)}</pre>`);
    els.hint.innerHTML = parts.join('');
    els.hint.hidden = !parts.length;
  }
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function pass(task: Task, message: string) {
    if (!saved.done.includes(task.id)) saved.done.push(task.id);
    save();
    setFeedback('ok', `<strong>¡Bien!</strong> ${message}`);
    term.write(`✓ ${task.title}\n`, 'ok');
    renderList();
    els.actions.querySelector('.lsn-next')?.remove();
    const next = firstOpen();
    if (next < tasks.length) {
      els.actions.append(button('Siguiente →', 'lsn-next', () => { viewing = next; renderTask(); }));
      // Terminal tasks follow one another: the next one opens by itself while the student keeps typing.
      if (task.check.kind === 'command') {
        const from = tasks.indexOf(task);
        window.setTimeout(() => { if (viewing === from) { viewing = next; renderTask(); } }, 1100);
      }
    } else {
      els.finish.hidden = false;
    }
    root.dataset.celebrate = String(Date.now());
  }
  function fail(task: Task, message: string) {
    saved.fails[task.id] = (saved.fails[task.id] ?? 0) + 1;
    save();
    const n = saved.fails[task.id];
    const extra = task.hint && n === 1 ? ' Abajo tienes una pista.' : task.solution && n === 3 ? ' Ya puedes ver la solución abajo.' : '';
    setFeedback('bad', `${message}${extra}`);
    renderHelp(task);
  }

  // ---------------------------------------------------------------- checking
  async function primaryAction() {
    if (running) return;
    const task = tasks[viewing];
    const c = task.check;
    save();
    if (c.kind === 'pytest') {
      await term.type(`python3 -m pytest course/tests/${c.file}${c.k ? ` -k "${c.k}"` : ''} -q`);
    } else if (c.kind === 'python') {
      running = true;
      setFeedback('info', 'Comprobando…');
      term.write('Comprobando tu código…\n', 'dim');
      try {
        const code = await PY.runPython(await py(), c.code, '<comprobación>');
        if (code === 0) pass(task, 'Tu código hace lo que debe.');
        else fail(task, 'La comprobación falló: mira el mensaje en la terminal.');
      } finally { running = false; }
    } else if (c.kind === 'sim') {
      await term.type('ros2 run my_open drive');
    } else if (c.kind === 'keyboard') {
      await term.type('ros2 run robotek_course keyboard_drive');
    }
  }

  async function onCommand(e: CommandEvent) {
    const task = tasks[firstOpen()] as Task | undefined;
    if (!task) return;
    const c = task.check;
    if (c.kind === 'command' && c.match(e, shell, fileText())) {
      viewing = firstOpen();
      renderTask();
      pass(task, '');
    }
    if (c.kind === 'pytest' && e.argv.some((a) => a.endsWith(c.file))) {
      viewing = tasks.indexOf(task);
      if (e.ok) {
        const filtered = e.argv.includes('-k');
        const k = filtered ? e.argv[e.argv.indexOf('-k') + 1] : '';
        if (!c.k || !filtered || k === c.k) pass(task, 'Las pruebas pasan.');
        else setFeedback('info', `Pasan las pruebas que elegiste. Para esta tarea corre: -k "${c.k}" (o el archivo entero).`);
      } else {
        fail(task, 'Alguna prueba falla: lee el error en la terminal (la línea con «assert» dice qué esperaba).');
      }
    }
    if (lesson.fresh) syncEditorPanel();
    save();
  }

  /** ros2 run my_open drive: step 0 prints the template's greeting; later steps run the 3D task. */
  async function runDrive() {
    if (lesson.fresh) {
      await PY.runPython(await py(), (editor.get('drive.py') ?? '') + '\n', 'drive.py');
      return;
    }
    const task = tasks[viewing];
    const c = task.check;
    showSim(true);
    if (c.kind !== 'sim') {
      term.write('Esta tarea no usa el coche: tu drive.py corre libre 20 s (Ctrl+C para parar).\n', 'info');
      const world = lesson.tasks.map((t) => t.check).find((x) => x.kind === 'sim')?.world ?? FREE_WORLD;
      const outcome = await sim.run(await py(), world, { seconds: 20, done: () => false, passAtTimeout: () => true });
      report(outcome, null);
      return;
    }
    running = true;
    try {
      const p = await py();
      if (c.tests) {
        term.write(`Antes del coche, las pruebas: pytest course/tests/${c.tests.file}${c.tests.k ? ` -k "${c.tests.k}"` : ''}\n`, 'dim');
        const code = await PY.pytest(p, [`course/tests/${c.tests.file}`, ...(c.tests.k ? ['-k', c.tests.k] : []), '-q']);
        if (code !== 0) { fail(task, 'Primero tienen que pasar las pruebas de tu módulo (mira la terminal).'); return; }
      }
      setFeedback('info', 'El coche está corriendo tu código…');
      term.write('[my_open] drive.py arrancó (Ctrl+C para parar)\n', 'dim');
      els.banner.hidden = true;
      const outcome = await sim.run(p, c.world, c.goal, (m) => showMetrics(m));
      report(outcome, task);
    } finally {
      running = false;
    }
  }

  function showMetrics(m: Metrics) {
    const r = m.round;
    const c = (n: number, d: number) => n.toFixed(d).replace('.', ',');
    status(`t ${c(m.time, 1)} s · v ${c(m.speed, 2)} m/s · volante ${c(m.steer * 180 / Math.PI, 1)}° · giro ${c(m.turned * 180 / Math.PI, 0)}°`
      + (m.status ? ` · ${m.status}` : '') + (r ? ` · ${r.sections}/24 secciones` : ''));
  }

  function report(outcome: Outcome, task: Task | null) {
    if (outcome.error) {
      term.write(outcome.error.replaceAll(PY.PKG + '/', 'my_open/my_open/') + '\n', 'err');
      const m = [...outcome.error.matchAll(/my_open\/my_open\/(\w+\.py)", line (\d+)/g)].pop();
      if (m && files.some((f) => f.name === m[1])) editor.markError(m[1], Number(m[2]));
    }
    term.write(`${outcome.passed ? '✓' : '✗'} ${outcome.message}\n`, outcome.passed ? 'ok' : 'err');
    els.banner.hidden = false;
    els.banner.dataset.kind = outcome.passed ? 'ok' : 'bad';
    els.banner.textContent = outcome.passed ? `✓ ${outcome.message}` : `✗ ${outcome.message}`;
    if (!task) return;
    if (outcome.passed) pass(task, outcome.message);
    else if (outcome.message !== 'Detenido.') fail(task, outcome.message);
    else setFeedback('', '');
  }

  async function attempt(task: Task) {
    const c = task.check;
    if (c.kind !== 'keyboard') return;
    els.banner.hidden = true;
    setFeedback('info', 'Haz clic en la vista 3D y conduce con W A S D.');
    term.write('Conduce con W A S D en la vista 3D. Ctrl+C aquí para terminar.\n', 'info');
    const outcome = await sim.drive(c.world, c.goal, (m) => showMetrics(m));
    report(outcome, task);
  }

  // ---------------------------------------------------------------- layout helpers
  function showSim(on: boolean) {
    els.simPanel.hidden = !on;
    root.dataset.sim = String(on);
  }
  function syncEditorPanel() {
    const has = !lesson.fresh || shell.pkgCreated;
    els.editorEmpty.hidden = has;
    $(root, '[data-l="editor"]').hidden = !has;
  }
  $(root, '[data-l="reset-file"]').addEventListener('click', () => {
    const name = editor.active;
    const f = lesson.files.find((x) => x.name === name);
    if (!f || f.readonly || !confirm(`¿Volver ${name} a como empezaba? Perderás tus cambios en ese archivo.`)) return;
    const task = tasks.find((t) => t.files?.[name] && t === currentTask());
    const text = task?.files?.[name] ?? f.starter ?? '';
    editor.set(name, text);
    saved.files[name] = text;
    save();
  });
  $(root, '[data-l="view"]').addEventListener('click', () => {
    const c = currentTask().check;
    const world = c.kind === 'sim' || c.kind === 'keyboard' ? c.world : FREE_WORLD;
    world.view = world.view === 'top' ? 'chase' : 'top';
    void sim.show(world);
  });
  $(root, '[data-l="restart"]').addEventListener('click', () => {
    if (!confirm('¿Empezar la lección de cero? Se borra tu código y tu progreso de esta lección.')) return;
    localStorage.removeItem(key);
    location.reload();
  });

  // ---------------------------------------------------------------- start
  editor.setFiles(files, currentTask().file);
  showSim(!lesson.fresh && lesson.tasks.some((t) => t.check.kind === 'sim'));
  term.write(`Lección interactiva · Paso ${lesson.step}: ${lesson.title}\nEscribe  help  para ver los comandos.\n`, 'info');
  if (lesson.fresh && !shell.cloned) term.write('Esta terminal es tuya: empieza por la tarea 1 de la derecha.\n', 'info');
  viewing = Math.min(saved.current, firstOpen(), tasks.length - 1);
  renderTask();
  void loadPython();
  // For debugging in the browser console: the Python instance and the 3D view of this lesson.
  (window as unknown as { __lesson: unknown }).__lesson = { python: () => loadPython(), sim, lesson };
}
