import React from 'react';
import { Frame, Card, B, Stat, useT, timeMap, fadeIn } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, FONT, MONO, num } from '../theme';
import { at, doneTime, run } from '../sim';

export const PASO7_SECONDS = 42;

const STATES: { id: 'SETUP' | 'RUN' | 'STOP'; x: number; what: string }[] = [
  { id: 'SETUP', x: 0, what: 'espera Start, calibra 0,3 s, mide la pared, espera el sentido' },
  { id: 'RUN', x: 330, what: 'la ley de rumbo de los pasos 2 a 6' },
  { id: 'STOP', x: 660, what: 'parada definitiva, guarda el motivo' },
];

export const Paso7: React.FC = () => {
  const t = useT();
  const lane = run({ direction: 'ccw' });
  const end = doneTime(lane);
  const simT = timeMap(t, [[0, 0], [2, 0.5], [7, 1.4], [27, 29.7], [35, end + 0.1]]);
  const q = at(lane, simT);
  const fromStart = Math.max(0, simT - 0.5);
  const lap = Math.min(3, Math.floor(q.completed / 4) + 1);
  return (
    <Frame id="Paso7" subtitle="Las piezas, unidas en una máquina de estados: tres vueltas y parar">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={poseOf(q)} trail={lane.filter((p) => p.t <= simT && p.t >= 0.5)}
          overlay={(m) => {
            if (q.label !== 'FINISH' && q.label !== 'DONE' && !(q.state === 'SETUP' && q.started)) return null;
            const [px, py] = m(q.x, q.y);
            return (
              <g>
                <line x1={px + 30} y1={py} x2={m(1.5, q.y)[0]} y2={py} stroke={C.yellow} strokeWidth={4} strokeDasharray="10 8" />
                <text x={px - 10} y={py + 70} fill={C.yellow} fontSize={26} fontFamily={FONT} fontWeight={800} stroke="#f3f0e8" strokeWidth={6} paintOrder="stroke">
                  {q.state === 'SETUP' ? 'mide la pared de enfrente' : 'frena al volver a esa distancia'}
                </text>
              </g>
            );
          }} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <svg width={990} height={250}>
          <defs>
            <marker id="arr" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
              <path d="M0,0 L12,6 L0,12 z" fill={C.dim} />
            </marker>
          </defs>
          {STATES.map((s, i) => {
            const active = q.state === s.id && (s.id !== 'SETUP' || q.started);
            return (
              <g key={s.id}>
                {i < 2 && <line x1={s.x + 270} y1={70} x2={s.x + 325} y2={70} stroke={C.dim} strokeWidth={4} markerEnd="url(#arr)" />}
                <rect x={s.x} y={20} width={270} height={100} rx={18} fill={active ? C.accent : C.panel} stroke={active ? C.accent : C.line} strokeWidth={3} />
                <text x={s.x + 135} y={84} textAnchor="middle" fontSize={40} fontWeight={900} fontFamily={MONO} fill={active ? '#06231a' : C.text}>{s.id}</text>
                <foreignObject x={s.x} y={130} width={280} height={110}>
                  <div style={{ fontSize: 21, color: active ? C.text : C.dim, fontFamily: FONT, lineHeight: 1.25 }}>{s.what}</div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Stat label="label" value={<span style={{ fontFamily: MONO }}>{q.started ? q.label : 'WAIT'}</span>} color={C.yellow} />
          <Stat label="esquinas" value={`${q.completed} / 12`} />
          <Stat label="vuelta" value={q.state === 'RUN' || q.state === 'STOP' ? `${lap} / 3` : '—'} />
          <Stat label="velocidad" value={`${num(q.speed)} m/s`} color={(q.label === 'FOLLOW' || q.label === 'TURN') && q.speed < 0.585 ? C.orange : C.text} />
          <Stat label="desde Start" value={`${num(fromStart, 1)} s`} />
        </div>
        <Card t={t} from={1} to={8} x={0} y={380} w={960}>
          Dentro de <B>RUN</B> no hay más estados: solo dos datos, <B>completed</B> (esquinas hechas) y <B>arc</B> (si hay una en curso).
          Menos estados, menos casos que probar.
        </Card>
        <Card t={t} from={8.3} to={14.2} x={0} y={380} w={960} accent={C.yellow}>
          Una vuelta son 4 esquinas; la ronda, 3 vueltas: <B>12 esquinas</B>.
          <div style={{ marginTop: 8, color: C.dim }}>La lógica es Python puro (mission.py): se prueba con pytest, sin Gazebo.</div>
        </Card>
        <Card t={t} from={14.5} to={20.6} x={0} y={380} w={960} accent={C.orange}>
          Antes de <B c={C.orange}>cada</B> esquina el coche frena: de 1,28 a 1,0 m/s pedidos (0,60 a 0,53 reales).
          La misma velocidad en las 12 esquinas.
        </Card>
        <Card t={t} from={20.9} to={26.5} x={0} y={380} w={960} accent={C.violet}>
          El giroscopio deriva. En cada recta, la <B c={C.violet}>pared de la isla</B> corrige el rumbo:
          una parte de la diferencia con cada escaneo.
        </Card>
        <Card t={t} from={26.8} x={0} y={380} w={960} accent={C.orange}>
          El final: a 0,15 hasta que la pared de enfrente está como en la salida. No frena torcido: <B>espera a ir recto</B>.
          El freno <B c={C.orange}>se enclava</B>: un rayo con ruido no reinicia el motor.
        </Card>
        <div style={{ position: 'absolute', top: 640, left: 0, fontSize: 24, color: C.dim, opacity: fadeIn(t, 35) }}>
          Animación: la estrategia portada a TypeScript con sensores ideales. Lab: 33,78 s · Gazebo: 35,56 s.
        </div>
      </div>
    </Frame>
  );
};
