import { describe, it, expect } from 'vitest';
import {
  absenceTrend,
  calculateStudentStats,
  computeStudentStatsFromData,
} from './processing';
import {
  EventType,
  DEFAULT_RISK_SETTINGS,
  type Grade,
  type BehaviorEvent,
  type RiskSettings,
} from '../types';

// --- Test fixtures ---

function makeGrade(overrides: Partial<Grade> & { score: number; date: Date }): Grade {
  const { date, score, weight, ...rest } = overrides;
  return {
    studentId: '1',
    studentName: 'Test Student',
    subject: 'Math',
    teacher: 'Teacher',
    assignment: 'Test',
    date,
    score,
    weight: weight ?? 1,
    ...rest,
  };
}

function makeEvent(overrides: Partial<BehaviorEvent> & { date: Date; category: EventType }): BehaviorEvent {
  const { date, category, ...rest } = overrides;
  return {
    id: 'evt-1',
    studentId: '1',
    studentName: 'Test',
    date,
    type: 'event',
    category,
    teacher: 'T',
    subject: 'Math',
    lessonNumber: 1,
    justification: '',
    comment: '',
    ...rest,
  };
}

describe('calculateStudentStats', () => {
  describe('grade average (weighted and fallback)', () => {
    it('returns averageScore 0 when grades array is empty', () => {
      const student = {
        id: '1',
        name: 'Student',
        grades: [] as Grade[],
        behaviorEvents: [] as BehaviorEvent[],
      };
      const result = calculateStudentStats(student);
      expect(result.averageScore).toBe(0);
    });

    it('computes simple average when all weights are equal', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 80, date: new Date(base), weight: 1 }),
        makeGrade({ score: 100, date: new Date(base.getTime() + 1), weight: 1 }),
      ];
      const student = {
        id: '1',
        name: 'Student',
        grades,
        behaviorEvents: [],
      };
      const result = calculateStudentStats(student);
      expect(result.averageScore).toBe(90);
    });

    it('computes weighted average when weights differ', () => {
      const base = new Date(2024, 0, 1);
      // (60*2 + 80*3 + 100*5) / (2+3+5) = (120+240+500)/10 = 86
      const grades: Grade[] = [
        makeGrade({ score: 60, date: new Date(base), weight: 2 }),
        makeGrade({ score: 80, date: new Date(base.getTime() + 1), weight: 3 }),
        makeGrade({ score: 100, date: new Date(base.getTime() + 2), weight: 5 }),
      ];
      const student = {
        id: '1',
        name: 'Student',
        grades,
        behaviorEvents: [],
      };
      const result = calculateStudentStats(student);
      expect(result.averageScore).toBe(86);
    });

    it('uses simple average when total weight is 0 (edge case)', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 70, date: base, weight: 0 }),
        makeGrade({ score: 90, date: new Date(base.getTime() + 1), weight: 0 }),
      ];
      const student = {
        id: '1',
        name: 'Student',
        grades,
        behaviorEvents: [],
      };
      const result = calculateStudentStats(student);
      // Implementation: totalWeight 0 → fallback to (70+90)/2 = 80
      expect(result.averageScore).toBe(80);
    });

    it('rounds averageScore to one decimal place', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 85, date: base, weight: 1 }),
        makeGrade({ score: 86, date: new Date(base.getTime() + 1), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.averageScore).toBe(85.5);
    });
  });

  describe('grade trend', () => {
    it('returns stable when fewer than 4 grades', () => {
      const base = new Date(2024, 0, 1);
      const student = {
        id: '1',
        name: 'S',
        grades: [
          makeGrade({ score: 95, date: base, weight: 1 }),
          makeGrade({ score: 40, date: new Date(base.getTime() + 1), weight: 1 }),
        ],
        behaviorEvents: [],
      };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('stable');
    });

    it('returns improving when recent half is more than 5 points higher', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 60, date: new Date(base), weight: 1 }),
        makeGrade({ score: 62, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 70, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 75, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      // prev half avg (60+62)/2=61, curr half (70+75)/2=72.5, delta 11.5 > 5
      expect(result.gradeTrend).toBe('improving');
    });

    it('returns declining when recent half is more than 5 points lower', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 85, date: new Date(base), weight: 1 }),
        makeGrade({ score: 88, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 70, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 72, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('declining');
    });

    it('returns stable when the drop is 5 points or less', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 90, date: new Date(base), weight: 1 }),
        makeGrade({ score: 90, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 86, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 86, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('stable');
    });

    it('stays stable when only one subject drops and another does not', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ subject: 'Math', score: 80, date: new Date(base), weight: 1 }),
        makeGrade({ subject: 'Math', score: 82, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ subject: 'English', score: 90, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ subject: 'English', score: 92, date: new Date(base.getTime() + 3), weight: 1 }),
        makeGrade({ subject: 'Math', score: 81, date: new Date(base.getTime() + 4), weight: 1 }),
        makeGrade({ subject: 'Math', score: 83, date: new Date(base.getTime() + 5), weight: 1 }),
        makeGrade({ subject: 'English', score: 60, date: new Date(base.getTime() + 6), weight: 1 }),
        makeGrade({ subject: 'English', score: 58, date: new Date(base.getTime() + 7), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('stable');
    });

    it('ignores undated grades when dated grades are enough to judge', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 80, date: new Date(base), weight: 1 }),
        makeGrade({ score: 82, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 81, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 83, date: new Date(base.getTime() + 3), weight: 1 }),
        makeGrade({ score: 40, date: new Date(0), weight: 1, dateIsInferred: true }),
        makeGrade({ score: 40, date: new Date(0), weight: 1, dateIsInferred: true }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('stable');
    });

    it('weights each half when grade weights differ', () => {
      const base = new Date(2024, 0, 1);
      // Equal weights would be improving: prev (40+90)/2=65, curr (70+72)/2=71.
      // With weights, prev is (40*1 + 90*10)/11 ≈ 85.5 and curr is 71, so the trend declines.
      const grades: Grade[] = [
        makeGrade({ score: 40, date: new Date(base), weight: 1 }),
        makeGrade({ score: 90, date: new Date(base.getTime() + 1), weight: 10 }),
        makeGrade({ score: 70, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 72, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('declining');
    });
  });

  describe('behavior counts and trend', () => {
    it('counts negative and positive events correctly', () => {
      const base = new Date(2024, 0, 1);
      const events: BehaviorEvent[] = [
        makeEvent({ date: new Date(base), category: EventType.NEGATIVE }),
        makeEvent({ date: new Date(base.getTime() + 1), category: EventType.NEGATIVE }),
        makeEvent({ date: new Date(base.getTime() + 2), category: EventType.POSITIVE }),
      ];
      const student = {
        id: '1',
        name: 'S',
        grades: [],
        behaviorEvents: events,
      };
      const result = calculateStudentStats(student);
      expect(result.negativeCount).toBe(2);
      expect(result.positiveCount).toBe(1);
    });

    it('returns stable behavior trend when fewer than 4 events', () => {
      const base = new Date(2024, 0, 1);
      const student = {
        id: '1',
        name: 'S',
        grades: [],
        behaviorEvents: [
          makeEvent({ date: base, category: EventType.POSITIVE }),
          makeEvent({ date: new Date(base.getTime() + 1), category: EventType.NEGATIVE }),
          makeEvent({ date: new Date(base.getTime() + 2), category: EventType.NEGATIVE }),
        ],
      };
      const result = calculateStudentStats(student);
      expect(result.behaviorTrend).toBe('stable');
      expect(result.behaviorOnlyTrend).toBe('stable');
    });

    it('does not call an odd run of similar events a decline', () => {
      const base = new Date(2024, 0, 1);
      const events = Array.from({ length: 5 }, (_, i) =>
        makeEvent({ date: new Date(base.getTime() + i), category: EventType.NEGATIVE, type: 'הפרעה' })
      );
      const student = { id: '1', name: 'S', grades: [], behaviorEvents: events };
      const result = calculateStudentStats(student);
      expect(result.behaviorOnlyTrend).toBe('stable');
    });

    it('returns declining only when the recent half is worse by at least 2 events', () => {
      const base = new Date(2024, 0, 1);
      const events: BehaviorEvent[] = [
        makeEvent({ date: base, category: EventType.POSITIVE, type: 'מילה טובה' }),
        makeEvent({ date: new Date(base.getTime() + 1), category: EventType.POSITIVE, type: 'מילה טובה' }),
        makeEvent({ date: new Date(base.getTime() + 2), category: EventType.NEGATIVE, type: 'הפרעה' }),
        makeEvent({ date: new Date(base.getTime() + 3), category: EventType.NEGATIVE, type: 'הפרעה' }),
      ];
      const student = { id: '1', name: 'S', grades: [], behaviorEvents: events };
      const result = calculateStudentStats(student);
      expect(result.behaviorOnlyTrend).toBe('declining');
    });

    it('keeps a one-event difference stable', () => {
      const base = new Date(2024, 0, 1);
      const events: BehaviorEvent[] = [
        makeEvent({ date: base, category: EventType.NEGATIVE, type: 'הפרעה' }),
        makeEvent({ date: new Date(base.getTime() + 1), category: EventType.POSITIVE, type: 'מילה טובה' }),
        makeEvent({ date: new Date(base.getTime() + 2), category: EventType.NEGATIVE, type: 'הפרעה' }),
        makeEvent({ date: new Date(base.getTime() + 3), category: EventType.NEGATIVE, type: 'הפרעה' }),
      ];
      const student = { id: '1', name: 'S', grades: [], behaviorEvents: events };
      const result = calculateStudentStats(student);
      expect(result.behaviorOnlyTrend).toBe('stable');
    });
  });

  describe('absence trend', () => {
    it('stays stable when the previous period has no data', () => {
      expect(absenceTrend(8, 0, false)).toBe('stable');
    });

    it('stays stable when absences change by one', () => {
      expect(absenceTrend(4, 3, true)).toBe('stable');
      expect(absenceTrend(3, 4, true)).toBe('stable');
    });

    it('declines only when absences rise by at least 2 against a real previous period', () => {
      expect(absenceTrend(5, 2, true)).toBe('declining');
    });

    it('improves when absences fall by at least 2', () => {
      expect(absenceTrend(1, 4, true)).toBe('improving');
    });
  });

  describe('risk level and risk score', () => {
    it('returns riskLevel low when riskScore above medium threshold', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 90, date: base, weight: 1 }),
        makeGrade({ score: 92, date: new Date(base.getTime() + 1), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.riskScore).toBeGreaterThan(7);
      expect(result.riskLevel).toBe('low');
    });

    it('returns riskLevel high when riskScore <= high threshold', () => {
      const settings: RiskSettings = {
        ...DEFAULT_RISK_SETTINGS,
        riskScoreHighThreshold: 4,
        riskScoreMediumThreshold: 7,
      };
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 30, date: base, weight: 1 }),
        makeGrade({ score: 35, date: new Date(base.getTime() + 1), weight: 1 }),
      ];
      // Many negative events and declining trend to push risk score down
      const events: BehaviorEvent[] = Array.from({ length: 10 }, (_, i) =>
        makeEvent({ date: new Date(base.getTime() + i), category: EventType.NEGATIVE })
      );
      const student = { id: '1', name: 'S', grades, behaviorEvents: events };
      const result = calculateStudentStats(student, settings);
      expect(result.riskScore).toBeLessThanOrEqual(4);
      expect(result.riskLevel).toBe('high');
    });

    it('clamps riskScore between 1 and 10', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 0, date: base, weight: 1 }),
        makeGrade({ score: 10, date: new Date(base.getTime() + 1), weight: 1 }),
      ];
      const manyNegatives = Array.from({ length: 20 }, (_, i) =>
        makeEvent({ date: new Date(base.getTime() + i), category: EventType.NEGATIVE })
      );
      const student = { id: '1', name: 'S', grades, behaviorEvents: manyNegatives };
      const result = calculateStudentStats(student);
      expect(result.riskScore).toBeGreaterThanOrEqual(1);
      expect(result.riskScore).toBeLessThanOrEqual(10);
    });
  });

  describe('edge cases and invariants', () => {
    it('preserves student id and name', () => {
      const student = {
        id: 'id-123',
        name: 'Full Name',
        grades: [] as Grade[],
        behaviorEvents: [] as BehaviorEvent[],
      };
      const result = calculateStudentStats(student);
      expect(result.id).toBe('id-123');
      expect(result.name).toBe('Full Name');
    });

    it('sorts grades and events by date', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 90, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 80, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 70, date: new Date(base), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.grades[0].date.getTime()).toBeLessThanOrEqual(result.grades[1].date.getTime());
      expect(result.grades[1].date.getTime()).toBeLessThanOrEqual(result.grades[2].date.getTime());
    });

    it('does not mutate input grades or events arrays', () => {
      const base = new Date(2024, 0, 1);
      const grades = [
        makeGrade({ score: 85, date: base, weight: 1 }),
      ];
      const events = [
        makeEvent({ date: base, category: EventType.NEUTRAL }),
      ];
      const student = { id: '1', name: 'S', grades: [...grades], behaviorEvents: [...events] };
      const result = calculateStudentStats(student);
      expect(student.grades).toHaveLength(1);
      expect(student.behaviorEvents).toHaveLength(1);
      expect(result.grades).not.toBe(student.grades);
      expect(result.behaviorEvents).not.toBe(student.behaviorEvents);
    });

    it('accepts custom RiskSettings', () => {
      const custom: RiskSettings = {
        ...DEFAULT_RISK_SETTINGS,
        minGradeThreshold: 60,
        riskScoreHighThreshold: 3,
        riskScoreMediumThreshold: 6,
      };
      const grades = [
        makeGrade({ score: 50, date: new Date(2024, 0, 1), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student, custom);
      expect(result.riskLevel).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(result.riskLevel);
    });
  });
});

