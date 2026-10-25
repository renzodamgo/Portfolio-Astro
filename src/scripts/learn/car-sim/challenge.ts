// Manual challenge mode of the simulator (CarSim with the `challenge` prop): the Reto panel, the timer, laps,
// sections and crashes, the best round per direction and the finish card. The rules live in ./round.ts (pure);
// this file is only the glue with the DOM and the URL (?paso=N&dir=ccw|cw).
import { CHALLENGE_MAX_SPEED, MAX_SPEED, STEER_LIMITS } from './constants';
import type { CarState, Sim } from './physics';
import type { Direction } from './sections';
import {
  COURSE, createBandTracker, createRound, createTurnTracker, fmt, fmtSeconds, loadBest, plural,
  rangeAt, saveBest, scorePoints, turnRadius, type Best, type Round, type RoundEvent, type RoundResult,
} from './round';

type Readout = 'steer' | 'limit' | 'radius' | 'heading' | 'left' | 'right' | 'front' | 'gap' | 'band' | 'turn';
interface Preset {
  text: string;
  lidar: boolean;
  camera: boolean;
  readouts: Readout[];
  /** Step 4: the island gap with a green band. */
  band?: [number, number];
  /** Step 8: the direction is a surprise. */
  surprise?: boolean;
  /** Steps 7 and 9: tell how the round compares with the course code in the finish card. */
  compare?: 'round' | 'best';
}

const GUIDE = '/learn/open-strategy/';
// Slugs of the guide steps (src/content/learn/steps/open-strategy/paso-N-*.md), for the "Volver al paso" link.
const SLUGS: Record<number, string> = {
  1: 'paso-1-el-coche', 2: 'paso-2-el-rumbo', 3: 'paso-3-ver-el-campo', 4: 'paso-4-seguir-la-isla', 5: 'paso-5-la-esquina',
  6: 'paso-6-cuando-girar', 7: 'paso-7-la-mision', 8: 'paso-8-la-direccion', 9: 'paso-9-puntuar-y-medir',
};

const GENERIC: Preset = {
  text: 'Da 3 vueltas a la isla sin chocar y para donde empezaste. ¿Cuánto tardas?',
  lidar: true, camera: true, readouts: [],
};
const PRESETS: Record<number, Preset> = {
  1: { text: 'Pon el volante a tope y da un círculo. ¿Qué tan cerrado puedes girar? Prueba la tecla T (límite de la dirección) y mira el radio.',
    lidar: false, camera: false, readouts: ['steer', 'limit', 'radius'] },
  2: { text: 'Da 3 vueltas sin chocar y apunta tu tiempo. El código solo sabrá hacia dónde mira por el giroscopio; tú ves la pista entera.',
    lidar: false, camera: false, readouts: ['heading'] },
  3: { text: 'Conduce con la vista del LiDAR (tecla L) y fijándote en los números de la izquierda, la derecha y el frente. Eso es todo lo que sabrá el código.',
    lidar: true, camera: false, readouts: ['left', 'right', 'front'] },
  4: { text: 'Ve pegado a la isla, a 25 cm. ¿Cuánto tiempo aguantas sin acercarte ni alejarte más de 5 cm?',
    lidar: true, camera: false, readouts: ['gap', 'band'], band: [0.2, 0.3] },
  5: { text: 'Toma las 4 esquinas de una vuelta sin tocar la pared. El código solo gira cuando ya sabe que va a llegar.',
    lidar: true, camera: false, readouts: ['front', 'heading'] },
  6: { text: 'Gira cuando tú creas: mira el número de frente. ¿A qué distancia de la pared empiezas a girar? El código usa 1,19 m.',
    lidar: true, camera: false, readouts: ['front', 'turn'] },
  7: { text: 'Tres vueltas y parar donde empezaste. Tu tiempo contra el código: 34,8 s.',
    lidar: false, camera: false, readouts: [], compare: 'round' },
  8: { text: 'Ahora la dirección es sorpresa (aleatoria). El código no sabe hacia dónde mira el coche: solo ve las líneas de colores. Mira la cámara (tecla C), adivina el sentido y elígelo antes de arrancar.',
    lidar: false, camera: true, readouts: [], surprise: true },
  9: { text: 'Tu mejor ronda contra la del código: puntos primero, tiempo después.',
    lidar: false, camera: false, readouts: [], compare: 'best' },
};

/** Extra points of the step 8 challenge for guessing the direction: shown apart, never part of the judge's points. */
const GUESS_BONUS = 2;
const DIR_NAME: Record<Direction, string> = { ccw: 'antihorario', cw: 'horario' };

