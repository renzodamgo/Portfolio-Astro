// Obstacle fields of the rules (robotek_evaluation.obstacle_field.regulation_signs), generated with that function.
// The lessons use layouts where the course's reference solution scores in the course's Obstacle lab: 4 CCW and
// 3 CW give 40 points, 0 CCW with the lot 55; 1 CCW fails on the reference (a green sign).
import type { Sign } from '../types';

/** Layout 4 without the lot (CCW: 40 points, ≈115 s, the field of Gazebo in the guide). */
export const LAYOUT_4: Sign[] = [
  { x: -1.1, y: 0.0, color: 'red', side: 'left' },
  { x: 0.0, y: 0.9, color: 'red', side: 'top' },
  { x: 1.1, y: -0.5, color: 'green', side: 'right' },
  { x: 1.1, y: 0.5, color: 'red', side: 'right' },
  { x: -0.5, y: -0.9, color: 'red', side: 'bottom' },
  { x: 0.5, y: -0.9, color: 'green', side: 'bottom' },
];
/** Layout 3 without the lot (CW: 40 points). */
export const LAYOUT_3: Sign[] = [
  { x: -1.1, y: 0.0, color: 'green', side: 'left' },
  { x: 0.5, y: 0.9, color: 'green', side: 'top' },
  { x: -0.5, y: 0.9, color: 'red', side: 'top' },
  { x: 1.1, y: -0.5, color: 'green', side: 'right' },
  { x: 0.9, y: 0.5, color: 'red', side: 'right' },
  { x: -0.5, y: -0.9, color: 'green', side: 'bottom' },
  { x: 0.5, y: -1.1, color: 'red', side: 'bottom' },
];
/** Layout 0 with the lot (CCW: 55 points with the parking; the signs of the start straight on the inner row). */
export const LAYOUT_0_LOT: Sign[] = [
  { x: 1.1, y: 0.0, color: 'red', side: 'right' },
  { x: -0.5, y: -0.9, color: 'red', side: 'bottom' },
  { x: -1.1, y: -0.5, color: 'green', side: 'left' },
  { x: 0.5, y: 0.9, color: 'red', side: 'top' },
  { x: -0.5, y: 1.1, color: 'green', side: 'top' },
];
/** Layout 1 without the lot: the reference touches a sign in CCW (a known limit, step 9). */
export const LAYOUT_1: Sign[] = [
  { x: -1.1, y: 0.0, color: 'green', side: 'left' },
  { x: -0.5, y: 1.1, color: 'green', side: 'top' },
  { x: 0.9, y: 0.0, color: 'red', side: 'right' },
  { x: -0.5, y: -0.9, color: 'green', side: 'bottom' },
  { x: 0.5, y: -1.1, color: 'red', side: 'bottom' },
];
