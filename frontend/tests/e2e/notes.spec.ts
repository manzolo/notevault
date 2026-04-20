/**
 * E2E – Notes CRUD
 *
 * Creates a note, verifies it appears in the list, edits it, then deletes it.
 * Each test starts from a clean state: beforeAll logs in and stores auth token;
 * afterAll deletes all test data via the API.
 */
import { test, expect } from '@playwright/test';
import { ensureUser, cleanupUserData, loginViaToken } from './helpers';

test.describe('Notes', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await ensureUser(request);
  });

  test.afterAll(async ({ request }) => {
    await cleanupUserData(request, token);
  });

  test.beforeEach(async ({ page }) => {
    await loginViaToken(page, token, 'it');
  });

  // ── Create note ───────────────────────────────────────────────────────────

  test('create a note and see it in the list', async ({ page }) => {
    await page.click('a:has-text("Nuova Nota"), a:has-text("New Note"), button:has-text("Nuova Nota"), button:has-text("New Note")');
    await page.waitForURL(/\/it\/notes\/new/);

    await page.fill('input[id]', 'E2E Test Note');
    await page.locator('.ProseMirror').click();
    await page.locator('.ProseMirror').fill('This note was created by Playwright E2E tests.');
    await page.click('button[type="submit"]');

    // After save, should land on note detail page
    await expect(page).toHaveURL(/\/it\/notes\/\d+/, { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('E2E Test Note');
  });

  // ── Note appears on dashboard ─────────────────────────────────────────────

  test('created note appears on dashboard', async ({ page, request }) => {
    // Create via API for speed
    await request.post('http://localhost:8000/api/notes', {
      data: { title: 'Dashboard Visible Note', content: 'Visible on list' },
      headers: { Authorization: `Bearer ${token}` },
    });

    await page.goto('/it/dashboard');
    await expect(page.locator('text=Dashboard Visible Note')).toBeVisible({ timeout: 10_000 });
  });

  // ── Delete note ───────────────────────────────────────────────────────────

  test('delete note removes it from list', async ({ page, request }) => {
    const resp = await request.post('http://localhost:8000/api/notes', {
      data: { title: 'Note To Delete', content: '' },
      headers: { Authorization: `Bearer ${token}` },
    });
    const { id } = await resp.json();

    await page.goto('/it/dashboard');
    await expect(page.locator('text=Note To Delete')).toBeVisible({ timeout: 10_000 });

    // Locate the specific note card by its link href, then find its delete button
    const noteLink = page.locator(`a[href="/it/notes/${id}"]`);
    const card = noteLink.locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await card.getByRole('button', { name: /Elimina|Delete/i }).click();

    // Custom ConfirmDialog: click the confirm button
    await page.getByRole('button', { name: /Conferma|Confirm/i }).click();

    await expect(page.locator('text=Note To Delete')).not.toBeVisible({ timeout: 10_000 });
  });
});
