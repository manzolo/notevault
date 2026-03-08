'use client';

import { useTranslations } from 'next-intl';
import { Attachment } from '@/lib/types';
import Button from '@/components/common/Button';
import { ArrowDownTrayIcon, EyeIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';

interface Props {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
}

const INLINE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith('image/')) return (
    <svg className="w-8 h-8 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16l4-4a3 3 0 014 0l4 4M14 12l2-2a3 3 0 014 0l2 2M3 20h18a1 1 0 001-1V5a1 1 0 00-1-1H3a1 1 0 00-1 1v14a1 1 0 001 1z" />
    </svg>
  );
  if (mime === 'application/pdf') return (
    <svg className="w-8 h-8 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 12h4M10 16h4M10 8h2" />
    </svg>
  );
  if (mime === 'application/msword' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime === 'application/vnd.oasis.opendocument.text') return (
    <svg className="w-8 h-8 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13l2 4 2-4M9 9h6" />
    </svg>
  );
  if (mime === 'application/vnd.ms-excel' ||
      mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime === 'application/vnd.oasis.opendocument.spreadsheet') return (
    <svg className="w-8 h-8 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6v6H9zM9 15h6M12 9v6" />
    </svg>
  );
  if (mime === 'application/vnd.ms-powerpoint' ||
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mime === 'application/vnd.oasis.opendocument.presentation') return (
    <svg className="w-8 h-8 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 11a2 2 0 104 0 2 2 0 00-4 0zM13 11l2 4" />
    </svg>
  );
  if (mime === 'text/markdown') return (
    <svg className="w-8 h-8 text-gray-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13l1.5 2L12 13l1.5 2L15 13M9 9h6" />
    </svg>
  );
  if (mime === 'application/zip' || mime === 'application/x-tar' || mime === 'application/gzip') return (
    <svg className="w-8 h-8 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M10 12h4" />
    </svg>
  );
  return (
    <svg className="w-8 h-8 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  );
}

export default function AttachmentItem({ attachment, onPreview, onDownload, onDelete }: Props) {
  const t = useTranslations('attachments');
  const { confirm, dialog } = useConfirm();
  const canPreview = INLINE_MIMES.has(attachment.mime_type);

  const handleDelete = async () => {
    if (await confirm(t('deleteConfirm'))) onDelete(attachment.id);
  };

  return (
    <>
      {dialog}
      <div className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
        <FileIcon mime={attachment.mime_type} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{attachment.filename}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(attachment.size_bytes)}</p>
          {attachment.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{attachment.description}</p>
          )}
          {attachment.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {attachment.tags.map((tag) => (
                <span key={tag.id} className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-1.5 shrink-0">
          {canPreview && (
            <Button size="sm" variant="secondary" onClick={() => onPreview(attachment)}>
              <EyeIcon />
              {t('preview')}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => onDownload(attachment)}>
            <ArrowDownTrayIcon />
            {t('download')}
          </Button>
          <Button size="sm" variant="ghost-danger" title={t('delete')} onClick={handleDelete}>
            <TrashIcon />
          </Button>
        </div>
      </div>
    </>
  );
}
