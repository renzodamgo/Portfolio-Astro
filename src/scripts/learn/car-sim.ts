// Mounts the drivable Robotek car (components/learn/CarSim.astro). Light entry point: three.js and the
// meshes are only loaded when the element gets near the viewport.
import { createSim, type Pose } from './car-sim/physics';
import { OBSTACLE_PILLARS } from './car-sim/constants';

export interface CarSimApi {
  /** Drive from outside (guide widgets). throttle and steer in [-1, 1]; null releases control. */
  setDirection(direction: { throttle?: number; steer?: number } | null): void;
  reset(): void;
  getPose(): Pose;
  /** Called after every rendered frame with the pose and the 306 LiDAR ranges. Returns the unsubscribe function. */
  onTick(callback: (pose: Pose, ranges: Float32Array) => void): () => void;
}
type CarSimElement = HTMLElement & { __carSim?: CarSimApi; __carSimCleanup?: () => void };

const ASSET_BASE = '/learn/assets/';

export function mountCarSim(root: CarSimElement) {
  if (root.__carSim) return;
  const sim = createSim({ pillars: root.dataset.field === 'obstacle' ? OBSTACLE_PILLARS : [] });
  const listeners = new Set<(pose: Pose, ranges: Float32Array) => void>();
  const clampUnit = (n: unknown) => Math.max(-1, Math.min(1, Number(n) || 0));

  root.__carSim = {
    setDirection(direction) {
      sim.setOverride(direction ? { throttle: clampUnit(direction.throttle), steer: clampUnit(direction.steer) } : null);
    },
    reset: () => sim.reset(),
    getPose: () => sim.getPose(),
    onTick(callback) {
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },
  };

  let engine: { setVisible(v: boolean): void; setOverlays(o: { lidar?: boolean; camera?: boolean }): void; dispose(): void } | null = null;
  let overlays: { lidar?: boolean; camera?: boolean } = {};
  let stopChallenge: (() => void) | null = null;
  let loading = false;
  let visible = false;
  let gone = false;
  const compact = root.dataset.compact === 'true';
  const autostart = root.dataset.autostart === 'true';

  async function load() {
    if (loading || gone) return;
    loading = true;
    try {
      const { startEngine } = await import('./car-sim/engine');
      if (gone) return;
      engine = startEngine({
        root, sim, compact, autostart, assetBase: ASSET_BASE,
        onTick: () => { const pose = sim.getPose(); listeners.forEach((cb) => cb(pose, sim.ranges)); },
      });
      engine.setOverlays(overlays);
      engine.setVisible(visible);
    } catch (error) {
      console.error('[car-sim] could not start', error);
      root.dataset.error = 'true';
      const loadingEl = root.querySelector<HTMLElement>('.cs-loading');
      if (loadingEl) { loadingEl.hidden = false; loadingEl.textContent = 'No se pudo iniciar WebGL en este navegador.'; }
    }
  }

  // Race mode (step 0 of the guides): driver, car colour, countdown, three laps against the clock.
  if (root.dataset.race) {
    import('./car-sim/race').then(({ startRace }) => {
      if (gone) return;
      stopChallenge = startRace({
        root, sim,
        onTick: (cb) => { const listener = () => cb(); listeners.add(listener); return () => { listeners.delete(listener); }; },
      });
    }).catch((error) => console.error('[car-sim] race could not start', error));
  } else if (root.dataset.challenge === 'true') {
  // Challenge mode (?paso=N&dir=...): the panel and the rules are a separate light module, no three.js in it.
    import('./car-sim/challenge').then(({ startChallenge }) => {
      if (gone) return;
      stopChallenge = startChallenge({
        root, sim,
        onTick: (cb) => { const listener = () => cb(); listeners.add(listener); return () => { listeners.delete(listener); }; },
        setOverlays(o) { overlays = { ...overlays, ...o }; engine?.setOverlays(o); },
      });
    }).catch((error) => console.error('[car-sim] challenge could not start', error));
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      visible = entry.isIntersecting;
      if (visible) void load();
      engine?.setVisible(visible);
    }
  }, { rootMargin: '200px 0px' });
  observer.observe(root);

  const dispose = () => {
    gone = true;
    observer.disconnect();
    stopChallenge?.();
    stopChallenge = null;
    engine?.dispose();
    engine = null;
    listeners.clear();
    document.removeEventListener('astro:before-swap', dispose);
    window.removeEventListener('pagehide', onPageHide);
    delete root.__carSim;
    delete root.__carSimCleanup;
  };
  const onPageHide = (e: PageTransitionEvent) => { if (!e.persisted) dispose(); }; // bfcache keeps the page alive
  root.__carSimCleanup = dispose;
  document.addEventListener('astro:before-swap', dispose);
  window.addEventListener('pagehide', onPageHide);
}

export function mountAllCarSims() {
  document.querySelectorAll<CarSimElement>('[data-car-sim]').forEach(mountCarSim);
}
