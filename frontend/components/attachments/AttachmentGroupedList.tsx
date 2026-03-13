'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Attachment } from '@/lib/types';
import AttachmentItem from './AttachmentItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';

type MimeCategory =
  | 'images'
  | 'video'
  | 'pdf'
  | 'documents'
  | 'spreadsheets'
  | 'presentations'
  | 'markdown'
  | 'archives'
  | 'emails'
  | 'scripts'
  | 'executables'
  | 'other';

const CATEGORY_ORDER: MimeCategory[] = [
  'images', 'pdf', 'video', 'documents', 'spreadsheets', 'presentations',
  'markdown', 'archives', 'emails', 'scripts', 'executables', 'other',
];

function getMimeCategory(mime: string): MimeCategory {
  if (mime.startsWith('image/')) return 'images';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.oasis.opendocument.text'
  ) return 'documents';
  if (
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.oasis.opendocument.spreadsheet'
  ) return 'spreadsheets';
  if (
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'application/vnd.oasis.opendocument.presentation'
  ) return 'presentations';
  if (mime === 'text/markdown') return 'markdown';
  if (
    mime === 'application/zip' ||
    mime === 'application/x-tar' ||
    mime === 'application/gzip' ||
    mime === 'application/x-gzip'
  ) return 'archives';
  if (mime === 'message/rfc822') return 'emails';
  if (mime === 'application/x-msdownload') return 'executables';
  if (mime === 'application/octet-stream') return 'executables';
  if (mime === 'text/plain') return 'scripts';
  if (mime === 'text/csv' || mime === 'application/json' || mime === 'application/xml' || mime === 'text/xml') return 'other';
  if (mime === 'text/html') return 'other';
  return 'other';
}

function groupAttachments(attachments: Attachment[]): Map<MimeCategory, Attachment[]> {
  const map = new Map<MimeCategory, Attachment[]>();
  for (const att of attachments) {
    const cat = getMimeCategory(att.mime_type);
    const list = map.get(cat) ?? [];
    list.push(att);
    map.set(cat, list);
  }
  return map;
}

const COLLAPSE_THRESHOLD = 3;

interface Props {
  attachments: Attachment[];
  loading: boolean;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
  onEdit: (attachment: Attachment) => void;
  emlAttachmentsMap?: Record<number, number>;
}

export default function AttachmentGroupedList({
  attachments, loading, onPreview, onDownload, onDelete, onEdit, emlAttachmentsMap,
}: Props) {
  const t = useTranslations('attachments');
  const [expanded, setExpanded] = useState<Set<MimeCategory>>(new Set());

  if (loading) return <LoadingSpinner />;

  if (attachments.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">{t('noAttachments')}</p>;
  }

  const groups = groupAttachments(attachments);
  const hasMultipleGroups = groups.size > 1;

  const toggleExpand = (cat: MimeCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => {
        const items = groups.get(cat)!;
        const isExpanded = expanded.has(cat);
        const hasMore = items.length > COLLAPSE_THRESHOLD;

        return (
          <div key={cat} className="group">
            {hasMultipleGroups && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                  {t(`category_${cat}` as any)}
                </span>
                <span className="text-xs text-gray-300 dark:text-gray-600">({items.length})</span>
              </div>
            )}

            {/* First COLLAPSE_THRESHOLD items always visible */}
            {items.slice(0, COLLAPSE_THRESHOLD).map((att) => (
              <AttachmentItem
                key={att.id}
                attachment={att}
                onPreview={onPreview}
                onDownload={onDownload}
                onDelete={onDelete}
                onEdit={onEdit}
                emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
              />
            ))}

            {/* Extra items: hover-expand (CSS) or permanently expanded */}
            {hasMore && (
              <>
                {isExpanded ? (
                  items.slice(COLLAPSE_THRESHOLD).map((att) => (
                    <AttachmentItem
                      key={att.id}
                      attachment={att}
                      onPreview={onPreview}
                      onDownload={onDownload}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
                    />
                  ))
                ) : (
                  <div className="max-h-0 overflow-hidden group-hover:max-h-[9999px] transition-[max-height] duration-500 ease-in-out">
                    {items.slice(COLLAPSE_THRESHOLD).map((att) => (
                      <AttachmentItem
                        key={att.id}
                        attachment={att}
                        onPreview={onPreview}
                        onDownload={onDownload}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
                      />
                    ))}
                  </div>
                )}

                {!isExpanded && (
                  <button
                    onClick={() => toggleExpand(cat)}
                    className="group-hover:opacity-0 mt-1 text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-opacity duration-200"
                  >
                    + {t('xMore', { count: items.length - COLLAPSE_THRESHOLD })}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
