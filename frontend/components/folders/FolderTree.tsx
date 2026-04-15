'use client';

import { useState, useEffect } from 'react';
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

interface FolderTreeProps {
  categories: Category[];
  selectedCategoryId: number | null;
  recursive: boolean;
  onSelect: (id: number | null) => void;
  onRecursiveToggle: () => void;
  onCreateCategory: (name: string, parentId?: number | null) => Promise<Category>;
  onUpdateCategory: (id: number, data: { name?: string; parent_id?: number | null }) => Promise<Category>;
  onDeleteCategory: (id: number) => Promise<void>;
  onRefresh: () => void;
  onDropNote?: (noteId: number, categoryId: number | null) => Promise<void>;
  isDragging?: boolean;
}

// Returns ancestor IDs path to targetId, or null if not found
function findAncestors(cats: Category[], targetId: number, path: number[] = []): number[] | null {
  for (const cat of cats) {
    if (cat.id === targetId) return path;
    const result = findAncestors(cat.children ?? [], targetId, [...path, cat.id]);
    if (result !== null) return result;
  }
  return null;
}

// Returns the set of IDs of a folder and all its descendants (used to prevent circular drag-drop)
function getSelfAndDescendantIds(cats: Category[], rootId: number): Set<number> {
  const result = new Set<number>();
  function collect(list: Category[]) {
    for (const c of list) {
      result.add(c.id);
      collect(c.children ?? []);
    }
  }
  function find(list: Category[]): boolean {
    for (const c of list) {
      if (c.id === rootId) { collect([c]); return true; }
      if (find(c.children ?? [])) return true;
    }
    return false;
  }
  find(cats);
  return result;
}

interface TreeNodeProps {
  category: Category;
  depth: number;
  selectedId: number | null;
  expandedIds: Set<number>;
  dropTarget: number | 'root' | null;
  isDragging: boolean;
  renamingId: number | null;
  renameValue: string;
  renameError: string | null;
  creatingParentId: number | null;
  newChildName: string;
  createError: string | null;
  onToggleExpand: (id: number) => void;
  onSelect: (id: number) => void;
  onStartRename: (cat: Category) => void;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (e: React.FormEvent, id: number) => void;
  onRenameCancel: () => void;
  onStartCreate: (parentId: number) => void;
  onNewChildNameChange: (v: string) => void;
  onCreateChildSubmit: (e: React.FormEvent) => void;
  onCreateChildCancel: () => void;
  onDelete: (cat: Category) => void;
  onDragOver: (e: React.DragEvent, target: number | 'root') => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, categoryId: number | null) => void;
  draggingFolderId: number | null;
  invalidFolderDropIds: Set<number>;
  onFolderDragStart: (e: React.DragEvent, id: number) => void;
  onFolderDragEnd: () => void;
}

