import React from 'react';
import { Frame, Card, Code, B, Plot, Stat, useT, timeMap, fadeIn } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, num } from '../theme';
import { TURN_TOLERANCE, at, run, wrap } from '../sim';

export const PASO5_SECONDS = 38;

const deg = (r: number) => (r * 180) / Math.PI;
const T0 = 1.9, T1 = 3.9; // the first corner: it starts at 2.1 s, full lock ends at 3.1 s

export const Paso5: React.FC = () => {
  const t = useT();
  const lane = run({ direction: 'ccw' });
  const simT = timeMap(t, [[0, T0], [3, T0], [17, T1], [25, T1], [35, 12.6]]);
  const q = at(lane, simT);
  const zoomA = Math.min(1, Math.max(0, (t - 25) / 1.5));
  const zoom = {
    cx: 0.7 * (1 - zoomA), cy: -0.55 * (1 - zoomA), span: 1.9 + (3.3 - 1.9) * zoomA,
  };
  const corner = lane.filter((p) => p.t >= T0 && p.t <= T1);
  const left = wrap(q.goal - q.myYaw); // what is left to the goal
  const fullLock = q.arc && Math.abs(left) > TURN_TOLERANCE;
  const plotUpTo = Math.min(simT, T1);

  return (
    <Frame id="Paso5" subtitle="Girar 90° es mover la meta: volante a tope y soltar a tiempo">
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
                {q.goal !== 0 && arrow(q.goal - TURN_TOLERANCE, C.violet, 'soltar', 26)}
              </g>
            );
          }} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <Card t={t} from={0.6} to={8.5} x={0} y={0} w={960}>
          Girar a la izquierda es sumar <B>+90°</B> a la <B c={C.accent}>meta</B>.
          Con 90° de error la ley de rumbo pide 1,26 rad y el volante solo da 0,307: va <B c={C.orange}>a tope</B> casi toda la esquina.
        </Card>
        <Card t={t} from={8.7} to={17.5} x={0} y={0} w={960} accent={C.violet}>
          Lo difícil es <B c={C.violet}>soltar a tiempo</B>. El servo tarda en enderezar las ruedas y el coche sigue girando.
          <Code size={25}>{'si falta más de 0,3 rad (17°):  a tope\nsi no:  ley de rumbo con freno'}</Code>
        </Card>
        {t > 3 && t < 25.3 && (
          <div style={{ opacity: Math.min(fadeIn(t, 3), 1 - fadeIn(t, 24.8)) }}>
            <Plot x={0} y={300} w={960} h={330} t0={T0} t1={T1} y0={-10} y1={100} upTo={plotUpTo}
              yLabel="rumbo (°)" xLabel="t desde Start (s)" yTicks={[0, 45, 90]} fmt={(v) => `${v}°`}
              series={[
                { values: corner.map((p) => [p.t, deg(p.goal)]), color: C.accent, label: 'meta' },
                { values: corner.map((p) => [p.t, p.goal === 0 ? 0 : deg(p.goal - TURN_TOLERANCE)]), color: C.violet, label: 'soltar' },
                { values: corner.map((p) => [p.t, deg(p.myYaw)]), color: C.yellow, label: 'rumbo' },
              ]} />
            <div style={{ position: 'absolute', top: 650, left: 0, width: 960, display: 'flex', gap: 12 }}>
              <Stat label="volante" value={`${num(deg(q.steer), 1)}°${fullLock ? ' (tope)' : ''}`} color={fullLock ? C.orange : C.car} />
              <Stat label="falta para la meta" value={`${num(deg(left), 1)}°`} color={C.violet} />
              <Stat label="giro medido" value={`${num(q.gyro)} rad/s`} />
            </div>
          </div>
        )}
        <Card t={t} from={17.7} to={25.3} x={0} y={0} w={960} accent={C.orange}>
          Medido con el servo real:
          <ul style={{ margin: '8px 0 0', paddingLeft: 30 }}>
            <li>soltar a <B c={C.red}>3°</B> de la meta: se pasa <B c={C.red}>12°</B></li>
            <li>soltar a <B c={C.accent}>17°</B>: se pasa <B c={C.accent}>0°</B></li>
            <li><B>amortiguar</B>: cuanto más rápido gira, menos volante</li>
          </ul>
        </Card>
        <Card t={t} from={25.5} x={0} y={0} w={960}>
          La ley que termina la esquina y lleva toda la recta:
          <Code size={23}>{'volante = 0,8 · wrap(meta − yaw)\n        − 0,1 · gyro'}</Code>
          <div style={{ marginTop: 10 }}>Siempre dentro del tope del volante (17,6°).</div>
        </Card>
        <Card t={t} from={28} x={0} y={380} w={960} accent={C.yellow}>
          Esquina tras esquina, el coche ya da la vuelta. Pero <B>cuándo</B> empezar cada giro es el paso 6.
        </Card>
      </div>
    </Frame>
  );
};
