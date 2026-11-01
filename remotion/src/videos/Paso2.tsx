import React from 'react';
import { Frame, Card, Code, B, Plot, useT, fadeIn } from '../components/ui';
import { Field, Pose } from '../components/Field';
import { C, FONT, num } from '../theme';
import { STEER_LIMIT, WHEELBASE, wrap } from '../sim';

export const PASO2_SECONDS = 32;

// The heading law alone: start 20 deg off, goal 0, 0.60 m/s real speed.
const headingRun = (() => {
  const out: { t: number; pose: Pose }[] = [];
  let x = -1.2, y = -0.95, yaw = 0.35, wheel = 0;
  for (let k = 0; k <= 400; k++) {
    const t = k * 0.02;
    const gyro = (0.6 * Math.tan(wheel)) / WHEELBASE;
    const steer = Math.max(-STEER_LIMIT, Math.min(STEER_LIMIT, 0.8 * wrap(0 - yaw) - 0.1 * gyro));
    out.push({ t, pose: { x, y, yaw, steer } });
    wheel += (steer - wheel) * 0.4;
    yaw += gyro * 0.02;
    x += 0.6 * Math.cos(yaw) * 0.02;
    y += 0.6 * Math.sin(yaw) * 0.02;
  }
  return out;
})();

const deg = (r: number) => (r * 180) / Math.PI;

