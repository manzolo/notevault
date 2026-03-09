'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Category } from '@/lib/types';
import {
  FolderIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';

interface FolderSelectorProps {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelect: (id: number | null) => void;
  onCreateCategory: (name: string, parentId?: number | null) => Promise<Category>;
  onUpdateCategory: (id: number, data: { name?: string; parent_id?: number | null }) => Promise<Category>;
  onDeleteCategory: (id: number) => Promise<void>;
  onRefresh: () => void;
  onDropNote?: (noteId: number, categoryId: number | null) => Promise<void>;
  isDragging?: boolean;
}

function findCategoryById(cats: Category[], id: number): Category | null {
  for (const cat of cats) {
    if (cat.id === id) return cat;
    const found = findCategoryById(cat.children ?? [], id);
    if (found) return found;
  }
  return null;
}

function getPathTo(cats: Category[], targetId: number): Category[] {
  for (const cat of cats) {
    if (cat.id === targetId) return [cat];
    const sub = getPathTo(cat.children ?? [], targetId);
    if (sub.length > 0) return [cat, ...sub];
  }
  return [];
}

interface FlatCategory {
  category: Category;
  pathLabel: string; // e.g. "Work > Projects > Frontend"
}

function flattenWithPath(cats: Category[], prefix = ''): FlatCategory[] {
  const result: FlatCategory[] = [];
  for (const cat of cats) {
    const pathLabel = prefix ? `${prefix} > ${cat.name}` : cat.name;
    result.push({ category: cat, pathLabel });
    if (cat.children?.length) result.push(...flattenWithPath(cat.children, pathLabel));
  }
  return result;
}

export default function FolderSelector({
  categories,
  selectedCategoryId,
  onSelect,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onRefresh,
  onDropNote,
  isDragging = false,
}: FolderSelectorProps) {
  const t = useTranslations('folders');
  const [open, setOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<'root' | number | null>(null);
  const { confirm, dialog } = useConfirm();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auto-open dropdown when a drag starts; close when drag ends
  useEffect(() => {
    if (isDragging && !open) {
      setOpen(true);
      setAutoOpened(true);
    } else if (!isDragging && autoOpened) {
      setOpen(false);
      setAutoOpened(false);
      setDropTarget(null);
    }
  }, [isDragging]);

  // Autofocus search input when dropdown opens (not during drag)
  useEffect(() => {
    if (open && !isDragging) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (!open) setSearch('');
  }, [open, isDragging]);

  // Close dropdown when clicking outside (skip during drag to avoid accidental close)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isDragging) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const currentFolder = selectedCategoryId ? findCategoryById(categories, selectedCategoryId) : null;
  const currentSubfolders = currentFolder ? (currentFolder.children ?? []) : categories;
  const path = selectedCategoryId ? getPathTo(categories, selectedCategoryId) : [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateError(null);
    try {
      await onCreateCategory(newName.trim(), selectedCategoryId);
      setNewName('');
      setCreating(false);
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Error creating folder';
      setCreateError(msg);
    }
  };

  const handleRename = async (e: React.FormEvent, folderId: number) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    setRenameError(null);
    try {
      await onUpdateCategory(folderId, { name: renameValue.trim() });
      setRenamingId(null);
      onRefresh();
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Error renaming folder';
      setRenameError(msg);
    }
  };

  const handleDelete = async (folder: Category) => {
    const ok = await confirm(t('deleteConfirm'));
    if (!ok) return;
    await onDeleteCategory(folder.id);
    if (selectedCategoryId === folder.id) onSelect(null);
    onRefresh();
  };

  const handleDragOver = (e: React.DragEvent, target: 'root' | number) => {
    if (!onDropNote) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = async (e: React.DragEvent, categoryId: number | null) => {
    if (!onDropNote) return;
    e.preventDefault();
    setDropTarget(null);
    setAutoOpened(false);
    setOpen(false);
    const noteId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(noteId)) await onDropNote(noteId, categoryId);
  };

  return (
    <div className="relative mb-3" ref={dropdownRef}>
      {/* Breadcrumb bar — also a drop target for current folder */}
      <div
        className={`flex items-center gap-1 px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg cursor-pointer transition-colors ${
          dropTarget === (selectedCategoryId ?? 'root')
            ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-300 dark:ring-indigo-700'
            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500'
        }`}
        onClick={() => setOpen(!open)}
        onDragOver={(e) => handleDragOver(e, selectedCategoryId ?? 'root')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, selectedCategoryId)}
      >
        <FolderOpenIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
        <div className="flex items-center gap-1 flex-1 min-w-0 ml-1">
          {path.length === 0 ? (
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('allNotes')}</span>
          ) : (
            path.map((seg, i) => (
              <span key={seg.id} className="flex items-center gap-1 min-w-0">
                {i > 0 && <ChevronRightIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{seg.name}</span>
              </span>
            ))
          )}
        </div>
        <ChevronRightIcon
          className={`w-3 h-3 ml-1 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 flex flex-col max-h-72">
          {/* Search input — hidden during drag */}
          {!isDragging && (
            <div className="px-2 py-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchFolders')}
                className="w-full text-sm px-2 py-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          )}

          {/* Flat search results (when typing) */}
          {search.trim() && (
            <div className="overflow-y-auto">
              {flattenWithPath(categories).filter(({ pathLabel }) =>
                pathLabel.toLowerCase().includes(search.trim().toLowerCase())
              ).length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">{t('noResults')}</p>
              ) : (
                flattenWithPath(categories)
                  .filter(({ pathLabel }) => pathLabel.toLowerCase().includes(search.trim().toLowerCase()))
                  .map(({ category, pathLabel }) => (
                    <button
                      key={category.id}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                        selectedCategoryId === category.id
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
                      }`}
                      onClick={() => { onSelect(category.id); setOpen(false); }}
                    >
                      <FolderIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      <span className="truncate flex-1">{pathLabel}</span>
                      {category.note_count > 0 && (
                        <span className="shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">{category.note_count}📄</span>
                      )}
                      {(category.children?.length ?? 0) > 0 && (
                        <span className="shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded">{category.children.length}📁</span>
                      )}
                    </button>
                  ))
              )}
            </div>
          )}

          {/* Level navigation (when not searching) */}
          {!search.trim() && (
          <div className="overflow-y-auto">
          {/* All Notes option — drop target to unfile */}
          <button
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              dropTarget === 'root'
                ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300 dark:ring-indigo-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            } ${selectedCategoryId === null ? 'font-medium text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-200'}`}
            onClick={() => { onSelect(null); setOpen(false); }}
            onDragOver={(e) => handleDragOver(e, 'root')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, null)}
          >
            {t('allNotes')}
          </button>

          {/* Up option if inside a folder — also a drop target for parent */}
          {currentFolder && (
            <button
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-1 ${
                dropTarget === (currentFolder.parent_id ?? 'root')
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300 dark:ring-indigo-600 text-gray-700 dark:text-gray-200'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => { onSelect(currentFolder.parent_id); setOpen(false); }}
              onDragOver={(e) => handleDragOver(e, currentFolder.parent_id ?? 'root')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, currentFolder.parent_id)}
            >
              <span className="mr-1">↑</span>
              {path.length > 1 ? path[path.length - 2].name : t('allNotes')}
            </button>
          )}

          {/* Subfolders list */}
          {currentSubfolders.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700">
              {currentSubfolders.map((folder) => (
                <div
                  key={folder.id}
                  className={`flex items-center group px-3 py-2 transition-colors ${
                    dropTarget === folder.id
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300 dark:ring-indigo-600'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  onDragOver={(e) => handleDragOver(e, folder.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, folder.id)}
                >
                  {renamingId === folder.id ? (
                    <form
                      className="flex flex-col flex-1 gap-0.5"
                      onSubmit={(e) => handleRename(e, folder.id)}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                          value={renameValue}
                          onChange={(e) => { setRenameValue(e.target.value); setRenameError(null); }}
                        />
                        <button type="submit" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-1">OK</button>
                        <button
                          type="button"
                          className="text-xs text-gray-400 hover:text-gray-600 px-1"
                          onClick={() => { setRenamingId(null); setRenameError(null); }}
                        >
                          ✕
                        </button>
                      </div>
                      {renameError && <p className="text-xs text-red-500">{renameError}</p>}
                    </form>
                  ) : (
                    <>
                      <FolderIcon className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
                      <button
                        className="flex-1 text-left text-sm text-gray-700 dark:text-gray-200 truncate flex items-center gap-1.5 min-w-0"
                        onClick={() => { onSelect(folder.id); setOpen(false); }}
                      >
                        <span className="truncate">{folder.name}</span>
                        {folder.note_count > 0 && (
                          <span className="shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded" title={`${folder.note_count} note`}>
                            {folder.note_count}📄
                          </span>
                        )}
                        {(folder.children?.length ?? 0) > 0 && (
                          <span className="shrink-0 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 rounded" title={`${folder.children.length} sottocartelle`}>
                            {folder.children.length}📁
                          </span>
                        )}
                      </button>
                      <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                        <button
                          className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                          title={t('rename')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(folder.id);
                            setRenameValue(folder.name);
                          }}
                        >
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                          title={t('deleteFolder')}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(folder);
                          }}
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
          )} {/* end level navigation */}

          {/* Create new folder inline — only shown when not searching */}
          {!search.trim() && <div className="border-t border-gray-100 dark:border-gray-700 shrink-0">
            {creating ? (
              <form className="flex flex-col px-3 py-2 gap-1" onSubmit={handleCreate}>
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <input
                    autoFocus
                    className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder={t('newFolder')}
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setCreateError(null); }}
                  />
                  <button type="submit" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">OK</button>
                  <button
                    type="button"
                    className="text-xs text-gray-400 hover:text-gray-600"
                    onClick={() => { setCreating(false); setNewName(''); setCreateError(null); }}
                  >
                    ✕
                  </button>
                </div>
                {createError && <p className="text-xs text-red-500 ml-6">{createError}</p>}
              </form>
            ) : (
              <button
                className="w-full text-left px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                onClick={() => setCreating(true)}
              >
                <PlusIcon className="w-3 h-3" />
                {selectedCategoryId ? t('newSubfolder') : t('newFolder')}
              </button>
            )}
          </div>}
        </div>
      )}

      {dialog}
    </div>
  );
}
