'use client';

import { useTranslations } from 'next-intl';
import { Attachment, Bookmark, Tag } from '@/lib/types';
import Modal from '@/components/common/Modal';
import SecretForm from '@/components/secrets/SecretForm';
import AttachmentUploadForm from '@/components/attachments/AttachmentUploadForm';
import TextFileCreateForm from '@/components/attachments/TextFileCreateForm';
import AttachmentEditForm from '@/components/attachments/AttachmentEditForm';
import BookmarkForm from '@/components/bookmarks/BookmarkForm';

interface NotePageModalsProps {
  availableTags: Tag[];
  // Secret modal
  showSecretModal: boolean;
  onCloseSecretModal: () => void;
  onCreateSecret: (data: any) => Promise<void>;
  // Upload modal
  showUploadModal: boolean;
  onCloseUploadModal: () => void;
  pasteUploadFiles: File[];
  onUpload: (file: File, tagIds: number[], description?: string) => Promise<void>;
  onUploadComplete: (count: number) => void;
  // Text file modal
  showTextFileModal: boolean;
  onCloseTextFileModal: () => void;
  // Attachment edit modal
  editingAttachment: Attachment | null;
  onCloseEditAttachment: () => void;
  onSaveAttachment: (data: { filename?: string; description?: string; tag_ids: number[]; content?: string }) => Promise<void>;
  fetchAttachmentContent: (id: number) => Promise<string>;
  // Bookmark modals
  showBookmarkModal: boolean;
  onCloseBookmarkModal: () => void;
  onCreateBookmark: (data: any) => Promise<void>;
  editingBookmark: Bookmark | null;
  onCloseEditBookmark: () => void;
  onUpdateBookmark: (data: any) => Promise<void>;
}

export default function NotePageModals({
  availableTags,
  showSecretModal, onCloseSecretModal, onCreateSecret,
  showUploadModal, onCloseUploadModal, pasteUploadFiles, onUpload, onUploadComplete,
  showTextFileModal, onCloseTextFileModal,
  editingAttachment, onCloseEditAttachment, onSaveAttachment, fetchAttachmentContent,
  showBookmarkModal, onCloseBookmarkModal, onCreateBookmark,
  editingBookmark, onCloseEditBookmark, onUpdateBookmark,
}: NotePageModalsProps) {
  const tSecrets = useTranslations('secrets');
  const tAttachments = useTranslations('attachments');
  const tBookmarks = useTranslations('bookmarks');

  return (
    <>
      <Modal isOpen={showSecretModal} onClose={onCloseSecretModal} title={tSecrets('addSecret')}>
        <SecretForm onSubmit={onCreateSecret} />
      </Modal>

      <Modal isOpen={showUploadModal} onClose={onCloseUploadModal} title={tAttachments('upload')}>
        <AttachmentUploadForm
          onUpload={onUpload}
          onComplete={onUploadComplete}
          availableTags={availableTags}
          initialFiles={pasteUploadFiles.length > 0 ? pasteUploadFiles : undefined}
        />
      </Modal>

      <Modal isOpen={showTextFileModal} onClose={onCloseTextFileModal} title={tAttachments('createTextFile')}>
        <TextFileCreateForm
          onUpload={onUpload}
          onComplete={() => { onUploadComplete(1); onCloseTextFileModal(); }}
          availableTags={availableTags}
        />
      </Modal>

      <Modal isOpen={!!editingAttachment} onClose={onCloseEditAttachment} title={tAttachments('editAttachment')}>
        {editingAttachment && (
          <AttachmentEditForm
            attachment={editingAttachment}
            availableTags={availableTags}
            onSave={onSaveAttachment}
            onCancel={onCloseEditAttachment}
            fetchContent={() => fetchAttachmentContent(editingAttachment.id)}
          />
        )}
      </Modal>

      <Modal isOpen={showBookmarkModal} onClose={onCloseBookmarkModal} title={tBookmarks('add')}>
        <BookmarkForm
          availableTags={availableTags}
          onSubmit={onCreateBookmark}
          onCancel={onCloseBookmarkModal}
        />
      </Modal>

      <Modal isOpen={!!editingBookmark} onClose={onCloseEditBookmark} title={tBookmarks('edit')}>
        {editingBookmark && (
          <BookmarkForm
            initial={editingBookmark}
            availableTags={availableTags}
            onSubmit={onUpdateBookmark}
            onCancel={onCloseEditBookmark}
          />
        )}
      </Modal>
    </>
  );
}