export const Paso2: React.FC = () => {
  const t = useT();
  const k = Math.min(165, Math.max(0, Math.round(((t - 1.5) * 0.45) / 0.02)));
  const cur = headingRun[k];
  const trail = headingRun.slice(0, k + 1).map((q) => q.pose);

  // drift plot (9-20 s): 10 s of the car at rest, real heading error with and without calibration
  const plotT = Math.max(0, (t - 10) * 1.2);
  const drift: [number, number][] = Array.from({ length: 101 }, (_, i) => [i / 10, -deg(0.006 * (i / 10))]);
  const calibrated: [number, number][] = Array.from({ length: 101 }, (_, i) => [i / 10, -deg(0.00035 * (i / 10))]);
  const believed: [number, number][] = Array.from({ length: 101 }, (_, i) => [i / 10, 0]);

  // wrap dial (21-32 s)
  const dialA = fadeIn(t, 21.5);
  const showWrap = t > 25.5;

  return (
    <Frame id="Paso2" subtitle="Hacia dónde apunta el coche: sumar lo que gira">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={cur.pose} trail={trail} coloredLines={false} zoom={{ cx: -0.1, cy: -0.6, span: 2.4 }}
          overlay={(m) => {
            const [px, py] = m(cur.pose.x, cur.pose.y);
            const L = 160;
            return (
              <g>
                <line x1={px} y1={py} x2={px + L} y2={py} stroke={C.accent} strokeWidth={5} strokeDasharray="10 8" />
                <text x={px + L + 8} y={py + 34} fill={C.accent} fontSize={24} fontFamily={FONT} fontWeight={800}>meta</text>
                <line x1={px} y1={py} x2={px + L * Math.cos(cur.pose.yaw)} y2={py - L * Math.sin(cur.pose.yaw)} stroke={C.blue} strokeWidth={6} />
                <text x={px + L * Math.cos(cur.pose.yaw) + 8} y={py - L * Math.sin(cur.pose.yaw) - 8} fill={C.blue} fontSize={24} fontFamily={FONT} fontWeight={800}>rumbo {num(deg(cur.pose.yaw), 0)}°</text>
              </g>
            );
          }} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990, height: 760 }}>
        <Card t={t} from={0.8} to={9.5} x={0} y={0} w={960}>
          El giroscopio mide cuánto gira por segundo. Sumándolo sale el <B c={C.blue}>rumbo</B>:
          <Code>{'yaw = yaw + gyro · dt'}</Code>
          <div style={{ marginTop: 14 }}>Para volver a la <B c={C.accent}>meta</B>, el volante es proporcional al error:</div>
          <Code>{'volante = KP · wrap(meta − yaw)   KP = 0,8\n(nunca más que el tope de 17,6°)'}</Code>
          <div style={{ marginTop: 14, fontSize: 28, color: C.dim }}>
            error {num(deg(wrap(0 - cur.pose.yaw)), 1)}° → volante {num(deg(cur.pose.steer), 1)}°
          </div>
        </Card>
        <Card t={t} from={9.8} to={21} x={0} y={0} w={960} accent={C.orange}>
          El giroscopio tiene un <B c={C.orange}>sesgo</B> de unos 0,006 rad/s: quieto, «gira».
          En 10 s son <B c={C.orange}>3,4°</B>, y nada dentro del coche avisa.
          {t > 15.5 && (
            <div style={{ marginTop: 12 }}>
              Solución: <B c={C.accent}>calibrar</B>. Con el coche quieto la lectura es el sesgo: se promedia y se resta.
              La v5 calibra <B>0,3 s</B> después de Start.
            </div>
          )}
        </Card>
        {t > 10 && t < 21.2 && (
          <div style={{ opacity: Math.min(fadeIn(t, 10), 1 - fadeIn(t, 20.6)) }}>
            <Plot x={0} y={330} w={960} h={420} t0={0} t1={10} y0={-4} y1={0.6} upTo={plotT}
              yLabel="error de rumbo real (°)" yTicks={[0, -1, -2, -3, -4]} fmt={(v) => `${v}°`}
              series={[
                { values: believed, color: C.blue, label: 'lo que cree', dash: '10 6' },
                { values: drift, color: C.orange, label: 'sin calibrar' },
                ...(t > 15.5 ? [{ values: calibrated, color: C.accent, label: 'calibrado' }] : []),
              ]} />
          </div>
        )}
        <Card t={t} from={21.3} x={0} y={0} w={960} accent={C.violet}>
          Los ángulos dan la vuelta en ±π. Meta 3 rad y rumbo −3 rad no están a 6 rad: están a <B c={C.violet}>0,28 rad</B>.
          <Code>{'wrap(meta − yaw)  →  entre −π y π'}</Code>
        </Card>
        {dialA > 0 && (
          <svg width={960} height={420} style={{ position: 'absolute', left: 0, top: 330, opacity: dialA }}>
            <rect width={960} height={420} rx={14} fill={C.panel} />
            {(() => {
              const cx = 420, cy = 210, r = 160;
              const pt = (a: number, rr = r) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
              const [gx, gy] = pt(3), [yx, yy] = pt(-3);
              const short = showWrap;
              const arc = short
                ? `M ${pt(-3, r + 30).join(' ')} A ${r + 30} ${r + 30} 0 0 1 ${pt(-Math.PI, r + 30).join(' ')} A ${r + 30} ${r + 30} 0 0 1 ${pt(3, r + 30).join(' ')}`
                : `M ${pt(-3, r + 30).join(' ')} A ${r + 30} ${r + 30} 0 1 0 ${pt(3, r + 30).join(' ')}`;
              return (
                <g fontFamily={FONT}>
                  <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.line} strokeWidth={4} />
                  <line x1={cx} y1={cy} x2={gx} y2={gy} stroke={C.accent} strokeWidth={6} />
                  <line x1={cx} y1={cy} x2={yx} y2={yy} stroke={C.blue} strokeWidth={6} />
                  <path d={arc} fill="none" stroke={short ? C.accent : C.red} strokeWidth={6} />
                  <text x={gx - 40} y={gy - 30} textAnchor="end" fill={C.accent} fontSize={26} fontWeight={800}>meta 3 rad</text>
                  <text x={yx - 40} y={yy + 50} textAnchor="end" fill={C.blue} fontSize={26} fontWeight={800}>rumbo −3 rad</text>
                  <text x={640} y={150} fill={short ? C.accent : C.red} fontSize={34} fontWeight={800}>
                    {short ? 'con wrap: 0,28 rad' : 'sin wrap: 6 rad'}
                  </text>
                  <text x={640} y={200} fill={C.text} fontSize={28}>
                    {short ? 'un toque a la derecha' : 'volante a tope a la izquierda'}
                  </text>
                  <text x={640} y={240} fill={C.dim} fontSize={26}>{short ? '(el camino corto)' : '(casi una vuelta entera)'}</text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>
    </Frame>
  );
};
