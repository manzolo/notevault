'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import { copyToClipboard } from '@/lib/utils';
import Button from '@/components/common/Button';
import { ArchiveIcon, ClipboardCheckIcon, ClipboardIcon, EyeIcon, EyeOffIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';
import TotpLiveWidget from './TotpLiveWidget';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Color per tipo segreto
const TYPE_COLORS: Record<string, string> = {
  password: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  token:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ssh_key:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  totp_seed:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amberald-300',
  keystore: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cls}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

function MonoBox({ children, maxH = 'max-h-24' }: { children: React.ReactNode; maxH?: string }) {
  return (
    <div className={`bg-gray-950/5 dark:bg-black/30 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all ${maxH} overflow-y-auto leading-relaxed`}>
      {children}
    </div>
  );
}

function KeystoreValueDisplay({ value }: { value: string }) {
  const tokens = value.trim().split(/[\s\n]+/);
  const pairs = tokens.map(token => {
    const eqIdx = token.indexOf('=');
    if (eqIdx === -1) return null;
    return [token.slice(0, eqIdx), token.slice(eqIdx + 1)] as [string, string];
  });
  const allParsed = pairs.length > 0 && pairs.every(p => p !== null);

  if (allParsed) {
    return (
      <div className="bg-gray-950/5 dark:bg-black/30 border border-gray-200 dark:border-gray-600 rounded-md px-3 py-2 max-h-36 overflow-y-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {(pairs as [string, string][]).map(([k, v], i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                <td className="text-blue-600 dark:text-blue-400 pr-2 py-0.5 whitespace-nowrap align-top select-all">{k}</td>
                <td className="text-gray-400 py-0.5 pr-2">=</td>
                <td className="text-gray-900 dark:text-gray-100 py-0.5 break-all select-all">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <MonoBox>{value}</MonoBox>;
}

interface SecretViewerProps {
  secret: Secret;
  revealed?: SecretReveal;
  countdownSeconds?: number;
  onReveal: () => void;
  onHide: () => void;
  onDelete: () => void;
  onArchive?: (note?: string) => void;
  onCopyDirect?: () => Promise<void>;
}

export default function SecretViewer({
  secret, revealed, countdownSeconds, onReveal, onHide, onDelete, onArchive, onCopyDirect,
}: SecretViewerProps) {
  const t = useTranslations('secrets');
  const tc = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const [copiedPub, setCopiedPub] = useState(false);
  const { confirm, confirmInput, dialog } = useConfirm();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: secret.id });

  const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const markCopiedPub = () => { setCopiedPub(true); setTimeout(() => setCopiedPub(false), 2000); };

  const handleCopy = async (value: string) => { await copyToClipboard(value); markCopied(); };
  const handleCopyDirect = async () => { if (!onCopyDirect) return; await onCopyDirect(); markCopied(); };
  const handleCopyPub = async () => { if (!secret.public_key) return; await copyToClipboard(secret.public_key); markCopiedPub(); };
  const handleDelete = async () => { if (await confirm(t('deleteConfirm'))) onDelete(); };
  const handleArchive = async () => {
    if (!onArchive) return;
    const { confirmed, value } = await confirmInput(tc('archiveConfirm'), {
      confirmLabel: tc('archive'),
      confirmVariant: 'secondary',
      inputLabel: tc('archiveReason'),
    });
    if (confirmed) onArchive(value || undefined);
  };

  return (
    <>
      {dialog}
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
        className="border border-gray-200 dark:border-gray-700 border-l-2 border-l-indigo-400 dark:border-l-indigo-500 rounded-lg bg-white dark:bg-gray-800/60 hover:bg-gray-50/80 dark:hover:bg-gray-800/80 transition-colors"
      >
        {/* Header row */}
        <div className="flex items-start gap-2 px-3 pt-2.5 pb-2">
          {/* Drag handle */}
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 dark:text-gray-600 dark:hover:text-gray-500 shrink-0 select-none pt-0.5"
            title="Drag to reorder"
          >⠿</span>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Name + badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {secret.name}
              </span>
              <TypeBadge type={secret.secret_type} />
              {secret.username && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {secret.username}
                </span>
              )}
              {secret.url && (
                <a
                  href={secret.url.startsWith('http') ? secret.url : `https://${secret.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 truncate max-w-[160px]"
                  title={secret.url}
                >
                  <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="truncate">{secret.url}</span>
                </a>
              )}
              <DateInfoTooltip createdAt={secret.created_at} updatedAt={secret.updated_at} />
            </div>

            {/* Public key (always visible for ssh_key) */}
            {secret.public_key && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {t('publicKey')}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPub}
                    className="text-[10px] text-blue-500 hover:text-blue-700 dark:text-blue-400 font-medium"
                  >
                    {copiedPub ? t('copied') : t('copyPublicKey')}
                  </button>
                </div>
                <MonoBox maxH="max-h-16">{secret.public_key}</MonoBox>
              </div>
            )}

            {/* Revealed value */}
            {revealed && (
              <div className="mt-2 space-y-1">
                {!secret.public_key && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {t('value') ?? 'Value'}
                  </span>
                )}
                {secret.public_key && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {t('privateKey') ?? 'Private key'}
                  </span>
                )}
                {secret.secret_type === 'totp_seed' ? (
                  <TotpLiveWidget seed={revealed.value} labelInvalidSeed={t('totpInvalidSeed')} labelCopy={t('totpCopyCode')} />
                ) : secret.secret_type === 'keystore' ? (
                  <KeystoreValueDisplay value={revealed.value} />
                ) : (
                  <MonoBox maxH="max-h-24">{revealed.value}</MonoBox>
                )}
                {countdownSeconds !== undefined && (
                  <p className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('autoHide', { seconds: countdownSeconds })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons — always top-aligned */}
          <div className="flex items-center gap-0.5 shrink-0">
            {!revealed ? (
              <>
                {onCopyDirect ? (
                  <Button size="sm" variant="ghost" title={copied ? t('copied') : t('copy')} onClick={handleCopyDirect}
                    className={copied ? 'text-green-500 dark:text-green-400' : ''}>
                    {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                  </Button>
                ) : (
                  <span className="w-7" />
                )}
                <Button size="sm" variant="ghost" title={t('reveal')} onClick={onReveal}>
                  <EyeIcon />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" title={copied ? t('copied') : t('copy')}
                  onClick={() => handleCopy(revealed.value)}
                  className={copied ? 'text-green-500 dark:text-green-400' : ''}>
                  {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                </Button>
                <Button size="sm" variant="ghost" title={t('hide')} onClick={onHide}
                  className="text-indigo-500 dark:text-indigo-400">
                  <EyeOffIcon />
                </Button>
              </>
            )}
            {onArchive && (
              <Button size="sm" variant="ghost" title={tc('archive')} onClick={handleArchive}>
                <ArchiveIcon />
              </Button>
            )}
            <Button size="sm" variant="ghost-danger" title={t('delete')} onClick={handleDelete}>
              <TrashIcon />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
