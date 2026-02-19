import {
  doc,
  getDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  type DocumentReference,
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
  type UserPreferences,
  DEFAULT_PREFS,
} from './storage';
import { normalizeDashboardWidgets } from '../constants/dashboardWidgets';
import type { ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition } from '../types';
import { normalizeRiskSettings } from '../types';

const SETTINGS_DOC = 'settings';
const COMPRESSED_VERSION = 2;
const FIRESTORE_DOC_KEY = 'appData';
const MAX_CHUNK_BYTES = 800000;
const MAX_BATCH_OPS = 400;

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

/** Settings doc - small, no compression needed. Includes user preferences (darkMode, widgets, etc.). */
async function loadSettings(
  db: Firestore,
  userId: string
): Promise<{
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
  preferences?: UserPreferences;
} | null> {
  try {
    const ref = doc(db, 'users', userId, 'data', SETTINGS_DOC);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.log('Settings document does not exist for user:', userId);
      return null;
    }
  const raw = snap.data() as {
    activeClassId?: string | null;
    riskSettings?: RiskSettings;
    perClassRiskSettings?: PerClassRiskSettings;
    periodDefinitions?: PeriodDefinition[];
    darkMode?: boolean;
    fontSize?: 'small' | 'medium' | 'large';
    dashboardViewMode?: 'table' | 'cards';
    dashboardWidgets?: Record<string, boolean>;
  };
  const perClass = raw.perClassRiskSettings ?? {};
  const normalizedPerClass: PerClassRiskSettings = {};
  Object.keys(perClass).forEach((classId) => {
    normalizedPerClass[classId] = normalizeRiskSettings(perClass[classId]);
  });
  const hasPrefsFromCloud = raw.darkMode !== undefined || raw.fontSize !== undefined || raw.dashboardWidgets !== undefined;
  const preferences: UserPreferences | undefined = hasPrefsFromCloud
    ? {
        ...DEFAULT_PREFS,
        darkMode: typeof raw.darkMode === 'boolean' ? raw.darkMode : DEFAULT_PREFS.darkMode,
        fontSize: raw.fontSize === 'small' || raw.fontSize === 'medium' || raw.fontSize === 'large' ? raw.fontSize : DEFAULT_PREFS.fontSize,
        dashboardViewMode: raw.dashboardViewMode === 'cards' ? 'cards' : 'table',
        dashboardWidgets: raw.dashboardWidgets ? normalizeDashboardWidgets(raw.dashboardWidgets) : undefined,
      }
    : undefined;
  return {
    activeClassId: raw.activeClassId ?? null,
    riskSettings: normalizeRiskSettings(raw.riskSettings),
    perClassRiskSettings: normalizedPerClass,
    periodDefinitions: Array.isArray(raw.periodDefinitions) ? raw.periodDefinitions : [],
    preferences,
  };
  } catch (error: any) {
    console.error('Error loading settings:', error);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('אין הרשאה לקרוא הגדרות מהענן. עדכן את כללי Firestore.');
    }
    return null;
  }
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
  try {
    const colRef = collection(db, 'users', userId, 'classes');
    const snapshot = await getDocs(colRef);
    console.log('Found', snapshot.docs.length, 'class documents');
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
  } catch (error: any) {
    console.error('Error loading classes:', error);
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('אין הרשאה לקרוא כיתות מהענן. עדכן את כללי Firestore.');
    }
    throw error;
  }
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
  preferences?: UserPreferences;
} | null> {
  const db = getFirebaseDb();
  if (!db) {
    console.warn('Firestore DB not available');
    return null;
  }
  
  try {
    console.log('Loading from Firestore for user:', userId);
    const settings = await loadSettings(db, userId);
    const classes = await loadClasses(db, userId);
    console.log('Loaded settings:', !!settings, 'classes:', classes.length);
    
    if (settings) {
      return {
        classes,
        activeClassId: settings.activeClassId,
        riskSettings: settings.riskSettings,
        perClassRiskSettings: settings.perClassRiskSettings,
        periodDefinitions: settings.periodDefinitions,
        preferences: settings.preferences,
      };
    }

    // If classes exist but settings doc is missing, still return cloud classes with safe defaults.
    if (classes.length > 0) {
      return {
        classes,
        activeClassId: classes[0]?.id ?? null,
        riskSettings: normalizeRiskSettings(undefined),
        perClassRiskSettings: {},
        periodDefinitions: [],
      };
    }
    
    // Try legacy format
    const legacy = await loadLegacyDoc(db, userId);
    if (legacy) {
      console.log('Loaded from legacy format');
      return legacy;
    }
    
    // Return empty state if nothing found
    console.log('No data found in Firestore, returning empty state');
    return null;
  } catch (error: any) {
    console.error('Error loading from Firestore:', error);
    // Check if it's a permission error
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('אין הרשאה לקרוא מהענן. עדכן את כללי Firestore ב-Console.');
    }
    throw error;
  }
}

