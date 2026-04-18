'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { MatchingAttachment, MatchingBookmark, MatchingEvent, MatchingField, MatchingTask, Note } from '@/lib/types';
import { formatRelative, stripMarkdown, truncate } from '@/lib/utils';
import Button from '@/components/common/Button';
import { ArchiveIcon, CalendarIcon, CheckSquareIcon, EyeIcon, FolderIcon, LockClosedIcon, PinIcon, TrashIcon } from '@/components/common/Icons';
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
  matchInTask?: boolean;
  matchingAttachments?: MatchingAttachment[];
  matchingBookmarks?: MatchingBookmark[];
  matchingFields?: MatchingField[];
  matchingEvents?: MatchingEvent[];
  matchingTasks?: MatchingTask[];
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

export default function NoteCard({ note, onDelete, onPin, onArchive, categoryName, matchInAttachment, matchInBookmark, matchInFields, matchInEvent, matchInTask, matchingAttachments, matchingBookmarks, matchingFields, matchingEvents, matchingTasks, onPreviewAttachment }: NoteCardProps) {
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
        className="group bg-white dark:bg-vault-800 rounded-xl shadow-card hover:shadow-card-hover transition-[box-shadow,border-color] duration-200 border border-cream-300/60 dark:border-vault-600/50 border-l-2 border-l-violet-400/50 dark:border-l-violet-500/60 hover:border-l-violet-500 dark:hover:border-l-violet-400 p-4 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 min-w-0">
              {note.is_pinned && (
                <span className="text-violet-600 dark:text-violet-400 text-xs font-semibold shrink-0 font-mono tracking-wide">⬆ {t('pinned')}</span>
              )}
              {note.is_archived && (
                <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 border border-amber-200/60 dark:border-amber-500/20">{t('archived')}</span>
              )}
              <Link
                href={`/${locale}/notes/${note.id}`}
                className="font-display text-gray-900 dark:text-vault-50 font-semibold hover:text-violet-700 dark:hover:text-violet-300 truncate min-w-0 tracking-tight transition-colors duration-150"
              >
                {note.title}
              </Link>
            </div>
            <p className="text-sm text-gray-500 dark:text-vault-300 mb-2 leading-relaxed">{truncate(stripMarkdown(note.content), 120)}</p>
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
              {note.tags.map((tag) => (
                <span key={tag.id} className="bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs px-2 py-0.5 rounded-full border border-violet-200/60 dark:border-violet-500/20">
                  {tag.name}
                </span>
              ))}
              {categoryName && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-500/20">
                  <FolderIcon className="w-3 h-3" />
                  {categoryName}
                </span>
              )}
              <span className="font-mono text-xs text-gray-400 dark:text-vault-400 tabular-nums">{formatRelative(note.updated_at, locale)}</span>
              <DateInfoTooltip createdAt={note.created_at} updatedAt={note.updated_at} />
            </div>

            {/* Content badges */}
            {(() => {
              const badges = [
                { count: note.attachment_count, icon: <PaperclipIcon />, label: (n: number) => t('badgeAttachments', { count: n }) },
                { count: note.task_count,        icon: <CheckSquareIcon className="w-3 h-3" />, label: (n: number) => t('badgeTasks', { count: n }) },
                { count: note.event_count,       icon: <CalendarIcon className="w-3 h-3" />,    label: (n: number) => t('badgeEvents', { count: n }) },
                { count: note.secret_count,      icon: <LockClosedIcon className="w-3 h-3" />,  label: (n: number) => t('badgeSecrets', { count: n }) },
              ].filter(b => (b.count ?? 0) > 0);
              if (badges.length === 0) return null;
              return (
                <div className="flex items-center gap-3 mt-1.5">
                  {badges.map(({ count, icon, label }, i) => (
                    <span
                      key={i}
                      title={label(count!)}
                      className="flex items-center gap-1 text-gray-400 dark:text-vault-500 hover:text-gray-600 dark:hover:text-vault-300 transition-colors cursor-default select-none"
                    >
                      {icon}
                      <span className="text-[10px] tabular-nums">{count}</span>
                    </span>
                  ))}
                </div>
              );
            })()}

            {(matchInAttachment || matchInBookmark || matchInFields || matchInEvent || matchInTask) && (
              <div className="mt-2 flex flex-col gap-1.5">
                {matchInAttachment && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <PaperclipIcon />
                    {matchingAttachments && matchingAttachments.length > 0 ? (
                      matchingAttachments.map((att) => (
                        <span
                          key={att.id}
                          className="inline-flex items-center gap-1 bg-cream-200/80 dark:bg-vault-700/60 text-gray-700 dark:text-vault-200 px-1.5 py-0.5 rounded text-xs border border-cream-300/60 dark:border-vault-600/40"
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
                      <span className="bg-cream-200/80 dark:bg-vault-700/60 text-gray-600 dark:text-vault-200 px-1.5 py-0.5 rounded text-xs border border-cream-300/60 dark:border-vault-600/40">
                        {tSearch('foundInAttachment')}
                      </span>
                    )}
                  </div>
                )}
                {matchInBookmark && (
                  <div className="flex items-start gap-1 text-xs text-gray-500 dark:text-vault-400">
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
                            className="bg-cream-200/80 dark:bg-vault-700/60 text-violet-600 dark:text-violet-400 hover:underline px-1.5 py-0.5 rounded truncate max-w-[200px] border border-cream-300/60 dark:border-vault-600/40"
                          >
                            {bm.title || bm.url}
                          </a>
                        ))}
                      </span>
                    ) : (
                      <span className="bg-cream-200/80 dark:bg-vault-700/60 text-gray-600 dark:text-vault-200 px-1.5 py-0.5 rounded border border-cream-300/60 dark:border-vault-600/40">
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
                {matchInTask && (
                  <div className="flex items-start gap-1.5 flex-wrap">
                    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    {matchingTasks && matchingTasks.length > 0 ? (
                      <span className="flex flex-wrap gap-1">
                        {matchingTasks.map((tk) => (
                          <span
                            key={tk.id}
                            className={`bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-xs ${tk.is_done ? 'line-through text-emerald-400 dark:text-emerald-600' : 'text-emerald-700 dark:text-emerald-300'}`}
                          >
                            {tk.title}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded text-xs">
                        {tSearch('foundInTask')}
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
                className={note.is_pinned ? 'text-violet-600 dark:text-violet-400' : 'text-gray-400 dark:text-vault-500'}
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
                className={note.is_archived ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-vault-500'}
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
