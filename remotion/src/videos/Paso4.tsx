import React from 'react';
import { Frame, Card, Code, B, Plot, Stat, useT, fadeIn, timeMap } from '../components/ui';
import { Car, Field, poseOf } from '../components/Field';
import { C, FONT, num } from '../theme';
import { STEER_LIMIT, WHEELBASE, at, run, wrap } from '../sim';

export const PASO4_SECONDS = 36;

const GAP = 0.25, GAIN = 0.3, LIMIT = 0.4;

// The guide's bench: an endless island wall, command 0.6 (0.42 m/s real), start 0.45 m away, exact gap.
const bench = (() => {
  const out: { t: number; x: number; gap: number; yaw: number; steer: number; bias: number }[] = [];
  let x = 0, gap = 0.45, yaw = 0, wheel = 0;
  const v = 0.42;
  for (let k = 0; k <= 750; k++) {
    const t = k * 0.02;
    const rate = (v * Math.tan(wheel)) / WHEELBASE;
    const bias = Math.max(-LIMIT, Math.min(LIMIT, GAIN * (gap - GAP)));
    const steer = Math.max(-STEER_LIMIT, Math.min(STEER_LIMIT, 0.8 * wrap(bias - yaw) - 0.1 * rate));
    out.push({ t, x, gap, yaw, steer, bias });
    wheel += (steer - wheel) * 0.4;
    yaw += rate * 0.02;
    x += v * Math.cos(yaw) * 0.02;
    gap -= v * Math.sin(yaw) * 0.02;
  }
  return out;
})();

const STRIP = 760;
const SPX = 330; // px per metre in the strip view

