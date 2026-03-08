'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import toast from 'react-hot-toast';
import { useNotes } from '@/hooks/useNotes';
import { useSecrets } from '@/hooks/useSecrets';
import { useAttachments } from '@/hooks/useAttachments';
import { Attachment, Note } from '@/lib/types';
import NoteEditor from '@/components/notes/NoteEditor';
import SecretList from '@/components/secrets/SecretList';
import SecretForm from '@/components/secrets/SecretForm';
import AttachmentList from '@/components/attachments/AttachmentList';
import AttachmentUploadForm from '@/components/attachments/AttachmentUploadForm';
import Modal from '@/components/common/Modal';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function NotePage({ params }: { params: { id: string; locale: string } }) {
  const t = useTranslations('notes');
  const tSecrets = useTranslations('secrets');
  const tAttachments = useTranslations('attachments');
  const locale = useLocale();
  const router = useRouter();
  const noteId = parseInt(params.id);

  const { getNote, updateNote, deleteNote } = useNotes();
  const { secrets, revealedSecrets, countdown, loading: secretsLoading, fetchSecrets, createSecret, revealSecret, hideSecret, deleteSecret } = useSecrets(noteId);
  const { attachments, loading: attachmentsLoading, fetchAttachments, uploadAttachment, deleteAttachment, previewAttachment } = useAttachments(noteId);

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const n = await getNote(noteId);
        setNote(n);
        await fetchSecrets();
        await fetchAttachments();
      } catch {
        router.push(`/${locale}/dashboard`);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [noteId]);

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
    if (!confirm(t('deleteConfirm'))) return;
    await deleteNote(noteId);
    router.push(`/${locale}/dashboard`);
  };

  const handleCreateSecret = async (data: any) => {
    await createSecret(data);
    setShowSecretModal(false);
    toast.success('Secret saved!');
  };

  const handleUpload = async (file: File, tagIds: number[]) => {
    await uploadAttachment(file, tagIds);
    setShowUploadModal(false);
    toast.success('File uploaded!');
  };

  const handlePreview = async (attachment: Attachment) => {
    try {
      const url = await previewAttachment(attachment.id);
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to preview file');
    }
  };

  if (loading) return <LoadingSpinner className="py-12" />;
  if (!note) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{note.title}</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancel' : 'Edit'}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            {t('delete')}
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <NoteEditor
            initialTitle={note.title}
            initialContent={note.content}
            onSave={handleUpdate}
            loading={saving}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6 prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content || '*No content*'}</ReactMarkdown>
        </div>
      )}

      {note.tags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {note.tags.map((tag) => (
            <span key={tag.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Secrets Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{tSecrets('secrets')}</h2>
          <Button size="sm" onClick={() => setShowSecretModal(true)}>
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
        />
      </div>

      {/* Attachments Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{tAttachments('attachments')}</h2>
          <Button size="sm" onClick={() => setShowUploadModal(true)}>
            {tAttachments('upload')}
          </Button>
        </div>
        <AttachmentList
          attachments={attachments}
          loading={attachmentsLoading}
          onPreview={handlePreview}
          onDelete={deleteAttachment}
        />
      </div>

      <Modal
        isOpen={showSecretModal}
        onClose={() => setShowSecretModal(false)}
        title={tSecrets('addSecret')}
      >
        <SecretForm onSubmit={handleCreateSecret} />
      </Modal>

      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={tAttachments('upload')}
      >
        <AttachmentUploadForm onUpload={handleUpload} />
      </Modal>
    </div>
  );
}