export interface ChallengeHost {
  root: HTMLElement;
  sim: Sim;
  onTick(callback: () => void): () => void;
  setOverlays(overlays: { lidar?: boolean; camera?: boolean }): void;
}

export function parseChallengeParams(search: string): { step: number | null; dir: Direction | null } {
  const params = new URLSearchParams(search);
  const raw = params.get('paso');
  const n = raw !== null && /^\d+$/.test(raw) ? Number(raw) : NaN;
  const dir = params.get('dir');
  return { step: n >= 1 && n <= 9 ? n : null, dir: dir === 'cw' || dir === 'ccw' ? dir : null };
}

/** Wires the panel inside `root`. Returns the function that undoes it. */
export function startChallenge(host: ChallengeHost): () => void {
  const { root, sim } = host;
  const q = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T | null;
  const el = (name: string) => q<HTMLElement>(`[data-csc="${name}"]`);
  const viewport = q<HTMLElement>('.cs-viewport');
  const finishCard = el('finish');
  if (!el('panel') || !viewport || !finishCard) return () => {};

  const { step: paso, dir: dirParam } = parseChallengeParams(location.search);
  const preset = (paso && PRESETS[paso]) || GENERIC;
  root.dataset.step = paso ? String(paso) : '';
  const randomDir = !!preset.surprise && !dirParam;
  let direction: Direction = dirParam ?? 'ccw';
  let directionKnown = !randomDir;
  let round: Round = createRound(direction);
  let band = createBandTracker(...(preset.band ?? [0, 0]));
  let turns = createTurnTracker();
  let bestRoundShown: Best | null = null;
  let guess: Direction | 'skip' | null = null; // step 8: what the student chose before moving

  // ---- static texts ----
  const set = (name: string, text: string) => { const n = el(name); if (n && n.textContent !== text) n.textContent = text; };
  set('title', paso ? `Reto del paso ${paso}` : 'Reto');
  set('text', preset.text);
  const back = el('back') as HTMLAnchorElement | null;
  if (back && paso) { back.href = `${GUIDE}${SLUGS[paso]}/`; back.textContent = `Volver al paso ${paso}`; back.hidden = false; }
  root.querySelectorAll<HTMLElement>('[data-read]').forEach((n) => { n.hidden = !preset.readouts.includes(n.dataset.read as Readout); });
  const gauge = el('gauge');
  if (gauge) gauge.hidden = !preset.band;
  const dirBox = el('dirbox');
  if (dirBox) dirBox.hidden = !!preset.surprise && !dirParam;
  host.setOverlays({ lidar: preset.lidar, camera: preset.camera });
  // Same top speed as the simulated real car, so the course time is a fair reference.
  sim.setMaxSpeed(CHALLENGE_MAX_SPEED);
  set('speed', `Velocidad máxima: ${fmt(CHALLENGE_MAX_SPEED)} m/s, como el coche real.`);

  const announce = (text: string) => { const n = el('live'); if (n) n.textContent = text; };

  // ---- one round ----
  function onEvent(event: RoundEvent) {
    if (event.type === 'lap') announce(`Vuelta ${event.lap} completa, ${fmtSeconds(event.time)}.`);
    else if (event.type === 'crash') announce(`Choque ${event.count}.`);
    else if (event.type === 'finish') finish(event.result);
  }

  // ---- step 8: guess the direction from the camera lines before the car can move ----
  const guessBox = el('guess');
  function setGuessState(choice: Direction | 'skip' | null) {
    guess = choice;
    const locked = !!preset.surprise && choice === null;
    sim.setLocked(locked);
    root.dataset.locked = String(locked);
    if (guessBox) guessBox.hidden = !preset.surprise;
    const msg = el('lockmsg');
    if (msg) msg.hidden = !locked;
    guessBox?.querySelectorAll<HTMLButtonElement>('[data-csc-guess]').forEach((b) => {
      const value = b.dataset.cscGuess;
      if (value !== 'skip') b.setAttribute('aria-pressed', String(value === choice));
      b.disabled = choice !== null;
    });
    set('guess-hint', choice === null
      ? 'Elige el sentido para poder arrancar. La cámara (tecla C) muestra lo único que ve el código.'
      : choice === 'skip' ? 'Saltaste la adivinanza: esta ronda no lleva bono.'
        : `Elegiste ${DIR_NAME[choice]}. Ya puedes arrancar.`);
  }
  guessBox?.querySelectorAll<HTMLButtonElement>('[data-csc-guess]').forEach((b) => {
    b.addEventListener('click', () => {
      const value = b.dataset.cscGuess;
      if (guess !== null || !preset.surprise) return;
      const choice = value === 'cw' || value === 'ccw' ? value : 'skip';
      setGuessState(choice);
      announce(choice === 'skip' ? 'Adivinanza saltada. Ya puedes arrancar.' : `Elegiste ${DIR_NAME[choice]}. Ya puedes arrancar.`);
      viewport.focus({ preventScroll: true });
    });
  });

  function newRound() {
    if (randomDir) direction = Math.random() < 0.5 ? 'ccw' : 'cw';
    directionKnown = !randomDir;
    sim.setStartYaw(direction === 'cw' ? Math.PI : 0);
    round = createRound(direction, onEvent);
    band = createBandTracker(...(preset.band ?? [0, 0]));
    turns = createTurnTracker();
    finishCard!.hidden = true;
    root.dataset.finished = 'false';
    setGuessState(null);
    refreshStatic();
    lastPaint = 0;
    paint();
  }

  function onStep(state: CarState) {
    round.step(state);
    if (preset.band && round.snapshot().started && !round.snapshot().finished) {
      band.update(rangeAt(sim.ranges, direction === 'ccw' ? Math.PI / 2 : -Math.PI / 2), 1 / 240);
    }
    if (preset.readouts.includes('turn')) turns.update(state.steer, sim.frontRange, state.v);
  }
  sim.setHooks({ step: onStep, reset: newRound });

  // ---- best round and finish card ----
  function bestText(best: Best | null) {
    return best ? `${plural(best.points, 'punto', 'puntos')} · ${fmtSeconds(best.time)}` : 'ninguna todavía';
  }
  function refreshStatic() {
    set('dirlabel', directionKnown ? `Sentido: ${DIR_NAME[direction]}` : 'Sentido: sorpresa');
    root.querySelectorAll<HTMLElement>('[data-csc-dir]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cscDir === direction)));
    if (directionKnown) {
      bestRoundShown = loadBest(direction);
      set('best', bestText(bestRoundShown));
    } else {
      bestRoundShown = null;
      set('best', 'se muestra al terminar');
    }
  }

  function courseLine() {
    return `El código del curso: ${COURSE.points} puntos en unos ${fmt(COURSE.gazeboTime)} s en Gazebo (${fmt(COURSE.labTime)} s en el laboratorio).`;
  }
  function versus(points: number, time: number) {
    if (points < COURSE.points) return `El código saca ${COURSE.points} puntos: a ti te faltan ${COURSE.points - points}.`;
    const diff = time - COURSE.gazeboTime;
    if (Math.abs(diff) < 0.05) return 'Empatas en tiempo con el código en Gazebo.';
    return diff < 0
      ? `Con los mismos puntos, vas ${fmt(-diff)} s más rápido que el código en Gazebo. Ojo: tú ves la pista entera.`
      : `Con los mismos puntos, vas ${fmt(diff)} s más lento que el código en Gazebo.`;
  }

  function finish(result: RoundResult) {
    const score = scorePoints(result.sections, result.stopped);
    directionKnown = true;
    const best: Best = { points: result.points, time: result.time, crashes: result.crashes };
    const record = saveBest(result.direction, best);
    refreshStatic();
    set('finish-line',
      `Tu ronda: ${plural(result.points, 'punto', 'puntos')} (secciones + vueltas + parada), ${fmtSeconds(result.time)}, ` +
      `${plural(result.crashes, 'choque', 'choques')}. ${courseLine()}`);
    const parts = [`${score.sections} secciones + ${score.laps} vueltas + ${score.stop} por ${result.stopped ? 'parar dentro de la salida' : 'no parar dentro de la salida'}.`];
    if (preset.surprise) {
      if (guess === 'skip' || guess === null) parts.unshift(`Saltaste la adivinanza; el sentido era ${DIR_NAME[result.direction]}.`);
      else if (guess === result.direction) parts.unshift(`Acertaste el sentido (era ${DIR_NAME[result.direction]}).`);
      else parts.unshift(`Fallaste el sentido (era ${DIR_NAME[result.direction]}).`);
      if (guess === result.direction) {
        parts.push(`Bono del reto por acertar: +${GUESS_BONUS}. Con el bono: ${plural(result.points + GUESS_BONUS, 'punto', 'puntos')} (el bono no es de la puntuación oficial ni cuenta en tu mejor ronda).`);
      }
    }
    if (record) parts.push('Es tu mejor ronda en este sentido.');
    if (preset.compare === 'round') parts.push(versus(result.points, result.time));
    if (preset.compare === 'best') {
      const mine = loadBest(result.direction) ?? best;
      parts.push(`Tu mejor ronda (${DIR_NAME[result.direction]}): ${bestText(mine)}. ${versus(mine.points, mine.time)}`);
      parts.push('Los puntos van primero; con los mismos puntos gana el menor tiempo.');
    }
    set('finish-extra', parts.join(' '));
    finishCard!.hidden = false;
    root.dataset.finished = 'true';
    announce(`Ronda terminada: ${plural(result.points, 'punto', 'puntos')} en ${fmtSeconds(result.time)}, ${plural(result.crashes, 'choque', 'choques')}.`);
    paint();
  }

  // ---- live numbers (about 12 times per second) ----
  const metres = (v: number | null) => (v === null ? '-' : `${fmt(v, 2)} m`);
  let lastPaint = 0;
  function paint() {
    const s = round.snapshot();
    set('time', fmtSeconds(s.elapsed));
    set('laps', `${s.laps}/3`);
    set('sections', `${s.sections}/24`);
    set('crashes', String(s.crashes));
    root.dataset.started = String(s.started);
    const state = sim.state;
    const has = (r: Readout) => preset.readouts.includes(r);
    if (has('steer')) set('steer', `${fmt((state.steer * 180) / Math.PI, 1)}°`);
    if (has('limit')) set('limit', `±${fmt((sim.steerLimit * 180) / Math.PI, 1)}° (${sim.steerLimit === STEER_LIMITS.real ? 'coche real' : 'regla de 25°'})`);
    if (has('radius')) {
      const r = turnRadius(state.steer);
      set('radius', r === null ? 'recto' : `${fmt(r, 2)} m`);
    }
    if (has('heading')) set('heading', `${fmt((s.heading * 180) / Math.PI, 0)}°`);
    if (has('left')) set('left', metres(rangeAt(sim.ranges, Math.PI / 2)));
    if (has('right')) set('right', metres(rangeAt(sim.ranges, -Math.PI / 2)));
    if (has('front')) set('front', Number.isFinite(sim.frontRange) && sim.frontRange < 11.9 ? metres(sim.frontRange) : '-');
    if (preset.band) {
      const gap = rangeAt(sim.ranges, direction === 'ccw' ? Math.PI / 2 : -Math.PI / 2);
      const inside = gap !== null && gap >= preset.band[0] && gap <= preset.band[1];
      set('gap', `${metres(gap)} ${gap === null ? '' : inside ? '(dentro)' : '(fuera)'}`.trim());
      const gapNode = el('gap');
      if (gapNode) gapNode.dataset.ok = String(inside);
      set('band', `${fmtSeconds(band.total)} (racha máxima ${fmtSeconds(band.best)})`);
      const marker = el('marker');
      if (marker) marker.style.left = `${gap === null ? 100 : Math.max(0, Math.min(1, gap / 0.6)) * 100}%`;
    }
    if (has('turn')) {
      set('turn', turns.last === null ? 'todavía no giraste'
        : `${metres(turns.last)} (media ${metres(turns.mean)}, ${plural(turns.count, 'giro', 'giros')})`);
    }
  }
  const offTick = host.onTick(() => {
    const now = performance.now();
    if (now - lastPaint < 80) return;
    lastPaint = now;
    paint();
  });

  // ---- buttons ----
  const restart = () => { sim.reset(); viewport.focus({ preventScroll: true }); };
  const cleanups: (() => void)[] = [];
  const listen = (node: Element | null, type: string, fn: (e: Event) => void) => {
    if (!node) return;
    node.addEventListener(type, fn);
    cleanups.push(() => node.removeEventListener(type, fn));
  };
  listen(el('reset'), 'click', restart);
  listen(el('again'), 'click', restart);
  root.querySelectorAll<HTMLElement>('[data-csc-dir]').forEach((b) => listen(b, 'click', () => {
    direction = b.dataset.cscDir === 'cw' ? 'cw' : 'ccw';
    const url = new URL(location.href);
    url.searchParams.set('dir', direction);
    history.replaceState(history.state, '', url);
    restart();
  }));

  // First round. Its reset also applies the start heading for the direction.
  sim.reset();

  return () => {
    offTick();
    cleanups.forEach((fn) => fn());
    sim.setHooks({});
    sim.setStartYaw(0);
    sim.setLocked(false);
    sim.setMaxSpeed(MAX_SPEED);
  };
}
