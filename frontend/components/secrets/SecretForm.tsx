'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SecretCreate, SecretType } from '@/lib/types';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

interface SecretFormProps {
  onSubmit: (data: SecretCreate) => Promise<void>;
}

const SECRET_TYPES: SecretType[] = ['password', 'api_key', 'token', 'ssh_key', 'certificate', 'other'];

export default function SecretForm({ onSubmit }: SecretFormProps) {
  const t = useTranslations('secrets');
  const [name, setName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('password');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ name, secret_type: secretType, value });
      setName('');
      setValue('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        label={t('secretName')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="e.g. Database Password"
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('secretType')}</label>
        <select
          value={secretType}
          onChange={(e) => setSecretType(e.target.value as SecretType)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SECRET_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('secretValue')}</label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          rows={3}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Secret value..."
        />
      </div>
      <Button type="submit" loading={loading} className="w-full">
        {loading ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
