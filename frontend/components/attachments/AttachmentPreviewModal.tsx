'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useAttachments } from '@/hooks/useAttachments';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { ArrowDownTrayIcon, EyeIcon, FolderIcon, LockClosedIcon, PaperclipIcon, XMarkIcon } from '@/components/common/Icons';

const TEXT_PREVIEW_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml',
]);

const EML_PREVIEW_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);

const ZIP_PREVIEW_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'message/rfc822',
]);

type EmlParsed = {
  headers: Record<string, string>;
  body_text: string | null;
  body_html: string | null;
  attachments: { index: number; filename: string; content_type: string; size: number }[];
};

type ZipEntry = { name: string; size: number; compressed_size: number; is_dir: boolean; content_type: string };

interface Props {
  noteId: number;
  attachment: { id: number; filename: string; mime_type: string };
  onClose: () => void;
}

export default function AttachmentPreviewModal({ noteId, attachment, onClose }: Props) {
  const tAttachments = useTranslations('attachments');
  const {
    previewAttachment, parseEml, previewEmlPart, downloadEmlPart,
    parseZip, previewZipEntry, downloadZipEntry,
    parseZipEml, previewZipEmlPart, downloadZipEmlPart,
  } = useAttachments(noteId);

  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [textContent, setTextContent] = useState<string | null>(null);

  // EML state
  const [emailContent, setEmailContent] = useState<{ headers: Record<string, string>; body: string } | null>(null);
  const [emlView, setEmlView] = useState<'raw' | 'rendered'>('rendered');
  const [emlParsed, setEmlParsed] = useState<EmlParsed | null>(null);
  const [emlParsedLoading, setEmlParsedLoading] = useState(false);
  const [emlPartPreview, setEmlPartPreview] = useState<{ url: string; filename: string; content_type: string } | null>(null);

  // ZIP state
  const [zipEntries, setZipEntries] = useState<ZipEntry[] | null>(null);
  const [zipLoading, setZipLoading] = useState(false);
  const [zipEncrypted, setZipEncrypted] = useState(false);
  const [zipPassword, setZipPassword] = useState('');
  const [zipPasswordError, setZipPasswordError] = useState('');
  const [zipPasswordUnlocked, setZipPasswordUnlocked] = useState(false);
  const [zipEmlAttachmentsMap, setZipEmlAttachmentsMap] = useState<Record<string, number>>({});
  const [zipEntryPreview, setZipEntryPreview] = useState<{ url: string; filename: string; content_type: string; entryPath: string; text?: string; emlParsed?: EmlParsed } | null>(null);
  const [zipEntryLoadingPath, setZipEntryLoadingPath] = useState<string | null>(null);
  const [zipEmlView, setZipEmlView] = useState<'raw' | 'rendered'>('rendered');
  const [zipEmlPartPreview, setZipEmlPartPreview] = useState<{ url: string; filename: string; content_type: string } | null>(null);
  const [zipEmlPartLoadingIndex, setZipEmlPartLoadingIndex] = useState<number | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const injectThemeBg = (html: string): string => {
    const dark = document.documentElement.classList.contains('dark');
    const bg = dark ? '#1e2533' : '#ffffff';
    const color = dark ? '#c9d1d9' : '#374151';
    const linkColor = dark ? '#7ca4e0' : '#1d4ed8';
    const css = `<style>:root{color-scheme:${dark ? 'dark' : 'light'}}html,body{background:${bg}!important;color:${color}!important;font-family:sans-serif}a{color:${linkColor}!important}</style>`;
    const headMatch = html.match(/<head[^>]*>/i);
    if (headMatch) return html.replace(headMatch[0], headMatch[0] + css);
    return css + html;
  };

  const eagerParseZipEmls = (entries: ZipEntry[], password?: string) => {
    entries.filter((e) => !e.is_dir && e.content_type === 'message/rfc822').forEach(async (entry) => {
      try {
        const parsed = await parseZipEml(attachment.id, entry.name, password);
        if (parsed.attachments.length > 0) {
          setZipEmlAttachmentsMap((prev) => ({ ...prev, [entry.name]: parsed.attachments.length }));
        }
      } catch { /* ignore */ }
    });
  };

  useEffect(() => {
    const load = async () => {
      try {
        if (attachment.mime_type === 'message/rfc822') {
          const blobUrl = await previewAttachment(attachment.id);
          const raw = await fetch(blobUrl).then((r) => r.text());
          URL.revokeObjectURL(blobUrl);
          const lines = raw.split(/\r?\n/);
          const headers: Record<string, string> = {};
          let i = 0;
          for (; i < lines.length; i++) {
            if (lines[i].trim() === '') { i++; break; }
            const m = lines[i].match(/^([\w-]+):\s*(.*)$/);
            if (m) headers[m[1]] = m[2];
          }
          const body = lines.slice(i).join('\n').trim();
          setEmailContent({ headers, body });
          setEmlView('rendered');
          setEmlParsedLoading(true);
          try {
            const parsed = await parseEml(attachment.id);
            setEmlParsed(parsed);
          } catch {
            toast.error('Failed to parse EML');
          } finally {
            setEmlParsedLoading(false);
          }
        } else if (attachment.mime_type === 'application/zip') {
          setZipLoading(true);
          try {
            const { entries, encrypted } = await parseZip(attachment.id);
            setZipEntries(entries);
            setZipEncrypted(encrypted);
            setZipPasswordUnlocked(!encrypted);
            if (!encrypted) eagerParseZipEmls(entries);
          } catch {
            toast.error('Failed to open ZIP');
          } finally {
            setZipLoading(false);
          }
        } else if (TEXT_PREVIEW_MIMES.has(attachment.mime_type)) {
          const blobUrl = await previewAttachment(attachment.id);
          const text = await fetch(blobUrl).then((r) => r.text());
          URL.revokeObjectURL(blobUrl);
          setTextContent(text);
        } else {
          const blobUrl = await previewAttachment(attachment.id);
          setUrl(blobUrl);
        }
      } catch {
        toast.error('Failed to load file');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC key: close overlays in cascade
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (emlPartPreview) { handleEmlPartPreviewClose(); }
      else if (zipEmlPartPreview) { handleZipEmlPartPreviewClose(); }
      else if (zipEntryPreview) { handleZipEntryPreviewClose(); }
      else { onClose(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emlPartPreview, zipEmlPartPreview, zipEntryPreview]);

  const handleEmlViewToggle = async (view: 'raw' | 'rendered') => {
    setEmlView(view);
    if (view === 'rendered' && !emlParsed) {
      setEmlParsedLoading(true);
      try {
        const parsed = await parseEml(attachment.id);
        setEmlParsed(parsed);
      } catch {
        toast.error('Failed to parse EML');
      } finally {
        setEmlParsedLoading(false);
      }
    }
  };

  const handleEmlPartPreview = async (partIndex: number, filename: string, content_type: string) => {
    try {
      const partUrl = await previewEmlPart(attachment.id, partIndex);
      setEmlPartPreview({ url: partUrl, filename, content_type });
    } catch {
      toast.error('Failed to load preview');
    }
  };

  const handleEmlPartPreviewClose = () => {
    if (emlPartPreview?.url) URL.revokeObjectURL(emlPartPreview.url);
    setEmlPartPreview(null);
  };

  const handleZipUnlock = async () => {
    if (!zipPassword) return;
    try {
      const { entries, encrypted } = await parseZip(attachment.id, zipPassword);
      setZipEntries(entries);
      setZipEncrypted(encrypted);
      setZipPasswordUnlocked(true);
      setZipPasswordError('');
      eagerParseZipEmls(entries, zipPassword);
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.detail === 'Wrong password') {
        setZipPasswordError(tAttachments('zipPasswordWrong'));
      } else {
        toast.error('Failed to unlock ZIP');
      }
    }
  };

  const handleZipEntryPreview = async (entryPath: string, contentType: string) => {
    setZipEntryLoadingPath(entryPath);
    try {
      const filename = entryPath.split('/').pop() || entryPath;
      const entryUrl = await previewZipEntry(attachment.id, entryPath, zipPassword || undefined);
      let text: string | undefined;
      let entryEmlParsed: EmlParsed | undefined;
      if (contentType === 'message/rfc822') {
        text = await fetch(entryUrl).then((r) => r.text());
        entryEmlParsed = await parseZipEml(attachment.id, entryPath, zipPassword || undefined);
        setZipEmlView('rendered');
        if (entryEmlParsed.attachments.length > 0) {
          setZipEmlAttachmentsMap((prev) => ({ ...prev, [entryPath]: entryEmlParsed!.attachments.length }));
        }
      }
      setZipEntryPreview({ url: entryUrl, filename, content_type: contentType, entryPath, text, emlParsed: entryEmlParsed });
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setZipEntryLoadingPath(null);
    }
  };

  const handleZipEntryPreviewClose = () => {
    if (zipEntryPreview?.url) URL.revokeObjectURL(zipEntryPreview.url);
    setZipEntryPreview(null);
    setZipEmlView('rendered');
    if (zipEmlPartPreview?.url) URL.revokeObjectURL(zipEmlPartPreview.url);
    setZipEmlPartPreview(null);
    setZipEmlPartLoadingIndex(null);
  };

  const handleZipEmlPartPreview = async (entryPath: string, partIndex: number, contentType: string) => {
    setZipEmlPartLoadingIndex(partIndex);
    try {
      const partUrl = await previewZipEmlPart(attachment.id, entryPath, partIndex, zipPassword || undefined);
      const filename = zipEntryPreview?.emlParsed?.attachments.find((a) => a.index === partIndex)?.filename || `part-${partIndex}`;
      setZipEmlPartPreview({ url: partUrl, filename, content_type: contentType });
    } catch {
      toast.error('Failed to load preview');
    } finally {
      setZipEmlPartLoadingIndex(null);
    }
  };

  const handleZipEmlPartPreviewClose = () => {
    if (zipEmlPartPreview?.url) URL.revokeObjectURL(zipEmlPartPreview.url);
    setZipEmlPartPreview(null);
  };

  const renderContent = () => {
    if (loading) {
      return <div className="flex-1 flex items-center justify-center py-12"><LoadingSpinner /></div>;
    }
    if (attachment.mime_type === 'application/pdf') {
      return <iframe src={url} className="w-full h-[70vh] rounded" title={attachment.filename} />;
    }
    if (attachment.mime_type.startsWith('video/')) {
      return <video src={url} controls className="max-w-full max-h-[70vh] rounded" />;
    }
    if (attachment.mime_type === 'message/rfc822' && emailContent) {
      return (
        <div className="w-full max-h-[70vh] overflow-auto rounded border border-cream-300/60 dark:border-vault-700/60 bg-white dark:bg-vault-800 text-sm flex flex-col">
          <div className="flex border-b border-gray-200 dark:border-vault-700/60 shrink-0">
            {(['rendered', 'raw'] as const).map((v) => (
              <button
                key={v}
                onClick={() => handleEmlViewToggle(v)}
                className={`px-4 py-2 text-xs font-medium transition-colors ${emlView === v ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-100'}`}
              >
                {v === 'raw' ? tAttachments('emlRaw') : tAttachments('emlRendered')}
              </button>
            ))}
          </div>
          {emlView === 'raw' ? (
            <>
              <div className="border-b border-gray-200 dark:border-vault-700/60 px-4 py-3 space-y-1">
                {['From', 'To', 'Cc', 'Date', 'Subject'].map((key) => emailContent.headers[key] ? (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium text-gray-400 dark:text-gray-500 w-16 shrink-0">{key}:</span>
                    <span className="text-gray-800 dark:text-gray-300 break-all">{emailContent.headers[key]}</span>
                  </div>
                ) : null)}
              </div>
              <pre className="px-4 py-3 whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 leading-relaxed">
                {emailContent.body || tAttachments('emlNoBody')}
              </pre>
            </>
          ) : emlParsedLoading ? (
            <div className="flex-1 flex items-center justify-center py-12"><LoadingSpinner /></div>
          ) : emlParsed ? (
            <>
              <div className="border-b border-gray-200 dark:border-vault-700/60 px-4 py-3 space-y-1 shrink-0">
                {['From', 'To', 'Cc', 'Bcc', 'Date', 'Subject', 'Reply-To'].map((key) => emlParsed.headers[key] ? (
                  <div key={key} className="flex gap-2">
                    <span className="font-medium text-gray-400 dark:text-gray-500 w-20 shrink-0">{key}:</span>
                    <span className="text-gray-800 dark:text-gray-300 break-all">{emlParsed.headers[key]}</span>
                  </div>
                ) : null)}
              </div>
              {emlParsed.body_html ? (
                <iframe srcDoc={injectThemeBg(emlParsed.body_html)} sandbox="allow-same-origin" className="flex-1 w-full min-h-[50vh] border-0" title="email body" />
              ) : (
                <pre className="px-4 py-3 whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
                  {emlParsed.body_text || tAttachments('emlNoBody')}
                </pre>
              )}
              {emlParsed.attachments.length > 0 && (
                <div className="border-t border-gray-200 dark:border-vault-700/60 px-4 py-3 shrink-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    {tAttachments('emlAttachments')}
                  </p>
                  <div className="space-y-1">
                    {emlParsed.attachments.map((a) => (
                      <div key={a.index} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-cream-100 dark:hover:bg-vault-700/50">
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{a.filename}</span>
                          <span className="text-xs text-gray-400">{a.content_type} · {formatBytes(a.size)}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {EML_PREVIEW_MIMES.has(a.content_type) && (
                            <button
                              onClick={() => handleEmlPartPreview(a.index, a.filename, a.content_type)}
                              className="p-1.5 rounded text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                              title={`Preview ${a.filename}`}
                            >
                              <EyeIcon />
                            </button>
                          )}
                          <button
                            onClick={() => downloadEmlPart(attachment.id, a.index, a.filename)}
                            className="p-1.5 rounded text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                            title={`Download ${a.filename}`}
                          >
                            <ArrowDownTrayIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      );
    }
    if (attachment.mime_type === 'application/zip') {
      return (
        <div className="w-full max-h-[70vh] overflow-auto rounded border border-cream-300/60 dark:border-vault-700/60 bg-white dark:bg-vault-800 text-sm flex flex-col">
          {zipLoading ? (
            <div className="flex-1 flex items-center justify-center py-12"><LoadingSpinner /></div>
          ) : zipEncrypted && !zipPasswordUnlocked ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 gap-4">
              <LockClosedIcon className="h-10 w-10 text-gray-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">{tAttachments('zipEncrypted')}</p>
              <div className="w-full max-w-xs space-y-2">
                <input
                  type="password"
                  value={zipPassword}
                  onChange={(e) => { setZipPassword(e.target.value); setZipPasswordError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleZipUnlock(); }}
                  placeholder={tAttachments('zipPasswordPlaceholder')}
                  className="block w-full rounded-md border border-cream-300 dark:border-vault-600 dark:bg-vault-700 dark:text-vault-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
                {zipPasswordError && <p className="text-xs text-red-500">{zipPasswordError}</p>}
                <Button variant="secondary" size="sm" onClick={handleZipUnlock} className="w-full justify-center">
                  {tAttachments('zipUnlock')}
                </Button>
              </div>
            </div>
          ) : zipEntries ? (
            zipEntries.length === 0 ? (
              <p className="text-center py-8 text-gray-400">{tAttachments('zipEmpty')}</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {zipEntries.map((entry, idx) => (
                  entry.is_dir ? (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2 bg-cream-100 dark:bg-vault-700/30">
                      <FolderIcon className="h-4 w-4 text-yellow-500 shrink-0" />
                      <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{entry.name}</span>
                    </div>
                  ) : (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5 hover:bg-cream-100 dark:hover:bg-vault-700/50">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">
                          {entry.name.split('/').pop() || entry.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {entry.name.includes('/') ? entry.name.substring(0, entry.name.lastIndexOf('/') + 1) : ''}{formatBytes(entry.size)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {ZIP_PREVIEW_MIMES.has(entry.content_type) && (
                          <button
                            onClick={() => handleZipEntryPreview(entry.name, entry.content_type)}
                            disabled={zipEntryLoadingPath === entry.name}
                            className="p-1.5 rounded text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors disabled:opacity-60 disabled:cursor-wait"
                            title={`Preview ${entry.name.split('/').pop()}`}
                          >
                            {zipEntryLoadingPath === entry.name ? (
                              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : <EyeIcon />}
                          </button>
                        )}
                        {entry.content_type === 'message/rfc822' && (zipEmlAttachmentsMap[entry.name] ?? 0) > 0 && (
                          <span className="text-gray-400 dark:text-gray-500" title={tAttachments('emlHasAttachments')}>
                            <PaperclipIcon />
                          </span>
                        )}
                        <button
                          onClick={() => downloadZipEntry(attachment.id, entry.name, entry.name.split('/').pop() || entry.name, zipPassword || undefined)}
                          className="p-1.5 rounded text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                          title={`Download ${entry.name.split('/').pop()}`}
                        >
                          <ArrowDownTrayIcon />
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )
          ) : null}
        </div>
      );
    }
    if (textContent !== null) {
      return (
        <pre className="w-full h-[70vh] overflow-auto p-4 text-xs font-mono text-gray-800 dark:text-vault-100 bg-cream-100 dark:bg-vault-900 rounded border border-cream-300/60 dark:border-vault-700/60 whitespace-pre-wrap break-all leading-relaxed">
          {textContent}
        </pre>
      );
    }
    // Image (or unknown inline type)
    return <img src={url} alt={attachment.filename} className="max-w-full max-h-[70vh] object-contain rounded" />;
  };

  return createPortal(
    <>
      {/* EML part preview overlay (above main modal) */}
      {emlPartPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-md" onClick={handleEmlPartPreviewClose}>
          <div className="relative bg-white dark:bg-vault-800 rounded-xl shadow-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-cream-300/60 dark:border-vault-600/60" onClick={(e) => e.stopPropagation()}>
            <div className="border-t-[3px] border-t-violet-500 dark:border-t-violet-400 px-4 py-3 flex items-center justify-between border-b border-cream-200 dark:border-vault-700/80 bg-gradient-to-br from-violet-50/60 to-white dark:from-vault-700/30 dark:to-vault-800 shrink-0">
              <span className="font-display text-sm font-semibold tracking-tight text-gray-900 dark:text-vault-50 truncate">{emlPartPreview.filename}</span>
              <button onClick={handleEmlPartPreviewClose} className="ml-4 text-gray-400 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-50 transition-colors rounded-md p-0.5 hover:bg-cream-200/60 dark:hover:bg-vault-700/60"><XMarkIcon /></button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-cream-100 dark:bg-vault-900">
              {emlPartPreview.content_type === 'application/pdf' ? (
                <iframe src={emlPartPreview.url} className="w-full h-[70vh] rounded" title={emlPartPreview.filename} />
              ) : emlPartPreview.content_type.startsWith('video/') ? (
                <video src={emlPartPreview.url} controls className="max-w-full max-h-[70vh] rounded" />
              ) : (
                <img src={emlPartPreview.url} alt={emlPartPreview.filename} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ZIP EML part preview overlay */}
      {zipEmlPartPreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-md" onClick={handleZipEmlPartPreviewClose}>
          <div className="relative bg-white dark:bg-vault-800 rounded-xl shadow-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-cream-300/60 dark:border-vault-600/60" onClick={(e) => e.stopPropagation()}>
            <div className="border-t-[3px] border-t-violet-500 dark:border-t-violet-400 px-4 py-3 flex items-center justify-between border-b border-cream-200 dark:border-vault-700/80 bg-gradient-to-br from-violet-50/60 to-white dark:from-vault-700/30 dark:to-vault-800 shrink-0">
              <span className="font-display text-sm font-semibold tracking-tight text-gray-900 dark:text-vault-50 truncate">{zipEmlPartPreview.filename}</span>
              <button onClick={handleZipEmlPartPreviewClose} className="ml-4 text-gray-400 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-50 transition-colors rounded-md p-0.5 hover:bg-cream-200/60 dark:hover:bg-vault-700/60"><XMarkIcon /></button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-cream-100 dark:bg-vault-900">
              {zipEmlPartPreview.content_type === 'application/pdf' ? (
                <iframe src={zipEmlPartPreview.url} className="w-full h-[70vh] rounded" title={zipEmlPartPreview.filename} />
              ) : zipEmlPartPreview.content_type.startsWith('video/') ? (
                <video src={zipEmlPartPreview.url} controls className="max-w-full max-h-[70vh] rounded" />
              ) : (
                <img src={zipEmlPartPreview.url} alt={zipEmlPartPreview.filename} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ZIP entry preview overlay */}
      {zipEntryPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-md" onClick={handleZipEntryPreviewClose}>
          <div className="relative bg-white dark:bg-vault-800 rounded-xl shadow-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-cream-300/60 dark:border-vault-600/60" onClick={(e) => e.stopPropagation()}>
            <div className="border-t-[3px] border-t-violet-500 dark:border-t-violet-400 px-4 py-3 flex items-center justify-between border-b border-cream-200 dark:border-vault-700/80 bg-gradient-to-br from-violet-50/60 to-white dark:from-vault-700/30 dark:to-vault-800 shrink-0">
              <span className="font-display text-sm font-semibold tracking-tight text-gray-900 dark:text-vault-50 truncate">{zipEntryPreview.filename}</span>
              <button onClick={handleZipEntryPreviewClose} className="ml-4 text-gray-400 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-50 transition-colors rounded-md p-0.5 hover:bg-cream-200/60 dark:hover:bg-vault-700/60"><XMarkIcon /></button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-cream-100 dark:bg-vault-900">
              {zipEntryPreview.content_type === 'application/pdf' ? (
                <iframe src={zipEntryPreview.url} className="w-full h-[70vh] rounded" title={zipEntryPreview.filename} />
              ) : zipEntryPreview.content_type.startsWith('video/') ? (
                <video src={zipEntryPreview.url} controls className="max-w-full max-h-[70vh] rounded" />
              ) : zipEntryPreview.content_type === 'message/rfc822' ? (
                <div className="w-full h-[70vh] flex flex-col overflow-hidden rounded border border-gray-200 dark:border-vault-700/60 bg-white dark:bg-vault-800 text-sm">
                  <div className="flex border-b border-gray-200 dark:border-vault-700/60 shrink-0">
                    {(['rendered', 'raw'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setZipEmlView(v)}
                        className={`px-4 py-2 text-xs font-medium transition-colors ${zipEmlView === v ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400' : 'text-gray-500 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-100'}`}
                      >
                        {v === 'raw' ? tAttachments('emlRaw') : tAttachments('emlRendered')}
                      </button>
                    ))}
                  </div>
                  {zipEmlView === 'raw' ? (
                    <pre className="flex-1 overflow-auto px-4 py-3 text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {zipEntryPreview.text || tAttachments('emlNoBody')}
                    </pre>
                  ) : zipEntryPreview.emlParsed ? (
                    <>
                      <div className="border-b border-gray-200 dark:border-vault-700/60 px-4 py-3 space-y-1 shrink-0">
                        {['From', 'To', 'Cc', 'Bcc', 'Date', 'Subject', 'Reply-To'].map((key) => zipEntryPreview.emlParsed!.headers[key] ? (
                          <div key={key} className="flex gap-2">
                            <span className="font-medium text-gray-400 dark:text-gray-500 w-20 shrink-0">{key}:</span>
                            <span className="text-gray-800 dark:text-gray-300 break-all">{zipEntryPreview.emlParsed!.headers[key]}</span>
                          </div>
                        ) : null)}
                      </div>
                      {zipEntryPreview.emlParsed.body_html ? (
                        <iframe
                          srcDoc={injectThemeBg(zipEntryPreview.emlParsed.body_html)}
                          sandbox="allow-same-origin"
                          className="flex-1 w-full border-0"
                          title="email body"
                        />
                      ) : (
                        <pre className="flex-1 overflow-auto px-4 py-3 whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 leading-relaxed">
                          {zipEntryPreview.emlParsed.body_text || tAttachments('emlNoBody')}
                        </pre>
                      )}
                      {zipEntryPreview.emlParsed.attachments.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-vault-700/60 px-4 py-3 shrink-0">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            {tAttachments('emlAttachments')}
                          </p>
                          <div className="space-y-1">
                            {zipEntryPreview.emlParsed.attachments.map((a) => (
                              <div key={a.index} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-cream-100 dark:hover:bg-vault-700/50">
                                <div className="min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{a.filename}</span>
                                  <span className="text-xs text-gray-400">{a.content_type} · {formatBytes(a.size)}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {EML_PREVIEW_MIMES.has(a.content_type) && (
                                    <button
                                      onClick={() => handleZipEmlPartPreview(zipEntryPreview!.entryPath, a.index, a.content_type)}
                                      disabled={zipEmlPartLoadingIndex === a.index}
                                      className="p-1.5 rounded text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors disabled:opacity-60 disabled:cursor-wait"
                                      title={`Preview ${a.filename}`}
                                    >
                                      {zipEmlPartLoadingIndex === a.index ? (
                                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                      ) : <EyeIcon />}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => downloadZipEmlPart(attachment.id, zipEntryPreview!.entryPath, a.index, a.filename, zipPassword || undefined)}
                                    className="p-1.5 rounded text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors"
                                    title={`Download ${a.filename}`}
                                  >
                                    <ArrowDownTrayIcon />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center"><LoadingSpinner /></div>
                  )}
                </div>
              ) : (
                <img src={zipEntryPreview.url} alt={zipEntryPreview.filename} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main preview modal */}
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-md" onClick={onClose}>
        <div className="relative bg-white dark:bg-vault-900 rounded-xl shadow-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-cream-300/60 dark:border-vault-700/60" onClick={(e) => e.stopPropagation()}>
          <div className="border-t-[3px] border-t-violet-500 dark:border-t-violet-400 px-4 py-3 flex items-center justify-between border-b border-cream-200 dark:border-vault-700/50 bg-gradient-to-br from-violet-50/60 to-white dark:from-vault-900 dark:to-vault-900 shrink-0">
            <span className="font-display text-sm font-semibold tracking-tight text-gray-900 dark:text-vault-50 truncate">{attachment.filename}</span>
            <button onClick={onClose} className="ml-4 text-gray-400 dark:text-vault-300 hover:text-gray-700 dark:hover:text-vault-50 transition-colors rounded-md p-0.5 hover:bg-cream-200/60 dark:hover:bg-vault-700/60">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-cream-100 dark:bg-vault-900">
            {renderContent()}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
