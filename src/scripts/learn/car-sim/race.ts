// Race mode of the simulator (CarSim with `race="open"` or `race="obstacle"`, step 0 of the guides): pick a name, a
// Mii-style driver and a car colour, a 3-2-1 countdown, three laps against the clock with the lap on screen, and a
// final time to beat. Penalties: +2 s per crash, and in the Obstacle race +5 s per sign passed on the wrong side.
// The ranking lives in this browser (localStorage); "Copiar resultado" gives a text to send to the others.
import { CHALLENGE_MAX_SPEED, MAX_SPEED, type Pillar } from './constants';
import type { CarState, Sim } from './physics';
import type { Direction } from './sections';
import { createRound, fmtSeconds, LAPS, SECTIONS_PER_LAP, type Round } from './round';

export const CRASH_PENALTY = 2; // s
export const SIDE_PENALTY = 5; // s
const COUNTDOWN = ['3', '2', '1', '¡Ya!'];

export interface Look { car: string; skin: string; hair: string; shirt: string }
export const SWATCHES = {
  car: ['#662bb3', '#d8392b', '#2f6fd6', '#27ae60', '#f39c12', '#ff6fae', '#222222'],
  skin: ['#f6d7c3', '#f1c6a5', '#d9a07b', '#a8714f', '#6e4630'],
  hair: ['#1c1c1c', '#3b2a20', '#8a5a2b', '#e0b84f', '#c0392b', '#7d5fff', '#8e44ad', '#ff6fae'],
  shirt: ['#2f6fd6', '#d8392b', '#27ae60', '#f39c12', '#ffffff', '#111111', '#8e44ad', '#ff6fae'],
} as const;
const DEFAULT_LOOK: Look = { car: SWATCHES.car[0], skin: SWATCHES.skin[1], hair: SWATCHES.hair[1], shirt: SWATCHES.shirt[0] };

export interface Entry { name: string; total: number; time: number; crashes: number; wrong: number; look: Look; at: number }

/** Total of a race: the time plus the penalties. The ranking orders by it (lower is better). */
export function raceTotal(time: number, crashes: number, wrong: number): number {
  return time + CRASH_PENALTY * crashes + SIDE_PENALTY * wrong;
}

/** Wrong-side passes: the car's centre crosses a sign's line on the side its colour forbids (red: pass on the
 * right of the direction of travel, green: on the left). Same rule as the course judge, on the car's centre. */
export function createSideWatch(pillars: readonly Pillar[], direction: Direction) {
  const sign = direction === 'ccw' ? 1 : -1;
  const tangent: Record<Pillar['side'], [number, number]> = { bottom: [1, 0], right: [0, 1], top: [-1, 0], left: [0, -1] };
  const before = pillars.map(() => false);
  let wrong = 0;
  return {
    update(x: number, y: number): boolean {
      let fault = false;
      pillars.forEach((p, i) => {
        const horizontal = p.side === 'bottom' || p.side === 'top';
        const near = horizontal ? Math.abs(x - p.x) < 0.6 && y * Math.sign(p.y) >= 0.45
          : Math.abs(y - p.y) < 0.6 && x * Math.sign(p.x) >= 0.45;
        if (!near) return;
        const [tx, ty] = tangent[p.side].map((v) => v * sign) as [number, number];
        const along = tx * (x - p.x) + ty * (y - p.y);
        if (along < 0) { before[i] = true; return; }
        if (!before[i]) return;
        before[i] = false;
        const lateral = -ty * (x - p.x) + tx * (y - p.y); // + = left of the direction of travel
        if ((lateral > 0) === (p.color === 'red')) { wrong++; fault = true; }
      });
      return fault;
    },
    get wrong() { return wrong; },
  };
}

/** Laps and signs counted in both directions at once: the race goes whichever way the driver goes (a student who
 * turns the other way at the start still gets their laps). The direction with more section exits is the one driven. */
