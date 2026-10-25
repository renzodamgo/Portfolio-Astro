// A light code editor: file tabs, line numbers, Python colours (a <pre> under a transparent <textarea>),
// Tab / Shift+Tab indentation, auto-indent after ':', Ctrl/Cmd+S to save and Ctrl/Cmd+Enter to run.

export interface EditorFile { name: string; text: string; readonly?: boolean; note?: string }
export interface EditorHooks {
  change(name: string, text: string): void;
  save(): void;
  run(): void;
}
export interface Editor {
  setFiles(files: EditorFile[], active?: string): void;
  open(name: string): void;
  get(name: string): string | undefined;
  set(name: string, text: string): void;
  readonly active: string;
  /** Marks a line (1-based) as the error line; 0 clears it. */
  markError(name: string, line: number): void;
  focus(): void;
}

const KEYWORDS = new Set(('False None True and as assert async await break class continue def del elif else except finally for ' +
  'from global if import in is lambda nonlocal not or pass raise return try while with yield self').split(' '));
const BUILTINS = new Set('abs all any bool dict enumerate float int isinstance len list max min print range round sorted str sum super tuple zip'.split(' '));

function escape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
export function highlightPython(code: string): string {
  const token = /("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(#[^\n]*)|\b(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b|\b([A-Za-z_]\w*)\b(\s*\()?/gi;
  let html = '', last = 0, m: RegExpExecArray | null;
  while ((m = token.exec(code))) {
    html += escape(code.slice(last, m.index));
    if (m[1]) html += `<span class="tk-str">${escape(m[1])}</span>`;
    else if (m[2]) html += `<span class="tk-com">${escape(m[2])}</span>`;
    else if (m[3]) html += `<span class="tk-num">${m[3]}</span>`;
    else if (m[4]) {
      const w = m[4];
      const cls = KEYWORDS.has(w) ? 'tk-kw' : BUILTINS.has(w) ? 'tk-bi' : m[5] ? 'tk-fn' : /^[A-Z][A-Z0-9_]+$/.test(w) ? 'tk-const' : '';
      html += cls ? `<span class="${cls}">${w}</span>` : w;
      if (m[5]) html += escape(m[5]);
    }
    last = token.lastIndex;
  }
  return html + escape(code.slice(last)) + '\n';
}

export function createEditor(root: HTMLElement, hooks: EditorHooks): Editor {
  const tabs = document.createElement('div');
  tabs.className = 'le-tabs';
  tabs.setAttribute('role', 'tablist');
  const note = document.createElement('p');
  note.className = 'le-note';
  note.hidden = true;
  const body = document.createElement('div');
  body.className = 'le-body';
  const gutter = document.createElement('pre');
  gutter.className = 'le-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  const stack = document.createElement('div');
  stack.className = 'le-stack';
  const colour = document.createElement('pre');
  colour.className = 'le-colour';
  colour.setAttribute('aria-hidden', 'true');
  const area = document.createElement('textarea');
  area.className = 'le-area';
  area.spellcheck = false;
  area.wrap = 'off';
  area.setAttribute('autocapitalize', 'off');
  area.setAttribute('autocomplete', 'off');
  stack.append(colour, area);
  body.append(gutter, stack);
  root.append(tabs, note, body);

  let files: EditorFile[] = [];
  let active = '';
  let errorLine = 0;

  function paint() {
    const text = area.value;
    colour.innerHTML = highlightPython(text);
    const lines = text.split('\n').length;
    gutter.textContent = Array.from({ length: lines }, (_, i) => String(i + 1)).join('\n') + '\n';
    gutter.querySelectorAll('.le-errline').forEach((e) => e.remove());
    if (errorLine) {
      const bar = document.createElement('span');
      bar.className = 'le-errline';
      bar.style.top = `calc(${errorLine - 1} * var(--le-line) + var(--le-pad))`;
      body.querySelector('.le-errline')?.remove();
      body.append(bar);
    } else body.querySelector('.le-errline')?.remove();
    syncScroll();
  }
  function syncScroll() {
    colour.scrollTop = area.scrollTop;
    colour.scrollLeft = area.scrollLeft;
    gutter.scrollTop = area.scrollTop;
    const bar = body.querySelector<HTMLElement>('.le-errline');
    if (bar) bar.style.transform = `translateY(${-area.scrollTop}px)`;
  }
  function renderTabs() {
    tabs.replaceChildren(...files.map((f) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'le-tab';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(f.name === active));
      b.textContent = f.name + (f.readonly ? ' 🔒' : '');
      b.addEventListener('click', () => open(f.name));
      return b;
    }));
  }
  function open(name: string) {
    const f = files.find((x) => x.name === name);
    if (!f) return;
    active = name;
    errorLine = 0;
    area.value = f.text;
    area.readOnly = !!f.readonly;
    note.hidden = !f.note;
    note.textContent = f.note ?? '';
    area.scrollTop = 0;
    renderTabs();
    paint();
  }

  area.addEventListener('input', () => {
    const f = files.find((x) => x.name === active);
    if (!f || f.readonly) return;
    f.text = area.value;
    errorLine = 0;
    paint();
    hooks.change(f.name, f.text);
  });
  area.addEventListener('scroll', syncScroll);

  function replaceSelection(text: string, selectStart: number, selectEnd: number) {
    area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end');
    area.setSelectionRange(selectStart, selectEnd);
    area.dispatchEvent(new Event('input'));
  }
  area.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 's') { e.preventDefault(); hooks.save(); return; }
    if (mod && e.key === 'Enter') { e.preventDefault(); hooks.run(); return; }
    if (area.readOnly) return;
    const { selectionStart: s, selectionEnd: end, value } = area;
    if (e.key === 'Tab') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      if (s === end && !e.shiftKey) { replaceSelection('    ', s + 4, s + 4); return; }
      const blockEnd = value.indexOf('\n', end - (end > s && value[end - 1] === '\n' ? 1 : 0));
      const stop = blockEnd === -1 ? value.length : blockEnd;
      const block = value.slice(lineStart, stop);
      const lines = block.split('\n');
      const changed = e.shiftKey ? lines.map((l) => l.replace(/^ {1,4}/, '')) : lines.map((l) => '    ' + l);
      area.setSelectionRange(lineStart, stop);
      const text = changed.join('\n');
      replaceSelection(text, lineStart, lineStart + text.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(lineStart, s);
      let indent = (line.match(/^ */) ?? [''])[0];
      if (/:\s*(#.*)?$/.test(line)) indent += '    ';
      const text = '\n' + indent;
      replaceSelection(text, s + text.length, s + text.length);
    } else if (e.key === 'Backspace' && s === end && s > 0) {
      const lineStart = value.lastIndexOf('\n', s - 1) + 1;
      const before = value.slice(lineStart, s);
      if (before.length && /^ +$/.test(before)) {
        e.preventDefault();
        const n = ((before.length - 1) % 4) + 1;
        area.setSelectionRange(s - n, s);
        replaceSelection('', s - n, s - n);
      }
    }
  });

  return {
    setFiles(list, activeName) {
      files = list.map((f) => ({ ...f }));
      renderTabs();
      open(activeName && files.some((f) => f.name === activeName) ? activeName : files[0]?.name ?? '');
    },
    open,
    get: (name) => files.find((f) => f.name === name)?.text,
    set(name, text) {
      const f = files.find((x) => x.name === name);
      if (!f) return;
      f.text = text;
      if (name === active) { area.value = text; paint(); }
      hooks.change(name, text);
    },
    get active() { return active; },
    markError(name, line) {
      if (name !== active) open(name);
      errorLine = line;
      paint();
    },
    focus() { area.focus({ preventScroll: true }); },
  };
}
