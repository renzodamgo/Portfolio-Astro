import React from 'react';
import { Frame, Card, B, Check, useT, timeMap, fadeIn } from '../components/ui';
import { Field, poseOf } from '../components/Field';
import { C, FONT, MONO, num } from '../theme';
import { at, run, wrap } from '../sim';

export const PASO6_SECONDS = 40;

export const Paso6: React.FC = () => {
  const t = useT();
  const lane = run({ direction: 'ccw' });
  // first corner slowly (decided by the open side), the second one slowly (decided by two sightings), then a lap
  const simT = timeMap(t, [[0, 1.3], [2, 1.3], [12, 2.2], [14, 2.2], [17, 3.6], [25, 4.7], [27, 4.7], [37, 12.6]]);
  const q = at(lane, simT);
  const inner = q.scene.left;
  const limit = Math.min(0.35, Math.max(0, inner - 0.08));
  const open = isFinite(inner) && inner > 1.0;
  const due = !q.arc && q.travelled >= 0.25 && q.frontOk && q.islandDone;
  const firing = q.arc && at(lane, simT - 0.25).arc === false;
  const zoom = t < 17 ? { cx: 0.4, cy: -0.75, span: 2.3 } : t < 27 ? { cx: 0.75, cy: 0.4, span: 2.3 } : undefined;

  return (
    <Frame id="Paso6" subtitle="La puerta: girar solo cuando se cumplen tres condiciones a la vez">
      <div style={{ position: 'absolute', left: 0, top: 0 }}>
        <Field size={760} pose={poseOf(q)} trail={lane.filter((p) => p.t <= simT && p.t >= 0.5)} zoom={zoom}
          scene={t < 27 ? { ...q.scene, sign: 1, forwardYaw: wrap(q.goal - q.myYaw) } : undefined}
          overlay={(m) => (firing || (q.arc && t < 27)) ? (
            <text x={m(q.x, q.y)[0] - 60} y={m(q.x, q.y)[1] + 90} fill={C.accent} fontSize={40} fontFamily={FONT} fontWeight={900} stroke="#0f1724" strokeWidth={6} paintOrder="stroke">¡GIRA!</text>
          ) : null} />
      </div>
      <div style={{ position: 'absolute', left: 810, top: 0, width: 990 }}>
        <div style={{ background: C.panel, borderRadius: 14, padding: '18px 26px', opacity: fadeIn(t, 0.6) }}>
          <div style={{ fontSize: 24, color: C.dim, marginBottom: 6 }}>Cada tick (50 por segundo) la puerta pregunta:</div>
          <Check on={!q.arc && q.travelled >= 0.25} label="avanzó 0,25 m desde la última esquina"
            detail={q.arc ? 'girando' : `${num(Math.min(q.travelled, 9.99))} m`} />
          <Check on={q.frontOk} label={<span>pared de enfrente <span style={{ fontFamily: MONO, color: C.yellow }}>front_axis</span> ≤ 1,19 m</span>} detail={`${num(q.scene.front)} m`} />
          <Check on={q.islandDone} label={<span>la isla terminó: lado abierto (&gt; 1 m) <b>o</b> su final ≤ {num(limit)} m en 2 escaneos</span>}
            detail={open ? `lado ${num(inner)} m` : `${q.hits}/2`} />
          <div style={{ marginTop: 10, fontSize: 30, fontWeight: 800, color: due || q.arc ? C.accent : C.dim }}>
            {q.arc ? `Esquina en curso · ${q.completed} hechas` : due ? '→ ¡gira!' : `Recto · ${q.completed} esquinas hechas`}
          </div>
        </div>
        <Card t={t} from={2.5} to={11.5} x={0} y={440} w={960} accent={C.accent}>
          A 25 cm de la isla decide el <B c={C.accent}>lado abierto</B>: la isla ya terminó cuando el coche está en x ≈ 0,42 m.
        </Card>
        <Card t={t} from={11.8} to={17.3} x={0} y={440} w={960} accent={C.yellow}>
          Lo que avanzó se mide <B c={C.yellow}>sin encoder</B>: es cuánto se acercó la pared de enfrente desde que empezó la recta.
          Al terminar la esquina vuelve a cero.
        </Card>
        <Card t={t} from={17.5} to={26.5} x={0} y={440} w={960} accent={C.orange}>
          Aquí decide ver el <B c={C.orange}>final de la isla</B> dos escaneos seguidos. Un escaneo cuenta <B>una</B> vez:
          el LiDAR da 10 por segundo y el control corre a 50.
        </Card>
        <Card t={t} from={27.3} x={0} y={440} w={960}>
          Antes de tiempo, se come la isla; tarde, choca. Con la puerta, el coche gira esquina tras esquina alrededor de la isla.
        </Card>
      </div>
    </Frame>
  );
};
