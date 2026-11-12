import React from 'react';
import { Frame, Card, B, Code, useT, fadeIn, timeMap } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, FONT, MONO } from '../theme';
import { at, run } from '../sim';

export const PASO11_SECONDS = 44;

const ATTEMPTS: [string, string, string][] = [
  ['1', 'chocó a los 2,9 s', 'la cámara eligió mal el sentido (pared beige = naranja)'],
  ['2', '3 vueltas, 47,1 s, ~27 pts', 'motor al 40 %, batería en 6,66 V'],
  ['3–4', 'no se movió', 'cable del motor suelto'],
  ['5', 'el Pi se reinició', 'motor al 80 % con 6,5 V; sin aislar'],
  ['6', 'no se movió; sentido a los 12,4 s', 'cable suelto y una línea naranja corta'],
  ['7', 'chocó con un muro', 'motor al 90 % con la batería cargada'],
  ['8', '40,4 s, ~27 pts, dos roces', 'motor al 50 %, 7,4 V'],
];

const SYMPTOMS: [string, string][] = [
  ['No pasa nada al pulsar el botón', '1'],
  ['Choca en los primeros segundos', '2'],
  ['Gira al lado contrario o da círculos', '3'],
  ['La esquina nunca acaba', '4'],
  ['Se encabrita, derrapa o vuelca', '5'],
  ['No gira lo suficiente, o demasiado', '6'],
  ['El sentido se decide mal o tarde', '10'],
  ['Se pasa de la sección de salida', '13'],
  ['Roza la isla en las esquinas', '14'],
];

export const Paso11: React.FC = () => {
  const t = useT();
  const bad = run({ direction: 'ccw', gyroSign: -1, seconds: 8 });
  const crash = bad.findIndex((q) => {
    const r = Math.max(Math.abs(q.x), Math.abs(q.y));
    return q.state === 'RUN' && (r > 1.5 - 0.1 || r < 0.5 + 0.08);
  });
  const crashT = crash < 0 ? bad[bad.length - 1].t : bad[crash].t;
  const simT = timeMap(t, [[9, 0.5], [17, crashT]]);
  const q = at(bad, simT);
  const crashed = simT >= crashT - 1e-6;
  const fieldA = Math.min(fadeIn(t, 8.5), 1 - fadeIn(t, 25.5));
  return (
    <Frame id="Paso11" subtitle="Cuando el coche real no hace lo que esperabas: síntoma, causa, diagnóstico">
      {t < 9 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1800, display: 'flex', gap: 24, opacity: 1 - fadeIn(t, 8.4) }}>
          {[
            ['1', 'Primero en el aire', 'Sobre una caja, ruedas sin tocar la mesa: servo, motor y giroscopio se comprueban sin moverse del sitio.'],
            ['2', 'Motor limitado', 'motor_max_pct: con 40 % completó una ronda; con 90 % se estrelló. Empieza en 30–40 %.'],
            ['3', 'Un cambio cada vez', 'Y anota la batería: si cambias dos cosas y mejora, no sabrás cuál fue.'],
          ].map(([n, title, text], i) => (
            <div key={n} style={{ flex: 1, background: C.panel, borderRadius: 16, padding: 30, opacity: fadeIn(t, 0.6 + i * 1.6), borderTop: `8px solid ${C.yellow}` }}>
              <div style={{ fontSize: 80, fontWeight: 900, color: C.yellow, fontFamily: MONO }}>{n}</div>
              <div style={{ fontSize: 38, fontWeight: 800, margin: '10px 0' }}>{title}</div>
              <div style={{ fontSize: 28, lineHeight: 1.4, color: C.dim }}>{text}</div>
            </div>
          ))}
        </div>
      )}
      {fieldA > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: fieldA }}>
          <Field size={760} pose={poseOf(q)} trail={bad.filter((p) => p.t <= simT && p.t >= 0.5)} trailColor={C.red}
            overlay={(m) => crashed ? (
              <text x={m(q.x, q.y)[0] - 200} y={m(q.x, q.y)[1] + 80} fill={C.red} fontSize={44} fontWeight={900} fontFamily={FONT} stroke="#f3f0e8" strokeWidth={6} paintOrder="stroke">¡choque!</text>
            ) : null} />
        </div>
      )}
      {t > 25.5 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: 860, opacity: fadeIn(t, 25.8) }}>
          <div style={{ fontSize: 26, color: C.dim, marginBottom: 10 }}>Lo que le pasó al coche del equipo, en una tarde</div>
          {ATTEMPTS.map(([n, what, why], i) => (
            <div key={n} style={{ display: 'flex', gap: 16, fontSize: 24, padding: '9px 14px', marginBottom: 6, background: C.panel, borderRadius: 10, opacity: fadeIn(t, 26 + i * 0.5) }}>
              <div style={{ width: 60, fontFamily: MONO, color: C.yellow, fontWeight: 800 }}>{n}</div>
              <div style={{ width: 320, fontWeight: 700 }}>{what}</div>
              <div style={{ flex: 1, color: C.dim }}>{why}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ position: 'absolute', left: t > 25.5 ? 900 : 810, top: 0, width: t > 25.5 ? 900 : 990 }}>
        <Card t={t} from={9.2} to={25.5} x={0} y={0} w={960} accent={C.red}>
          <B c={C.red}>Caso 4 · el giroscopio está invertido.</B> Esta es la estrategia con el signo del giroscopio al revés:
          la esquina empieza (el volante va a tope), pero el rumbo que cree el coche va al revés.
          La esquina <B c={C.red}>nunca acaba</B> y el coche sigue hasta el muro.
        </Card>
        <Card t={t} from={14} to={25.5} x={0} y={250} w={960}>
          <B>Diagnostica</B> con el coche en el aire: gíralo a mano a la izquierda.
          <Code size={24}>{'ros2 topic echo /robotek/imu --field angular_velocity.z\n# a la izquierda: positivo'}</Code>
          <div style={{ marginTop: 10 }}>Si sale negativo: los ejes de <span style={{ fontFamily: MONO, color: C.yellow }}>imu_adapter</span> están mal. Mídelos otra vez.</div>
        </Card>
        {t > 25.5 && (
          <div style={{ opacity: fadeIn(t, 30) }}>
            <div style={{ fontSize: 26, color: C.dim, marginBottom: 10 }}>Busca tu síntoma, salta al caso</div>
            {SYMPTOMS.map(([s, c], i) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 25, padding: '7px 14px', borderBottom: `1px solid ${C.line}`, opacity: fadeIn(t, 30.2 + i * 0.35) }}>
                <div>{s}</div><div style={{ fontFamily: MONO, color: C.accent, fontWeight: 800 }}>caso {c}</div>
              </div>
            ))}
            <div style={{ marginTop: 16, fontSize: 24, color: C.dim }}>Cada caso: cómo se ve, causas, diagnóstico con comandos, arreglo y cómo comprobarlo.</div>
          </div>
        )}
      </div>
    </Frame>
  );
};
