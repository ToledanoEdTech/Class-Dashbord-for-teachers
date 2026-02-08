import React, { useMemo } from 'react';
import { Student } from '../types';
import { getDisplayName } from '../utils/displayName';

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
  const { subjects, rows } = useMemo(() => {
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
        const avg = getSubjectAverage(gradeList, subj);
        cells.push(avg);
      });
      return {
        student,
        displayName: getDisplayName(student.name, idx, isAnonymous),
        cells,
      };
    });

    return { subjects: columns, rows };
  }, [students, isAnonymous]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto pb-24 md:pb-10 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">מטריצת מקצועות</h2>
        <p className="text-slate-500 text-sm md:text-base mt-1">צפייה בציונים לפי תלמיד ומקצוע – מפת חום</p>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
        <div className="overflow-auto max-h-[70vh] min-h-[200px]">
          <table className="w-full border-collapse text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="sticky top-0 right-0 z-20 bg-slate-100 border-l border-slate-200 px-4 py-3 font-bold text-slate-700 whitespace-nowrap min-w-[120px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  שם התלמיד
                </th>
                {subjects.map((subj, i) => (
                  <th
                    key={subj}
                    className="sticky top-0 z-10 bg-slate-100 px-3 py-3 font-semibold text-slate-600 text-sm whitespace-nowrap min-w-[90px] border-l border-slate-200"
                  >
                    {subj}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.student.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="sticky right-0 z-10 bg-white border-l border-slate-200 px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                    {row.displayName}
                  </td>
                  {row.cells.map((value, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-3 py-2.5 text-center min-w-[80px] border-l border-slate-100 ${getCellClass(value)}`}
                    >
                      {value === null ? '—' : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4 p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
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
