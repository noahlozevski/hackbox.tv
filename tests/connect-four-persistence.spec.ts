import { test, expect } from '@playwright/test';

test('Connect Four game state persists across refresh', async ({
  page,
  context,
}) => {
  const baseURL = process.env.PW_BASE_URL || 'https://hackbox.tv.lozev.ski';

  // Player 1 opens the site and joins Room1
  await page.goto(`${baseURL}`);
  await page.click('text=Room1');
  await page.waitForTimeout(500);

  // Player 2 joins in a second tab/context
  const page2 = await context.newPage();
  await page2.goto(`${baseURL}`);
  await page2.click('text=Room1');
  await page2.waitForTimeout(500);

  // Start Connect Four via URL param for both players
  await page.goto(`${baseURL}?room=Room1&game=connectFour`);
  await page.waitForTimeout(1000);

  await page2.reload();
  await page2.waitForTimeout(2500);

  // Verify game container is visible for both players
  await expect(page.locator('#game-container')).toBeVisible();
  await expect(page2.locator('#game-container')).toBeVisible();

  // Player 1 makes a couple of moves in different columns
  await page.locator('[data-col="0"]').first().click();
  await page.locator('[data-col="1"]').first().click();

  // Give some time for messages and state sync
  await page.waitForTimeout(1000);

  // Refresh Player 1 (simulating a page reload)
  await page.reload();
  await page.waitForTimeout(2500);

  // After reload, Connect Four should auto-start again for Player 1
  await expect(page.locator('#game-container')).toBeVisible();

  // And the board should still reflect at least one of the previous moves
  const filledCells = await page
    .locator('[data-col="0"]')
    .evaluateAll(
      (cells) =>
        cells.filter(
          (cell) =>
            getComputedStyle(cell as HTMLElement).backgroundColor !==
            'rgb(55, 65, 81)',
        ).length,
    );

  expect(filledCells).toBeGreaterThan(0);

  await page2.close();
});
