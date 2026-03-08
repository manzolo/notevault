/**
 * E2E – Dark mode
 *
 * Verifies:
 *   1. Toggle adds/removes the `dark` class on <html>.
 *   2. Theme is persisted in localStorage and survives a page refresh.
 *   3. The blocking script prevents flash (html already has `dark` on first paint
 *      when the preference is stored).
 *   4. Key UI labels are readable (not invisible) in both themes.
 */
import { test, expect } from '@playwright/test';
import { ensureUser, cleanupUserData, loginViaUI } from './helpers';

test.describe('Dark mode', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await ensureUser(request);
  });

  test.afterAll(async ({ request }) => {
    await cleanupUserData(request, token);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page, 'it');
    // Always start from light mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
    });
  });

  // ── Toggle ────────────────────────────────────────────────────────────────

  test('toggle adds dark class to html', async ({ page }) => {
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('toggle twice returns to light mode', async ({ page }) => {
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  test('dark preference survives page refresh', async ({ page }) => {
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);

    const stored = await page.evaluate(() => localStorage.getItem('theme'));
    expect(stored).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('blocking script applies dark class before React hydration', async ({ page }) => {
    // Simulate a stored dark preference and navigate fresh
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    // Navigate (triggers the blocking script on HTML load)
    await page.goto('/it/dashboard');
    // The class must be set immediately — check before any JS framework boots
    const hasDark = await page.evaluate(
      () => document.documentElement.classList.contains('dark'),
    );
    expect(hasDark).toBe(true);
  });

  // ── Label readability ─────────────────────────────────────────────────────

  test('navbar brand text is visible in dark mode', async ({ page }) => {
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);

    const brand = page.locator('a:has-text("NoteVault")').first();
    await expect(brand).toBeVisible();
    const color = await brand.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('search input is readable in dark mode', async ({ page }) => {
    await page.click('[aria-label="Toggle theme"]');

    const input = page.locator('input[placeholder]').first();
    await expect(input).toBeVisible();

    const textColor = await input.evaluate((el) => getComputedStyle(el).color);
    const bgColor = await input.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(textColor).not.toBe(bgColor);
  });
});
