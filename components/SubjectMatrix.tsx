import React, { useMemo, useState } from 'react';
import { Student, Grade } from '../types';
import { getDisplayName } from '../utils/displayName';
import { Search, ArrowUp, ArrowDown, ChevronUp, ChevronDown, Minus, BarChart3, X, ListFilter } from 'lucide-react';
import HelpTip from './HelpTip';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface SubjectMatrixProps {
  students: Student[];
  isAnonymous?: boolean;
}

interface CellData {
  avg: number | null;
  weightedAvg: number | null;
  count: number;
  grades: Grade[];
}

interface RowData {
  student: Student;
  displayName: string;
  generalAvg: number;
  weightedGeneralAvg: number;
  cells: CellData[];
}

function getSubjectData(grades: Grade[], subject: string): CellData {
  const bySubject = grades.filter((g) => ((g.subject || '').trim() || 'כללי') === subject);
  if (bySubject.length === 0) return { avg: null, weightedAvg: null, count: 0, grades: [] };
  const sum = bySubject.reduce((s, g) => s + g.score, 0);
  const avg = Math.round((sum / bySubject.length) * 10) / 10;
  const totalWeight = bySubject.reduce((s, g) => s + (g.weight || 1), 0);
  const weightedSum = bySubject.reduce((s, g) => s + g.score * (g.weight || 1), 0);
  const weightedAvg = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : avg;
  return { avg, weightedAvg, count: bySubject.length, grades: bySubject };
}

function getWeightedGeneralAvg(grades: Grade[]): number {
  if (grades.length === 0) return 0;
  const totalWeight = grades.reduce((s, g) => s + (g.weight || 1), 0);
  const weightedSum = grades.reduce((s, g) => s + g.score * (g.weight || 1), 0);
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
}

function getCellClass(grade: number | null): string {
  if (grade === null) return 'bg-slate-100 text-slate-400';
  if (grade < 55) return 'bg-red-100 text-red-800 font-semibold';
  if (grade <= 75) return 'bg-amber-100 text-amber-800 font-medium';
  if (grade > 85) return 'bg-emerald-100 text-emerald-800 font-semibold';
  return 'bg-slate-50 text-slate-700';
}

type GradeRangeFilter = 'all' | 'below55' | '55-75' | '76-85' | 'above85' | 'above90';

const GRADE_RANGE_LABELS: Record<GradeRangeFilter, string> = {
  all: 'כל הטווחים',
  below55: 'מתחת ל-55',
  '55-75': '55-75',
  '76-85': '76-85',
  above85: 'מעל 85',
  above90: 'מעל 90',
};

function studentHasGradeInRange(row: RowData, range: GradeRangeFilter): boolean {
  if (range === 'all') return true;
  const check = (v: number) => {
    if (range === 'below55') return v < 55;
    if (range === '55-75') return v >= 55 && v <= 75;
    if (range === '76-85') return v >= 76 && v <= 85;
    if (range === 'above85') return v > 85;
    if (range === 'above90') return v > 90;
    return true;
  };
  for (const cell of row.cells) {
    if (cell.avg !== null && check(cell.avg)) return true;
  }
  if (row.generalAvg !== null && check(row.generalAvg)) return true;
  return false;
}

function isGapCell(cell: CellData, personalAvg: number): boolean {
  if (cell.avg === null) return false;
  if (cell.avg < 55) return true; // נכשל
  if (cell.avg > personalAvg + 12) return true; // גבוה משמעותית מהממוצע האישי
  return false;
}

interface GradeDetailDialogProps {
  studentName: string;
  subject: string;
  grades: Grade[];
  onClose: () => void;
}

