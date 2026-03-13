'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import { copyToClipboard } from '@/lib/utils';
import Button from '@/components/common/Button';
import { ClipboardCheckIcon, ClipboardIcon, EyeIcon, EyeOffIcon, TrashIcon } from '@/components/common/Icons';
import { useConfirm } from '@/hooks/useConfirm';
import DateInfoTooltip from '@/components/common/DateInfoTooltip';
import TotpLiveWidget from './TotpLiveWidget';

interface SecretViewerProps {
  secret: Secret;
  revealed?: SecretReveal;
  countdownSeconds?: number;
  onReveal: () => void;
  onHide: () => void;
  onDelete: () => void;
  onCopyDirect?: () => Promise<void>;
}

export default function SecretViewer({
  secret, revealed, countdownSeconds, onReveal, onHide, onDelete, onCopyDirect,
}: SecretViewerProps) {
  const t = useTranslations('secrets');
  const [copied, setCopied] = useState(false);
  const { confirm, dialog } = useConfirm();

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async (value: string) => {
    await copyToClipboard(value);
    markCopied();
  };

  const handleCopyDirect = async () => {
    if (!onCopyDirect) return;
    await onCopyDirect();
    markCopied();
  };

  const handleDelete = async () => {
    if (await confirm(t('deleteConfirm'))) onDelete();
  };

  return (
    <>
      {dialog}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{secret.name}</span>
              <span className="text-xs text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                {secret.secret_type}
              </span>
              {secret.username && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 truncate max-w-[180px]"
                  title={secret.url}
                >
                  <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  {secret.url}
                </a>
              )}
              <DateInfoTooltip createdAt={secret.created_at} updatedAt={secret.updated_at} />
            </div>
            {secret.public_key && (
              <div className="mt-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('publicKey')}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(secret.public_key!)}
                    className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {copied ? t('copied') : t('copyPublicKey')}
                  </button>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded px-3 py-2 font-mono text-xs break-all">
                  {secret.public_key}
                </div>
              </div>
            )}
            {revealed && (
              <div className="mt-2">
                {secret.secret_type === 'totp_seed' ? (
                  <TotpLiveWidget seed={revealed.value} />
                ) : (
                  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded px-3 py-2 font-mono text-sm break-all">
                    {revealed.value}
                  </div>
                )}
                {countdownSeconds !== undefined && (
                  <p className="text-xs text-amber-600 mt-1">
                    {t('autoHide', { seconds: countdownSeconds })}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {!revealed ? (
              <>
                {onCopyDirect && (
                  <Button size="sm" variant="secondary" onClick={handleCopyDirect}>
                    {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                    <span className="hidden sm:inline">{copied ? t('copied') : t('copy')}</span>
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={onReveal}>
                  <EyeIcon />
                  <span className="hidden sm:inline">{t('reveal')}</span>
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => handleCopy(revealed.value)}>
                  {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                  <span className="hidden sm:inline">{copied ? t('copied') : t('copy')}</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={onHide}>
                  <EyeOffIcon />
                  <span className="hidden sm:inline">{t('hide')}</span>
                </Button>
              </>
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