export async function saveToFirestore(
  userId: string,
  payload: {
    classes: ClassGroup[];
    activeClassId: string | null;
    riskSettings: RiskSettings;
    perClassRiskSettings?: PerClassRiskSettings;
    periodDefinitions?: PeriodDefinition[];
    preferences?: UserPreferences;
  },
  allowEmptyOverwrite = true
): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  if (!allowEmptyOverwrite && payload.classes.length === 0) {
    const existing = await loadFromFirestore(userId);
    if (existing && existing.classes.length > 0) return;
  }

  let batch = writeBatch(db);
  let batchOps = 0;
  const commitBatch = async () => {
    if (batchOps === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    batchOps = 0;
  };
  const queueSet = async (ref: DocumentReference, data: Record<string, unknown>) => {
    batch.set(ref, data);
    batchOps++;
    if (batchOps >= MAX_BATCH_OPS) await commitBatch();
  };
  const queueDelete = async (ref: DocumentReference) => {
    batch.delete(ref);
    batchOps++;
    if (batchOps >= MAX_BATCH_OPS) await commitBatch();
  };

  const prefs = payload.preferences;
  const settingsRef = doc(db, 'users', userId, 'data', SETTINGS_DOC);
  await queueSet(settingsRef, toFirestoreValue({
    activeClassId: payload.activeClassId,
    riskSettings: payload.riskSettings,
    perClassRiskSettings: payload.perClassRiskSettings ?? {},
    periodDefinitions: payload.periodDefinitions ?? [],
    darkMode: prefs?.darkMode,
    fontSize: prefs?.fontSize,
    dashboardViewMode: prefs?.dashboardViewMode,
    dashboardWidgets: prefs?.dashboardWidgets,
    t: Date.now(),
  }) as Record<string, unknown>);

  const colRef = collection(db, 'users', userId, 'classes');

  for (const c of payload.classes) {
    const persisted = toPersistedClass(c);
    const compressed = compress(persisted);
    const classRef = doc(colRef, c.id);
    const existingClassSnap = await getDoc(classRef);
    if (existingClassSnap.exists()) {
      const existingRaw = existingClassSnap.data() as { lastUpdated?: string; meta?: { lastUpdated?: string } };
      const existingLastUpdated = existingRaw.lastUpdated || existingRaw.meta?.lastUpdated;
      if (existingLastUpdated) {
        const existingTs = new Date(existingLastUpdated).getTime();
        const incomingTs = c.lastUpdated.getTime();
        // Prevent stale tabs/devices from overriding newer class data.
        if (Number.isFinite(existingTs) && existingTs > incomingTs) {
          continue;
        }
      }
    }

    if (compressed.length <= MAX_CHUNK_BYTES) {
      await queueSet(classRef, {
        v: COMPRESSED_VERSION,
        d: compressed,
        lastUpdated: c.lastUpdated.toISOString(),
        t: Date.now(),
      });
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

      await queueSet(classRef, {
        meta: {
          id: c.id,
          name: c.name,
          lastUpdated: c.lastUpdated.toISOString(),
        },
        lastUpdated: c.lastUpdated.toISOString(),
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
        await queueSet(doc(chunksRef, String(i)), { d: chunkCompressed });
      }
      for (let i = chunks.length; i < existingChunks.docs.length; i++) {
        await queueDelete(doc(chunksRef, String(i)));
      }
    }
    // Important: Do not auto-delete classes that are missing from this payload.
    // This prevents stale tabs/devices from wiping classes.
  }

  await commitBatch();
}

/**
 * Explicit class deletion API.
 * Classes are deleted from cloud only via active user action.
 */
export async function deleteClassFromFirestore(userId: string, classId: string): Promise<void> {
  const db = getFirebaseDb();
  if (!db) return;
  const classRef = doc(db, 'users', userId, 'classes', classId);
  const chunksRef = collection(db, 'users', userId, 'classes', classId, 'chunks');
  const chunksSnap = await getDocs(chunksRef);
  const batch = writeBatch(db);
  for (const chunk of chunksSnap.docs) {
    batch.delete(doc(chunksRef, chunk.id));
  }
  batch.delete(classRef);
  await batch.commit();
}

/** Subscribe to real-time updates - combines settings + classes + preferences */
export function subscribeToFirestore(
  userId: string,
  onData: (
    data: {
      classes: ClassGroup[];
      activeClassId: string | null;
      riskSettings: RiskSettings;
      perClassRiskSettings: PerClassRiskSettings;
      periodDefinitions: PeriodDefinition[];
      preferences?: UserPreferences;
    } | null,
    updatedAt: number
  ) => void,
  onError?: (err: Error) => void
): () => void {
  const db = getFirebaseDb();
  if (!db) return () => {};

  let lastUpdated = 0;
  let isLoading = false;
  let pendingReload = false;
  let disposed = false;
  const emit = () => {
    if (disposed) return;
    if (isLoading) {
      // Queue one follow-up reload to avoid dropping updates from rapid snapshots.
      pendingReload = true;
      return;
    }
    isLoading = true;

    loadFromFirestore(userId)
      .then(
        (data) => {
          if (disposed) return;
          if (data) lastUpdated = Date.now();
          onData(data, lastUpdated);
        },
        (err) => {
          if (disposed) return;
          onData(null, 0);
          onError?.(err);
        }
      )
      .catch((err) => {
        if (disposed) return;
        // Ensure we always emit something, even on unexpected errors
        onData(null, 0);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (disposed) return;
        isLoading = false;
        if (pendingReload) {
          pendingReload = false;
          emit();
        }
      });
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

  // Safety poll: if any snapshot was missed transiently, resync anyway.
  const pollId = setInterval(() => emit(), 15000);

  emit();

  return () => {
    disposed = true;
    clearInterval(pollId);
    unsubSettings();
    unsubClasses();
  };
}
