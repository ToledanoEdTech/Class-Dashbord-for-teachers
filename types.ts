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

export interface AppState {
  view: 'upload' | 'dashboard' | 'student';
  selectedStudentId: string | null;
  students: Student[];
  classAverage: number;
  loading: boolean;
}