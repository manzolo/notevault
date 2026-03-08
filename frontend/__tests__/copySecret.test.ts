/**
 * Unit tests for the copyToClipboard utility used by copySecret.
 * The hook itself (useSecrets) calls copyToClipboard after the reveal API response.
 * Here we verify the clipboard utility behaves correctly.
 */

const writtenValues: string[] = [];

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: (text: string) => {
      writtenValues.push(text);
      return Promise.resolve();
    },
  },
  configurable: true,
});

import { copyToClipboard } from '@/lib/utils';

describe('copyToClipboard', () => {
  beforeEach(() => { writtenValues.length = 0; });

  it('writes the given text to the clipboard', async () => {
    await copyToClipboard('my-secret-value');
    expect(writtenValues).toContain('my-secret-value');
  });

  it('returns a Promise', () => {
    const result = copyToClipboard('test');
    expect(result).toBeInstanceOf(Promise);
  });

  it('handles empty string', async () => {
    await copyToClipboard('');
    expect(writtenValues).toContain('');
  });

  it('handles unicode secrets', async () => {
    const value = 'p@$$w0rd-🔑-日本語';
    await copyToClipboard(value);
    expect(writtenValues).toContain(value);
  });
});
