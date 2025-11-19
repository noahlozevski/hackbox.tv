import { test, expect, Page } from '@playwright/test';

const baseURL = process.env.PW_BASE_URL || 'https://hackbox.tv.lozev.ski';
const gotoOptions = { waitUntil: 'domcontentloaded' as const };

async function joinRoomExplicit(page: Page, room: string) {
  await page.waitForFunction(
    () =>
      typeof window.joinRoom === 'function' &&
      window.game?.ws?.readyState === WebSocket.OPEN,
  );
  await page.evaluate((targetRoom) => {
    window.joinRoom?.(targetRoom);
  }, room);

  await expect(page.locator('#roomName')).toContainText(room);
}

test('Connect Four game state persists across refresh', async ({
  page,
  context,
}) => {
  const roomName = `test-room-${Date.now()}`;

  // Player 1 opens the site and joins Room1
  await page.goto(`${baseURL}?room=${roomName}`, gotoOptions);
  await joinRoomExplicit(page, roomName);
  await page.waitForTimeout(200);

  // Player 2 joins in a second tab/context
  const page2 = await context.newPage();
  await page2.goto(`${baseURL}?room=${roomName}`, gotoOptions);
  await joinRoomExplicit(page2, roomName);
  await page2.waitForTimeout(200);

  // Give the sockets a moment so both players are known
  await page.waitForTimeout(1000);

  // Player 1 starts Connect Four through the shared game framework
  const started = await page.evaluate(async () => {
    const waitForPlayers = async () => {
      const deadline = Date.now() + 15_000;
      while (
        !window.game ||
        !window.game.state.currentRoom ||
        (window.game.players?.length ?? 0) < 2
      ) {
        if (Date.now() > deadline) {
          throw new Error('Timed out waiting for players');
        }
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
    };

    try {
      await waitForPlayers();
      const originalPlayers = window.game.players.slice();
      const localId = window.game.state.playerId;
      const trimmed: typeof originalPlayers = [];
      const localPlayer = originalPlayers.find((p) => p.id === localId);
      if (localPlayer) {
        trimmed.push(localPlayer);
      }
      for (const player of originalPlayers) {
        if (trimmed.length === 2) break;
        if (!trimmed.some((p) => p.id === player.id)) {
          trimmed.push(player);
        }
      }
      if (trimmed.length < 2) {
        throw new Error('Unable to find two players to start Connect Four');
      }
      window.game.players = trimmed;
      await window.startGame('connectFour');
      window.game.players = originalPlayers;
      return true;
    } catch (err) {
      console.error('startGame error', err);
      return false;
    }
  });
  expect(started).toBeTruthy();

  // Give time for Player 2 to auto-start via roomsList sync
  await page2.goto(`${baseURL}?room=${roomName}`, gotoOptions);
  await joinRoomExplicit(page2, roomName);
  await page2.waitForTimeout(2500);

  // Verify game container is visible for both players
  await expect(page.locator('#game-container')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page2.locator('#game-container')).toBeVisible({
    timeout: 15_000,
  });

  // Player 1 makes a couple of moves by interacting with the board
  const colZero = page.locator('#game-container [data-col="0"]').first();
  const colOne = page.locator('#game-container [data-col="1"]').first();
  await expect(colZero).toBeVisible({ timeout: 15_000 });
  await expect(colOne).toBeVisible({ timeout: 15_000 });
  const isLocalFirst = await page.evaluate(() => {
    const players = window.game.players.slice(0, 2);
    if (!players.length) return false;
    return players[0]?.id === window.game.state.playerId;
  });
  const localStatus = page.locator('#connect-four-status');
  const page2ColOne = page2.locator('#game-container [data-col="1"]').first();
  await expect(page2ColOne).toBeVisible({ timeout: 15_000 });

  if (isLocalFirst) {
    await colZero.click();
    await page.waitForTimeout(200);
    await expect(page2.locator('#connect-four-status')).toContainText(
      'Your turn',
      { timeout: 15_000 },
    );
    await page2ColOne.click();
  } else {
    await expect(page2.locator('#connect-four-status')).toContainText(
      'Your turn',
      { timeout: 15_000 },
    );
    await page2ColOne.click();
    await page.waitForTimeout(200);
    await expect(localStatus).toContainText('Your turn', { timeout: 15_000 });
    await colZero.click();
  }

  // Give some time for messages and state sync
  await page.waitForTimeout(1000);

  // Refresh Player 1 (simulating a page reload)
  await page.goto(`${baseURL}?room=${roomName}`, gotoOptions);
  await joinRoomExplicit(page, roomName);
  await page.waitForTimeout(2500);

  // After reload, Connect Four should auto-start again for Player 1
  await expect(page.locator('#game-container')).toBeVisible({
    timeout: 15_000,
  });

  // And the board should still reflect at least one of the previous moves
  const filledCells = await page
    .locator('#game-container [data-col]')
    .evaluateAll(
      (cells) =>
        cells.filter(
          (cell) =>
            getComputedStyle(cell as HTMLElement).backgroundColor !==
            'rgb(55, 65, 81)',
        ).length,
    );

  expect(filledCells).toBeGreaterThanOrEqual(2);

  // Turn indicator should still be accurate for the reloaded player
  await expect(page.locator('#connect-four-status')).toContainText('Your turn');

  await page2.close();
});
