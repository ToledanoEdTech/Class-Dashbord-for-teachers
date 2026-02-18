import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import LZString from 'lz-string';
import { getFirebaseDb } from '../firebase';
import {
  toPersistedState,
  fromPersistedState,
  toPersistedClass,
  fromPersistedClass,
  toPersistedStudent,
  fromPersistedStudent,
  type PersistedState,
  type PersistedClassGroup,
  type PersistedStudent,
} from './storage';
import type { ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition } from '../types';
import { normalizeRiskSettings } from '../types';

const SETTINGS_DOC = 'settings';
const COMPRESSED_VERSION = 2;
const FIRESTORE_DOC_KEY = 'appData';
const MAX_CHUNK_BYTES = 800000;

/** Compress object to string - each doc must be < 1MB */
function compress(obj: object): string {
  const cleaned = JSON.parse(JSON.stringify(obj));
  return LZString.compressToUTF16(JSON.stringify(cleaned));
}

function decompress(compressed: string): unknown {
  const json = LZString.decompressFromUTF16(compressed);
  if (!json) throw new Error('Failed to decompress');
  return JSON.parse(json);
}

/** Firestore rejects undefined - strip it from nested objects */
function toFirestoreValue(obj: unknown): unknown {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toFirestoreValue);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = toFirestoreValue(v);
  }
  return result;
}

