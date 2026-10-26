// Widget "step-replay": replays a recorded trajectory of the car on the field (Three.js, lazy).
//   <div data-widget="step-replay" data-src="/learn/assets/replays/step-3.json"></div>
// Optional attributes: data-camera="follow" (start in the chase view), data-lidar="on" (start with the LiDAR fan),
// data-start="12.5" (start paused at 12.5 s) or data-start="event:3" (start paused at the third event of the file).
// The reader's choices (LiDAR, side measures, camera, speed) are remembered in localStorage and shared by every player.
// Keyboard (scene focused): Space plays or pauses, Left/Right move 1 s (Shift: 5 s), PageUp/PageDown the previous or next event.
// The file format is described in ../replay/format.ts. three.js, the STL meshes and the mat texture are only
// loaded once the widget is mounted (the loader mounts it near the viewport); the render loop pauses while the
// widget is off-screen or the tab is hidden.
import { button, fmt, guarded, h, nextId, rangeFill, reducedMotion, slider, toggle } from './lib/common';
import { latestAt, latestIndex, MAX_SECTION_POINTS, parseReplay, ReplayError, type Replay } from '../replay/format';
import type { CameraMode, ReplayScene } from '../replay/scene';
import { onThemeChange, scenePalette, trackColor } from '../theme-colors';

const ASSET_BASE = '/learn/assets/';
const SPEEDS = [0.25, 0.5, 1, 2, 4];
const PREFS_KEY = 'learn.replay.prefs';
const PREFS_EVENT = 'learn-replay-prefs';
const speedText = (v: number) => `${String(v).replace('.', ',')}×`;

/** What the mission label means, in plain words (the labels of the replay files of steps 5 to 9). */
const STATE_TEXT: Record<string, string> = {
  CALIBRATE: 'quieto: mide el sesgo del giroscopio',
  DETECT_DIRECTION: 'quieto: espera el sentido',
  FOLLOW: 'sigue la pared de la isla',
  TURN: 'gira 90 grados',
  FINISH: 'avanza despacio hasta la pared de salida',
  DONE: 'parado: ronda terminada',
  // Obstacle (my_obstacle/mission.py and park.py)
  SETUP: 'quieto: calibra el giroscopio y elige el sentido con los muros',
  RUN: 'sigue la línea planificada',
  LOOK: 'parado: mira una señal de color desconocido',
  BACKUP: 'marcha atrás: la primera señal está demasiado cerca',
  PARK_APPROACH: 'se acerca alineado al aparcamiento',
  PARK_BACK: 'vuelve en recta a la pose de planificar',
  PARK_PLAN: 'quieto: planifica las maniobras (A*)',
  PARK_STEER: 'quieto: gira las ruedas para la maniobra',
  PARK_MOVE: 'maniobra despacio',
  PARKED: 'aparcado del todo y en paralelo',
  STOP: 'parado: ronda terminada',
};

interface Prefs { lidar?: boolean; measures?: boolean; mode?: CameraMode; speed?: number }
function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Record<string, unknown>;
    const out: Prefs = {};
    if (typeof raw.lidar === 'boolean') out.lidar = raw.lidar;
    if (typeof raw.measures === 'boolean') out.measures = raw.measures;
    if (raw.mode === 'top' || raw.mode === 'follow') out.mode = raw.mode;
    if (typeof raw.speed === 'number' && SPEEDS.includes(raw.speed)) out.speed = raw.speed;
    return out;
  } catch {
    return {};
  }
}
function savePrefs(patch: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...readPrefs(), ...patch }));
  } catch { /* private mode: the choice just is not remembered */ }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT));
}

