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

/** הגדרות סף לסיכון: מה נחשב "בסיכון" */
export interface RiskSettings {
  minGradeThreshold: number;      // ציון מינימלי מתחתיו נכשל (ברירת מחדל: 55)
  maxNegativeBehaviors: number;  // מספר אירועים שליליים מעליו נחשב בסיכון (ברירת מחדל: 5)
  attendanceThreshold: number;  // מספר חיסורים מעליו נחשב בסיכון (ברירת מחדל: 4)
}

export const DEFAULT_RISK_SETTINGS: RiskSettings = {
  minGradeThreshold: 55,
  maxNegativeBehaviors: 5,
  attendanceThreshold: 4,
};

/** כיתה: קבוצת תלמידים עם שם ומזהה */
export interface ClassGroup {
  id: string;
  name: string;
  students: Student[];
  lastUpdated: Date;
}

export interface AppState {
  view: 'upload' | 'dashboard' | 'student' | 'teachers' | 'matrix' | 'settings';
  selectedStudentId: string | null;
  /** כל הכיתות (במקום רשימת תלמידים שטוחה) */
  classes: ClassGroup[];
  /** מזהה הכיתה הפעילה; null = אין כיתה נבחרת */
  activeClassId: string | null;
  /** מצב פרטיות: הצגת שמות כ"תלמיד [מס]" או אותיות ראשונות */
  isAnonymous: boolean;
  /** הגדרות סיכון גלובליות */
  riskSettings: RiskSettings;
  loading: boolean;
}