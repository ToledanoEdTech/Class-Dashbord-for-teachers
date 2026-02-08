import React, { useState, useMemo } from 'react';
import { Student, EventType, isAbsenceEvent, isOtherNegativeEvent, RiskSettings } from '../types';
import { Users, TrendingUp, AlertTriangle, Search, ChevronRight, BarChart2, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { computeStudentStatsFromData } from '../utils/processing';
import { getDisplayName } from '../utils/displayName';
import ClassHeatmap from './ClassHeatmap';

interface DashboardProps {
  students: Student[];
  classAverage: number;
  onSelectStudent: (id: string) => void;
  riskSettings?: RiskSettings;
  isAnonymous?: boolean;
}

const getDefaultDateRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getFullYear();
  let sept1 = new Date(year, 8, 1);
  if (now < sept1) sept1 = new Date(year - 1, 8, 1);
  return { start: sept1, end: startOfDay(now) };
};

const Dashboard: React.FC<DashboardProps> = ({ students, classAverage, onSelectStudent, riskSettings, isAnonymous = false }) => {
  const { start: defaultStart, end: defaultEnd } = useMemo(getDefaultDateRange, []);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'average' | 'risk'>('risk');

  const rangeStart = useMemo(() => startOfDay(startDate), [startDate]);
  const rangeEnd = useMemo(() => endOfDay(endDate), [endDate]);

  const studentsInRange = useMemo(() => {
    return students.map((s) => {
      const g = s.grades.filter((gr) => gr.date >= rangeStart && gr.date <= rangeEnd);
      const e = s.behaviorEvents.filter((ev) => ev.date >= rangeStart && ev.date <= rangeEnd);
      const stats = computeStudentStatsFromData(g, e, riskSettings);
      return { ...s, ...stats, grades: g, behaviorEvents: e };
    });
  }, [students, rangeStart, rangeEnd, riskSettings]);

  const periodLengthDays = useMemo(
    () => Math.max(1, differenceInDays(rangeEnd, rangeStart) + 1),
    [rangeStart, rangeEnd]
  );
  const prevPeriodEnd = useMemo(() => subDays(rangeStart, 1), [rangeStart]);
  const prevPeriodStart = useMemo(() => subDays(prevPeriodEnd, periodLengthDays - 1), [prevPeriodEnd, periodLengthDays]);

  const prevStats = useMemo(() => {
    const prevStart = startOfDay(prevPeriodStart);
    const prevEnd = endOfDay(prevPeriodEnd);
    return students.map((s) => {
      const g = s.grades.filter((gr) => gr.date >= prevStart && gr.date <= prevEnd);
      const e = s.behaviorEvents.filter((ev) => ev.date >= prevStart && ev.date <= prevEnd);
      return computeStudentStatsFromData(g, e, riskSettings);
    });
  }, [students, prevPeriodStart, prevPeriodEnd, riskSettings]);

  const totalStudents = studentsInRange.length;
  const atRiskCount = studentsInRange.filter((s) => s.riskLevel === 'high').length;
  const totalNegative = studentsInRange.reduce((sum, s) => sum + s.negativeCount, 0);

  const { totalAbsences, totalOtherNegative } = useMemo(() => {
    let abs = 0;
    let other = 0;
    studentsInRange.forEach((s) => {
      s.behaviorEvents.forEach((e) => {
        if (isAbsenceEvent(e)) abs++;
        else if (isOtherNegativeEvent(e)) other++;
      });
    });
    return { totalAbsences: abs, totalOtherNegative: other };
  }, [studentsInRange]);

  const classAverageInRange =
    studentsInRange.length > 0
      ? studentsInRange.reduce((sum, s) => sum + s.averageScore, 0) / studentsInRange.length
      : 0;

  const prevClassAvg =
    prevStats.length > 0 ? prevStats.reduce((sum, s) => sum + s.averageScore, 0) / prevStats.length : 0;

  const { prevAbsences, prevOtherNeg } = useMemo(() => {
    const prevStart = startOfDay(prevPeriodStart);
    const prevEnd = endOfDay(prevPeriodEnd);
    let abs = 0;
    let other = 0;
    students.forEach((s) => {
      s.behaviorEvents
        .filter((e) => e.date >= prevStart && e.date <= prevEnd)
        .forEach((e) => {
          if (isAbsenceEvent(e)) abs++;
          else if (isOtherNegativeEvent(e)) other++;
        });
    });
    return { prevAbsences: abs, prevOtherNeg: other };
  }, [students, prevPeriodStart, prevPeriodEnd]);

  const avgChangePercent =
    prevClassAvg > 0 ? ((classAverageInRange - prevClassAvg) / prevClassAvg) * 100 : 0;
  const absencesChangePercent =
    prevAbsences > 0 ? ((totalAbsences - prevAbsences) / prevAbsences) * 100 : totalAbsences > 0 ? 100 : 0;
  const otherNegChangePercent =
    prevOtherNeg > 0 ? ((totalOtherNegative - prevOtherNeg) / prevOtherNeg) * 100 : totalOtherNegative > 0 ? 100 : 0;

  const filteredStudents = useMemo(() => {
    let result = studentsInRange.filter((s) => s.name.includes(searchTerm) || s.id.includes(searchTerm));
    return result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'average') return b.averageScore - a.averageScore;
      if (sortBy === 'risk') return a.riskScore - b.riskScore;
      return 0;
    });
  }, [studentsInRange, searchTerm, sortBy]);

  const gradeDistribution = useMemo(
    () => [
      { name: '0-59', count: studentsInRange.filter((s) => s.averageScore < 60).length },
      { name: '60-69', count: studentsInRange.filter((s) => s.averageScore >= 60 && s.averageScore < 70).length },
      { name: '70-79', count: studentsInRange.filter((s) => s.averageScore >= 70 && s.averageScore < 80).length },
      { name: '80-89', count: studentsInRange.filter((s) => s.averageScore >= 80 && s.averageScore < 90).length },
      { name: '90-100', count: studentsInRange.filter((s) => s.averageScore >= 90).length },
    ],
    [studentsInRange]
  );

  const behaviorTypeDistribution = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    if (totalAbsences > 0) items.push({ name: 'חיסורים', value: totalAbsences });
    if (totalOtherNegative > 0) items.push({ name: 'אירועים שליליים (אחר)', value: totalOtherNegative });
    const positiveTypes: Record<string, number> = {};
    studentsInRange.forEach((s) => {
      s.behaviorEvents.forEach((e) => {
        if (e.category === EventType.POSITIVE && e.type) {
          positiveTypes[e.type] = (positiveTypes[e.type] || 0) + 1;
        }
      });
    });
    const topPositives = Object.entries(positiveTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, value]) => ({ name, value }));
    items.push(...topPositives);
    return items;
  }, [studentsInRange, totalAbsences, totalOtherNegative]);

  const PIE_COLORS = ['#0c8ee6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];

  const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-elevated px-4 py-3 text-sm">
        <p className="font-bold text-slate-800 mb-1">{label}</p>
        <p className="text-primary-600 font-semibold">{payload[0].value} תלמידים</p>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-safe">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">דשבורד כיתתי</h2>
          <p className="text-slate-500 text-sm md:text-base mt-1">סקירה מלאה של מצב הכיתה והתלמידים</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100/80 text-slate-600 text-sm font-medium">
          <span className="w-2 h-2 rounded-full bg-accent-success animate-pulse"></span>
          עודכן: {new Date().toLocaleDateString('he-IL')}
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-4 md:p-5">
        <h3 className="text-sm font-bold text-slate-600 mb-3">סינון לפי טווח תאריכים</h3>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-slate-600 text-sm font-medium flex-1 sm:flex-initial">
            <span>מתאריך:</span>
            <input
              type="date"
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(new Date(e.target.value))}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium min-h-[44px]"
            />
          </label>
          <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-slate-600 text-sm font-medium flex-1 sm:flex-initial">
            <span>עד תאריך:</span>
            <input
              type="date"
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(new Date(e.target.value))}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium min-h-[44px]"
            />
          </label>
        </div>
      </div>

      {/* KPI Cards - 2 cols on mobile, 5 on large */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
        <KPICard
          label="סה״כ תלמידים"
          value={totalStudents}
          icon={Users}
          color="primary"
          gradient="from-primary-500 to-primary-600"
        />
        <KPICard
          label="ממוצע כיתתי"
          value={classAverageInRange.toFixed(1)}
          icon={BarChart2}
          color="success"
          gradient="from-emerald-500 to-teal-500"
          highlight={classAverageInRange > 75}
          comparison={
            prevClassAvg > 0
              ? {
                  percent: avgChangePercent,
                  isImprovement: avgChangePercent >= 0,
                  label: 'לעומת התקופה הקודמת',
                }
              : undefined
          }
        />
        <KPICard
          label="חיסורים"
          value={totalAbsences}
          icon={AlertTriangle}
          color="danger"
          gradient="from-red-500 to-rose-500"
          comparison={
            prevAbsences > 0 || totalAbsences > 0
              ? {
                  percent: absencesChangePercent,
                  isImprovement: absencesChangePercent <= 0,
                  label: 'לעומת התקופה הקודמת',
                }
              : undefined
          }
        />
        <KPICard
          label="אירועים שליליים (אחר)"
          value={totalOtherNegative}
          icon={AlertTriangle}
          color="danger"
          gradient="from-rose-500 to-red-600"
          comparison={
            prevOtherNeg > 0 || totalOtherNegative > 0
              ? {
                  percent: otherNegChangePercent,
                  isImprovement: otherNegChangePercent <= 0,
                  label: 'לעומת התקופה הקודמת',
                }
              : undefined
          }
        />
        <KPICard
          label="תלמידים בסיכון"
          value={atRiskCount}
          icon={TrendingUp}
          color="warning"
          gradient="from-amber-500 to-orange-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <BarChart2 size={20} className="text-primary-500" />
            התפלגות ציונים
          </h3>
          <div className="h-52 min-h-[200px] sm:h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(12, 142, 230, 0.05)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={28} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-5">
            <PieChartIcon size={20} className="text-primary-500" />
            מדד התנהגות
          </h3>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 sm:gap-6 min-h-[200px] sm:min-h-[220px]">
            {behaviorTypeDistribution.length > 0 ? (
              <>
                <div className="w-full md:w-3/5 h-44 sm:h-48 md:h-56 min-h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={behaviorTypeDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {behaviorTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke="white" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.08)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-2/5 flex flex-wrap md:flex-col gap-2">
                  {behaviorTypeDistribution.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 min-w-[45%] md:min-w-0">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                      <span className="text-slate-600 text-sm truncate flex-1">{item.name}</span>
                      <span className="font-bold text-slate-800">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-slate-400 py-12">אין נתוני התנהגות מספיקים</div>
            )}
          </div>
        </div>
      </div>

      {/* Class Heatmap */}
      <ClassHeatmap students={studentsInRange} />

      {/* Students List */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
        <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-stretch md:items-center">
          <h3 className="text-base sm:text-lg font-bold text-slate-800">רשימת תלמידים</h3>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1 md:flex-initial md:max-w-md">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              <input
                type="text"
                placeholder="חיפוש תלמיד..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm font-medium text-slate-700"
            >
              <option value="risk">לפי סיכון</option>
              <option value="average">לפי ממוצע</option>
              <option value="name">לפי שם</option>
            </select>
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-4 space-y-3 bg-slate-50/30">
          {filteredStudents.map((student, idx) => (
            <StudentCard key={student.id} student={student} onClick={() => onSelectStudent(student.id)} index={idx} isAnonymous={isAnonymous} />
          ))}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-sm">
                <th className="px-6 py-4 font-semibold">שם התלמיד</th>
                <th className="px-6 py-4 font-semibold">ממוצע</th>
                <th className="px-6 py-4 font-semibold">מגמת ציונים</th>
                <th className="px-6 py-4 font-semibold">מגמת התנהגות</th>
                <th className="px-6 py-4 font-semibold">אירועים</th>
                <th className="px-6 py-4 font-semibold">סיכון</th>
                <th className="px-6 py-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student, idx) => (
                <tr
                  key={student.id}
                  onClick={() => onSelectStudent(student.id)}
                  className="hover:bg-primary-50/30 cursor-pointer transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white
                        ${student.averageScore < 60 ? 'bg-red-500' : student.averageScore < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                        {Math.round(student.averageScore)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">{getDisplayName(student.name, idx, isAnonymous)}</div>
                        <div className="text-xs text-slate-400">{student.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${student.averageScore < 70 ? 'text-red-600' : 'text-slate-700'}`}>
                      {student.averageScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <TrendBadge trend={student.gradeTrend} type="grade" />
                  </td>
                  <td className="px-6 py-4">
                    <TrendBadge trend={student.behaviorTrend} type="behavior" />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 text-sm">
                      <span className="text-red-500 font-medium">{student.negativeCount}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-emerald-500 font-medium">{student.positiveCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RiskBadge level={student.riskLevel} score={student.riskScore} />
                  </td>
                  <td className="px-6 py-4">
                    <ChevronRight className="text-slate-300 group-hover:text-primary-500 transition-colors" size={20} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const KPICard: React.FC<{
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  gradient: string;
  highlight?: boolean;
  comparison?: { percent: number; isImprovement: boolean; label: string };
}> = ({ label, value, icon: Icon, gradient, highlight, comparison }) => (
  <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-xs md:text-sm font-medium mb-1">{label}</p>
        <p className={`text-2xl md:text-3xl font-bold ${highlight ? 'text-emerald-600' : 'text-slate-800'}`}>
          {value}
        </p>
        {comparison != null && (
          <div
            className={`mt-1 flex items-center gap-1 text-xs font-medium ${comparison.isImprovement ? 'text-emerald-600' : 'text-red-600'}`}
            title={comparison.label}
          >
            {comparison.isImprovement ? (
              <ArrowUpRight size={14} strokeWidth={2.5} />
            ) : (
              <ArrowDownRight size={14} strokeWidth={2.5} />
            )}
            <span>
              {comparison.percent >= 0 ? '+' : ''}
              {comparison.percent.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg opacity-90 group-hover:opacity-100 transition-opacity`}>
        <Icon size={22} strokeWidth={2} />
      </div>
    </div>
  </div>
);

const RiskBadge: React.FC<{ level: 'high' | 'medium' | 'low'; score?: number }> = ({ level, score }) => {
  const styles = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };
  const labels = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${styles[level]}`}>
      {labels[level]}
      {score != null && (
        <span className="opacity-80 font-medium" title="ציון סיכון 1–10 (10 = סיכון נמוך)">
          {score.toFixed(1)}
        </span>
      )}
    </span>
  );
};

const TrendBadge: React.FC<{ trend: 'improving' | 'declining' | 'stable'; type: 'grade' | 'behavior' }> = ({ trend, type }) => {
  const config = {
    improving: { icon: ArrowUpRight, text: type === 'grade' ? 'שיפור' : 'משתפר', class: 'bg-emerald-50 text-emerald-700' },
    declining: { icon: ArrowDownRight, text: type === 'grade' ? 'ירידה' : 'מידרדר', class: 'bg-red-50 text-red-700' },
    stable: { icon: Minus, text: 'יציב', class: 'bg-slate-100 text-slate-600' },
  };
  const { icon: Icon, text, class: cls } = config[trend];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${cls}`}>
      <Icon size={14} strokeWidth={2.5} />
      {text}
    </span>
  );
};

const StudentCard: React.FC<{ student: Student; onClick: () => void; index: number; isAnonymous?: boolean }> = ({ student, onClick, index, isAnonymous = false }) => (
  <div
    onClick={onClick}
    className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-card active:border-primary-300 active:shadow-glow transition-all"
  >
    <div className="flex justify-between items-start mb-3">
      <div className="flex gap-3 items-center">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white shadow-md
          ${student.averageScore < 60 ? 'bg-red-500' : student.averageScore < 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}>
          {Math.round(student.averageScore)}
        </div>
        <div>
          <h4 className="font-bold text-slate-800">{getDisplayName(student.name, index, isAnonymous)}</h4>
          <span className="text-xs text-slate-400">{student.id}</span>
        </div>
      </div>
      <RiskBadge level={student.riskLevel} score={student.riskScore} />
    </div>
    <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
      <div className="text-center">
        <span className="text-[10px] text-slate-500 block mb-1">משמעת</span>
        <div className="text-sm font-bold">
          <span className="text-red-500">{student.negativeCount}</span>
          <span className="text-slate-300 mx-1">/</span>
          <span className="text-emerald-500">{student.positiveCount}</span>
        </div>
      </div>
      <div className="text-center border-x border-slate-100">
        <span className="text-[10px] text-slate-500 block mb-1">מגמת ציונים</span>
        {student.gradeTrend === 'improving' && <ArrowUpRight size={18} className="text-emerald-500 mx-auto" />}
        {student.gradeTrend === 'declining' && <ArrowDownRight size={18} className="text-red-500 mx-auto" />}
        {student.gradeTrend === 'stable' && <Minus size={18} className="text-slate-400 mx-auto" />}
      </div>
      <div className="text-center">
        <span className="text-[10px] text-slate-500 block mb-1">מגמת התנהגות</span>
        {student.behaviorTrend === 'improving' && <ArrowUpRight size={18} className="text-emerald-500 mx-auto" />}
        {student.behaviorTrend === 'declining' && <ArrowDownRight size={18} className="text-red-500 mx-auto" />}
        {student.behaviorTrend === 'stable' && <Minus size={18} className="text-slate-400 mx-auto" />}
      </div>
    </div>
  </div>
);

export default Dashboard;
