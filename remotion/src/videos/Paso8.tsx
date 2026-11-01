import React from 'react';
import { Frame, Card, Code, B, useT, timeMap, fadeIn } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, FONT, MONO, num } from '../theme';
import { at, run } from '../sim';

export const PASO8_SECONDS = 38;

// The guide's example: nine images, a short line in image 4 resets the count.
const FRAMES: [number, number][] = [[300, 60], [305, 70], [300, 65], [20, 5], [310, 60], [300, 58], [305, 62], [300, 59], [307, 61]];
const vote = (b: number, o: number) => {
  const longest = Math.max(b, o);
  if (longest < 40 || Math.abs(b - o) / longest < 0.25) return 0;
  return b > o ? 1 : -1;
};
const ROWS = (() => {
  let run_ = 0, last = 0, decision = 0;
  return FRAMES.map(([b, o]) => {
    const v = vote(b, o);
    run_ = v !== 0 && v === last ? run_ + 1 : v !== 0 ? 1 : 0;
    last = v;
    if (run_ >= 5) decision = v;
    return { b, o, v, run: run_, decision };
  });
})();

export const Paso8: React.FC = () => {
  const t = useT();
  const shown = Math.max(0, Math.min(9, Math.floor((t - 6) / 1.3) + 1));
  const row = ROWS[Math.max(0, shown - 1)];
  const [b, o] = shown ? FRAMES[shown - 1] : [0, 0];
  const cw = run({ direction: 'cw' });
  const ccw = run({ direction: 'ccw' });
  const simT = timeMap(t, [[19, 0.5], [37, 13.5]]);
  const showRuns = t > 19;
  const qa = at(ccw, simT), qb = at(cw, simT);

  return (
    <Frame id="Paso8" subtitle="El árbitro no avisa: el coche mira las líneas del suelo y decide el sentido">
      {!showRuns ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 760, height: 760, opacity: 1 - fadeIn(t, 18.5) }}>
          <div style={{ fontSize: 24, color: C.dim, marginBottom: 8 }}>Lo que ve la cámara (esquema, 640 × 480 px)</div>
          <svg width={760} height={570} style={{ borderRadius: 14 }}>
            <rect width={760} height={570} fill="#d9d4c6" />
            <rect width={760} height={46} fill="#3a3f48" />
            {shown > 0 && (
              <g>
                <line x1={380 - (b / 640) * 760 * 0.5} y1={420} x2={380 + (b / 640) * 760 * 0.25} y2={180} stroke={C.blue} strokeWidth={22} strokeLinecap="round" />
                <line x1={420} y1={460} x2={420 + (o / 640) * 760} y2={400} stroke={C.orange} strokeWidth={22} strokeLinecap="round" />
                <text x={20} y={540} fontSize={30} fontFamily={MONO} fill={C.blue} fontWeight={800}>azul {b} px</text>
                <text x={420} y={540} fontSize={30} fontFamily={MONO} fill={C.orange} fontWeight={800}>naranja {o} px</text>
              </g>
            )}
            <text x={20} y={34} fontSize={22} fill="#cfd5df" fontFamily={FONT}>imagen {shown || '—'}</text>
          </svg>
          <div style={{ marginTop: 14, fontSize: 30, fontWeight: 800 }}>
            vota: <span style={{ color: row.v > 0 ? C.blue : row.v < 0 ? C.orange : C.dim }}>{shown ? (row.v > 0 ? '+1 (antihorario)' : row.v < 0 ? '−1 (horario)' : '0 (no sabe)') : '—'}</span>
          </div>
        </div>
      ) : (
        <div style={{ position: 'absolute', left: 0, top: 0, display: 'flex', gap: 20, opacity: fadeIn(t, 19) }}>
          {[{ q: qa, lane: ccw, label: 'azul más larga → antihorario (ccw)', color: C.blue }, { q: qb, lane: cw, label: 'naranja más larga → horario (cw)', color: C.orange }].map((r) => (
            <div key={r.label}>
              <Field size={420} pose={poseOf(r.q)} trail={r.lane.filter((p) => p.t <= simT && p.t >= 0.5)} trailColor={r.color} />
              <div style={{ fontSize: 24, marginTop: 8, color: r.color, fontWeight: 800, width: 420 }}>{r.label}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'absolute', left: 900, top: 0, width: 900 }}>
        <Card t={t} from={0.6} to={18.6} x={0} y={0} w={880}>
          Un <B>voto</B> por imagen: azul más larga, <B c={C.blue}>+1</B>; naranja, <B c={C.orange}>−1</B>; si no está claro, 0.
          <Code size={23}>{'línea más larga ≥ 40 px\n|azul − naranja| / más larga ≥ 0,25'}</Code>
        </Card>
        {t > 5.5 && t < 18.8 && (
          <div style={{ position: 'absolute', top: 290, left: 0, width: 880, opacity: Math.min(fadeIn(t, 5.5), 1 - fadeIn(t, 18.3)) }}>
            <div style={{ display: 'flex', fontSize: 22, color: C.dim, padding: '0 14px' }}>
              <div style={{ width: 120 }}>imagen</div><div style={{ width: 150 }}>azul</div><div style={{ width: 150 }}>naranja</div><div style={{ width: 120 }}>vota</div><div style={{ width: 150 }}>seguidas</div><div>decisión</div>
            </div>
            {ROWS.slice(0, shown).map((r, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 26, fontFamily: MONO, padding: '3px 14px', background: i === shown - 1 ? C.panel2 : 'transparent', borderRadius: 8, color: r.v === 0 ? C.red : C.text }}>
                <div style={{ width: 120 }}>{i + 1}</div><div style={{ width: 150 }}>{r.b}</div><div style={{ width: 150 }}>{r.o}</div>
                <div style={{ width: 120 }}>{r.v > 0 ? '+1' : r.v}</div><div style={{ width: 150 }}>{r.run}</div>
                <div style={{ color: r.decision ? C.accent : C.dim, fontWeight: r.decision ? 900 : 400 }}>{r.decision ? '+1 → ccw' : '0'}</div>
              </div>
            ))}
          </div>
        )}
        <Card t={t} from={19.3} to={28.5} x={0} y={0} w={880} accent={C.yellow}>
          Hacen falta <B>5 votos seguidos</B>. Una imagen mala reinicia la cuenta: cuesta unas imágenes más, pero un cuadro malo no puede elegir mal.
        </Card>
        <Card t={t} from={28.7} x={0} y={0} w={880} accent={C.red}>
          Sin sentido en <B c={C.red}>15 s</B>, la misión se detiene (DIRECTION_FAULT): parar es mejor que adivinar.
          Una vez decidido, no vuelve a mirar la cámara.
        </Card>
        <div style={{ position: 'absolute', top: 360, left: 0, width: 880, opacity: fadeIn(t, 20) }}>
          {showRuns && (
            <Code size={24} color={C.text}>{`# en SETUP, con el giroscopio calibrado\nif not direction and camera:\n    direction = 'ccw' if camera > 0 else 'cw'\n\n# sign = +1 (isla a la izquierda) o −1`}</Code>
          )}
          {showRuns && <div style={{ marginTop: 14, fontSize: 26, color: C.dim }}>Esquinas: ccw {qa.completed} · cw {qb.completed} de 12 · {num(Math.max(0, simT - 0.5), 1)} s desde Start</div>}
        </div>
      </div>
    </Frame>
  );
};
