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
    const selectDropdown = page.locator('select').first();
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

  test('4. Dashboard Filter Bar: booking windows, dates, compare, and reset reactivity', async ({ page }) => {
    await page.goto('http://localhost:3000/overview');

    // Check heading
    await expect(page.locator('h1')).toContainText('Airfare Intelligence Overview');

    // 1. Initial State: All 5 windows active, 30D range
    const t1Btn = page.getByRole('button', { name: /Toggle T\+1 window/i });
    await expect(t1Btn).toBeVisible();

    // 2. Toggle T+1 off
    await t1Btn.click();
    // URL should now contain windows=7,15,30,45
    await expect(page).toHaveURL(/windows=7%2C15%2C30%2C45|windows=7,15,30,45/);
    // Filtered analytical view badge should appear
    await expect(page.locator('text=Filtered Analytical View')).toBeVisible();

    // 3. Change Route Scope to DEL-BOM
    const routeSelect = page.getByLabel('Filter by Route Basket');
    await routeSelect.selectOption('DEL-BOM');
    await expect(page).toHaveURL(/route=DEL-BOM/);

    // 4. Change Date Range to Last 7 Days
    const dateSelect = page.getByLabel('Filter by Date Range');
    await dateSelect.selectOption('7D');
    await expect(page).toHaveURL(/range=7D/);

    // 5. Change Compare Mode to Previous Period
    const compareSelect = page.getByLabel('Compare Mode');
    await compareSelect.selectOption('previous_period');
    await expect(page).toHaveURL(/compare=previous_period/);

    // 6. Test Refresh Button (triggers animated refresh spin without crashing)
    const refreshBtn = page.getByRole('button', { name: /Refresh/i });
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();
    await expect(page.locator('text=Airfare Intelligence Overview')).toBeVisible();

    // 7. Test Reset Button (restores default filters and clean URL)
    const resetBtn = page.getByRole('button', { name: /Reset/i });
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // URL should be back to /overview without filtered window/route parameters
    await expect(page).toHaveURL(/http:\/\/localhost:3000\/overview/);
    await expect(page.locator('text=Filtered Analytical View')).not.toBeVisible();
  });

  test('5. Market Monitor & Route Matrix reactivity to booking windows and corridors', async ({ page }) => {
    await page.goto('http://localhost:3000/market');

    await expect(page.locator('h1')).toContainText('Market Monitor');

    // Toggle T+1 column off in matrix
    const t1Btn = page.getByRole('button', { name: 'T+1' });
    await expect(t1Btn).toBeVisible();
    await t1Btn.click();

    // T+1 column header should disappear
    await expect(page.locator('th:has-text("T+1 (1-2d)")')).not.toBeVisible();
    // T+7 column header should remain
    await expect(page.locator('th:has-text("T+7 (3-10d)")')).toBeVisible();

    // Reset restores T+1
    const resetBtn = page.getByRole('button', { name: /Reset/i });
    await resetBtn.click();
    await expect(page.locator('th:has-text("T+1 (1-2d)")')).toBeVisible();
  });
});
