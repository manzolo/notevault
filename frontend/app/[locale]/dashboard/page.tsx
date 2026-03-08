'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { useTags } from '@/hooks/useTags';
import NoteList from '@/components/notes/NoteList';
import SearchBar from '@/components/search/SearchBar';
import TagFilter from '@/components/search/TagFilter';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/common/Button';
import { PlusIcon } from '@/components/common/Icons';
import api from '@/lib/api';
import { MatchingAttachment, SearchResponse } from '@/lib/types';

export default function DashboardPage() {
  const t = useTranslations('notes');
  const locale = useLocale();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { notes, total, loading, fetchNotes, deleteNote } = useNotes();
  const { tags, fetchTags } = useTags();
  const [page, setPage] = useState(1);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [attachPreview, setAttachPreview] = useState<{ url: string; filename: string; mime_type: string } | null>(null);

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
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const after = dateFrom ? `${dateFrom}T00:00:00` : undefined;
      const before = dateTo ? `${dateTo}T23:59:59` : undefined;
      fetchNotes(page, PER_PAGE, selectedTagId, after, before).then(() => {});
    }
  }, [user, page, selectedTagId, dateFrom, dateTo]);

  const handleTagSelect = (tagId: number | null) => {
    setSelectedTagId(tagId);
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
    fetchNotes(page, PER_PAGE, selectedTagId);
  };

  const handlePreviewAttachment = async (noteId: number, att: MatchingAttachment) => {
    try {
      const response = await api.get(`/api/notes/${noteId}/attachments/${att.id}/stream`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data as Blob);
      setAttachPreview({ url, filename: att.filename, mime_type: att.mime_type });
    } catch {
      // silently ignore
    }
  };

  const handleCloseAttachPreview = () => {
    if (attachPreview) URL.revokeObjectURL(attachPreview.url);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{t('myNotes')}</h1>
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
          {tags.length > 0 && (
            <TagFilter tags={tags} selectedTagId={selectedTagId} onSelect={handleTagSelect} />
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{t('filterByDate')}:</span>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('dateFrom')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateChange(e.target.value, dateTo)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                           bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                           focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 dark:text-gray-400">{t('dateTo')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateChange(dateFrom, e.target.value)}
                className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1
                           bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
                           focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => handleDateChange('', '')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('clearDate')}
              </button>
            )}
          </div>
        </div>
      )}

      <NoteList
        notes={displayNotes}
        loading={displayLoading}
        onDelete={handleDelete}
        matchMap={matchMap}
        matchingAttachmentsMap={matchingAttachmentsMap}
        onPreviewAttachment={handlePreviewAttachment}
      />

      {searchResults ? (
        <Pagination page={searchPage} pages={searchResults.pages} onPageChange={handleSearchPageChange} />
      ) : (
        <Pagination page={page} pages={pages} onPageChange={setPage} />
      )}

      {attachPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={handleCloseAttachPreview}>
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{attachPreview.filename}</span>
              <button onClick={handleCloseAttachPreview} className="ml-4 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-gray-50">
              {attachPreview.mime_type === 'application/pdf' ? (
                <iframe src={attachPreview.url} className="w-full h-[70vh] rounded" title={attachPreview.filename} />
              ) : (
                <img src={attachPreview.url} alt={attachPreview.filename} className="max-w-full max-h-[70vh] object-contain rounded" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
