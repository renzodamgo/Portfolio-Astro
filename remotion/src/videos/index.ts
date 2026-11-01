import React from 'react';
import { STEPS } from '../steps';
import * as V from './all';

// Each video module exports a component named like the step id and its length as <ID>_SECONDS.
const modules = V as unknown as Record<string, unknown>;

export const VIDEOS = STEPS.filter((s) => modules[s.id]).map((s) => ({
  slug: s.slug,
  component: modules[s.id] as React.FC,
  seconds: modules[`${s.id.toUpperCase()}_SECONDS`] as number,
}));
