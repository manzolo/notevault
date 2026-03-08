/**
 * Smoke-test the Icons module: every named export must be a function (React component).
 */
import * as Icons from '@/components/common/Icons';

describe('Icons', () => {
  const iconNames = Object.keys(Icons) as (keyof typeof Icons)[];

  it('exports at least 10 icon components', () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(10);
  });

  it.each(iconNames)('%s is a function', (name) => {
    expect(typeof Icons[name]).toBe('function');
  });
});
