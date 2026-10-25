/**
 * The "Antes de seguir" lists are Markdown task lists (`- [ ] ...`), which GFM renders as disabled checkboxes.
 * Enable them and remember what the reader ticked, per page, in localStorage.
 */
const boxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('.prose-learn li > input[type="checkbox"]'),
);
const key = `learn-checks:${location.pathname}`;
let saved: Record<string, boolean> = {};
try {
    saved = JSON.parse(localStorage.getItem(key) ?? "{}");
} catch {
    saved = {};
}

boxes.forEach((box, index) => {
    box.disabled = false;
    box.checked = saved[index] ?? box.checked;
    const label = box.closest("li")?.textContent?.trim();
    if (label) box.setAttribute("aria-label", label);
    box.addEventListener("change", () => {
        saved[index] = box.checked;
        try {
            localStorage.setItem(key, JSON.stringify(saved));
        } catch {
            /* private mode: the ticks just last for this page */
        }
    });
});
