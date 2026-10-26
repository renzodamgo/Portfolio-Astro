// Widget "obstacle-park": parallel parking planned by the course's A* (park.py search, ported line by line): 3 cm arcs at
// full or half lock or straight, forward or back, with the measured outline and the steered wheels kept `margin` from
// the lot limits and the wall. Runs of equal arcs are one move each. Move the start pose or the margin and plan again.
import { animate, button, fmt, guarded, h, legend, readout, reducedMotion, slider, svgEl } from './lib/common';
import { GOAL_INSIDE, HW, LIMIT_THICKNESS, Lot, OUTER, STEER_LIMIT, STEP, footprint, frontWheels, move, planningPose, search, type Pose } from './lib/obstacle';

const VW = 640, VH = 300, K = 520, X0 = -0.12, Y1 = -0.98;   // window x in [-0.12, 1.11], y in [-1.56, -0.98]
const LOT_C = '#d63ad6';
const deg = (r: number) => (r * 180) / Math.PI;

interface Plan { moves: [number, number, number][]; arcs: number; expanded: number; ms: number; poses: Pose[]; steers: number[] }

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    const lot = new Lot(1);
    const base = planningPose(lot);
    let dx = 0, dy = 0, dth = 0, margin = 0.015, limit = STEER_LIMIT;   // the mission's steer_limit, 0.307 rad
    let plan: Plan | null = null;
    let frame = 0;
    let cancel: (() => void) | null = null;
    const cache = new Map<string, Plan | null>();
    const P = (x: number, y: number): [number, number] => [(x - X0) * K, (Y1 - y) * K];
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();
    const status = h('p', { class: 'lw-caption', role: 'status' }, '');
    const start = (): Pose => [base[0] + dx, base[1] + dy, base[2] + (dth * Math.PI) / 180];

    function poly(points: [number, number][], attrs: string): string {
      return `<polygon points="${points.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(',')).join(' ')}" ${attrs}/>`;
    }

    function draw(): void {
      let out = `<rect x="0" y="0" width="${VW}" height="${VH}" fill="var(--lw-bg)"/>`;
      const [, wy] = P(0, -OUTER);
      out += `<rect class="lw-wall" x="0" y="${wy}" width="${VW}" height="${VH - wy}"/>`;
      out += `<text class="lw-tag lw-c-muted" x="8" y="${wy + 16}" fill="currentColor">muro exterior</text>`;
      for (const [x0, x1, y0, y1] of lot.limits()) out += poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], `fill="${LOT_C}"`);
      out += poly([[lot.xa, lot.y0], [lot.xb, lot.y0], [lot.xb, lot.y1], [lot.xa, lot.y1]], `fill="${LOT_C}" opacity="0.12"`);
      const [gx0, gy0] = P(lot.xa + GOAL_INSIDE, lot.y1 - GOAL_INSIDE), [gx1, gy1] = P(lot.xb - GOAL_INSIDE, lot.y0 + GOAL_INSIDE);
      out += `<rect x="${gx0}" y="${gy0}" width="${gx1 - gx0}" height="${gy1 - gy0}" fill="none" stroke="var(--lw-green)" stroke-dasharray="4 4"/>`;
      const [lx, ly] = P((lot.xa + lot.xb) / 2, lot.y1 + 0.02);
      out += `<text class="lw-tag" x="${lx}" y="${ly}" text-anchor="middle" fill="${LOT_C}">0,35 × 0,20 m</text>`;
      // the approach line
      const line = lot.y1 + HW + 0.04;
      out += `<line x1="0" y1="${P(0, line)[1]}" x2="${VW}" y2="${P(0, line)[1]}" stroke="var(--lw-muted)" stroke-dasharray="6 5"/>`;
      // ghosts of the planned path and the car now
      const s = start();
      if (plan) {
        for (let i = 0; i < plan.poses.length; i += 3) out += poly(footprint(...plan.poses[i]), 'fill="none" stroke="var(--lw-amber)" stroke-width="1" opacity="0.18"');
        const pts = plan.poses.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(',')).join(' ');
        out += `<polyline points="${pts}" fill="none" stroke="var(--lw-blue)" stroke-width="1.5"/>`;
      }
      const pose = plan ? plan.poses[Math.min(frame, plan.poses.length - 1)] : s;
      const steer = plan ? plan.steers[Math.min(frame, plan.steers.length - 1)] : 0;
      for (const wheel of frontWheels(...pose, steer)) out += poly(wheel, 'fill="#0c0a07"');
      out += poly(footprint(...pose), 'class="lw-body" style="stroke-width:1"');
      const [nx, ny] = P(pose[0] + 0.12 * Math.cos(pose[2]), pose[1] + 0.12 * Math.sin(pose[2]));
      out += `<circle cx="${nx}" cy="${ny}" r="3" fill="#0c0a07"/>`;
      scene.innerHTML = out;

      const parked = lot.parked(...pose, 0.005);
      const rows: [string, string, string?][] = [
        ['salida (la pose de planificar)', `x ${fmt(s[0], 3)} m, y ${fmt(s[1], 3)} m, ${fmt(deg(s[2]), 1)}°`],
      ];
      if (plan) {
        rows.push(
          ['maniobras', `${plan.moves.length} (${plan.arcs} arcos de ${fmt(STEP * 100, 0)} cm)`],
          ['nodos que expandió A*', `${plan.expanded.toLocaleString('es')} en ${fmt(plan.ms / 1000, 1)} s`],
          ['ahora', `maniobra ${moveAt(frame) + 1} de ${plan.moves.length}${parked ? ' · aparcado del todo y en paralelo' : ''}`, parked ? 'green' : undefined],
        );
      } else rows.push(['plan', 'sin plan: pulsa Planificar']);
      rd.set(rows, plan ? `${plan.moves.length} maniobras, ${plan.expanded} nodos expandidos.` : 'Sin plan.');
    }

    function moveAt(f: number): number {
      if (!plan) return 0;
      let arcs = Math.floor(f / 3);
      for (let i = 0; i < plan.moves.length; i++) { const n = Math.round(plan.moves[i][2] / STEP); if (arcs < n) return i; arcs -= n; }
      return plan.moves.length - 1;
    }

    function compute(): void {
      const s = start();
      const key = JSON.stringify([s, margin, limit]);
      if (cache.has(key)) { plan = cache.get(key)!; afterPlan(); return; }
      status.textContent = 'Planificando con A* (unos segundos)…';
      plan = null;
      draw();
      window.setTimeout(() => {
        const t0 = performance.now();
        let path: [number, number][] | null = null, expanded = 0;
        // park._plan: the first margin that works (and with an overshoot, what is left of it)
        for (const m of [margin, Math.min(margin, 0.01)]) {
          let mm = m;
          while (mm > 0.004 && !lot.free(...s, 0, mm)) mm -= 0.002;
          const r = search(lot, s, null, limit, mm, 2);
          expanded += r.expanded;
          path = r.path;
          if (path) break;
        }
        const ms = performance.now() - t0;
        if (!path) { cache.set(key, null); plan = null; status.textContent = `No hay plan desde aquí (${expanded.toLocaleString('es')} nodos).`; draw(); return; }
        const moves: [number, number, number][] = [];
        for (const [steer, dir] of path) {
          const last = moves[moves.length - 1];
          if (last && last[0] === steer && last[1] === dir) last[2] += STEP; else moves.push([steer, dir, STEP]);
        }
        // the poses of the plan, 3 per arc (the substeps of the search)
        const poses: Pose[] = [s], steers: number[] = [0];
        let p = s;
        for (const [steer, dir] of path) for (let k = 0; k < 3; k++) { p = move(...p, steer, (dir * STEP) / 3); poses.push(p); steers.push(steer); }
        plan = { moves, arcs: path.length, expanded, ms, poses, steers };
        cache.set(key, plan);
        afterPlan();
      }, 30);
    }
    function afterPlan(): void {
      status.textContent = plan ? 'Plan listo: así entra, maniobra a maniobra.' : 'No hay plan desde aquí.';
      play();
    }
    function play(): void {
      cancel?.();
      if (!plan) { draw(); return; }
      if (reducedMotion()) { frame = plan.poses.length - 1; draw(); return; }
      const total = plan.poses.length;
      cancel = animate(Math.max(3000, total * 25), (t) => { frame = Math.round(t * (total - 1)); scrub.set(frame / (total - 1)); draw(); }, () => { cancel = null; });
    }

    const scrub = slider({ label: 'Recorrido del plan', min: 0, max: 1, step: 0.005, value: 0, format: (v) => `${Math.round(v * 100)} %`, onInput: (v) => { cancel?.(); if (plan) frame = Math.round(v * (plan.poses.length - 1)); draw(); } });
    const mk = (label: string, min: number, max: number, step: number, value: number, f: (v: number) => string, set: (v: number) => void) =>
      slider({ label, min, max, step, value, format: f, onInput: (v) => { set(v); cancel?.(); plan = null; frame = 0; status.textContent = 'Cambiaste la salida: pulsa Planificar.'; draw(); } });
    const sx = mk('Salida: adelante / atrás (cm)', -8, 12, 1, 0, (v) => `${fmt(v, 0)} cm`, (v) => (dx = v / 100));
    const sy = mk('Salida: más cerca / lejos del aparcamiento (cm)', -3, 6, 0.5, 0, (v) => `${fmt(v, 1)} cm`, (v) => (dy = v / 100));
    const sth = mk('Salida: torcido (°)', -6, 6, 1, 0, (v) => `${fmt(v, 0)}°`, (v) => (dth = v));
    const sm = mk('Margen con los topes y el muro (cm)', 0.6, 3, 0.1, margin * 100, (v) => `${fmt(v, 1)} cm`, (v) => (margin = v / 100));
    const limitSel = h('select', { id: 'lw-op-limit' });
    limitSel.append(h('option', { value: String(STEER_LIMIT) }, '17,6° (el coche real)'), h('option', { value: String((25 * Math.PI) / 180) }, '25° (el límite del reglamento)'));
    limitSel.addEventListener('change', () => { limit = Number(limitSel.value); plan = null; status.textContent = 'Cambiaste el volante: pulsa Planificar.'; draw(); });
    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([['amber', 'el coche y su contorno a lo largo del plan'], ['blue', 'recorrido del centro del coche'], ['green', 'la meta: dentro del hueco con 1,5 cm por lado']]),
      status,
      rd.root,
      h('div', { class: 'lw-actions' },
        button('Planificar (A*)', compute, 'lw-btn-primary'),
        button('Reproducir', play),
        button('Volver a la pose del curso', () => { dx = dy = dth = 0; margin = 0.015; sx.set(0); sy.set(0); sth.set(0); sm.set(1.5); compute(); }),
      ),
      h('div', { class: 'lw-controls' }, scrub.root, sx.root, sy.root, sth.root, sm.root, h('div', { class: 'lw-field' }, h('label', { for: 'lw-op-limit' }, 'Tope del volante'), limitSel)),
      h('p', { class: 'lw-note' }, `La búsqueda de park.py: A* con peso 2 sobre arcos de 3 cm (a fondo o a la mitad a cada lado, o recto; adelante o atrás), cambiar de marcha cuesta 5 cm, el contorno medido y las ruedas giradas a «margen» de los topes (${fmt(LIMIT_THICKNESS * 100, 0)} cm) y del muro; meta: dentro del hueco 1,5 cm por cada lado y paralelo (3°). La pose de salida del curso es la de planificar: 5 cm pasado el tope del fondo, sobre la línea a 4 cm del aparcamiento. Corre aquí, en tu navegador.`),
    );
    svg.setAttribute('aria-label', 'Vista desde arriba del aparcamiento: el muro, los dos topes, el coche en la pose de planificar y las maniobras del plan de A* hasta quedar dentro y paralelo');
    draw();
    // plan once the widget is on screen (a couple of seconds of A*)
    window.setTimeout(compute, 200);
  });
}
