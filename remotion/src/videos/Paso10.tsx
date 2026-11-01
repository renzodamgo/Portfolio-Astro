import React from 'react';
import { Frame, Card, B, Check, Code, useT, fadeIn } from '../components/ui';
import { Car } from '../components/Field';
import { C, FONT, MONO } from '../theme';

export const PASO10_SECONDS = 42;

const S = 2300; // px per metre for the big car
const CX = 300, CY = 380;
const m = (x: number, y: number): [number, number] => [CX + x * S, CY - y * S];

// [from, label, command, where on the car (m, base_link frame), what to expect]
const CHECKS: [number, string, string, [number, number], string][] = [
  [5, 'Los dispositivos USB', 'ls -l /dev/serial/by-id/ /dev/rrc_lite /dev/ldlidar', [0.05, 0.0], 'cada uno aparece'],
  [8.3, 'La cámara', 'ros2 launch … car.launch.py', [0.1, 0.0], 've las líneas de color'],
  [11.6, 'El LiDAR: tasa y vista', 'ros2 topic hz /robotek/scan', [0.128, 0.0], '~10 Hz, la pared delante'],
  [14.9, 'La IMU: tasa y signo', 'ros2 topic hz /robotek/imu', [0.03, 0.03], 'girar a la izquierda: gyro > 0'],
  [18.2, 'La dirección: centro y signo', 'ros2 launch rrc_lite_driver controller.launch.py', [0.1174, 0.0], 'izquierda es izquierda'],
  [21.5, 'El motor: velocidad baja', 'ros2 run robotek_hardware motor_driver', [-0.02, 0.0], 'ruedas en el aire, hacia delante'],
];

export const Paso10: React.FC = () => {
  const t = useT();
  const active = CHECKS.filter(([from]) => t >= from).length - 1;
  const steerDemo = t > 18.2 && t < 21.5 ? 0.3 * Math.sin((t - 18.2) * 3) : 0;
  const tableA = fadeIn(t, 31);

  return (
    <Frame id="Paso10" subtitle="El mismo nodo, ahora en la Raspberry Pi: comprobar cada pieza por separado">
      <svg width={760} height={760} style={{ position: 'absolute', left: 0, top: 0, borderRadius: 18, opacity: 1 - tableA }}>
        <rect width={760} height={760} fill="#1b2433" />
        <text x={30} y={50} fill={C.dim} fontSize={24} fontFamily={FONT}>{t < 25 ? 'sobre soportes, ruedas en el aire' : 'en el suelo, motor limitado'}</text>
        <Car pose={{ x: 0, y: 0, yaw: 0, steer: steerDemo }} m={m} s={S} />
        {CHECKS.map(([from, label, , [x, y]], i) => {
          if (t < from) return null;
          const [px, py] = m(x, y);
          const on = i === active && t < 25;
          return (
            <g key={label}>
              <circle cx={px} cy={py} r={on ? 46 + 6 * Math.sin(t * 6) : 26} fill="none" stroke={on ? C.yellow : C.accent} strokeWidth={on ? 6 : 4} opacity={on ? 1 : 0.6} />
              {!on && <text x={px - 9} y={py + 9} fill={C.accent} fontSize={26} fontWeight={900} fontFamily={FONT}>✓</text>}
            </g>
          );
        })}
        {t > 14.9 && t < 18.2 && (
          <g>
            <path d={`M ${CX + 100} ${CY + 250} A 160 160 0 0 0 ${CX + 260} ${CY + 90}`} fill="none" stroke={C.yellow} strokeWidth={6} />
            <text x={CX + 150} y={CY + 290} fill={C.yellow} fontSize={28} fontFamily={MONO} fontWeight={800}>gyro z &gt; 0</text>
          </g>
        )}
      </svg>
      {tableA > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1000, opacity: tableA }}>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12 }}>El coche real no es el simulador</div>
          {[
            ['Servo', 'retardo 0,06 s, 1,2 rad/s, tope 17,6°'],
            ['Motor', 'tabla medida con batería baja: 0,60 → 0,42 m/s'],
            ['LiDAR', '±110°, 306 rayos, 10 Hz, ruido 8 mm'],
            ['IMU', '50 Hz, sesgo 0,006 rad/s'],
            ['Cámara', '~6 fps, girada 4,4°'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', fontSize: 26, padding: '8px 0', borderBottom: `1px solid ${C.line}` }}>
              <div style={{ width: 160, color: C.yellow, fontWeight: 800 }}>{k}</div><div>{v}</div>
            </div>
          ))}
          <div style={{ marginTop: 22, fontSize: 26, color: C.dim }}>No modela:</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {['patinaje de las ruedas', 'caída de la batería', 'el morro que se levanta', 'la luz de la sala', 'la lente de la cámara'].map((w) => (
              <div key={w} style={{ background: '#3a1f24', color: '#ffb3b3', borderRadius: 10, padding: '8px 14px', fontSize: 24 }}>{w}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', left: tableA > 0 ? 1060 : 810, top: 0, width: tableA > 0 ? 740 : 990 }}>
        <Card t={t} from={0.6} to={4.8} x={0} y={0} w={960}>
          Un error en el simulador cuesta una ronda; en el coche, un cable arrancado. Por eso, <B>despacio</B>: una pieza cada vez.
          <Code size={22}>{'git clone …/robotek-learn.git && cd robotek-learn\nbash tools/setup-pi.sh --with-reference'}</Code>
        </Card>
        {t >= 4.8 && t < 25 && (
          <div style={{ background: C.panel, borderRadius: 14, padding: '18px 26px', opacity: fadeIn(t, 4.8) }}>
            {CHECKS.map(([from, label, cmd, , expect], i) => (
              <div key={label} style={{ opacity: t >= from ? 1 : 0.35 }}>
                <Check on={t >= from && i < active} label={<span><span style={{ color: C.dim, fontFamily: MONO }}>3.{i + 1}</span> {label}</span>} detail={t >= from ? expect : ''} size={25} />
                {i === active && <div style={{ fontFamily: MONO, fontSize: 20, color: C.yellow, margin: '0 0 6px 48px' }}>$ {cmd}</div>}
              </div>
            ))}
          </div>
        )}
        <Card t={t} from={25} to={31} x={0} y={0} w={960} accent={C.orange}>
          Solo al final, la <B c={C.orange}>primera ronda en el suelo</B>: motor al 30–40 %, la mano lista.
          Un toque del botón arranca; el segundo publica <span style={{ fontFamily: MONO, color: C.yellow }}>/robotek/stop</span> y corta el motor.
        </Card>
        <Card t={t} from={33} x={0} y={0} w={720} accent={C.yellow}>
          Lo que el simulador no tiene es lo primero que falla en el coche. Para eso está el capítulo 11.
        </Card>
      </div>
    </Frame>
  );
};
