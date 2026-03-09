'use client';

import { useTranslations } from 'next-intl';
import { Attachment } from '@/lib/types';
import AttachmentItem from './AttachmentItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface Props {
  attachments: Attachment[];
  loading: boolean;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
  onEdit: (attachment: Attachment) => void;
}

export default function AttachmentList({ attachments, loading, onPreview, onDownload, onDelete, onEdit }: Props) {
  const t = useTranslations('attachments');

  if (loading) return <LoadingSpinner />;

  if (attachments.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">{t('noAttachments')}</p>;
  }

  return (
    <div>
      {attachments.map((att) => (
        <AttachmentItem
          key={att.id}
          attachment={att}
          onPreview={onPreview}
          onDownload={onDownload}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
