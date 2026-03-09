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

const SHOW_USERNAME: SecretType[] = ['password', 'api_key', 'ssh_key'];
const SHOW_URL: SecretType[] = ['password', 'api_key', 'token', 'ssh_key'];

function detectSecretType(value: string): SecretType | null {
  const trimmed = value.trim();

  // SSH private key
  if (/-----BEGIN\s+(\w+\s+)?PRIVATE KEY-----/.test(trimmed)) return 'ssh_key';

  // Certificate / CSR
  if (/-----BEGIN\s+(CERTIFICATE|CERTIFICATE REQUEST|X509 CERTIFICATE)-----/.test(trimmed)) return 'certificate';

  // JWT: three base64url segments
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    try {
      const padded = trimmed.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      const header = JSON.parse(atob(padded));
      if (header.alg || header.typ) return 'token';
    } catch {
      // not a valid JWT header, fall through
    }
  }

  // Known API key patterns
  const apiKeyPatterns = [
    /^sk-[A-Za-z0-9]{20,}$/,            // OpenAI / Stripe secret
    /^pk_[a-z]+_[A-Za-z0-9]{20,}$/,     // Stripe publishable
    /^AKIA[0-9A-Z]{16}$/,               // AWS access key ID
    /^ghp_[A-Za-z0-9]{36}$/,            // GitHub personal access token
    /^ghs_[A-Za-z0-9]{36}$/,            // GitHub service token
    /^github_pat_[A-Za-z0-9_]{50,}$/,   // GitHub fine-grained PAT
    /^xox[bpoa]-[0-9A-Za-z-]+$/,        // Slack token
    /^SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/, // SendGrid
    /^AIza[0-9A-Za-z_-]{35}$/,          // Google API key
    /^[A-Za-z0-9_-]{20,}:[A-Za-z0-9_-]{20,}$/,    // generic key:secret
  ];
  for (const pattern of apiKeyPatterns) {
    if (pattern.test(trimmed)) return 'api_key';
  }

  return null;
}

export default function SecretForm({ onSubmit }: SecretFormProps) {
  const t = useTranslations('secrets');
  const [name, setName] = useState('');
  const [secretType, setSecretType] = useState<SecretType>('password');
  const [value, setValue] = useState('');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [detectedType, setDetectedType] = useState<SecretType | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    const detected = detectSecretType(newValue);
    setDetectedType(detected);
    if (detected) setSecretType(detected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name,
        secret_type: secretType,
        value,
        username: SHOW_USERNAME.includes(secretType) ? (username.trim() || undefined) : undefined,
        url: SHOW_URL.includes(secretType) ? (url.trim() || undefined) : undefined,
        public_key: secretType === 'ssh_key' ? (publicKey.trim() || undefined) : undefined,
      });
      setName('');
      setValue('');
      setUsername('');
      setUrl('');
      setPublicKey('');
      setDetectedType(null);
    } finally {
      setLoading(false);
    }
  };

  const usernamePlaceholder =
    secretType === 'api_key' ? t('usernameApiPlaceholder') :
    secretType === 'ssh_key' ? t('usernameSshPlaceholder') :
    t('usernamePlaceholder');

  const urlPlaceholder =
    secretType === 'ssh_key' ? t('urlSshPlaceholder') : t('urlPlaceholder');

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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('secretType')}</label>
        <select
          value={secretType}
          onChange={(e) => { setSecretType(e.target.value as SecretType); setDetectedType(null); }}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {SECRET_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      {SHOW_USERNAME.includes(secretType) && (
        <Input
          label={t('username')}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={usernamePlaceholder}
        />
      )}
      {SHOW_URL.includes(secretType) && (
        <Input
          label={t('url')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={urlPlaceholder}
        />
      )}
      {secretType === 'ssh_key' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('publicKey')}</label>
          <textarea
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('publicKeyPlaceholder')}
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {secretType === 'ssh_key' ? t('privateKey') : t('secretValue')}
        </label>
        <textarea
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
          required
          rows={3}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Secret value..."
        />
        {detectedType && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            {t('detectedType', { type: detectedType })}
          </p>
        )}
      </div>
      <Button variant="secondary" type="submit" loading={loading} className="w-full">
        {loading ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
