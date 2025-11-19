import type { Game } from './types.js';
import { registerGame } from './game-registry.js';

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
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    const chat = document.getElementById('chat') ?? document.body;
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.style.marginTop = '1rem';
    container.style.padding = '0.75rem';
    container.style.borderRadius = '6px';
    container.style.border = '1px dashed #cbd5e0';
    container.style.backgroundColor = '#f7fafc';

    const title = document.createElement('div');
    title.textContent = 'E2E Test Game';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '0.5rem';
    container.appendChild(title);

    const valueEl = document.createElement('div');
    valueEl.id = VALUE_ID;
    valueEl.style.fontFamily = 'monospace';
    valueEl.style.marginBottom = '0.5rem';
    container.appendChild(valueEl);

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.textContent = 'Increment counter';
    button.style.padding = '0.4rem 0.8rem';
    button.style.fontSize = '0.9rem';
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

    chat.appendChild(container);
  }

  const value = readCounter();
  const valueEl = document.getElementById(VALUE_ID);
  if (valueEl) {
    valueEl.textContent = `Counter: ${value}`;
  }
}

function cleanup(): void {
  const container = document.getElementById(CONTAINER_ID);
  if (container && container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

const e2eTestGame: Game = {
  canPlay: () => true,
  start: render,
  stop: cleanup,
};

// This game is intentionally not exposed in the UI; it is only
// started when the URL has ?game=e2eTest.
registerGame('e2eTest', e2eTestGame);
