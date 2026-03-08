// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { getToken, isAuthenticated, logout } from '@/lib/auth';

describe('auth utils', () => {
  beforeEach(() => localStorageMock.clear());

  it('getToken returns null when not set', () => {
    expect(getToken()).toBeNull();
  });

  it('isAuthenticated returns false when no token', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true after token set', () => {
    localStorage.setItem('access_token', 'test-token');
    expect(isAuthenticated()).toBe(true);
  });

  it('logout removes token', () => {
    localStorage.setItem('access_token', 'test-token');
    logout();
    expect(getToken()).toBeNull();
  });
});
