'use client';

import { useTranslations } from 'next-intl';
import { Attachment } from '@/lib/types';
import Button from '@/components/common/Button';
import { ArrowDownTrayIcon, EyeIcon, PaperclipIcon, PencilIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';
import { formatDate } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  attachment: Attachment;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
  onEdit: (attachment: Attachment) => void;
  emlAttachmentCount?: number;
}

const INLINE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
  'message/rfc822', 'application/zip',
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml',
]);

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
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'application/json' || mime === 'application/xml' || mime === 'text/xml') return (
    <svg className="w-8 h-8 text-teal-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6M9 13h6M9 17h4" />
    </svg>
  );
  if (mime === 'text/html') return (
    <svg className="w-8 h-8 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13l-2 2 2 2M15 13l2 2-2 2" />
    </svg>
  );
  if (mime === 'application/x-msdownload') return (
    <svg className="w-8 h-8 text-gray-600 dark:text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v6h6M12 12v6M9 15l3 3 3-3" />
    </svg>
  );
  if (mime === 'application/octet-stream') return (
    <svg className="w-8 h-8 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
  if (mime === 'message/rfc822') return (
    <svg className="w-8 h-8 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

export default function AttachmentItem({ attachment, onPreview, onDownload, onDelete, onEdit, emlAttachmentCount = 0 }: Props) {
  const t = useTranslations('attachments');
  const tCommon = useTranslations('common');
  const { confirm, dialog } = useConfirm();
  const canPreview = INLINE_MIMES.has(attachment.mime_type);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: attachment.id });

  const tooltipExtras = attachment.file_modified_at
    ? [{ label: tCommon('fileModifiedAt'), value: formatDate(attachment.file_modified_at) }]
    : undefined;

  const handleDelete = async () => {
    if (await confirm(t('deleteConfirm'))) onDelete(attachment.id);
  };

  return (
    <>
      {dialog}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
        className="flex gap-2 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
      >
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 shrink-0 select-none mt-1 px-0.5"
          title="Drag to reorder"
        >
          ⠿
        </span>

        <div className="shrink-0 mt-0.5">
          <FileIcon mime={attachment.mime_type} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-all leading-snug">
              {attachment.filename}
              {emlAttachmentCount > 0 && (
                <span className="inline-block ml-1 text-gray-400 dark:text-gray-500 align-middle" title={t('emlHasAttachments')}>
                  <PaperclipIcon />
                </span>
              )}
            </p>
            <div className="flex gap-1 items-center shrink-0">
              {canPreview && (
                <Button size="sm" variant="secondary" title={t('preview')} onClick={() => onPreview(attachment)}>
                  <EyeIcon />
                  <span className="hidden sm:inline">{t('preview')}</span>
                </Button>
              )}
              <Button size="sm" variant="secondary" title={t('download')} onClick={() => onDownload(attachment)}>
                <ArrowDownTrayIcon />
                <span className="hidden sm:inline">{t('download')}</span>
              </Button>
              <Button size="sm" variant="secondary" title={t('edit')} onClick={() => onEdit(attachment)}>
                <PencilIcon />
              </Button>
              <Button size="sm" variant="ghost-danger" title={t('delete')} onClick={handleDelete}>
                <TrashIcon />
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatBytes(attachment.size_bytes)}</p>
          {attachment.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{attachment.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {attachment.tags.map((tag) => (
              <span key={tag.id} className="bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full">
                {tag.name}
              </span>
            ))}
            <DateInfoTooltip createdAt={attachment.created_at} updatedAt={attachment.updated_at} extras={tooltipExtras} />
          </div>
        </div>
      </div>
    </>
  );
}