describe('computeStudentStatsFromData', () => {
  it('returns same stats as calculateStudentStats for same data', () => {
    const base = new Date(2024, 0, 1);
    const grades: Grade[] = [
      makeGrade({ score: 70, date: base, weight: 1 }),
      makeGrade({ score: 90, date: new Date(base.getTime() + 1), weight: 1 }),
    ];
    const events: BehaviorEvent[] = [
      makeEvent({ date: base, category: EventType.POSITIVE }),
    ];
    const fromData = computeStudentStatsFromData(grades, events);
    const raw = {
      id: '',
      name: '',
      grades,
      behaviorEvents: events,
    };
    const full = calculateStudentStats(raw);
    expect(fromData.averageScore).toBe(full.averageScore);
    expect(fromData.negativeCount).toBe(full.negativeCount);
    expect(fromData.positiveCount).toBe(full.positiveCount);
    expect(fromData.gradeTrend).toBe(full.gradeTrend);
    expect(fromData.behaviorTrend).toBe(full.behaviorTrend);
    expect(fromData.riskLevel).toBe(full.riskLevel);
    expect(fromData.riskScore).toBe(full.riskScore);
  });

  it('handles empty grades and empty events', () => {
    const result = computeStudentStatsFromData([], []);
    expect(result.averageScore).toBe(0);
    expect(result.negativeCount).toBe(0);
    expect(result.positiveCount).toBe(0);
    expect(result.gradeTrend).toBe('stable');
    expect(result.behaviorTrend).toBe('stable');
    expect(result.riskLevel).toBeDefined();
    expect(result.riskScore).toBeGreaterThanOrEqual(1);
    expect(result.riskScore).toBeLessThanOrEqual(10);
  });
});
