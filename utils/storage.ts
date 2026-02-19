import type { ClassGroup, RiskSettings, Student, Grade, BehaviorEvent, PerClassRiskSettings, PeriodDefinition } from '../types';
import { DEFAULT_RISK_SETTINGS, normalizeRiskSettings } from '../types';
import type { DashboardWidgetsState } from '../constants/dashboardWidgets';
import { normalizeDashboardWidgets } from '../constants/dashboardWidgets';

const STORAGE_KEY_PREFIX = 'toledano-edtech-state';

function getStorageKey(userId?: string | null): string {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX;
}

interface PersistedState {
  classes: PersistedClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings?: PerClassRiskSettings;
  periodDefinitions?: PeriodDefinition[];
}

interface PersistedClassGroup {
  id: string;
  name: string;
  students: PersistedStudent[];
  lastUpdated: string;
}

export interface PersistedStudent extends Omit<Student, 'grades' | 'behaviorEvents'> {
  grades: PersistedGrade[];
  behaviorEvents: PersistedBehaviorEvent[];
}

interface PersistedGrade extends Omit<Grade, 'date'> {
  date: string;
}

interface PersistedBehaviorEvent extends Omit<BehaviorEvent, 'date'> {
  date: string;
}

export function toPersistedStudent(s: Student): PersistedStudent {
  return {
    ...s,
    grades: s.grades.map((g) => ({ ...g, date: g.date.toISOString() })),
    behaviorEvents: s.behaviorEvents.map((e) => ({ ...e, date: e.date.toISOString() })),
  };
}

export function fromPersistedStudent(p: PersistedStudent): Student {
  return {
    ...p,
    grades: p.grades.map((g) => ({ ...g, date: new Date(g.date) })),
    behaviorEvents: p.behaviorEvents.map((e) => ({ ...e, date: new Date(e.date) })),
  };
}

export function toPersistedClass(c: ClassGroup): PersistedClassGroup {
  return {
    id: c.id,
    name: c.name,
    lastUpdated: c.lastUpdated.toISOString(),
    students: c.students.map(toPersistedStudent),
  };
}

export function fromPersistedClass(p: PersistedClassGroup): ClassGroup {
  return {
    id: p.id,
    name: p.name,
    lastUpdated: new Date(p.lastUpdated),
    students: p.students.map(fromPersistedStudent),
  };
}

export function saveToStorage(
  payload: {
    classes: ClassGroup[];
    activeClassId: string | null;
    riskSettings: RiskSettings;
    perClassRiskSettings?: PerClassRiskSettings;
    periodDefinitions?: PeriodDefinition[];
  },
  userId?: string | null
): void {
  const persisted: PersistedState = {
    classes: payload.classes.map(toPersistedClass),
    activeClassId: payload.activeClassId,
    riskSettings: payload.riskSettings,
    perClassRiskSettings: payload.perClassRiskSettings ?? {},
    periodDefinitions: payload.periodDefinitions ?? [],
  };
  try {
    const jsonString = JSON.stringify(persisted);
    // Check size before saving (localStorage limit is usually ~5-10MB)
    // If too large, try to save only essential data
    if (jsonString.length > 4 * 1024 * 1024) { // 4MB threshold
      console.warn('Data too large for localStorage, saving minimal state only');
      const minimalState: PersistedState = {
        classes: [], // Don't save classes if too large
        activeClassId: payload.activeClassId,
        riskSettings: payload.riskSettings,
        perClassRiskSettings: payload.perClassRiskSettings ?? {},
        periodDefinitions: payload.periodDefinitions ?? [],
      };
      localStorage.setItem(getStorageKey(userId), JSON.stringify(minimalState));
      return;
    }
    localStorage.setItem(getStorageKey(userId), jsonString);
  } catch (e: any) {
    // If quota exceeded, try to clear old data and save minimal state
    if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
      console.warn('localStorage quota exceeded, clearing old data and saving minimal state');
      try {
        // Clear old localStorage entries
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('toledano-edtech-') && key !== getStorageKey(userId)) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Try saving minimal state
        const minimalState: PersistedState = {
          classes: [], // Don't save classes if quota exceeded
          activeClassId: payload.activeClassId,
          riskSettings: payload.riskSettings,
          perClassRiskSettings: payload.perClassRiskSettings ?? {},
          periodDefinitions: payload.periodDefinitions ?? [],
        };
        localStorage.setItem(getStorageKey(userId), JSON.stringify(minimalState));
      } catch (e2) {
        console.warn('Failed to save even minimal state to localStorage', e2);
        // Don't throw - let the app continue without localStorage
      }
    } else {
      console.warn('Failed to save state to localStorage', e);
    }
  }
}

