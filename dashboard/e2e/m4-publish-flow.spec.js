import { test, expect } from '@playwright/test';

test.describe('M4 Publish Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.queue-item', { timeout: 10000 });
  });

  test('approved article shows Publish to Substack button', async ({ page }) => {
    // job-2 is approved in mock data
    const approvedItem = page.locator('.queue-item', { hasText: 'NFL Draft 2026' });
    await approvedItem.click();
    await expect(page.locator('button', { hasText: 'Publish to Substack' })).toBeVisible();
  });

  test('publish modal shows article preview', async ({ page }) => {
    const approvedItem = page.locator('.queue-item', { hasText: 'NFL Draft 2026' });
    await approvedItem.click();
    await page.click('button:has-text("Publish to Substack")');
    await expect(page.locator('.publish-preview')).toBeVisible();
    await expect(page.locator('.modal')).toContainText('NFL Draft 2026');
  });

  test('publish flow shows success URL', async ({ page }) => {
    const approvedItem = page.locator('.queue-item', { hasText: 'NFL Draft 2026' });
    await approvedItem.click();
    await page.click('button:has-text("Publish to Substack")');
    await page.click('button:has-text("Confirm Publish")');
    await expect(page.locator('.publish-success')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.publish-url')).toContainText('seahawksbotblog.substack.com');
  });

  test('approve flow transitions to publish modal', async ({ page }) => {
    // job-3 is drafted
    const draftedItem = page.locator('.queue-item', { hasText: 'Seahawks Acquire' });
    await draftedItem.click();
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Confirm Approve")');
    await expect(page.locator('.modal-header')).toContainText('Publish to Substack', { timeout: 5000 });
  });

  test('cancel closes publish modal', async ({ page }) => {
    const approvedItem = page.locator('.queue-item', { hasText: 'NFL Draft 2026' });
    await approvedItem.click();
    await page.click('button:has-text("Publish to Substack")');
    await expect(page.locator('.publish-preview')).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('.publish-preview')).not.toBeVisible();
  });

  test('drafted article does not show Publish button', async ({ page }) => {
    const draftedItem = page.locator('.queue-item', { hasText: 'Seahawks Acquire' });
    await draftedItem.click();
    await expect(page.locator('button', { hasText: 'Publish to Substack' })).not.toBeVisible();
    await expect(page.locator('button', { hasText: 'Approve' })).toBeVisible();
  });

  test('published article does not show Publish button', async ({ page }) => {
    const publishedItem = page.locator('.queue-item', { hasText: 'Super Bowl LVIII' });
    await publishedItem.click();
    await expect(page.locator('button', { hasText: 'Publish to Substack' })).not.toBeVisible();
    await expect(page.locator('button', { hasText: 'Unpublish' })).toBeVisible();
  });
});
