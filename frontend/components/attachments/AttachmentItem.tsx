'use client';

import { useTranslations } from 'next-intl';
import { Attachment } from '@/lib/types';
import Button from '@/components/common/Button';

interface Props {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
}

const INLINE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AttachmentItem({ attachment, onPreview, onDelete }: Props) {
  const t = useTranslations('attachments');
  const canPreview = INLINE_MIMES.has(attachment.mime_type);

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{attachment.filename}</p>
        <p className="text-xs text-gray-500">{formatBytes(attachment.size_bytes)}</p>
        {attachment.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {attachment.tags.map((tag) => (
              <span key={tag.id} className="bg-green-50 text-green-700 text-xs px-1.5 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 ml-4 shrink-0">
        {canPreview ? (
          <Button size="sm" variant="secondary" onClick={() => onPreview(attachment)}>
            {t('preview')}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => onPreview(attachment)}>
            {t('download')}
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (confirm(t('deleteConfirm'))) onDelete(attachment.id);
          }}
        >
          {t('delete')}
        </Button>
      </div>
    </div>
  );
}
