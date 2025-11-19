import type { Game, PlayerInfo } from './types.js';
import { registerGame } from './game-registry.js';

type Choice = 'rock' | 'paper' | 'scissors';

interface RockPaperScissorsState {
  playerId: string | null;
  choices: Record<string, Choice | null>;
  scores: Record<string, number>;
  roundComplete: boolean;
}

let state: RockPaperScissorsState | null = null;
let overlay: HTMLDivElement | null = null;
let statusLine: HTMLParagraphElement | null = null;
let scoreLine: HTMLDivElement | null = null;
let choiceSummary: Record<string, HTMLDivElement> = {};
let resetTimer: number | null = null;
let unsubscribeFromMessages: (() => void) | null = null;

function canPlay(): boolean {
  return window.game.players.length === 2;
}

function startGame(): void {
  if (!canPlay()) {
    alert('You need exactly 2 players to play Rock Paper Scissors!');
    return;
  }

  initializeState();
  renderUI();

  unsubscribeFromMessages = window.game.subscribeToMessages(
    handleIncomingMessage,
  );
  updateStatus('Choose your move to start the round.');
  updateScores();
  updateChoiceSummary();
}

function initializeState(): void {
  const playerId = window.game.state.playerId;
  const opponentId = getOpponentId();

  state = {
    playerId,
    choices: {
      [playerId ?? '']: null,
      [opponentId]: null,
    },
    scores: {
      [playerId ?? '']: 0,
      [opponentId]: 0,
    },
    roundComplete: false,
  };
}

function handleIncomingMessage(playerId: string, event: string, payload: unknown): void {
  if (event !== 'rps-choice') return;

  const data = payload as { choice: Choice };
  recordChoice(playerId, data.choice);
}

function renderUI(): void {
  if (overlay) {
    overlay.remove();
  }

  overlay = document.createElement('div');
  overlay.id = 'rps-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '9999';
  overlay.style.padding = '16px';

  const card = document.createElement('div');
  card.style.backgroundColor = '#1a202c';
  card.style.color = '#f7fafc';
  card.style.maxWidth = '500px';
  card.style.width = '100%';
  card.style.borderRadius = '10px';
  card.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.4)';
  card.style.padding = '20px';
  card.style.fontFamily = 'Arial, sans-serif';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '10px';

  const title = document.createElement('h2');
  title.textContent = 'Rock Paper Scissors';
  title.style.margin = '0';

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.backgroundColor = '#e53e3e';
  closeButton.style.border = 'none';
  closeButton.style.color = '#fff';
  closeButton.style.padding = '8px 12px';
  closeButton.style.borderRadius = '6px';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', stopGame);

  header.appendChild(title);
  header.appendChild(closeButton);
  card.appendChild(header);

  statusLine = document.createElement('p');
  statusLine.style.margin = '8px 0 12px';
  statusLine.style.fontSize = '16px';
  card.appendChild(statusLine);

  scoreLine = document.createElement('div');
  scoreLine.style.display = 'flex';
  scoreLine.style.justifyContent = 'space-between';
  scoreLine.style.fontWeight = 'bold';
  scoreLine.style.marginBottom = '12px';
  card.appendChild(scoreLine);

  const choicesContainer = document.createElement('div');
  choicesContainer.style.display = 'grid';
  choicesContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
  choicesContainer.style.gap = '12px';
  choicesContainer.style.marginBottom = '16px';

  const playerId = window.game.state.playerId ?? '';
  const opponentId = getOpponentId();
  choiceSummary = {};

  for (const id of [playerId, opponentId]) {
    const block = document.createElement('div');
    block.style.padding = '12px';
    block.style.backgroundColor = '#2d3748';
    block.style.borderRadius = '8px';

    const label = document.createElement('div');
    label.textContent = id === playerId ? 'You' : 'Opponent';
    label.style.fontSize = '14px';
    label.style.opacity = '0.8';
    label.style.marginBottom = '6px';

    const value = document.createElement('div');
    value.style.fontSize = '20px';
    value.style.fontWeight = 'bold';
    value.textContent = 'Waiting...';

    block.appendChild(label);
    block.appendChild(value);
    choicesContainer.appendChild(block);
    choiceSummary[id] = value;
  }

  card.appendChild(choicesContainer);

  const buttons = document.createElement('div');
  buttons.style.display = 'grid';
  buttons.style.gridTemplateColumns = 'repeat(3, 1fr)';
  buttons.style.gap = '10px';

  ['rock', 'paper', 'scissors'].forEach((item) => {
    const btn = document.createElement('button');
    btn.textContent = item.replace(/^[a-z]/, (c) => c.toUpperCase());
    btn.style.padding = '10px';
    btn.style.backgroundColor = '#2b6cb0';
    btn.style.border = 'none';
    btn.style.color = '#fff';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = 'bold';
    btn.addEventListener('click', () => handleLocalChoice(item as Choice));
    buttons.appendChild(btn);
  });

  card.appendChild(buttons);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function handleLocalChoice(choice: Choice): void {
  if (!state?.playerId) return;
  if (state.roundComplete) return;
  if (state.choices[state.playerId]) {
    updateStatus('You already locked in. Waiting for opponent...');
    return;
  }

  recordChoice(state.playerId, choice);
  window.game.sendMessage('rps-choice', { choice });
}

