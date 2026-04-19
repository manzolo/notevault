'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { useNoteFields } from '@/hooks/useNoteFields';
import { useConfirm } from '@/hooks/useConfirm';
import { NoteField } from '@/lib/types';

// ---------------------------------------------------------------------------
// Image field cell — paste zone + thumbnail preview
// ---------------------------------------------------------------------------

interface ImageFieldCellProps {
  value: string | null | undefined;
  onSave: (dataUrl: string | null) => void;
}

function ImageFieldCell({ value, onSave }: ImageFieldCellProps) {
  const t = useTranslations('fields');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [awaitingPaste, setAwaitingPaste] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Cancel awaiting-paste mode on Escape or outside click
  useEffect(() => {
    if (!awaitingPaste) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAwaitingPaste(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (zoneRef.current && !zoneRef.current.contains(e.target as Node)) {
        setAwaitingPaste(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [awaitingPaste]);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const saveFile = async (file: File) => {
    try {
      const dataUrl = await fileToDataUrl(file);
      onSave(dataUrl);
    } catch {
      toast.error('Failed to read image');
    }
  };

  const extractImage = (clipboardData: DataTransfer | null): File | null => {
    if (!clipboardData) return null;
    for (const item of Array.from(clipboardData.items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        return item.getAsFile();
      }
    }
    return null;
  };

  // Enter awaiting-paste mode: focus zone so the next Ctrl+V is captured
  // by onPaste natively — no browser permission dialog involved.
  const enterAwaitingPaste = () => {
    setMenuOpen(false);
    setAwaitingPaste(true);
    setTimeout(() => zoneRef.current?.focus(), 0);
  };

  const browseFile = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleClick = () => {
    if (awaitingPaste) { setAwaitingPaste(false); return; }
    setMenuOpen((v) => !v);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = extractImage(e.clipboardData);
    if (!file) return;
    e.stopPropagation();
    e.preventDefault();
    setAwaitingPaste(false);
    await saveFile(file);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { setAwaitingPaste(false); setMenuOpen(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await saveFile(file);
    e.target.value = '';
  };

  if (value) {
    return (
      <>
        <div className="flex items-center gap-1.5">
          {/* Thumbnail + eye */}
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            title={t('imagePreview')}
            className="flex items-center gap-1 group/img"
          >
            <img
              src={value}
              alt="field"
              className="h-6 w-10 object-cover rounded border border-gray-300 dark:border-gray-600 group-hover/img:opacity-80 transition-opacity"
            />
            <svg className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {/* Delete */}
          <button
            type="button"
            onClick={() => onSave(null)}
            title={t('imageDelete')}
            className="text-gray-300 hover:text-red-400 text-xs leading-none flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* Lightbox */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <div className="relative max-w-3xl max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
              <img
                src={value}
                alt="preview"
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl"
              />
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-600 text-sm font-bold"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative inline-flex">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Paste zone */}
      <div
        ref={zoneRef}
        tabIndex={0}
        role="button"
        data-image-paste-zone="true"
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        title={awaitingPaste ? t('imageAwaitingPaste') : t('imagePasteHint')}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded border border-dashed text-xs cursor-pointer focus:outline-none transition-colors select-none
          ${awaitingPaste
            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 animate-pulse bg-indigo-50 dark:bg-indigo-900/20'
            : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-indigo-400 hover:text-indigo-500 focus:border-indigo-500 focus:text-indigo-600'
          }`}
      >
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{awaitingPaste ? 'Ctrl+V' : 'img'}</span>
      </div>

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden text-xs min-w-[140px]"
        >
          <button
            type="button"
            onClick={enterAwaitingPaste}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {t('imagePasteAction')}
          </button>
          <button
            type="button"
            onClick={browseFile}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
            {t('imageBrowseAction')}
          </button>
        </div>
      )}
    </div>
  );
}

interface NoteFieldsPanelProps {
  noteId: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupFields(fields: NoteField[]): { groupName: string; fields: NoteField[] }[] {
  const map = new Map<string, NoteField[]>();
  for (const f of fields) {
    const g = f.group_name ?? '';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(f);
  }
  return Array.from(map.entries()).map(([groupName, flds]) => ({ groupName, fields: flds }));
}

// ---------------------------------------------------------------------------
// Inline editable cell (text)
// ---------------------------------------------------------------------------

interface EditableCellProps {
  value: string;
  placeholder?: string;
  onSave: (v: string) => void;
  className?: string;
  multiline?: boolean;
}

function EditableCell({ value, placeholder, onSave, className = '', multiline = false }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
    setEditing(false);
    setDraft(trimmed || value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  };

  if (editing) {
    const sharedProps = {
      ref: inputRef as React.RefObject<any>,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: handleKeyDown,
      className: `w-full bg-white dark:bg-gray-800 border border-indigo-400 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 ${className}`,
      placeholder,
    };
    return multiline
      ? <textarea rows={2} {...sharedProps} />
      : <input type="text" {...sharedProps} />;
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => { setDraft(value); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setDraft(value); setEditing(true); } }}
      className={`cursor-text block px-2 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm min-h-[1.75rem] ${value ? '' : 'text-gray-400 dark:text-gray-500 italic'} ${className}`}
    >
      {value || placeholder}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline date input
// ---------------------------------------------------------------------------

interface EditableDateProps {
  value: string | null | undefined;
  placeholder?: string;
  onSave: (v: string | null) => void;
}

function formatLocalDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: '2-digit', year: 'numeric' });
}

function EditableDate({ value, placeholder, onSave }: EditableDateProps) {
  const locale = useLocale();
  const t = useTranslations('fields');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== (value ?? '')) onSave(trimmed || null);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } if (e.key === 'Enter') commit(); }}
        className="bg-white dark:bg-gray-800 border border-indigo-400 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      onKeyDown={(e) => { if (e.key === 'Enter') { setDraft(value ?? ''); setEditing(true); } }}
      className={`cursor-text text-xs px-1.5 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1 ${value ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-400 dark:text-gray-500 italic'}`}
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span>{value ? formatLocalDate(value, locale) : (placeholder ?? t('datePlaceholder'))}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Field row
// ---------------------------------------------------------------------------

interface FieldRowProps {
  field: NoteField;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (id: number, patch: Partial<NoteField>) => void;
  onDelete: (id: number) => void;
  onMoveUp: (id: number) => void;
  onMoveDown: (id: number) => void;
}

function FieldRow({ field, isFirst, isLast, onUpdate, onDelete, onMoveUp, onMoveDown }: FieldRowProps) {
  const t = useTranslations('fields');

  return (
    <div className="group/row py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
      {/* Main row: key → value + actions */}
      <div className="flex items-start gap-1">
        <div className="w-2/5 min-w-0">
          <EditableCell
            value={field.key}
            placeholder={t('keyPlaceholder')}
            onSave={(v) => onUpdate(field.id, { key: v })}
            className="font-medium text-gray-700 dark:text-gray-300"
          />
        </div>
        <span className="text-gray-300 dark:text-gray-600 self-center flex-shrink-0 text-sm">→</span>
        <div className="flex-1 min-w-0">
          <EditableCell
            value={field.value}
            placeholder={t('valuePlaceholder')}
            onSave={(v) => onUpdate(field.id, { value: v })}
            className="text-gray-600 dark:text-gray-400 font-mono"
          />
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0">
          <button type="button" onClick={() => onMoveUp(field.id)} disabled={isFirst} title="Su"
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button type="button" onClick={() => onMoveDown(field.id)} disabled={isLast} title="Giù"
            className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-20 disabled:cursor-not-allowed">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button type="button" onClick={() => onDelete(field.id)} title={t('deleteFieldConfirm')}
            className="p-0.5 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      {/* Sub-row: note + metadata */}
      <div className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/50 space-y-1 pl-1">
        {/* Note — full width */}
        <div className="flex items-start gap-1.5">
          <svg className="w-3 h-3 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <EditableCell value={field.field_note ?? ''} placeholder={t('notePlaceholder')}
            onSave={(v) => onUpdate(field.id, { field_note: v || null })}
            className="text-xs text-gray-500 dark:text-gray-400 flex-1" />
        </div>

        {/* Date | Link | Price | Image — 2-column grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {/* Date */}
          <div className="flex items-center min-w-0">
            <EditableDate
              value={field.field_date}
              onSave={(v) => onUpdate(field.id, { field_date: v })}
            />
          </div>

          {/* Link */}
          <div className="flex items-center gap-1 min-w-0">
            <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {field.link ? (
              <span className="flex items-center gap-1 min-w-0">
                <a href={field.link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                  onClick={(e) => e.stopPropagation()}>
                  {field.link.replace(/^https?:\/\//, '').split('/')[0]}
                </a>
                <button type="button" onClick={() => onUpdate(field.id, { link: null })}
                  className="text-gray-300 hover:text-red-400 text-xs leading-none flex-shrink-0">×</button>
              </span>
            ) : (
              <EditableCell value="" placeholder={t('linkPlaceholder')}
                onSave={(v) => onUpdate(field.id, { link: v || null })}
                className="text-xs text-gray-400 dark:text-gray-500" />
            )}
          </div>

          {/* Price */}
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-green-600 dark:text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <EditableCell value={field.price ?? ''} placeholder={t('pricePlaceholder')}
              onSave={(v) => onUpdate(field.id, { price: v || null })}
              className="text-xs text-green-700 dark:text-green-400 w-20" />
          </div>

          {/* Image */}
          <div className="flex items-center">
            <ImageFieldCell
              value={field.field_image}
              onSave={(v) => onUpdate(field.id, { field_image: v })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group block
// ---------------------------------------------------------------------------

interface GroupBlockProps {
  groupName: string;
  fields: NoteField[];
  onRenameGroup: (oldName: string, newName: string) => void;
  onDeleteGroup: (groupName: string) => void;
  onAddField: (groupName: string) => void;
  onUpdateField: (id: number, patch: Partial<NoteField>) => void;
  onDeleteField: (id: number) => void;
  onMoveFieldUp: (id: number, groupName: string) => void;
  onMoveFieldDown: (id: number, groupName: string) => void;
}

function GroupBlock({
  groupName, fields,
  onRenameGroup, onDeleteGroup, onAddField,
  onUpdateField, onDeleteField, onMoveFieldUp, onMoveFieldDown,
}: GroupBlockProps) {
  const t = useTranslations('fields');
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-3">
      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        <div className="flex-1 min-w-0">
          <EditableCell value={groupName} placeholder={t('groupNamePlaceholder')}
            onSave={(v) => v !== groupName && onRenameGroup(groupName, v)}
            className="font-semibold text-gray-800 dark:text-gray-200 text-sm" />
        </div>
        <button type="button" onClick={() => onAddField(groupName)}
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 px-1.5 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex-shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          {t('addField')}
        </button>
        <button type="button" onClick={() => onDeleteGroup(groupName)} title={t('deleteGroupConfirm')}
          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
      <div className="px-3 py-1 bg-white dark:bg-gray-900/40">
        {fields.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic py-2">{t('addField')} →</p>
        )}
        {fields.map((f, idx) => (
          <FieldRow key={f.id} field={f}
            isFirst={idx === 0} isLast={idx === fields.length - 1}
            onUpdate={onUpdateField} onDelete={onDeleteField}
            onMoveUp={() => onMoveFieldUp(f.id, groupName)}
            onMoveDown={() => onMoveFieldDown(f.id, groupName)} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function NoteFieldsPanel({ noteId }: NoteFieldsPanelProps) {
  const t = useTranslations('fields');
  const { fields, loading, fetchFields, createField, updateField, deleteField, reorderFields } = useNoteFields(noteId);
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const fetchedRef = useRef(false);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    if (!fetchedRef.current) { fetchedRef.current = true; fetchFields(); }
  }, [fetchFields]);

  // Auto-expand when the initial fetch transitions loading: true → false and fields exist
  useEffect(() => {
    if (prevLoadingRef.current && !loading && fields.length > 0) setExpanded(true);
    prevLoadingRef.current = loading;
  }, [loading, fields.length]);

  const groups = useMemo(() => groupFields(fields), [fields]);
  const totalFields = fields.length;

  const handleAddGroup = useCallback(async () => {
    const newGroupName = `${t('groupNamePlaceholder')} ${groups.length + 1}`;
    const nextPosition = fields.length > 0 ? Math.max(...fields.map((f) => f.position)) + 1 : 0;
    try { await createField({ group_name: newGroupName, key: t('keyPlaceholder'), value: '', position: nextPosition }); }
    catch { toast.error('Error adding group'); }
  }, [createField, fields, groups.length, t]);

  const handleRenameGroup = useCallback(async (oldName: string, newName: string) => {
    const gFields = fields.filter((f) => f.group_name === oldName);
    try { await Promise.all(gFields.map((f) => updateField(f.id, { group_name: newName }))); }
    catch { toast.error('Error renaming group'); }
  }, [fields, updateField]);

  const handleDeleteGroup = useCallback(async (groupName: string) => {
    const gFields = fields.filter((f) => f.group_name === groupName);
    if (!await confirm(t('deleteGroupConfirm'))) return;
    try { await Promise.all(gFields.map((f) => deleteField(f.id))); }
    catch { toast.error('Error deleting group'); }
  }, [confirm, deleteField, fields, t]);

  const handleAddField = useCallback(async (groupName: string) => {
    const gFields = fields.filter((f) => f.group_name === groupName);
    const nextPosition = gFields.length > 0 ? Math.max(...gFields.map((f) => f.position)) + 1 : fields.length;
    try { await createField({ group_name: groupName, key: t('keyPlaceholder'), value: '', position: nextPosition }); }
    catch { toast.error('Error adding field'); }
  }, [createField, fields, t]);

  const handleUpdateField = useCallback(async (id: number, patch: Partial<NoteField>) => {
    try { await updateField(id, patch); }
    catch { toast.error('Error saving field'); }
  }, [updateField]);

  const handleDeleteField = useCallback(async (id: number) => {
    if (!await confirm(t('deleteFieldConfirm'))) return;
    try { await deleteField(id); }
    catch { toast.error('Error deleting field'); }
  }, [confirm, deleteField, t]);

  const handleMoveFieldUp = useCallback(async (id: number, groupName: string) => {
    const gFields = fields.filter((f) => f.group_name === groupName);
    const idx = gFields.findIndex((f) => f.id === id);
    if (idx <= 0) return;
    const prev = gFields[idx - 1]; const curr = gFields[idx];
    try { await reorderFields([{ id: curr.id, position: prev.position }, { id: prev.id, position: curr.position }]); await fetchFields(); }
    catch { toast.error('Error reordering'); }
  }, [fetchFields, fields, reorderFields]);

  const handleMoveFieldDown = useCallback(async (id: number, groupName: string) => {
    const gFields = fields.filter((f) => f.group_name === groupName);
    const idx = gFields.findIndex((f) => f.id === id);
    if (idx < 0 || idx >= gFields.length - 1) return;
    const next = gFields[idx + 1]; const curr = gFields[idx];
    try { await reorderFields([{ id: curr.id, position: next.position }, { id: next.id, position: curr.position }]); await fetchFields(); }
    catch { toast.error('Error reordering'); }
  }, [fetchFields, fields, reorderFields]);

  return (
    <div className="mt-0 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
      {confirmDialog}
      <button type="button" onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
        <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-200 flex-1">
          {t('panelTitle')}
          {!expanded && totalFields > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({groups.length} {groups.length === 1 ? 'gruppo' : 'gruppi'}, {totalFields} {totalFields === 1 ? 'campo' : 'campi'})
            </span>
          )}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="p-4 bg-white dark:bg-gray-900/30">
          {loading && <p className="text-sm text-gray-400 py-2">Loading…</p>}
          {!loading && groups.length === 0 && (
            <p className="text-sm text-gray-400 italic py-2">{t('emptyState')}</p>
          )}
          {!loading && groups.map(({ groupName, fields: gFields }) => (
            <GroupBlock key={groupName} groupName={groupName} fields={gFields}
              onRenameGroup={handleRenameGroup} onDeleteGroup={handleDeleteGroup}
              onAddField={handleAddField} onUpdateField={handleUpdateField}
              onDeleteField={handleDeleteField} onMoveFieldUp={handleMoveFieldUp}
              onMoveFieldDown={handleMoveFieldDown} />
          ))}
          <button type="button" onClick={handleAddGroup}
            className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors mt-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            {t('addGroup')}
          </button>
        </div>
      )}
    </div>
  );
}
