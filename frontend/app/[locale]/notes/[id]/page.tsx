'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import { useSecrets } from '@/hooks/useSecrets';
import { useAttachments } from '@/hooks/useAttachments';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Attachment, Bookmark, Note } from '@/lib/types';
import NoteEditor from '@/components/notes/NoteEditor';
import SecretList from '@/components/secrets/SecretList';
import SecretForm from '@/components/secrets/SecretForm';
import AttachmentList from '@/components/attachments/AttachmentList';
import AttachmentUploadForm from '@/components/attachments/AttachmentUploadForm';
import BookmarkList from '@/components/bookmarks/BookmarkList';
import BookmarkForm from '@/components/bookmarks/BookmarkForm';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { ArrowDownTrayIcon, EyeIcon, KeyIcon, LinkIcon, PaperclipUploadIcon, PencilIcon, TrashIcon, XMarkIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';

const INLINE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'message/rfc822',
]);

export default function NotePage({ params }: { params: { id: string; locale: string } }) {
  const t = useTranslations('notes');
  const tSecrets = useTranslations('secrets');
  const tAttachments = useTranslations('attachments');
  const tBookmarks = useTranslations('bookmarks');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const noteId = parseInt(params.id);

  const { getNote, updateNote, deleteNote } = useNotes();
  const { tags: availableTagsFromHook, fetchTags, createTag } = useTags();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { secrets, revealedSecrets, countdown, loading: secretsLoading, fetchSecrets, createSecret, revealSecret, hideSecret, deleteSecret, copySecret } = useSecrets(noteId);
  const { attachments, loading: attachmentsLoading, fetchAttachments, uploadAttachment, deleteAttachment, previewAttachment, parseEml, previewEmlPart, downloadEmlPart } = useAttachments(noteId);
  const { bookmarks, loading: bookmarksLoading, fetchBookmarks, createBookmark, updateBookmark, deleteBookmark } = useBookmarks(noteId);

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [previewState, setPreviewState] = useState<{ attachment: Attachment; url: string } | null>(null);

  // Email preview state
  const [emailContent, setEmailContent] = useState<{ headers: Record<string, string>; body: string } | null>(null);
  const [emlView, setEmlView] = useState<'raw' | 'rendered'>('rendered');
  type EmlParsed = {
    headers: Record<string, string>;
    body_text: string | null;
    body_html: string | null;
    attachments: { index: number; filename: string; content_type: string; size: number }[];
  };
  const [emlParsed, setEmlParsed] = useState<EmlParsed | null>(null);
  const [emlParsedLoading, setEmlParsedLoading] = useState(false);
  const [emlPartPreview, setEmlPartPreview] = useState<{ url: string; filename: string; content_type: string } | null>(null);

  // Paste-image state (images: quick modal with preview)
  const [pasteFile, setPasteFile] = useState<File | null>(null);
  const [pasteName, setPasteName] = useState('');
  const [pastePreviewUrl, setPastePreviewUrl] = useState('');
  const [pasteUploading, setPasteUploading] = useState(false);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  // Paste-file state (non-images: reuse upload modal pre-filled)
  const [pasteUploadFile, setPasteUploadFile] = useState<File | null>(null);
  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const load = async () => {
      try {
        const n = await getNote(noteId);
        setNote(n);
        await fetchSecrets();
        await fetchAttachments();
        await fetchBookmarks();
        await fetchTags();
      } catch {
        router.push(`/${locale}/dashboard`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [noteId]);

  // Document-level paste listener: active for the whole note page
  useEffect(() => {
    const handleDocumentPaste = (e: ClipboardEvent) => {
      // Don't trigger if a modal filename input is focused or modal already open
      if (filenameInputRef.current && document.activeElement === filenameInputRef.current) return;
      if (pasteFile) return;

      const items = Array.from(e.clipboardData?.items ?? []);
      const fileItem = items.find((item) => item.kind === 'file');
      if (fileItem) {
        const file = fileItem.getAsFile();
        if (file) {
          e.preventDefault();
          if (file.type.startsWith('image/')) {
            openPasteModal(file);
          } else {
            setPasteUploadFile(file);
            setShowUploadModal(true);
          }
          return;
        }
      }

      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length > 0) {
        e.preventDefault();
        const file = files[0];
        if (file.type.startsWith('image/')) {
          openPasteModal(file);
        } else {
          setPasteUploadFile(file);
          setShowUploadModal(true);
        }
      }
    };

    document.addEventListener('paste', handleDocumentPaste);
    return () => document.removeEventListener('paste', handleDocumentPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteFile]);

  // ESC key: close preview overlays in cascade (eml part first, then main preview)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (emlPartPreview) {
        handleEmlPartPreviewClose();
      } else if (previewState) {
        handleClosePreview();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emlPartPreview, previewState]);

  // Document-level drag-and-drop listener
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) setIsDragging(true);
    };
    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
    };
    const handleDragLeave = (e: DragEvent) => {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) setIsDragging(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.type.startsWith('image/')) {
        openPasteModal(file);
      } else {
        setPasteUploadFile(file);
        setShowUploadModal(true);
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('drop', handleDrop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPasteModal = (file: File) => {
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const defaultName = `pasted-image-${Date.now()}.${ext}`;
    setPasteName(defaultName);
    setPastePreviewUrl(URL.createObjectURL(file));
    setPasteFile(file);
    setTimeout(() => filenameInputRef.current?.select(), 50);
  };

  const handlePasteConfirm = async () => {
    if (!pasteFile) return;
    setPasteUploading(true);
    try {
      const namedFile = new File([pasteFile], pasteName, { type: pasteFile.type });
      await uploadAttachment(namedFile);
      toast.success(`${pasteName} uploaded!`);
    } catch {
      toast.error('Failed to upload pasted image');
    } finally {
      setPasteUploading(false);
      URL.revokeObjectURL(pastePreviewUrl);
      setPasteFile(null);
      setPastePreviewUrl('');
    }
  };

  const handlePasteCancel = () => {
    URL.revokeObjectURL(pastePreviewUrl);
    setPasteFile(null);
    setPasteName('');
    setPastePreviewUrl('');
  };

  const handleUpdate = async (data: any) => {
    setSaving(true);
    try {
      const updated = await updateNote(noteId, data);
      setNote(updated);
      setEditing(false);
      toast.success('Note saved!');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!await confirm(t('deleteConfirm'))) return;
    await deleteNote(noteId);
    router.push(`/${locale}/dashboard`);
  };

  const handleCreateSecret = async (data: any) => {
    await createSecret(data);
    setShowSecretModal(false);
    toast.success('Secret saved!');
  };

  const handleUpload = async (file: File, tagIds: number[], description?: string) => {
    await uploadAttachment(file, tagIds, description);
    setShowUploadModal(false);
    setPasteUploadFile(null);
    toast.success('File uploaded!');
  };

  const handleClosePreview = () => {
    if (previewState?.url) URL.revokeObjectURL(previewState.url);
    setPreviewState(null);
    setEmailContent(null);
    setEmlView('raw');
    setEmlParsed(null);
    if (emlPartPreview?.url) URL.revokeObjectURL(emlPartPreview.url);
    setEmlPartPreview(null);
  };

  const handleEmlViewToggle = async (view: 'raw' | 'rendered') => {
    setEmlView(view);
    if (view === 'rendered' && !emlParsed && previewState) {
      setEmlParsedLoading(true);
      try {
        const parsed = await parseEml(previewState.attachment.id);
        setEmlParsed(parsed);
      } catch {
        toast.error('Failed to parse EML');
      } finally {
        setEmlParsedLoading(false);
      }
    }
  };

  const EML_PREVIEW_MIMES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  ]);

  const handleEmlPartPreview = async (attachmentId: number, partIndex: number, filename: string, content_type: string) => {
    try {
      const url = await previewEmlPart(attachmentId, partIndex);
      setEmlPartPreview({ url, filename, content_type });
    } catch {
      toast.error('Failed to load preview');
    }
  };

  const handleEmlPartPreviewClose = () => {
    if (emlPartPreview?.url) URL.revokeObjectURL(emlPartPreview.url);
    setEmlPartPreview(null);
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const url = await previewAttachment(attachment.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handlePreview = async (attachment: Attachment) => {
    try {
      const url = await previewAttachment(attachment.id);
      if (attachment.mime_type === 'message/rfc822') {
        // Load raw for Raw tab
        const raw = await fetch(url).then((r) => r.text());
        URL.revokeObjectURL(url);
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
        setPreviewState({ attachment, url: '' });
        // Immediately load rendered view
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
      } else {
        setPreviewState({ attachment, url });
      }
    } catch {
      toast.error('Failed to load file');
    }
  };

  const handleCreateBookmark = async (data: any) => {
    await createBookmark(data);
    setShowBookmarkModal(false);
    toast.success('Bookmark saved!');
  };

  const handleUpdateBookmark = async (data: any) => {
    if (!editingBookmark) return;
    await updateBookmark(editingBookmark.id, data);
    setEditingBookmark(null);
    toast.success('Bookmark updated!');
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // Inject theme-aware CSS into email HTML iframe
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

  if (loading) return <LoadingSpinner className="py-12" />;
  if (!note) return null;

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-indigo-500/10 border-4 border-dashed border-indigo-400 rounded-xl m-4" />
          <div className="relative bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-semibold text-lg px-8 py-4 rounded-xl shadow-xl flex items-center gap-3">
            <PaperclipUploadIcon />
            {tAttachments('dropOverlay')}
          </div>
        </div>
      )}

      {/* Paste-image modal */}
      {pasteFile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {tAttachments('pasteImageTitle')}
            </h3>
            <img
              src={pastePreviewUrl}
              alt="preview"
              className="w-full max-h-40 object-contain rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {tAttachments('pasteImageLabel')}
              </label>
              <input
                ref={filenameInputRef}
                type="text"
                value={pasteName}
                onChange={(e) => setPasteName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePasteConfirm();
                  if (e.key === 'Escape') handlePasteCancel();
                }}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={handlePasteCancel} disabled={pasteUploading}>
                {tCommon('cancel')}
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePasteConfirm} loading={pasteUploading} disabled={!pasteName.trim()}>
                {pasteUploading ? tAttachments('pasteImageUploading') : tAttachments('pasteImageSave')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{note.title}</h1>
          <DateInfoTooltip createdAt={note.created_at} updatedAt={note.updated_at} />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? <XMarkIcon /> : <PencilIcon />}
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <TrashIcon />
            {t('delete')}
          </Button>
        </div>
      </div>


      {editing ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <NoteEditor
            initialTitle={note.title}
            initialContent={note.content}
            initialTagIds={note.tags.map((t) => t.id)}
            availableTags={availableTagsFromHook}
            onSave={handleUpdate}
            onCreateTag={createTag}
            loading={saving}
          />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-l-indigo-500 border border-gray-200 dark:border-gray-700 p-6 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content || '*No content*'}</ReactMarkdown>
        </div>
      )}

      {note.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {note.tags.map((tag) => (
            <span key={tag.id} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-1 rounded-full">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Secrets Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{tSecrets('secrets')}</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowSecretModal(true)}>
            <KeyIcon />
            {tSecrets('addSecret')}
          </Button>
        </div>
        <SecretList
          secrets={secrets}
          revealedSecrets={revealedSecrets}
          countdown={countdown}
          loading={secretsLoading}
          onReveal={revealSecret}
          onHide={hideSecret}
          onDelete={deleteSecret}
          onCopyDirect={copySecret}
        />
      </div>

      {/* Attachments Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{tAttachments('attachments')}</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowUploadModal(true)}>
            <PaperclipUploadIcon />
            {tAttachments('upload')}
          </Button>
        </div>
        <AttachmentList
          attachments={attachments}
          loading={attachmentsLoading}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onDelete={deleteAttachment}
        />
      </div>

      {/* Bookmarks Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{tBookmarks('bookmarks')}</h2>
          <Button size="sm" variant="secondary" onClick={() => setShowBookmarkModal(true)}>
            <LinkIcon />
            {tBookmarks('add')}
          </Button>
        </div>
        <BookmarkList
          bookmarks={bookmarks}
          loading={bookmarksLoading}
          onEdit={(bm) => setEditingBookmark(bm)}
          onDelete={deleteBookmark}
        />
      </div>

      <Modal isOpen={showSecretModal} onClose={() => setShowSecretModal(false)} title={tSecrets('addSecret')}>
        <SecretForm onSubmit={handleCreateSecret} />
      </Modal>

      <Modal isOpen={showUploadModal} onClose={() => { setShowUploadModal(false); setPasteUploadFile(null); }} title={tAttachments('upload')}>
        <AttachmentUploadForm onUpload={handleUpload} availableTags={availableTagsFromHook} initialFile={pasteUploadFile ?? undefined} />
      </Modal>

      <Modal isOpen={showBookmarkModal} onClose={() => setShowBookmarkModal(false)} title={tBookmarks('add')}>
        <BookmarkForm
          availableTags={availableTagsFromHook}
          onSubmit={handleCreateBookmark}
          onCancel={() => setShowBookmarkModal(false)}
        />
      </Modal>

      <Modal isOpen={!!editingBookmark} onClose={() => setEditingBookmark(null)} title={tBookmarks('edit')}>
        {editingBookmark && (
          <BookmarkForm
            initial={editingBookmark}
            availableTags={availableTagsFromHook}
            onSubmit={handleUpdateBookmark}
            onCancel={() => setEditingBookmark(null)}
          />
        )}
      </Modal>

      {/* EML part preview overlay (above eml modal) */}
      {emlPartPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50" onClick={handleEmlPartPreviewClose}>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{emlPartPreview.filename}</span>
              <button onClick={handleEmlPartPreviewClose} className="ml-4 text-gray-400 hover:text-gray-600">
                <XMarkIcon />
              </button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800">
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

      {/* Inline preview modal */}
      {previewState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleClosePreview}>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{previewState.attachment.filename}</span>
              <button onClick={handleClosePreview} className="ml-4 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800">
              {previewState.attachment.mime_type === 'application/pdf' ? (
                <iframe src={previewState.url} className="w-full h-[70vh] rounded" title={previewState.attachment.filename} />
              ) : previewState.attachment.mime_type.startsWith('video/') ? (
                <video src={previewState.url} controls className="max-w-full max-h-[70vh] rounded" />
              ) : previewState.attachment.mime_type === 'message/rfc822' && emailContent ? (
                <div className="w-full max-h-[70vh] overflow-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm flex flex-col">
                  {/* Tab toggle */}
                  <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
                    {(['raw', 'rendered'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => handleEmlViewToggle(v)}
                        className={`px-4 py-2 text-xs font-medium transition-colors ${emlView === v ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                      >
                        {v === 'raw' ? tAttachments('emlRaw') : tAttachments('emlRendered')}
                      </button>
                    ))}
                  </div>
                  {emlView === 'raw' ? (
                    <>
                      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-1">
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
                    <div className="flex-1 flex items-center justify-center py-12">
                      <LoadingSpinner />
                    </div>
                  ) : emlParsed ? (
                    <>
                      <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 space-y-1 shrink-0">
                        {['From', 'To', 'Cc', 'Bcc', 'Date', 'Subject', 'Reply-To'].map((key) => emlParsed.headers[key] ? (
                          <div key={key} className="flex gap-2">
                            <span className="font-medium text-gray-400 dark:text-gray-500 w-20 shrink-0">{key}:</span>
                            <span className="text-gray-800 dark:text-gray-300 break-all">{emlParsed.headers[key]}</span>
                          </div>
                        ) : null)}
                      </div>
                      {emlParsed.body_html ? (
                        <iframe
                          srcDoc={injectThemeBg(emlParsed.body_html)}
                          sandbox="allow-same-origin"
                          className="flex-1 w-full min-h-[50vh] border-0"
                          title="email body"
                        />
                      ) : (
                        <pre className="px-4 py-3 whitespace-pre-wrap font-sans text-gray-700 dark:text-gray-300 leading-relaxed flex-1">
                          {emlParsed.body_text || tAttachments('emlNoBody')}
                        </pre>
                      )}
                      {emlParsed.attachments.length > 0 && (
                        <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                            {tAttachments('emlAttachments')}
                          </p>
                          <div className="space-y-1">
                            {emlParsed.attachments.map((a) => (
                              <div key={a.index} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <div className="min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate block">{a.filename}</span>
                                  <span className="text-xs text-gray-400">{a.content_type} · {formatBytes(a.size)}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {EML_PREVIEW_MIMES.has(a.content_type) && (
                                    <button
                                      onClick={() => handleEmlPartPreview(previewState!.attachment.id, a.index, a.filename, a.content_type)}
                                      className="p-1.5 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                                      title={`Preview ${a.filename}`}
                                    >
                                      <EyeIcon />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => downloadEmlPart(previewState!.attachment.id, a.index, a.filename)}
                                    className="p-1.5 rounded text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
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
              ) : (
                <img src={previewState.url} alt={previewState.attachment.filename} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
