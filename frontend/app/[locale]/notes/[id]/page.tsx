'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import { useCategories } from '@/hooks/useCategories';
import { useSecrets } from '@/hooks/useSecrets';
import { useAttachments } from '@/hooks/useAttachments';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useTasks } from '@/hooks/useTasks';
import { Attachment, Bookmark, CalendarEvent, Note } from '@/lib/types';
import { buildVirtualBookmarks } from '@/lib/virtualBookmarks';
import NoteEditor from '@/components/notes/NoteEditor';
import NoteFieldsPanel from '@/components/notes/NoteFieldsPanel';
import SecretList from '@/components/secrets/SecretList';
import SecretForm from '@/components/secrets/SecretForm';
import AttachmentGroupedList from '@/components/attachments/AttachmentGroupedList';
import AttachmentFlatList from '@/components/attachments/AttachmentFlatList';
import AttachmentUploadForm from '@/components/attachments/AttachmentUploadForm';
import AttachmentEditForm from '@/components/attachments/AttachmentEditForm';
import TextFileCreateForm from '@/components/attachments/TextFileCreateForm';
import BookmarkList from '@/components/bookmarks/BookmarkList';
import BookmarkForm from '@/components/bookmarks/BookmarkForm';
import TaskPanel from '@/components/tasks/TaskPanel';
import EventPanel from '@/components/events/EventPanel';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CollapsedSection from '@/components/common/CollapsedSection';
import { ArchiveIcon, ArrowDownTrayIcon, CalendarIcon, DocumentTextIcon, EyeIcon, FolderIcon, KeyIcon, LinkIcon, LockClosedIcon, PaperclipIcon, PaperclipUploadIcon, PencilIcon, RestoreIcon, ShareIcon, TrashIcon, XMarkIcon } from '@/components/common/Icons';
import ShareModal from '@/components/notes/ShareModal';
import AttachmentPreviewModal from '@/components/attachments/AttachmentPreviewModal';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';
import api from '@/lib/api';
import { clearCached } from '@/lib/faviconCache';

const INLINE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'message/rfc822',
  'application/zip',
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml',
]);

const TEXT_PREVIEW_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml',
]);

