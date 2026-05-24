import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import type {
  PedagogicalMeeting,
  MeetingParticipant,
  StudentMeetingNote,
  MeetingDecision,
  MeetingStudentSnapshot,
  Student,
} from '../types';
import { generateMeetingToken } from './meetingTeachers';

const MEETINGS_COL = 'pedagogicalMeetings';
const MEETING_LINKS_COL = 'meetingLinks';

/** Firestore rejects undefined field values – strip them before write */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

export interface MeetingLinkData {
  meetingId: string;
  homeroomTeacherUid: string;
  participantId: string;
  participantToken: string;
  type: 'participant';
  className: string;
  meetingTitle: string;
  teacherName: string;
  subject: string;
  students: MeetingStudentSnapshot[];
}

function meetingRef(uid: string, meetingId: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase לא מוגדר');
  return doc(db, 'users', uid, MEETINGS_COL, meetingId);
}

function notesCol(uid: string, meetingId: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase לא מוגדר');
  return collection(db, 'users', uid, MEETINGS_COL, meetingId, 'notes');
}

function decisionsCol(uid: string, meetingId: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase לא מוגדר');
  return collection(db, 'users', uid, MEETINGS_COL, meetingId, 'decisions');
}

function participantsCol(uid: string, meetingId: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase לא מוגדר');
  return collection(db, 'users', uid, MEETINGS_COL, meetingId, 'participants');
}

function meetingLinkRef(homeroomUid: string, token: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase לא מוגדר');
  return doc(db, 'users', homeroomUid, 'meetingLinks', token);
}

/** נתיב ישן – תאימות לאחור */
function legacyMeetingLinkRef(token: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase לא מוגדר');
  return doc(db, MEETING_LINKS_COL, token);
}

export function buildStudentSnapshot(students: Student[]): MeetingStudentSnapshot[] {
  return students.map((s) =>
    stripUndefined({
      id: s.id,
      name: s.name,
      averageScore: s.averageScore,
      riskLevel: s.riskLevel,
    }) as MeetingStudentSnapshot
  );
}

export async function createMeeting(
  homeroomUid: string,
  homeroomName: string,
  classId: string,
  className: string,
  title: string,
  selectedTeachers: { teacherName: string; subject: string }[],
  students: Student[]
): Promise<PedagogicalMeeting> {
  const meetingId = `meeting-${Date.now()}-${generateMeetingToken().slice(0, 8)}`;
  const participants: MeetingParticipant[] = selectedTeachers.map((t) => ({
    id: generateMeetingToken(),
    teacherName: t.teacherName,
    subject: t.subject,
    token: generateMeetingToken(),
  }));

  const meeting: PedagogicalMeeting = {
    id: meetingId,
    classId,
    className,
    homeroomTeacherUid: homeroomUid,
    homeroomTeacherName: homeroomName,
    title,
    status: 'collecting',
    createdAt: new Date().toISOString(),
    studentSnapshot: buildStudentSnapshot(students),
    participants,
  };

  const ref = meetingRef(homeroomUid, meetingId);
  await setDoc(ref, stripUndefined(meeting as unknown as Record<string, unknown>));

  for (const p of participants) {
    const linkToken = generateMeetingToken();
    await setDoc(meetingLinkRef(homeroomUid, linkToken), {
      meetingId,
      homeroomTeacherUid: homeroomUid,
      participantId: p.id,
      participantToken: p.token,
      type: 'participant',
      className,
      meetingTitle: title,
      teacherName: p.teacherName,
      subject: p.subject,
      students: meeting.studentSnapshot,
    } satisfies MeetingLinkData);
    await setDoc(doc(participantsCol(homeroomUid, meetingId), p.id), { ...p, linkToken });
  }

  return meeting;
}

