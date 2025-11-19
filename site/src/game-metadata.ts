export interface GameMeta {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers?: number;
  ogImage: string;
  tagline: string;
}

export const GAME_METADATA: Record<string, GameMeta> = {
  connectFour: {
    id: 'connectFour',
    name: 'Connect Four',
    minPlayers: 2,
    maxPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Gravity, discs, and petty rivalries.',
  },
  marbleRace: {
    id: 'marbleRace',
    name: 'Marble Race',
    minPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Drop marbles, root for chaos.',
  },
  tiltPong: {
    id: 'tiltPong',
    name: 'Tilt Pong',
    minPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Phone tilts become paddle drama.',
  },
  arenaBumpers: {
    id: 'arenaBumpers',
    name: 'Arena Bumpers',
    minPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Push friends off the map, politely.',
  },
  frogger: {
    id: 'frogger',
    name: 'Frogger',
    minPlayers: 1,
    ogImage: '/og_image.jpg',
    tagline: 'Traffic, logs, and pixel frogs.',
  },
  ticTacToe: {
    id: 'ticTacToe',
    name: 'Tic-Tac-Toe',
    minPlayers: 2,
    maxPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Classic Xs and Os, but louder.',
  },
  rockPaperScissors: {
    id: 'rockPaperScissors',
    name: 'Rock Paper Scissors',
    minPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Best-of-infinite playground diplomacy.',
  },
  lightcycle: {
    id: 'lightcycle',
    name: 'Lightcycles',
    minPlayers: 2,
    ogImage: '/og_image.jpg',
    tagline: 'Leave trails, trap friends, feel clever.',
  },
};
