/**
 * E2E – Secrets visibility (catches dark-mode unreadable text regressions)
 *
 * Verifies:
 *   1. A secret can be created and then revealed.
 *   2. The revealed value text is actually visible (non-transparent, not white-on-white
 *      or any other invisible combination) in BOTH light and dark mode.
 */
import { test, expect } from '@playwright/test';
import { ensureUser, cleanupUserData, loginViaUI } from './helpers';

const API = 'http://localhost:8000';

test.describe('Secrets visibility', () => {
  let token: string;
  let noteId: number;

  test.beforeAll(async ({ request }) => {
    token = await ensureUser(request);

    // Create a note with one secret via API
    const noteResp = await request.post(`${API}/api/notes`, {
      data: { title: 'Secret Visibility Note', content: '' },
      headers: { Authorization: `Bearer ${token}` },
    });
    noteId = (await noteResp.json()).id;

    await request.post(`${API}/api/notes/${noteId}/secrets`, {
      data: { name: 'DB Password', secret_type: 'password', value: 'SuperVisible123!' },
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test.afterAll(async ({ request }) => {
    await cleanupUserData(request, token);
  });

  async function goToNote(page: import('@playwright/test').Page) {
    await loginViaUI(page, 'it');
    await page.goto(`/it/notes/${noteId}`);
  }

  // ── Light mode ────────────────────────────────────────────────────────────

  test('secret name is visible in light mode', async ({ page }) => {
    await goToNote(page);
    const nameEl = page.locator('text=DB Password').first();
    await expect(nameEl).toBeVisible();

    const color = await nameEl.evaluate((el) => getComputedStyle(el).color);
    // Must not be white or fully transparent
    expect(color).not.toBe('rgb(255, 255, 255)');
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('revealed secret value is visible in light mode', async ({ page }) => {
    await goToNote(page);
    await page.click('button[title="Rivela"], button[title="Reveal"]');

    const valueEl = page.locator('text=SuperVisible123!').first();
    await expect(valueEl).toBeVisible({ timeout: 8_000 });

    const color = await valueEl.evaluate((el) => getComputedStyle(el).color);
    expect(color).not.toBe('rgb(255, 255, 255)');
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
  });

  // ── Dark mode ─────────────────────────────────────────────────────────────

  test('secret name is visible in dark mode', async ({ page }) => {
    await goToNote(page);

    // Enable dark mode via toggle
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);

    const nameEl = page.locator('text=DB Password').first();
    await expect(nameEl).toBeVisible();

    const color = await nameEl.evaluate((el) => getComputedStyle(el).color);
    // In dark mode, text should not be dark (near black) — it should be light
    // We only assert it is not invisible (white-on-white or transparent)
    const bg = await nameEl.evaluate((el) => {
      let node: Element | null = el;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return 'rgb(0, 0, 0)';
    });
    // text color and background color must differ (not the same → invisible)
    expect(color).not.toBe(bg);
  });

  test('revealed secret value is visible in dark mode', async ({ page }) => {
    await goToNote(page);

    // Enable dark mode
    await page.click('[aria-label="Toggle theme"]');
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.click('button[title="Rivela"], button[title="Reveal"]');

    const valueEl = page.locator('text=SuperVisible123!').first();
    await expect(valueEl).toBeVisible({ timeout: 8_000 });

    const color = await valueEl.evaluate((el) => getComputedStyle(el).color);
    // Must not be invisible
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    // In dark mode the revealed box has dark:bg-gray-900 → rgb(17,24,39)
    // and dark:text-gray-100 → rgb(243,244,246). They must differ.
    const bgColor = await valueEl.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(color).not.toBe(bgColor);
  });
});
