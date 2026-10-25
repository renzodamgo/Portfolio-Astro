// Fields a replay can be drawn on. Walls are [centre x, centre y, size x, size y] in metres (x east, y north).
import { WALLS, type Wall } from '../car-sim/constants';
import type { FieldName, Track } from './format';

export interface FieldSpec {
  walls: readonly Wall[];
  /** Floor plane size in metres; `mat` draws the game mat texture on it. */
  floor: { width: number; height: number; cx: number; cy: number; mat: boolean };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

const T = 0.04; // wall thickness, as the game mat walls

export function fieldSpec(name: FieldName, tracks: readonly Track[]): FieldSpec {
  if (name === 'square100') {
    return { walls: WALLS, floor: { width: 3.2, height: 3.2, cx: 0, cy: 0, mat: true }, bounds: { minX: -1.6, maxX: 1.6, minY: -1.6, maxY: 1.6 } };
  }
  if (name === 'long-island') {
    // Island 9 m x 1 m centred at the origin; the outer walls are 1 m away from it.
    const ox = 4.5 + 1, oy = 0.5 + 1;
    const walls: Wall[] = [
      [0, 0.5 - T / 2, 9, T], [0, -0.5 + T / 2, 9, T], [4.5 - T / 2, 0, T, 1], [-4.5 + T / 2, 0, T, 1], // island
      [ox + T / 2, 0, T, 2 * oy + 2 * T], [-ox - T / 2, 0, T, 2 * oy + 2 * T], // outer, short sides
      [0, oy + T / 2, 2 * ox + 2 * T, T], [0, -oy - T / 2, 2 * ox + 2 * T, T], // outer, long sides
    ];
    return { walls, floor: { width: 2 * ox + 0.2, height: 2 * oy + 0.2, cx: 0, cy: 0, mat: false }, bounds: { minX: -ox - 0.1, maxX: ox + 0.1, minY: -oy - 0.1, maxY: oy + 0.1 } };
  }
  // empty: floor only, sized to the driven area (at least 4 x 3 m, with a margin)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const tr of tracks) {
    for (let i = 0; i < tr.t.length; i++) {
      minX = Math.min(minX, tr.x[i]); maxX = Math.max(maxX, tr.x[i]);
      minY = Math.min(minY, tr.y[i]); maxY = Math.max(maxY, tr.y[i]);
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const hw = Math.max(2, (maxX - minX) / 2 + 0.6), hh = Math.max(1.5, (maxY - minY) / 2 + 0.6);
  return {
    walls: [],
    floor: { width: 2 * hw + 2, height: 2 * hh + 2, cx, cy, mat: false },
    bounds: { minX: cx - hw, maxX: cx + hw, minY: cy - hh, maxY: cy + hh },
  };
}
