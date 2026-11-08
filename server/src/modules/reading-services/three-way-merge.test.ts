import { describe, expect, it } from 'vitest';

import { mergeField } from './three-way-merge';

describe('mergeField', () => {
  it('pushes when only the local value changed since the snapshot', () => {
    expect(mergeField('reading', 'want_to_read', 'want_to_read')).toEqual({ action: 'push', value: 'reading' });
  });

  it('pulls when only the remote value changed since the snapshot', () => {
    expect(mergeField('want_to_read', 'reading', 'want_to_read')).toEqual({ action: 'pull', value: 'reading' });
  });

  it('pushes and lets BookOrbit win when both sides changed since the snapshot', () => {
    expect(mergeField('read', 'reading', 'want_to_read')).toEqual({ action: 'push', value: 'read' });
  });

  it('does nothing when local and remote already agree', () => {
    expect(mergeField('read', 'read', 'want_to_read')).toEqual({ action: 'none' });
  });

  it('pushes on first sync, when there is no snapshot yet, even though both sides differ', () => {
    expect(mergeField('reading', 'want_to_read', undefined)).toEqual({ action: 'push', value: 'reading' });
  });

  it('does nothing on first sync when local already matches remote', () => {
    expect(mergeField('want_to_read', 'want_to_read', undefined)).toEqual({ action: 'none' });
  });

  it('accepts a custom equality function', () => {
    const equalIgnoreCase = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    expect(mergeField('Read', 'read', 'read', equalIgnoreCase)).toEqual({ action: 'none' });
  });
});
