import { truncate, classNames } from '@/lib/utils';

describe('truncate', () => {
  it('returns string unchanged if under limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and appends ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

describe('classNames', () => {
  it('joins truthy classes', () => {
    expect(classNames('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(classNames('a', undefined, false, null, 'b')).toBe('a b');
  });

  it('returns empty string for all falsy', () => {
    expect(classNames(undefined, false, null)).toBe('');
  });
});
