import React, { useMemo, useState } from 'react';
import { Student } from '../types';
import { getDisplayName } from '../utils/displayName';
import { Search, ArrowUp, ArrowDown } from 'lucide-react';
import HelpTip from './HelpTip';

interface SubjectMatrixProps {
  students: Student[];
  isAnonymous?: boolean;
}

function getSubjectAverage(grades: { subject: string; score: number }[], subject: string): number | null {
  const bySubject = grades.filter((g) => (g.subject || '').trim() === subject);
  if (bySubject.length === 0) return null;
  const sum = bySubject.reduce((s, g) => s + g.score, 0);
  return Math.round((sum / bySubject.length) * 10) / 10;
}

function getCellClass(grade: number | null): string {
  if (grade === null) return 'bg-slate-100 text-slate-400';
  if (grade < 55) return 'bg-red-100 text-red-800 font-semibold';
  if (grade <= 75) return 'bg-amber-100 text-amber-800 font-medium';
  if (grade > 85) return 'bg-emerald-100 text-emerald-800 font-semibold';
  return 'bg-slate-50 text-slate-700';
}

const SubjectMatrix: React.FC<SubjectMatrixProps> = ({ students, isAnonymous = false }) => {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { subjects, rows, classAverages } = useMemo(() => {
    const subjectSet = new Set<string>();
    students.forEach((s) => {
      s.grades.forEach((g) => {
        const subj = (g.subject || '').trim() || 'כללי';
        subjectSet.add(subj);
      });
    });
    const subjectList = Array.from(subjectSet).sort((a, b) => a.localeCompare(b, 'he'));
    const columns = ['ממוצע כללי', ...subjectList];

    const rows = students.map((student, idx) => {
      const gradeList = student.grades.map((g) => ({ subject: (g.subject || '').trim() || 'כללי', score: g.score }));
      const generalAvg = student.averageScore;
      const cells: (number | null)[] = [generalAvg];
      subjectList.forEach((subj) => {
        cells.push(getSubjectAverage(gradeList, subj));
      });
      return {
        student,
        displayName: getDisplayName(student.name, idx, isAnonymous),
        cells,
      };
    });

    // Compute class averages per subject
    const classAverages: (number | null)[] = columns.map((_, colIdx) => {
      const values = rows.map((r) => r.cells[colIdx]).filter((v): v is number => v !== null);
      if (values.length === 0) return null;
      return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
    });

    return { subjects: columns, rows, classAverages };
  }, [students, isAnonymous]);

  // Filter and sort rows
  const displayRows = useMemo(() => {
    let filtered = rows;
    if (riskFilter !== 'all') {
      filtered = filtered.filter((r) => r.student.riskLevel === riskFilter);
    }
    if (searchTerm) {
      filtered = filtered.filter((r) => r.displayName.includes(searchTerm) || r.student.id.includes(searchTerm));
    }
    if (sortCol !== null) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a.cells[sortCol] ?? -Infinity;
        const bVal = b.cells[sortCol] ?? -Infinity;
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
    }
    return filtered;
  }, [rows, riskFilter, searchTerm, sortCol, sortDir]);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colIdx);
      setSortDir('desc');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pb-safe animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
          מטריצת מקצועות
          <HelpTip text="טבלת ציונים לפי תלמיד ומקצוע. לחץ על כותרת עמודה למיון. צבעי הרקע מראים את רמת הציון." />
        </h2>
        <p className="text-slate-500 text-sm md:text-base mt-1">צפייה בציונים לפי תלמיד ומקצוע – לחץ על כותרת עמודה למיון</p>
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
        <span className="text-xs text-slate-400 self-center">
          {displayRows.length} מתוך {rows.length} תלמידים
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
        <div className="overflow-auto overflow-touch max-h-[70vh] min-h-[200px]">
          <table className="w-full border-collapse text-right min-w-[320px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky top-0 right-0 z-20 bg-slate-100 border-l border-slate-200 px-3 sm:px-4 py-3 font-bold text-slate-700 whitespace-nowrap min-w-[100px] sm:min-w-[120px] text-sm sm:text-base shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  שם התלמיד
                </th>
                {subjects.map((subj, i) => (
                  <th
                    key={subj}
                    onClick={() => handleSort(i)}
                    className="sticky top-0 z-10 bg-slate-100 px-2 sm:px-3 py-2.5 sm:py-3 font-semibold text-slate-600 text-xs sm:text-sm whitespace-nowrap min-w-[72px] sm:min-w-[90px] border-l border-slate-200 cursor-pointer hover:bg-slate-200/80 transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      {subj}
                      {sortCol === i && (
                        sortDir === 'desc'
                          ? <ArrowDown size={12} className="text-primary-500" />
                          : <ArrowUp size={12} className="text-primary-500" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((row) => (
                <tr key={row.student.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 font-medium text-slate-800 whitespace-nowrap text-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-2">
                      <span>{row.displayName}</span>
                      {row.student.riskLevel === 'high' && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="סיכון גבוה" />
                      )}
                    </div>
                  </td>
                  {row.cells.map((value, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-2 sm:px-3 py-2 sm:py-2.5 text-center min-w-[64px] sm:min-w-[80px] border-l border-slate-100 text-sm ${getCellClass(value)}`}
                    >
                      {value === null ? '—' : value}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Summary Row - Class Averages */}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="sticky right-0 z-10 bg-slate-100 border-l border-slate-200 px-3 sm:px-4 py-2.5 text-slate-700 text-sm shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  ממוצע כיתתי
                </td>
                {classAverages.map((avg, colIdx) => (
                  <td key={colIdx} className={`px-2 sm:px-3 py-2.5 text-center border-l border-slate-200 text-sm ${getCellClass(avg)}`}>
                    {avg === null ? '—' : avg}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-3 sm:gap-4 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-100" /> &lt; 55
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-amber-100" /> 55–75
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-slate-50" /> 76–85
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-emerald-100" /> &gt; 85
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-slate-100 text-slate-400">—</span> ללא ציון
          </span>
        </div>
      </div>
    </div>
  );
};

export default SubjectMatrix;
