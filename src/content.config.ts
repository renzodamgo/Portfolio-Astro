import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const guides = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/learn/guides" }),
    schema: z.object({
        title: z.string(),
        summary: z.string(),
        repo: z.string().url(),
        level: z.string(),
        minutes: z.number(),
        order: z.number(),
        cover: z.string().optional(),
    }),
});

const steps = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/learn/steps" }),
    schema: z.object({
        /** Guide id (file name of the guide, e.g. "open-strategy"). */
        guide: z.string(),
        order: z.number(),
        /** URL segment, e.g. "paso-1-el-coche". */
        slug: z.string(),
        title: z.string(),
        summary: z.string(),
        /** Git tag of the solution at the end of this step, e.g. "step-3". */
        tag: z.string(),
        /** Tag to compare from, e.g. "step-2". */
        compareFrom: z.string(),
    }),
});

export const collections = { guides, steps };