/** `data-start`: seconds ("12.5") or an event of the file ("event:3", counted from 1). */
function startTime(raw: string | undefined, replay: Replay): number {
  if (!raw) return 0;
  const event = /^event:(\d+)$/.exec(raw.trim());
  const t = event ? replay.events[Math.min(replay.events.length, Math.max(1, Number(event[1]))) - 1]?.t : Number(raw);
  return Number.isFinite(t) ? Math.max(0, Math.min(replay.duration, t as number)) : 0;
}
const cssRgb = (rgb: number[]) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(' ')})`;
const cssHex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const NO_SOURCE = 'Este reproductor no indica qué archivo mostrar.';

async function loadReplay(src: string, signal: AbortSignal): Promise<Replay> {
  const url = new URL(src, location.href);
  if (url.origin !== location.origin) throw new ReplayError('El reproductor solo abre archivos de este sitio.');
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ReplayError(`No se pudo descargar la repetición (${url.pathname}). Revisa la conexión y recarga la página.`);
  }
  if (!response.ok) throw new ReplayError(`No se encontró el archivo de la repetición (error ${response.status}): ${url.pathname}`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ReplayError(`El archivo de la repetición no es un JSON válido (${url.pathname}).`);
  }
  try {
    return parseReplay(data);
  } catch (error) {
    if (error instanceof ReplayError) throw new ReplayError(`${error.message} (${url.pathname})`);
    throw error;
  }
}

export default function mount(el: HTMLElement): () => void {
  let cleanup = () => {};
  guarded(el, (root) => {
    root.classList.add('lw-replay');
    const src = el.dataset.src ?? '';

    const stage = h('div', { class: 'lw-replay-stage' });
    const makeCanvas = () => h('canvas', { class: 'lw-replay-canvas', role: 'img', 'aria-label': 'Vista 3D de la repetición del coche en el campo' });
    let canvas = makeCanvas();
    const hudTime = h('span', { class: 'lw-replay-time' });
    const hudSections = h('span', { class: 'lw-replay-sections' });
    const hud = h('div', { class: 'lw-replay-hud', 'aria-hidden': 'true' }, hudTime, hudSections);
    // The mission state, large: the name of the state, what it means, and where the round is (corner and lap).
    const stateName = h('strong', { class: 'lw-replay-state-name' });
    const stateHelp = h('span', { class: 'lw-replay-state-help' });
    const stateMeta = h('span', { class: 'lw-replay-state-meta' });
    const stateChip = h('div', { class: 'lw-replay-state', 'aria-hidden': 'true', title: 'Estado de la misión (mission.py)' }, stateName, stateHelp, stateMeta);
    const status = h('p', { class: 'lw-replay-status' }, 'Cargando la repetición…');
    stage.append(canvas, hud, status);
    hud.hidden = true;
    stateChip.hidden = true;
    hudSections.hidden = true;
    root.append(stage);

    const controller = new AbortController();
    let disposed = false;
    let dispose = () => {
      disposed = true;
      controller.abort();
    };
    cleanup = () => dispose();

    const showError = (message: string, options: { detail?: string; retry?: () => void } = {}) => {
      status.hidden = false;
      status.setAttribute('role', 'alert');
      status.classList.add('lw-replay-error');
      status.replaceChildren(...[
        h('span', {}, message),
        options.detail ? h('small', { class: 'lw-replay-detail' }, options.detail) : null,
        options.retry ? button('Reintentar', options.retry) : null,
      ].filter((node): node is HTMLElement => node !== null));
      root.dataset.replayState = 'error';
    };
    const showLoading = (message: string) => {
      status.hidden = false;
      status.removeAttribute('role');
      status.classList.remove('lw-replay-error');
      status.textContent = message;
      delete root.dataset.replayState;
    };
    const oneLine = (error: unknown) => {
      const e = error instanceof Error ? error : new Error(String(error));
      return `${e.name}: ${e.message}`.replace(/\s+/g, ' ').slice(0, 200);
    };
    const hasWebGL = () => {
      try {
        const probe = document.createElement('canvas');
        return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'));
      } catch {
        return false;
      }
    };

    async function run(): Promise<void> {
      showLoading('Cargando la repetición…');
      let replay: Replay;
      try {
        if (!src) throw new ReplayError(NO_SOURCE);
        replay = await loadReplay(src, controller.signal);
      } catch (error) {
        if (disposed) return;
        console.warn('[step-replay] could not load the replay file', src, error);
        showError(error instanceof ReplayError ? error.message : 'No se pudo cargar la repetición.', {
          detail: error instanceof ReplayError ? undefined : oneLine(error),
          retry: () => void run(),
        });
        return;
      }
      if (disposed) return;

      // ---- Controls ----
      const prefs = readPrefs();
      const state = {
        t: 0, playing: false, speed: prefs.speed ?? 1,
        mode: (prefs.mode ?? (el.dataset.camera === 'follow' ? 'follow' : 'top')) as CameraMode,
        lidar: prefs.lidar ?? el.dataset.lidar === 'on', measures: prefs.measures ?? true,
      };
      // The poster: the first frame shows the whole path and a play button, until the reader plays or moves in time.
      let fresh = true;
      const hasLidar = replay.scans.length > 0, hasMeasures = replay.scene.length > 0;
      const duration = replay.duration;
      hudSections.hidden = !replay.sections;
      const calm = reducedMotion();

      const title = h('p', { class: 'lw-replay-title' }, replay.title);
      const eventText = h('p', { class: 'lw-replay-event' }, 'Pulsa Reproducir para empezar.');
      const numbers = h('p', { class: 'lw-replay-numbers' });
      const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      const caption = h('div', { class: hasMeasures ? 'lw-replay-caption' : 'lw-replay-caption lw-replay-caption-plain' }, eventText, hasMeasures ? numbers : null);

      const togglePlay = () => {
        if (!state.playing && state.t >= duration - 1e-6) { state.t = 0; snap = true; }
        state.playing = !state.playing;
        fresh = false;
        syncPlay();
        request();
      };
      const playButton = button('', togglePlay, 'lw-btn-primary lw-replay-play');
      playButton.setAttribute('aria-keyshortcuts', 'Space');
      const poster = h('div', { class: 'lw-replay-poster' },
        button('▶ Reproducir', togglePlay, 'lw-btn-primary lw-replay-poster-btn'),
        h('span', { class: 'lw-replay-poster-text' }, 'Recorrido completo; al reproducir se dibuja paso a paso.'));
      stage.append(poster);
      poster.hidden = true;
      const replayButton = button('Repetir', () => {
        state.t = 0; state.playing = true; snap = true; fresh = false;
        syncPlay();
        request();
      });
      const seek = (to: number) => {
        state.t = Math.max(0, Math.min(duration, to));
        fresh = false; snap = true;
        updateUi(); // text, chip and slider at once; the 3D frame follows on the next animation frame
        request();
      };
      const jumpEvent = (delta: 1 | -1) => {
        const list = replay.events;
        if (!list.length) return;
        const target = delta > 0 ? list.find((e) => e.t > state.t + 0.05) : [...list].reverse().find((e) => e.t < state.t - 0.5);
        state.playing = false;
        syncPlay();
        seek(target ? target.t : delta > 0 ? duration : 0);
      };
      const scrubId = nextId('lw-scrub');
      const scrub = h('input', { type: 'range', id: scrubId, min: 0, max: duration, step: Math.max(0.01, duration / 1000), value: 0, class: 'lw-replay-scrub' });
      scrub.addEventListener('input', () => {
        rangeFill(scrub);
        seek(Number(scrub.value));
      });
      const marks = h('div', { class: 'lw-replay-marks', 'aria-hidden': 'true' },
        ...replay.events.map((e) => h('i', { style: `left:${Math.min(100, (e.t / duration) * 100)}%` })));
      const timeline = h('div', { class: 'lw-replay-timeline' },
        playButton,
        h('div', { class: 'lw-replay-scrubwrap' }, h('label', { class: 'lw-sr', for: scrubId }, 'Tiempo de la repetición'), scrub, marks));

      const group = (label: string, items: { text: string; on: () => boolean; click: () => void }[]) => {
        const buttons = items.map((item) => {
          const b = button(item.text, () => { item.click(); sync(); request(); });
          return b;
        });
        const sync = () => buttons.forEach((b, i) => {
          const on = items[i].on();
          b.setAttribute('aria-pressed', String(on));
          b.classList.toggle('lw-btn-on', on);
        });
        sync();
        return { root: h('div', { class: 'lw-replay-group', role: 'group', 'aria-label': label }, h('span', { class: 'lw-replay-grouplabel', 'aria-hidden': 'true' }, label), ...buttons), sync };
      };
      const speedSlider = slider({
        label: 'Velocidad de reproducción',
        min: 0, max: SPEEDS.length - 1, step: 1, value: Math.max(0, SPEEDS.indexOf(state.speed)),
        format: (i) => speedText(SPEEDS[i]),
        onInput: (i) => { state.speed = SPEEDS[i]; savePrefs({ speed: state.speed }); request(); },
      });
      speedSlider.root.classList.add('lw-replay-speed');
      const cameraGroup = group('Cámara', [
        { text: 'Desde arriba', on: () => state.mode === 'top', click: () => { state.mode = 'top'; snap = calm; savePrefs({ mode: 'top' }); } },
        { text: 'Siguiendo', on: () => state.mode === 'follow', click: () => { state.mode = 'follow'; snap = calm; savePrefs({ mode: 'follow' }); } },
      ]);
      const prevEvent = button('‹ Evento', () => jumpEvent(-1));
      const nextEvent = button('Evento ›', () => jumpEvent(1));
      prevEvent.setAttribute('aria-label', 'Evento anterior');
      nextEvent.setAttribute('aria-label', 'Evento siguiente');
      const eventGroup = h('div', { class: 'lw-replay-group', role: 'group', 'aria-label': 'Saltar entre eventos' }, prevEvent, nextEvent);
      eventGroup.hidden = replay.events.length === 0;
      const toggles = h('div', { class: 'lw-replay-toggles' });
      const lidarToggle = hasLidar ? toggle('LiDAR', state.lidar, (v) => { state.lidar = v; savePrefs({ lidar: v }); request(); }) : null;
      const measuresToggle = hasMeasures ? toggle('Medidas laterales', state.measures, (v) => { state.measures = v; savePrefs({ measures: v }); request(); }) : null;
      if (lidarToggle) toggles.append(lidarToggle.root);
      if (measuresToggle) toggles.append(measuresToggle.root);
      const options = h('div', { class: 'lw-actions lw-replay-options' }, replayButton, eventGroup, cameraGroup.root, toggles);
      const speedRow = h('div', { class: 'lw-replay-speedrow' }, speedSlider.root);

      // Another player on the page (or an earlier visit) changed a choice: follow it.
      const onPrefs = () => {
        const p = readPrefs();
        if (p.lidar !== undefined) state.lidar = p.lidar;
        if (p.measures !== undefined) state.measures = p.measures;
        if (p.mode !== undefined && p.mode !== state.mode) { state.mode = p.mode; snap = calm; }
        if (p.speed !== undefined) { state.speed = p.speed; speedSlider.set(SPEEDS.indexOf(p.speed)); }
        if (lidarToggle) lidarToggle.input.checked = state.lidar;
        if (measuresToggle) measuresToggle.input.checked = state.measures;
        cameraGroup.sync();
        request();
      };
      window.addEventListener(PREFS_EVENT, onPrefs);

      const keys = h('p', { class: 'lw-note lw-replay-keys' },
        'Teclado: pulsa sobre la escena y usa ',
        h('kbd', {}, 'Espacio'), ' (pausa o reproduce), ',
        h('kbd', {}, '←'), ' ', h('kbd', {}, '→'), ' (1 s; con ', h('kbd', {}, 'Mayús'), ' 5 s) y ',
        h('kbd', {}, 'Re Pág'), ' ', h('kbd', {}, 'Av Pág'), ' (evento anterior o siguiente).');

      // ---- Legend of colours: what each colour in the scene is (theme aware, from theme-colors.ts) ----
      const legendItems: { swatch: HTMLElement; color: () => string }[] = [];
      const legendItem = (text: string, color: () => string) => {
        const swatch = h('span', { class: 'lw-swatch', 'aria-hidden': 'true' });
        legendItems.push({ swatch, color });
        return h('li', {}, swatch, text);
      };
      const legendNodes = [
        ...replay.tracks.map((track, i) => legendItem(
          i > 0 ? `${track.label} (fantasma)` : replay.trail ? `${track.label} (coche y recorrido)` : track.label,
          () => trackColor(track.color))),
        ...(hasLidar ? [legendItem('LiDAR (rayos y puntos)', () => cssHex(scenePalette().lidarRay))] : []),
        ...(hasMeasures ? ['izquierda', 'derecha', 'frente'].map((name, k) => legendItem(`Medida ${name}`, () => cssRgb(scenePalette().measure[k]))) : []),
        ...(replay.sections ? [legendItem('Sección puntuada', () => cssHex(scenePalette().section))] : []),
      ];
      const legend = h('ul', { class: 'lw-legend lw-replay-legend', 'aria-label': 'Leyenda de colores' }, ...legendNodes);
      const paintLegend = () => { for (const item of legendItems) item.swatch.style.color = item.color(); };
      paintLegend();
      const offTheme = onThemeChange(() => paintLegend());

      const note = replay.caption ? h('p', { class: 'lw-note' }, replay.caption) : null;

      const parts: (HTMLElement | null)[] = [title, stage, stateChip, caption, live, timeline, speedRow, options, legend, keys, note];
      root.replaceChildren(...parts
        .filter((node): node is HTMLElement => node !== null));

      // ---- UI refresh (DOM writes only when the text changes) ----
      const shown = new Map<Node, string>();
      const setText = (node: HTMLElement, value: string) => {
        if (shown.get(node) === value) return;
        shown.set(node, value);
        node.textContent = value;
      };
      let lastEvent = -2;
      let liveTimer = 0;
      const announce = (message: string) => {
        clearTimeout(liveTimer);
        liveTimer = window.setTimeout(() => { live.textContent = message; }, 600);
      };
      const meters = (v: number | null) => (v === null ? 'sin dato' : `${fmt(v, 2)} m`);
      function syncPlay() {
        playButton.textContent = state.playing ? 'Pausar' : state.t >= duration - 1e-6 ? 'Volver a ver' : 'Reproducir';
      }
      function updateUi() {
        const t = state.t;
        setText(hudTime, `${fmt(t, 1)} / ${fmt(duration, 1)} s`);
        if (replay.sections) {
          const count = Math.min(MAX_SECTION_POINTS, latestIndex(replay.sectionExits, t) + 1);
          setText(hudSections, `secciones ${count}/${MAX_SECTION_POINTS}`);
        }
        const label = latestAt(replay.labels, t);
        stateChip.hidden = !label;
        if (label) {
          setText(stateName, label.state);
          setText(stateHelp, STATE_TEXT[label.state] ?? '');
          const meta: string[] = [];
          if (label.corners !== null) {
            meta.push(`esquina ${Math.min(12, label.corners)} de 12`);
            if (replay.sections) meta.push(label.corners >= 12 ? 'vuelta 3 de 3' : `vuelta ${Math.floor(label.corners / 4) + 1} de 3`);
          }
          setText(stateMeta, meta.join(' · '));
        }
        poster.hidden = !(scene !== null && fresh && !state.playing && t <= 0);
        scrub.value = String(t);
        rangeFill(scrub);
        scrub.setAttribute('aria-valuetext', `${fmt(t, 1)} s de ${fmt(duration, 1)} s`);

        const index = latestIndex(replay.events, t);
        if (index !== lastEvent) {
          lastEvent = index;
          const text = index >= 0 ? replay.events[index].text : t <= 0 ? 'Pulsa Reproducir para empezar.' : '';
          if (index >= 0 || t <= 0) { setText(eventText, text); announce(text); }
        }
        const entry = replay.scene.length ? latestAt(replay.scene, t) : null;
        if (hasMeasures) {
          numbers.hidden = !entry;
          if (entry) {
            const parts = [`izquierda ${meters(entry.left)}`, `derecha ${meters(entry.right)}`, `frente ${meters(entry.front)}`];
            if (entry.islandEnd !== null) parts.push(`fin de isla ${meters(entry.islandEnd)}`);
            setText(numbers, parts.join(' · '));
          }
        }
      }

      // ---- 3D scene and the render loop ----
      let scene: ReplayScene | null = null;
      let snap = true;
      let raf = 0;
      let last = 0;
      let onScreen = false;
      const active = () => !disposed && scene !== null && onScreen && !document.hidden;

      function tick(now: number) {
        raf = 0;
        if (!active() || !scene) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (state.playing) {
          state.t = Math.min(duration, state.t + dt * state.speed);
          if (state.t >= duration) { state.playing = false; syncPlay(); announce('Fin de la repetición.'); }
        }
        const settled = scene.frame(state.t, { lidar: state.lidar, measures: state.measures, mode: state.mode, dt, snap: snap || calm, preview: fresh && !state.playing && state.t <= 0 });
        snap = false;
        updateUi();
        if (state.playing || !settled) raf = requestAnimationFrame(tick);
      }
      function request() {
        if (raf || !active()) return;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }

      const intersection = new IntersectionObserver((entries) => {
        for (const entry of entries) onScreen = entry.isIntersecting;
        if (onScreen) request();
        else { cancelAnimationFrame(raf); raf = 0; }
      }, { rootMargin: '100px 0px' });
      const onVisibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else request(); };
      document.addEventListener('visibilitychange', onVisibility);
      const resizeObserver = new ResizeObserver(() => {
        if (!scene) return;
        const rect = stage.getBoundingClientRect();
        scene.resize(rect.width, rect.height);
        snap = true;
        request();
      });
      const onPageHide = (e: PageTransitionEvent) => { if (!e.persisted) dispose(); }; // bfcache keeps the page alive
      document.addEventListener('astro:before-swap', () => dispose(), { once: true });
      window.addEventListener('pagehide', onPageHide);

      dispose = () => {
        if (disposed && !scene) return;
        disposed = true;
        controller.abort();
        clearTimeout(liveTimer);
        cancelAnimationFrame(raf);
        raf = 0;
        intersection.disconnect();
        resizeObserver.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener(PREFS_EVENT, onPrefs);
        offTheme();
        scene?.dispose();
        scene = null;
      };

      // ---- Keyboard: the stage can be focused; Space and the arrows work there (and Space on the time slider) ----
      stage.tabIndex = 0;
      stage.setAttribute('role', 'group');
      stage.setAttribute('aria-label', 'Escena de la repetición. Teclado: Espacio reproduce o pausa, flechas izquierda y derecha mueven 1 segundo, Re Pág y Av Pág saltan de evento.');
      stage.setAttribute('aria-keyshortcuts', 'Space ArrowLeft ArrowRight PageUp PageDown Home End');
      const onKey = (e: KeyboardEvent) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        const onStage = e.target === stage;
        if (!onStage && !(e.target === scrub && e.key === ' ')) return;
        const step = e.shiftKey ? 5 : 1;
        switch (e.key) {
          case ' ': togglePlay(); break;
          case 'ArrowLeft': if (onStage) seek(state.t - step); else return; break;
          case 'ArrowRight': if (onStage) seek(state.t + step); else return; break;
          case 'PageUp': jumpEvent(-1); break;
          case 'PageDown': jumpEvent(1); break;
          case 'Home': seek(0); break;
          case 'End': seek(duration); break;
          default: return;
        }
        e.preventDefault();
      };
      root.addEventListener('keydown', onKey);

      const wanted = startTime(el.dataset.start, replay);
      if (wanted > 0) { state.t = wanted; fresh = false; }
      syncPlay();
      updateUi();

      async function startScene(): Promise<void> {
        showLoading('Cargando el coche…');
        try {
          const { createReplayScene } = await import('../replay/scene');
          const created = await createReplayScene({ canvas, replay, assetBase: ASSET_BASE });
          if (disposed) { created.dispose(); return; }
          scene = created;
        } catch (error) {
          console.error('[step-replay] could not start the 3D scene:', error);
          if (disposed) return;
          if (!hasWebGL()) {
            showError('No se pudo iniciar WebGL en este navegador, así que la repetición no se puede mostrar.');
            return;
          }
          showError('No se pudo cargar el reproductor 3D. Recarga la página o pulsa Reintentar.', {
            detail: oneLine(error),
            retry: () => {
              const newCanvas = makeCanvas(); // a canvas whose context was lost cannot be reused
              canvas.replaceWith(newCanvas);
              canvas = newCanvas;
              void startScene();
            },
          });
          return;
        }
        status.hidden = true;
        hud.hidden = false;
        updateUi();
        root.dataset.replayState = 'ready';
        const rect = stage.getBoundingClientRect();
        scene.resize(rect.width, rect.height);
        resizeObserver.observe(stage);
        intersection.observe(stage);
        if (calm) root.dataset.calm = 'true';
        announce(`Repetición lista: ${replay.title}. Dura ${fmt(duration, 1)} segundos.`);
      }
      await startScene();
    }
    void run();
  });
  return () => cleanup();
}
