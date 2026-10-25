import { getCollection, type CollectionEntry } from "astro:content";

export const SITE = "https://renzodamian.com";
export const GUIDE_ID = "open-strategy";
export const GUIDE_BASE = "/learn/open-strategy/";

export type StepEntry = CollectionEntry<"steps">;

/** Steps of a guide sorted by `order` (chapter 0 first). */
export async function getGuideSteps(guide = GUIDE_ID): Promise<StepEntry[]> {
    const all = await getCollection("steps", ({ data }) => data.guide === guide);
    return all.sort((a, b) => a.data.order - b.data.order);
}

export function stepUrl(step: StepEntry): string {
    return `${GUIDE_BASE}${step.data.slug}/`;
}

export function stepLabel(step: StepEntry): string {
    return step.data.order === 0 ? "Preparación" : `Paso ${step.data.order}`;
}
