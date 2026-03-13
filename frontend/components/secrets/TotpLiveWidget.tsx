'use client';

import { useEffect, useState } from 'react';
import { copyToClipboard } from '@/lib/utils';
import { ClipboardCheckIcon, ClipboardIcon } from '@/components/common/Icons';

interface TotpLiveWidgetProps {
  seed: string;
  labelInvalidSeed?: string;
  labelCopy?: string;
}

function generateTotp(seed: string): string | null {
  try {
    // Dynamic import at call-time to avoid SSR issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OTPAuth = require('otpauth');
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(seed.toUpperCase().replace(/\s/g, '')),
      digits: 6,
      period: 30,
      algorithm: 'SHA1',
    });
    return totp.generate() as string;
  } catch {
    return null;
  }
}

function getSecondsRemaining(): number {
  return 30 - (Math.floor(Date.now() / 1000) % 30);
}

export default function TotpLiveWidget({ seed, labelInvalidSeed = 'Invalid TOTP seed', labelCopy = 'Copy code' }: TotpLiveWidgetProps) {
  const [code, setCode] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(getSecondsRemaining());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCode(generateTotp(seed));
    setSeconds(getSecondsRemaining());

    const interval = setInterval(() => {
      const remaining = getSecondsRemaining();
      setSeconds(remaining);
      if (remaining === 30) {
        setCode(generateTotp(seed));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [seed]);

  if (code === null) {
    return (
      <p className="text-xs text-red-500 mt-1">{labelInvalidSeed}</p>
    );
  }

  const progress = seconds / 30;
  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  const isExpiring = seconds <= 5;

  const handleCopy = async () => {
    if (!code) return;
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format code as "123 456"
  const formatted = `${code.slice(0, 3)} ${code.slice(3)}`;

  return (
    <div className="mt-2 flex items-center gap-3">
      {/* Countdown ring */}
      <div className="relative flex-shrink-0" title={`${seconds}s`}>
        <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90">
          <circle
            cx="14" cy="14" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-gray-200 dark:text-gray-600"
          />
          <circle
            cx="14" cy="14" r={radius}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={isExpiring ? 'text-red-500' : 'text-indigo-500'}
            stroke="currentColor"
            style={{ transition: 'stroke-dashoffset 0.9s linear' }}
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-bold ${isExpiring ? 'text-red-500' : 'text-indigo-600 dark:text-indigo-400'}`}>
          {seconds}
        </span>
      </div>

      {/* OTP code */}
      <span className={`font-mono text-2xl font-bold tracking-widest ${isExpiring ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
        {formatted}
      </span>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        title={labelCopy}
        className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
      >
        {copied ? <ClipboardCheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
