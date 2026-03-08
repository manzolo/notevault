'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useNotes } from '@/hooks/useNotes';
import { useSecrets } from '@/hooks/useSecrets';
import { useAttachments } from '@/hooks/useAttachments';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Attachment, Bookmark, Note, Tag } from '@/lib/types';
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
import { KeyIcon, LinkIcon, PaperclipUploadIcon, PencilIcon, TrashIcon, XMarkIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import api from '@/lib/api';

const INLINE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
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
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { secrets, revealedSecrets, countdown, loading: secretsLoading, fetchSecrets, createSecret, revealSecret, hideSecret, deleteSecret, copySecret } = useSecrets(noteId);
  const { attachments, loading: attachmentsLoading, fetchAttachments, uploadAttachment, deleteAttachment, previewAttachment } = useAttachments(noteId);
  const { bookmarks, loading: bookmarksLoading, fetchBookmarks, createBookmark, updateBookmark, deleteBookmark } = useBookmarks(noteId);

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [previewState, setPreviewState] = useState<{ attachment: Attachment; url: string } | null>(null);

  // Paste-image state (images: quick modal with preview)
  const [pasteFile, setPasteFile] = useState<File | null>(null);
  const [pasteName, setPasteName] = useState('');
  const [pastePreviewUrl, setPastePreviewUrl] = useState('');
  const [pasteUploading, setPasteUploading] = useState(false);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  // Paste-file state (non-images: reuse upload modal pre-filled)
  const [pasteUploadFile, setPasteUploadFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const n = await getNote(noteId);
        setNote(n);
        await fetchSecrets();
        await fetchAttachments();
        await fetchBookmarks();
        const tagsResp = await api.get<Tag[]>('/api/tags');
        setAvailableTags(tagsResp.data);
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
    if (previewState) URL.revokeObjectURL(previewState.url);
    setPreviewState(null);
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
      setPreviewState({ attachment, url });
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

  if (loading) return <LoadingSpinner className="py-12" />;
  if (!note) return null;

  return (
    <div className="space-y-6">
      {confirmDialog}

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
              className="w-full max-h-40 object-contain rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
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
              <Button size="sm" onClick={handlePasteConfirm} loading={pasteUploading} disabled={!pasteName.trim()}>
                {pasteUploading ? tAttachments('pasteImageUploading') : tAttachments('pasteImageSave')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{note.title}</h1>
        <div className="flex gap-2">
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
            onSave={handleUpdate}
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
        <AttachmentUploadForm onUpload={handleUpload} availableTags={availableTags} initialFile={pasteUploadFile ?? undefined} />
      </Modal>

      <Modal isOpen={showBookmarkModal} onClose={() => setShowBookmarkModal(false)} title={tBookmarks('add')}>
        <BookmarkForm
          availableTags={availableTags}
          onSubmit={handleCreateBookmark}
          onCancel={() => setShowBookmarkModal(false)}
        />
      </Modal>

      <Modal isOpen={!!editingBookmark} onClose={() => setEditingBookmark(null)} title={tBookmarks('edit')}>
        {editingBookmark && (
          <BookmarkForm
            initial={editingBookmark}
            availableTags={availableTags}
            onSubmit={handleUpdateBookmark}
            onCancel={() => setEditingBookmark(null)}
          />
        )}
      </Modal>

      {/* Inline preview modal */}
      {previewState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={handleClosePreview}>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{previewState.attachment.filename}</span>
              <button onClick={handleClosePreview} className="ml-4 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-gray-50">
              {previewState.attachment.mime_type === 'application/pdf' ? (
                <iframe src={previewState.url} className="w-full h-[70vh] rounded" title={previewState.attachment.filename} />
              ) : previewState.attachment.mime_type.startsWith('video/') ? (
                <video src={previewState.url} controls className="max-w-full max-h-[70vh] rounded" />
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
