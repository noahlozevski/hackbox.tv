import { test, expect } from '@playwright/test';

test('game lifecycle: start, stop, and state persistence', async ({
  page,
  context,
}) => {
  // Clear storage
  await page.goto('http://localhost:3000');
  await page.evaluate(() => window.localStorage.clear());

  // Create two browser contexts to simulate two players
  const page2 = await context.newPage();
  await page2.goto('http://localhost:3000');

  // Wait for connection
  await page.waitForTimeout(500);
  await page2.waitForTimeout(500);

  // Both players join the same room
  const roomName = 'TestRoom' + Date.now();

  // Player 1 joins room
  await page.click(`text=${roomName.substring(0, 8)}`); // Click first room
  await page.waitForTimeout(200);

  // Player 2 joins same room
  await page2.click(`text=${roomName.substring(0, 8)}`);
  await page2.waitForTimeout(200);

  // Player 1 starts the E2E test game
  await page.goto(`http://localhost:3000?room=${roomName}&game=e2eTest`);
  await page.waitForTimeout(500);

  // Verify game started for player 1
  await expect(page.locator('#e2e-test-game')).toBeVisible();
  await expect(page.locator('#e2e-test-value')).toHaveText('Counter: 0');

  // Player 2 should also see the game auto-start
  await page2.reload();
  await page2.waitForTimeout(2500); // Wait for roomsList polling
  await expect(page2.locator('#e2e-test-game')).toBeVisible();

  // Player 1 increments counter
  await page.click('#e2e-test-inc');
  await expect(page.locator('#e2e-test-value')).toHaveText('Counter: 1');

  await page.click('#e2e-test-inc');
  await expect(page.locator('#e2e-test-value')).toHaveText('Counter: 2');

  // Player 1 stops the game (clicks a close button if it exists, or we'll programmatically stop)
  await page.evaluate(() => {
    const gameEntry = window.games?.e2eTest;
    if (gameEntry) {
      gameEntry.stop();
    }
  });

  // Verify game UI is gone for player 1
  await expect(page.locator('#e2e-test-game')).not.toBeVisible();

  // Player 2 should also see the game stop after roomsList update
  await page2.waitForTimeout(2500);
  await expect(page2.locator('#e2e-test-game')).not.toBeVisible();

  // CRITICAL TEST: Player 1 refreshes - game should NOT auto-start
  await page.reload();
  await page.waitForTimeout(2500); // Wait for roomsList polling
  await expect(page.locator('#e2e-test-game')).not.toBeVisible();

  // But if player 1 manually starts the game again, it should load saved state
  await page.goto(`http://localhost:3000?room=${roomName}&game=e2eTest`);
  await page.waitForTimeout(500);

  await expect(page.locator('#e2e-test-game')).toBeVisible();
  await expect(page.locator('#e2e-test-value')).toHaveText('Counter: 2'); // Should restore saved state

  // Clean up
  await page2.close();
});

test('stopped game should not auto-resume on refresh', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.evaluate(() => window.localStorage.clear());

  // Join a room
  await page.click('text=Room1');
  await page.waitForTimeout(200);

  // Start E2E test game
  await page.goto('http://localhost:3000?room=Room1&game=e2eTest');
  await page.waitForTimeout(500);

  // Verify game started
  await expect(page.locator('#e2e-test-game')).toBeVisible();

  // Increment counter a few times
  await page.click('#e2e-test-inc');
  await page.click('#e2e-test-inc');
  await page.click('#e2e-test-inc');
  await expect(page.locator('#e2e-test-value')).toHaveText('Counter: 3');

  // Stop the game
  await page.evaluate(() => {
    const gameEntry = window.games?.e2eTest;
    if (gameEntry) {
      gameEntry.stop();
    }
  });

  await expect(page.locator('#e2e-test-game')).not.toBeVisible();

  // CRITICAL: Refresh page - game should NOT auto-start
  await page.reload();
  await page.waitForTimeout(3000); // Wait for multiple roomsList updates

  await expect(page.locator('#e2e-test-game')).not.toBeVisible();

  // But state should be visible in the games list (countdown timer)
  // This is optional to test - the key is that game doesn't auto-start

  console.log('✓ Stopped game correctly did not auto-resume on refresh');
});
