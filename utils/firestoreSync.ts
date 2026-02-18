import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import LZString from 'lz-string';
import { getFirebaseDb } from '../firebase';
import { toPersistedState, fromPersistedState, type PersistedState } from './storage';
import type { ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition } from '../types';

const FIRESTORE_DOC_KEY = 'appData';
const COMPRESSED_VERSION = 2;

/** Firestore rejects undefined and has 1MB doc limit. Strip undefined and compress. */
function toFirestoreSafe(obj: object): string {
  const cleaned = JSON.parse(JSON.stringify(obj));
  return LZString.compressToUTF16(JSON.stringify(cleaned));
}

function fromFirestoreSafe(compressed: string): PersistedState {
  const json = LZString.decompressFromUTF16(compressed);
  if (!json) throw new Error('Failed to decompress');
  return JSON.parse(json) as PersistedState;
}

export async function saveToFirestore(
  userId: string,
  payload: {
    classes: ClassGroup[];
    activeClassId: string | null;
    riskSettings: RiskSettings;
    perClassRiskSettings?: PerClassRiskSettings;
    periodDefinitions?: PeriodDefinition[];
  },
  /** When false, we never overwrite non-empty cloud with empty local (prevents data loss from stale tabs) */
  allowEmptyOverwrite = true
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  if (!allowEmptyOverwrite && payload.classes.length === 0) {
    const existing = await loadFromFirestore(userId);
    if (existing && existing.classes.length > 0) return;
  }
  const persisted = toPersistedState(payload);
  const ref = doc(db, 'users', userId, 'data', FIRESTORE_DOC_KEY);
  const compressed = toFirestoreSafe(persisted);
  await setDoc(ref, { v: COMPRESSED_VERSION, d: compressed });
}

function parseFirestoreDoc(raw: { v?: number; d?: string } | PersistedState): {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} | null {
  if (!raw) return null;
  if (typeof (raw as { v?: number }).v === 'number' && typeof (raw as { d?: string }).d === 'string') {
    const data = fromFirestoreSafe((raw as { d: string }).d);
    return fromPersistedState(data);
  }
  return fromPersistedState(raw as PersistedState);
}

export async function loadFromFirestore(userId: string): Promise<{
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const ref = doc(db, 'users', userId, 'data', FIRESTORE_DOC_KEY);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data();
  return parseFirestoreDoc(raw as { v?: number; d?: string });
}

/** Subscribe to real-time Firestore updates - syncs across all devices/tabs */
export function subscribeToFirestore(
  userId: string,
  onData: (data: {
    classes: ClassGroup[];
    activeClassId: string | null;
    riskSettings: RiskSettings;
    perClassRiskSettings: PerClassRiskSettings;
    periodDefinitions: PeriodDefinition[];
  } | null) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const ref = doc(db, 'users', userId, 'data', FIRESTORE_DOC_KEY);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const raw = snap.data();
      const parsed = parseFirestoreDoc(raw as { v?: number; d?: string });
      onData(parsed);
    },
    (err) => {
      onData(null);
      onError?.(err);
    }
  );
}
