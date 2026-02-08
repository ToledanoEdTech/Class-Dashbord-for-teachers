import React, { useMemo, useState, useRef } from 'react';
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
  types?: Record<string, number>;
  subjects?: Record<string, number>;
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
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
        row.push({
          day,
          lessonNumber: lesson,
          count,
          topIssue,
          topSubject,
          types: data?.types ?? {},
          subjects: data?.subjects ?? {},
        });
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

      {/* Hint text - static, no layout shift */}
      <p className="text-slate-400 text-sm mb-3">העבר את הסמן על תא כדי לראות פרטים</p>

      <div ref={containerRef} className="overflow-x-auto relative">
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
                  className={`h-8 min-w-[2rem] rounded-md transition-all duration-200 ${getBgColor(cell.count)} ${cell.count > 0 ? 'cursor-pointer ring-1 ring-slate-200/80 hover:ring-2 hover:ring-primary-400 hover:scale-105' : ''}`}
                  style={{ gridColumn: cell.day + 2, gridRow: rowIdx + 2 }}
                  onMouseEnter={(e) => {
                    setTooltip(cell);
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
                  }}
                  onMouseLeave={() => {
                    setTooltip(null);
                    setTooltipPos(null);
                  }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Floating tooltip - position:fixed, no layout shift */}
      {tooltip && tooltipPos && (
        <div
          className="fixed z-50 pointer-events-none transition-opacity duration-200 opacity-100"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-white/98 backdrop-blur-md rounded-xl shadow-xl border border-slate-200/90 px-4 py-3 min-w-[220px] max-w-[280px]">
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-r border-b border-slate-200/90 rotate-45" />
            <p className="font-bold text-slate-800 text-base border-b border-slate-100 pb-2 mb-2">
              {DAY_LABELS_HE[tooltip.day]} • שיעור {tooltip.lessonNumber}
            </p>
            <p className="text-primary-600 font-semibold text-sm mb-2">
              סה״כ אירועים: {tooltip.count}
            </p>
            <p className="text-slate-600 text-sm">
              <span className="text-slate-500">נושא עיקרי:</span> {tooltip.topIssue}
            </p>
            <p className="text-slate-600 text-sm mt-1">
              <span className="text-slate-500">מקצוע:</span> {tooltip.topSubject}
            </p>
            {tooltip.types && Object.keys(tooltip.types).length > 1 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">פירוט לפי סוג:</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(tooltip.types)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([t, n]) => (
                      <span
                        key={t}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs"
                      >
                        {t}: {n}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
