import { doc, setDoc, getDoc } from 'firebase/firestore';
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
  }
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const persisted = toPersistedState(payload);
  const ref = doc(db, 'users', userId, 'data', FIRESTORE_DOC_KEY);
  const compressed = toFirestoreSafe(persisted);
  await setDoc(ref, { v: COMPRESSED_VERSION, d: compressed });
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
  if (!raw) return null;
  // New format: compressed string
  if (typeof (raw as { v?: number }).v === 'number' && typeof (raw as { d?: string }).d === 'string') {
    const data = fromFirestoreSafe((raw as { d: string }).d);
    return fromPersistedState(data);
  }
  // Old format: full object (backwards compatibility)
  return fromPersistedState(raw as PersistedState);
}
