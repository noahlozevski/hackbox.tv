import { test, expect } from '@playwright/test';

test('player name can be saved and cleared', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const nameInput = page.locator('#playerNameInput');
  const saveButton = page.locator('#playerNameSaveButton');
  const nameDisplay = page.locator('#playerNameDisplay');

  await expect(nameInput).toBeVisible();
  await expect(saveButton).toBeVisible();

  // Save a new custom name
  await nameInput.fill('TestUser');
  await saveButton.click();

  await expect(nameDisplay).toHaveText('TestUser');

  // Refresh the page and ensure the name persists via localStorage + server echo
  await page.reload({ waitUntil: 'networkidle' });

  await expect(nameDisplay).toHaveText('TestUser');

  // Clear the name and save again, which should unset the custom name
  await nameInput.fill('');
  await saveButton.click();

  // The display label should now be empty (default server name is hidden)
  await expect(nameDisplay).toHaveText('');
});
