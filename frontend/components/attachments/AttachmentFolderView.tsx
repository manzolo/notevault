'use client';

import { ReactNode, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Attachment, AttachmentFolder } from '@/lib/types';
import AttachmentItem from './AttachmentItem';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Button from '@/components/common/Button';
import {
  ArrowDownTrayIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon,
  PencilIcon,
  PlusIcon,
  SortAlphaIcon,
  TrashIcon,
} from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  CollisionDetection,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

interface Props {
  attachments: Attachment[];
  folders: AttachmentFolder[];
  loading: boolean;
  onPreview: (attachment: Attachment) => void;
  onDownload: (attachment: Attachment) => void;
  onDelete: (id: number) => void;
  onEdit: (attachment: Attachment) => void;
  onArchive?: (id: number, note?: string) => void;
  emlAttachmentsMap?: Record<number, number>;
  onMoveAttachment: (attachmentId: number, folderId: number | null) => Promise<void> | void;
  onCreateFolder: (name: string, parentId: number | null) => Promise<void> | void;
  onRenameFolder: (id: number, name: string) => Promise<void> | void;
  onDeleteFolder: (id: number) => Promise<void> | void;
  onMoveFolder: (id: number, parentId: number | null) => Promise<void> | void;
  onReorderFolders: (items: { id: number; position: number; parent_id?: number | null }[]) => Promise<void> | void;
  onDownloadFolder: (id: number, name: string) => Promise<void> | void;
  onReorder: (items: { id: number; position: number }[]) => Promise<void>;
  setAttachments: (attachments: Attachment[]) => void;
}

function collectIds(folders: AttachmentFolder[], acc: number[] = []): number[] {
  for (const f of folders) {
    acc.push(f.id);
    if (f.children?.length) collectIds(f.children, acc);
  }
  return acc;
}

function getSelfAndDescendantIds(folder: AttachmentFolder): number[] {
  return collectIds([folder]);
}

// Prefer the droppable directly under the pointer (so thin reorder gaps are reliably
// targetable), falling back to closest-center when the pointer is between targets.
const collisionStrategy: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

