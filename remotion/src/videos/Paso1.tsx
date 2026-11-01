import React from 'react';
import { interpolate } from 'remotion';
import { Frame, Card, Code, B, useT, fadeIn } from '../components/ui';
import { Car } from '../components/Field';
import { C, FONT, num } from '../theme';
import { STEER_LIMIT, WHEELBASE } from '../sim';

export const PASO1_SECONDS = 32;

const SIZE = 760;
const S = 560; // px per metre
const m = (x: number, y: number): [number, number] => [SIZE / 2 + x * S, SIZE * 0.78 - y * S];

export const Paso1: React.FC = () => {
  const t = useT();
  // steering: 0 -> 0.25 rad (6-10 s), hold, -> 17.6 deg (22-25 s)
  const delta = t < 22 ? interpolate(t, [6, 10], [0, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : interpolate(t, [22, 25], [0.25, STEER_LIMIT], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const R = delta > 1e-3 ? WHEELBASE / Math.tan(delta) : Infinity;
  // drive around the circle from 14 s (and again after 25 s)
  const v = 0.6;
  const drive = t < 22 ? Math.max(0, t - 14) : Math.max(0, t - 25.5);
  const rDrive = isFinite(R) ? R : 1e6;
  const ang = (v * drive) / rDrive;
  const cx = 0, cy = rDrive; // centre left of the car (car starts at origin heading +x)
  const pose = { x: cx + rDrive * Math.sin(ang), y: cy - rDrive * Math.cos(ang), yaw: ang, steer: delta };
  const [ox, oy] = m(0, 0);
  const [ccx, ccy] = m(0, isFinite(R) ? R : 0);
  const frontWheel = { x: pose.x + WHEELBASE * Math.cos(pose.yaw), y: pose.y + WHEELBASE * Math.sin(pose.yaw) };
  const guides = fadeIn(t, 8) * (drive > 0 ? 0.4 : 1);
  const trailN = 80;
  const trail = Array.from({ length: trailN }, (_, i) => {
    const a = (ang * i) / (trailN - 1);
    return m(cx + rDrive * Math.sin(a), cy - rDrive * Math.cos(a));
  });
  const yawRate = (v * Math.tan(delta)) / WHEELBASE;

  return (
    <Frame id="Paso1" subtitle="Un ángulo de volante se convierte en un círculo">
      <svg width={SIZE} height={SIZE} style={{ position: 'absolute', left: 0, top: 0, borderRadius: 18 }}>
        <rect width={SIZE} height={SIZE} fill={C.mat} />
        {Array.from({ length: 40 }, (_, i) => (
          <g key={i} stroke={C.matLine} strokeWidth={1}>
            <line x1={i * S * 0.1} x2={i * S * 0.1} y1={0} y2={SIZE} />
            <line y1={SIZE * 0.78 - (i - 14) * S * 0.1} y2={SIZE * 0.78 - (i - 14) * S * 0.1} x1={0} x2={SIZE} />
          </g>
        ))}
        {drive > 0 && <path d={trail.map((p, i) => `${i ? 'L' : 'M'} ${p.join(' ')}`).join(' ')} stroke={C.yellow} strokeWidth={5} fill="none" />}
        {isFinite(R) && (
          <g opacity={guides}>
            <circle cx={ccx} cy={ccy} r={R * S} fill="none" stroke={C.blue} strokeWidth={3} strokeDasharray="12 8" />
            <line x1={ox} y1={oy + 40} x2={ccx} y2={ccy} stroke={C.blue} strokeWidth={3} strokeDasharray="6 6" />
            {(() => {
              const [fx, fy] = m(WHEELBASE, 0);
              return <line x1={fx} y1={fy} x2={ccx} y2={ccy} stroke={C.blue} strokeWidth={3} strokeDasharray="6 6" />;
            })()}
            <circle cx={ccx} cy={ccy} r={9} fill={C.blue} />
            <text x={ccx + 16} y={ccy - 10} fontSize={26} fill={C.blue} fontFamily={FONT} fontWeight={700}>centro del círculo</text>
            <text x={(ox + ccx) / 2 + 14} y={(oy + ccy) / 2} fontSize={28} fill={C.blue} fontFamily={FONT} fontWeight={800}>R = {num(R)} m</text>
          </g>
        )}
        <Car pose={pose} m={m} s={S} />
        {drive === 0 && (
          <g opacity={fadeIn(t, 2)}>
            {(() => {
              const [a, b] = m(0, -0.13);
              const [c] = m(WHEELBASE, -0.13);
              return (
                <g>
                  <line x1={a} x2={c} y1={b} y2={b} stroke={C.wall} strokeWidth={3} />
                  <line x1={a} x2={a} y1={b - 10} y2={b + 10} stroke={C.wall} strokeWidth={3} />
                  <line x1={c} x2={c} y1={b - 10} y2={b + 10} stroke={C.wall} strokeWidth={3} />
                  <text x={(a + c) / 2} y={b + 38} fontSize={26} textAnchor="middle" fill={C.wall} fontFamily={FONT} fontWeight={700}>L = 0,1174 m</text>
                </g>
              );
            })()}
            {(() => {
              const [fx, fy] = m(frontWheel.x, frontWheel.y);
              return delta > 0.02 ? (
                <text x={fx + 30} y={fy - 70} fontSize={30} fill={C.car} fontFamily={FONT} fontWeight={800}>δ = {num(delta)} rad</text>
              ) : null;
            })()}
          </g>
        )}
      </svg>

      <div style={{ position: 'absolute', left: 810, top: 0, width: 990, height: 760 }}>
        <Card t={t} from={0.8} to={6.2} x={0} y={0} w={960}>
          Un coche con dirección <B>Ackermann</B> se calcula como una <B>bicicleta</B>:
          una rueda trasera fija y una delantera que gira un ángulo <B>δ</B>.
          <div style={{ marginTop: 14, color: C.dim }}>Distancia entre ejes: L = 0,1174 m</div>
        </Card>
        <Card t={t} from={6.5} to={14} x={0} y={0} w={960} accent={C.blue}>
          La línea del eje trasero y la perpendicular a la rueda delantera se cortan en el <B c={C.blue}>centro del círculo</B>.
          <Code>{'radio (m) = L / tan(δ)'}</Code>
          <div style={{ marginTop: 12 }}>Con δ = 0,25 rad: <B>R = 0,46 m</B>, el círculo de la referencia.</div>
        </Card>
        <Card t={t} from={14.2} to={22} x={0} y={0} w={960}>
          Cuánto gira por segundo depende de la velocidad:
          <Code>{'velocidad de giro = v · tan(δ) / L'}</Code>
          <div style={{ marginTop: 12 }}>
            v = 0,60 m/s → <B>{num(yawRate)} rad/s</B>. El radio no cambia con la velocidad: solo con el ángulo.
          </div>
        </Card>
        <Card t={t} from={22.3} x={0} y={0} w={960} accent={C.car}>
          El servo real no llega a 25°: su tope es <B c={C.car}>17,6°</B> (0,307 rad).
          <div style={{ marginTop: 10 }}>Radio mínimo: <B c={C.car}>0,37 m</B>. Ninguna esquina puede ser más cerrada.</div>
        </Card>
        <Card t={t} from={26} x={0} y={330} w={960} accent={C.yellow}>
          La estrategia decide un <B>ángulo</B>; al coche le llega un <B>Twist</B>:
          <Code size={26}>{'cmd.linear.x  = speed\ncmd.angular.z = speed * tan(steer) / WHEELBASE'}</Code>
        </Card>
        <div style={{ position: 'absolute', left: 0, top: 640, width: 960, display: 'flex', gap: 20, opacity: fadeIn(t, 6) }}>
          {[
            ['δ (volante)', `${num(delta)} rad · ${num((delta * 180) / Math.PI, 1)}°`],
            ['radio R', `${num(R)} m`],
            ['giro', `${num(drive > 0 ? yawRate : 0)} rad/s`],
          ].map(([k, val]) => (
            <div key={k} style={{ flex: 1, background: C.panel, borderRadius: 12, padding: '12px 18px' }}>
              <div style={{ fontSize: 22, color: C.dim }}>{k}</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
};

