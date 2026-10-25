// Widget "step-replay": replays a recorded trajectory of the car on the field (Three.js, lazy).
//   <div data-widget="step-replay" data-src="/learn/assets/replays/step-3.json"></div>
// The file format is described in ../replay/format.ts. three.js, the STL meshes and the mat texture are only
// loaded once the widget is mounted (the loader mounts it near the viewport); the render loop pauses while the
// widget is off-screen or the tab is hidden.
import { button, fmt, guarded, h, nextId, rangeFill, reducedMotion, toggle } from './lib/common';
import { latestAt, latestIndex, MAX_SECTION_POINTS, parseReplay, ReplayError, type Replay } from '../replay/format';
import type { CameraMode, ReplayScene } from '../replay/scene';

const ASSET_BASE = '/learn/assets/';
const SPEEDS = [0.5, 1, 2, 4];
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
    const hudChip = h('span', { class: 'lw-replay-chip' });
    const hud = h('div', { class: 'lw-replay-hud', 'aria-hidden': 'true' }, hudTime, hudSections, hudChip);
    const status = h('p', { class: 'lw-replay-status' }, 'Cargando la repetición…');
    stage.append(canvas, hud, status);
    hud.hidden = true;
    hudChip.hidden = true;
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
      const state = {
        t: 0, playing: false, speed: 1, mode: (el.dataset.camera === 'follow' ? 'follow' : 'top') as CameraMode,
        lidar: el.dataset.lidar === 'on', measures: true,
      };
      const hasLidar = replay.scans.length > 0, hasMeasures = replay.scene.length > 0;
      const duration = replay.duration;
      hudSections.hidden = !replay.sections;
      const calm = reducedMotion();

      const title = h('p', { class: 'lw-replay-title' }, replay.title);
      const eventText = h('p', { class: 'lw-replay-event' }, 'Pulsa Reproducir para empezar.');
      const numbers = h('p', { class: 'lw-replay-numbers' });
      const live = h('p', { class: 'lw-sr', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
      const caption = h('div', { class: hasMeasures ? 'lw-replay-caption' : 'lw-replay-caption lw-replay-caption-plain' }, eventText, hasMeasures ? numbers : null);

      const playButton = button('', () => {
        if (!state.playing && state.t >= duration - 1e-6) { state.t = 0; snap = true; }
        state.playing = !state.playing;
        syncPlay();
        request();
      }, 'lw-btn-primary lw-replay-play');
      const replayButton = button('Repetir', () => {
        state.t = 0; state.playing = true; snap = true;
        syncPlay();
        request();
      });
      const scrubId = nextId('lw-scrub');
      const scrub = h('input', { type: 'range', id: scrubId, min: 0, max: duration, step: Math.max(0.01, duration / 1000), value: 0, class: 'lw-replay-scrub' });
      scrub.addEventListener('input', () => {
        state.t = Number(scrub.value);
        rangeFill(scrub);
        snap = true;
        request();
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
      const speedGroup = group('Velocidad', SPEEDS.map((v) => ({
        text: `${fmt(v, v < 1 ? 1 : 0)}×`, on: () => state.speed === v, click: () => { state.speed = v; },
      })));
      const cameraGroup = group('Cámara', [
        { text: 'Desde arriba', on: () => state.mode === 'top', click: () => { state.mode = 'top'; snap = calm; } },
        { text: 'Siguiendo', on: () => state.mode === 'follow', click: () => { state.mode = 'follow'; snap = calm; } },
      ]);
      const toggles = h('div', { class: 'lw-replay-toggles' });
      if (hasLidar) toggles.append(toggle('LiDAR', state.lidar, (v) => { state.lidar = v; request(); }).root);
      if (hasMeasures) toggles.append(toggle('Medidas laterales', state.measures, (v) => { state.measures = v; request(); }).root);
      const options = h('div', { class: 'lw-actions lw-replay-options' }, replayButton, speedGroup.root, cameraGroup.root, toggles);

      const legend = h('ul', { class: 'lw-legend lw-replay-legend' },
        ...replay.tracks.map((track, i) => h('li', {},
          h('span', { class: 'lw-swatch', style: `color:${track.color}${i > 0 ? ';opacity:.6' : ''}`, 'aria-hidden': 'true' }),
          i > 0 ? `${track.label} (fantasma)` : track.label)));
      const note = replay.caption ? h('p', { class: 'lw-note' }, replay.caption) : null;

      const parts: (HTMLElement | null)[] = [title, stage, caption, live, timeline, options, replay.tracks.length > 1 ? legend : null, note];
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
        setText(hudChip, label ? `${label.state}${label.corners !== null ? ` · esquinas ${label.corners}/12` : ''}` : '');
        hudChip.hidden = !label;
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
        const settled = scene.frame(state.t, { lidar: state.lidar, measures: state.measures, mode: state.mode, dt, snap: snap || calm });
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
        scene?.dispose();
        scene = null;
      };

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
              const fresh = makeCanvas(); // a canvas whose context was lost cannot be reused
              canvas.replaceWith(fresh);
              canvas = fresh;
              void startScene();
            },
          });
          return;
        }
        status.hidden = true;
        hud.hidden = false;
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
