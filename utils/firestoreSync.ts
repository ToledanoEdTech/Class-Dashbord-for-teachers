import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { toPersistedState, fromPersistedState, type PersistedState } from './storage';
import type { ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition } from '../types';

const FIRESTORE_DOC_KEY = 'appData';

/** Firestore rejects undefined. JSON round-trip strips all undefined values. */
function toFirestoreSafe(obj: object): Record<string, unknown> {
  return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
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
  await setDoc(ref, toFirestoreSafe(persisted));
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
  const data = snap.data() as PersistedState;
  return fromPersistedState(data);
}
