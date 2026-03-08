export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  user_id: number;
  created_at: string;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  user_id: number;
  category_id: number | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface NoteListResponse {
  items: Note[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface NoteCreate {
  title: string;
  content?: string;
  is_pinned?: boolean;
  category_id?: number | null;
  tag_ids?: number[];
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  is_pinned?: boolean;
  category_id?: number | null;
  tag_ids?: number[];
}

export type SecretType = 'password' | 'api_key' | 'token' | 'ssh_key' | 'certificate' | 'other';

export interface Secret {
  id: number;
  name: string;
  secret_type: SecretType;
  note_id: number;
  created_at: string;
  updated_at: string;
}

export interface SecretReveal extends Secret {
  value: string;
}

export interface SecretCreate {
  name: string;
  secret_type?: SecretType;
  value: string;
}

export interface Attachment {
  id: number;
  note_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  tags: Tag[];
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface SearchResponse {
  items: Note[];
  total: number;
  query: string;
}
