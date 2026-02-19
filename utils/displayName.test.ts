import { describe, it, expect } from 'vitest';
import { getDisplayName, getInitials } from './displayName';

describe('getDisplayName', () => {
  it('returns real name when not anonymous', () => {
    expect(getDisplayName('ישראל ישראלי', 0, false)).toBe('ישראל ישראלי');
    expect(getDisplayName('דניאל כהן', 5, false)).toBe('דניאל כהן');
  });

  it('returns "תלמיד N" when anonymous (index 0-based)', () => {
    expect(getDisplayName('ישראל ישראלי', 0, true)).toBe('תלמיד 1');
    expect(getDisplayName('דניאל כהן', 1, true)).toBe('תלמיד 2');
  });
});

describe('getInitials', () => {
  it('returns full name when not anonymous', () => {
    expect(getInitials('ישראל ישראלי', false)).toBe('ישראל ישראלי');
  });

  it('returns first letter of first and last word when anonymous and 2+ words', () => {
    const twoWords = 'Israel Yisraeli';
    expect(getInitials(twoWords, true)).toBe('IY');
    expect(getInitials('Dan Cohen', true)).toBe('DC');
  });

  it('returns first 2 characters when anonymous and single word with length >= 2', () => {
    expect(getInitials('דניאל', true)).toBe('דנ');
  });

  it('returns "?" when anonymous and empty name', () => {
    expect(getInitials('', true)).toBe('?');
  });

  it('returns single character as-is when anonymous and name length 1', () => {
    expect(getInitials('א', true)).toBe('א');
  });
});
