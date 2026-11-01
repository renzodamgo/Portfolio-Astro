import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { C, FONT, MONO } from '../theme';
import { STEPS, stepIndex } from '../steps';

export const useT = () => useCurrentFrame() / useVideoConfig().fps; // seconds

export const fadeIn = (t: number, start: number, dur = 0.5) =>
  interpolate(t, [start, start + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

export const window_ = (t: number, a: number, b: number, fade = 0.4) =>
  Math.min(fadeIn(t, a, fade), 1 - fadeIn(t, b - fade, fade));

export const progress = (t: number, a: number, b: number) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

// The frame shared by every video: title, content and, along the bottom, the strategy built so far
// (one block per chapter of the guide; the block of this video lights up).
export const Frame: React.FC<{ id: string; subtitle: string; children: React.ReactNode; stackAt?: number }> = ({ id, subtitle, children, stackAt = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const idx = stepIndex(id);
  const step = STEPS[idx];
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT, color: C.text }}>
      <div style={{ position: 'absolute', left: 60, top: 30, opacity: enter, transform: `translateY(${(1 - enter) * -20}px)` }}>
        <div style={{ fontSize: 24, color: C.accent, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          Estrategia Open · {step.number.includes('.') ? 'Capítulo' : 'Paso'} {step.number}
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, marginTop: 2 }}>{step.title}</div>
        <div style={{ fontSize: 28, color: C.dim, marginTop: 4 }}>{subtitle}</div>
      </div>
      <div style={{ position: 'absolute', left: 60, top: 190, width: 1800, height: 760 }}>{children}</div>
      <Blocks idx={idx} t={t} at={stackAt} />
    </AbsoluteFill>
  );
};

const Blocks: React.FC<{ idx: number; t: number; at: number }> = ({ idx, t, at }) => (
  <div style={{ position: 'absolute', left: 60, right: 60, bottom: 22 }}>
    <div style={{ fontSize: 17, color: C.dim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Tu estrategia, capítulo a capítulo</div>
    <div style={{ display: 'flex', gap: 6 }}>
      {STEPS.map((s, i) => {
        const isNew = i === idx;
        const a = isNew ? fadeIn(t, at, 0.6) : 1;
        const done = i < idx || (isNew && a > 0.5);
        return (
          <div key={s.id} style={{
            flex: 1, height: 58, borderRadius: 8, padding: '4px 8px', fontSize: 15, lineHeight: 1.15,
            background: isNew ? `rgba(242,201,76,${a})` : done ? (s.group === 'car' ? '#2b6f5c' : '#1f5c4c') : 'transparent',
            border: `2px solid ${isNew ? C.yellow : done ? 'transparent' : C.line}`,
            color: isNew && a > 0.5 ? '#2a1f00' : done ? C.text : '#5b6b84', fontWeight: isNew ? 800 : 500,
            transform: isNew ? `scale(${1 + 0.06 * Math.sin(Math.min(1, a) * Math.PI)})` : undefined,
          }}>
            <div style={{ opacity: 0.75 }}>{s.number}</div>
            <div>{s.block}</div>
          </div>
        );
      })}
    </div>
  </div>
);

// A card of text that fades in and out at the given seconds.
export const Card: React.FC<{ t: number; from: number; to?: number; x: number; y: number; w: number; children: React.ReactNode; accent?: string; style?: React.CSSProperties }> = ({ t, from, to = 1e9, x, y, w, children, accent = C.accent, style }) => {
  const a = window_(t, from, to);
  if (a <= 0) return null;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width: w, opacity: a, transform: `translateY(${(1 - a) * 16}px)`,
      background: C.panel, borderLeft: `6px solid ${accent}`, borderRadius: 14, padding: '20px 26px', fontSize: 30, lineHeight: 1.35,
      boxShadow: '0 10px 30px rgba(0,0,0,0.25)', ...style,
    }}>
      {children}
    </div>
  );
};

export const Code: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 28, color = C.yellow }) => (
  <div style={{ fontFamily: MONO, fontSize: size, color, background: '#0b111b', borderRadius: 10, padding: '12px 18px', marginTop: 10, whiteSpace: 'pre', lineHeight: 1.4 }}>
    {children}
  </div>
);

export const B: React.FC<{ children: React.ReactNode; c?: string }> = ({ children, c = C.yellow }) => (
  <span style={{ color: c, fontWeight: 800 }}>{children}</span>
);

