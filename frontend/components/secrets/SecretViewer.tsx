'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import { copyToClipboard } from '@/lib/utils';
import Button from '@/components/common/Button';
import { ClipboardCheckIcon, ClipboardIcon, EyeIcon, EyeOffIcon, TrashIcon } from '@/components/common/Icons';

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

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">{secret.name}</span>
            <span className="text-xs text-gray-400 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
              {secret.secret_type}
            </span>
          </div>
          {revealed && (
            <div className="mt-2">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded px-3 py-2 font-mono text-sm break-all">
                {revealed.value}
              </div>
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
                  {copied ? t('copied') : t('copy')}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={onReveal}>
                <EyeIcon />
                {t('reveal')}
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => handleCopy(revealed.value)}>
                {copied ? <ClipboardCheckIcon /> : <ClipboardIcon />}
                {copied ? t('copied') : t('copy')}
              </Button>
              <Button size="sm" variant="secondary" onClick={onHide}>
                <EyeOffIcon />
                {t('hide')}
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost-danger"
            title={t('delete')}
            onClick={() => { if (confirm(t('deleteConfirm'))) onDelete(); }}
          >
            <TrashIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