export function createTracker(pillars: readonly Pillar[], preferred: Direction) {
  const rounds: Record<Direction, Round> = { ccw: createRound('ccw'), cw: createRound('cw') };
  const watches = { ccw: createSideWatch(pillars, 'ccw'), cw: createSideWatch(pillars, 'cw') };
  const driven = (): Direction => {
    const a = rounds.ccw.snapshot().sections, b = rounds.cw.snapshot().sections;
    return a === b ? preferred : a > b ? 'ccw' : 'cw';
  };
  return {
    /** Returns true when a sign was just passed on the wrong side (in the direction of that crossing). */
    step(state: CarState): boolean {
      rounds.ccw.step(state);
      rounds.cw.step(state);
      const a = watches.ccw.update(state.x, state.y), b = watches.cw.update(state.x, state.y);
      return a || b;
    },
    get direction() { return driven(); },
    snapshot() { return rounds[driven()].snapshot(); },
    get wrong() { return watches[driven()].wrong; },
  };
}
type Tracker = ReturnType<typeof createTracker>;

export function rankingKey(field: string, direction: Direction) { return `robotek-race-v1-${field}-${direction}`; }
export function loadRanking(field: string, direction: Direction): Entry[] {
  try {
    const list = JSON.parse(localStorage.getItem(rankingKey(field, direction)) ?? '[]');
    return Array.isArray(list) ? list.filter((e) => Number.isFinite(e?.total) && typeof e?.name === 'string') : [];
  } catch { return []; }
}
/** Adds an entry, keeps the best 10. Returns the list and the entry's place (1-based, 0 when off the list). */
export function saveRanking(field: string, direction: Direction, entry: Entry): { list: Entry[]; place: number } {
  const list = [...loadRanking(field, direction), entry].sort((a, b) => a.total - b.total).slice(0, 10);
  try { localStorage.setItem(rankingKey(field, direction), JSON.stringify(list)); } catch { /* private mode */ }
  return { list, place: list.indexOf(entry) + 1 };
}

export interface RaceHost {
  root: HTMLElement;
  sim: Sim;
  onTick(callback: () => void): () => void;
}

