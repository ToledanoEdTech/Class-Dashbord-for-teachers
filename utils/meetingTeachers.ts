import type { Student } from '../types';
import { normalizeSubjectName } from './processing';

export interface TeacherSubjectPair {
  teacher: string;
  subject: string;
}

/** חילוץ רשימת מורים-מקצועות ייחודיים מנתוני הכיתה */
export function extractTeacherSubjectPairs(students: Student[]): TeacherSubjectPair[] {
  const normalizeTeacher = (t: string): string => {
    const x = (t || '').trim().replace(/\s+/g, ' ');
    if (!x) return 'ללא מורה';
    const words = x.split(' ').filter(Boolean);
    if (words.length >= 3) return words.slice(-2).join(' ');
    return x;
  };
  const normalize = (t: string, s: string) => {
    const teacher = normalizeTeacher(t) || 'ללא מורה';
    const subject = normalizeSubjectName((s || '').trim() || 'כללי');
    return { teacher, subject };
  };
  const key = (t: string, s: string) => `${t}\0${s}`;

  const gradeByPair: Record<string, boolean> = {};
  const eventsByPair: Record<string, boolean> = {};

  students.forEach((s) => {
    s.grades.forEach((g) => {
      const { teacher, subject } = normalize(g.teacher, g.subject);
      gradeByPair[key(teacher, subject)] = true;
    });
    s.behaviorEvents.forEach((e) => {
      const { teacher, subject } = normalize(e.teacher, e.subject);
      eventsByPair[key(teacher, subject)] = true;
    });
  });

  const allKeys = new Set([...Object.keys(gradeByPair), ...Object.keys(eventsByPair)]);
  const pairs: TeacherSubjectPair[] = [];
  allKeys.forEach((k) => {
    const [teacher, subject] = k.split('\0');
    pairs.push({ teacher, subject });
  });

  return pairs.sort((a, b) => a.teacher.localeCompare(b.teacher, 'he') || a.subject.localeCompare(b.subject, 'he'));
}

export function generateMeetingToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