// A line chart of series against time, drawn up to `upTo`.
export type Series = { values: [number, number][]; color: string; label: string; dash?: string };
export const Plot: React.FC<{
  x: number; y: number; w: number; h: number; t0: number; t1: number; y0: number; y1: number; upTo: number;
  series: Series[]; yLabel: string; xLabel?: string; yTicks?: number[]; fmt?: (v: number) => string; hlines?: { v: number; color: string; label: string }[];
}> = ({ x, y, w, h, t0, t1, y0, y1, upTo, series, yLabel, xLabel = 't (s)', yTicks = [], fmt = (v) => String(v), hlines = [] }) => {
  const px = (t: number) => 70 + ((t - t0) / (t1 - t0)) * (w - 90);
  const py = (v: number) => 54 + (1 - (v - y0) / (y1 - y0)) * (h - 104);
  return (
    <svg style={{ position: 'absolute', left: x, top: y }} width={w} height={h}>
      <rect x={0} y={0} width={w} height={h} rx={14} fill={C.panel} />
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={70} x2={w - 20} y1={py(v)} y2={py(v)} stroke={C.line} strokeWidth={1} />
          <text x={60} y={py(v) + 7} fill={C.dim} fontSize={20} textAnchor="end" fontFamily={FONT}>{fmt(v)}</text>
        </g>
      ))}
      {hlines.map((l) => (
        <g key={l.label}>
          <line x1={70} x2={w - 20} y1={py(l.v)} y2={py(l.v)} stroke={l.color} strokeWidth={2} strokeDasharray="8 6" />
          <text x={w - 24} y={py(l.v) - 8} fill={l.color} fontSize={20} textAnchor="end" fontFamily={FONT}>{l.label}</text>
        </g>
      ))}
      {series.map((s) => {
        const pts = s.values.filter(([t]) => t <= upTo);
        if (pts.length < 2) return null;
        return <path key={s.label} d={pts.map(([t, v], i) => `${i ? 'L' : 'M'} ${px(t)} ${py(Math.max(y0, Math.min(y1, v)))}`).join(' ')} fill="none" stroke={s.color} strokeWidth={4} strokeDasharray={s.dash} />;
      })}
      <text x={18} y={30} fill={C.dim} fontSize={20} fontFamily={FONT}>{yLabel}</text>
      <text x={w - 24} y={h - 14} fill={C.dim} fontSize={20} textAnchor="end" fontFamily={FONT}>{xLabel}</text>
      <g transform={`translate(80 ${h - 22})`}>
        {series.map((s, i) => (
          <g key={s.label} transform={`translate(${i * 200} 0)`}>
            <rect x={0} y={-12} width={24} height={6} fill={s.color} />
            <text x={32} y={-4} fill={C.text} fontSize={20} fontFamily={FONT}>{s.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
};

export const Check: React.FC<{ on: boolean; label: React.ReactNode; detail?: React.ReactNode; size?: number }> = ({ on, label, detail, size = 28 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: size, margin: '8px 0', opacity: on ? 1 : 0.65 }}>
    <div style={{ width: size * 1.2, height: size * 1.2, borderRadius: 8, background: on ? C.accent : 'transparent', border: `3px solid ${on ? C.accent : C.dim}`, color: '#06231a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: size * 0.9 }}>
      {on ? '✓' : ''}
    </div>
    <div style={{ flex: 1 }}>{label}</div>
    {detail && <div style={{ color: on ? C.accent : C.dim, fontFamily: MONO, fontSize: size * 0.85 }}>{detail}</div>}
  </div>
);

export const Big: React.FC<{ t: number; from: number; to?: number; children: React.ReactNode }> = ({ t, from, to = 1e9, children }) => {
  const a = window_(t, from, to);
  return a > 0 ? (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: a }}>
      <div style={{ fontSize: 64, fontWeight: 800, textAlign: 'center', maxWidth: 1400, lineHeight: 1.25 }}>{children}</div>
    </AbsoluteFill>
  ) : null;
};

// Piecewise-linear map from video seconds to simulation seconds: [[video, sim], ...].
export const timeMap = (t: number, points: [number, number][]) =>
  interpolate(t, points.map((p) => p[0]), points.map((p) => p[1]), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

export const Stat: React.FC<{ label: string; value: React.ReactNode; color?: string; w?: number }> = ({ label, value, color = C.text, w }) => (
  <div style={{ flex: w ? undefined : 1, width: w, background: C.panel, borderRadius: 12, padding: '10px 16px' }}>
    <div style={{ fontSize: 20, color: C.dim }}>{label}</div>
    <div style={{ fontSize: 34, fontWeight: 800, color }}>{value}</div>
  </div>
);
