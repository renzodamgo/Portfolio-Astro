import React from 'react';
import { Frame, Card, Code, B, Plot, Stat, useT, timeMap, fadeIn } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, num } from '../theme';
import { STEER_LIMIT, at, run, wrap } from '../sim';

export const PASO5_SECONDS = 38;

const deg = (r: number) => (r * 180) / Math.PI;

export const Paso5: React.FC = () => {
  const t = useT();
  const lane = run({ direction: 'ccw' });
  const simT = timeMap(t, [[0, 1.7], [3, 1.7], [17, 3.5], [25, 3.5], [35, 12.6]]);
  const q = at(lane, simT);
  const zoomA = Math.min(1, Math.max(0, (t - 25) / 1.5));
  const zoom = {
    cx: 0.75 * (1 - zoomA), cy: -0.75 * (1 - zoomA), span: 1.7 + (3.3 - 1.7) * zoomA,
  };
  const corner = lane.filter((p) => p.t >= 1.7 && p.t <= 3.5);
  const ramping = q.arc && q.ref !== q.goal;
  const fade = Math.min(1, Math.max(0, wrap(q.goal - q.myYaw)) / 0.25);
  const ff = ramping ? STEER_LIMIT * fade : 0;
  const plotUpTo = Math.min(simT, 3.5);

  return (
    <Frame id="Paso5" subtitle="Girar 90° es mover la meta; la referencia sube en rampa">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={poseOf(q)} trail={lane.filter((p) => p.t <= simT && p.t >= 0.5)} zoom={zoom}
          overlay={(m) => {
            if (t > 25) return null;
            const [px, py] = m(q.x, q.y);
            const L = 150;
            const arrow = (a: number, color: string, label: string, dy: number) => (
              <g>
                <line x1={px} y1={py} x2={px + L * Math.cos(a)} y2={py - L * Math.sin(a)} stroke={color} strokeWidth={6} strokeLinecap="round" />
                <text x={px + L * Math.cos(a) + 10} y={py - L * Math.sin(a) + dy} fill={color} fontSize={26} fontWeight={800} fontFamily="Helvetica Neue">{label}</text>
              </g>
            );
            return (
              <g opacity={fadeIn(t, 3)}>
                {arrow(q.goal, C.accent, 'meta', -8)}
                {arrow(q.ref, C.violet, 'ref', 26)}
              </g>
            );
          }} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <Card t={t} from={0.6} to={8.5} x={0} y={0} w={960}>
          Girar a la izquierda es sumar <B>+90°</B> a la <B c={C.accent}>meta</B>.
          Si la meta salta de golpe, el volante va al tope y, con un servo lento, el coche <B c={C.red}>se pasa</B>.
        </Card>
        <Card t={t} from={8.7} to={17.5} x={0} y={0} w={960} accent={C.violet}>
          La ley sigue una <B c={C.violet}>referencia</B> que sube en rampa a lo que el coche puede girar de verdad:
          <Code size={25}>{'rate = 0,60 m/s · tan(17,6°) / 0,1174 m ≈ 1,62 rad/s'}</Code>
          <div style={{ marginTop: 8, color: C.dim }}>90° en unos 0,97 s.</div>
        </Card>
        {t > 3 && t < 25.3 && (
          <div style={{ opacity: Math.min(fadeIn(t, 3), 1 - fadeIn(t, 24.8)) }}>
            <Plot x={0} y={300} w={960} h={330} t0={1.7} t1={3.5} y0={-10} y1={100} upTo={plotUpTo}
              yLabel="rumbo (°)" xLabel="t desde Start (s)" yTicks={[0, 45, 90]} fmt={(v) => `${v}°`}
              series={[
                { values: corner.map((p) => [p.t, deg(p.goal)]), color: C.accent, label: 'meta' },
                { values: corner.map((p) => [p.t, deg(p.ref)]), color: C.violet, label: 'ref' },
                { values: corner.map((p) => [p.t, deg(p.myYaw)]), color: C.yellow, label: 'rumbo' },
              ]} />
            <div style={{ position: 'absolute', top: 650, left: 0, width: 960, display: 'flex', gap: 12 }}>
              <Stat label="volante" value={`${num(deg(q.steer), 1)}°`} color={C.car} />
              <Stat label="anticipación (FF)" value={`${num(deg(ff), 1)}°`} color={C.orange} />
              <Stat label="giro medido" value={`${num(q.gyro)} rad/s`} />
            </div>
          </div>
        )}
        <Card t={t} from={17.7} to={25.3} x={0} y={0} w={960} accent={C.orange}>
          Dos términos más:
          <ul style={{ margin: '8px 0 0', paddingLeft: 30 }}>
            <li><B c={C.orange}>anticipar</B>: volante al tope mientras sube la rampa, y aflojarlo en el último cuarto de radián</li>
            <li><B>amortiguar</B>: si ya gira más rápido de lo esperado, soltar</li>
          </ul>
        </Card>
        <Card t={t} from={25.5} x={0} y={0} w={960}>
          La fórmula completa de un tick:
          <Code size={23}>{'volante = 0,8 · wrap(ref − yaw)\n        + anticipación\n        − 0,1 · (gyro − giro esperado)'}</Code>
          <div style={{ marginTop: 10 }}>La misma ley en rectas y esquinas. Termina a 0,12 rad de la meta.</div>
        </Card>
        <Card t={t} from={28} x={0} y={380} w={960} accent={C.yellow}>
          Esquina tras esquina, el coche ya da la vuelta. Pero <B>cuándo</B> empezar cada giro es el paso 6.
        </Card>
      </div>
    </Frame>
  );
};
