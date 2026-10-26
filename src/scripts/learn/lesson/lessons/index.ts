// The interactive lessons, by guide and step number.
import type { Lesson } from '../types';
import { step0, step1, step2, step3, step4 } from './open-0-4';
import { step5, step6, step7, step8, step9 } from './open-5-9';
import { OBSTACLE_LESSONS } from './obstacle';

export const LESSONS: Record<string, Lesson[]> = {
  'open-strategy': [step0, step1, step2, step3, step4, step5, step6, step7, step8, step9],
  'obstacle-strategy': OBSTACLE_LESSONS,
};

export function findLesson(guide: string, step: number): Lesson | undefined {
  return LESSONS[guide]?.find((l) => l.step === step);
}