export function startRace(host: RaceHost): () => void {
  const { root, sim } = host;
  const field = root.dataset.race === 'obstacle' ? 'obstacle' : 'open';
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
  const el = (name: string) => q<HTMLElement>(`[data-csr="${name}"]`);
  const viewport = q<HTMLElement>('.cs-viewport');
  if (!el('panel') || !viewport) return () => {};
  const set = (name: string, text: string) => { const n = el(name); if (n && n.textContent !== text) n.textContent = text; };
  const show = (name: string, on: boolean) => { const n = el(name); if (n) n.hidden = !on; };
  const announce = (text: string) => set('live', text);

  // ---- who drives: name, driver and car colour (kept in this browser) ----
  let look: Look = { ...DEFAULT_LOOK };
  let name = '';
  try {
    const saved = JSON.parse(localStorage.getItem('robotek-race-look') ?? 'null');
    if (saved && typeof saved === 'object') look = { ...look, ...saved };
    name = localStorage.getItem('robotek-race-name') ?? '';
  } catch { /* ignore */ }
  const pushLook = () => {
    const detail = { ...look, driver: true };
    (root as HTMLElement & { __carSimLook?: object }).__carSimLook = detail;
    root.dispatchEvent(new CustomEvent('carsim:look', { detail }));
    try { localStorage.setItem('robotek-race-look', JSON.stringify(look)); } catch { /* ignore */ }
  };
  const nameInput = q<HTMLInputElement>('[data-csr="name"]');
  if (nameInput) nameInput.value = name;
  root.querySelectorAll<HTMLElement>('[data-csr-swatches]').forEach((group) => {
    const part = group.dataset.csrSwatches as keyof Look;
    group.replaceChildren(...SWATCHES[part].map((color) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'csr-swatch';
      b.style.background = color;
      b.setAttribute('aria-label', `${part} ${color}`);
      b.setAttribute('aria-pressed', String(look[part] === color));
      b.addEventListener('click', () => {
        look = { ...look, [part]: color };
        group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        pushLook();
      });
      return b;
    }));
  });
  pushLook();

  // ---- direction ----
  let direction: Direction = 'ccw';
  const dirButtons = root.querySelectorAll<HTMLButtonElement>('[data-csr-dir]');
  dirButtons.forEach((b) => b.addEventListener('click', () => {
    direction = b.dataset.csrDir === 'cw' ? 'cw' : 'ccw';
    dirButtons.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    sim.setStartYaw(direction === 'cw' ? Math.PI : 0);
    sim.reset();
    renderRanking([], 0);
  }));

  // ---- the race ----
  type Phase = 'setup' | 'countdown' | 'racing' | 'done';
  let phase: Phase = 'setup';
  let tracker: Tracker = createTracker(sim.pillars, direction);
  let goClock: number | null = null;
  let finishClock: number | null = null;
  let lastCrashes = 0;
  let countdownTimer: number | null = null;
  sim.setMaxSpeed(CHALLENGE_MAX_SPEED);
  set('speed', field === 'obstacle'
    ? 'Rojo: pásalo por la derecha. Verde: por la izquierda. +2 s por choque, +5 s por señal mal pasada.'
    : '+2 s por cada choque. Velocidad máxima: 0,6 m/s, como el coche real.');
  show('wrong-stat', field === 'obstacle');

  function setPhase(next: Phase) {
    phase = next;
    root.dataset.racePhase = next;
    show('setup', next === 'setup');
    show('count', next === 'countdown');
    show('finish', next === 'done');
    sim.setLocked(next === 'setup' || next === 'countdown');
  }

  function begin() {
    name = (nameInput?.value ?? '').trim().slice(0, 20) || 'Piloto';
    try { localStorage.setItem('robotek-race-name', name); } catch { /* ignore */ }
    set('driver', name);
    sim.setStartYaw(direction === 'cw' ? Math.PI : 0);
    sim.reset();
    tracker = createTracker(sim.pillars, direction);
    goClock = finishClock = null;
    lastCrashes = 0;
    setPhase('countdown');
    let k = 0;
    set('count', COUNTDOWN[k]);
    if (countdownTimer !== null) clearInterval(countdownTimer);
    countdownTimer = window.setInterval(() => {
      k++;
      if (k < COUNTDOWN.length) {
        set('count', COUNTDOWN[k]);
        if (k === COUNTDOWN.length - 1) {
          goClock = sim.state.clock;
          setPhase('racing');
          show('count', true); // keep "¡Ya!" on screen for a moment
          announce('¡Ya!');
          viewport!.focus({ preventScroll: true });
        }
      } else {
        show('count', false);
        if (countdownTimer !== null) clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 800);
  }

  function onStep(state: CarState) {
    if (phase !== 'racing') return;
    if (tracker.step(state)) { announce('Señal mal pasada: +5 s'); flash('+5 s'); }
    const s = tracker.snapshot();
    if (s.crashes !== lastCrashes) { lastCrashes = s.crashes; flash('+2 s'); }
    if (s.sections >= LAPS * SECTIONS_PER_LAP) {
      finishClock = state.clock;
      finish();
    }
  }
  // The R key resets the car: during a race that abandons it (back to the setup card).
  sim.setHooks({ step: onStep, reset: () => { if (phase === 'racing') setPhase('setup'); } });

  let flashTimer: number | null = null;
  function flash(text: string) {
    set('penalty', text);
    show('penalty', true);
    if (flashTimer !== null) clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => show('penalty', false), 900);
  }

  function elapsed() {
    if (goClock === null) return 0;
    return (finishClock ?? sim.state.clock) - goClock;
  }

  function finish() {
    const time = elapsed();
    const s = tracker.snapshot();
    const wrong = tracker.wrong;
    direction = tracker.direction; // the way the driver actually went
    const total = raceTotal(time, s.crashes, wrong);
    const entry: Entry = { name, total, time, crashes: s.crashes, wrong, look: { ...look }, at: Date.now() };
    const { list, place } = saveRanking(field, direction, entry);
    setPhase('done');
    sim.setLocked(true);
    set('final', fmtSeconds(total));
    const parts = [`${fmtSeconds(time)} de carrera`];
    if (s.crashes) parts.push(`+${s.crashes * CRASH_PENALTY} s por ${s.crashes} ${s.crashes === 1 ? 'choque' : 'choques'}`);
    if (wrong) parts.push(`+${wrong * SIDE_PENALTY} s por ${wrong} ${wrong === 1 ? 'señal mal pasada' : 'señales mal pasadas'}`);
    set('breakdown', parts.join(' · '));
    set('place', place === 1 ? '¡Récord en este navegador!' : place ? `Puesto ${place} en este navegador.` : 'Fuera del top 10 de este navegador.');
    renderRanking(list, place);
    shareText = `🏁 ${name}: 3 vueltas en ${fmtSeconds(total)} en la carrera ${field === 'obstacle' ? 'Obstacle' : 'Open'} ` +
      `(${direction === 'ccw' ? 'antihorario' : 'horario'}) del simulador Robotek. ¿Me ganas? ${location.origin}${location.pathname}`;
    announce(`Carrera terminada: ${fmtSeconds(total)}.`);
  }

  function renderRanking(list: Entry[], place: number) {
    const ol = el('ranking');
    if (!ol) return;
    const rows = (list.length ? list : loadRanking(field, direction)).slice(0, 5);
    ol.replaceChildren(...rows.map((e, i) => {
      const li = document.createElement('li');
      if (i + 1 === place) li.dataset.mine = 'true';
      const chip = document.createElement('span');
      chip.className = 'csr-chip';
      chip.style.background = `linear-gradient(90deg, ${e.look?.car ?? '#888'} 50%, ${e.look?.shirt ?? '#888'} 50%)`;
      const who = document.createElement('span');
      who.className = 'csr-who';
      who.textContent = e.name;
      const t = document.createElement('span');
      t.className = 'csr-t';
      t.textContent = fmtSeconds(e.total);
      li.append(chip, who, t);
      return li;
    }));
    show('ranking-empty', rows.length === 0);
  }
  renderRanking([], 0);

  let shareText = '';
  const copy = el('copy');
  copy?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(shareText); set('copied', 'Copiado: pégalo en el chat del grupo.'); }
    catch { set('copied', shareText); }
  });
  el('start')?.addEventListener('click', begin);
  el('again')?.addEventListener('click', begin);
  el('change')?.addEventListener('click', () => { sim.reset(); setPhase('setup'); });

  // ---- live numbers ----
  const offTick = host.onTick(() => {
    const s = tracker.snapshot();
    const lap = Math.min(LAPS, Math.floor(s.sections / SECTIONS_PER_LAP) + 1);
    set('lap', phase === 'done' ? `${LAPS} de ${LAPS}` : `${lap} de ${LAPS}`);
    set('time', fmtSeconds(elapsed()));
    set('crashes', String(s.crashes));
    set('wrong', String(tracker.wrong));
    set('sections', `${Math.min(s.sections, LAPS * SECTIONS_PER_LAP)}/${LAPS * SECTIONS_PER_LAP}`);
  });

  setPhase('setup');
  sim.reset();

  return () => {
    offTick();
    if (countdownTimer !== null) clearInterval(countdownTimer);
    sim.setHooks({});
    sim.setLocked(false);
    sim.setStartYaw(0);
    sim.setMaxSpeed(MAX_SPEED);
  };
}
