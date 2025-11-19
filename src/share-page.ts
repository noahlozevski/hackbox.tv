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

export interface SharePageOptions {
  origin?: string;
  roomName: string;
  gameId?: string | null;
}

export function buildSharePageHtml(options: SharePageOptions): string {
  const origin = options.origin ?? DEFAULT_ORIGIN;
  const roomName = options.roomName;
  const gameId = options.gameId ?? null;

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

  const title = gameLabel
    ? `Join ${gameLabel} in ${roomName} on hackbox.tv`
    : `Join room ${roomName} on hackbox.tv`;

  const description = gameLabel
    ? `Room “${roomName}” is running ${gameLabel} on hackbox.tv. Drop in and help stress‑test the hackbox.`
    : `Jump into room “${roomName}” on hackbox.tv to chat and spin up chaotic realtime games in your browser.`;

  const baseImageUrl = `${origin}/og_image.jpg`;

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