/** Settings doc - small, no compression needed */
async function loadSettings(
  db: Firestore,
  userId: string
): Promise<{
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} | null> {
  const ref = doc(db, 'users', userId, 'data', SETTINGS_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data() as {
    activeClassId?: string | null;
    riskSettings?: RiskSettings;
    perClassRiskSettings?: PerClassRiskSettings;
    periodDefinitions?: PeriodDefinition[];
  };
  const perClass = raw.perClassRiskSettings ?? {};
  const normalizedPerClass: PerClassRiskSettings = {};
  Object.keys(perClass).forEach((classId) => {
    normalizedPerClass[classId] = normalizeRiskSettings(perClass[classId]);
  });
  return {
    activeClassId: raw.activeClassId ?? null,
    riskSettings: normalizeRiskSettings(raw.riskSettings),
    perClassRiskSettings: normalizedPerClass,
    periodDefinitions: Array.isArray(raw.periodDefinitions) ? raw.periodDefinitions : [],
  };
}

/** Load one class - supports both single-doc and chunked format */
async function loadOneClass(
  db: Firestore,
  userId: string,
  classId: string,
  raw: Record<string, unknown>
): Promise<ClassGroup | null> {
  if (typeof raw?.d === 'string') {
    try {
      const parsed = decompress(raw.d) as PersistedClassGroup;
      return fromPersistedClass(parsed);
    } catch (e) {
      console.warn('Failed to parse class', classId, e);
      return null;
    }
  }
  if (raw?.meta && typeof raw?.chunkCount === 'number') {
    const meta = raw.meta as { id: string; name: string; lastUpdated: string };
    const chunksRef = collection(db, 'users', userId, 'classes', classId, 'chunks');
    const chunksSnap = await getDocs(chunksRef);
    const students: ReturnType<typeof fromPersistedStudent>[] = [];
    const sorted = chunksSnap.docs.sort((a, b) => Number(a.id) - Number(b.id));
    for (const d of sorted) {
      const chunkRaw = d.data();
      if (typeof chunkRaw?.d === 'string') {
        const chunk = decompress(chunkRaw.d) as { students: PersistedStudent[] };
        for (const s of chunk.students || []) {
          students.push(fromPersistedStudent(s));
        }
      }
    }
    return {
      id: meta.id,
      name: meta.name,
      lastUpdated: new Date(meta.lastUpdated),
      students,
    };
  }
  return null;
}

async function loadClasses(db: Firestore, userId: string): Promise<ClassGroup[]> {
  const colRef = collection(db, 'users', userId, 'classes');
  const snapshot = await getDocs(colRef);
  const classes: ClassGroup[] = [];
  for (const docSnap of snapshot.docs) {
    const raw = docSnap.data();
    if (raw?.d || raw?.meta) {
      const c = await loadOneClass(db, userId, docSnap.id, raw);
      if (c) classes.push(c);
    }
  }
  classes.sort((a, b) => a.lastUpdated.getTime() - b.lastUpdated.getTime());
  return classes;
}

/** Fallback: load from legacy single doc (for migration) */
async function loadLegacyDoc(
  db: Firestore,
  userId: string
): Promise<{
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} | null> {
  const ref = doc(db, 'users', userId, 'data', FIRESTORE_DOC_KEY);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const raw = snap.data();
  if (typeof (raw as { v?: number }).v === 'number' && typeof (raw as { d?: string }).d === 'string') {
    const data = decompress((raw as { d: string }).d) as PersistedState;
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
  const settings = await loadSettings(db, userId);
  const classes = await loadClasses(db, userId);
  if (settings) {
    return {
      classes,
      activeClassId: settings.activeClassId,
      riskSettings: settings.riskSettings,
      perClassRiskSettings: settings.perClassRiskSettings,
      periodDefinitions: settings.periodDefinitions,
    };
  }
  return loadLegacyDoc(db, userId);
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
  allowEmptyOverwrite = true
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  if (!allowEmptyOverwrite && payload.classes.length === 0) {
    const existing = await loadFromFirestore(userId);
    if (existing && existing.classes.length > 0) return;
  }

  const batch = writeBatch(db);

  const settingsRef = doc(db, 'users', userId, 'data', SETTINGS_DOC);
  batch.set(settingsRef, toFirestoreValue({
    activeClassId: payload.activeClassId,
    riskSettings: payload.riskSettings,
    perClassRiskSettings: payload.perClassRiskSettings ?? {},
    periodDefinitions: payload.periodDefinitions ?? [],
    t: Date.now(),
  }) as Record<string, unknown>);

  const colRef = collection(db, 'users', userId, 'classes');
  const existingSnap = await getDocs(colRef);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  for (const c of payload.classes) {
    const persisted = toPersistedClass(c);
    const compressed = compress(persisted);
    const classRef = doc(colRef, c.id);

    if (compressed.length <= MAX_CHUNK_BYTES) {
      batch.set(classRef, { v: COMPRESSED_VERSION, d: compressed, t: Date.now() });
    } else {
      const persistedStudents = persisted.students;
      const chunks: { students: PersistedStudent[] }[] = [];
      let currentChunk: PersistedStudent[] = [];
      for (const s of persistedStudents) {
        currentChunk.push(s);
        const compressedChunk = compress({ students: currentChunk });
        if (compressedChunk.length > MAX_CHUNK_BYTES && currentChunk.length > 1) {
          currentChunk.pop();
          chunks.push({ students: [...currentChunk] });
          currentChunk = [s];
        }
      }
      if (currentChunk.length > 0) chunks.push({ students: currentChunk });

      batch.set(classRef, {
        meta: {
          id: c.id,
          name: c.name,
          lastUpdated: c.lastUpdated.toISOString(),
        },
        chunkCount: chunks.length,
        t: Date.now(),
      });

      const chunksRef = collection(db, 'users', userId, 'classes', c.id, 'chunks');
      const existingChunks = await getDocs(chunksRef);
      for (let i = 0; i < chunks.length; i++) {
        const chunkCompressed = compress(chunks[i]);
        if (chunkCompressed.length > MAX_CHUNK_BYTES) {
          throw new Error(
            `תלמיד בודד בכיתה "${c.name}" גדול מדי. נסה להקטין נתונים (ציונים/אירועים).`
          );
        }
        batch.set(doc(chunksRef, String(i)), { d: chunkCompressed });
      }
      for (let i = chunks.length; i < existingChunks.docs.length; i++) {
        batch.delete(doc(chunksRef, String(i)));
      }
    }
    existingIds.delete(c.id);
  }

  for (const id of existingIds) {
    batch.delete(doc(colRef, id));
  }

  await batch.commit();
}

/** Subscribe to real-time updates - combines settings + classes */
export function subscribeToFirestore(
  userId: string,
  onData: (
    data: {
      classes: ClassGroup[];
      activeClassId: string | null;
      riskSettings: RiskSettings;
      perClassRiskSettings: PerClassRiskSettings;
      periodDefinitions: PeriodDefinition[];
    } | null,
    updatedAt: number
  ) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};

  let lastUpdated = 0;
  const emit = () => {
    loadFromFirestore(userId).then(
      (data) => {
        if (data) lastUpdated = Date.now();
        onData(data, lastUpdated);
      },
      (err) => {
        onData(null, 0);
        onError?.(err);
      }
    );
  };

  const unsubSettings = onSnapshot(
    doc(db, 'users', userId, 'data', SETTINGS_DOC),
    () => emit(),
    (err) => {
      onData(null, 0);
      onError?.(err);
    }
  );

  const unsubClasses = onSnapshot(
    collection(db, 'users', userId, 'classes'),
    () => emit(),
    () => {}
  );

  emit();

  return () => {
    unsubSettings();
    unsubClasses();
  };
}
