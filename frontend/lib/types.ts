export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  totp_enabled: boolean;
  calendar_token?: string | null;
  telegram_chat_id?: string | null;
  notification_email?: string | null;
  created_at: string;
}

export interface EventReminder {
  id: number;
  event_id: number;
  user_id: number;
  minutes_before: number;
  notify_in_app: boolean;
  notify_telegram: boolean;
  notify_email: boolean;
  last_notified_occurrence?: string | null;
  created_at: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  title: string;
  body?: string | null;
  event_id?: number | null;
  is_read: boolean;
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
  is_archived: boolean;
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
  is_archived?: boolean;
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
  is_archived: boolean;
  archive_note?: string | null;
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
  is_archived?: boolean;
  archive_note?: string | null;
}

export type SecretType = 'password' | 'api_key' | 'token' | 'ssh_key' | 'certificate' | 'totp_seed' | 'keystore' | 'other';

export interface Secret {
  id: number;
  name: string;
  secret_type: SecretType;
  username?: string;
  url?: string;
  public_key?: string;
  note_id: number;
  position: number;
  is_archived: boolean;
  archive_note?: string | null;
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
  position: number;
  is_archived: boolean;
  archive_note?: string | null;
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
  position: number;
  is_archived: boolean;
  archive_note?: string | null;
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
  is_archived?: boolean;
  archive_note?: string | null;
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

export interface MatchingBookmark {
  id: number;
  note_id: number;
  url: string;
  title?: string | null;
  description?: string | null;
}

export interface MatchingField {
  id: number;
  note_id: number;
  group_name: string;
  key: string;
  value: string;
}

export interface MatchingEvent {
  id: number;
  note_id: number;
  title: string;
  description?: string | null;
  start_datetime: string;
}

export interface NoteField {
  id: number;
  note_id: number;
  group_name: string;
  key: string;
  value: string;
  position: number;
  link?: string | null;
  field_note?: string | null;
  field_date?: string | null;  // YYYY-MM-DD
  price?: string | null;
  field_image?: string | null;  // base64 data URL
  created_at: string;
  updated_at: string;
}

export interface NoteFieldCreate {
  group_name?: string;
  key: string;
  value?: string;
  position?: number;
  link?: string | null;
  field_note?: string | null;
  field_date?: string | null;
  price?: string | null;
  field_image?: string | null;
}

export interface NoteFieldUpdate {
  group_name?: string;
  key?: string;
  value?: string;
  position?: number;
  link?: string | null;
  field_note?: string | null;
  field_date?: string | null;
  price?: string | null;
  field_image?: string | null;
}

export interface FieldDateEntry {
  id: number;
  note_id: number;
  note_title: string;
  group_name: string;
  key: string;
  value: string;
  field_date: string;  // YYYY-MM-DD
  link?: string | null;
  price?: string | null;
}

export interface NoteFieldGroup {
  group_name: string;
  fields: NoteField[];
}

export interface SearchNote extends Note {
  match_in_attachment?: boolean;
  match_in_bookmark?: boolean;
  match_in_fields?: boolean;
  match_in_event?: boolean;
  matching_attachments?: MatchingAttachment[];
  matching_bookmarks?: MatchingBookmark[];
  matching_fields?: MatchingField[];
  matching_events?: MatchingEvent[];
}

export interface SearchResponse {
  items: SearchNote[];
  total: number;
  query: string;
  page: number;
  per_page: number;
  pages: number;
}

export interface EventAttachment {
  id: number;
  event_id: number;
  user_id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  description?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: number;
  note_id: number;
  user_id: number;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime?: string;
  url?: string;
  recurrence_rule?: string;
  is_archived: boolean;
  archive_note?: string | null;
  created_at: string;
  updated_at: string;
  attachments: EventAttachment[];
}

export interface CalendarEventWithNote extends CalendarEvent {
  note_title?: string;
}

export interface CalendarEventCreate {
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime?: string;
  url?: string;
  recurrence_rule?: string;
}

export interface CalendarEventUpdate {
  title?: string;
  description?: string;
  start_datetime?: string;
  end_datetime?: string;
  url?: string;
  recurrence_rule?: string;
  is_archived?: boolean;
  archive_note?: string | null;
}

export type VirtualBookmarkSource = 'secret' | 'event';
export interface VirtualBookmark {
  virtualKey: string;
  source: VirtualBookmarkSource;
  sourceId: number;
  sourceName: string;
  url: string;
  description?: string;
}
