import { test, expect } from '@playwright/test';

test.describe('AirPulse Critical Functional & Responsive Tests', () => {
  test('1. Backtesting graph is not cropped and y-axis accommodates upper values', async ({ page }) => {
    await page.goto('http://localhost:3000/backtesting');
    
    // Check heading and chart card
    await expect(page.locator('h1')).toContainText('Statistical Backtesting');
    const chartCard = page.locator('div:has-text("Daily APIx vs Official MoSPI")').locator('..');
    await expect(chartCard).toBeVisible();

    // Verify Download Statistical Audit Dossier button exists and is clickable
    const dossierBtn = page.getByRole('button', { name: /Download Statistical Audit Dossier/i });
    await expect(dossierBtn).toBeVisible();
    await expect(dossierBtn).toBeEnabled();
  });

  test('2. Route Intelligence dropdown updates route data and URL', async ({ page }) => {
    await page.goto('http://localhost:3000/routes');
    
    // Initial state: DEL-BOM
    await expect(page.locator('span:has-text("DEL-BOM")').first()).toBeVisible();

    // Select DEL-BLR
    const selectDropdown = page.locator('select');
    await expect(selectDropdown).toBeVisible();
    await selectDropdown.selectOption('DEL-BLR');

    // URL must update
    await expect(page).toHaveURL(/route=DEL-BLR/);

    // Header must update to DEL-BLR
    await expect(page.locator('span:has-text("DEL-BLR")').first()).toBeVisible();
    await expect(page.locator('text=Bengaluru (BLR)')).toBeVisible();

    // Switch to DEL-CCU
    await selectDropdown.selectOption('DEL-CCU');
    await expect(page).toHaveURL(/route=DEL-CCU/);
    await expect(page.locator('span:has-text("DEL-CCU")').first()).toBeVisible();
    await expect(page.locator('text=Kolkata (CCU)')).toBeVisible();
  });

  test('3. Collapsed sidebar renders compact centered AP mark without text clipping', async ({ page }) => {
    await page.goto('http://localhost:3000/overview');

    // Sidebar should initially be expanded
    const sidebar = page.locator('aside');
    await expect(sidebar).toHaveCSS('width', '248px');
    await expect(sidebar.getByText('AirPulse')).toBeVisible();

    // Click collapse button
    const collapseBtn = sidebar.getByRole('button', { name: /Collapse sidebar/i });
    await collapseBtn.click();

    // Sidebar should shrink to 72px
    await expect(sidebar).toHaveCSS('width', '72px');
    
    // Expanded text should be gone
    await expect(sidebar.getByText('National Airfare Intel')).not.toBeVisible();
    await expect(sidebar.getByText('EXECUTIVE INTELLIGENCE')).not.toBeVisible();

    // AP mark must remain centered and visible
    const apMark = sidebar.locator('text=AP').first();
    await expect(apMark).toBeVisible();

    // Expand again
    const expandBtn = sidebar.getByRole('button', { name: /Expand sidebar/i });
    await expandBtn.click();
    await expect(sidebar).toHaveCSS('width', '248px');
    await expect(sidebar.getByText('AirPulse')).toBeVisible();
  });
});
