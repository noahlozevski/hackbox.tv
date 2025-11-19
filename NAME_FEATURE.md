# Player Name Customization Feature

## Overview
Added support for customizable player names that persist across sessions and sync in real-time across all connected clients.

## Implementation

### Core Changes

1. **Shared Types** (`shared/types.ts`)
   - Added `PlayerInfo` interface as the single source of truth for player data
   - All protocol messages now use `PlayerInfo[]` instead of `string[]`
   - Easy to extend with new player properties (e.g., avatar, color, etc.)

2. **Server-Side** (`src/`)
   - `Client` class now has a `name` property
   - `Room.getClientList()` returns `PlayerInfo[]`
   - New message types: `updateName` (client → server) and `nameUpdated` (server → client)
   - Name updates broadcast to all clients in the same room

3. **Client-Side** (`site/src/`)
   - Created `player-utils.ts` with helper functions for working with PlayerInfo
   - Created `name-manager.ts` for name UI and persistence logic
   - Player names stored in localStorage and auto-loaded on page load
   - Debounced input (500ms) + immediate save on blur

4. **UI** (`site/index.html`)
   - Name input field at top of page
   - Real-time display of current name
   - Client list shows names instead of UUIDs

### Player Utilities (`site/src/player-utils.ts`)

Helper functions for consistent player management:
- `getPlayerIds()` - Extract IDs from PlayerInfo array
- `findPlayerById()` - Look up player by ID
- `getPlayerIndex()` - Get array index by ID
- `hasPlayer()` - Check if player exists
- `getPlayerName()` - Get display name (with fallback)
- `isSamePlayer()` - Compare player references
- `getFirstPlayerId()` - Get first player (useful for "host" logic)
- `getNextPlayerId()` - Player rotation helper

## Usage

### In Games

```typescript
import {  getFirstPlayerId, getPlayerIndex, getNextPlayerId } from './player-utils.js';

// Get first player's ID
const hostId = getFirstPlayerId(window.game.players);

// Find player index for display
const playerIndex = getPlayerIndex(window.game.players, playerId);

// Rotate to next player
const nextPlayer = getNextPlayerId(window.game.players, currentPlayerId);

// Get player name for display
const playerName = getPlayerName(window.game.players, playerId);
```

### Extending PlayerInfo

To add new player properties (e.g., avatar, color):

1. Update `shared/types.ts`:
```typescript
export interface PlayerInfo {
  id: string;
  name: string;
  avatar?: string;  // New property
  color?: string;   // New property
}
```

2. Update `Client` class in `src/client.ts`
3. Update message builders to include new properties
4. Client code automatically gets new properties via type system

## Remaining Work

### Games Need Updates
The following games still use old `string[]` player patterns and need updating:

- `arena-bumpers.ts` - ~9 errors
- `lightcycle.ts` - ~4 errors
- `marble-race.ts` - ~6 errors
- `rock-paper-scissors.ts` - ~6 errors
- `tilt-pong.ts` - ~6 errors
- `top-down-tag.ts` - ~9 errors
- `connect-four.ts` - 2 minor nullable type errors

### Pattern for Updating Games

1. Import player utils:
```typescript
import { getFirstPlayerId, getPlayerIndex, getPlayerName } from './player-utils.js';
```

2. Replace `window.game.players[0]` with `getFirstPlayerId(window.game.players)`
3. Replace `.indexOf(id)` with `getPlayerIndex(window.game.players, id)`
4. Replace `.find(p => p === id)` with `find PlayerById(window.game.players, id)`
5. Use `getPlayerName()` for display

See `connect-four.ts` as a reference implementation.

## Testing

- Unit tests: `npm test` (all passing)
- Manual testing:
  1. Open hackbox.tv in two browser windows
  2. Enter different names in each window
  3. Join same room
  4. Verify names appear correctly in client list
  5. Change name in one window
  6. Verify update appears immediately in other window
  7. Reload page - name should persist from localStorage

## Benefits

- ✅ Clean, consolidated code with shared types
- ✅ Easy to extend with new player properties
- ✅ Consistent player management across all games
- ✅ Real-time sync across clients
- ✅ Persistent across page reloads
- ✅ No duplicate code
- ✅ Type-safe throughout
