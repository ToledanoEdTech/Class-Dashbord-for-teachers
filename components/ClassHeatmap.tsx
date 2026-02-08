import React, { useMemo, useState } from 'react';
import { Student, EventType, BehaviorEvent, isAbsenceEvent, isOtherNegativeEvent } from '../types';

const DAY_LABELS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']; // Sun=0 .. Fri=5
const DEFAULT_MIN_LESSON = 0;
const DEFAULT_MAX_LESSON = 9;

export type HeatmapMode = 'all' | 'absences' | 'other';

interface CellData {
  day: number;
  lessonNumber: number;
  count: number;
  topIssue: string;
  topSubject: string;
}

interface ClassHeatmapProps {
  students: Student[];
  mode?: HeatmapMode;
  onModeChange?: (mode: HeatmapMode) => void;
}

function filterNegativeByMode(events: BehaviorEvent[], mode: HeatmapMode): BehaviorEvent[] {
  const neg = events.filter((e) => e.category === EventType.NEGATIVE);
  if (mode === 'all') return neg;
  if (mode === 'absences') return neg.filter(isAbsenceEvent);
  return neg.filter(isOtherNegativeEvent);
}

const ClassHeatmap: React.FC<ClassHeatmapProps> = ({
  students,
  mode: controlledMode,
  onModeChange,
}) => {
  const [internalMode, setInternalMode] = useState<HeatmapMode>('all');
  const mode = controlledMode ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;

  const [tooltip, setTooltip] = useState<CellData | null>(null);

  const { grid, maxIntensity, minLesson, maxLesson } = useMemo(() => {
    const negEvents = students.flatMap((s) =>
      filterNegativeByMode(s.behaviorEvents, mode)
    );

    const rawLessonNumbers = negEvents
      .filter((e) => e.date.getDay() <= 5)
      .map((e) => {
        const n = e.lessonNumber;
        return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
      });
    const minLesson =
      rawLessonNumbers.length > 0 ? Math.min(...rawLessonNumbers) : DEFAULT_MIN_LESSON;
    const maxLesson =
      rawLessonNumbers.length > 0 ? Math.max(...rawLessonNumbers) : DEFAULT_MAX_LESSON;

    const byCell: Record<
      string,
      { count: number; types: Record<string, number>; subjects: Record<string, number> }
    > = {};
    negEvents.forEach((e) => {
      const day = e.date.getDay();
      if (day > 5) return;
      const lessonNum =
        typeof e.lessonNumber === 'number' && !Number.isNaN(e.lessonNumber)
          ? e.lessonNumber
          : 0;
      const lesson = Math.max(minLesson, Math.min(maxLesson, lessonNum));
      const key = `${day}-${lesson}`;
      if (!byCell[key]) byCell[key] = { count: 0, types: {}, subjects: {} };
      byCell[key].count += 1;
      const t = (e.type || 'אחר').trim() || 'אחר';
      byCell[key].types[t] = (byCell[key].types[t] || 0) + 1;
      const subj = (e.subject || 'לא צוין').trim() || 'לא צוין';
      byCell[key].subjects[subj] = (byCell[key].subjects[subj] || 0) + 1;
    });

    let maxIntensity = 0;
    const grid: CellData[][] = [];
    for (let lesson = minLesson; lesson <= maxLesson; lesson++) {
      const row: CellData[] = [];
      for (let day = 0; day <= 5; day++) {
        const key = `${day}-${lesson}`;
        const data = byCell[key];
        const count = data?.count ?? 0;
        let topIssue = '—';
        let topSubject = '—';
        if (data && Object.keys(data.types).length > 0) {
          topIssue =
            Object.entries(data.types).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
        }
        if (data && Object.keys(data.subjects).length > 0) {
          topSubject =
            Object.entries(data.subjects).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
        }
        if (count > maxIntensity) maxIntensity = count;
        row.push({ day, lessonNumber: lesson, count, topIssue, topSubject });
      }
      grid.push(row);
    }
    return { grid, maxIntensity, minLesson, maxLesson };
  }, [students, mode]);

  const getBgColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (maxIntensity === 0) return 'bg-slate-100';
    const ratio = count / maxIntensity;
    if (ratio <= 0.25) return 'bg-red-200';
    if (ratio <= 0.5) return 'bg-red-400';
    if (ratio <= 0.75) return 'bg-red-500';
    return 'bg-red-700';
  };

  return (
    <div className="relative bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h3 className="text-lg font-bold text-slate-800">
          מתי מתרחשים אירועי משמעת? (חום לפי יום ושיעור)
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className="text-slate-500 text-sm">הצג:</span>
          {(
            [
              { value: 'all' as HeatmapMode, label: 'כל השליליים' },
              { value: 'absences' as HeatmapMode, label: 'חיסורים בלבד' },
              { value: 'other' as HeatmapMode, label: 'שליליים ללא חיסורים' },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === value
                  ? 'bg-primary-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tooltip area above grid – smooth fade/slide, no overlap */}
      <div className="min-h-[72px] mb-2 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 relative flex items-center justify-center overflow-hidden">
        <div
          className={`w-full min-h-[52px] flex flex-col justify-center transition-all duration-300 ease-out ${
            tooltip ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[-6px]'
          }`}
        >
          {tooltip ? (
            <>
              <p className="font-bold text-slate-800">
                {DAY_LABELS_HE[tooltip.day]} • שיעור {tooltip.lessonNumber}
              </p>
              <p className="text-primary-600 font-semibold">סה״כ אירועים שליליים: {tooltip.count}</p>
              <p className="text-slate-600">נושא עיקרי: {tooltip.topIssue}</p>
              <p className="text-slate-600">מקצוע עם הכי הרבה אירועים: {tooltip.topSubject}</p>
            </>
          ) : (
            <span className="text-slate-400 text-sm">העבר את הסמן על תא כדי לראות פרטים</span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto relative">
        <div
          className="inline-grid gap-0.5 min-w-full"
          style={{
            gridTemplateColumns: `auto repeat(6, minmax(2rem, 1fr))`,
            gridTemplateRows: `auto repeat(${maxLesson - minLesson + 1}, 2rem)`,
          }}
        >
          <div className="col-start-1 row-start-1 bg-transparent w-12" />
          {DAY_LABELS_HE.map((label, i) => (
            <div
              key={label}
              className="text-center text-xs font-semibold text-slate-600 py-1"
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              {label}
            </div>
          ))}
          {grid.map((row, rowIdx) => (
            <React.Fragment key={rowIdx}>
              <div
                className="flex items-center justify-center text-xs font-medium text-slate-500 pr-1"
                style={{ gridColumn: 1, gridRow: rowIdx + 2 }}
              >
                {row[0].lessonNumber}
              </div>
              {row.map((cell) => (
                <div
                  key={`${cell.day}-${cell.lessonNumber}`}
                  className={`h-8 min-w-[2rem] rounded-md transition-all ${getBgColor(cell.count)} ${cell.count > 0 ? 'cursor-pointer ring-1 ring-slate-200/80' : ''}`}
                  style={{ gridColumn: cell.day + 2, gridRow: rowIdx + 2 }}
                  onMouseEnter={() => setTooltip(cell)}
                  onMouseLeave={() => setTooltip(null)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-slate-500">
        <span>עוצמה:</span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-slate-100" /> 0
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-red-200" /> נמוך
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-red-500" /> בינוני
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded bg-red-700" /> גבוה
        </span>
      </div>
    </div>
  );
};

export default ClassHeatmap;
