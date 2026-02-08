import React, { useMemo } from 'react';
import { Student, EventType } from '../types';
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
}

interface TeacherBehaviorStats {
  teacher: string;
  negativeCount: number;
  positiveCount: number;
  totalEvents: number;
}

const TeachersAnalytics: React.FC<TeachersAnalyticsProps> = ({ students, isAnonymous = false }) => {
  const gradeByTeacher = useMemo(() => {
    const byTeacher: Record<string, { sum: number; count: number }> = {};
    students.forEach((s) => {
      s.grades.forEach((g) => {
        const t = (g.teacher || 'ללא מורה').trim() || 'ללא מורה';
        if (!byTeacher[t]) byTeacher[t] = { sum: 0, count: 0 };
        byTeacher[t].sum += g.score;
        byTeacher[t].count += 1;
      });
    });
    const result: TeacherGradeStats[] = Object.entries(byTeacher).map(([teacher, { sum, count }]) => ({
      teacher,
      avgGrade: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
      gradeCount: count,
    }));
    return result.sort((a, b) => b.avgGrade - a.avgGrade);
  }, [students]);

  const behaviorByTeacher = useMemo(() => {
    const byTeacher: Record<string, { negative: number; positive: number }> = {};
    students.forEach((s) => {
      s.behaviorEvents.forEach((e) => {
        const t = (e.teacher || 'ללא מורה').trim() || 'ללא מורה';
        if (!byTeacher[t]) byTeacher[t] = { negative: 0, positive: 0 };
        if (e.category === EventType.NEGATIVE) byTeacher[t].negative += 1;
        else if (e.category === EventType.POSITIVE) byTeacher[t].positive += 1;
      });
    });
    const result: TeacherBehaviorStats[] = Object.entries(byTeacher).map(([teacher, { negative, positive }]) => ({
      teacher,
      negativeCount: negative,
      positiveCount: positive,
      totalEvents: negative + positive,
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
        {row && <p className="text-slate-500 text-xs mt-1">סה״כ {row.gradeCount} ציונים</p>}
      </div>
    );
  };

  const behaviorChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-elevated px-4 py-3 text-sm text-right">
        <p className="font-bold text-slate-800 mb-2">{label}</p>
        <p className="text-red-600">אירועים שליליים: {payload.find((p: any) => p.dataKey === 'negativeCount')?.value ?? 0}</p>
        <p className="text-emerald-600">אירועים חיוביים: {payload.find((p: any) => p.dataKey === 'positiveCount')?.value ?? 0}</p>
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
        <p className="text-slate-500 text-sm mb-4">זיהוי מורים "קשיחים" (ממוצע נמוך) לעומת "מפנקים" (ממוצע גבוה)</p>
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
        <p className="text-slate-500 text-sm mb-4">השוואת אירועים שליליים וחיוביים – זיהוי מוקדי משמעת</p>
        {behaviorByTeacher.length > 0 ? (
          <div className="h-64 min-h-[240px] sm:h-72 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={behaviorByTeacher} layout="vertical" margin={{ top: 5, right: 8, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="teacher" width={90} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => (v && v.length > 12 ? `${v.slice(0, 11)}…` : v)} />
                <Tooltip content={behaviorChartTooltip} cursor={{ fill: 'rgba(12, 142, 230, 0.06)' }} />
                <Legend wrapperStyle={{ direction: 'rtl' }} formatter={(value) => (value === 'negativeCount' ? 'שליליים' : 'חיוביים')} />
                <Bar dataKey="negativeCount" name="negativeCount" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={18} maxBarSize={28} stackId="a" />
                <Bar dataKey="positiveCount" name="positiveCount" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={18} maxBarSize={28} stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-slate-400 rounded-xl bg-slate-50/50">אין נתוני אירועי התנהגות לפי מורה</div>
        )}
      </div>
    </div>
  );
};

export default TeachersAnalytics;
