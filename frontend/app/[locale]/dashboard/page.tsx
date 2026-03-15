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
import FolderSelector from '@/components/folders/FolderSelector';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/common/Button';
import { PlusIcon } from '@/components/common/Icons';
import api from '@/lib/api';
import { MatchingAttachment, SearchResponse } from '@/lib/types';
import { dateToLocalStart, dateToLocalEnd } from '@/lib/utils';
import AttachmentPreviewModal from '@/components/attachments/AttachmentPreviewModal';

export default function DashboardPage() {
  const t = useTranslations('notes');
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
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [attachPreview, setAttachPreview] = useState<{ noteId: number; attachment: MatchingAttachment } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
      fetchNotes(page, PER_PAGE, selectedTagId, after, before, selectedCategoryId, pinnedOnly, archivedOnly, undefined, recursive).then(() => {});
    }
  }, [user, page, selectedTagId, dateFrom, dateTo, selectedCategoryId, pinnedOnly, archivedOnly, recursive]);

  const handleTagSelect = (tagId: number | null) => {
    setSelectedTagId(tagId);
    setPage(1);
  };

  const handleCategorySelect = (categoryId: number | null) => {
    setSelectedCategoryId(categoryId);
    if (categoryId === null) setRecursive(false);
    setPage(1);
  };

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t('myNotes')}</h1>
        <Link href={`/${locale}/notes/new`}>
          <Button variant="secondary"><PlusIcon />{t('newNote')}</Button>
        </Link>
      </div>

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

      {!searchResults && (
        <div className="mb-4 flex flex-col gap-2">
          <FolderSelector
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelect={handleCategorySelect}
            onCreateCategory={createCategory}
            onUpdateCategory={updateCategory}
            onDeleteCategory={deleteCategory}
            onRefresh={fetchCategories}
            isDragging={isDragging}
            onDropNote={async (noteId, categoryId) => {
              await updateNote(noteId, { category_id: categoryId });
              const after = dateFrom ? dateToLocalStart(dateFrom) : undefined;
              const before = dateTo ? dateToLocalEnd(dateTo) : undefined;
              fetchNotes(page, PER_PAGE, selectedTagId, after, before, selectedCategoryId, pinnedOnly, archivedOnly, undefined, recursive);
              fetchCategories();
            }}
          />
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
