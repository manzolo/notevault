import React from 'react';
import { classNames } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'ghost-danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variants = {
  primary:       'bg-gradient-to-r from-violet-600 to-indigo-500 text-white hover:from-violet-700 hover:to-indigo-600 shadow-sm hover:shadow-glow-sm focus:ring-violet-500 dark:focus:ring-offset-vault-900',
  secondary:     'border border-cream-300 dark:border-vault-600 bg-white dark:bg-vault-700/40 text-gray-700 dark:text-vault-100 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-700 dark:hover:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 focus:ring-violet-400 dark:focus:ring-offset-vault-900',
  danger:        'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  ghost:         'bg-transparent text-gray-500 hover:bg-cream-200/70 focus:ring-gray-400 dark:text-vault-300 dark:hover:bg-vault-700/50 dark:focus:ring-vault-500',
  'ghost-danger':'bg-transparent text-red-400 hover:text-red-600 hover:bg-red-50 focus:ring-red-300 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20',
};

const sizes = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