export default function NotePage({ params }: { params: { id: string; locale: string } }) {
  const t = useTranslations('notes');
  const tSecrets = useTranslations('secrets');
  const tAttachments = useTranslations('attachments');
  const tBookmarks = useTranslations('bookmarks');
  const tTasks = useTranslations('tasks');
  const tEvents = useTranslations('events');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const noteId = parseInt(params.id);

  const { getNote, updateNote, deleteNote } = useNotes();
  const { tags: availableTagsFromHook, fetchTags, createTag } = useTags();
  const { categories, fetchCategories, flattenCategories } = useCategories();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { secrets, setSecrets, revealedSecrets, countdown, loading: secretsLoading, fetchSecrets, createSecret, revealSecret, hideSecret, deleteSecret, copySecret, reorderSecrets, archiveSecret, restoreSecret, fetchArchivedSecrets } = useSecrets(noteId);
  const { attachments, setAttachments, loading: attachmentsLoading, fetchAttachments, uploadAttachment, updateAttachment, updateAttachmentContent, fetchTextContent, deleteAttachment, previewAttachment, parseZip, previewZipEntry, downloadZipEntry, parseZipEml, previewZipEmlPart, downloadZipEmlPart, parseEml, previewEmlPart, downloadEmlPart, reorderAttachments, archiveAttachment, restoreAttachment, fetchArchivedAttachments } = useAttachments(noteId);
  const { bookmarks, setBookmarks, loading: bookmarksLoading, fetchBookmarks, createBookmark, updateBookmark, deleteBookmark, reorderBookmarks, archiveBookmark, restoreBookmark, fetchArchivedBookmarks } = useBookmarks(noteId);
  const { tasks, setTasks, loading: tasksLoading, fetchTasks, createTask, updateTask, deleteTask, reorderTasks, archiveTask, restoreTask, fetchArchivedTasks } = useTasks(noteId);

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [wikiLinksMap, setWikiLinksMap] = useState<Map<string, { id: number; title: string }>>(new Map());
  const [backlinks, setBacklinks] = useState<{ id: number; title: string }[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTextFileModal, setShowTextFileModal] = useState(false);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [attachmentView, setAttachmentView] = useState<'flat' | 'grouped'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('attachmentView') as 'flat' | 'grouped') ?? 'flat';
    }
    return 'flat';
  });
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [previewState, setPreviewState] = useState<{ attachment: Attachment; url: string } | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<Attachment | null>(null);
  const [archivedAttachments, setArchivedAttachments] = useState<Attachment[]>([]);
  const [showArchivedAttachments, setShowArchivedAttachments] = useState(false);
  const [archivedAttachmentsLoading, setArchivedAttachmentsLoading] = useState(false);

  const [emlAttachmentsMap, setEmlAttachmentsMap] = useState<Record<number, number>>({});

  // Collapsed section state
  const [eventsCount, setEventsCount] = useState<number | null>(null);
  const [noteEvents, setNoteEvents] = useState<CalendarEvent[]>([]);
  const virtualBookmarks = useMemo(() => buildVirtualBookmarks(secrets, noteEvents), [secrets, noteEvents]);
  const [forceTasksExpanded, setForceTasksExpanded] = useState(false);
  const eventPanelAddRef = useRef<(() => void) | null>(null); // MutableRefObject by default

  // Paste-image state (images: quick modal with preview)
  const [pasteFile, setPasteFile] = useState<File | null>(null);
  const [pasteName, setPasteName] = useState('');
  const [pastePreviewUrl, setPastePreviewUrl] = useState('');
  const [pasteUploading, setPasteUploading] = useState(false);
  const filenameInputRef = useRef<HTMLInputElement>(null);
  // Paste-file state (non-images or multiple files: reuse upload modal pre-filled)
  const [pasteUploadFiles, setPasteUploadFiles] = useState<File[]>([]);
  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const fetchBacklinks = useCallback(async () => {
    try {
      const r = await api.get<{ id: number; title: string }[]>(`/api/notes/${noteId}/backlinks`);
      setBacklinks(r.data);
    } catch {
      setBacklinks([]);
    }
  }, [noteId]);

  const resolveWikiLinks = useCallback(async (content: string) => {
    // Normalize escaped \[\[title\]\] → [[title]] (from older tiptap-markdown saves)
    const normalized = content.replace(/\\\[\\\[([^\]]+)\\\]\\\]/g, '[[$1]]');
    const titles = [...new Set([...normalized.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]))];
    if (titles.length === 0) {
      setWikiLinksMap(new Map());
      return normalized;
    }
    const resolved = await Promise.all(
      titles.map((title) =>
        api.get<{ id: number; title: string }[]>('/api/notes/resolve', { params: { q: title, exact: true } })
          .then((r) => r.data[0] ? { title, note: r.data[0] } : null)
          .catch(() => null)
      )
    );
    const map = new Map<string, { id: number; title: string }>();
    resolved.forEach((r) => r && map.set(r.title, r.note));
    setWikiLinksMap(map);
    return normalized;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const n = await getNote(noteId);
        setNote(n);

        // Resolve wiki-links and normalize content; fetch backlinks in parallel
        const [normalized] = await Promise.all([resolveWikiLinks(n.content), fetchBacklinks()]);
        if (normalized !== n.content) setNote({ ...n, content: normalized });
        await fetchSecrets();
        const loadedAttachments = await fetchAttachments();
        if (loadedAttachments) {
          loadedAttachments.filter((a) => a.mime_type === 'message/rfc822').forEach(async (a) => {
            try {
              const parsed = await parseEml(a.id);
              if (parsed.attachments.length > 0) setEmlAttachmentsMap((prev) => ({ ...prev, [a.id]: parsed.attachments.length }));
            } catch { /* ignore */ }
          });
        }
        await fetchBookmarks();
        await fetchTasks();
        await fetchTags();
        await fetchCategories();
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
      // Don't trigger if focus is inside a field image paste zone
      if (document.activeElement?.closest('[data-image-paste-zone]')) return;

      const pastedFiles: File[] = Array.from(e.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file')
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);

      if (pastedFiles.length === 0) {
        pastedFiles.push(...Array.from(e.clipboardData?.files ?? []));
      }

      if (pastedFiles.length === 0) return;
      e.preventDefault();

      if (pastedFiles.length === 1 && pastedFiles[0].type.startsWith('image/')) {
        openPasteModal(pastedFiles[0]);
      } else {
        setPasteUploadFiles(pastedFiles);
        setShowUploadModal(true);
      }
    };

    document.addEventListener('paste', handleDocumentPaste);
    return () => document.removeEventListener('paste', handleDocumentPaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteFile]);

  // ESC key: close preview overlays in cascade
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (previewState) {
        handleClosePreview();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewState]);

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
      const droppedFiles = Array.from(e.dataTransfer?.files ?? []);
      if (droppedFiles.length === 0) return;
      if (droppedFiles.length === 1 && droppedFiles[0].type.startsWith('image/')) {
        openPasteModal(droppedFiles[0]);
      } else {
        setPasteUploadFiles(droppedFiles);
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
      // Re-resolve wiki-links and backlinks from the new content
      const [normalized] = await Promise.all([resolveWikiLinks(updated.content), fetchBacklinks()]);
      setNote(normalized !== updated.content ? { ...updated, content: normalized } : updated);
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
  };

  const handleUploadComplete = (count: number) => {
    setShowUploadModal(false);
    setPasteUploadFiles([]);
    toast.success(count > 1 ? `${count} files uploaded!` : 'File uploaded!');
  };

  const handleEditAttachment = async (data: { filename?: string; description?: string; tag_ids: number[]; content?: string }) => {
    if (!editingAttachment) return;
    try {
      await updateAttachment(editingAttachment.id, { filename: data.filename, description: data.description, tag_ids: data.tag_ids });
      if (data.content !== undefined) {
        await updateAttachmentContent(editingAttachment.id, data.content);
      }
      setEditingAttachment(null);
      toast.success('Attachment updated!');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Update failed');
    }
  };

  const handleClosePreview = () => {
    setPreviewState(null);
  };

  const handleDownload = async (attachment: Attachment) => {
    const toastId = toast.loading(attachment.filename);
    try {
      const response = await api.get(
        `/api/notes/${noteId}/attachments/${attachment.id}/stream`,
        { responseType: 'blob', params: { _t: Date.now() } },
      );
      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast.dismiss(toastId);
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to download file');
    }
  };

  const handlePreview = (attachment: Attachment) => {
    setPreviewState({ attachment, url: '' });
  };

  const handleCreateBookmark = async (data: any) => {
    await createBookmark(data);
    setShowBookmarkModal(false);
    toast.success('Bookmark saved!');
  };

  const handleUpdateBookmark = async (data: any) => {
    if (!editingBookmark) return;
    // Clear favicon cache for old and new URL so BookmarkItem re-fetches on remount
    for (const url of [editingBookmark.url, data.url]) {
      try { clearCached(new URL(url.startsWith('http') ? url : `https://${url}`).origin); } catch { /* invalid url */ }
    }
    await updateBookmark(editingBookmark.id, data);
    setEditingBookmark(null);
    toast.success('Bookmark updated!');
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) return <LoadingSpinner className="py-12" />;
  if (!note) return null;

  return (
    <div className="space-y-6">
      {confirmDialog}
      {showShareModal && <ShareModal noteId={noteId} onClose={() => setShowShareModal(false)} />}

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

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{note.title}</h1>
          <DateInfoTooltip createdAt={note.created_at} updatedAt={note.updated_at} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="sm" onClick={() => setShowShareModal(true)} title="Share">
            <ShareIcon />
          </Button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-0.5" />
          <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? <XMarkIcon /> : <PencilIcon />}
            {editing ? tCommon('cancel') : 'Edit'}
          </Button>
          <Button variant="ghost-danger" size="sm" onClick={handleDelete} title={t('delete')}>
            <TrashIcon />
          </Button>
        </div>
      </div>


      {editing ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <NoteEditor
            initialTitle={note.title}
            initialContent={note.content}
            initialTagIds={note.tags.map((t) => t.id)}
            initialCategoryId={note.category_id}
            availableTags={availableTagsFromHook}
            availableCategories={flattenCategories(categories)}
            onSave={handleUpdate}
            onCreateTag={createTag}
            loading={saving}
          />
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-xl border-l-4 border-l-indigo-500 border border-gray-200 dark:border-gray-700 p-6 prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a({ href, children }) {
                  if (href?.startsWith('wiki-link:')) {
                    return <span className="text-gray-700 dark:text-gray-300">{children}</span>;
                  }
                  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                },
              }}
            >
              {(note.content || '*No content*').replace(
                /\[\[([^\]]+)\]\]/g,
                (_, title) => {
                  const linked = wikiLinksMap.get(title);
                  return linked ? `[${title}](wiki-link:${linked.id})` : `[[${title}]]`;
                }
              )}
            </ReactMarkdown>
          </div>

          {(wikiLinksMap.size > 0 || backlinks.length > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{t('wikiLinks')}</h3>
              <div className="flex flex-wrap gap-2">
                {[...wikiLinksMap.values()].map((linked) => (
                  <a
                    key={`out-${linked.id}`}
                    href={`/${locale}/notes/${linked.id}`}
                    onClick={(e) => { e.preventDefault(); router.push(`/${locale}/notes/${linked.id}`); }}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <LinkIcon className="w-3 h-3 shrink-0" />
                    {linked.title}
                  </a>
                ))}
                {backlinks
                  .filter((bl) => ![...wikiLinksMap.values()].some((v) => v.id === bl.id))
                  .map((bl) => (
                    <a
                      key={`in-${bl.id}`}
                      href={`/${locale}/notes/${bl.id}`}
                      onClick={(e) => { e.preventDefault(); router.push(`/${locale}/notes/${bl.id}`); }}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors opacity-70"
                      title="Citata da questa nota"
                    >
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                      {bl.title}
                    </a>
                  ))}
              </div>
            </div>
          )}
        </>
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
      {secretsLoading || secrets.length > 0 ? (
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
            onArchive={archiveSecret}
            onRestore={restoreSecret}
            fetchArchivedSecrets={fetchArchivedSecrets}
            onCopyDirect={copySecret}
            onReorder={reorderSecrets}
            setSecrets={setSecrets}
          />
        </div>
      ) : (
        <CollapsedSection
          icon={<KeyIcon />}
          label={tSecrets('secrets')}
          onAdd={() => setShowSecretModal(true)}
          addLabel={`+ ${tSecrets('addSecret')}`}
        />
      )}

      {/* Attachments Section */}
      {attachmentsLoading || attachments.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{tAttachments('attachments')}</h2>
            <div className="flex items-center gap-2">
              {/* Upload actions — icon-only with tooltips */}
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" title={tAttachments('upload')} onClick={() => setShowUploadModal(true)}>
                  <PaperclipUploadIcon />
                </Button>
                <Button size="sm" variant="ghost" title={tAttachments('createTextFile')} onClick={() => setShowTextFileModal(true)}>
                  <DocumentTextIcon />
                </Button>
              </div>
              {/* View toggle */}
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 text-xs">
                <button
                  onClick={() => { setAttachmentView('flat'); localStorage.setItem('attachmentView', 'flat'); }}
                  className={`px-2.5 py-1.5 transition-colors ${attachmentView === 'flat' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                >
                  {tAttachments('viewFlat')}
                </button>
                <button
                  onClick={() => { setAttachmentView('grouped'); localStorage.setItem('attachmentView', 'grouped'); }}
                  className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 dark:border-gray-600 ${attachmentView === 'grouped' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                >
                  {tAttachments('viewGrouped')}
                </button>
              </div>
            </div>
          </div>
          {attachmentView === 'grouped' ? (
            <AttachmentGroupedList
              attachments={attachments}
              loading={attachmentsLoading}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onDelete={deleteAttachment}
              onEdit={(att) => setEditingAttachment(att)}
              onArchive={async (id, note) => {
                const att = attachments.find((a) => a.id === id);
                await archiveAttachment(id, note);
                if (showArchivedAttachments && att) setArchivedAttachments((prev) => [...prev, { ...att, is_archived: true, archive_note: note || null }]);
              }}
              emlAttachmentsMap={emlAttachmentsMap}
              onReorder={reorderAttachments}
              setAttachments={setAttachments}
            />
          ) : (
            <AttachmentFlatList
              attachments={attachments}
              loading={attachmentsLoading}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onDelete={deleteAttachment}
              onEdit={(att) => setEditingAttachment(att)}
              onArchive={async (id, note) => {
                const att = attachments.find((a) => a.id === id);
                await archiveAttachment(id, note);
                if (showArchivedAttachments && att) setArchivedAttachments((prev) => [...prev, { ...att, is_archived: true, archive_note: note || null }]);
              }}
              emlAttachmentsMap={emlAttachmentsMap}
              onReorder={reorderAttachments}
              setAttachments={setAttachments}
            />
          )}

          {/* Archived attachments section */}
          <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
            <button
              type="button"
              onClick={async () => {
                if (!showArchivedAttachments && archivedAttachments.length === 0) {
                  setArchivedAttachmentsLoading(true);
                  try {
                    const items = await fetchArchivedAttachments();
                    setArchivedAttachments(items);
                  } finally {
                    setArchivedAttachmentsLoading(false);
                  }
                }
                setShowArchivedAttachments((v) => !v);
              }}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <ArchiveIcon className="h-3.5 w-3.5" />
              <span>{tCommon('archivedCount', { count: archivedAttachments.length || '…' })}</span>
              <span className="ml-0.5">{showArchivedAttachments ? '▲' : '▼'}</span>
            </button>
            {showArchivedAttachments && (
              <div className="mt-2 space-y-1">
                {archivedAttachmentsLoading && <p className="text-xs text-gray-400">Loading...</p>}
                {!archivedAttachmentsLoading && archivedAttachments.length === 0 && (
                  <p className="text-xs text-gray-400 py-1">{tAttachments('noAttachments')}</p>
                )}
                {archivedAttachments.map((att) => (
                  <div key={att.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-200 dark:border-gray-700 opacity-70 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{att.filename}</p>
                      {att.archive_note && <p className="text-xs text-gray-400 italic truncate">{att.archive_note}</p>}
                    </div>
                    <button
                      type="button"
                      title={tCommon('restore')}
                      onClick={async () => {
                        const ok = await confirm(tCommon('restoreConfirm'), { confirmLabel: tCommon('restore'), confirmVariant: 'secondary' });
                        if (!ok) return;
                        await restoreAttachment(att.id);
                        setArchivedAttachments((prev) => prev.filter((a) => a.id !== att.id));
                      }}
                      className="text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                    >
                      <RestoreIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title={tCommon('deleteForever')}
                      onClick={async () => {
                        const ok = await confirm(tCommon('deleteConfirm'));
                        if (!ok) return;
                        await deleteAttachment(att.id);
                        setArchivedAttachments((prev) => prev.filter((a) => a.id !== att.id));
                      }}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <CollapsedSection
          icon={<PaperclipIcon />}
          label={tAttachments('attachments')}
          onAdd={() => setShowUploadModal(true)}
          addLabel={`+ ${tAttachments('upload')}`}
          onAdd2={() => setShowTextFileModal(true)}
          addLabel2={`+ ${tAttachments('createTextFile')}`}
        />
      )}

      {/* Bookmarks Section */}
      {bookmarksLoading || bookmarks.length > 0 || virtualBookmarks.length > 0 ? (
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
            onArchive={archiveBookmark}
            onRestore={restoreBookmark}
            fetchArchivedBookmarks={fetchArchivedBookmarks}
            onReorder={reorderBookmarks}
            setBookmarks={setBookmarks}
            virtualBookmarks={virtualBookmarks}
          />
        </div>
      ) : (
        <CollapsedSection
          icon={<LinkIcon />}
          label={tBookmarks('bookmarks')}
          onAdd={() => setShowBookmarkModal(true)}
          addLabel={`+ ${tBookmarks('add')}`}
        />
      )}

      {/* Technical Fields Panel */}
      <NoteFieldsPanel noteId={noteId} />

      {/* Tasks Section */}
      {tasksLoading || tasks.length > 0 || forceTasksExpanded ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{tTasks('tasks')}</h2>
          </div>
          <TaskPanel
            tasks={tasks}
            loading={tasksLoading}
            onCreate={async (title, dueDate) => { await createTask({ title, due_date: dueDate || null }); }}
            onToggle={async (id, isDone) => { await updateTask(id, { is_done: isDone }); }}
            onUpdate={async (id, data) => { await updateTask(id, data); }}
            onDelete={deleteTask}
            onArchive={archiveTask}
            onRestore={restoreTask}
            fetchArchivedTasks={fetchArchivedTasks}
            onReorder={reorderTasks}
            setTasks={setTasks}
          />
        </div>
      ) : (
        <CollapsedSection
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          label={tTasks('tasks')}
          onAdd={() => setForceTasksExpanded(true)}
          addLabel={`+ ${tTasks('add')}`}
        />
      )}

      {/* Events Section */}
      {eventsCount === 0 && (
        <CollapsedSection
          icon={<CalendarIcon />}
          label={tEvents('events')}
          onAdd={() => eventPanelAddRef.current?.()}
          addLabel={`+ ${tEvents('addEvent')}`}
        />
      )}
      <div className={eventsCount === 0 ? 'h-0 overflow-hidden' : 'bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6'}>
        <EventPanel noteId={noteId} onCountChange={setEventsCount} onEventsChange={setNoteEvents} onAdd={eventPanelAddRef} />
      </div>

      <Modal isOpen={showSecretModal} onClose={() => setShowSecretModal(false)} title={tSecrets('addSecret')}>
        <SecretForm onSubmit={handleCreateSecret} />
      </Modal>

      <Modal isOpen={showUploadModal} onClose={() => { setShowUploadModal(false); setPasteUploadFiles([]); }} title={tAttachments('upload')}>
        <AttachmentUploadForm
          onUpload={handleUpload}
          onComplete={handleUploadComplete}
          availableTags={availableTagsFromHook}
          initialFiles={pasteUploadFiles.length > 0 ? pasteUploadFiles : undefined}
        />
      </Modal>

      <Modal isOpen={showTextFileModal} onClose={() => setShowTextFileModal(false)} title={tAttachments('createTextFile')}>
        <TextFileCreateForm
          onUpload={handleUpload}
          onComplete={() => { handleUploadComplete(1); setShowTextFileModal(false); }}
          availableTags={availableTagsFromHook}
        />
      </Modal>

      <Modal isOpen={!!editingAttachment} onClose={() => setEditingAttachment(null)} title={tAttachments('editAttachment')}>
        {editingAttachment && (
          <AttachmentEditForm
            attachment={editingAttachment}
            availableTags={availableTagsFromHook}
            onSave={handleEditAttachment}
            onCancel={() => setEditingAttachment(null)}
            fetchContent={() => fetchTextContent(editingAttachment.id)}
          />
        )}
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

      {previewState && (
        <AttachmentPreviewModal
          noteId={noteId}
          attachment={previewState.attachment}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}
