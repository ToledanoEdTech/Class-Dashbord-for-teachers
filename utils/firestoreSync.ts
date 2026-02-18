import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '../firebase';
import { toPersistedState, fromPersistedState, type PersistedState } from './storage';
import type { ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition } from '../types';

const FIRESTORE_DOC_KEY = 'appData';

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
  await setDoc(ref, persisted);
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
