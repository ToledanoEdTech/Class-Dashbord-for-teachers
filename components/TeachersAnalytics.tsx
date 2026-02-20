import React, { useMemo } from 'react';
import { Student, EventType, isAbsenceEvent, isOtherNegativeEvent, PeriodDefinition } from '../types';
import { startOfDay, endOfDay } from 'date-fns';
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
  periodDefinitions?: PeriodDefinition[];
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

const TeachersAnalytics: React.FC<TeachersAnalyticsProps> = ({ students, periodDefinitions = [] }) => {

  /** סטטיסטיקות כיתתיות לפי תקופה – למען תובנות לפי תקופות */
  const periodClassStats = useMemo(() => {
    if (!periodDefinitions.length) return [];
    return periodDefinitions.map((p) => {
      const pStart = startOfDay(new Date(p.startDate));
      const pEnd = endOfDay(new Date(p.endDate));
      const inRange = (d: Date) => d >= pStart && d <= pEnd;
      let gradeSum = 0;
      let gradeCount = 0;
      let absences = 0;
      students.forEach((s) => {
        s.grades.forEach((g) => {
          if (inRange(g.date)) {
            gradeSum += g.score;
            gradeCount += 1;
          }
        });
        s.behaviorEvents.forEach((e) => {
          if (inRange(e.date) && isAbsenceEvent(e)) absences += 1;
        });
      });
      const avg = gradeCount > 0 ? Math.round((gradeSum / gradeCount) * 10) / 10 : 0;
      return { name: p.name, ממוצע: avg, חיסורים: absences };
    });
  }, [students, periodDefinitions]);

  /** תובנות לפי תקופות: השוואת תקופה אחרונה לקודמת */
  const periodInsights = useMemo(() => {
    if (periodClassStats.length < 2) return [];
    const last = periodClassStats[periodClassStats.length - 1];
    const prev = periodClassStats[periodClassStats.length - 2];
    const lines: { type: 'improve' | 'decline'; text: string }[] = [];
    if (last.ממוצע > prev.ממוצע + 1) {
      lines.push({ type: 'improve', text: `ממוצע כיתתי עלה בתקופה "${last.name}" (${prev.ממוצע} → ${last.ממוצע}) ביחס ל"${prev.name}".` });
    } else if (last.ממוצע < prev.ממוצע - 1 && prev.ממוצע > 0) {
      lines.push({ type: 'decline', text: `ממוצע כיתתי ירד בתקופה "${last.name}" (${prev.ממוצע} → ${last.ממוצע}) ביחס ל"${prev.name}".` });
    }
    if (last.חיסורים < prev.חיסורים && prev.חיסורים > 0) {
      lines.push({ type: 'improve', text: `פחות חיסורים בתקופה "${last.name}" (${last.חיסורים}) ביחס ל"${prev.name}" (${prev.חיסורים}).` });
    } else if (last.חיסורים > prev.חיסורים) {
      lines.push({ type: 'decline', text: `יותר חיסורים בתקופה "${last.name}" (${last.חיסורים}) ביחס ל"${prev.name}" (${prev.חיסורים}).` });
    }
    return lines;
  }, [periodClassStats]);

  const teacherSubjectPairs = useMemo(() => {
    const normalizeTeacher = (t: string): string => {
      const x = (t || '').trim().replace(/\s+/g, ' ');
      if (!x) return 'ללא מורה';
      const words = x.split(' ').filter(Boolean);
      if (words.length >= 3) return words.slice(-2).join(' ');
      return x;
    };
    const normalize = (t: string, s: string) => {
      const teacher = normalizeTeacher(t) || 'ללא מורה';
      const subject = (s || '').trim().replace(/\s+/g, ' ') || 'כללי';
      return { teacher, subject };
    };
    const key = (t: string, s: string) => `${t}\0${s}`;

    const gradeByPair: Record<string, { sum: number; count: number }> = {};
    const eventsByPair: Record<string, number> = {};

    students.forEach((s) => {
      s.grades.forEach((g) => {
        const { teacher, subject } = normalize(g.teacher, g.subject);
        const k = key(teacher, subject);
        if (!gradeByPair[k]) gradeByPair[k] = { sum: 0, count: 0 };
        gradeByPair[k].sum += g.score;
        gradeByPair[k].count += 1;
      });
      s.behaviorEvents.forEach((e) => {
        const { teacher, subject } = normalize(e.teacher, e.subject);
        const k = key(teacher, subject);
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

    // מיזוג: אם למורה יש שורת "כללי" רק עם אירועים (בלי ציונים) ויש לו בדיוק מקצוע אחד מציונים – למזג את האירועים לשורת המקצוע
    const byTeacher = new Map<string, { subjectsWithGrades: Set<string>; hasGeneralOnlyEvents: boolean }>();
    pairs.forEach((p) => {
      if (!byTeacher.has(p.teacher)) {
        byTeacher.set(p.teacher, { subjectsWithGrades: new Set(), hasGeneralOnlyEvents: false });
      }
      const entry = byTeacher.get(p.teacher)!;
      if (p.gradeCount > 0) entry.subjectsWithGrades.add(p.subject);
      if (p.eventCount > 0 && p.gradeCount === 0 && p.subject === 'כללי') entry.hasGeneralOnlyEvents = true;
    });

    const mergeGeneralIntoSubject = new Map<string, string>();
    byTeacher.forEach(({ subjectsWithGrades, hasGeneralOnlyEvents }, teacher) => {
      const subjectList = [...subjectsWithGrades].filter((s) => s !== 'כללי').sort((a, b) => a.localeCompare(b, 'he'));
      if (hasGeneralOnlyEvents && subjectList.length >= 1) {
        mergeGeneralIntoSubject.set(teacher, subjectList[0]);
      }
    });

    const merged: typeof pairs = [];
    pairs.forEach((p) => {
      const k = key(p.teacher, p.subject);
      const targetSubject = mergeGeneralIntoSubject.get(p.teacher);
      if (p.subject === 'כללי' && targetSubject != null) {
        return;
      }
      let eventCount = p.eventCount;
      if (targetSubject === p.subject) {
        const generalKey = key(p.teacher, 'כללי');
        eventCount += eventsByPair[generalKey] ?? 0;
      }
      merged.push({ ...p, eventCount });
    });

    return merged.sort((a, b) => a.teacher.localeCompare(b.teacher, 'he') || a.subject.localeCompare(b.subject, 'he'));
  }, [students]);
  const normalizeTeacherForChart = (t: string): string => {
    const x = (t || '').trim().replace(/\s+/g, ' ');
    if (!x) return 'ללא מורה';
    const words = x.split(' ').filter(Boolean);
    if (words.length >= 3) return words.slice(-2).join(' ');
    return x;
  };

  const gradeByTeacher = useMemo(() => {
    const byTeacher: Record<string, { sum: number; count: number; studentIds: Set<string> }> = {};
    students.forEach((s) => {
      s.grades.forEach((g) => {
        const t = normalizeTeacherForChart(g.teacher) || 'ללא מורה';
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
        const t = normalizeTeacherForChart(e.teacher) || 'ללא מורה';
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
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full min-w-0 space-y-6 md:space-y-8 pb-safe animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">אנליטיקת מורים</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">השוואת ממוצעי ציונים ואירועי משמעת לפי מורה</p>
        </div>
      </div>

      {/* תובנות לפי תקופות */}
      {periodInsights.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3">תובנות לפי תקופות</h3>
          <p className="text-slate-500 text-sm mb-4">השוואת התקופה האחרונה לתקופה הקודמת (ממוצע כיתתי וחיסורים)</p>
          <ul className="space-y-2">
            {periodInsights.map((item, idx) => (
              <li
                key={idx}
                className={`flex items-center gap-2 text-sm py-2 px-3 rounded-lg border ${
                  item.type === 'improve' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <span className="shrink-0">{item.type === 'improve' ? '↑' : '↓'}</span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <p className="text-slate-500 text-sm mb-4">שורה לכל צירוף מורה–מקצוע: ממוצע ציון ואירועי משמעת באותו מקצוע. מורה שמלמד מקצוע אחד יופיע בשורה אחת עם שני הנתונים.</p>
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
