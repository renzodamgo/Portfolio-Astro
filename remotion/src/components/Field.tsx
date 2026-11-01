import React from 'react';
import { C, FONT, num } from '../theme';
import { BEAMS, ISLAND, LIDAR_X, OUTER, Sample, WHEELBASE, raycast } from '../sim';

export type Pose = { x: number; y: number; yaw: number; steer: number };
export type Mapper = (x: number, y: number) => [number, number];

const SPAN = 3.3; // m shown

type Props = {
  size: number;
  pose: Pose;
  trail?: { x: number; y: number }[]; // the driven path
  trailColor?: string;
  rays?: boolean;
  scene?: { left: number; right: number; front: number; islandEnd: number; sign: number; forwardYaw: number };
  lane?: boolean;
  sections?: (number | null)[]; // 8 alphas, ccw from the start section
  coloredLines?: boolean;
  ghost?: Pose[];
  overlay?: (m: Mapper, s: number) => React.ReactNode;
  carOpacity?: number;
  zoom?: { cx: number; cy: number; span: number };
};

export const Car: React.FC<{ pose: Pose; m: Mapper; s: number; opacity?: number; color?: string }> = ({ pose, m, s, opacity = 1, color = C.car }) => {
  const [px, py] = m(pose.x, pose.y);
  const deg = (-pose.yaw * 180) / Math.PI;
  const L = WHEELBASE * s;
  const wl = 0.06 * s, ww = 0.026 * s, half = 0.0665 * s;
  const sd = (-pose.steer * 180) / Math.PI;
  return (
    <g transform={`translate(${px} ${py}) rotate(${deg})`} opacity={opacity}>
      {[-1, 1].map((k) => (
        <rect key={`r${k}`} x={-wl / 2} y={k * half - ww / 2} width={wl} height={ww} rx={3} fill="#111" />
      ))}
      {[-1, 1].map((k) => (
        <g key={`f${k}`} transform={`translate(${L} ${k * half}) rotate(${sd})`}>
          <rect x={-wl / 2} y={-ww / 2} width={wl} height={ww} rx={3} fill="#111" />
        </g>
      ))}
      <rect x={-0.045 * s} y={-0.05 * s} width={0.19 * s} height={0.1 * s} rx={0.015 * s} fill={color} stroke={C.carDark} strokeWidth={2} />
      <circle cx={LIDAR_X * s} cy={0} r={0.022 * s} fill="#222" stroke="#555" strokeWidth={2} />
      <path d={`M ${0.02 * s} 0 L ${0.075 * s} 0`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
      <path d={`M ${0.075 * s} 0 l ${-0.018 * s} ${-0.012 * s} M ${0.075 * s} 0 l ${-0.018 * s} ${0.012 * s}`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
};

// Section centres, ccw from the start section (south middle).
export const SECTION_CELLS: [number, number][] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

export const Field: React.FC<Props> = ({ size, pose, trail, trailColor = C.yellow, rays, scene, lane, sections, coloredLines = true, ghost, overlay, carOpacity = 1, zoom }) => {
  const span = zoom?.span ?? SPAN;
  const cx = zoom?.cx ?? 0, cy = zoom?.cy ?? 0;
  const s = size / span;
  const m: Mapper = (x, y) => [(x - cx + span / 2) * s, (cy - y + span / 2) * s];
  const rect = (x0: number, y0: number, x1: number, y1: number) => {
    const [a, b] = m(x0, y1);
    return { x: a, y: b, width: (x1 - x0) * s, height: (y1 - y0) * s };
  };
  const lidar = { x: pose.x + LIDAR_X * Math.cos(pose.yaw), y: pose.y + LIDAR_X * Math.sin(pose.yaw) };
  const [lx, ly] = m(lidar.x, lidar.y);
  const path = trail && trail.length > 1 ? trail.map((q, i) => `${i ? 'L' : 'M'} ${m(q.x, q.y).join(' ')}`).join(' ') : '';
  const wallW = Math.max(4, 0.03 * s);

  const ray = (bearing: number, r: number, color: string, label: string, labelSide = 1) => {
    if (!isFinite(r)) return null;
    const a = pose.yaw + bearing;
    const [ex, ey] = m(lidar.x + r * Math.cos(a), lidar.y + r * Math.sin(a));
    const [mx, my] = [(lx + ex) / 2, (ly + ey) / 2];
    return (
      <g>
        <line x1={lx} y1={ly} x2={ex} y2={ey} stroke={color} strokeWidth={6} strokeLinecap="round" />
        <circle cx={ex} cy={ey} r={8} fill={color} />
        <g transform={`translate(${Math.max(8, Math.min(size - label.length * 14 - 14, labelSide > 0 ? mx + 18 : mx - 18 - label.length * 14))} ${my - 14})`}>
          <rect x={-6} y={-26} width={label.length * 14 + 12} height={36} rx={8} fill="rgba(15,23,36,0.85)" />
          <text x={0} y={0} fill={color} fontSize={24} fontFamily={FONT} fontWeight={700}>{label}</text>
        </g>
      </g>
    );
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'hidden', borderRadius: 18 }}>
      <rect x={0} y={0} width={size} height={size} fill="#2a2f38" />
      <rect {...rect(-OUTER, -OUTER, OUTER, OUTER)} fill={C.mat} />
      {SECTION_CELLS.map(([i, j], k) => (
        <rect key={k} {...rect(i - 0.5, j - 0.5, i + 0.5, j + 0.5)} fill={C.accent} opacity={sections?.[k] ?? 0} />
      ))}
      {[-0.5, 0.5].map((v) => (
        <g key={v} stroke={C.matLine} strokeWidth={2}>
          <line x1={m(v, -OUTER)[0]} y1={m(v, -OUTER)[1]} x2={m(v, OUTER)[0]} y2={m(v, OUTER)[1]} />
          <line x1={m(-OUTER, v)[0]} y1={m(-OUTER, v)[1]} x2={m(OUTER, v)[0]} y2={m(OUTER, v)[1]} />
        </g>
      ))}
      {coloredLines &&
        [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([sx, sy], k) => {
          const base = Math.atan2(sy, sx);
          return [-1, 1].map((d) => {
            const a = base + d * 0.35;
            const [x0, y0] = m(sx * ISLAND, sy * ISLAND);
            const len = Math.min(1 / Math.abs(Math.cos(a)), 1 / Math.abs(Math.sin(a)));
            const [x1, y1] = m(sx * ISLAND + len * Math.cos(a), sy * ISLAND + len * Math.sin(a));
            const blue = (d > 0) === (sx * sy > 0);
            return <line key={`${k}${d}`} x1={x0} y1={y0} x2={x1} y2={y1} stroke={blue ? C.blue : C.orange} strokeWidth={0.02 * s} />;
          });
        })}
      {lane && (
        <rect {...rect(-ISLAND - 0.25, -ISLAND - 0.25, ISLAND + 0.25, ISLAND + 0.25)} fill="none" stroke={C.accent} strokeWidth={3} strokeDasharray="14 10" />
      )}
      <rect {...rect(-OUTER, -OUTER, OUTER, OUTER)} fill="none" stroke={C.wall} strokeWidth={wallW} />
      <rect {...rect(-ISLAND, -ISLAND, ISLAND, ISLAND)} fill={C.wall} />
      {path && <path d={path} fill="none" stroke={trailColor} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />}
      {rays &&
        BEAMS.filter((_, i) => i % 3 === 0).map((b, i) => {
          const [r] = raycast(lidar.x, lidar.y, pose.yaw + b);
          if (!isFinite(r)) return null;
          const [ex, ey] = m(lidar.x + r * Math.cos(pose.yaw + b), lidar.y + r * Math.sin(pose.yaw + b));
          return <line key={i} x1={lx} y1={ly} x2={ex} y2={ey} stroke={C.ray} strokeWidth={2} />;
        })}
      {ghost?.map((g, i) => <Car key={i} pose={g} m={m} s={s} opacity={0.25} />)}
      {scene && (
        <g>
          {ray(scene.sign * Math.PI / 2, scene.sign > 0 ? scene.left : scene.right, C.accent, `isla ${num(scene.sign > 0 ? scene.left : scene.right)} m`, -1)}
          {ray(-scene.sign * Math.PI / 2, scene.sign > 0 ? scene.right : scene.left, C.violet, `${scene.sign > 0 ? 'right' : 'left'} ${num(scene.sign > 0 ? scene.right : scene.left)} m`)}
          {ray(scene.forwardYaw, scene.front, C.yellow, `front_axis ${num(scene.front)} m`)}
          {isFinite(scene.islandEnd) && (() => {
            const ex = pose.x + scene.islandEnd * Math.cos(pose.yaw);
            const ey = pose.y + scene.islandEnd * Math.sin(pose.yaw);
            const nx = -Math.sin(pose.yaw) * scene.sign, ny = Math.cos(pose.yaw) * scene.sign;
            const [a, b] = m(ex, ey);
            const [c, d] = m(ex + nx * 0.25, ey + ny * 0.25);
            return (
              <g>
                <line x1={a} y1={b} x2={c} y2={d} stroke={C.orange} strokeWidth={5} strokeDasharray="8 6" />
                <circle cx={c} cy={d} r={11} fill={C.orange} />
                <text x={c + 16} y={d - 16} fill={C.orange} fontSize={24} fontFamily={FONT} fontWeight={700} stroke="rgba(15,23,36,0.9)" strokeWidth={5} paintOrder="stroke">
                  island_end {num(scene.islandEnd)} m
                </text>
              </g>
            );
          })()}
        </g>
      )}
      <Car pose={pose} m={m} s={s} opacity={carOpacity} />
      {overlay?.(m, s)}
    </svg>
  );
};

export const poseOf = (q: Sample): Pose => ({ x: q.x, y: q.y, yaw: q.yaw, steer: q.steer });
