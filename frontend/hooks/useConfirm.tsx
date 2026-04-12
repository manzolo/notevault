'use client';

import { useState, useCallback } from 'react';
import ConfirmDialog from '@/components/common/ConfirmDialog';

interface ConfirmOptions {
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'secondary';
  inputLabel?: string;
}

export function useConfirm() {
  const [state, setState] = useState<{
    message: string;
    options?: ConfirmOptions;
    resolve: (v: { confirmed: boolean; value: string }) => void;
  } | null>(null);

  /** Simple boolean confirm (no input field). */
  const confirm = useCallback((message: string, options?: Omit<ConfirmOptions, 'inputLabel'>): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ message, options, resolve: ({ confirmed }) => resolve(confirmed) });
    });
  }, []);

  /** Confirm with optional text input — resolves with { confirmed, value }. */
  const confirmInput = useCallback((message: string, options?: ConfirmOptions): Promise<{ confirmed: boolean; value: string }> => {
    return new Promise((resolve) => {
      setState({ message, options, resolve });
    });
  }, []);

  const handleConfirm = useCallback((value?: string) => {
    state?.resolve({ confirmed: true, value: value ?? '' });
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve({ confirmed: false, value: '' });
    setState(null);
  }, [state]);

  const dialog = state ? (
    <ConfirmDialog
      message={state.message}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
      confirmLabel={state.options?.confirmLabel}
      confirmVariant={state.options?.confirmVariant}
      inputLabel={state.options?.inputLabel}
    />
  ) : null;

  return { confirm, confirmInput, dialog };
}
