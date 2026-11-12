import React from 'react';
import { interpolate } from 'remotion';
import { Frame, Card, Code, B, useT, fadeIn } from '../components/ui';
import { Field } from '../components/Field';
import { C, MONO, num } from '../theme';
import { perceive } from '../sim';

export const PASO3_SECONDS = 34;

export const Paso3: React.FC = () => {
  const t = useT();
  const x = interpolate(t, [20, 30], [-0.6, 0.62], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // the car turns 0.1 rad to the left for a moment, to show wall_heading
  const yaw = interpolate(t, [15.2, 16.2, 18.6, 19.6], [0, 0.1, 0.1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const pose = { x, y: -0.75, yaw, steer: 0 };
  const sc = perceive(pose.x, pose.y, pose.yaw, -yaw, 1);
  const shown = (from: number) => t >= from;
  const scene = {
    left: shown(7.5) ? sc.left : Infinity,
    right: shown(9.3) ? sc.right : Infinity,
    front: shown(11.1) ? sc.front : Infinity,
    islandEnd: shown(12.9) ? sc.islandEnd : Infinity,
    sign: 1, forwardYaw: -yaw,
  };
  const rows: [string, number, string, string, number][] = [
    ['left', sc.left, C.accent, 'mediana de los rayos alrededor de +90°', 7.5],
    ['right', sc.right, C.violet, 'mediana de los rayos alrededor de −90°', 9.3],
    ['front_axis', sc.front, C.yellow, 'pared de enfrente, a lo largo de la pista', 11.1],
    ['island_end', sc.islandEnd, C.orange, 'dónde termina la pared de la isla', 12.9],
    ['wall_heading', sc.wallHeading, C.red, 'giro del coche respecto a esa pared (rad)', 14.7],
  ];
  return (
    <Frame id="Paso3" subtitle="Un escaneo del LiDAR se convierte en cinco números">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={pose} rays={t < 8 || t > 30.5} scene={t >= 7.5 ? scene : undefined} zoom={{ cx: 0.4, cy: -0.75, span: 2.3 }} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <Card t={t} from={0.8} to={7.1} x={0} y={0} w={960} accent={C.red}>
          El <B c={C.red}>LiDAR</B> gira y mide la distancia en cada dirección. Un escaneo del LD19:
          <ul style={{ margin: '12px 0 0', paddingLeft: 30 }}>
            <li><B>306 rayos</B> en un abanico de ±110°</li>
            <li>de 0,12 a 12 m, un rayo cada 0,72°</li>
            <li>montado <B>0,128 m</B> delante del centro del coche</li>
            <li>10 escaneos por segundo</li>
          </ul>
        </Card>
        {t >= 7.3 && (
          <div style={{ position: 'absolute', left: 0, top: 0, width: 960, opacity: fadeIn(t, 7.3) }}>
            <div style={{ fontSize: 26, color: C.dim, marginBottom: 8 }}>La escena: cinco números (cuatro distancias en m y un ángulo)</div>
            {rows.map(([name, v, col, what, from]) => {
              const a = fadeIn(t, from);
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 20, background: C.panel, borderRadius: 12, padding: '9px 20px', marginBottom: 9, opacity: 0.25 + 0.75 * a, borderLeft: `8px solid ${col}` }}>
                  <div style={{ fontFamily: MONO, fontSize: 32, color: col, width: 250, fontWeight: 700 }}>{name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, width: 130, textAlign: 'right' }}>{a > 0 ? num(v) : ''}</div>
                  <div style={{ fontSize: 24, color: C.dim, flex: 1 }}>{what}</div>
                </div>
              );
            })}
          </div>
        )}
        <Card t={t} from={14.9} to={19.9} x={0} y={452} w={960} accent={C.red}>
          <B c={C.red}>wall_heading</B>: la pared de la isla es una recta. Su pendiente dice cuánto está girado el coche respecto a ella.
          Con el coche girado 0,1 rad, da 0,10.
        </Card>
        <Card t={t} from={20.1} to={24.3} x={0} y={452} w={960} accent={C.accent}>
          <B c={C.accent}>Mediana, no promedio.</B> Si un rayo se cuela por un hueco y vuelve con 9 m,
          el promedio se va 14 cm; la mediana ni se entera.
        </Card>
        <Card t={t} from={24.5} to={30.5} x={0} y={452} w={960} accent={C.orange}>
          <B c={C.orange}>island_end</B>: el último rayo que sigue sobre esa recta. Un rayo perdido no cuenta como final.
          Cuando el coche deja atrás la isla, <B c={C.accent}>left</B> salta a la pared lejana.
        </Card>
        <Card t={t} from={30.6} x={0} y={452} w={960}>
          Lo que no se ve vale <B>∞</B> («no hay pared»). Todo lo que viene después usa estos cinco números.
          <Code size={24}>{'scene = perceive(scan, forward_yaw)'}</Code>
        </Card>
      </div>
    </Frame>
  );
};
