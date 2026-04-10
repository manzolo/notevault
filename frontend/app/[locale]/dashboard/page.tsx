'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import { useCategories } from '@/hooks/useCategories';
import NoteList from '@/components/notes/NoteList';
import AdvancedFiltersPanel from '@/components/notes/AdvancedFiltersPanel';
import SearchBar from '@/components/search/SearchBar';
import FolderTree from '@/components/folders/FolderTree';
import MiniCalendar from '@/components/calendar/MiniCalendar';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/common/Button';
import { PlusIcon, FolderIcon, CalendarIcon, ChevronDownIcon } from '@/components/common/Icons';
import api from '@/lib/api';
import { MatchingAttachment, SearchResponse } from '@/lib/types';
import { dateToLocalStart, dateToLocalEnd } from '@/lib/utils';
import AttachmentPreviewModal from '@/components/attachments/AttachmentPreviewModal';

export default function DashboardPage() {
  const t = useTranslations('notes');
  const tFolders = useTranslations('folders');
  const tCalendar = useTranslations('calendar');
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { notes, total, loading, fetchNotes, deleteNote, updateNote } = useNotes();
  const { tags, fetchTags } = useTags();
  const { categories, fetchCategories, createCategory, updateCategory, deleteCategory } = useCategories();
  const [page, setPage] = useState(1);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [recursive, setRecursive] = useState(false);
  // When true, skip the category filter entirely (show notes from all folders)
  const [bypassCategoryFilter, setBypassCategoryFilter] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [attachPreview, setAttachPreview] = useState<{ noteId: number; attachment: MatchingAttachment } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Mobile sidebar accordion state
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [mobileCalendarOpen, setMobileCalendarOpen] = useState(false);

  // Selected day for mini calendar (single-day date filter)
  const selectedCalendarDay =
    dateFrom && dateTo && dateFrom === dateTo ? dateFrom : null;

  const PER_PAGE = 20;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [user, authLoading, locale, router]);

  useEffect(() => {
    if (user) {
      fetchTags();
      fetchCategories();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const after = dateFrom ? dateToLocalStart(dateFrom) : undefined;
      const before = dateTo ? dateToLocalEnd(dateTo) : undefined;
      // bypassCategoryFilter: pass undefined so useNotes skips unfiled filter (shows all folders)
      const catId = bypassCategoryFilter ? undefined : selectedCategoryId;
      fetchNotes(page, PER_PAGE, selectedTagId, after, before, catId, pinnedOnly, archivedOnly, undefined, recursive).then(() => {});
    }
  }, [user, page, selectedTagId, dateFrom, dateTo, selectedCategoryId, pinnedOnly, archivedOnly, recursive, bypassCategoryFilter]);

  const handleTagSelect = (tagId: number | null) => {
    setSelectedTagId(tagId);
    setPage(1);
  };

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
    setBypassCategoryFilter(false);
    if (categoryId === null) setRecursive(false);
    setPage(1);
  };

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };

  const handleCalendarDayClick = (date: string | null) => {
    if (!date) {
      setBypassCategoryFilter(false);
      handleDateChange('', '');
    } else {
      // Bypass folder filter so the date search spans all folders
      setBypassCategoryFilter(true);
      setSelectedCategoryId(null);
      setRecursive(false);
      handleDateChange(date, date);
    }
  };

  const doSearch = async (query: string, pg: number) => {
    if (!query) return;
    const response = await api.get<SearchResponse>(
      `/api/search?q=${encodeURIComponent(query)}&page=${pg}&per_page=20`
    );
    setSearchResults(response.data);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSearchPage(1);
    await doSearch(query, 1);
  };

  const handleSearchPageChange = async (pg: number) => {
    setSearchPage(pg);
    await doSearch(searchQuery, pg);
  };

  const handleDelete = async (id: number) => {
    await deleteNote(id);
    const after = dateFrom ? dateToLocalStart(dateFrom) : undefined;
    const before = dateTo ? dateToLocalEnd(dateTo) : undefined;
    fetchNotes(page, PER_PAGE, selectedTagId, after, before, selectedCategoryId, pinnedOnly, archivedOnly, undefined, recursive);
  };

  const handlePin = async (id: number, pinned: boolean) => {
    await updateNote(id, { is_pinned: pinned });
    if (searchQuery) {
      await doSearch(searchQuery, searchPage);
    } else {
      const after = dateFrom ? dateToLocalStart(dateFrom) : undefined;
      const before = dateTo ? dateToLocalEnd(dateTo) : undefined;
      fetchNotes(page, PER_PAGE, selectedTagId, after, before, selectedCategoryId, pinnedOnly, archivedOnly, undefined, recursive);
    }
  };

  const handleArchive = async (id: number, archived: boolean) => {
    await updateNote(id, { is_archived: archived });
    if (searchQuery) {
      await doSearch(searchQuery, searchPage);
    } else {
      const after = dateFrom ? dateToLocalStart(dateFrom) : undefined;
      const before = dateTo ? dateToLocalEnd(dateTo) : undefined;
      fetchNotes(page, PER_PAGE, selectedTagId, after, before, selectedCategoryId, pinnedOnly, archivedOnly, undefined, recursive);
    }
  };

  const handlePinnedOnlyToggle = () => {
    setPinnedOnly((prev) => !prev);
    setPage(1);
  };

  const handleArchivedOnlyToggle = () => {
    setArchivedOnly((prev) => !prev);
    setPage(1);
  };

  const handleRecursiveToggle = () => {
    setRecursive((prev) => !prev);
    setPage(1);
  };

  const handlePreviewAttachment = (noteId: number, att: MatchingAttachment) => {
    setAttachPreview({ noteId, attachment: att });
  };

  const handleCloseAttachPreview = () => {
    setAttachPreview(null);
  };

  if (authLoading) return null;
  if (!user) return null;

  const displayNotes = searchResults ? searchResults.items : notes;
  const displayLoading = loading && !searchResults;

  const matchMap = searchResults
    ? new Map(
        searchResults.items.map((item) => [
          item.id,
          { attachment: item.match_in_attachment ?? false, bookmark: item.match_in_bookmark ?? false },
        ])
      )
    : undefined;

  const matchingAttachmentsMap = searchResults
    ? new Map(searchResults.items.map((item) => [item.id, item.matching_attachments ?? []]))
    : undefined;

  const matchingBookmarksMap = searchResults
    ? new Map(searchResults.items.map((item) => [item.id, item.matching_bookmarks ?? []]))
    : undefined;

  const folderTreeProps = {
    categories,
    selectedCategoryId,
    recursive,
    onSelect: handleCategorySelect,
    onRecursiveToggle: handleRecursiveToggle,
    onCreateCategory: createCategory,
    onUpdateCategory: updateCategory,
    onDeleteCategory: deleteCategory,
    onRefresh: fetchCategories,
    isDragging,
    onDropNote: async (noteId: number, categoryId: number | null) => {
      await updateNote(noteId, { category_id: categoryId });
      const after = dateFrom ? dateToLocalStart(dateFrom) : undefined;
      const before = dateTo ? dateToLocalEnd(dateTo) : undefined;
      fetchNotes(page, PER_PAGE, selectedTagId, after, before, selectedCategoryId, pinnedOnly, archivedOnly, undefined, recursive);
      fetchCategories();
    },
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-5 items-start">
      {/* ── Desktop sidebar (md+) ── */}
      <aside className="hidden md:flex flex-col gap-4 w-52 lg:w-60 shrink-0 sticky top-4 self-start">
        {/* Folders panel */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <FolderIcon className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {tFolders('folders')}
            </span>
          </div>
          <FolderTree {...folderTreeProps} />
        </div>

        {/* Calendar panel */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarIcon className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {tCalendar('title')}
            </span>
          </div>
          <MiniCalendar
            selectedDate={selectedCalendarDay}
            onDayClick={handleCalendarDayClick}
          />
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t('myNotes')}
          </h1>
          <Link href={`/${locale}/notes/new`}>
            <Button variant="secondary"><PlusIcon />{t('newNote')}</Button>
          </Link>
        </div>

        {/* Search */}
        <div className="mb-4">
          <SearchBar onSearch={handleSearch} />
          {searchResults && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2">
              <p className="text-sm text-indigo-700 dark:text-indigo-300">
                {searchResults.total} results for &ldquo;{searchResults.query}&rdquo;
              </p>
              <button
                onClick={() => { setSearchResults(null); setSearchQuery(''); setSearchPage(1); }}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear search
              </button>
            </div>
          )}
        </div>

        {/* ── Mobile accordions (hidden on md+) ── */}
        {!searchResults && (
          <div className="md:hidden flex flex-col gap-2 mb-4">
            {/* Folders accordion */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                onClick={() => setMobileFoldersOpen((v) => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <FolderIcon className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{tFolders('folders')}</span>
                  {selectedCategoryId !== null && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  )}
                </span>
                <ChevronDownIcon
                  className={`w-4 h-4 text-gray-400 transition-transform ${mobileFoldersOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mobileFoldersOpen && (
                <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                  <FolderTree {...folderTreeProps} />
                </div>
              )}
            </div>

            {/* Calendar accordion */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                onClick={() => setMobileCalendarOpen((v) => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{tCalendar('title')}</span>
                  {selectedCalendarDay && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                  )}
                </span>
                <ChevronDownIcon
                  className={`w-4 h-4 text-gray-400 transition-transform ${mobileCalendarOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {mobileCalendarOpen && (
                <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700 pt-2">
                  <MiniCalendar
                    selectedDate={selectedCalendarDay}
                    onDayClick={handleCalendarDayClick}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        {!searchResults && (
          <div className="mb-4">
            <AdvancedFiltersPanel
              tags={tags}
              selectedTagId={selectedTagId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              pinnedOnly={pinnedOnly}
              archivedOnly={archivedOnly}
              recursive={recursive}
              onTagSelect={handleTagSelect}
              onDateChange={handleDateChange}
              onPinnedOnlyToggle={handlePinnedOnlyToggle}
              onArchivedOnlyToggle={handleArchivedOnlyToggle}
              onRecursiveToggle={handleRecursiveToggle}
            />
          </div>
        )}

        {/* Note list */}
        <div
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => setIsDragging(false)}
        >
          <NoteList
            notes={displayNotes}
            loading={displayLoading}
            onDelete={handleDelete}
            onPin={handlePin}
            onArchive={handleArchive}
            categories={categories}
            filterActive={!searchResults}
            matchMap={matchMap}
            matchingAttachmentsMap={matchingAttachmentsMap}
            matchingBookmarksMap={matchingBookmarksMap}
            onPreviewAttachment={handlePreviewAttachment}
          />
        </div>

        {searchResults ? (
          <Pagination page={searchPage} pages={searchResults.pages} onPageChange={handleSearchPageChange} />
        ) : (
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        )}
      </div>

      {attachPreview && (
        <AttachmentPreviewModal
          noteId={attachPreview.noteId}
          attachment={attachPreview.attachment}
          onClose={handleCloseAttachPreview}
        />
      )}
    </div>
  );
}
