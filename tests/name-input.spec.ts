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

test('QR/share URL updates when name changes', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  const nameInput = page.locator('#playerNameInput');
  const saveButton = page.locator('#playerNameSaveButton');

  await expect(nameInput).toBeVisible();
  await expect(saveButton).toBeVisible();

  // Set an initial name
  await nameInput.fill('QrUser1');
  await saveButton.click();

  // Join a default room so that the QR/share UI appears
  const roomItem = page.getByText('pixel-party');
  await expect(roomItem).toBeVisible();
  await roomItem.click();

  const qrContainer = page.locator('#qr-container');
  const shareUrlEl = page.locator('#share-url');

  await expect(qrContainer).toBeVisible();
  const firstUrl = (await shareUrlEl.textContent()) ?? '';

  expect(firstUrl).toContain('pixel-party');
  expect(firstUrl).toContain('QrUser1');

  // Change the name and ensure the share URL updates
  await nameInput.fill('QrUser2');
  await saveButton.click();

  await expect
    .poll(async () => (await shareUrlEl.textContent()) ?? '', {
      timeout: 5000,
    })
    .toContain('QrUser2');
});
