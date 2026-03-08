'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import { copyToClipboard } from '@/lib/utils';
import Button from '@/components/common/Button';

interface SecretViewerProps {
  secret: Secret;
  revealed?: SecretReveal;
  countdownSeconds?: number;
  onReveal: () => void;
  onHide: () => void;
  onDelete: () => void;
}

export default function SecretViewer({
  secret, revealed, countdownSeconds, onReveal, onHide, onDelete,
}: SecretViewerProps) {
  const t = useTranslations('secrets');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (revealed?.value) {
      await copyToClipboard(revealed.value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900">{secret.name}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {secret.secret_type}
            </span>
          </div>
          {revealed && (
            <div className="mt-2">
              <div className="bg-white border border-gray-200 rounded px-3 py-2 font-mono text-sm break-all">
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
            <Button size="sm" variant="secondary" onClick={onReveal}>
              {t('reveal')}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                {copied ? t('copied') : t('copy')}
              </Button>
              <Button size="sm" variant="secondary" onClick={onHide}>
                {t('hide')}
              </Button>
            </>
          )}
          <Button size="sm" variant="danger" onClick={() => {
            if (confirm(t('deleteConfirm'))) onDelete();
          }}>
            {t('delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
