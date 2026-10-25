// Widget "heading-law": the proportional steering law of step 2 (heading.py),
//   heading_steer(goal, yaw) = clamp(KP * wrap(goal - yaw), -STEER_LIMIT, STEER_LIMIT)
// drawn as a compass: the goal heading, the car's heading, the error arc (the way the car decides to turn) and the
// steering it asks for. The `wrap` switch shows why the error must take the short way round +-pi.
import { button, fmt, guarded, h, legend, readout, slider, svgEl, toggle } from './lib/common';
import { KP, STEER_LIMIT, clamp, wrap } from './lib/sim';

const W = 360, H = 292, CX = 180, CY = 112, R = 86, RA = 56; // viewBox, compass centre, ring and arc radii
const DEFAULTS = { goal: 0.3, yaw: 0, useWrap: true };
const PI = Math.PI;

export default function mount(el: HTMLElement): void {
  guarded(el, (root) => {
    let goal = DEFAULTS.goal; // rad
    let yaw = DEFAULTS.yaw; // rad
    let useWrap = DEFAULTS.useWrap;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'lw-svg', role: 'img' });
    const scene = svgEl('g');
    svg.append(scene);
    const rd = readout();
    const note = h('p', { class: 'lw-note' });

    const law = () => {
      const raw = goal - yaw; // what the formula sees without wrap
      const err = useWrap ? wrap(raw) : raw;
      const unclamped = KP * err;
      const steer = clamp(unclamped, -STEER_LIMIT, STEER_LIMIT);
      return { raw, err, unclamped, steer, saturated: Math.abs(unclamped) > STEER_LIMIT };
    };

    // heading (rad, 0 = east, positive = counter-clockwise, as yaw) -> point at radius r
    const pt = (a: number, r: number): [number, number] => [CX + r * Math.cos(a), CY - r * Math.sin(a)];
    const f1 = (v: number) => v.toFixed(1);

    function draw(): void {
      const { err, steer, saturated } = law();
      const longWay = Math.abs(err) > PI + 1e-9;
      let out = '';
      // ring, ticks and labels
      out += `<circle class="lw-frame" cx="${CX}" cy="${CY}" r="${R}"/>`;
      const marks: [number, string][] = [[0, '0'], [PI / 2, 'π/2'], [PI, '±π'], [-PI / 2, '−π/2']];
      for (const [a, label] of marks) {
        const [x1, y1] = pt(a, R - 5), [x2, y2] = pt(a, R + 4), [tx, ty] = pt(a, R + 17);
        out += `<line class="lw-grid" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke-width="2"/>`;
        out += `<text class="lw-tick" x="${f1(tx)}" y="${f1(ty + 4)}" text-anchor="middle">${label}</text>`;
      }
      // error arc from yaw to goal, drawn the way the law turns
      const n = Math.max(2, Math.ceil(Math.abs(err) / 0.06));
      const pts: string[] = [];
      for (let i = 0; i <= n; i++) pts.push(pt(yaw + (err * i) / n, RA).map((v) => v.toFixed(1)).join(','));
      // arrow head at the end of the arc, along the direction of travel (counter-clockwise when err > 0)
      const end = yaw + err, dir = err >= 0 ? 1 : -1;
      const [ax, ay] = pt(end, RA);
      const tip = [ax + 10 * dir * -Math.sin(end), ay + 10 * dir * -Math.cos(end)];
      const [b1x, b1y] = pt(end, RA + 5), [b2x, b2y] = pt(end, RA - 5);
      if (Math.abs(err) > 0.005) {
        out += `<g class="lw-c-${longWay ? 'red' : 'blue'}"><polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
        out += `<polygon points="${f1(tip[0])},${f1(tip[1])} ${f1(b1x)},${f1(b1y)} ${f1(b2x)},${f1(b2y)}" fill="currentColor"/></g>`;
      }
      // goal (green flag) and car heading (amber arrow)
      const [gx, gy] = pt(goal, R);
      out += `<g class="lw-c-green"><line x1="${CX}" y1="${CY}" x2="${f1(gx)}" y2="${f1(gy)}" stroke="currentColor" stroke-width="2" stroke-dasharray="5 4"/>`;
      out += `<circle cx="${f1(gx)}" cy="${f1(gy)}" r="6" fill="currentColor"/></g>`;
      const [hx, hy] = pt(yaw, R - 2), [mx, my] = pt(yaw, R - 16);
      const [tx, ty] = [-Math.sin(yaw), -Math.cos(yaw)]; // screen direction of increasing yaw (perpendicular to the arrow)
      out += `<g class="lw-c-amber"><line x1="${CX}" y1="${CY}" x2="${f1(mx)}" y2="${f1(my)}" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`;
      out += `<polygon points="${f1(hx)},${f1(hy)} ${f1(mx + 7 * tx)},${f1(my + 7 * ty)} ${f1(mx - 7 * tx)},${f1(my - 7 * ty)}" fill="currentColor"/></g>`;
      out += `<circle cx="${CX}" cy="${CY}" r="4" class="lw-lidar"/>`;
      // steering bar: left on the left, as seen from the car
      const bar = { x0: 40, x1: 320, y: 258 };
      const mid = (bar.x0 + bar.x1) / 2;
      const half = (bar.x1 - bar.x0) / 2;
      const sx = mid - (steer / STEER_LIMIT) * half;
      out += `<line class="lw-frame" x1="${bar.x0}" y1="${bar.y}" x2="${bar.x1}" y2="${bar.y}" stroke-width="1"/>`;
      for (const x of [bar.x0, mid, bar.x1]) out += `<line class="lw-grid" x1="${x}" y1="${bar.y - 7}" x2="${x}" y2="${bar.y + 7}" stroke-width="2"/>`;
      out += `<g class="lw-c-${saturated ? 'red' : 'amber'}"><line x1="${mid}" y1="${bar.y}" x2="${f1(sx)}" y2="${bar.y}" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></g>`;
      out += `<text class="lw-tick" x="${bar.x0}" y="${bar.y + 24}" text-anchor="middle">izquierda</text>`;
      out += `<text class="lw-tick" x="${bar.x1}" y="${bar.y + 24}" text-anchor="middle">derecha</text>`;
      out += `<text class="lw-tick" x="${mid}" y="${bar.y - 14}" text-anchor="middle">volante (límite ±${fmt(STEER_LIMIT, 3)} rad)</text>`;
      scene.innerHTML = out;
    }
    function read(): void {
      const { raw, err, unclamped, steer, saturated } = law();
      const side = Math.abs(steer) < 1e-9 ? 'recto' : steer > 0 ? 'a la izquierda' : 'a la derecha';
      rd.set(
        [
          ['goal − yaw', `${fmt(raw, 2)} rad`],
          [useWrap ? 'error con wrap' : 'error sin wrap', `${fmt(err, 2)} rad`],
          ['KP · error', `${fmt(unclamped, 3)} rad`],
          ['heading_steer', `${fmt(steer, 3)} rad (${fmt((steer * 180) / PI, 1)}°)${saturated ? ', tope' : ''}`],
        ],
        `Meta ${fmt(goal, 2)} radianes, rumbo ${fmt(yaw, 2)}. Volante ${fmt(steer, 3)} radianes ${side}${saturated ? ', al tope' : ''}.`,
      );
      const long = Math.abs(err) > PI + 1e-9;
      note.textContent = long
        ? `Sin wrap el error es ${fmt(raw, 2)} rad: el coche gira ${side} por el camino largo, casi una vuelta, aunque la meta está al otro lado de ±π, a ${fmt(Math.abs(wrap(raw)), 2)} rad.`
        : saturated
          ? `Error grande: KP · error (${fmt(unclamped, 2)} rad) pasa del tope y el volante se queda en ${fmt(STEER_LIMIT, 3)} rad.`
          : `Error pequeño: el volante es proporcional (0,8 por el error) y no llega al tope de ${fmt(STEER_LIMIT, 3)} rad.`;
      svg.setAttribute(
        'aria-label',
        `Brújula: meta a ${fmt(goal, 2)} radianes, coche a ${fmt(yaw, 2)}. El volante pide ${fmt(steer, 3)} radianes, ${side}.`,
      );
    }

    function update(): void {
      draw();
      read();
    }

    const goalS = slider({
      label: 'Meta (goal)',
      min: -3.14,
      max: 3.14,
      step: 0.01,
      value: goal,
      format: (v) => `${fmt(v, 2)} rad`,
      onInput: (v) => {
        goal = v;
        update();
      },
    });
    const yawS = slider({
      label: 'Rumbo del coche (yaw)',
      min: -3.14,
      max: 3.14,
      step: 0.01,
      value: yaw,
      format: (v) => `${fmt(v, 2)} rad`,
      onInput: (v) => {
        yaw = v;
        update();
      },
    });
    const wrapT = toggle('Usar wrap (camino corto)', useWrap, (v) => {
      useWrap = v;
      update();
    });
    const preset = (g: number, y: number) => () => {
      goal = g;
      yaw = y;
      goalS.set(g);
      yawS.set(y);
      update();
    };
    const small = button('Error pequeño (0,1 rad)', preset(0.1, 0));
    const big = button('Error grande (satura)', preset(1.5, 0));
    const edge = button('Meta 3 rad, coche en −3 rad', preset(3, -3));
    const again = button('Reiniciar', () => {
      useWrap = true;
      wrapT.input.checked = true;
      preset(DEFAULTS.goal, DEFAULTS.yaw)();
    });

    root.append(
      h('div', { class: 'lw-figure' }, svg),
      legend([
        ['green', 'meta (goal)'],
        ['amber', 'rumbo del coche (yaw)'],
        ['blue', 'error: por dónde gira el coche'],
      ]),
      h('div', { class: 'lw-controls' }, goalS.root, yawS.root),
      h('div', { class: 'lw-actions' }, wrapT.root, small, big, edge, again),
      rd.root,
      note,
    );
    update();
  });
}