function GradeDetailDialog({ studentName, subject, grades, onClose }: GradeDetailDialogProps) {
  const sorted = [...grades].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const avg = grades.length > 0
    ? Math.round((grades.reduce((s, g) => s + g.score, 0) / grades.length) * 10) / 10
    : null;
  const weightedAvg = grades.length > 0 ? getSubjectData(grades, subject).weightedAvg : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-bold text-slate-800">
            {studentName} – {subject}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="px-4 py-2 border-b border-slate-100 text-sm text-slate-600">
          ממוצע פשוט: {avg ?? '—'} | ממוצע משוקלל: {weightedAvg ?? '—'} | סה״כ {grades.length} ציונים
        </div>
        <div className="overflow-auto flex-1 p-4">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-2">משימה</th>
                <th className="py-2 pr-2">ציון</th>
                <th className="py-2 pr-2">משקל</th>
                <th className="py-2 pr-2">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((g, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-2 font-medium">{g.assignment || '—'}</td>
                  <td className="py-2 pr-2">{g.score}</td>
                  <td className="py-2 pr-2">{g.weight ?? 1}</td>
                  <td className="py-2 pr-2 text-slate-500">{format(new Date(g.date), 'dd/MM/yyyy', { locale: he })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface RadarModalProps {
  row: RowData;
  subjectList: string[];
  onClose: () => void;
}

function RadarModal({ row, subjectList, onClose }: RadarModalProps) {
  const radarData = useMemo(() => {
    return subjectList.map((subj, i) => {
      const cell = row.cells[i];
      const val = cell?.avg ?? 0;
      return {
        subject: subj.length > 8 ? subj.slice(0, 7) + '…' : subj,
        fullSubject: subj,
        value: val,
        fullMark: 100,
      };
    }).filter((d) => d.value > 0);
  }, [row, subjectList]);

  if (radarData.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-bold text-slate-800 mb-2">גרף רדאר – {row.displayName}</h3>
          <p className="text-slate-500 text-sm">אין מספיק נתוני ציונים להצגת גרף רדאר.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium">סגור</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-lg p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800">גרף רדאר – {row.displayName}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="ציון" dataKey="value" stroke="#0c8ee6" fill="#0c8ee6" fillOpacity={0.4} />
              <Tooltip
                formatter={(value: number, _name: string, props: any) => [
                  value,
                  props?.payload?.fullSubject ?? '',
                ]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const SubjectMatrix: React.FC<SubjectMatrixProps> = ({ students, isAnonymous = false }) => {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string[]>([]);
  const [gradeRangeFilter, setGradeRangeFilter] = useState<GradeRangeFilter>('all');
  const [gradeDetailCell, setGradeDetailCell] = useState<{ student: Student; subject: string; grades: Grade[]; displayName: string } | null>(null);
  const [radarRow, setRadarRow] = useState<RowData | null>(null);
  const [showWeighted, setShowWeighted] = useState(false);
  const [showSubjectPopover, setShowSubjectPopover] = useState(false);

  const { subjectList, columns, rows, classAverages, classWeightedAverages } = useMemo(() => {
    const subjectSet = new Set<string>();
    students.forEach((s) => {
      s.grades.forEach((g) => {
        const subj = (g.subject || '').trim() || 'כללי';
        subjectSet.add(subj);
      });
    });
    const list = Array.from(subjectSet).sort((a, b) => a.localeCompare(b, 'he'));
    const cols = ['ממוצע', ...list];

    const r: RowData[] = students.map((student, idx) => {
      const subjectListLocal = list;
      const cells: CellData[] = subjectListLocal.map((subj) => getSubjectData(student.grades, subj));
      const generalAvg = student.averageScore;
      const weightedGeneralAvg = getWeightedGeneralAvg(student.grades);
      return {
        student,
        displayName: getDisplayName(student.name, idx, isAnonymous),
        generalAvg,
        weightedGeneralAvg,
        cells,
      };
    });

    const classAvgs: (number | null)[] = cols.map((_, colIdx) => {
      if (colIdx === 0) {
        const vals = r.map((x) => x.generalAvg).filter((v) => v != null && !isNaN(v));
        return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
      }
      const subjIdx = colIdx - 1;
      const vals = r.map((x) => x.cells[subjIdx]?.avg).filter((v): v is number => v != null);
      return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
    });

    const classWeighted: (number | null)[] = cols.map((_, colIdx) => {
      if (colIdx === 0) return classAvgs[0];
      const subjIdx = colIdx - 1;
      const vals = r.map((x) => x.cells[subjIdx]?.weightedAvg).filter((v): v is number => v != null);
      return vals.length > 0 ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
    });

    return {
      subjectList: list,
      columns: cols,
      rows: r,
      classAverages: classAvgs,
      classWeightedAverages: classWeighted,
    };
  }, [students, isAnonymous]);

  const filteredColumns = useMemo(() => {
    if (subjectFilter.length === 0) return columns;
    return ['ממוצע', ...columns.slice(1).filter((c) => subjectFilter.includes(c))];
  }, [columns, subjectFilter]);

  const colIndexInFull = (displayIdx: number): number => {
    const name = filteredColumns[displayIdx];
    return columns.indexOf(name);
  };

  const displayRows = useMemo(() => {
    let filtered = rows;
    if (riskFilter !== 'all') {
      filtered = filtered.filter((r) => r.student.riskLevel === riskFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter(
        (r) => r.displayName.includes(searchTerm) || r.student.id.includes(searchTerm)
      );
    }
    if (gradeRangeFilter !== 'all') {
      filtered = filtered.filter((r) => studentHasGradeInRange(r, gradeRangeFilter));
    }
    if (sortCol !== null) {
      const fullSortCol = sortCol >= 1 && subjectFilter.length > 0
        ? columns.indexOf(filteredColumns[sortCol])
        : sortCol;
      filtered = [...filtered].sort((a, b) => {
        let aVal: number | null = null;
        let bVal: number | null = null;
        if (fullSortCol === 0) {
          aVal = a.generalAvg;
          bVal = b.generalAvg;
        } else {
          const cellIdx = fullSortCol - 1;
          aVal = a.cells[cellIdx]?.avg ?? null;
          bVal = b.cells[cellIdx]?.avg ?? null;
        }
        const aNum = aVal ?? -Infinity;
        const bNum = bVal ?? -Infinity;
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      });
    }
    return filtered;
  }, [rows, riskFilter, searchTerm, gradeRangeFilter, sortCol, sortDir, subjectFilter, filteredColumns, columns]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colIdx);
      setSortDir('desc');
    }
  };

  const handleCellClick = (row: RowData, colIdx: number) => {
    if (colIdx === 0) return;
    const subjIdx = colIndexInFull(colIdx) - 1;
    const cell = row.cells[subjIdx];
    if (!cell || cell.grades.length === 0) return;
    const subject = subjectList[subjIdx];
    setGradeDetailCell({
      student: row.student,
      subject,
      grades: cell.grades,
      displayName: row.displayName,
    });
  };

  const renderComparisonIndicator = (value: number | null, classAvg: number | null) => {
    if (value === null || classAvg === null) return null;
    const diff = value - classAvg;
    if (Math.abs(diff) < 0.5) return <Minus size={10} className="text-slate-400 shrink-0" title="כמו ממוצע כיתתי" />;
    if (diff > 0) return <ChevronUp size={10} className="text-emerald-600 shrink-0" title={`מעל ממוצע כיתתי ב-${diff.toFixed(1)}`} />;
    return <ChevronDown size={10} className="text-red-500 shrink-0" title={`מתחת לממוצע כיתתי ב-${Math.abs(diff).toFixed(1)}`} />;
  };

  const renderCell = (row: RowData, colIdx: number) => {
    const fullColIdx = colIndexInFull(colIdx);
    const classAvg = classAverages[fullColIdx];
    const isGap = fullColIdx >= 1 && isGapCell(row.cells[fullColIdx - 1], row.generalAvg);

    if (colIdx === 0) {
      return (
        <td
          key={colIdx}
          className={`matrix-cell px-1 sm:px-3 py-1 sm:py-2.5 text-center min-w-[36px] sm:min-w-[80px] border-l border-slate-100 dark:border-slate-600 text-[10px] sm:text-sm ${getCellClass(row.generalAvg)}`}
        >
          <div className="flex items-center justify-center gap-0.5 sm:gap-1">
            {row.generalAvg}
            {renderComparisonIndicator(row.generalAvg, classAvg)}
          </div>
        </td>
      );
    }

    const subjIdx = fullColIdx - 1;
    const cell = row.cells[subjIdx];
    const displayVal = showWeighted ? cell?.weightedAvg : cell?.avg;
    const hasGrades = cell && cell.grades.length > 0;

    return (
      <td
        key={colIdx}
        onClick={() => hasGrades && handleCellClick(row, colIdx)}
        className={`matrix-cell group relative px-1 sm:px-3 py-1 sm:py-2.5 text-center min-w-[36px] sm:min-w-[80px] border-l border-slate-100 dark:border-slate-600 text-[10px] sm:text-sm ${getCellClass(displayVal ?? null)} ${hasGrades ? 'cursor-pointer hover:ring-1 hover:ring-primary-300 dark:hover:ring-primary-500 rounded' : ''} ${isGap ? 'ring-1 ring-amber-400 dark:ring-amber-500' : ''}`}
      >
        <div className="flex items-center justify-center gap-1">
          <span>{displayVal === null ? '—' : displayVal}</span>
          {renderComparisonIndicator(displayVal ?? null, classAvg)}
        </div>
        {hasGrades && (
          <div className="invisible group-hover:visible pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg min-w-[140px] max-w-[220px]">
            <div className="text-[10px] text-slate-300 mb-1">לחץ לפרטים מלאים</div>
            {cell!.grades.slice(0, 6).map((g, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span>{g.assignment || 'ציון'}</span>
                <span className="font-medium">{g.score}</span>
              </div>
            ))}
            {cell!.grades.length > 6 && (
              <div className="text-slate-400 mt-0.5">+{cell!.grades.length - 6} נוספים</div>
            )}
          </div>
        )}
      </td>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pb-safe animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
          מטריצת מקצועות
          <HelpTip text="טבלת ציונים לפי תלמיד ומקצוע. לחץ על כותרת עמודה למיון. לחץ על תא לפרטי ציונים. לחץ על אייקון הגרף לצפייה ברادאר." />
        </h2>
        <p className="text-slate-500 text-sm md:text-base mt-1">צפייה בציונים לפי תלמיד ומקצוע – לחץ על תא לפרטים, על כותרת למיון</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="חיפוש תלמיד..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 text-sm min-h-[40px]"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value as any)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px]"
        >
          <option value="all">כל רמות הסיכון</option>
          <option value="high">סיכון גבוה</option>
          <option value="medium">סיכון בינוני</option>
          <option value="low">סיכון נמוך</option>
        </select>
        <select
          value={gradeRangeFilter}
          onChange={(e) => setGradeRangeFilter(e.target.value as GradeRangeFilter)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px]"
        >
          {(Object.keys(GRADE_RANGE_LABELS) as GradeRangeFilter[]).map((k) => (
            <option key={k} value={k}>{GRADE_RANGE_LABELS[k]}</option>
          ))}
        </select>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSubjectPopover((v) => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px] hover:bg-slate-50"
          >
            <ListFilter size={16} className="text-slate-500" />
            {subjectFilter.length === 0 ? 'כל המקצועות' : `מקצועות (${subjectFilter.length})`}
            <ChevronDown size={14} className={`transition-transform ${showSubjectPopover ? 'rotate-180' : ''}`} />
          </button>
          {showSubjectPopover && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSubjectPopover(false)} aria-hidden="true" />
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] max-h-[280px] overflow-auto bg-white rounded-xl shadow-elevated border border-slate-200 py-2 animate-scale-in">
                <div className="px-3 py-1.5 flex justify-between items-center border-b border-slate-100 mb-1">
                  <span className="text-xs font-semibold text-slate-600">בחר מקצועות להצגה</span>
                  {subjectFilter.length > 0 && (
                    <button type="button" onClick={() => setSubjectFilter([])} className="text-xs text-primary-600 hover:underline">
                      נקה
                    </button>
                  )}
                </div>
                {subjectList.map((s) => (
                  <label key={s} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subjectFilter.length === 0 || subjectFilter.includes(s)}
                      onChange={(e) => {
                        if (subjectFilter.length === 0) {
                          setSubjectFilter(subjectList.filter((x) => x !== s));
                        } else {
                          setSubjectFilter(e.target.checked ? [...subjectFilter, s] : subjectFilter.filter((x) => x !== s));
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">{s}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showWeighted}
            onChange={(e) => setShowWeighted(e.target.checked)}
          />
          ממוצע משוקלל בתאים
        </label>
        <span className="text-xs text-slate-400 self-center">
          {displayRows.length} מתוך {rows.length} תלמידים
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100/80 dark:border-slate-600 overflow-hidden">
        <p className="sr-only">במובייל: גלול ימינה/שמאלה כדי לראות את כל המקצועות</p>
        <div className="overflow-x-auto overflow-y-auto overflow-touch max-h-[70vh] min-h-[200px] -webkit-overflow-scrolling-touch">
          <table className="w-full border-collapse text-right min-w-0 matrix-table">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/80 border-b border-slate-200 dark:border-slate-600">
                <th className="sticky top-0 right-0 z-20 bg-slate-100 dark:bg-slate-700 border-l border-slate-200 dark:border-slate-600 px-1.5 sm:px-4 py-1.5 sm:py-3 font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap min-w-[70px] sm:min-w-[120px] text-[10px] sm:text-base shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  שם התלמיד
                </th>
                {filteredColumns.map((subj, i) => (
                  <th
                    key={subj}
                    onClick={() => handleSort(i)}
                    className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-700 px-1 sm:px-3 py-1.5 sm:py-3 font-semibold text-slate-600 dark:text-slate-300 text-[10px] sm:text-sm whitespace-nowrap min-w-[36px] sm:min-w-[90px] border-l border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-600 transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {subj}
                      {sortCol === i && (
                        sortDir === 'desc' ? (
                          <ArrowDown size={12} className="text-primary-500" />
                        ) : (
                          <ArrowUp size={12} className="text-primary-500" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.student.id} className="border-b border-slate-100 dark:border-slate-600 hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                  <td className="sticky right-0 z-10 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-600 px-1.5 sm:px-4 py-1 sm:py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap text-[10px] sm:text-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setRadarRow(row)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-primary-600"
                        title="גרף רדאר"
                      >
                        <BarChart3 size={16} />
                      </button>
                      <span>{row.displayName}</span>
                      {row.student.riskLevel === 'high' && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="סיכון גבוה" />
                      )}
                    </div>
                  </td>
                  {filteredColumns.map((_, colIdx) => renderCell(row, colIdx))}
                </tr>
              ))}

              <tr className="border-t-2 border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-700/80 font-bold">
                <td className="sticky right-0 z-10 bg-slate-100 dark:bg-slate-700 border-l border-slate-200 dark:border-slate-600 px-1.5 sm:px-4 py-1.5 sm:py-2.5 text-slate-700 dark:text-slate-200 text-[10px] sm:text-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  ממוצע כיתתי
                </td>
                {filteredColumns.map((_, colIdx) => {
                  const fullIdx = colIndexInFull(colIdx);
                  const avg = showWeighted && fullIdx >= 1
                    ? classWeightedAverages[fullIdx]
                    : classAverages[fullIdx];
                  return (
                    <td
                      key={colIdx}
                      className={`matrix-cell px-1 sm:px-3 py-1 sm:py-2.5 text-center min-w-[36px] sm:min-w-[80px] border-l border-slate-200 dark:border-slate-600 text-[10px] sm:text-sm ${getCellClass(avg)}`}
                    >
                      {avg === null ? '—' : avg}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 p-3 sm:p-4 border-t border-slate-100 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/30 text-xs text-slate-600 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-100 dark:bg-red-500/25" /> &lt; 55
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-500/25" /> 55–75
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-slate-50 dark:bg-slate-600" /> 76–85
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-500/25" /> &gt; 85
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-slate-100 dark:bg-slate-600 text-slate-400 dark:text-slate-500">—</span> ללא ציון
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded ring-1 ring-amber-400 dark:ring-amber-500 bg-amber-50 dark:bg-amber-500/20" /> פער (נכשל/חריג)
          </span>
        </div>
      </div>

      {gradeDetailCell && (
        <GradeDetailDialog
          studentName={gradeDetailCell.displayName}
          subject={gradeDetailCell.subject}
          grades={gradeDetailCell.grades}
          onClose={() => setGradeDetailCell(null)}
        />
      )}

      {radarRow && (
        <RadarModal
          row={radarRow}
          subjectList={subjectList}
          onClose={() => setRadarRow(null)}
        />
      )}
    </div>
  );
};

export default SubjectMatrix;