function recordChoice(playerId: string, choice: Choice): void {
  if (!state) return;

  if (state.roundComplete) return;
  state.choices[playerId] = choice;
  updateChoiceSummary();

  if (bothPlayersChose()) {
    resolveRound();
  } else if (playerId === state.playerId) {
    updateStatus('Waiting for your opponent to choose...');
  } else {
    updateStatus('Opponent locked in. Make your choice!');
  }
}

function bothPlayersChose(): boolean {
  if (!state) return false;

  return Object.values(state.choices).every((value) => value !== null);
}

function resolveRound(): void {
  if (!state) return;

  const [first, second] = window.game.players;
  const firstChoice = state.choices[first];
  const secondChoice = state.choices[second];

  if (!firstChoice || !secondChoice) return;

  const winner = determineWinner(first, firstChoice, second, secondChoice);
  state.roundComplete = true;

  if (winner) {
    state.scores[winner] = (state.scores[winner] ?? 0) + 1;
    updateStatus(winner === state.playerId ? 'You win the round!' : 'Opponent wins the round!');
  } else {
    updateStatus('Round tied. Go again!');
  }

  updateScores();
  updateChoiceSummary(true);
  resetTimer = window.setTimeout(resetRound, 2500);
}

function determineWinner(
  firstId: string,
  firstChoice: Choice,
  secondId: string,
  secondChoice: Choice,
): string | null {
  if (firstChoice === secondChoice) return null;

  const beats: Record<Choice, Choice> = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  return beats[firstChoice] === secondChoice ? firstId : secondId;
}

function resetRound(): void {
  if (!state) return;

  state.roundComplete = false;
  for (const key of Object.keys(state.choices)) {
    state.choices[key] = null;
  }

  updateStatus('New round: choose your move!');
  updateChoiceSummary();
}

function updateStatus(message: string): void {
  if (!statusLine) return;
  statusLine.textContent = message;
}

function updateScores(): void {
  if (!state || !scoreLine) return;

  const playerId = state.playerId ?? '';
  const opponentId = getOpponentId();
  const playerScore = state.scores[playerId] ?? 0;
  const opponentScore = state.scores[opponentId] ?? 0;

  scoreLine.textContent = `You: ${playerScore} · Opponent: ${opponentScore}`;
}

function updateChoiceSummary(showChoices = false): void {
  if (!state) return;

  for (const [playerId, element] of Object.entries(choiceSummary)) {
    const choice = state.choices[playerId];
    if (choice && (showChoices || playerId === state.playerId)) {
      element.textContent = choice.toUpperCase();
    } else if (choice && playerId !== state.playerId) {
      element.textContent = 'Locked';
    } else {
      element.textContent = 'Waiting...';
    }
  }
}

function stopGame(): void {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  if (overlay) {
    overlay.remove();
    overlay = null;
  }

  state = null;
  choiceSummary = {};

  if (unsubscribeFromMessages) {
    unsubscribeFromMessages();
    unsubscribeFromMessages = null;
  }
}

function getOpponentId(): string {
  const playerId = window.game.state.playerId;
  return window.game.players.find((id) => id !== playerId) ?? '';
}

const rockPaperScissorsGame: Game = {
  canPlay,
  start: startGame,
  stop: stopGame,
};

registerGame('rockPaperScissors', rockPaperScissorsGame);
