import type { Game } from './types.js';
import { registerGame } from './game-registry.js';
import { showGameContainer, hideGameContainer } from './game-container.js';

const STORAGE_KEY = 'e2e-test-counter';
const CONTAINER_ID = 'e2e-test-game';
const VALUE_ID = 'e2e-test-value';
const BUTTON_ID = 'e2e-test-inc';

function readCounter(): number {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const n = raw != null ? Number.parseInt(raw, 10) : 0;
  return Number.isNaN(n) ? 0 : n;
}

function writeCounter(value: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(value));
}

function render(): void {
  const content = showGameContainer('E2E Test Game', cleanup);

  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.padding = '2rem';
    container.style.color = '#f8fafc';
    container.style.textAlign = 'center';

    const valueEl = document.createElement('div');
    valueEl.id = VALUE_ID;
    valueEl.style.fontFamily = 'monospace';
    valueEl.style.fontSize = '2rem';
    valueEl.style.marginBottom = '1rem';
    container.appendChild(valueEl);

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.textContent = 'Increment counter';
    button.style.padding = '0.75rem 1.5rem';
    button.style.fontSize = '1rem';
    button.style.background = '#3b82f6';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '6px';
    button.style.cursor = 'pointer';
    button.addEventListener('click', () => {
      const current = readCounter();
      const next = current + 1;
      writeCounter(next);
      const el = document.getElementById(VALUE_ID);
      if (el) {
        el.textContent = `Counter: ${next}`;
      }
    });
    container.appendChild(button);

    content.appendChild(container);
  }

  const value = readCounter();
  const valueEl = document.getElementById(VALUE_ID);
  if (valueEl) {
    valueEl.textContent = `Counter: ${value}`;
  }
}

function cleanup(): void {
  hideGameContainer();
}

function saveState(): unknown {
  return { counter: readCounter() };
}

function loadState(state: unknown): void {
  const data = state as { counter?: number };
  if (typeof data.counter === 'number') {
    writeCounter(data.counter);
    render();
  }
}

const e2eTestGame: Game = {
  canPlay: () => true,
  start: render,
  stop: cleanup,
  saveState,
  loadState,
};

// This game is intentionally not exposed in the UI; it is only
// started when the URL has ?game=e2eTest.
registerGame('e2eTest', e2eTestGame);
