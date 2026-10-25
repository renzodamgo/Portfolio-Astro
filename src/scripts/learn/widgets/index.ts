/**
 * Widget loader.
 *
 * In Markdown a widget is a placeholder element:
 *
 *   <div data-widget="bicycle"></div>
 *
 * For each placeholder this file lazy-imports `./<name>.ts` (once the element
 * is near the viewport) and calls its default export:
 *
 *   export default function mount(el: HTMLElement): void | (() => void) { … }
 *
 * Registry: it is built with `import.meta.glob`, so adding a widget means only
 * creating `src/scripts/learn/widgets/<name>.ts`. There is no list to edit and
 * nothing to register by hand (the `registerWidgets` of other designs is this
 * glob). This file is excluded from the registry.
 */

type Mount = (el: HTMLElement) => void | (() => void);
type Loader = () => Promise<{ default: Mount }>;

const modules = import.meta.glob<{ default: Mount }>(["./*.ts", "!./index.ts"]);

const registry: Record<string, Loader> = {};
for (const [path, loader] of Object.entries(modules)) {
    const name = path.replace(/^\.\//, "").replace(/\.ts$/, "");
    registry[name] = loader as Loader;
}

const mounted = new WeakSet<HTMLElement>();

async function mount(el: HTMLElement) {
    if (mounted.has(el)) return;
    mounted.add(el);
    const name = el.dataset.widget ?? "";
    const loader = registry[name];
    if (!loader) {
        el.dataset.widgetState = "missing";
        console.warn(`[learn] widget "${name}" has no file in src/scripts/learn/widgets/`);
        return;
    }
    try {
        el.dataset.widgetState = "loading";
        const module = await loader();
        module.default(el);
        el.dataset.widgetState = "ready";
    } catch (error) {
        el.dataset.widgetState = "error";
        console.error(`[learn] widget "${name}" failed to mount`, error);
    }
}

function init() {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-widget]"));
    if (elements.length === 0) return;

    if (!("IntersectionObserver" in window)) {
        elements.forEach(mount);
        return;
    }
    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                observer.unobserve(entry.target);
                void mount(entry.target as HTMLElement);
            }
        },
        { rootMargin: "300px 0px" },
    );
    elements.forEach((el) => observer.observe(el));
}

init();
