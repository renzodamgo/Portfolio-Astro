import React from 'react';
import { Frame, Card, B, Code, Plot, useT, fadeIn, window_ } from '../components/ui';
import { Car } from '../components/Field';
import { C, FONT, MONO } from '../theme';

export const COCHEV5_SECONDS = 46;

const ORDER: [string, boolean, string][] = [
  ['Actualizar el código en el Pi', true, '—'],
  ['Ejes de la IMU', true, 'robot.yaml → imu_adapter'],
  ['Servo: centro, signo y ángulo real', true, 'robot.yaml, vehicle.py, real_car_v1.yaml'],
  ['Motor: velocidad real por %', false, 'robot.yaml, real_car_v1.yaml, v5/mission.py'],
  ['LiDAR y cámara', false, 'robot.yaml, robot.launch.py'],
  ['Primera ronda, despacio', false, '~/robotek-runs/ en el Pi'],
  ['Registrar la ronda', false, 'docs/open-challenge-runs/'],
];

// v5/mission.py REAL_SPEED: commanded -> real speed, measured 8 oct 2026 with a low battery.
const SPEED: [number, number][] = [[0, 0], [0.15, 0.18], [0.3, 0.27], [0.4, 0.3], [0.6, 0.42], [1.28, 0.6]];

const S = 1500;
const m = (x: number, y: number): [number, number] => [230 + x * S, 400 - y * S];

const Axis: React.FC<{ x: number; y: number; a: number; color: string; label: string; len?: number }> = ({ x, y, a, color, label, len = 150 }) => (
  <g>
    <line x1={x} y1={y} x2={x + len * Math.cos(a)} y2={y - len * Math.sin(a)} stroke={color} strokeWidth={7} strokeLinecap="round" />
    <text x={x + (len + 20) * Math.cos(a) - 14} y={y - (len + 20) * Math.sin(a) + 10} fill={color} fontSize={30} fontWeight={900} fontFamily={MONO}>{label}</text>
  </g>
);

