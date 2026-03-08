import api from './api';
import { LoginResponse, TokenResponse, TotpSetupData, User } from './types';

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/auth/login', { username, password });
  if (!response.data.totp_required && response.data.access_token) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', response.data.access_token);
    }
  }
  return response.data;
}

export async function verifyTotp(partialToken: string, code: string): Promise<void> {
  const response = await api.post<TokenResponse>('/api/auth/totp/verify', {
    partial_token: partialToken,
    code,
  });
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', response.data.access_token);
  }
}

export async function setupTotp(): Promise<TotpSetupData> {
  const response = await api.post<TotpSetupData>('/api/auth/totp/setup');
  return response.data;
}

export async function enableTotp(secret: string, code: string): Promise<void> {
  await api.post('/api/auth/totp/enable', { secret, code });
}

export async function disableTotp(password: string): Promise<void> {
  await api.post('/api/auth/totp/disable', { password });
}

export async function register(username: string, email: string, password: string): Promise<string> {
  const response = await api.post<TokenResponse>('/api/auth/register', { username, email, password });
  const token = response.data.access_token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
  }
  return token;
}

export async function getMe(): Promise<User> {
  const response = await api.get<User>('/api/auth/me');
  return response.data;
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
  }
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
