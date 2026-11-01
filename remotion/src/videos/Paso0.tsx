import React from 'react';
import { Frame, Card, B, useT, fadeIn, timeMap } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, FONT, MONO } from '../theme';
import { at, run } from '../sim';

export const PASO0_SECONDS = 34;

type Line = [number, string, 'cmd' | 'out' | 'ok'];
const LINES: Line[] = [
  [1.0, 'git clone https://github.com/renzodamgo/robotek-learn.git', 'cmd'],
  [2.6, 'cd robotek-learn', 'cmd'],
  [3.4, 'bash tools/install-ubuntu.sh        # macOS: RoboStack', 'cmd'],
  [5.0, 'ROS 2 Jazzy · Gazebo Harmonic · ~4,5 GB', 'out'],
  [6.0, 'colcon build --symlink-install', 'cmd'],
  [7.6, 'Summary: packages finished', 'ok'],
  [8.4, 'source install/setup.bash', 'cmd'],
  [9.4, 'ros2 launch robotek_course sim.launch.py', 'cmd'],
  [10.6, 'ros2 run robotek_course keyboard_drive', 'cmd'],
  [12.4, 'ros2 pkg create --build-type ament_python my_open --node-name drive', 'cmd'],
  [14.0, 'ros2 run my_open drive', 'cmd'],
  [15.0, 'tu paquete compila y se ejecuta', 'ok'],
];

const WORDS: [string, string][] = [
  ['ROS 2', 'programas pequeños (nodos) que se pasan mensajes por tópicos'],
  ['Gazebo', 'el simulador: campo, coche y física'],
  ['RViz', 'ver lo que percibe el robot'],
  ['LiDAR', 'un láser que gira y mide distancias'],
  ['colcon', 'compila los paquetes del workspace'],
  ['source', 'activa en esta terminal lo instalado'],
];

export const Paso0: React.FC = () => {
  const t = useT();
  const lane = run({ direction: 'ccw' });
  const simT = timeMap(t, [[18, 0.5], [33, 12.5]]);
  const q = at(lane, simT);
  const termA = 1 - fadeIn(t, 17.2, 0.6);
  const typed = (start: number, text: string) => text.slice(0, Math.max(0, Math.floor((t - start) * 45)));
  const keys = ['↑', '←', '↓', '→'];
  const pressed = q.steer > 0.05 ? '←' : q.steer < -0.05 ? '→' : '↑';

  return (
    <Frame id="Paso0" subtitle="El taller: ROS 2, Gazebo y tu paquete my_open">
      {termA > 0 ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1000, height: 760, background: '#0a0f17', borderRadius: 16, opacity: termA, overflow: 'hidden', border: `2px solid ${C.line}` }}>
          <div style={{ height: 44, background: '#1b2433', display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px' }}>
            {['#ef5a5a', '#f2c94c', '#4fd1a5'].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />)}
            <div style={{ marginLeft: 20, color: C.dim, fontSize: 20, fontFamily: FONT }}>terminal</div>
          </div>
          <div style={{ padding: '18px 22px', fontFamily: MONO, fontSize: 23, lineHeight: 1.75 }}>
            {LINES.filter(([s]) => t >= s).map(([s, text, kind], i) => (
              <div key={i} style={{ color: kind === 'cmd' ? C.text : kind === 'ok' ? C.accent : C.dim, whiteSpace: 'pre' }}>
                {kind === 'cmd' ? <span style={{ color: C.accent }}>$ </span> : kind === 'ok' ? '✓ ' : '  '}
                {kind === 'cmd' ? typed(s, text) : text}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: fadeIn(t, 17.4) }}>
          <Field size={760} pose={poseOf(q)} trail={lane.filter((p) => p.t <= simT && p.t >= 0.5)} trailColor={C.violet} />
          <div style={{ position: 'absolute', left: 820, top: 440, display: 'grid', gridTemplateColumns: 'repeat(3, 90px)', gap: 10 }}>
            {['', keys[0], '', keys[1], keys[2], keys[3]].map((k, i) => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: k ? (k === pressed ? C.accent : C.panel2) : 'transparent', color: k === pressed ? '#06231a' : C.text, fontSize: 40, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k}</div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 820, top: 630, width: 400, fontSize: 24, color: C.dim }}>Conduce tú con el teclado: así sabes qué tiene que hacer el código.</div>
        </div>
      )}
      <div style={{ position: 'absolute', left: termA > 0 ? 1040 : 1280, top: 0, width: termA > 0 ? 760 : 520 }}>
        <Card t={t} from={1.5} to={17.4} x={0} y={0} w={740}>
          Al terminar tendrás:
          <ol style={{ margin: '10px 0 0', paddingLeft: 34 }}>
            <li style={{ opacity: fadeIn(t, 4) }}>ROS 2 y Gazebo instalados, el repositorio compilado</li>
            <li style={{ opacity: fadeIn(t, 9.4) }}>el coche de la WRO en el campo Open, en Gazebo</li>
            <li style={{ opacity: fadeIn(t, 12.4) }}>tu paquete <B>my_open</B>: ahí vivirá tu estrategia</li>
          </ol>
        </Card>
        <div style={{ position: 'absolute', top: 330, left: 0, width: 740, opacity: Math.min(fadeIn(t, 8), 1 - fadeIn(t, 17)) }}>
          <div style={{ fontSize: 24, color: C.dim, marginBottom: 8 }}>Seis palabras que vas a leer</div>
          {WORDS.map(([w, d], i) => (
            <div key={w} style={{ display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 8, opacity: fadeIn(t, 8 + i * 0.8) }}>
              <div style={{ fontFamily: MONO, color: C.yellow, fontSize: 26, width: 120, fontWeight: 800 }}>{w}</div>
              <div style={{ fontSize: 24 }}>{d}</div>
            </div>
          ))}
        </div>
        <Card t={t} from={18} x={0} y={0} w={500} accent={C.violet}>
          El coche está en el campo y lo mueves tú. Desde el paso 1, el que conduce es <B c={C.violet}>tu código</B>,
          bloque a bloque, hasta dar tres vueltas solo.
        </Card>
      </div>
    </Frame>
  );
};
