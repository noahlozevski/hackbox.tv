const DEFAULT_ORIGIN = 'https://hackbox.tv.lozev.ski';

const GAME_DISPLAY_NAMES: Record<string, string> = {
  connectFour: 'Connect Four',
  marbleRace: 'Marble Race',
  tiltPong: 'Tilt Pong',
  arenaBumpers: 'Arena Bumpers',
  frogger: 'Frogger',
  ticTacToe: 'Tic-Tac-Toe',
  rockPaperScissors: 'Rock Paper Scissors',
  lightcycle: 'Lightcycles',
};

const GAME_OG_IMAGES: Record<string, string> = {
  connectFour: '/connect-four-og.jpg',
  marbleRace: '/marble-race-og.jpg',
  tiltPong: '/tilt-pong-og.jpg',
  arenaBumpers: '/arena-bumpers-og.jpg',
  frogger: '/frogger-og.jpg',
  ticTacToe: '/tic-tac-toe-og.jpg',
  rockPaperScissors: '/rock-paper-scissors-og.jpg',
  lightcycle: '/lightcycle-og.jpg',
};

export interface SharePageOptions {
  origin?: string;
  roomName: string;
  gameId?: string | null;
  playerName?: string | null;
}

export function buildSharePageHtml(options: SharePageOptions): string {
  const origin = options.origin ?? DEFAULT_ORIGIN;
  const roomName = options.roomName;
  const gameId = options.gameId ?? null;
  const playerName =
    typeof options.playerName === 'string' && options.playerName.trim()
      ? options.playerName
      : null;

  const encodedRoom = encodeURIComponent(roomName);
  const encodedGame = gameId ? encodeURIComponent(gameId) : null;

  const sharePath = encodedGame
    ? `/share/${encodedRoom}/${encodedGame}`
    : `/share/${encodedRoom}`;
  const shareUrl = `${origin}${sharePath}`;

  const targetSearch = encodedGame
    ? `?room=${encodedRoom}&game=${encodedGame}`
    : `?room=${encodedRoom}`;
  const targetUrl = `${origin}/${targetSearch}`;

  const gameLabel =
    gameId && GAME_DISPLAY_NAMES[gameId]
      ? GAME_DISPLAY_NAMES[gameId]
      : gameId
        ? gameId
        : null;

  const title = buildTitle({ roomName, gameLabel, playerName });
  const description = buildDescription({ roomName, gameLabel, playerName });

  const imagePath =
    gameId && GAME_OG_IMAGES[gameId] ? GAME_OG_IMAGES[gameId] : '/og_image.jpg';
  const baseImageUrl = `${origin}${imagePath}`;

  return [
    '<!doctype html>',
    '<html lang="en">',
    '  <head>',
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '',
    `    <title>${escapeHtml(title)} – hackbox.tv</title>`,
    '',
    `    <meta property="og:title" content="${escapeHtml(title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(description)}" />`,
    `    <meta property="og:image" content="${escapeHtml(baseImageUrl)}" />`,
    `    <meta property="og:url" content="${escapeHtml(shareUrl)}" />`,
    '    <meta property="og:type" content="website" />',
    '    <meta property="og:site_name" content="hackbox.tv" />',
    '    <meta property="og:locale" content="en_US" />',
    '    <meta',
    '      property="og:image:alt"',
    '      content="hackbox.tv – browser-based party games and chat"',
    '    />',
    '    <meta property="og:image:width" content="1200" />',
    '    <meta property="og:image:height" content="630" />',
    '',
    '    <meta name="twitter:card" content="summary_large_image" />',
    `    <meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `    <meta name="twitter:description" content="${escapeHtml(
      description,
    )}" />`,
    `    <meta name="twitter:image" content="${escapeHtml(baseImageUrl)}" />`,
    '',
    `    <meta name="description" content="${escapeHtml(description)}" />`,
    `    <link rel="canonical" href="${escapeHtml(targetUrl)}" />`,
    '',
    // Give crawlers OG content while redirecting humans immediately.
    `    <meta http-equiv="refresh" content="0;url=${escapeHtml(targetUrl)}" />`,
    '    <script>',
    `      window.location.replace(${JSON.stringify(targetUrl)});`,
    '    </script>',
    '  </head>',
    '  <body>',
    '    <p>',
    `      Redirecting to <a href="${escapeHtml(targetUrl)}">${escapeHtml(
      targetUrl,
    )}</a>...`,
    '    </p>',
    '  </body>',
    '</html>',
    '',
  ].join('\n');
}

function buildTitle(input: {
  roomName: string;
  gameLabel: string | null;
  playerName: string | null;
}): string {
  const { roomName, gameLabel, playerName } = input;
  const baseRoom = roomName || 'a room';

  if (gameLabel) {
    if (playerName) {
      const templates = [
        `${playerName} opened ${gameLabel} in ${baseRoom}`,
        `${playerName} wants you in ${baseRoom} · ${gameLabel}`,
        `${gameLabel} with ${playerName} in ${baseRoom}`,
      ];
      return templates[
        hashIndex(`${playerName}|${baseRoom}|${gameLabel}`, templates.length)
      ];
    }
    const templates = [
      `${gameLabel} chaos in ${baseRoom}`,
      `Drop into ${baseRoom} · ${gameLabel}`,
      `${gameLabel} lobby: ${baseRoom}`,
    ];
    return templates[hashIndex(`${baseRoom}|${gameLabel}`, templates.length)];
  }

  if (playerName) {
    const templates = [
      `${playerName} opened room ${baseRoom}`,
      `Hang with ${playerName} in ${baseRoom}`,
    ];
    return templates[hashIndex(`${playerName}|${baseRoom}`, templates.length)];
  }

  return `Room ${baseRoom} on hackbox.tv`;
}

function buildDescription(input: {
  roomName: string;
  gameLabel: string | null;
  playerName: string | null;
}): string {
  const { roomName, gameLabel, playerName } = input;
  const baseRoom = roomName || 'this room';

  if (gameLabel) {
    if (playerName) {
      const templates = [
        `${playerName} is running ${gameLabel} in “${baseRoom}”. Tap in, make it weird.`,
        `“${baseRoom}” is live with ${gameLabel} and ${playerName}. Join and mash buttons.`,
      ];
      return templates[
        hashIndex(
          `${playerName}|${baseRoom}|${gameLabel}|desc`,
          templates.length,
        )
      ];
    }
    const templates = [
      `${gameLabel} is live in “${baseRoom}”. Join and add to the chaos.`,
      `Room “${baseRoom}” is playing ${gameLabel} on hackbox.tv. Drop in and see what happens.`,
    ];
    return templates[
      hashIndex(`${baseRoom}|${gameLabel}|desc`, templates.length)
    ];
  }

  if (playerName) {
    const templates = [
      `${playerName} spun up room “${baseRoom}” on hackbox.tv. Join, chat, and start something silly.`,
      `Room “${baseRoom}” is open with ${playerName}. Hop in and pick a game.`,
    ];
    return templates[
      hashIndex(`${playerName}|${baseRoom}|desc`, templates.length)
    ];
  }

  const templates = [
    `Room “${baseRoom}” on hackbox.tv. Join, chat, and spin up browser games.`,
    `Jump into room “${baseRoom}” on hackbox.tv for quick, chaotic mini games.`,
  ];
  return templates[hashIndex(`${baseRoom}|desc`, templates.length)];
}

function hashIndex(key: string, modulo: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash);
  return modulo === 0 ? 0 : normalized % modulo;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
