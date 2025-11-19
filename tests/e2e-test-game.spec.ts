import { test, expect } from '@playwright/test';

const TEST_ROOM_NAME = 'e2e-test-game-room';

test('E2E test game preserves state across reload', async ({ page }) => {
  await page.goto(`/?room=${TEST_ROOM_NAME}&game=e2eTest`, {
    waitUntil: 'networkidle',
  });

  // Wait until we appear to be in the test room
  await expect(page.getByText(`Room: ${TEST_ROOM_NAME}`)).toBeVisible();

  const valueLocator = page.locator('#e2e-test-value');
  const buttonLocator = page.locator('#e2e-test-inc');

  await expect(valueLocator).toBeVisible();
  await expect(buttonLocator).toBeVisible();

  const initialText = await valueLocator.textContent();

  await buttonLocator.click();

  const afterClickText = await valueLocator.textContent();
  expect(afterClickText).not.toBe(initialText);

  // Reload the page; the test game should restore from localStorage
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText(`Room: ${TEST_ROOM_NAME}`)).toBeVisible();
  await expect(valueLocator).toBeVisible();

  const afterReloadText = await valueLocator.textContent();
  expect(afterReloadText).toBe(afterClickText);
});
