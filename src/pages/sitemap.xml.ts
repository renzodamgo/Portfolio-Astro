import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://renzodamian.com";

export const GET: APIRoute = async () => {
    const guides = await getCollection("guides");
    const steps = (await getCollection("steps")).sort(
        (a, b) => a.data.order - b.data.order,
    );

    const entries: { loc: string; lastmod?: string }[] = [
        { loc: `${SITE}/`, lastmod: "2026-10-26" },
        { loc: `${SITE}/learn/` },
        ...guides.map((guide) => ({ loc: `${SITE}/learn/${guide.id}/` })),
        ...steps.map((step) => ({
            loc: `${SITE}/learn/${step.data.guide}/${step.data.slug}/`,
        })),
        { loc: `${SITE}/learn/open-strategy/simulador/` },
    ];

    const body = entries
        .map(
            ({ loc, lastmod }) =>
                `  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`,
        )
        .join("\n");

    return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
        { headers: { "Content-Type": "application/xml; charset=utf-8" } },
    );
};
