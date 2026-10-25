// A small terminal in the page: output, a prompt line, history (up / down), Tab completion and Ctrl+C / Ctrl+L.
// The commands themselves are the lesson's shell (shell.ts); this only draws and reads.

export interface TerminalHooks {
  prompt(): string;
  run(line: string): Promise<void>;
  complete(word: string, first: boolean): string[];
  interrupt(): void;
}

export interface Terminal {
  write(text: string, kind?: 'out' | 'err' | 'ok' | 'info' | 'dim'): void;
  clear(): void;
  focus(): void;
  /** Types a command as if the student had written it and pressed Enter. */
  type(line: string): Promise<void>;
  /** Redraw the prompt (after the working directory changes from outside). */
  refresh(): void;
  readonly busy: boolean;
}

export function createTerminal(root: HTMLElement, hooks: TerminalHooks): Terminal {
  const screen = document.createElement('div');
  screen.className = 'lt-screen';
  const inputLine = document.createElement('div');
  inputLine.className = 'lt-inputline';
  const promptEl = document.createElement('span');
  promptEl.className = 'lt-prompt';
  const input = document.createElement('input');
  input.className = 'lt-input';
  input.type = 'text';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('aria-label', 'Terminal: escribe un comando y pulsa Enter');
  inputLine.append(promptEl, input);
  root.append(screen, inputLine);

  const history: string[] = JSON.parse(localStorage.getItem('lesson-terminal-history') ?? '[]');
  let cursor = history.length;
  let busy = false;

  const scroll = () => { root.scrollTop = root.scrollHeight; };
  function write(text: string, kind: 'out' | 'err' | 'ok' | 'info' | 'dim' = 'out') {
    if (!text) return;
    const last = screen.lastElementChild as HTMLElement | null;
    if (last && last.dataset.kind === kind && !last.dataset.closed) {
      last.textContent += text;
    } else {
      const span = document.createElement('span');
      span.dataset.kind = kind;
      span.className = `lt-${kind}`;
      span.textContent = text;
      screen.append(span);
    }
    if (screen.childNodes.length > 1500) screen.firstChild?.remove();
    scroll();
  }
  function echo(line: string) {
    const span = document.createElement('span');
    span.className = 'lt-cmd';
    span.dataset.kind = 'cmd';
    span.dataset.closed = 'true';
    const p = document.createElement('span');
    p.className = 'lt-prompt';
    p.textContent = hooks.prompt();
    span.append(p, document.createTextNode(line + '\n'));
    screen.append(span);
    scroll();
  }
  function refreshPrompt() {
    promptEl.textContent = hooks.prompt();
    inputLine.hidden = busy;
  }

  async function submit(line: string) {
    echo(line);
    if (line.trim()) {
      if (history[history.length - 1] !== line) history.push(line);
      while (history.length > 200) history.shift();
      localStorage.setItem('lesson-terminal-history', JSON.stringify(history));
    }
    cursor = history.length;
    busy = true;
    refreshPrompt();
    try {
      await hooks.run(line);
    } catch (error) {
      write(`${String(error)}\n`, 'err');
    } finally {
      busy = false;
      refreshPrompt();
      input.focus({ preventScroll: true });
      scroll();
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const line = input.value;
      input.value = '';
      void submit(line);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cursor > 0) { cursor--; input.value = history[cursor] ?? ''; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (cursor < history.length) { cursor++; input.value = history[cursor] ?? ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const before = input.value.slice(0, input.selectionStart ?? input.value.length);
      const parts = before.split(/\s+/);
      const word = parts[parts.length - 1];
      const options = hooks.complete(word, parts.length === 1);
      if (options.length === 1) {
        input.value = before.slice(0, before.length - word.length) + options[0] + input.value.slice(before.length);
      } else if (options.length > 1) {
        echo(input.value);
        write(options.join('  ') + '\n', 'dim');
        let common = options[0];
        for (const o of options) while (!o.startsWith(common)) common = common.slice(0, -1);
        if (common.length > word.length) input.value = before.slice(0, before.length - word.length) + common;
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      screen.replaceChildren();
    } else if (e.key === 'c' && e.ctrlKey && !input.value) {
      e.preventDefault();
      echo('^C');
    }
  });
  // Ctrl+C while a command runs (the input is hidden then): the whole terminal listens.
  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (busy && e.key === 'c' && e.ctrlKey) { e.preventDefault(); write('^C\n', 'dim'); hooks.interrupt(); }
  });
  root.addEventListener('click', () => { if (!window.getSelection()?.toString()) (busy ? root : input).focus({ preventScroll: true }); });
  refreshPrompt();

  return {
    write,
    clear() { screen.replaceChildren(); },
    focus() { (busy ? root : input).focus({ preventScroll: true }); },
    async type(line: string) {
      if (busy) return;
      await submit(line);
    },
    refresh: refreshPrompt,
    get busy() { return busy; },
  };
}
