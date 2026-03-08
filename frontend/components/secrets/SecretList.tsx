'use client';

import { useTranslations } from 'next-intl';
import { Secret, SecretReveal } from '@/lib/types';
import SecretViewer from './SecretViewer';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface SecretListProps {
  secrets: Secret[];
  revealedSecrets: Map<number, SecretReveal>;
  countdown: Map<number, number>;
  loading: boolean;
  onReveal: (id: number) => void;
  onHide: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function SecretList({
  secrets, revealedSecrets, countdown, loading, onReveal, onHide, onDelete,
}: SecretListProps) {
  const t = useTranslations('secrets');

  if (loading) return <LoadingSpinner size="sm" />;
  if (secrets.length === 0) {
    return <p className="text-sm text-gray-500">{t('noSecrets')}</p>;
  }

  return (
    <div className="space-y-2">
      {secrets.map((secret) => (
        <SecretViewer
          key={secret.id}
          secret={secret}
          revealed={revealedSecrets.get(secret.id)}
          countdownSeconds={countdown.get(secret.id)}
          onReveal={() => onReveal(secret.id)}
          onHide={() => onHide(secret.id)}
          onDelete={() => onDelete(secret.id)}
        />
      ))}
    </div>
  );
}
