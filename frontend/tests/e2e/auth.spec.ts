/**
 * E2E – Authentication flow
 *
 * Tests: register → login (redirect to dashboard) → wrong-password stays on
 * login page → logout clears session.
 *
 * The test user is created once via the API (beforeAll) and data is cleaned up
 * after all tests finish (afterAll).
 */
import { test, expect } from '@playwright/test';
import { TEST_USER, ensureUser, cleanupUserData } from './helpers';

test.describe('Authentication', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await ensureUser(request);
  });

  test.afterAll(async ({ request }) => {
    await cleanupUserData(request, token);
  });

  // ── Login with correct credentials ──────────────────────────────────────

  test('login with correct credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/it/login');
    await page.fill('input[autocomplete="username"]', TEST_USER.username);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/it\/dashboard/, { timeout: 15_000 });
  });

  // ── Wrong password stays on login ────────────────────────────────────────

  test('login with wrong password stays on login page', async ({ page }) => {
    await page.goto('/it/login');
    await page.fill('input[autocomplete="username"]', TEST_USER.username);
    await page.fill('input[type="password"]', 'WrongPassword999!');
    await page.click('button[type="submit"]');
    // Still on login (URL doesn't change)
    await expect(page).toHaveURL(/\/it\/login/);
  });

  // ── Dashboard accessible when authenticated ──────────────────────────────

  test('authenticated user can access the dashboard directly', async ({ page }) => {
    // Inject token, navigate to dashboard (no redirect to login should happen)
    await page.goto('/it/login');
    await page.evaluate((t) => localStorage.setItem('access_token', t), token);
    await page.goto('/it/dashboard');
    // Should stay on dashboard (not redirected to login)
    await expect(page).toHaveURL(/\/it\/dashboard/, { timeout: 15_000 });
    await expect(page.locator('h1')).toBeVisible();
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  test('logout clears session and redirects to login', async ({ page }) => {
    await page.goto('/it/login');
    await page.fill('input[autocomplete="username"]', TEST_USER.username);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/it\/dashboard/, { timeout: 15_000 });

    // Click the logout button (text varies by locale)
    await page.click('button:has-text("Esci"), button:has-text("Logout")');
    await expect(page).toHaveURL(/\/it\/login/, { timeout: 10_000 });

    // localStorage no longer has a token
    const stored = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(stored).toBeNull();
  });
});
