import api from './api';
import { TokenResponse, User } from './types';

export async function login(username: string, password: string): Promise<string> {
  const response = await api.post<TokenResponse>('/api/auth/login', { username, password });
  const token = response.data.access_token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('access_token', token);
  }
  return token;
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
