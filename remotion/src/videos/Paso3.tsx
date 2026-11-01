import React from 'react';
import { interpolate } from 'remotion';
import { Frame, Card, Code, B, useT, fadeIn } from '../components/ui';
import { Field } from '../components/Field';
import { C, MONO, num } from '../theme';
import { perceive } from '../sim';

export const PASO3_SECONDS = 34;

export const Paso3: React.FC = () => {
  const t = useT();
  const x = interpolate(t, [18, 30], [-0.6, 0.62], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pose = { x, y: -0.75, yaw: 0, steer: 0 };
  const sc = perceive(pose.x, pose.y, pose.yaw, 0, 1);
  const shown = (from: number) => t >= from;
  const scene = {
    left: shown(8) ? sc.left : Infinity,
    right: shown(10.5) ? sc.right : Infinity,
    front: shown(12.5) ? sc.front : Infinity,
    islandEnd: shown(15) ? sc.islandEnd : Infinity,
    sign: 1, forwardYaw: 0,
  };
  const rows: [string, number, string, string, number][] = [
    ['left', sc.left, C.accent, 'mediana de los rayos alrededor de +90°', 8],
    ['right', sc.right, C.violet, 'mediana de los rayos alrededor de −90°', 10.5],
    ['front_axis', sc.front, C.yellow, 'pared de enfrente, a lo largo de la pista', 12.5],
    ['island_end', sc.islandEnd, C.orange, 'dónde termina la pared de la isla', 15],
  ];
  return (
    <Frame id="Paso3" subtitle="Un escaneo del LiDAR se convierte en cuatro números">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={pose} rays={t < 8.5 || t > 30.5} scene={t >= 8 ? scene : undefined} zoom={{ cx: 0.4, cy: -0.75, span: 2.3 }} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <Card t={t} from={0.8} to={7.6} x={0} y={0} w={960} accent={C.red}>
          El <B c={C.red}>LiDAR</B> gira y mide la distancia en cada dirección. Un escaneo del LD19:
          <ul style={{ margin: '12px 0 0', paddingLeft: 30 }}>
            <li><B>306 rayos</B> en un abanico de ±110°</li>
            <li>de 0,12 a 12 m, un rayo cada 0,72°</li>
            <li>montado <B>0,128 m</B> delante del centro del coche</li>
            <li>10 escaneos por segundo</li>
          </ul>
        </Card>
        {t >= 7.8 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: 960, opacity: fadeIn(t, 7.8) }}>
            <div style={{ fontSize: 26, color: C.dim, marginBottom: 10 }}>La escena: cuatro números (m)</div>
            {rows.map(([name, v, col, what, from]) => {
              const a = fadeIn(t, from);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 20, background: C.panel, borderRadius: 12, padding: '14px 20px', marginBottom: 12, opacity: 0.25 + 0.75 * a, borderLeft: `8px solid ${col}` }}>
                  <div style={{ fontFamily: MONO, fontSize: 32, color: col, width: 220, fontWeight: 700 }}>{name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, width: 140, textAlign: 'right' }}>{a > 0 ? num(v) : ''}</div>
                  <div style={{ fontSize: 24, color: C.dim, flex: 1 }}>{what}</div>
                </div>
              );
            })}
          </div>
        )}
        <Card t={t} from={17.5} to={23.5} x={0} y={440} w={960} accent={C.accent}>
          <B c={C.accent}>Mediana, no promedio.</B> Si un rayo se cuela por un hueco y vuelve con 9 m,
          el promedio se va 14 cm; la mediana ni se entera.
        </Card>
        <Card t={t} from={23.8} to={30.5} x={0} y={440} w={960} accent={C.orange}>
          <B c={C.orange}>island_end</B>: una recta ajustada a la pared de la isla y el último rayo que sigue sobre ella.
          Cuando el coche deja atrás la isla, <B c={C.accent}>left</B> salta a la pared lejana.
        </Card>
        <Card t={t} from={30.6} x={0} y={440} w={960}>
          Lo que no se ve vale <B>∞</B> («no hay pared»). Todo lo que viene después usa estos cuatro números.
          <Code size={24}>{'scene = perceive(scan, forward_yaw)'}</Code>
        </Card>
      </div>
    </Frame>
  );
};
