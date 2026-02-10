export enum EventType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral'
}

export interface BehaviorEvent {
  id: string; // Unique event ID (generated or from index)
  studentId: string;
  studentName: string;
  date: Date;
  type: string; // The raw string from CSV
  category: EventType; // Classified category
  teacher: string;
  subject: string;
  lessonNumber: number;
  justification: string;
  comment: string;
}

/** אירוע שלילי שמסווג כחיסור (חיסור ללא הצדקה) */
export function isAbsenceEvent(e: BehaviorEvent): boolean {
  return e.category === EventType.NEGATIVE && (e.type || '').trim().includes('חיסור');
}

/** אירוע שלילי שאינו חיסור */
export function isOtherNegativeEvent(e: BehaviorEvent): boolean {
  return e.category === EventType.NEGATIVE && !isAbsenceEvent(e);
}

export interface Grade {
  studentId: string;
  studentName: string;
  subject: string;
  teacher: string;
  assignment: string;
  date: Date;
  score: number;
  weight: number;
}

export interface Correlation {
  date: Date;
  grade: Grade;
  nearbyEvents: BehaviorEvent[];
  description: string;
}

export interface Student {
  id: string;
  name: string;
  grades: Grade[];
  behaviorEvents: BehaviorEvent[];
  averageScore: number;
  negativeCount: number;
  positiveCount: number;
  gradeTrend: 'improving' | 'declining' | 'stable';
  behaviorTrend: 'improving' | 'declining' | 'stable';
  riskLevel: 'high' | 'medium' | 'low';
  riskScore: number; // Score from 1 (High Risk) to 10 (Low Risk)
  correlations: Correlation[];
}

/** משקלים באלגוריתם הסיכון (1–5, 3 = ברירת מחדל) */
export interface RiskWeights {
  grades: number;
  absences: number;
  negativeEvents: number;
}

/** הגדרות סף לסיכון: מה נחשב "בסיכון" */
export interface RiskSettings {
  minGradeThreshold: number;      // ציון מינימלי מתחתיו נכשל (ברירת מחדל: 55)
  maxNegativeBehaviors: number;  // מספר אירועים שליליים מעליו נחשב בסיכון (ברירת מחדל: 5)
  attendanceThreshold: number;  // מספר חיסורים מעליו נחשב בסיכון (ברירת מחדל: 4)
  /** ציון סיכון מתחת או שווה = סיכון גבוה (1–10, ברירת מחדל 4) */
  riskScoreHighThreshold: number;
  /** ציון סיכון מתחת או שווה = סיכון בינוני (ברירת מחדל 7) */
  riskScoreMediumThreshold: number;
  /** משקלים 1–5; משפיע על עוצמת הניקוד באלגוריתם */
  weights: RiskWeights;
  /** הורדה מציון הסיכון לכל חיסור מעל הסף (אופציונלי; אם לא מוגדר משתמשים במשקל) */
  penaltyPerAbsenceAboveThreshold?: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  grades: 3,
  absences: 3,
  negativeEvents: 3,
};

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  minGradeThreshold: 55,
  maxNegativeBehaviors: 5,
  attendanceThreshold: 4,
  riskScoreHighThreshold: 4,
  riskScoreMediumThreshold: 7,
  weights: DEFAULT_RISK_WEIGHTS,
};

/** תקופה להשוואה בדשבורד */
export interface PeriodDefinition {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

/** מפתחות כיתה → הגדרות סיכון (אם קיים = להשתמש בהגדרות לכיתה זו) */
export type PerClassRiskSettings = Record<string, RiskSettings>;

/** ממלא ערכי ברירת מחדל להגדרות סיכון ישנות (ללא ספי רמה ומשקלים) */
export function normalizeRiskSettings(settings: Partial<RiskSettings> | null | undefined): RiskSettings {
  if (!settings) return DEFAULT_RISK_SETTINGS;
  return {
    minGradeThreshold: settings.minGradeThreshold ?? DEFAULT_RISK_SETTINGS.minGradeThreshold,
    maxNegativeBehaviors: settings.maxNegativeBehaviors ?? DEFAULT_RISK_SETTINGS.maxNegativeBehaviors,
    attendanceThreshold: settings.attendanceThreshold ?? DEFAULT_RISK_SETTINGS.attendanceThreshold,
    riskScoreHighThreshold: settings.riskScoreHighThreshold ?? DEFAULT_RISK_SETTINGS.riskScoreHighThreshold,
    riskScoreMediumThreshold: settings.riskScoreMediumThreshold ?? DEFAULT_RISK_SETTINGS.riskScoreMediumThreshold,
    weights: settings.weights ?? DEFAULT_RISK_SETTINGS.weights,
    penaltyPerAbsenceAboveThreshold: settings.penaltyPerAbsenceAboveThreshold,
  };
}

/** כיתה: קבוצת תלמידים עם שם ומזהה */
export interface ClassGroup {
  id: string;
  name: string;
  students: Student[];
  lastUpdated: Date;
}

export interface AppState {
  view: 'landing' | 'upload' | 'dashboard' | 'student' | 'teachers' | 'matrix' | 'settings';
  selectedStudentId: string | null;
  /** כל הכיתות (במקום רשימת תלמידים שטוחה) */
  classes: ClassGroup[];
  /** מזהה הכיתה הפעילה; null = אין כיתה נבחרת */
  activeClassId: string | null;
  /** מצב פרטיות: הצגת שמות כ"תלמיד [מס]" או אותיות ראשונות */
  isAnonymous: boolean;
  /** הגדרות סיכון גלובליות */
  riskSettings: RiskSettings;
  /** הגדרות סיכון per כיתה (אם קיים למזהה כיתה = להשתמש בהן) */
  perClassRiskSettings: PerClassRiskSettings;
  /** תקופות להשוואה בדשבורד */
  periodDefinitions: PeriodDefinition[];
  loading: boolean;
}