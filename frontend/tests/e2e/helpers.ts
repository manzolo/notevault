import { type APIRequestContext, type Page } from '@playwright/test';

export const TEST_USER = {
  username: 'pw_e2e_user',
  email: 'pw_e2e@example.com',
  // uppercase + lowercase + digits + exclamation mark
  password: 'Playwright123!',
};

const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';

/** Register test user (idempotent: if exists, just login). Returns the JWT. */
export async function ensureUser(request: APIRequestContext): Promise<string> {
  const reg = await request.post(`${API_URL}/api/auth/register`, {
    data: TEST_USER,
  });
  if (reg.status() !== 201 && reg.status() !== 409) {
    throw new Error(`Register failed: ${reg.status()} ${await reg.text()}`);
  }
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { username: TEST_USER.username, password: TEST_USER.password },
  });
  const { access_token } = await login.json();
  return access_token;
}

/** Delete all notes owned by the test user (cascades secrets / attachments). */
export async function cleanupUserData(request: APIRequestContext, token: string): Promise<void> {
  const resp = await request.get(`${API_URL}/api/notes?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { items = [] } = await resp.json();
  for (const note of items) {
    await request.delete(`${API_URL}/api/notes/${note.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/** Log in the test user via the UI. */
export async function loginViaUI(page: Page, locale = 'it'): Promise<void> {
  await page.goto(`/${locale}/login`);
  await page.fill('input[autocomplete="username"]', TEST_USER.username);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  // Wait until we land on dashboard
  await page.waitForURL(`**/${locale}/dashboard`, { timeout: 15_000 });
}