export default function AttachmentFolderView({
  attachments,
  folders,
  loading,
  onPreview,
  onDownload,
  onDelete,
  onEdit,
  onArchive,
  emlAttachmentsMap,
  onMoveAttachment,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveFolder,
  onReorderFolders,
  onDownloadFolder,
  onReorder,
  setAttachments,
}: Props) {
  const t = useTranslations('attachmentFolders');
  const tAttachments = useTranslations('attachments');
  const { confirm, dialog } = useConfirm();

  // Folders start collapsed (file-manager style); expansion is purely user-driven.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [creatingParentId, setCreatingParentId] = useState<number | null | 'none'>('none');
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  // Temporary, view-only alphabetical sort (does NOT touch the saved manual order)
  const [alphaSort, setAlphaSort] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Display tree: manual order by default, or a temporary alphabetical deep-sort.
  const displayFolders = useMemo(() => {
    if (!alphaSort) return folders;
    const sortRec = (items: AttachmentFolder[]): AttachmentFolder[] =>
      [...items]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ ...f, children: sortRec(f.children ?? []) }));
    return sortRec(folders);
  }, [folders, alphaSort]);

  const byFolder = useMemo(() => {
    const map = new Map<number | null, Attachment[]>();
    for (const att of attachments) {
      const key = att.folder_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(att);
    }
    if (alphaSort) {
      for (const list of map.values()) list.sort((a, b) => a.filename.localeCompare(b.filename));
    }
    return map;
  }, [attachments, alphaSort]);

  const attachmentFolderId = useMemo(() => {
    const m = new Map<number, number | null>();
    for (const att of attachments) m.set(att.id, att.folder_id ?? null);
    return m;
  }, [attachments]);

  // Ordered sibling list per parent + flat id→folder lookup (folders arrive position-sorted)
  const { childrenByParent, folderById } = useMemo(() => {
    const byParent = new Map<number | null, AttachmentFolder[]>();
    const byId = new Map<number, AttachmentFolder>();
    const walk = (items: AttachmentFolder[], parentId: number | null) => {
      byParent.set(parentId, items);
      for (const f of items) {
        byId.set(f.id, f);
        walk(f.children ?? [], f.id);
      }
    };
    walk(folders, null);
    return { childrenByParent: byParent, folderById: byId };
  }, [folders]);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Folder being dragged (id encoded as "folder-{id}")
    if (typeof activeId === 'string' && activeId.startsWith('folder-')) {
      const folderId = Number(activeId.slice('folder-'.length));
      const dragged = folderById.get(folderId);
      if (!dragged) return;

      // Dropped on a gap between siblings → reorder (and reparent if it changed level)
      if (typeof overId === 'string' && overId.startsWith('gap-')) {
        const rest = overId.slice('gap-'.length);
        const lastDash = rest.lastIndexOf('-');
        const parentKey = rest.slice(0, lastDash);
        const insertIdx = Number(rest.slice(lastDash + 1));
        const parentId = parentKey === 'top' ? null : Number(parentKey);

        // Block dropping a folder inside its own subtree
        if (parentId !== null && getSelfAndDescendantIds(dragged).includes(parentId)) return;

        const siblings = childrenByParent.get(parentId) ?? [];
        const fromSameParent = (dragged.parent_id ?? null) === parentId;
        let target = insertIdx;
        if (fromSameParent) {
          const origIdx = siblings.findIndex((f) => f.id === folderId);
          if (origIdx !== -1 && origIdx < insertIdx) target -= 1;
        }
        const without = siblings.filter((f) => f.id !== folderId);
        const newOrder = [...without];
        newOrder.splice(target, 0, dragged);
        await onReorderFolders(newOrder.map((f, idx) => ({ id: f.id, position: idx, parent_id: parentId })));
        return;
      }

      // Dropped on a folder header → nest inside it; on root → move to top level
      let targetParent: number | null;
      if (overId === 'root') {
        targetParent = null;
      } else if (typeof overId === 'string' && overId.startsWith('folder-')) {
        targetParent = Number(overId.slice('folder-'.length));
      } else {
        return;
      }
      if (targetParent === folderId) return;
      await onMoveFolder(folderId, targetParent);
      return;
    }

    // Attachment being dragged (numeric id)
    const attId = Number(activeId);
    const current = attachmentFolderId.get(attId) ?? null;

    // Dropped onto another attachment
    if (typeof overId === 'number' || (typeof overId === 'string' && /^\d+$/.test(overId))) {
      const overAttId = Number(overId);
      if (overAttId === attId) return;
      const overFolder = attachmentFolderId.get(overAttId) ?? null;
      if (overFolder === current) {
        // Same folder → reorder. Reassign positions across the whole note so the
        // global `position` order stays consistent (same contract as the flat list).
        const oldIndex = attachments.findIndex((a) => a.id === attId);
        const newIndex = attachments.findIndex((a) => a.id === overAttId);
        if (oldIndex === -1 || newIndex === -1) return;
        const reordered = arrayMove(attachments, oldIndex, newIndex);
        setAttachments(reordered);
        try {
          await onReorder(reordered.map((item, idx) => ({ id: item.id, position: idx })));
        } catch {
          setAttachments(attachments);
        }
        return;
      }
      // Different folder → move the dragged file into that attachment's folder
      await onMoveAttachment(attId, overFolder);
      return;
    }

    // Dropped onto a folder header or the root drop zone → move (unfile if root)
    let targetFolder: number | null;
    if (overId === 'root') {
      targetFolder = null;
    } else if (typeof overId === 'string' && overId.startsWith('folder-')) {
      targetFolder = Number(overId.slice('folder-'.length));
    } else {
      return;
    }
    if (current === targetFolder) return;
    await onMoveAttachment(attId, targetFolder);
  };

  const submitCreate = async (parentId: number | null) => {
    const name = newName.trim();
    if (!name) {
      setCreatingParentId('none');
      return;
    }
    await onCreateFolder(name, parentId);
    setNewName('');
    setCreatingParentId('none');
  };

  const submitRename = async (id: number) => {
    const name = renameValue.trim();
    if (name) await onRenameFolder(id, name);
    setRenamingId(null);
  };

  const renderAttachments = (list: Attachment[]) =>
    list.map((att) => (
      <AttachmentItem
        key={att.id}
        attachment={att}
        onPreview={onPreview}
        onDownload={onDownload}
        onDelete={onDelete}
        onEdit={onEdit}
        onArchive={onArchive}
        emlAttachmentCount={emlAttachmentsMap?.[att.id] ?? 0}
      />
    ));

  const renderFolder = (folder: AttachmentFolder, depth: number) => {
    const isOpen = expanded.has(folder.id);
    return (
      <FolderNode
        key={folder.id}
        folder={folder}
        depth={depth}
        isOpen={isOpen}
        onToggle={() => toggle(folder.id)}
        invalidDropIds={getSelfAndDescendantIds(folder)}
      >
        {renamingId === folder.id ? (
          <form
            onSubmit={(e) => { e.preventDefault(); submitRename(folder.id); }}
            className="flex-1 flex items-center gap-1"
          >
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => submitRename(folder.id)}
              className="flex-1 text-sm px-1.5 py-0.5 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700"
            />
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => toggle(folder.id)}
              className="flex-1 flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 min-w-0"
            >
              <span className="truncate">{folder.name}</span>
              {folder.attachment_count > 0 && (
                <span className="text-xs text-gray-400 dark:text-gray-500">({folder.attachment_count})</span>
              )}
            </button>
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {(folder.attachment_count > 0 || (folder.children?.length ?? 0) > 0) && (
                <Button size="sm" variant="ghost" title={t('download')} onClick={() => onDownloadFolder(folder.id, folder.name)}>
                  <ArrowDownTrayIcon />
                </Button>
              )}
              <Button size="sm" variant="ghost" title={t('newSubfolder')} onClick={() => { setCreatingParentId(folder.id); setNewName(''); if (!isOpen) toggle(folder.id); }}>
                <PlusIcon />
              </Button>
              <Button size="sm" variant="ghost" title={t('rename')} onClick={() => { setRenamingId(folder.id); setRenameValue(folder.name); }}>
                <PencilIcon />
              </Button>
              <Button
                size="sm"
                variant="ghost-danger"
                title={t('delete')}
                onClick={async () => {
                  if (await confirm(t('deleteConfirm'))) onDeleteFolder(folder.id);
                }}
              >
                <TrashIcon />
              </Button>
            </div>
          </>
        )}
      </FolderNode>
    );
  };

  const renderTree = (items: AttachmentFolder[], depth: number, parentId: number | null): ReactNode => {
    const parentKey = parentId === null ? 'top' : String(parentId);
    return (
      <>
        {!alphaSort && <FolderGap id={`gap-${parentKey}-0`} depth={depth} />}
        {items.map((folder, idx) => {
          const isOpen = expanded.has(folder.id);
          const folderAtts = byFolder.get(folder.id) ?? [];
          return (
            <div key={folder.id}>
              {renderFolder(folder, depth)}
              {isOpen && (
                <div style={{ paddingLeft: 12 + depth * 12 }}>
                  {/* Subfolders first, then this folder's own files */}
                  {folder.children?.length ? renderTree(folder.children, depth + 1, folder.id) : null}
                  {creatingParentId === folder.id && (
                    <CreateInput
                      value={newName}
                      onChange={setNewName}
                      onSubmit={() => submitCreate(folder.id)}
                      onCancel={() => setCreatingParentId('none')}
                      placeholder={t('folderNamePlaceholder')}
                    />
                  )}
                  {renderAttachments(folderAtts)}
                </div>
              )}
              {!alphaSort && <FolderGap id={`gap-${parentKey}-${idx + 1}`} depth={depth} />}
            </div>
          );
        })}
      </>
    );
  };

  if (loading) return <LoadingSpinner />;

  const unfiled = byFolder.get(null) ?? [];

  return (
    <>
      {dialog}
      <DndContext sensors={sensors} collisionDetection={collisionStrategy} onDragEnd={handleDragEnd}>
        <SortableContext items={attachments.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {creatingParentId === null ? (
              <CreateInput
                value={newName}
                onChange={setNewName}
                onSubmit={() => submitCreate(null)}
                onCancel={() => setCreatingParentId('none')}
                placeholder={t('folderNamePlaceholder')}
              />
            ) : (
              <Button size="sm" variant="secondary" onClick={() => { setCreatingParentId(null); setNewName(''); }}>
                <PlusIcon /> <span className="ml-1">{t('newFolder')}</span>
              </Button>
            )}
            <Button
              size="sm"
              variant={alphaSort ? 'secondary' : 'ghost'}
              title={alphaSort ? t('sortManual') : t('sortAlpha')}
              onClick={() => setAlphaSort((v) => !v)}
            >
              <SortAlphaIcon />
              <span className="ml-1 hidden sm:inline">{alphaSort ? t('sortManualShort') : t('sortAlphaShort')}</span>
            </Button>
          </div>

          {/* Folder tree */}
          {renderTree(displayFolders, 0, null)}

          {/* Unfiled drop zone */}
          <RootDropZone>
            <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              {t('unfiled')}
            </p>
            {unfiled.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-2 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded">
                {folders.length === 0 ? tAttachments('noAttachments') : t('dropHere')}
              </p>
            ) : (
              renderAttachments(unfiled)
            )}
          </RootDropZone>
        </SortableContext>
      </DndContext>
    </>
  );
}