export async function listMeetings(homeroomUid: string, classId: string): Promise<PedagogicalMeeting[]> {
  const db = getFirebaseDb();
  if (!db) return [];
  const col = collection(db, 'users', homeroomUid, MEETINGS_COL);
  const snap = await getDocs(col);
  return snap.docs
    .map((d) => normalizeMeeting(d.data() as PedagogicalMeeting))
    .filter((m) => m.classId === classId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizeMeeting(raw: PedagogicalMeeting): PedagogicalMeeting {
  return {
    ...raw,
    participants: raw.participants ?? [],
    studentSnapshot: raw.studentSnapshot ?? [],
  };
}

export async function getMeeting(homeroomUid: string, meetingId: string): Promise<PedagogicalMeeting | null> {
  const snap = await getDoc(meetingRef(homeroomUid, meetingId));
  if (!snap.exists()) return null;
  return normalizeMeeting(snap.data() as PedagogicalMeeting);
}

export async function updateMeetingStatus(
  homeroomUid: string,
  meetingId: string,
  status: PedagogicalMeeting['status']
): Promise<void> {
  const ref = meetingRef(homeroomUid, meetingId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const updates: Partial<PedagogicalMeeting> = { status };
  if (status === 'completed') updates.completedAt = new Date().toISOString();
  await setDoc(ref, { ...snap.data(), ...updates });
}

export async function getMeetingNotes(homeroomUid: string, meetingId: string): Promise<StudentMeetingNote[]> {
  const snap = await getDocs(notesCol(homeroomUid, meetingId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentMeetingNote));
}

export async function getMeetingDecisions(homeroomUid: string, meetingId: string): Promise<MeetingDecision[]> {
  const snap = await getDocs(decisionsCol(homeroomUid, meetingId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as MeetingDecision))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function subscribeMeetingNotes(
  homeroomUid: string,
  meetingId: string,
  callback: (notes: StudentMeetingNote[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    notesCol(homeroomUid, meetingId),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentMeetingNote)));
    },
    (err) => {
      console.error('subscribeMeetingNotes error:', err);
      onError?.(err);
    }
  );
}

export function subscribeMeetingDecisions(
  homeroomUid: string,
  meetingId: string,
  callback: (decisions: MeetingDecision[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  return onSnapshot(
    decisionsCol(homeroomUid, meetingId),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as MeetingDecision))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      callback(list);
    },
    (err) => {
      console.error('subscribeMeetingDecisions error:', err);
      onError?.(err);
    }
  );
}

export async function addMeetingDecision(
  homeroomUid: string,
  meetingId: string,
  decision: Omit<MeetingDecision, 'id' | 'createdAt'>
): Promise<MeetingDecision> {
  const id = generateMeetingToken();
  const full: MeetingDecision = { ...decision, id, createdAt: new Date().toISOString() };
  await setDoc(doc(decisionsCol(homeroomUid, meetingId), id), full);
  return full;
}

export async function deleteMeetingDecision(homeroomUid: string, meetingId: string, decisionId: string): Promise<void> {
  await deleteDoc(doc(decisionsCol(homeroomUid, meetingId), decisionId));
}

export async function deleteMeeting(homeroomUid: string, meetingId: string): Promise<void> {
  const participantsSnap = await getDocs(participantsCol(homeroomUid, meetingId));
  for (const d of participantsSnap.docs) {
    const linkToken = d.data()?.linkToken as string | undefined;
    if (linkToken) await deleteDoc(meetingLinkRef(homeroomUid, linkToken));
    await deleteDoc(d.ref);
  }
  const notesSnap = await getDocs(notesCol(homeroomUid, meetingId));
  for (const d of notesSnap.docs) await deleteDoc(d.ref);
  const decisionsSnap = await getDocs(decisionsCol(homeroomUid, meetingId));
  for (const d of decisionsSnap.docs) await deleteDoc(d.ref);
  await deleteDoc(meetingRef(homeroomUid, meetingId));
}

