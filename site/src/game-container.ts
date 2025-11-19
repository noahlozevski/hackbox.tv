/**
 * Unified game container with consistent UI for close button and timer
 */

const CONTAINER_ID = 'game-container';
const CONTENT_ID = 'game-content';
const HEADER_ID = 'game-header';
const CLOSE_BUTTON_ID = 'game-close-btn';

const styles = `
  #${CONTAINER_ID} {
    position: fixed;
    inset: 0;
    background: rgba(5, 12, 20, 0.95);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  #${HEADER_ID} {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  #${HEADER_ID} h2 {
    margin: 0;
    color: #f8fafc;
    font-size: 1.25rem;
    font-weight: 600;
  }

  #${CLOSE_BUTTON_ID} {
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  #${CLOSE_BUTTON_ID}:hover {
    background: #b91c1c;
  }

  #${CONTENT_ID} {
    flex: 1;
    overflow: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

let styleElement: HTMLStyleElement | null = null;

export function showGameContainer(
  gameTitle: string,
  onClose: (clearState?: boolean) => void,
): HTMLElement {
  // Inject styles if not already present
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  // Remove existing container if present
  hideGameContainer();

  // Create container
  const container = document.createElement('div');
  container.id = CONTAINER_ID;

  // Create header
  const header = document.createElement('div');
  header.id = HEADER_ID;

  const title = document.createElement('h2');
  title.textContent = gameTitle;

  const closeButton = document.createElement('button');
  closeButton.id = CLOSE_BUTTON_ID;
  closeButton.textContent = 'Exit Game';
  closeButton.onclick = () => {
    const currentId = window.game?.currentGame;
    const currentEntry = currentId ? window.games?.[currentId] : null;
    if (currentEntry?.stop) {
      currentEntry.stop(true);
    } else {
      onClose(true);
    }
    if (currentId && window.game?.ws?.readyState === WebSocket.OPEN) {
      window.game.sendMessage('stopGame', currentId);
    }
  };

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create content area
  const content = document.createElement('div');
  content.id = CONTENT_ID;

  container.appendChild(header);
  container.appendChild(content);

  document.body.appendChild(container);

  return content;
}

export function hideGameContainer(): void {
  const container = document.getElementById(CONTAINER_ID);
  if (container) {
    container.remove();
  }
}

export function getGameContent(): HTMLElement | null {
  return document.getElementById(CONTENT_ID);
}
