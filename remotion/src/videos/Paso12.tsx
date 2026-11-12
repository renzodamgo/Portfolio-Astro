import React from 'react';
import { Frame, Card, B, useT, fadeIn } from '../components/ui';
import { C, MONO, num } from '../theme';

export const PASO12_SECONDS = 42;

const BASE = 41.82;
// Mean of the 12 standard-suite rounds in the Open lab (seed 0), from the guide's chapter 12 [lab]. `time: null`: the
// guide gives no mean because the rounds are not valid; `shown` is the number as the guide writes it.
const IDEAS: { label: string; time: number | null; shown?: string; note: string; risk: 'ok' | 'warn' | 'bad' }[] = [
  { label: 'CRUISE_SPEED 1,28 → 2,0', time: 41.34, note: 'casi nada (1,6: 41,54)', risk: 'ok' },
  { label: 'CRUISE_SPEED 1,28 → 1,0', time: 43.53, note: '+1,7 s', risk: 'bad' },
  { label: 'cámara: sentido 1 s tarde', time: 42.51, note: 'cada segundo cuenta', risk: 'bad' },
  { label: 'FINISH_SPEED 0,15 → 0,6', time: 41.51, note: 'cuidado con la parada', risk: 'warn' },
  { label: 'CORNER_SPEED 1,0 → 0,8', time: 44.84, note: '+3,0 s (0,6: 48,87)', risk: 'bad' },
  { label: 'CORNER_SPEED 1,0 → 1,15', time: null, shown: 'solo 7 de 12 válidas', note: 'para fuera de la salida', risk: 'bad' },
  { label: 'motor al 85 % (batería baja)', time: 48.37, note: '+6,5 s, 12 de 12 válidas', risk: 'bad' },
  { label: 'motor al 115 % (cargada)', time: 38.6, shown: '38,6', note: 'solo 29 de 36 válidas', risk: 'bad' },
  { label: '115 % y CORNER_SPEED 0,9', time: 38.27, note: '36 de 36 válidas', risk: 'ok' },
];
const RISK = { ok: C.accent, warn: C.yellow, bad: C.red };

export const Paso12: React.FC = () => {
  const t = useT();
  const x = (v: number) => ((v - 36) / (50 - 36)) * 900;
  return (
    <Frame id="Paso12" subtitle="Pequeños ajustes, de uno en uno: puntos primero, tiempo después">
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1800, display: 'flex', gap: 16, opacity: fadeIn(t, 0.5) }}>
        {['Un cambio cada vez', 'Lab → Gazebo → coche', 'Mira la ronda mala, no la media', 'Repite con más semillas', 'Anota la batería'].map((r, i) => (
          <div key={r} style={{ flex: 1, background: C.panel, borderRadius: 12, padding: '12px 16px', fontSize: 24, fontWeight: 700, opacity: fadeIn(t, 0.5 + i * 0.5), borderTop: `5px solid ${C.accent}` }}>{r}</div>
        ))}
      </div>
      <svg width={1240} height={640} style={{ position: 'absolute', left: 0, top: 110 }}>
        <text x={420} y={26} fill={C.dim} fontSize={22}>tiempo medio de las 12 rondas del lab (s)</text>
        {[38, 40, 42, 44, 46, 48].map((v) => (
          <g key={v}>
            <line x1={320 + x(v)} x2={320 + x(v)} y1={40} y2={600} stroke={C.line} />
            <text x={320 + x(v)} y={626} fill={C.dim} fontSize={20} textAnchor="middle">{v}</text>
          </g>
        ))}
        <line x1={320 + x(BASE)} x2={320 + x(BASE)} y1={40} y2={600} stroke={C.text} strokeWidth={3} strokeDasharray="8 6" />
        <text x={320 + x(BASE) + 8} y={58} fill={C.text} fontSize={22} fontWeight={800}>base {num(BASE)} s</text>
        {IDEAS.map((idea, i) => {
          const from = 4 + i * 2.3;
          const a = fadeIn(t, from, 0.8);
          const y = 74 + i * 58;
          const time = idea.time ?? BASE;
          const x0 = 320 + x(Math.min(BASE, time)), x1 = 320 + x(Math.max(BASE, time));
          const xe = 320 + x(BASE + (time - BASE) * a);
          return (
            <g key={idea.label} opacity={a > 0 ? 1 : 0.15}>
              <text x={0} y={y + 22} fill={C.text} fontSize={22}>{idea.label}</text>
              <text x={0} y={y + 48} fill={RISK[idea.risk]} fontSize={19} opacity={a > 0.9 ? 1 : 0}>{idea.note}</text>
              <rect x={Math.min(xe, 320 + x(BASE))} y={y + 8} width={Math.abs(xe - (320 + x(BASE)))} height={34} rx={6} fill={time < BASE ? C.accent : C.red} opacity={0.85} />
              {a > 0.9 && (
                <text x={time < BASE ? x0 - 10 : x1 + 10} y={y + 33} fill={RISK[idea.risk]} fontSize={22} fontWeight={800} textAnchor={time < BASE ? 'end' : 'start'} fontFamily={MONO}>
                  {idea.shown ?? num(time)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 1280, top: 110, width: 520 }}>
        <Card t={t} from={4} to={25} x={0} y={0} w={520}>
          Verde gana tiempo; rojo lo pierde. El color del número es el <B>riesgo</B>: lo que gana una ronda puede costar la parada.
        </Card>
        <Card t={t} from={25.3} x={0} y={0} w={520} accent={C.red}>
          <B c={C.red}>La parada es la parte frágil.</B> Con un coche más rápido, lo primero que se pierde son los 3 puntos del final. Baja CORNER_SPEED.
        </Card>
        <Card t={t} from={31} x={0} y={300} w={520} accent={C.accent}>
          Casi no cambian nada: GAP, GAIN, LIMIT, DAMPING, TURN_TOLERANCE (0,3 a 0,8), TURN_FRONT (1,1 a 1,3 m), ARM_DISTANCE.
          Los puntos van primero: ganar 1 s y perder un punto no vale.
        </Card>
      </div>
    </Frame>
  );
};
