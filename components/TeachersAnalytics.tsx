import React, { useMemo } from 'react';
import { Student, EventType, isAbsenceEvent, isOtherNegativeEvent } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface TeachersAnalyticsProps {
  students: Student[];
  isAnonymous?: boolean;
}

interface TeacherGradeStats {
  teacher: string;
  avgGrade: number;
  gradeCount: number;
  studentCount: number;
}

interface TeacherBehaviorStats {
  teacher: string;
  negativeCount: number;
  positiveCount: number;
  absenceCount: number;
  otherNegativeCount: number;
  totalEvents: number;
  studentCount: number;
}

const TeachersAnalytics: React.FC<TeachersAnalyticsProps> = ({ students }) => {

  const teacherSubjectPairs = useMemo(() => {
    const gradeByPair: Record<string, { sum: number; count: number }> = {};
    const eventsByPair: Record<string, number> = {};
    const key = (t: string, s: string) => `${t}\0${s}`;

    students.forEach((s) => {
      s.grades.forEach((g) => {
        const t = (g.teacher || 'ללא מורה').trim() || 'ללא מורה';
        const subj = (g.subject || '').trim() || 'כללי';
        const k = key(t, subj);
        if (!gradeByPair[k]) gradeByPair[k] = { sum: 0, count: 0 };
        gradeByPair[k].sum += g.score;
        gradeByPair[k].count += 1;
      });
      s.behaviorEvents.forEach((e) => {
        const t = (e.teacher || 'ללא מורה').trim() || 'ללא מורה';
        const subj = (e.subject || '').trim() || 'כללי';
        const k = key(t, subj);
        eventsByPair[k] = (eventsByPair[k] ?? 0) + 1;
      });
    });

    const allKeys = new Set([...Object.keys(gradeByPair), ...Object.keys(eventsByPair)]);
    const pairs: { teacher: string; subject: string; avgGrade: number | null; gradeCount: number; eventCount: number }[] = [];
    allKeys.forEach((k) => {
      const [teacher, subject] = k.split('\0');
      const g = gradeByPair[k];
      const avgGrade = g && g.count > 0 ? Math.round((g.sum / g.count) * 10) / 10 : null;
      pairs.push({
        teacher,
        subject,
        avgGrade: avgGrade ?? null,
        gradeCount: g?.count ?? 0,
        eventCount: eventsByPair[k] ?? 0,
      });
    });
    return pairs.sort((a, b) => a.teacher.localeCompare(b.teacher, 'he') || a.subject.localeCompare(b.subject, 'he'));
  }, [students]);
  const gradeByTeacher = useMemo(() => {
    const byTeacher: Record<string, { sum: number; count: number; studentIds: Set<string> }> = {};
    students.forEach((s) => {
      s.grades.forEach((g) => {
        const t = (g.teacher || 'ללא מורה').trim() || 'ללא מורה';
        if (!byTeacher[t]) byTeacher[t] = { sum: 0, count: 0, studentIds: new Set() };
        byTeacher[t].sum += g.score;
        byTeacher[t].count += 1;
        byTeacher[t].studentIds.add(s.id);
      });
    });
    const result: TeacherGradeStats[] = Object.entries(byTeacher).map(([teacher, { sum, count, studentIds }]) => ({
      teacher,
      avgGrade: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
      gradeCount: count,
      studentCount: studentIds.size,
    }));
    return result.sort((a, b) => b.avgGrade - a.avgGrade);
  }, [students]);

  const behaviorByTeacher = useMemo(() => {
    const byTeacher: Record<string, { negative: number; positive: number; absence: number; otherNegative: number; studentIds: Set<string> }> = {};
    students.forEach((s) => {
      s.behaviorEvents.forEach((e) => {
        const t = (e.teacher || 'ללא מורה').trim() || 'ללא מורה';
        if (!byTeacher[t]) byTeacher[t] = { negative: 0, positive: 0, absence: 0, otherNegative: 0, studentIds: new Set() };
        if (e.category === EventType.NEGATIVE) {
          byTeacher[t].negative += 1;
          if (isAbsenceEvent(e)) byTeacher[t].absence += 1;
          else if (isOtherNegativeEvent(e)) byTeacher[t].otherNegative += 1;
        } else if (e.category === EventType.POSITIVE) {
          byTeacher[t].positive += 1;
        }
        byTeacher[t].studentIds.add(s.id);
      });
    });
    const result: TeacherBehaviorStats[] = Object.entries(byTeacher).map(([teacher, { negative, positive, absence, otherNegative, studentIds }]) => ({
      teacher,
      negativeCount: negative,
      positiveCount: positive,
      absenceCount: absence,
      otherNegativeCount: otherNegative,
      totalEvents: negative + positive,
      studentCount: studentIds.size,
    }));
    return result.filter((r) => r.totalEvents > 0).sort((a, b) => b.totalEvents - a.totalEvents);
  }, [students]);

  const gradeChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = gradeByTeacher.find((r) => r.teacher === label);
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-elevated px-4 py-3 text-sm text-right">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        <p className="text-primary-600">ממוצע ציונים: {payload[0].value}</p>
        {row && (
          <>
            <p className="text-slate-500 text-xs mt-1">סה״כ {row.gradeCount} ציונים</p>
            <p className="text-slate-500 text-xs">מ־{row.studentCount} תלמידים</p>
          </>
        )}
      </div>
    );
  };

  const behaviorChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const row = behaviorByTeacher.find((r) => r.teacher === label);
    return (
      <div className="bg-white/98 backdrop-blur-sm border border-slate-200/80 rounded-xl shadow-lg px-4 py-3 text-sm text-right">
        <p className="font-bold text-slate-800 mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-amber-700"><span className="text-amber-500">●</span> חיסורים: {row?.absenceCount ?? 0}</p>
          <p className="text-rose-700"><span className="text-rose-500">●</span> משמעת אחרת: {row?.otherNegativeCount ?? 0}</p>
          <p className="text-emerald-700"><span className="text-emerald-500">●</span> חיוביים: {row?.positiveCount ?? 0}</p>
        </div>
        {row && <p className="text-slate-500 text-xs mt-2 pt-2 border-t border-slate-100">מ־{row.studentCount} תלמידים</p>}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-safe animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">אנליטיקת מורים</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">השוואת ממוצעי ציונים ואירועי משמעת לפי מורה</p>
        </div>
      </div>

      {/* Chart 1: Average grade per teacher */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-primary-500">ממוצע ציונים לפי מורה</span>
        </h3>
        <p className="text-slate-500 text-sm mb-4">זיהוי מורים "קשיחים" (ממוצע נמוך) לעומת "מפנקים" (ממוצע גבוה). ריחוף מציג מספר תלמידים.</p>
        {gradeByTeacher.length > 0 ? (
          <div className="h-64 min-h-[240px] sm:h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeByTeacher} layout="vertical" margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="teacher" width={90} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => (v && v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
                <Tooltip content={gradeChartTooltip} cursor={{ fill: 'rgba(12, 142, 230, 0.06)' }} />
                <Bar dataKey="avgGrade" name="ממוצע ציון" fill="#0c8ee6" radius={[0, 4, 4, 0]} barSize={24} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400 rounded-xl bg-slate-50/50">אין נתוני ציונים לפי מורה</div>
        )}
      </div>

      {/* Chart 2: Behavior events per teacher */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-primary-500">אירועי משמעת לפי מורה</span>
        </h3>
        <p className="text-slate-500 text-sm mb-4">זיהוי מוקדי משמעת – חיסורים, אירועי משמעת ואירועים חיוביים</p>
        {behaviorByTeacher.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-4 mb-4 p-3 rounded-xl bg-slate-50/80 border border-slate-100">
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-amber-200" /> חיסורים
              </span>
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-rose-200" /> משמעת אחרת
              </span>
              <span className="flex items-center gap-2 text-sm text-slate-600">
                <span className="w-3 h-3 rounded-sm bg-emerald-200" /> חיוביים
              </span>
            </div>
            <div className="h-64 min-h-[240px] sm:h-72 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={behaviorByTeacher} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" strokeOpacity={0.8} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis type="category" dataKey="teacher" width={100} tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => (v && v.length > 14 ? `${v.slice(0, 13)}…` : v)} axisLine={false} tickLine={false} />
                  <Tooltip content={behaviorChartTooltip} cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }} />
                  <Bar dataKey="absenceCount" name="absenceCount" fill="#fbbf24" fillOpacity={0.9} radius={[0, 6, 6, 0]} barSize={22} maxBarSize={32} stackId="a" />
                  <Bar dataKey="otherNegativeCount" name="otherNegativeCount" fill="#fb7185" fillOpacity={0.9} radius={[0, 6, 6, 0]} barSize={22} maxBarSize={32} stackId="a" />
                  <Bar dataKey="positiveCount" name="positiveCount" fill="#34d399" fillOpacity={0.9} radius={[0, 6, 6, 0]} barSize={22} maxBarSize={32} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400 rounded-xl bg-slate-50/50">אין נתוני אירועי התנהגות לפי מורה</div>
        )}
      </div>

      {/* Teacher-Subject pairs – only combinations with data */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
          <span className="text-primary-500">תיאום מורה–מקצוע</span>
        </h3>
        <p className="text-slate-500 text-sm mb-4">רק צירופי מורה–מקצוע שבהם קיימים נתונים (ציונים או אירועים)</p>
        {teacherSubjectPairs.length > 0 ? (
          <div className="overflow-auto max-h-[50vh] border border-slate-200 rounded-xl">
            <table className="w-full border-collapse text-right text-sm min-w-[320px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">מורה</th>
                  <th className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap border-l border-slate-200">מקצוע</th>
                  <th className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap border-l border-slate-200">ממוצע ציון</th>
                  <th className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap border-l border-slate-200">מספר ציונים</th>
                  <th className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap border-l border-slate-200">אירועי משמעת</th>
                </tr>
              </thead>
              <tbody>
                {teacherSubjectPairs.map((p, i) => {
                  const gradeCellClass = p.avgGrade != null
                    ? p.avgGrade < 55 ? 'bg-red-50 text-red-800' : p.avgGrade > 85 ? 'bg-emerald-50 text-emerald-800' : ''
                    : 'text-slate-400';
                  return (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-800">{p.teacher}</td>
                      <td className="px-3 py-2 text-slate-700 border-l border-slate-100">{p.subject}</td>
                      <td className={`px-3 py-2 border-l border-slate-100 font-medium ${gradeCellClass}`}>{p.avgGrade ?? '—'}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-600">{p.gradeCount || '—'}</td>
                      <td className="px-3 py-2 border-l border-slate-100 text-slate-600">{p.eventCount || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-slate-400 rounded-xl bg-slate-50/50">אין נתוני תיאום מורה–מקצוע</div>
        )}
      </div>
    </div>
  );
};

export default TeachersAnalytics;
