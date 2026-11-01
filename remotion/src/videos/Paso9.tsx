import React from 'react';
import { Frame, Card, B, Check, useT, timeMap, fadeIn } from '../components/ui';
import { Field, SECTION_CELLS, poseOf } from '../components/Field';
import { C, MONO, num } from '../theme';
import { Sample, at, doneTime, run } from '../sim';

export const PASO9_SECONDS = 42;

// Section points the way the judge counts them: one per section the car leaves, in the round's direction.
const sectionEvents = (lane: Sample[]) => {
  const cell = (q: Sample) => SECTION_CELLS.findIndex(([i, j]) => i === Math.round(q.x) && j === Math.round(q.y));
  const events: { t: number; section: number }[] = [];
  let k = cell(lane[0]);
  for (const q of lane) {
    const c = cell(q);
    if (c >= 0 && c === (k + 1) % 8) { events.push({ t: q.t, section: k }); k = c; }
  }
  return events;
};

export const Paso9: React.FC = () => {
  const t = useT();
  const lane = run({ direction: 'ccw' });
  const end = doneTime(lane);
  const events = sectionEvents(lane);
  const simT = timeMap(t, [[1, 0.5], [21, end + 0.2]]);
  const q = at(lane, simT);
  const sections = Math.min(24, events.filter((e) => e.t <= simT).length);
  const laps = Math.floor(sections / 8);
  const stop = q.state === 'STOP' ? 3 : 0;
  const lit: (number | null)[] = SECTION_CELLS.map((_, k) => {
    const last = [...events].reverse().find((e) => e.section === k && e.t <= simT);
    if (!last) return 0;
    const age = simT - last.t;
    return 0.15 + 0.45 * Math.max(0, 1 - age / 3);
  });
  if (stop) lit[0] = 0.6;
  const total = sections + laps * 1 + stop;

  return (
    <Frame id="Paso9" subtitle="Qué cuenta el juez, qué es una ronda válida y cómo comparar">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={poseOf(q)} trail={lane.filter((p) => p.t <= simT && p.t >= 0.5)} sections={lit} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <div style={{ display: 'flex', gap: 12, opacity: fadeIn(t, 0.5) }}>
          {[
            ['1.1 Secciones', `${sections}`, '/ 24', C.accent],
            ['1.2 Vueltas', `${laps}`, '/ 3', C.yellow],
            ['1.3 Parada', `${stop}`, '/ 3', C.orange],
            ['Total', `${total}`, '/ 30', C.text],
          ].map(([k, v, max, col]) => (
            <div key={k} style={{ flex: 1, background: C.panel, borderRadius: 12, padding: '12px 16px', borderTop: `6px solid ${col}` }}>
              <div style={{ fontSize: 22, color: C.dim }}>{k}</div>
              <div style={{ fontSize: 52, fontWeight: 900, color: col }}>{v}<span style={{ fontSize: 26, color: C.dim }}> {max}</span></div>
            </div>
          ))}
        </div>
        <Card t={t} from={1.5} to={21.5} x={0} y={180} w={960}>
          Un punto por cada <B c={C.accent}>sección</B> de la que sale el coche, en el sentido de la ronda; uno por <B>vuelta</B>;
          tres por <B c={C.orange}>parar</B> con todo el coche dentro de la sección de salida.
          <div style={{ marginTop: 10, color: C.dim }}>El juez usa la pose real; la estrategia nunca la ve. Son estimaciones de simulación.</div>
        </Card>
        <Card t={t} from={22} to={31.5} x={0} y={180} w={960} accent={C.accent}>
          30 puntos no bastan para que la ronda sea <B c={C.accent}>válida</B> (umbrales del equipo):
          <Check on label="parada observada 30 s" size={26} />
          <Check on label="ningún contacto con un muro" size={26} />
          <Check on label="margen a los muros de 1 cm o más" size={26} />
          <Check on label="volante nunca por encima de 25°" size={26} />
        </Card>
        <Card t={t} from={31.8} x={0} y={180} w={960} accent={C.yellow}>
          Para elegir entre intentos: <B>primero los puntos, después el tiempo</B> desde Start.
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontFamily: MONO, fontSize: 26 }}>
            <div style={{ flex: 1, background: '#3a1f24', borderRadius: 10, padding: 12 }}>27 pts · 30 s<br /><span style={{ color: C.red }}>pierde</span></div>
            <div style={{ flex: 1, background: '#173b31', borderRadius: 10, padding: 12 }}>30 pts · 40 s<br /><span style={{ color: C.accent }}>gana</span></div>
          </div>
        </Card>
        <div style={{ position: 'absolute', top: 560, left: 0, width: 960, opacity: fadeIn(t, 21) }}>
          <div style={{ fontFamily: MONO, fontSize: 23, background: '#0b111b', borderRadius: 12, padding: '14px 18px', lineHeight: 1.45, whiteSpace: 'pre' }}>
            {`Puntos: 30 de 30   (secciones 24 + vueltas 3 + parada 3)\nTiempo desde Start: 34.80 s simulados\nVálida: sí   margen mínimo 11.9 cm`}
          </div>
          <div style={{ fontSize: 22, color: C.dim, marginTop: 8 }}>
            La solución en Gazebo (ccw). Open lab: 32,58 s; animación: {num(end - 0.5, 1)} s. No se mezclan tiempos de contextos distintos.
          </div>
        </div>
      </div>
    </Frame>
  );
};
