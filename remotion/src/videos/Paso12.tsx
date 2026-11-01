import React from 'react';
import { Frame, Card, B, useT, fadeIn } from '../components/ui';
import { C, MONO, num } from '../theme';

export const PASO12_SECONDS = 42;

const BASE = 40.75;
// Mean of the 12 standard-suite rounds in the Open lab, from the guide's chapter 12 [lab].
const IDEAS: { label: string; time: number; note: string; risk: 'ok' | 'warn' | 'bad' }[] = [
  { label: 'pedir 2,0 m/s en vez de 1,28', time: 40.33, note: 'casi nada', risk: 'ok' },
  { label: 'batería cargada (115 %)', time: 35.99, note: 'la velocidad real manda', risk: 'warn' },
  { label: 'batería baja (85 %)', time: 47.03, note: '+6,3 s', risk: 'bad' },
  { label: 'cámara: sentido 3 s tarde', time: 43.45, note: 'cada segundo cuenta', risk: 'bad' },
  { label: 'calibrar 2 s', time: 42.48, note: 'no bajes de 0,3 s', risk: 'bad' },
  { label: 'FINISH_SPEED 0,15 → 0,6', time: 39.54, note: 'cuidado con la parada', risk: 'warn' },
  { label: 'LAST_CORNER_SPEED 0,6 → 0,9', time: 39.72, note: 'cuidado con la parada', risk: 'warn' },
  { label: 'las dos juntas', time: 38.93, note: 'batería cargada: 7/12 válidas', risk: 'bad' },
];
const RISK = { ok: C.accent, warn: C.yellow, bad: C.red };

export const Paso12: React.FC = () => {
  const t = useT();
  const x = (v: number) => ((v - 34) / (48 - 34)) * 900;
  return (
    <Frame id="Paso12" subtitle="Pequeños ajustes, de uno en uno: puntos primero, tiempo después">
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1800, display: 'flex', gap: 16, opacity: fadeIn(t, 0.5) }}>
        {['Un cambio cada vez', 'Lab → Gazebo → coche', 'Mira la ronda mala, no la media', 'Repite con más semillas', 'Anota la batería'].map((r, i) => (
          <div key={r} style={{ flex: 1, background: C.panel, borderRadius: 12, padding: '12px 16px', fontSize: 24, fontWeight: 700, opacity: fadeIn(t, 0.5 + i * 0.5), borderTop: `5px solid ${C.accent}` }}>{r}</div>
        ))}
      </div>
      <svg width={1240} height={640} style={{ position: 'absolute', left: 0, top: 110 }}>
        <text x={420} y={26} fill={C.dim} fontSize={22}>tiempo medio de las 12 rondas del lab (s)</text>
        {[36, 38, 40, 42, 44, 46].map((v) => (
          <g key={v}>
            <line x1={320 + x(v)} x2={320 + x(v)} y1={40} y2={600} stroke={C.line} />
            <text x={320 + x(v)} y={626} fill={C.dim} fontSize={20} textAnchor="middle">{v}</text>
          </g>
        ))}
        <line x1={320 + x(BASE)} x2={320 + x(BASE)} y1={40} y2={600} stroke={C.text} strokeWidth={3} strokeDasharray="8 6" />
        <text x={320 + x(BASE) + 8} y={58} fill={C.text} fontSize={22} fontWeight={800}>v5 base {num(BASE)} s</text>
        {IDEAS.map((idea, i) => {
          const from = 4 + i * 2.6;
          const a = fadeIn(t, from, 0.8);
          const y = 80 + i * 64;
          const x0 = 320 + x(Math.min(BASE, idea.time)), x1 = 320 + x(Math.max(BASE, idea.time));
          const xe = 320 + x(BASE + (idea.time - BASE) * a);
          return (
            <g key={idea.label} opacity={a > 0 ? 1 : 0.15}>
              <text x={0} y={y + 22} fill={C.text} fontSize={22}>{idea.label}</text>
              <text x={0} y={y + 48} fill={RISK[idea.risk]} fontSize={19} opacity={a > 0.9 ? 1 : 0}>{idea.note}</text>
              <rect x={Math.min(xe, 320 + x(BASE))} y={y + 8} width={Math.abs(xe - (320 + x(BASE)))} height={34} rx={6} fill={idea.time < BASE ? C.accent : C.red} opacity={0.85} />
              {a > 0.9 && (
                <text x={idea.time < BASE ? x0 - 10 : x1 + 10} y={y + 33} fill={RISK[idea.risk]} fontSize={22} fontWeight={800} textAnchor={idea.time < BASE ? 'end' : 'start'} fontFamily={MONO}>
                  {num(idea.time)}
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
          <B c={C.red}>Un ajuste afinado para una batería no sirve para otra.</B> Las dos juntas ganan 1,8 s… y con la batería cargada solo 7 de 12 rondas son válidas.
        </Card>
        <Card t={t} from={31} x={0} y={300} w={520} accent={C.accent}>
          Casi no cambian nada: GAP, GAIN, LIMIT, EXIT_ANGLE, TURN_FRONT (1,1–1,6 m), ARM_DISTANCE.
          Los puntos van primero: ganar 1 s y perder un punto no vale.
        </Card>
      </div>
    </Frame>
  );
};