export const Paso4: React.FC = () => {
  const t = useT();
  const bt = Math.max(0, Math.min(14.9, t - 3));
  const b = bench[Math.round(bt / 0.02)];
  // strip view: island wall on top (y = 0), the car below it at `gap`, camera follows x
  const mStrip = (x: number, y: number): [number, number] => [STRIP * 0.4 + (x - b.x) * SPX, 160 + y * SPX];
  const lane = run({ direction: 'ccw' });
  const stopT = lane.find((p) => p.state === 'RUN' && p.scene.front <= 1.19)!.t;
  const simT = timeMap(t, [[22, 0.5], [29.5, stopT]]);
  const q = at(lane, simT);
  const stopped = t > 29.5;
  const fieldA = fadeIn(t, 21.5);

  return (
    <Frame id="Paso4" subtitle="Mantener 25 cm de la isla corrigiendo el rumbo, no el volante">
      {t < 22 ? (
        <svg width={STRIP} height={STRIP} style={{ position: 'absolute', left: 0, top: 0, borderRadius: 18, opacity: 1 - fadeIn(t, 21.4, 0.6) }}>
          <rect width={STRIP} height={STRIP} fill={C.mat} />
          {Array.from({ length: 30 }, (_, i) => {
            const gx = Math.floor(b.x / 0.5) * 0.5 + (i - 10) * 0.5;
            const [px] = mStrip(gx, 0);
            return <line key={i} x1={px} x2={px} y1={0} y2={STRIP} stroke={C.matLine} strokeWidth={2} />;
          })}
          <rect x={0} y={0} width={STRIP} height={160} fill={C.wall} />
          <text x={24} y={100} fill="#8a96a8" fontSize={30} fontFamily={FONT} fontWeight={700}>isla</text>
          <rect x={0} y={160 + 1.0 * SPX} width={STRIP} height={STRIP} fill={C.wall} />
          <line x1={0} x2={STRIP} y1={160 + GAP * SPX} y2={160 + GAP * SPX} stroke={C.accent} strokeWidth={4} strokeDasharray="16 10" />
          <text x={20} y={160 + GAP * SPX + 34} fill={C.accent} fontSize={26} fontFamily={FONT} fontWeight={800}>GAP = 0,25 m</text>
          {(() => {
            const path = bench.filter((p) => p.t <= bt).map((p, i) => `${i ? 'L' : 'M'} ${mStrip(p.x, p.gap).join(' ')}`).join(' ');
            return <path d={path} stroke={C.yellow} strokeWidth={5} fill="none" />;
          })()}
          {(() => {
            const [cx, cy] = mStrip(b.x + 0.06, b.gap);
            return (
              <g>
                <line x1={cx} x2={cx} y1={160} y2={cy} stroke={C.accent} strokeWidth={5} />
                <text x={cx + 14} y={(160 + cy) / 2 + 10} fill={C.accent} fontSize={32} fontFamily={FONT} fontWeight={800}>hueco {num(b.gap)} m</text>
              </g>
            );
          })()}
          <g>
            {(() => {
              const m = (x: number, y: number): [number, number] => mStrip(x, -y);
              return <Car pose={{ x: b.x, y: -b.gap, yaw: b.yaw, steer: b.steer }} m={m} s={SPX} />;
            })()}
          </g>
          {(() => {
            const [cx, cy] = mStrip(b.x, b.gap);
            const L = 200;
            return (
              <g opacity={fadeIn(t, 6)}>
                <line x1={cx} y1={cy} x2={cx + L * Math.cos(b.bias)} y2={cy - L * Math.sin(b.bias)} stroke={C.violet} strokeWidth={5} strokeDasharray="10 7" />
                <text x={cx + L * Math.cos(b.bias) + 10} y={cy - L * Math.sin(b.bias) - 6} fill={C.violet} fontSize={26} fontFamily={FONT} fontWeight={800}>meta + desvío</text>
              </g>
            );
          })()}
        </svg>
      ) : (
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: fieldA }}>
          <Field size={760} pose={poseOf(q)} trail={lane.filter((p) => p.t <= simT)} lane
            scene={{ ...q.scene, sign: 1, forwardYaw: wrap(q.goal - q.myYaw) }}
            overlay={(m) => stopped ? (
              <text x={m(0.0, -1.25)[0]} y={m(0.0, -1.25)[1]} fill={C.red} fontSize={34} fontFamily={FONT} fontWeight={800}>alto: front_axis ≤ 1,19 m</text>
            ) : null} />
        </div>
      )}

      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <Card t={t} from={0.6} to={21.8} x={0} y={0} w={960} accent={C.violet}>
          Más lejos de lo debido: apunta un poco hacia la isla. Más cerca: un poco hacia fuera.
          Se mueve la <B c={C.violet}>meta del rumbo</B>; la ley del paso 2 hace el resto.
          <Code size={26}>{'desvío  = clamp(sign · GAIN · (hueco − GAP), ±LIMIT)\nvolante = ley de rumbo(meta + desvío)'}</Code>
          <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
            <Stat label="GAP" value="0,25 m" color={C.accent} />
            <Stat label="GAIN" value="0,3 rad/m" />
            <Stat label="LIMIT" value="0,4 rad" />
            <Stat label="desvío ahora" value={`${num(b.bias, 3)} rad`} color={C.violet} />
          </div>
        </Card>
        {t > 3 && t < 22 && (
          <div style={{ opacity: Math.min(fadeIn(t, 3), 1 - fadeIn(t, 21.4)) }}>
            <Plot x={0} y={420} w={960} h={330} t0={0} t1={15} y0={0.2} y1={0.47} upTo={bt}
              yLabel="hueco a la isla (m)" yTicks={[0.25, 0.3, 0.35, 0.4, 0.45]} fmt={(v) => num(v)}
              hlines={[{ v: 0.25, color: C.accent, label: 'GAP' }]}
              series={[{ values: bench.filter((_, i) => i % 5 === 0).map((p) => [p.t, p.gap]), color: C.yellow, label: 'hueco (banco de la guía, 0,42 m/s)' }]} />
          </div>
        )}
        <Card t={t} from={14} to={21.8} x={0} y={420} w={960} accent={C.yellow} style={{ background: 'rgba(23,34,52,0.96)' }}>
          Baja <B>sin pasarse</B>: el error cae a la mitad cada pocos segundos. Lento a propósito; una ganancia pequeña es segura.
        </Card>
        <Card t={t} from={22.3} x={0} y={0} w={960}>
          En el campo, con el comando de la ronda (1,28 → 0,60 m/s). Dos detalles:
          <ul style={{ margin: '12px 0 0', paddingLeft: 30 }}>
            <li>si no se ve la isla (<B>∞</B>), no se corrige: desvío 0</li>
            <li><B>front_axis</B> se mide a lo largo de la pista, aunque el coche vaya torcido</li>
          </ul>
        </Card>
        <Card t={t} from={29.5} x={0} y={330} w={960} accent={C.red}>
          Por ahora el coche <B c={C.red}>se para</B> cuando la pared de enfrente está a <B>1,19 m</B> o menos.
          Ahí empezará la esquina, en el paso 5.
        </Card>
      </div>
    </Frame>
  );
};
