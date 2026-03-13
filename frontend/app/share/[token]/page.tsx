'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '@/lib/api';
import TotpLiveWidget from '@/components/secrets/TotpLiveWidget';

interface SharedTask {
  id: number;
  title: string;
  is_done: boolean;
  due_date: string | null;
  position: number;
}

interface SharedAttachment {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
  description: string | null;
}

interface SharedBookmark {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
}

interface SharedSecret {
  id: number;
  name: string;
  secret_type: string;
  username: string | null;
  url: string | null;
  public_key: string | null;
  value: string;
}

interface SharedEventAttachment {
  id: number;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

interface SharedEvent {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string | null;
  url: string | null;
  attachments?: SharedEventAttachment[];
}

interface ShareSections {
  content: boolean;
  tasks: boolean;
  attachments: boolean;
  bookmarks: boolean;
  secrets: boolean;
  events: boolean;
}

interface SharedNote {
  id: number;
  title: string;
  content?: string;
  tags: { id: number; name: string }[];
  created_at: string;
  updated_at: string;
  share_sections: ShareSections;
  tasks?: SharedTask[];
  attachments?: SharedAttachment[];
  bookmarks?: SharedBookmark[];
  secrets?: SharedSecret[];
  events?: SharedEvent[];
  visibility?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function SecretRow({ secret, token }: { secret: SharedSecret; token: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{secret.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{secret.secret_type}</p>
          {secret.username && (
            <p className="text-xs text-gray-500 dark:text-gray-400">User: {secret.username}</p>
          )}
          {secret.url && (
            <a
              href={secret.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate block max-w-xs"
            >
              {secret.url}
            </a>
          )}
        </div>
        <button
          onClick={() => setRevealed((v) => !v)}
          className="shrink-0 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
      {revealed && (
        secret.secret_type === 'totp_seed'
          ? <TotpLiveWidget seed={secret.value} />
          : <pre className="mt-1 text-xs font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 whitespace-pre-wrap break-all select-all">
              {secret.value}
            </pre>
      )}
      {secret.public_key && (
        <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 whitespace-pre-wrap break-all text-gray-500 dark:text-gray-400">
          {secret.public_key}
        </pre>
      )}
    </div>
  );
}

const INLINE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);

function formatBytesShare(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SharePage({ params }: { params: { token: string } }) {
  const [note, setNote] = useState<SharedNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewAtt, setPreviewAtt] = useState<{ att: SharedAttachment; url: string } | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const handlePreview = async (att: SharedAttachment) => {
    try {
      const response = await fetch(`/api/share/${params.token}/attachments/${att.id}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreviewAtt({ att, url });
    } catch {
      // ignore
    }
  };

  const handleClosePreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewAtt(null);
  };

  useEffect(() => {
    api
      .get<SharedNote>(`/api/share/${params.token}`)
      .then((r) => setNote(r.data))
      .catch((err) => {
        const status = err?.response?.status ?? null;
        setErrorStatus(status);
        if (status === 401) {
          setError('login_required');
        } else if (status === 403) {
          setError('access_denied');
        } else {
          setError('not_found');
        }
      })
      .finally(() => setLoading(false));
  }, [params.token]);

  const loginUrl = `/en/auth/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Brand header */}
        <div className="flex items-center gap-2 mb-6 text-indigo-600 dark:text-indigo-400 text-sm font-semibold">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-7 14H7v-2h5v2zm5-4H7v-2h10v2zm0-4H7V7h10v2z" />
          </svg>
          NoteVault
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <svg
              className="animate-spin w-8 h-8 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}

        {error === 'login_required' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-800 p-8 text-center space-y-4">
            <svg className="w-10 h-10 text-indigo-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              You must be logged in to view this shared note.
            </p>
            <a
              href={loginUrl}
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Log in to NoteVault
            </a>
          </div>
        )}

        {error === 'access_denied' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center space-y-3">
            <svg className="w-10 h-10 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="text-red-600 dark:text-red-400 font-medium">
              You do not have permission to view this shared note.
            </p>
          </div>
        )}

        {error === 'not_found' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-800 p-8 text-center">
            <p className="text-red-600 dark:text-red-400 font-medium">
              This share link is invalid or has been removed.
            </p>
          </div>
        )}

        {note && (
          <div className="space-y-4">
            {/* Attachment preview overlay */}
            {previewAtt && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                onClick={handleClosePreview}
              >
                <div
                  className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate pr-4">
                      {previewAtt.att.filename}
                    </span>
                    <button
                      onClick={handleClosePreview}
                      className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    {previewAtt.att.mime_type.startsWith('image/') && (
                      <img
                        src={previewAtt.url}
                        alt={previewAtt.att.filename}
                        className="max-w-full max-h-[75vh] mx-auto object-contain rounded"
                      />
                    )}
                    {previewAtt.att.mime_type === 'application/pdf' && (
                      <iframe
                        src={previewAtt.url}
                        title={previewAtt.att.filename}
                        className="w-full h-[75vh] rounded"
                      />
                    )}
                    {previewAtt.att.mime_type.startsWith('video/') && (
                      <video
                        src={previewAtt.url}
                        controls
                        className="max-w-full max-h-[75vh] mx-auto rounded"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Note header card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                {note.title}
              </h1>
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
                  {note.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Last updated: {new Date(note.updated_at).toLocaleString()}
              </div>
            </div>

            {/* Content section */}
            {note.share_sections.content && note.content !== undefined && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-l-indigo-500 border border-gray-200 dark:border-gray-700 p-6 prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {(note.content || '*No content*').replace(/\[\[([^\]]+)\]\]/g, '\\[\\[$1\\]\\]')}
                </ReactMarkdown>
              </div>
            )}

            {/* Tasks section */}
            {note.share_sections.tasks && note.tasks && note.tasks.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                  Tasks
                </h2>
                <ul className="space-y-2">
                  {note.tasks.map((task) => (
                    <li key={task.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={task.is_done}
                        readOnly
                        className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 pointer-events-none"
                      />
                      <div className="min-w-0">
                        <span
                          className={`text-sm ${
                            task.is_done
                              ? 'line-through text-gray-400 dark:text-gray-500'
                              : 'text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.due_date && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Attachments section */}
            {note.share_sections.attachments &&
              note.attachments &&
              note.attachments.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                    Attachments
                  </h2>
                  <ul className="space-y-2">
                    {note.attachments.map((att) => (
                      <li key={att.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                            {att.filename}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {att.mime_type} · {formatBytes(att.size_bytes)}
                            {att.description && ` · ${att.description}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {INLINE_MIMES.has(att.mime_type) && (
                            <button
                              onClick={() => handlePreview(att)}
                              className="text-xs px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            >
                              Preview
                            </button>
                          )}
                          <a
                            href={`/api/share/${params.token}/attachments/${att.id}`}
                            download={att.filename}
                            className="text-xs px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                          >
                            Download
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Bookmarks section */}
            {note.share_sections.bookmarks &&
              note.bookmarks &&
              note.bookmarks.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                      />
                    </svg>
                    Bookmarks
                  </h2>
                  <ul className="space-y-2">
                    {note.bookmarks.map((bm) => (
                      <li key={bm.id}>
                        <a
                          href={bm.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                        >
                          {bm.title || bm.url}
                        </a>
                        {bm.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {bm.description}
                          </p>
                        )}
                        {bm.title && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {bm.url}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Secrets section */}
            {note.share_sections.secrets && note.secrets && note.secrets.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-amber-300 dark:border-amber-700 p-6">
                <div className="flex items-start gap-2 mb-3">
                  <svg
                    className="w-4 h-4 text-amber-500 mt-0.5 shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      Secrets (sensitive)
                    </h2>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                      These secrets are visible to anyone with this share link. Handle with care.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {note.secrets.map((secret) => (
                    <SecretRow key={secret.id} secret={secret} token={params.token} />
                  ))}
                </div>
              </div>
            )}

            {/* Events section */}
            {note.share_sections.events && note.events && note.events.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Events
                </h2>
                <ul className="space-y-3">
                  {note.events.map((ev) => (
                    <li key={ev.id} className="border border-gray-100 dark:border-gray-700 rounded-lg p-3 space-y-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{ev.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(ev.start_datetime).toLocaleString()}
                        {ev.end_datetime && ` — ${new Date(ev.end_datetime).toLocaleString()}`}
                      </p>
                      {ev.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400">{ev.description}</p>
                      )}
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline block truncate"
                        >
                          {ev.url}
                        </a>
                      )}
                      {ev.attachments && ev.attachments.length > 0 && (
                        <div className="mt-1.5 space-y-1">
                          {ev.attachments.map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <span className="truncate">{a.filename}</span>
                              <span className="text-gray-400 shrink-0">({formatBytesShare(a.size_bytes)})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
