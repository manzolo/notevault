'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { MatchingAttachment, MatchingBookmark, MatchingEvent, MatchingField, Note } from '@/lib/types';
import { formatRelative, stripMarkdown, truncate } from '@/lib/utils';
import Button from '@/components/common/Button';
import { ArchiveIcon, EyeIcon, FolderIcon, PinIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';

const INLINE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'message/rfc822', 'application/zip',
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/xml',
  'application/json', 'application/xml',
]);

interface NoteCardProps {
  note: Note;
  onDelete: (id: number) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onArchive?: (id: number, archived: boolean) => void;
  categoryName?: string;
  matchInAttachment?: boolean;
  matchInBookmark?: boolean;
  matchInFields?: boolean;
  matchInEvent?: boolean;
  matchingAttachments?: MatchingAttachment[];
  matchingBookmarks?: MatchingBookmark[];
  matchingFields?: MatchingField[];
  matchingEvents?: MatchingEvent[];
  onPreviewAttachment?: (noteId: number, attachment: MatchingAttachment) => void;
}

function PaperclipIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}

export default function NoteCard({ note, onDelete, onPin, onArchive, categoryName, matchInAttachment, matchInBookmark, matchInFields, matchInEvent, matchingAttachments, matchingBookmarks, matchingFields, matchingEvents, onPreviewAttachment }: NoteCardProps) {
  const locale = useLocale();
  const t = useTranslations('notes');
  const tSearch = useTranslations('search');
  const tAtt = useTranslations('attachments');
  const { confirm, dialog } = useConfirm();

  const handleDelete = async () => {
    if (await confirm(t('deleteConfirm'))) onDelete(note.id);
  };

  const handlePin = () => {
    onPin?.(note.id, !note.is_pinned);
  };

  const handleArchive = () => {
    onArchive?.(note.id, !note.is_archived);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', note.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <>
      {dialog}
      <div
        draggable
        onDragStart={handleDragStart}
        className="group bg-white dark:bg-gray-800 rounded-xl shadow-card hover:shadow-card-hover transition-shadow border border-gray-200 dark:border-gray-700 p-4 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              {note.is_pinned && (
                <span className="text-indigo-600 text-xs font-medium shrink-0">📌 {t('pinned')}</span>
              )}
              {note.is_archived && (
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded font-medium shrink-0">🗄 {t('archived')}</span>
              )}
              <Link
                href={`/${locale}/notes/${note.id}`}
                className="text-gray-900 dark:text-gray-100 font-semibold hover:text-indigo-600 dark:hover:text-indigo-400 truncate min-w-0"
              >
                {note.title}
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{truncate(stripMarkdown(note.content), 120)}</p>
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
              {note.tags.map((tag) => (
                <span key={tag.id} className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full">
                  {tag.name}
                </span>
              ))}
              {categoryName && (
                <span className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                  <FolderIcon className="w-3 h-3" />
                  {categoryName}
                </span>
              )}
              <span className="text-xs text-gray-400">{formatRelative(note.updated_at)}</span>
              <DateInfoTooltip createdAt={note.created_at} updatedAt={note.updated_at} />
            </div>

            {(matchInAttachment || matchInBookmark || matchInFields || matchInEvent) && (
              <div className="mt-2 flex flex-col gap-1.5">
                {matchInAttachment && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <PaperclipIcon />
                    {matchingAttachments && matchingAttachments.length > 0 ? (
                      matchingAttachments.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded text-xs"
                        >
                          <span className="truncate max-w-[120px] sm:max-w-[200px]">{att.filename}</span>
                          {INLINE_MIMES.has(att.mime_type) && onPreviewAttachment && (
                            <button
                              onClick={() => onPreviewAttachment(note.id, att)}
                              className="inline-flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap ml-0.5"
                            >
                              <EyeIcon className="h-3 w-3" />
                              {tAtt('preview')}
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded text-xs">
                        {tSearch('foundInAttachment')}
                      </span>
                    )}
                  </div>
                )}
                {matchInBookmark && (
                  <div className="flex items-start gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <GlobeIcon />
                    {matchingBookmarks && matchingBookmarks.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {matchingBookmarks.map((bm) => (
                          <a
                            key={bm.id}
                            href={bm.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-gray-100 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 hover:underline px-1.5 py-0.5 rounded truncate max-w-[200px]"
                          >
                            {bm.title || bm.url}
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded">
                        {tSearch('foundInBookmark')}
                      </span>
                    )}
                  </div>
                )}
                {matchInFields && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <svg className="h-3.5 w-3.5 shrink-0 text-indigo-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {matchingFields && matchingFields.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {matchingFields.map((fld) => (
                          <span
                            key={fld.id}
                            className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-xs"
                            title={`${fld.group_name} › ${fld.key}`}
                          >
                            <span className="font-medium">{fld.key}</span>
                            {fld.value && <span className="text-indigo-400 dark:text-indigo-500 mx-0.5">→</span>}
                            {fld.value && <span className="font-mono">{fld.value}</span>}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded text-xs">
                        {tSearch('foundInFields')}
                      </span>
                    )}
                  </div>
                )}
                {matchInEvent && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <svg className="h-3.5 w-3.5 shrink-0 text-violet-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {matchingEvents && matchingEvents.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {matchingEvents.map((ev) => (
                          <span
                            key={ev.id}
                            className="bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded text-xs"
                            title={new Date(ev.start_datetime).toLocaleString()}
                          >
                            <span className="font-medium">{ev.title}</span>
                            <span className="ml-1 text-violet-400 dark:text-violet-500 font-normal">
                              {new Date(ev.start_datetime).toLocaleDateString()}
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded text-xs">
                        {tSearch('foundInEvent')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onPin && (
              <Button
                variant="ghost"
                size="sm"
                title={note.is_pinned ? t('unpin') : t('pin')}
                onClick={handlePin}
                className={note.is_pinned ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}
              >
                <PinIcon filled={note.is_pinned} />
              </Button>
            )}
            {onArchive && (
              <Button
                variant="ghost"
                size="sm"
                title={note.is_archived ? t('unarchive') : t('archive')}
                onClick={handleArchive}
                className={note.is_archived ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}
              >
                <ArchiveIcon />
              </Button>
            )}
            <Button variant="ghost-danger" size="sm" title={t('delete')} onClick={handleDelete}>
              <TrashIcon />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