/** טעינת נתוני קישור למורה מקצוע (ללא התחברות) */
export async function loadMeetingLink(homeroomUid: string, token: string): Promise<MeetingLinkData | null> {
  const snap = await getDoc(meetingLinkRef(homeroomUid, token));
  if (snap.exists()) return snap.data() as MeetingLinkData;
  const legacy = await getDoc(legacyMeetingLinkRef(token));
  if (legacy.exists()) return legacy.data() as MeetingLinkData;
  return null;
}

/** שמירת הערת מורה מקצוע (ללא התחברות – אימות דרך participantToken) */
export async function saveParticipantNote(
  linkData: MeetingLinkData,
  linkToken: string,
  studentId: string,
  note: string
): Promise<void> {
  const noteId = `${linkData.participantId}_${studentId}`;
  const noteDoc: Omit<StudentMeetingNote, 'id'> & { participantToken: string } = {
    studentId,
    participantId: linkData.participantId,
    teacherName: linkData.teacherName,
    subject: linkData.subject,
    note,
    updatedAt: new Date().toISOString(),
    participantToken: linkData.participantToken,
  };
  await setDoc(
    doc(notesCol(linkData.homeroomTeacherUid, linkData.meetingId), noteId),
    noteDoc
  );

  const linkRef = meetingLinkRef(linkData.homeroomTeacherUid, linkToken);
  const linkSnap = await getDoc(linkRef);
  const savedNotes = { ...((linkSnap.data()?.savedNotes as Record<string, string>) ?? {}), [studentId]: note };
  await setDoc(linkRef, { savedNotes, participantToken: linkData.participantToken }, { merge: true });

  if (note.trim()) {
    const pRef = doc(participantsCol(linkData.homeroomTeacherUid, linkData.meetingId), linkData.participantId);
    const pSnap = await getDoc(pRef);
    if (pSnap.exists() && !pSnap.data()?.submittedAt) {
      await setDoc(pRef, { ...pSnap.data(), submittedAt: new Date().toISOString() });
    }
  }
}

/** טעינת הערות קיימות של מורה מקצוע */
export async function loadParticipantNotes(
  homeroomUid: string,
  linkToken: string
): Promise<Record<string, string>> {
  const snap = await getDoc(meetingLinkRef(homeroomUid, linkToken));
  if (snap.exists()) return (snap.data()?.savedNotes as Record<string, string>) ?? {};
  const legacy = await getDoc(legacyMeetingLinkRef(linkToken));
  if (legacy.exists()) return (legacy.data()?.savedNotes as Record<string, string>) ?? {};
  return {};
}

/** מציאת קישורי משתתפים לישיבה */
export async function getParticipantLinks(
  homeroomUid: string,
  meetingId: string
): Promise<{ participantId: string; teacherName: string; subject: string; linkToken: string }[]> {
  const snap = await getDocs(participantsCol(homeroomUid, meetingId));
  return snap.docs.map((d) => {
    const data = d.data() as MeetingParticipant & { linkToken?: string };
    return {
      participantId: d.id,
      teacherName: data.teacherName,
      subject: data.subject,
      linkToken: data.linkToken ?? '',
    };
  });
}

export function buildShareUrl(homeroomUid: string, linkToken: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}?meeting=${encodeURIComponent(linkToken)}&t=${encodeURIComponent(homeroomUid)}`;
}

/** הודעת שגיאה ידידותית מ-Firebase */
export function formatMeetingError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  const msg = (err as { message?: string })?.message ?? String(err);
  if (code === 'permission-denied' || msg.includes('permission')) {
    return 'אין הרשאה ל-Firestore. יש לפרוס את firestore.rules המעודכן ב-Firebase Console (כללי pedagogicalMeetings ו-meetingLinks).';
  }
  if (msg.includes('undefined') || msg.includes('invalid data')) {
    return 'שגיאה בשמירת נתוני הישיבה. נסה/י שוב.';
  }
  return msg || 'שגיאה לא ידועה';
}
