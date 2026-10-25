import { getCollection, type CollectionEntry } from "astro:content";

export const SITE = "https://renzodamian.com";
export const REPO = "https://github.com/renzodamgo/robotek-learn";

/** What changes from one guide to another in the shared pages (step page, sidebar). */
export interface GuideConfig {
    id: string;
    /** Short name for breadcrumbs and the sidebar, e.g. "Estrategia del Open". */
    short: string;
    /** Course name for the structured data, e.g. "Construye la estrategia del Open". */
    course: string;
    /** Last numbered step; later chapters are labelled as real-car chapters. */
    lastStep: number;
    /** Terminal command that shows what the reference changes between two tags. */
    diffCommand: (from: string, to: string) => string;
    /** Terminal command that compares the reader's tree with the reference of a tag. */
    mineCommand: (tag: string) => string;
}

const stepNumber = (tag: string) => tag.replace(/^.*step-/, "");

export const GUIDES: Record<string, GuideConfig> = {
    "open-strategy": {
        id: "open-strategy",
        short: "Estrategia del Open",
        course: "Construye la estrategia del Open",
        lastStep: 9,
        diffCommand: (from, to) =>
            `bash tools/compare-step.sh ${stepNumber(from)} ${stepNumber(to)}`,
        mineCommand: (tag) => `bash tools/compare-step.sh ${stepNumber(tag)}`,
    },
    "obstacle-strategy": {
        id: "obstacle-strategy",
        short: "Estrategia del Obstacle",
        course: "Construye la estrategia del Obstacle",
        lastStep: 9,
        diffCommand: (from, to) =>
            `git fetch origin --tags && git diff ${from} ${to} -- src/my_obstacle`,
        mineCommand: (tag) => `git diff ${tag} -- src/my_obstacle`,
    },
};

/** The Open guide, the default of the helpers below. */
export const GUIDE_ID = "open-strategy";

export function guideBase(guide: string): string {
    return `/learn/${guide}/`;
}

export const GUIDE_BASE = guideBase(GUIDE_ID);

export function guideConfig(guide: string): GuideConfig {
    const config = GUIDES[guide];
    if (!config) throw new Error(`Unknown guide "${guide}"`);
    return config;
}

export type StepEntry = CollectionEntry<"steps">;

/** Steps of a guide sorted by `order` (chapter 0 first). */
export async function getGuideSteps(guide = GUIDE_ID): Promise<StepEntry[]> {
    const all = await getCollection("steps", ({ data }) => data.guide === guide);
    return all.sort((a, b) => a.data.order - b.data.order);
}

export function stepUrl(step: StepEntry): string {
    return `${guideBase(step.data.guide)}${step.data.slug}/`;
}

/** The first chapters that are numbered steps (1 to 9) of the Open guide; 10 and up are the real-car chapters. */
export const LAST_STEP = GUIDES[GUIDE_ID].lastStep;

export function stepLabel(step: StepEntry): string {
    const last = guideConfig(step.data.guide).lastStep;
    if (step.data.order === 0) return "Preparación";
    if (step.data.order > last) return "Coche real";
    return `Paso ${step.data.order}`;
}
