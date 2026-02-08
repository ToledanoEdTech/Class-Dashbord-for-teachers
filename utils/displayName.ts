/**
 * מחזיר שם תצוגה לתלמיד: במצב אנונימי – "תלמיד [מס]" או אותיות ראשונות.
 */
export function getDisplayName(
  realName: string,
  index: number,
  isAnonymous: boolean
): string {
  if (!isAnonymous) return realName;
  return `תלמיד ${index + 1}`;
}

/**
 * מחזיר אותיות ראשונות (initials) לשם – שימושי בכותרות קצרות.
 */
export function getInitials(realName: string, isAnonymous: boolean): string {
  if (!isAnonymous) return realName;
  const parts = realName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '');
  }
  return realName.length >= 2 ? realName.slice(0, 2) : realName || '?';
}
