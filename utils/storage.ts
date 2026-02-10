import type { ClassGroup, RiskSettings, Student, Grade, BehaviorEvent, PerClassRiskSettings, PeriodDefinition } from '../types';
import { DEFAULT_RISK_SETTINGS, normalizeRiskSettings } from '../types';
import type { DashboardWidgetsState } from '../constants/dashboardWidgets';
import { normalizeDashboardWidgets } from '../constants/dashboardWidgets';

const STORAGE_KEY = 'toledano-edtech-state';

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

interface PersistedStudent extends Omit<Student, 'grades' | 'behaviorEvents'> {
  grades: PersistedGrade[];
  behaviorEvents: PersistedBehaviorEvent[];
}

interface PersistedGrade extends Omit<Grade, 'date'> {
  date: string;
}

interface PersistedBehaviorEvent extends Omit<BehaviorEvent, 'date'> {
  date: string;
}

function toPersistedStudent(s: Student): PersistedStudent {
  return {
    ...s,
    grades: s.grades.map((g) => ({ ...g, date: g.date.toISOString() })),
    behaviorEvents: s.behaviorEvents.map((e) => ({ ...e, date: e.date.toISOString() })),
  };
}

function fromPersistedStudent(p: PersistedStudent): Student {
  return {
    ...p,
    grades: p.grades.map((g) => ({ ...g, date: new Date(g.date) })),
    behaviorEvents: p.behaviorEvents.map((e) => ({ ...e, date: new Date(e.date) })),
  };
}

function toPersistedClass(c: ClassGroup): PersistedClassGroup {
  return {
    id: c.id,
    name: c.name,
    lastUpdated: c.lastUpdated.toISOString(),
    students: c.students.map(toPersistedStudent),
  };
}

function fromPersistedClass(p: PersistedClassGroup): ClassGroup {
  return {
    id: p.id,
    name: p.name,
    lastUpdated: new Date(p.lastUpdated),
    students: p.students.map(fromPersistedStudent),
  };
}

export function saveToStorage(payload: {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings?: PerClassRiskSettings;
  periodDefinitions?: PeriodDefinition[];
}): void {
  const persisted: PersistedState = {
    classes: payload.classes.map(toPersistedClass),
    activeClassId: payload.activeClassId,
    riskSettings: payload.riskSettings,
    perClassRiskSettings: payload.perClassRiskSettings ?? {},
    periodDefinitions: payload.periodDefinitions ?? [],
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (e) {
    console.warn('Failed to save state to localStorage', e);
  }
}

export function loadFromStorage(): {
  classes: ClassGroup[];
  activeClassId: string | null;
  riskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  periodDefinitions: PeriodDefinition[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save preferences', e);
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