export function loadFromStorage(userId?: string | null): {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return getDefaultPersistedState();
    const parsed: PersistedState = JSON.parse(raw);
    const perClass = parsed.perClassRiskSettings ?? {};
    const normalizedPerClass: PerClassRiskSettings = {};
    Object.keys(perClass).forEach((classId) => {
      normalizedPerClass[classId] = normalizeRiskSettings(perClass[classId]);
    });
    return {
      classes: (parsed.classes || []).map(fromPersistedClass),
      activeClassId: parsed.activeClassId ?? null,
      riskSettings: normalizeRiskSettings(parsed.riskSettings),
      perClassRiskSettings: normalizedPerClass,
      periodDefinitions: Array.isArray(parsed.periodDefinitions) ? parsed.periodDefinitions : [],
    };
  } catch (e) {
    console.warn('Failed to load state from localStorage', e);
    return getDefaultPersistedState();
  }
}

function getDefaultPersistedState() {
  return {
    classes: [] as ClassGroup[],
    activeClassId: null as string | null,
    riskSettings: DEFAULT_RISK_SETTINGS,
    perClassRiskSettings: {} as PerClassRiskSettings,
    periodDefinitions: [] as PeriodDefinition[],
  };
}

/** For cloud sync: turn app state into JSON-safe persisted form */
export function toPersistedState(payload: {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings?: PerClassRiskSettings;
  periodDefinitions?: PeriodDefinition[];
}): PersistedState {
  return {
    classes: payload.classes.map(toPersistedClass),
    activeClassId: payload.activeClassId,
    riskSettings: payload.riskSettings,
    perClassRiskSettings: payload.perClassRiskSettings ?? {},
    periodDefinitions: payload.periodDefinitions ?? [],
  };
}

/** For cloud sync: parse persisted form back into app state */
export function fromPersistedState(parsed: PersistedState): {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} {
  const perClass = parsed.perClassRiskSettings ?? {};
  const normalizedPerClass: PerClassRiskSettings = {};
  Object.keys(perClass).forEach((classId) => {
    normalizedPerClass[classId] = normalizeRiskSettings(perClass[classId]);
  });
  return {
    classes: (parsed.classes || []).map(fromPersistedClass),
    activeClassId: parsed.activeClassId ?? null,
    riskSettings: normalizeRiskSettings(parsed.riskSettings),
    perClassRiskSettings: normalizedPerClass,
    periodDefinitions: Array.isArray(parsed.periodDefinitions) ? parsed.periodDefinitions : [],
  };
}

export type { PersistedState, PersistedClassGroup };

/** Chunk of students for large-class storage (each chunk < 1MB) */
export interface PersistedStudentChunk {
  students: PersistedStudent[];
}

/* ===== User Preferences ===== */

const PREFS_KEY = 'toledano-edtech-prefs';

export interface UserPreferences {
  darkMode: boolean;
  fontSize: 'small' | 'medium' | 'large';
  dashboardViewMode: 'table' | 'cards';
  dashboardWidgets?: Partial<DashboardWidgetsState>;
}

export const DEFAULT_PREFS: UserPreferences = {
  darkMode: false,
  fontSize: 'medium',
  dashboardViewMode: 'table',
};

export function savePreferences(prefs: UserPreferences): void {
  try {
    const jsonString = JSON.stringify(prefs);
    localStorage.setItem(PREFS_KEY, jsonString);
  } catch (e: any) {
    // If quota exceeded, try to clear some space
    if (e?.name === 'QuotaExceededError' || e?.message?.includes('quota')) {
      console.warn('localStorage quota exceeded for preferences, skipping save');
      // Don't throw - preferences are less critical than main data
    } else {
      console.warn('Failed to save preferences', e);
    }
  }
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** טוען רכיבי דשבורד ממונורפים (מנורמלים) */
export function loadDashboardWidgets(): DashboardWidgetsState {
  const prefs = loadPreferences();
  return normalizeDashboardWidgets(prefs.dashboardWidgets);
}
