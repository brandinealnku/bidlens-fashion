import { test, expect } from '@playwright/test';
test('demo analysis reaches recommendation', async ({ page }) => {
  await page.goto('/analyze');
  await page.getByRole('button', { name: /Save & continue/ }).click();
  for (let i = 0; i < 6; i++)
    await page.getByRole('button', { name: /Save & continue/ }).click();
  await expect(page.getByText(/Maximum hammer bid/)).toBeVisible();
});
test('demo scanner persists ranked opportunities', async ({ page }) => {
  await page.goto('/scanner');
  await page.getByRole('button', { name: 'Import listings' }).click();
  await expect(page.getByText(/Imported 3 rows/)).toBeVisible();
  await page.getByRole('button', { name: 'Analyze batch' }).click();
  await expect(page.getByText('Batch analysis complete.')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Maison Aurelia/ }),
  ).toBeVisible();
  await page.goto('/opportunities');
  await expect(
    page.getByRole('heading', { name: 'Opportunity Inbox' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Maison Aurelia/ }),
  ).toBeVisible();
});