/* ---- sub-components ---- */

function FolderGap({ id, depth }: { id: string; depth: number }) {
  const { setNodeRef, isOver, active } = useDroppable({ id });
  const isFolderDrag = typeof active?.id === 'string' && active.id.startsWith('folder-');
  // Collapse to nothing unless a folder is being dragged (keeps the idle UI clean)
  if (!isFolderDrag) return null;
  return (
    <div ref={setNodeRef} style={{ marginLeft: depth * 12 }} className="h-4 flex items-center">
      <div className={`w-full rounded transition-all ${isOver ? 'h-1 bg-indigo-500' : 'h-0.5 bg-indigo-200/60 dark:bg-indigo-800/50'}`} />
    </div>
  );
}

function FolderNode({
  folder,
  depth,
  isOpen,
  onToggle,
  invalidDropIds,
  children,
}: {
  folder: AttachmentFolder;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
  invalidDropIds: number[];
  children: ReactNode;
}) {
  const { setNodeRef: setDropRef, isOver, active } = useDroppable({ id: `folder-${folder.id}` });
  const { setNodeRef: setDragRef, listeners, attributes } = useDraggable({ id: `folder-${folder.id}` });

  // Suppress highlight when dragging a folder onto itself/descendant
  const activeFolderId =
    typeof active?.id === 'string' && active.id.startsWith('folder-')
      ? Number(active.id.slice('folder-'.length))
      : null;
  const invalid = activeFolderId !== null && invalidDropIds.includes(activeFolderId);
  const highlight = isOver && !invalid;

  return (
    <div
      ref={setDropRef}
      style={{ paddingLeft: depth * 12 }}
      className={`group flex items-center gap-1 px-1 py-1.5 rounded transition-colors ${highlight ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300 dark:ring-indigo-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
    >
      <span
        ref={setDragRef}
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 dark:text-gray-600 select-none px-0.5"
        title="Drag to move folder"
      >
        ⠿
      </span>
      <button type="button" onClick={onToggle} className="shrink-0 text-gray-400 dark:text-gray-500">
        <ChevronRightIcon className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <span className="shrink-0 text-indigo-500 dark:text-indigo-400">
        {isOpen ? <FolderOpenIcon className="h-4 w-4" /> : <FolderIcon className="h-4 w-4" />}
      </span>
      {children}
    </div>
  );
}

function RootDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: 'root' });
  const isAttachment = typeof active?.id === 'number';
  const highlight = isOver && isAttachment;
  return (
    <div
      ref={setNodeRef}
      className={`mt-3 pt-2 border-t border-gray-100 dark:border-gray-700 rounded transition-colors ${highlight ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-300 dark:ring-indigo-600' : ''}`}
    >
      {children}
    </div>
  );
}

function CreateInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder: string;
}) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="flex items-center gap-1 my-1"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSubmit}
        onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className="flex-1 text-sm px-2 py-1 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700"
      />
    </form>
  );
}
