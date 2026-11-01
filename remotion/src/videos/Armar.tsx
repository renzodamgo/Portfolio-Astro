import React from 'react';
import { Img, staticFile } from 'remotion';
import { Frame, B, useT, fadeIn, window_ } from '../components/ui';
import { C, MONO } from '../theme';

export const ARMAR_SECONDS = 43;

// The guide's own assembly drawings (public/learn/assembly), made from the team's 3D model.
const STEPS: [string, string, string][] = [
  ['step-1.png', 'Bolsa 1 · el chasis', 'La placa base sola'],
  ['step-2.png', 'Bolsa 1 · el chasis', 'El servo baja hasta su hueco en la placa; la dirección se monta delante'],
  ['step-3.png', 'Bolsa 1 · el chasis', 'El eje entra de lado y el motor por detrás (posiciones aproximadas)'],
  ['step-4.png', 'Bolsa 1 · el chasis', 'Las cuatro ruedas entran por los lados'],
  ['step-5.png', 'Bolsa 2 · electrónica y sensores', 'La placa del driver baja a la parte trasera'],
  ['step-6.png', 'Bolsa 2 · electrónica y sensores', 'La caja impresa baja sobre la placa'],
  ['step-7.png', 'Bolsa 2 · electrónica y sensores', 'La Raspberry Pi entra de lado en la caja con cuatro tornillos M2'],
  ['step-8.png', 'Bolsa 2 · electrónica y sensores', 'La RRC Lite entra por la derecha de la caja con cuatro tornillos M2'],
  ['step-9.png', 'Bolsa 2 · electrónica y sensores', 'El LiDAR baja a la pestaña delantera; cuatro tornillos suben desde abajo'],
  ['step-10.png', 'Bolsa 2 · electrónica y sensores', 'El soporte detrás del LiDAR; la cámara encaja arriba con dos tornillos M1.6'],
  ['wiring-usb.svg', 'Bolsa 3 · los cables', 'Cámara, LiDAR y RRC Lite por USB a la Raspberry Pi 5'],
  ['wiring-motor.svg', 'Bolsa 3 · los cables', 'El TB6612FNG a los GPIO 12, 5 y 6 y a 3,3 V; el motor al TB6612; el servo a la RRC Lite'],
  ['wiring-power.svg', 'Bolsa 3 · los cables', 'Batería del motor al VM del TB6612; batería del Pi a la RRC Lite (5 V al Pi); LED al GPIO10'],
  ['final.png', 'Paso 14 · comprobar antes de rodar', 'El coche armado. Ruedas en el aire: primero la batería del Pi, la del motor al final'],
];
const START = 2.5, EACH = 2.6;

export const Armar: React.FC = () => {
  const t = useT();
  const i = Math.max(0, Math.min(STEPS.length - 1, Math.floor((t - START) / EACH)));
  const [file, bag, caption] = STEPS[i];
  const local = t - START - i * EACH;
  const a = t < START ? 0 : i === STEPS.length - 1 ? fadeIn(local, 0) : window_(local, 0, EACH, 0.3);
  const ending = t > START + STEPS.length * EACH;
  return (
    <Frame id="Armar" subtitle="Del montaje a los cables, con los dibujos del modelo 3D del equipo">
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1060, height: 760, background: '#f6f4ef', borderRadius: 18, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t >= START && (
          <Img src={staticFile(`learn/assembly/${file}`)} style={{ maxWidth: 1000, maxHeight: 700, opacity: a, transform: `scale(${0.96 + 0.04 * a})` }} />
        )}
        {t < START && (
          <div style={{ color: C.bg, fontSize: 40, fontWeight: 800, textAlign: 'center', padding: 60, opacity: fadeIn(t, 0.3) }}>
            La estrategia ya está hecha en simulación.<br />Ahora, el coche de verdad.
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 1100, top: 0, width: 700 }}>
        <div style={{ fontSize: 26, color: C.accent, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', opacity: t >= START ? 1 : 0 }}>{bag}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 14, opacity: t >= START ? 1 : 0 }}>
          <div style={{ fontSize: 90, fontWeight: 900, color: C.yellow, fontFamily: MONO, width: 140 }}>{i + 1 === STEPS.length ? 14 : i + 1}</div>
          <div style={{ fontSize: 32, lineHeight: 1.3, opacity: Math.max(0.2, a) }}>{caption}</div>
        </div>
        <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STEPS.map((_, k) => (
            <div key={k} style={{ width: 38, height: 38, borderRadius: 8, background: k <= i && t >= START ? (k < 4 ? '#2b6f5c' : k < 10 ? '#2f5d8a' : '#7a5a1e') : C.panel, color: C.text, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO }}>{k === 13 ? 14 : k + 1}</div>
          ))}
        </div>
        <div style={{ marginTop: 40, background: C.panel, borderRadius: 14, padding: '18px 24px', fontSize: 26, lineHeight: 1.4, opacity: fadeIn(t, 3) }}>
          Raspberry Pi 5 (el cerebro), RRC Lite (IMU, servo, botón), LiDAR LD19, cámara USB, servo de 15 kg·cm,
          motor con reductora y puente <B>TB6612FNG</B>, dos baterías.
        </div>
        {ending && (
          <div style={{ marginTop: 24, fontSize: 26, color: C.dim, opacity: fadeIn(t, START + STEPS.length * EACH) }}>
            Motor, eje y dirección no están en el modelo 3D: su forma y su sitio son aproximados. Ante la duda, manda el coche real.
          </div>
        )}
      </div>
    </Frame>
  );
};
