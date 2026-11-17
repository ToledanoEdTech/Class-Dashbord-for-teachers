import { describe, it, expect } from 'vitest';
import {
  calculateStudentStats,
  computeStudentStatsFromData,
  computeStudentTrends,
  dayKey,
  type TrendContext,
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

// 12 שבועות, ימי לימוד א'-ה'. החלון האחרון: 4 השבועות האחרונים (שבועות 8–11).
const TERM_START = new Date(2024, 0, 7); // יום ראשון
const TERM_WEEKS = 12;

function schoolDay(week: number, day: number): Date {
  return new Date(TERM_START.getFullYear(), TERM_START.getMonth(), TERM_START.getDate() + week * 7 + day, 10);
}

function termContext(skipWeeks: number[] = []): TrendContext {
  const schoolDays = new Set<string>();
  for (let week = 0; week < TERM_WEEKS; week++) {
    if (skipWeeks.includes(week)) continue;
    for (let day = 0; day < 5; day++) schoolDays.add(dayKey(schoolDay(week, day)));
  }
  return {
    start: TERM_START,
    end: new Date(TERM_START.getFullYear(), TERM_START.getMonth(), TERM_START.getDate() + TERM_WEEKS * 7 - 1),
    schoolDays,
  };
}

/** count אירועים מפוזרים על ימי הלימוד בשבועות הנתונים. */
function spread(count: number, weeks: number[], make: (date: Date) => BehaviorEvent): BehaviorEvent[] {
  const days = weeks.flatMap((week) => [0, 1, 2, 3, 4].map((day) => schoolDay(week, day)));
  return Array.from({ length: count }, (_, i) => make(days[i % days.length]));
}

const absence = (date: Date) => makeEvent({ date, category: EventType.NEGATIVE, type: 'חיסור' });
const disruption = (date: Date) => makeEvent({ date, category: EventType.NEGATIVE, type: 'הפרעה' });
const praise = (date: Date) => makeEvent({ date, category: EventType.POSITIVE, type: 'מילה טובה' });

const BASELINE_WEEKS = [0, 1, 2, 3, 4, 5, 6, 7];
const RECENT_WEEKS = [8, 9, 10, 11];

describe('computeStudentTrends — absences', () => {
  it('does not show improvement when the student was absent a lot in the last week', () => {
    const events = [
      ...spread(40, BASELINE_WEEKS, absence),
      ...spread(10, [11], absence),
    ];
    const result = computeStudentTrends([], events, termContext());
    expect(result.absenceTrend).not.toBe('improving');
  });

  it('keeps a one-absence difference stable and a two-absence rise moderate, never sharp', () => {
    const baseline = spread(4, BASELINE_WEEKS, absence); // צפוי 2 בחלון האחרון
    expect(computeStudentTrends([], [...baseline, ...spread(3, RECENT_WEEKS, absence)], termContext()).absenceTrend).toBe('stable');
    expect(computeStudentTrends([], [...baseline, ...spread(4, RECENT_WEEKS, absence)], termContext()).absenceTrend).toBe('moderate_decline');
  });

  it('treats one sick day (about 6 lessons) as a moderate decline', () => {
    const oneDay = Array.from({ length: 6 }, () => absence(schoolDay(10, 2)));
    const result = computeStudentTrends([], oneDay, termContext());
    expect(result.absenceTrend).toBe('moderate_decline');
  });

  it('marks a large recent rise as a sharp decline', () => {
    const events = [...spread(4, BASELINE_WEEKS, absence), ...spread(18, RECENT_WEEKS, absence)];
    const result = computeStudentTrends([], events, termContext());
    expect(result.absenceTrend).toBe('sharp_decline');
    expect(result.details.absences).toEqual({ recent: 18, expected: 2 });
  });

  it('shows improvement when recent absences are clearly below the usual rate', () => {
    const events = [...spread(40, BASELINE_WEEKS, absence), ...spread(4, [8, 9], absence)];
    expect(computeStudentTrends([], events, termContext()).absenceTrend).toBe('improving');
  });

  it('does not count a holiday as improvement', () => {
    // שבועות 8–10 חופשה: נשאר שבוע לימודים אחד בחלון האחרון, עם חיסור אחד.
    const events = [...spread(20, BASELINE_WEEKS, absence), ...spread(1, [11], absence)];
    const result = computeStudentTrends([], events, termContext([8, 9, 10]));
    expect(result.absenceTrend).toBe('stable');
  });

  it('does not judge a trend from a very short range', () => {
    const start = schoolDay(0, 0);
    const context: TrendContext = { start, end: schoolDay(1, 0) };
    const events = Array.from({ length: 10 }, () => absence(schoolDay(1, 0)));
    expect(computeStudentTrends([], events, context).absenceTrend).toBe('stable');
  });
});

describe('computeStudentTrends — behavior', () => {
  it('shows improvement when discipline events dropped, even with many recent absences', () => {
    const events = [
      ...spread(16, BASELINE_WEEKS, disruption),
      ...spread(2, RECENT_WEEKS, disruption),
      ...spread(20, RECENT_WEEKS, absence),
    ];
    const result = computeStudentTrends([], events, termContext());
    expect(result.behaviorOnlyTrend).toBe('improving');
    expect(result.absenceTrend).toBe('sharp_decline');
  });

  it('marks a strong rise in discipline events as a sharp decline', () => {
    const events = [...spread(2, BASELINE_WEEKS, disruption), ...spread(8, RECENT_WEEKS, disruption)];
    expect(computeStudentTrends([], events, termContext()).behaviorOnlyTrend).toBe('sharp_decline');
  });

  it('marks a small rise as a moderate decline', () => {
    const events = [...spread(4, BASELINE_WEEKS, disruption), ...spread(4, RECENT_WEEKS, disruption)];
    expect(computeStudentTrends([], events, termContext()).behaviorOnlyTrend).toBe('moderate_decline');
  });

  it('keeps the same rate stable even with many events', () => {
    const events = [...spread(20, BASELINE_WEEKS, disruption), ...spread(10, RECENT_WEEKS, disruption)];
    expect(computeStudentTrends([], events, termContext()).behaviorOnlyTrend).toBe('stable');
  });

  it('shows improvement when positive events rise and negatives do not', () => {
    const events = [...spread(2, BASELINE_WEEKS, praise), ...spread(6, RECENT_WEEKS, praise)];
    expect(computeStudentTrends([], events, termContext()).behaviorOnlyTrend).toBe('improving');
  });
});

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
    it('caps a single low grade at a moderate decline', () => {
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
      expect(result.gradeTrend).toBe('moderate_decline');
    });

    it('compares the latest grades in a subject to the earlier ones', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [85, 84, 86, 85, 70, 68].map((score, i) =>
        makeGrade({ score, date: new Date(base.getTime() + i), weight: 1 })
      );
      const result = calculateStudentStats({ id: '1', name: 'S', grades, behaviorEvents: [] });
      expect(result.gradeTrend).toBe('sharp_decline');
      expect(result.trendDetails?.grades?.recentAverage).toBe(69);
    });

    it('does not treat different subjects with one grade each as a decline', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ subject: 'Math', score: 90, date: new Date(base), weight: 1 }),
        makeGrade({ subject: 'English', score: 80, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ subject: 'History', score: 70, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ subject: 'Science', score: 60, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('stable');
    });

    it('shows improvement when one subject rises and the other is flat', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ subject: 'Math', score: 60, date: new Date(base), weight: 1 }),
        makeGrade({ subject: 'English', score: 70, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ subject: 'Math', score: 62, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ subject: 'English', score: 71, date: new Date(base.getTime() + 3), weight: 1 }),
        makeGrade({ subject: 'Math', score: 80, date: new Date(base.getTime() + 4), weight: 1 }),
        makeGrade({ subject: 'English', score: 72, date: new Date(base.getTime() + 5), weight: 1 }),
        makeGrade({ subject: 'Math', score: 85, date: new Date(base.getTime() + 6), weight: 1 }),
        makeGrade({ subject: 'English', score: 72, date: new Date(base.getTime() + 7), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('improving');
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

    it('returns a sharp decline when the recent half is more than 8 points lower', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 85, date: new Date(base), weight: 1 }),
        makeGrade({ score: 88, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 70, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 72, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('sharp_decline');
    });

    it('returns a moderate decline when the drop is more than 3 and at most 8', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 90, date: new Date(base), weight: 1 }),
        makeGrade({ score: 90, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 86, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 86, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('moderate_decline');
    });

    it('returns stable when the drop is 3 points or less', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ score: 90, date: new Date(base), weight: 1 }),
        makeGrade({ score: 90, date: new Date(base.getTime() + 1), weight: 1 }),
        makeGrade({ score: 88, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ score: 88, date: new Date(base.getTime() + 3), weight: 1 }),
      ];
      const student = { id: '1', name: 'S', grades, behaviorEvents: [] };
      const result = calculateStudentStats(student);
      expect(result.gradeTrend).toBe('stable');
    });

    it('shows a sharp decline when a large share of the grade weight falls hard', () => {
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
      expect(result.gradeTrend).toBe('sharp_decline');
    });

    it('stays stable when a light assignment drops and the heavy subject does not', () => {
      const base = new Date(2024, 0, 1);
      const grades: Grade[] = [
        makeGrade({ subject: 'Math', score: 80, date: new Date(base), weight: 10 }),
        makeGrade({ subject: 'Math', score: 82, date: new Date(base.getTime() + 1), weight: 10 }),
        makeGrade({ subject: 'English', score: 90, date: new Date(base.getTime() + 2), weight: 1 }),
        makeGrade({ subject: 'English', score: 70, date: new Date(base.getTime() + 3), weight: 1 }),
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
      expect(result.gradeTrend).toBe('sharp_decline');
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

    it('uses the given trend context for absence and behavior trends', () => {
      const events = [...spread(4, BASELINE_WEEKS, absence), ...spread(18, RECENT_WEEKS, absence)];
      const result = calculateStudentStats({ id: '1', name: 'S', grades: [], behaviorEvents: events }, DEFAULT_RISK_SETTINGS, termContext());
      expect(result.absenceTrend).toBe('sharp_decline');
      expect(result.behaviorOnlyTrend).toBe('stable');
      expect(result.behaviorTrend).toBe('sharp_decline');
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
