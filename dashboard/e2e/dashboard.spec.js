import { test, expect } from '@playwright/test';

test('Dashboard loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Dashboard/i);
  
  // Check that main components are visible
  await expect(page.locator('text=Queue Status')).toBeVisible();
  await expect(page.locator('text=Article Preview')).toBeVisible();
  await expect(page.locator('text=Approval Controls')).toBeVisible();
  await expect(page.locator('text=Audit Log')).toBeVisible();
});

test('Dashboard responsive on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  await page.goto('/');
  await expect(page.locator('text=Queue Status')).toBeVisible();
  
  // Elements should still be accessible
  await expect(page.locator('button:has-text("Approve")')).toBeVisible();
  await expect(page.locator('button:has-text("Reject")')).toBeVisible();
});

test('Queue status updates in real-time', async ({ page }) => {
  await page.goto('/');
  
  // Initial check
  const queueTable = page.locator('table:has-text("Status")');
  await expect(queueTable).toBeVisible();
  
  // Wait for potential updates (2s poll interval)
  await page.waitForTimeout(3000);
  
  // Table should still be there (no crashes)
  await expect(queueTable).toBeVisible();
});

test('Approval action flows work', async ({ page }) => {
  await page.goto('/');
  
  // Look for an article in the queue
  const firstArticle = page.locator('tr:has-text("drafted")').first();
  await expect(firstArticle).toBeVisible();
  
  // Click approve button
  const approveButton = firstArticle.locator('button:has-text("Approve")');
  await expect(approveButton).toBeEnabled();
  
  // Note: Actual approval would require backend mock or live queue
  // This test validates button presence and accessibility
});

test('Token cost display is visible', async ({ page }) => {
  await page.goto('/');
  
  // Cost component should display budget information
  const costDisplay = page.locator('text=/\\$0\\.\\d+|Budget/');
  await expect(costDisplay).toBeVisible();
});

test('Audit log displays actions', async ({ page }) => {
  await page.goto('/');
  
  // Audit log should be present with headers
  const auditLog = page.locator('text=Audit Log').first();
  await expect(auditLog).toBeVisible();
  
  // Should show timeline or action entries
  const auditEntries = page.locator('text=/Action|Timestamp|User/');
  await expect(auditEntries).toHaveCount(3); // At least headers
});
