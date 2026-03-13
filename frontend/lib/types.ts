export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  totp_enabled: boolean;
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
  parent_id: number | null;
  note_count: number;
  children: Category[];
  created_at: string;
  updated_at: string;
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

export interface Task {
  id: number;
  note_id: number;
  user_id: number;
  title: string;
  is_done: boolean;
  due_date?: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskWithNote extends Task {
  note_title: string;
}

export interface TaskCreate {
  title: string;
  is_done?: boolean;
  due_date?: string | null;
  position?: number;
}

export interface TaskUpdate {
  title?: string;
  is_done?: boolean;
  due_date?: string | null;
  position?: number;
}

export type SecretType = 'password' | 'api_key' | 'token' | 'ssh_key' | 'certificate' | 'totp_seed' | 'other';

export interface Secret {
  id: number;
  name: string;
  secret_type: SecretType;
  username?: string;
  url?: string;
  public_key?: string;
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
  username?: string;
  url?: string;
  public_key?: string;
}

export interface Attachment {
  id: number;
  note_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  description?: string;
  file_modified_at?: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface Bookmark {
  id: number;
  note_id: number;
  url: string;
  title?: string;
  description?: string;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface BookmarkCreate {
  url: string;
  title?: string;
  description?: string;
  tag_ids?: number[];
}

export interface BookmarkUpdate {
  url?: string;
  title?: string;
  description?: string;
  tag_ids?: number[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface LoginResponse {
  access_token: string | null;
  token_type: string;
  totp_required: boolean;
  partial_token: string | null;
}

export interface TotpSetupData {
  secret: string;
  otpauth_url: string;
}

export interface MatchingAttachment {
  id: number;
  note_id: number;
  filename: string;
  mime_type: string;
}

export interface SearchNote extends Note {
  match_in_attachment?: boolean;
  match_in_bookmark?: boolean;
  matching_attachments?: MatchingAttachment[];
}

export interface SearchResponse {
  items: SearchNote[];
  total: number;
  query: string;
  page: number;
  per_page: number;
  pages: number;
}
