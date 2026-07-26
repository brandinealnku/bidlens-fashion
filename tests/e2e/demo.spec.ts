import { test, expect } from '@playwright/test';
test('demo analysis reaches recommendation', async ({ page }) => {
  await page.goto('/analyze');
  await page.getByRole('button', { name: /Save & continue/ }).click();
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: /Save & continue/ }).click();
  await expect(page.getByText(/Maximum hammer bid/)).toBeVisible();
});
