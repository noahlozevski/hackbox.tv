import { test, expect } from '@playwright/test';

test('E2E test game preserves state across reload', async ({ page }) => {
  await page.goto('/?room=Room2&game=e2eTest', { waitUntil: 'networkidle' });

  // Wait until we appear to be in Room2
  await expect(page.getByText('Room: Room2')).toBeVisible();

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
  await expect(page.getByText('Room: Room2')).toBeVisible();
  await expect(valueLocator).toBeVisible();

  const afterReloadText = await valueLocator.textContent();
  expect(afterReloadText).toBe(afterClickText);
});