function TreeNode({
  category,
  depth,
  selectedId,
  expandedIds,
  dropTarget,
  isDragging,
  renamingId,
  renameValue,
  renameError,
  creatingParentId,
  newChildName,
  createError,
  onToggleExpand,
  onSelect,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onStartCreate,
  onNewChildNameChange,
  onCreateChildSubmit,
  onCreateChildCancel,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
  draggingFolderId,
  invalidFolderDropIds,
  onFolderDragStart,
  onFolderDragEnd,
}: TreeNodeProps) {
  const hasChildren = (category.children?.length ?? 0) > 0 || creatingParentId === category.id;
  const isExpanded = expandedIds.has(category.id);
  const isSelected = selectedId === category.id;
  const isDropTarget = dropTarget === category.id;
  const isFolderBeingDragged = draggingFolderId === category.id;
  const isInvalidDrop = draggingFolderId !== null && invalidFolderDropIds.has(category.id);

  return (
    <div>
      <div
        className={`flex items-center group rounded-md transition-colors ${
          isFolderBeingDragged
            ? 'opacity-40'
            : isSelected
            ? 'bg-indigo-50 dark:bg-indigo-900/30'
            : isDropTarget && !isInvalidDrop
            ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
        draggable={renamingId !== category.id}
        onDragStart={(e) => onFolderDragStart(e, category.id)}
        onDragEnd={onFolderDragEnd}
        onDragOver={(e) => onDragOver(e, category.id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, category.id)}
      >
        {/* Expand/collapse chevron */}
        <button
          className="p-1 shrink-0"
          onClick={() => {
            if ((category.children?.length ?? 0) > 0) onToggleExpand(category.id);
          }}
        >
          <ChevronRightIcon
            className={`w-3 h-3 transition-transform ${
              (category.children?.length ?? 0) > 0
                ? isExpanded
                  ? 'rotate-90 text-gray-500 dark:text-gray-400'
                  : 'text-gray-400 dark:text-gray-500'
                : 'opacity-0'
            }`}
          />
        </button>

        {/* Folder icon */}
        {isSelected ? (
          <FolderOpenIcon className="w-4 h-4 text-yellow-500 shrink-0 mr-1" />
        ) : (
          <FolderIcon className="w-4 h-4 text-yellow-500 shrink-0 mr-1" />
        )}

        {/* Name or rename form */}
        {renamingId === category.id ? (
          <form
            className="flex flex-col flex-1 py-0.5 pr-1 gap-0.5"
            onSubmit={(e) => onRenameSubmit(e, category.id)}
          >
            <div className="flex items-center gap-1">
              <input
                autoFocus
                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                value={renameValue}
                onChange={(e) => onRenameChange(e.target.value)}
              />
              <button type="submit" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-1">OK</button>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={onRenameCancel}
              >✕</button>
            </div>
            {renameError && <p className="text-xs text-red-500">{renameError}</p>}
          </form>
        ) : (
          <>
            <button
              className="flex-1 text-left py-1.5 pr-1 min-w-0"
              onClick={() => onSelect(category.id)}
            >
              <span
                className={`text-xs truncate block ${
                  isSelected
                    ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                {category.name}
              </span>
            </button>
            {category.note_count > 0 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mr-1">
                {category.note_count}
              </span>
            )}
            <div className="hidden group-hover:flex items-center gap-0 shrink-0 pr-0.5">
              <button
                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                onClick={(e) => { e.stopPropagation(); onStartCreate(category.id); if (!isExpanded) onToggleExpand(category.id); }}
                title="Add subfolder"
              >
                <PlusIcon className="w-3 h-3" />
              </button>
              <button
                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
                onClick={(e) => { e.stopPropagation(); onStartRename(category); }}
                title="Rename"
              >
                <PencilIcon className="w-3 h-3" />
              </button>
              <button
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
                onClick={(e) => { e.stopPropagation(); onDelete(category); }}
                title="Delete"
              >
                <TrashIcon className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Children */}
      {isExpanded && (
        <div>
          {(category.children ?? []).map((child) => (
            <TreeNode
              key={child.id}
              category={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              dropTarget={dropTarget}
              isDragging={isDragging}
              renamingId={renamingId}
              renameValue={renameValue}
              renameError={renameError}
              creatingParentId={creatingParentId}
              newChildName={newChildName}
              createError={createError}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onStartRename={onStartRename}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onStartCreate={onStartCreate}
              onNewChildNameChange={onNewChildNameChange}
              onCreateChildSubmit={onCreateChildSubmit}
              onCreateChildCancel={onCreateChildCancel}
              onDelete={onDelete}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              draggingFolderId={draggingFolderId}
              invalidFolderDropIds={invalidFolderDropIds}
              onFolderDragStart={onFolderDragStart}
              onFolderDragEnd={onFolderDragEnd}
            />
          ))}

          {/* Inline child creation form */}
          {creatingParentId === category.id && (
            <form
              className="flex flex-col gap-0.5 py-1 pr-1"
              style={{ paddingLeft: `${4 + (depth + 1) * 14 + 20}px` }}
              onSubmit={onCreateChildSubmit}
            >
              <div className="flex items-center gap-1">
                <FolderIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <input
                  autoFocus
                  className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="Folder name"
                  value={newChildName}
                  onChange={(e) => onNewChildNameChange(e.target.value)}
                />
                <button type="submit" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-1">OK</button>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600"
                  onClick={onCreateChildCancel}
                >✕</button>
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  categories,
  selectedCategoryId,
  recursive,
  onSelect,
  onRecursiveToggle,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onRefresh,
  onDropNote,
  isDragging = false,
}: FolderTreeProps) {
  const t = useTranslations('folders');
  const tn = useTranslations('notes');
  const { confirm, dialog } = useConfirm();

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [dropTarget, setDropTarget] = useState<number | 'root' | null>(null);
  const [draggingFolderId, setDraggingFolderId] = useState<number | null>(null);
  const [invalidFolderDropIds, setInvalidFolderDropIds] = useState<Set<number>>(new Set());

  // Rename state
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  // Create child state
  const [creatingParentId, setCreatingParentId] = useState<number | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Create root state
  const [creatingRoot, setCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');
  const [createRootError, setCreateRootError] = useState<string | null>(null);

  // Auto-expand ancestors of selected category
  useEffect(() => {
    if (selectedCategoryId !== null) {
      const ancestors = findAncestors(categories, selectedCategoryId);
      if (ancestors && ancestors.length > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev);
          ancestors.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [selectedCategoryId, categories]);

  const handleToggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelect = (id: number) => {
    if (selectedCategoryId === id) {
      onSelect(null); // deselect
    } else {
      onSelect(id);
    }
  };

  const handleStartRename = (cat: Category) => {
    setRenamingId(cat.id);
    setRenameValue(cat.name);
    setRenameError(null);
  };

  const handleRenameSubmit = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (!renameValue.trim()) return;
    setRenameError(null);
    try {
      await onUpdateCategory(id, { name: renameValue.trim() });
      setRenamingId(null);
      onRefresh();
    } catch (err: any) {
      setRenameError(err?.response?.data?.detail ?? 'Error renaming folder');
    }
  };

  const handleDelete = async (cat: Category) => {
    const ok = await confirm(t('deleteConfirm'));
    if (!ok) return;
    await onDeleteCategory(cat.id);
    if (selectedCategoryId === cat.id) onSelect(null);
    onRefresh();
  };

  const handleStartCreate = (parentId: number) => {
    setCreatingParentId(parentId);
    setNewChildName('');
    setCreateError(null);
    setCreatingRoot(false);
  };

  const handleCreateChildSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || creatingParentId === null) return;
    setCreateError(null);
    try {
      await onCreateCategory(newChildName.trim(), creatingParentId);
      setCreatingParentId(null);
      setNewChildName('');
      onRefresh();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail ?? 'Error creating folder');
    }
  };

  const handleCreateRootSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRootName.trim()) return;
    setCreateRootError(null);
    try {
      await onCreateCategory(newRootName.trim(), null);
      setCreatingRoot(false);
      setNewRootName('');
      onRefresh();
    } catch (err: any) {
      setCreateRootError(err?.response?.data?.detail ?? 'Error creating folder');
    }
  };

  const handleFolderDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('folder-id', id.toString());
    e.dataTransfer.effectAllowed = 'move';
    const invalid = getSelfAndDescendantIds(categories, id);
    setDraggingFolderId(id);
    setInvalidFolderDropIds(invalid);
  };

  const handleFolderDragEnd = () => {
    setDraggingFolderId(null);
    setInvalidFolderDropIds(new Set());
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, target: number | 'root') => {
    // Accept folder drags always; accept note drags only when onDropNote provided
    const isDraggingFolder = draggingFolderId !== null;
    const targetId = target === 'root' ? null : target;
    if (isDraggingFolder) {
      if (targetId !== null && invalidFolderDropIds.has(targetId)) return; // can't drop into self/descendant
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTarget(target);
      return;
    }
    if (!onDropNote) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  };

  const handleDragLeave = () => setDropTarget(null);

  const handleDrop = async (e: React.DragEvent, categoryId: number | null) => {
    e.preventDefault();
    setDropTarget(null);

    // Handle folder-into-folder drop
    const folderIdStr = e.dataTransfer.getData('folder-id');
    if (folderIdStr) {
      const folderId = parseInt(folderIdStr, 10);
      if (!isNaN(folderId) && folderId !== categoryId && !invalidFolderDropIds.has(categoryId ?? -1)) {
        try {
          await onUpdateCategory(folderId, { parent_id: categoryId });
          onRefresh();
        } catch { /* ignore */ }
      }
      handleFolderDragEnd();
      return;
    }

    // Handle note-into-folder drop
    if (!onDropNote) return;
    const noteId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(noteId)) await onDropNote(noteId, categoryId);
  };

  const sharedNodeProps = {
    selectedId: selectedCategoryId,
    expandedIds,
    dropTarget,
    isDragging,
    renamingId,
    renameValue,
    renameError,
    creatingParentId,
    newChildName,
    createError,
    onToggleExpand: handleToggleExpand,
    onSelect: handleSelect,
    onStartRename: handleStartRename,
    onRenameChange: setRenameValue,
    onRenameSubmit: handleRenameSubmit,
    onRenameCancel: () => { setRenamingId(null); setRenameError(null); },
    onStartCreate: handleStartCreate,
    onNewChildNameChange: setNewChildName,
    onCreateChildSubmit: handleCreateChildSubmit,
    onCreateChildCancel: () => { setCreatingParentId(null); setCreateError(null); },
    onDelete: handleDelete,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    draggingFolderId,
    invalidFolderDropIds,
    onFolderDragStart: handleFolderDragStart,
    onFolderDragEnd: handleFolderDragEnd,
  };

  return (
    <div className="select-none">
      {/* "All Notes" root item */}
      <div
        className={`flex items-center rounded-md transition-colors px-1 ${
          selectedCategoryId === null
            ? 'bg-indigo-50 dark:bg-indigo-900/30'
            : dropTarget === 'root'
            ? 'bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        }`}
        onDragOver={(e) => handleDragOver(e, 'root')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <span className="w-5 shrink-0" />
        <FolderOpenIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0 mr-1" />
        <button
          className="flex-1 text-left py-1.5"
          onClick={() => onSelect(null)}
        >
          <span
            className={`text-xs ${
              selectedCategoryId === null
                ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {t('allNotes')}
          </span>
        </button>
      </div>

      {/* Tree */}
      <div className="mt-0.5">
        {categories.map((cat) => (
          <TreeNode key={cat.id} category={cat} depth={0} {...sharedNodeProps} />
        ))}

        {/* Root create form */}
        {creatingRoot && (
          <form
            className="flex flex-col gap-0.5 py-1 px-1"
            onSubmit={handleCreateRootSubmit}
          >
            <div className="flex items-center gap-1 pl-5">
              <FolderIcon className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <input
                autoFocus
                className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-1 py-0.5 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder={t('newFolder')}
                value={newRootName}
                onChange={(e) => { setNewRootName(e.target.value); setCreateRootError(null); }}
              />
              <button type="submit" className="text-xs text-indigo-600 dark:text-indigo-400 font-medium px-1">OK</button>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => { setCreatingRoot(false); setNewRootName(''); setCreateRootError(null); }}
              >✕</button>
            </div>
            {createRootError && <p className="text-xs text-red-500 pl-6">{createRootError}</p>}
          </form>
        )}
      </div>

      {/* Add root folder button */}
      {!creatingRoot && (
        <button
          className="mt-1 flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-1 py-1 w-full rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          onClick={() => { setCreatingRoot(true); setCreatingParentId(null); }}
        >
          <PlusIcon className="w-3 h-3" />
          {t('newFolder')}
        </button>
      )}

      {/* Recursive toggle (shown when a folder is selected) */}
      {selectedCategoryId !== null && (
        <label className="flex items-center gap-1.5 mt-2 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={recursive}
            onChange={onRecursiveToggle}
            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 w-3 h-3"
          />
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{tn('includeSubfolders')}</span>
        </label>
      )}

      {dialog}
    </div>
  );
}
