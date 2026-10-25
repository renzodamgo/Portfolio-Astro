// Mat sections and the section-exit judge, shared by the replay player (replay/format.ts) and the manual
// challenge (car-sim/challenge.ts). Pure: no DOM, no three.js.
import { OUTLINE_FRONT, OUTLINE_HALF_WIDTH, OUTLINE_REAR } from './constants';

export type Direction = 'ccw' | 'cw';
export const MAX_SECTION_POINTS = 24;

/** Fixed mat sections as in rule_judge.mat_section: 0 bottom straight, then counter-clockwise. */
export function matSection(x: number, y: number): number {
  if (y < -0.5) return x < -0.5 ? 7 : x > 0.5 ? 1 : 0;
  if (y > 0.5) return x < -0.5 ? 5 : x > 0.5 ? 3 : 4;
  return x < 0 ? 6 : 2;
}

/** The section that holds the whole car outline, or null while it straddles a boundary. */
export function footprintSection(x: number, y: number, yaw: number): number | null {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  let found: number | null = null;
  for (const [lx, ly] of [[OUTLINE_FRONT, OUTLINE_HALF_WIDTH], [OUTLINE_FRONT, -OUTLINE_HALF_WIDTH],
    [-OUTLINE_REAR, -OUTLINE_HALF_WIDTH], [-OUTLINE_REAR, OUTLINE_HALF_WIDTH]]) {
    const section = matSection(x + lx * c - ly * s, y + lx * s + ly * c);
    if (found === null) found = section;
    else if (found !== section) return null;
  }
  return found;
}

/**
 * Section exits in the round direction, following the judge: a section counts when the whole outline has left it
 * towards the next one; backward crossings are not counted twice. Feed it one pose at a time.
 */
export function createSectionJudge(direction: Direction, max = MAX_SECTION_POINTS) {
  const sign = direction === 'ccw' ? 1 : -1;
  let current: number | null = null;
  let reverse = 0;
  let count = 0;
  return {
    /** Returns the section that was just exited (and counted) in the round direction, or null. */
    update(x: number, y: number, yaw: number): number | null {
      const section = footprintSection(x, y, yaw);
      if (current === null) { current = section; return null; }
      if (section === null || section === current) return null;
      if (section === (current + sign + 8) % 8) {
        const exited = current;
        current = section;
        if (reverse) { reverse--; return null; }
        if (count < max) { count++; return exited; }
        return null;
      }
      if (section === (current - sign + 8) % 8) {
        reverse++;
        current = section;
      }
      return null;
    },
    /** Section that holds the whole outline now, as last seen by the judge. */
    get current() { return current; },
    get count() { return count; },
  };
}