export const CocheV5: React.FC = () => {
  const t = useT();
  const imuA = window_(t, 8, 19);
  const servoA = window_(t, 19, 28.5);
  const motorA = window_(t, 28.5, 37);
  const steer = t < 22 ? 0 : t < 24.5 ? 0.17 : t < 26 ? 0.30718 : 0;
  const push = t > 13 && t < 15 ? (t - 13) * 0.05 : t >= 15 ? 0.1 : 0;
  return (
    <Frame id="CocheV5" subtitle="El coche reconstruido: medir IMU, servo y motor antes de correr el v5">
      {t < 8.3 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1800, opacity: 1 - fadeIn(t, 7.8) }}>
          <div style={{ fontSize: 26, color: C.dim, marginBottom: 10 }}>El orden (ruedas en el aire, salvo que se diga)</div>
          {ORDER.map(([what, blocks, where], i) => (
            <div key={what} style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 30, padding: '10px 18px', marginBottom: 8, background: C.panel, borderRadius: 12, opacity: fadeIn(t, 0.6 + i * 0.6), borderLeft: `8px solid ${blocks ? C.red : C.line}` }}>
              <div style={{ width: 40, color: C.yellow, fontWeight: 900, fontFamily: MONO }}>{i + 1}</div>
              <div style={{ width: 620 }}>{what}</div>
              <div style={{ width: 230, color: blocks ? C.red : C.dim, fontWeight: 800 }}>{blocks ? 'bloquea la ronda' : ''}</div>
              <div style={{ fontFamily: MONO, fontSize: 22, color: C.dim }}>{where}</div>
            </div>
          ))}
        </div>
      )}
      {t > 7.8 && t < 37.2 && (
        <svg width={760} height={760} style={{ position: 'absolute', left: 0, top: 0, borderRadius: 18, opacity: Math.max(imuA, servoA) }}>
          <rect width={760} height={760} fill="#1b2433" />
          {imuA > 0 && (
            <g>
              <Car pose={{ x: push, y: 0, yaw: 0, steer: 0 }} m={m} s={S} />
              <Axis x={m(push, 0)[0]} y={m(push, 0)[1]} a={0} color={C.red} label="x" len={300} />
              <Axis x={m(push, 0)[0]} y={m(push, 0)[1]} a={Math.PI / 2} color={C.accent} label="y" len={200} />
              <circle cx={m(push, 0)[0]} cy={m(push, 0)[1]} r={14} fill={C.blue} />
              <text x={m(push, 0)[0] - 70} y={m(push, 0)[1] + 50} fill={C.blue} fontSize={28} fontWeight={900} fontFamily={MONO}>z ↑</text>
              <rect x={m(push + 0.02, -0.07)[0]} y={m(push, -0.07)[1] - 8} width={120} height={22} fill="#3a7a50" stroke="#9fe0b5" strokeWidth={2} />
              <text x={m(push - 0.1, -0.07)[0]} y={m(push, -0.07)[1] + 48} fill="#9fe0b5" fontSize={22} fontFamily={FONT}>RRC Lite (IMU), de canto, a un costado</text>
              {t > 13 && t < 16 && <text x={60} y={680} fill={C.yellow} fontSize={34} fontWeight={900} fontFamily={MONO}>PUSH the car forward once now</text>}
              {t <= 13 && t > 9.5 && <text x={60} y={680} fill={C.dim} fontSize={34} fontWeight={900} fontFamily={MONO}>Leave the car still for 3 s</text>}
            </g>
          )}
          {servoA > 0 && (
            <g>
              <Car pose={{ x: 0, y: 0, yaw: 0, steer }} m={m} s={S} />
              <text x={60} y={680} fill={steer > 0.25 ? C.car : C.text} fontSize={34} fontWeight={900} fontFamily={MONO}>
                {steer === 0 ? '/steer 0.0 → ruedas rectas' : steer < 0.2 ? '/steer 0.17 → a la izquierda' : 'tope de la rueda: 17,6°'}
              </text>
            </g>
          )}
        </svg>
      )}
      {motorA > 0 && (
        <div style={{ opacity: motorA }}>
          <Plot x={0} y={0} w={760} h={600} t0={0} t1={1.3} y0={0} y1={0.7} upTo={10}
            yLabel="velocidad real (m/s)" xLabel="velocidad pedida" yTicks={[0, 0.2, 0.4, 0.6]} fmt={(v) => String(v).replace('.', ',')}
            series={[{ values: SPEED, color: C.yellow, label: 'REAL_SPEED (batería baja)' }]} />
          <div style={{ position: 'absolute', top: 620, left: 0, width: 760, fontSize: 24, color: C.dim }}>
            1,28 → 0,60 m/s es inferido, no medido. Con la batería cargada el coche va más rápido.
          </div>
        </div>
      )}
      {t > 36.8 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 760, opacity: fadeIn(t, 37) }}>
          <div style={{ fontSize: 26, color: C.dim, marginBottom: 12 }}>Las luces (muy tenues a propósito)</div>
          {[['Listo, esperando Start', C.accent], ['Calibrando tras Start', C.blue], ['En ronda', '#333'], ['DONE', C.accent], ['DIRECTION_FAULT', C.red]].map(([k, c], i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 28, marginBottom: 14, opacity: fadeIn(t, 37.3 + i * 0.4) }}>
              <div style={{ width: 34, height: 34, borderRadius: 17, background: c, boxShadow: c === '#333' ? 'none' : `0 0 18px ${c}` }} />
              <div style={{ width: 34, height: 34, borderRadius: 17, background: c, boxShadow: c === '#333' ? 'none' : `0 0 18px ${c}` }} />
              <div>{k}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ position: 'absolute', left: t < 8.3 ? 2000 : 810, top: 0, width: 990 }}>
        <Card t={t} from={8.3} to={19} x={0} y={0} w={960} accent={C.blue}>
          <B c={C.blue}>Ejes de la IMU.</B> El v5 integra el giroscopio <B>z</B> del coche y espera que girar a la izquierda dé positivo.
          La placa va de canto: <span style={{ fontFamily: MONO, color: C.yellow }}>imu_adapter</span> la gira a los ejes del coche
          (x adelante, y izquierda, z arriba).
          <Code size={22}>{'ros2 run robotek_hardware imu_axes\n# 3 s quieto, un empujón recto hacia delante\nforward_axis / left_axis / up_axis   error < 15°'}</Code>
        </Card>
        <Card t={t} from={19.3} to={28.5} x={0} y={0} w={960} accent={C.car}>
          <B c={C.car}>El servo.</B> Centro (de 10 en 10 µs), signo (0,17 rad: ruedas a la izquierda vistas desde atrás) y la tabla del ángulo real de cada rueda.
          <div style={{ marginTop: 10 }}>El menor tope de los dos lados es <span style={{ fontFamily: MONO, color: C.yellow }}>REAL_STEER_LIMIT</span>: <B>17,6°</B>, el tope y la velocidad de giro de las esquinas del v5.</div>
        </Card>
        <Card t={t} from={28.8} to={37} x={0} y={0} w={960} accent={C.yellow}>
          <B>El motor.</B> Pulsos cortos (0,25 s) al 15, 20 y 30 %, nunca al 100 % desde parado.
          La tabla va a <span style={{ fontFamily: MONO, color: C.yellow }}>real_car_v1.yaml</span> y a <span style={{ fontFamily: MONO, color: C.yellow }}>REAL_SPEED</span> del v5: las dos tienen que coincidir.
        </Card>
        <Card t={t} from={37.2} x={0} y={0} w={960}>
          La ronda, con el tope del motor bajo (30 %) y la batería cargada:
          <Code size={23}>{'ros2 launch robotek_bringup robot.launch.py challenge:=open'}</Code>
          <div style={{ marginTop: 10, fontSize: 26, color: C.dim }}>La placa al momento, el LiDAR a los 5 s, la cámara a los 7 s. Primera pulsación: Start; segunda: parar.</div>
        </Card>
        <Card t={t} from={40} x={0} y={380} w={960} accent={C.red}>
          El v5 completa el set estándar en simulación, pero <B c={C.red}>aún no se ha probado en el coche</B>.
        </Card>
      </div>
    </Frame>
  );
};
