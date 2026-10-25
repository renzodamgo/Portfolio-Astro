/**
 * OS tabs for Markdown content.
 *
 * Authors write consecutive blocks:
 *   <div data-os="ubuntu">…</div>
 *   <div data-os="macos">…</div>
 * and this script puts an "Ubuntu / WSL2 | macOS" switch above every group of
 * consecutive [data-os] siblings. The choice is shared by all groups and kept
 * in localStorage. Without JavaScript every block stays visible.
 */

const STORAGE_KEY = "learn-os";

const OPTIONS: Record<string, string> = {
    ubuntu: "Ubuntu / WSL2",
    macos: "macOS",
};

function readStored(): string | null {
    try {
        const value = localStorage.getItem(STORAGE_KEY);
        return value && value in OPTIONS ? value : null;
    } catch {
        return null;
    }
}

function detect(): string {
    const platform = (navigator.platform || navigator.userAgent || "").toLowerCase();
    return platform.includes("mac") ? "macos" : "ubuntu";
}

function init() {
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-os]"));
    if (blocks.length === 0) return;

    // Group consecutive siblings.
    const groups: HTMLElement[][] = [];
    for (const block of blocks) {
        const previous = block.previousElementSibling;
        const last = groups[groups.length - 1];
        if (last && previous && last[last.length - 1] === previous) {
            last.push(block);
        } else {
            groups.push([block]);
        }
    }

    const groupButtons: { blocks: HTMLElement[]; buttons: HTMLButtonElement[] }[] = [];

    const apply = (os: string) => {
        for (const { blocks, buttons } of groupButtons) {
            for (const block of blocks) block.hidden = block.dataset.os !== os;
            for (const button of buttons) {
                button.setAttribute("aria-selected", String(button.dataset.os === os));
                button.tabIndex = button.dataset.os === os ? 0 : -1;
            }
        }
    };

    const select = (os: string) => {
        try {
            localStorage.setItem(STORAGE_KEY, os);
        } catch {
            /* private mode: keep the choice for this page only */
        }
        apply(os);
    };

    for (const group of groups) {
        const present = Array.from(new Set(group.map((b) => b.dataset.os ?? ""))).filter(
            (os) => os in OPTIONS,
        );
        if (present.length < 2) continue;

        const bar = document.createElement("div");
        bar.className = "os-tabs";
        bar.setAttribute("role", "tablist");
        bar.setAttribute("aria-label", "Sistema operativo");

        const buttons = present.map((os) => {
            const button = document.createElement("button");
            button.type = "button";
            button.setAttribute("role", "tab");
            button.dataset.os = os;
            button.textContent = OPTIONS[os];
            button.addEventListener("click", () => select(os));
            button.addEventListener("keydown", (event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                const index = present.indexOf(os);
                const step = event.key === "ArrowRight" ? 1 : -1;
                const next = present[(index + step + present.length) % present.length];
                select(next);
                bar.querySelector<HTMLButtonElement>(`[data-os="${next}"]`)?.focus();
            });
            bar.appendChild(button);
            return button;
        });

        group[0].before(bar);
        groupButtons.push({ blocks: group, buttons });
    }

    const stored = readStored();
    const available = new Set(blocks.map((b) => b.dataset.os));
    let initial = stored ?? detect();
    if (!available.has(initial)) initial = Array.from(available)[0] ?? "ubuntu";
    apply(initial);
}

init();
