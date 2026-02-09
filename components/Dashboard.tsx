import React, { useState, useMemo } from 'react';
import { Student, EventType, isAbsenceEvent, isOtherNegativeEvent, RiskSettings } from '../types';
import { Users, TrendingUp, AlertTriangle, Search, ChevronRight, BarChart2, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Minus, Filter, ChevronDown, Printer, LayoutGrid, LayoutList } from 'lucide-react';
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
import HelpTip from './HelpTip';

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

/** Extract min/max dates from all students' grades and behavior events. */
const getDateRangeFromStudents = (students: Student[]): { min: Date; max: Date } | null => {
  const dates: number[] = [];
  students.forEach((s) => {
    s.grades.forEach((g) => dates.push(g.date.getTime()));
    s.behaviorEvents.forEach((e) => dates.push(e.date.getTime()));
  });
  if (dates.length === 0) return null;
  return {
    min: startOfDay(new Date(Math.min(...dates))),
    max: endOfDay(new Date(Math.max(...dates))),
  };
};

const Dashboard: React.FC<DashboardProps> = ({ students, classAverage, onSelectStudent, riskSettings, isAnonymous = false }) => {
  const { start: defaultStart, end: defaultEnd } = useMemo(getDefaultDateRange, []);
  const dataRange = useMemo(() => getDateRangeFromStudents(students), [students]);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);

  React.useEffect(() => {
    if (dataRange) {
      setStartDate(dataRange.min);
      setEndDate(dataRange.max);
    }
  }, [dataRange?.min?.getTime(), dataRange?.max?.getTime()]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'average' | 'risk'>('risk');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [trendFilter, setTrendFilter] = useState<'all' | 'improving' | 'declining' | 'stable'>('all');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(() => {
    try { return (localStorage.getItem('toledano-view-mode') as 'table' | 'cards') || 'table'; } catch { return 'table'; }
  });

  React.useEffect(() => {
    try { localStorage.setItem('toledano-view-mode', viewMode); } catch {}
  }, [viewMode]);

  const activeFilterCount = [riskFilter !== 'all', trendFilter !== 'all', !!subjectFilter, !!teacherFilter].filter(Boolean).length;

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

  const prevAtRiskCount = useMemo(() => prevStats.filter((s) => s.riskLevel === 'high').length, [prevStats]);
  const riskChange = atRiskCount - prevAtRiskCount;

  const { allSubjects, allTeachers } = useMemo(() => {
    const subjects = new Set<string>();
    const teachers = new Set<string>();
    studentsInRange.forEach((s) => {
      s.grades.forEach((g) => {
        if (g.subject?.trim()) subjects.add(g.subject.trim());
        if (g.teacher?.trim()) teachers.add(g.teacher.trim());
      });
      s.behaviorEvents.forEach((e) => {
        if (e.teacher?.trim()) teachers.add(e.teacher.trim());
      });
    });
    return {
      allSubjects: Array.from(subjects).sort((a, b) => a.localeCompare(b, 'he')),
      allTeachers: Array.from(teachers).sort((a, b) => a.localeCompare(b, 'he')),
    };
  }, [studentsInRange]);

  const filteredStudents = useMemo(() => {
    let result = studentsInRange.filter((s) => {
      if (searchTerm && !s.name.includes(searchTerm) && !s.id.includes(searchTerm)) return false;
      if (riskFilter !== 'all' && s.riskLevel !== riskFilter) return false;
      if (trendFilter !== 'all' && s.gradeTrend !== trendFilter) return false;
      if (subjectFilter && !s.grades.some((g) => (g.subject || '').trim() === subjectFilter)) return false;
      if (teacherFilter) {
        const hasGrade = s.grades.some((g) => (g.teacher || '').trim() === teacherFilter);
        const hasEvent = s.behaviorEvents.some((e) => (e.teacher || '').trim() === teacherFilter);
        if (!hasGrade && !hasEvent) return false;
      }
      return true;
    });
    return result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'average') return b.averageScore - a.averageScore;
      if (sortBy === 'risk') return a.riskScore - b.riskScore;
      return 0;
    });
  }, [studentsInRange, searchTerm, sortBy, riskFilter, trendFilter, subjectFilter, teacherFilter]);

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
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">הדפסה</span>
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100/80 text-slate-600 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-accent-success animate-pulse"></span>
            עודכן: {new Date().toLocaleDateString('he-IL')}
          </div>
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

      {/* Advanced Filters */}
      <div className="no-print bg-white rounded-2xl shadow-card border border-slate-100/80 p-4 md:p-5">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-bold text-slate-600 w-full"
        >
          <Filter size={16} className="text-primary-500" />
          סינון מתקדם
          <ChevronDown size={16} className={`transition-transform mr-auto ${showFilters ? 'rotate-180' : ''}`} />
          {activeFilterCount > 0 && (
            <span className="bg-primary-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{activeFilterCount}</span>
          )}
        </button>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">רמת סיכון <HelpTip text="סנן תלמידים לפי רמת הסיכון שלהם: גבוה, בינוני או נמוך." /></label>
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value as any)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px]">
                <option value="all">הכל</option>
                <option value="high">גבוה</option>
                <option value="medium">בינוני</option>
                <option value="low">נמוך</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">מגמת ציונים <HelpTip text="סנן לפי מגמת הציונים: משתפר, מידרדר או יציב." /></label>
              <select value={trendFilter} onChange={(e) => setTrendFilter(e.target.value as any)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px]">
                <option value="all">הכל</option>
                <option value="improving">משתפר</option>
                <option value="declining">מידרדר</option>
                <option value="stable">יציב</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">מקצוע</label>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px]">
                <option value="">כל המקצועות</option>
                {allSubjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">מורה</label>
              <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 min-h-[40px]">
                <option value="">כל המורים</option>
                {allTeachers.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
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
          label={<>תלמידים בסיכון <HelpTip text="תלמידים עם ציון סיכון נמוך (1-3 מתוך 10). מחושב לפי ממוצע ציונים, מגמות, אירועים שליליים וחיסורים." /></>}
          value={atRiskCount}
          icon={TrendingUp}
          color="warning"
          gradient="from-amber-500 to-orange-500"
        />
      </div>

      {/* Period Comparison Banner */}
      {(prevClassAvg > 0 || prevAtRiskCount > 0) && (
        <div className="bg-gradient-to-r from-primary-50 to-blue-50/50 border border-primary-100 rounded-2xl p-4 md:p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary-500" />
            סיכום השוואה לתקופה הקודמת
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs mb-1">שינוי בתלמידים בסיכון</span>
              <span className={`font-bold text-lg ${riskChange > 0 ? 'text-red-600' : riskChange < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                {riskChange > 0 ? `+${riskChange}` : riskChange === 0 ? 'ללא שינוי' : riskChange}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs mb-1">שינוי בממוצע כיתתי</span>
              <span className={`font-bold text-lg ${avgChangePercent > 0 ? 'text-emerald-600' : avgChangePercent < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                {avgChangePercent > 0 ? '+' : ''}{avgChangePercent.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs mb-1">שינוי בחיסורים</span>
              <span className={`font-bold text-lg ${totalAbsences - prevAbsences > 0 ? 'text-red-600' : totalAbsences - prevAbsences < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                {totalAbsences - prevAbsences > 0 ? '+' : ''}{totalAbsences - prevAbsences}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500 text-xs mb-1">שינוי באירועים שליליים</span>
              <span className={`font-bold text-lg ${totalOtherNegative - prevOtherNeg > 0 ? 'text-red-600' : totalOtherNegative - prevOtherNeg < 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                {totalOtherNegative - prevOtherNeg > 0 ? '+' : ''}{totalOtherNegative - prevOtherNeg}
              </span>
            </div>
          </div>
        </div>
      )}

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
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            רשימת תלמידים
            <span className="text-xs font-normal text-slate-400">({filteredStudents.length})</span>
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-1 md:flex-initial md:max-w-lg">
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
            <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                aria-label="תצוגת טבלה"
              >
                <LayoutList size={16} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'cards' ? 'bg-white text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                aria-label="תצוגת כרטיסים"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Cards View - mobile always, desktop when viewMode is 'cards' */}
        <div className={`${viewMode === 'cards' ? '' : 'md:hidden'} p-4 space-y-3 bg-slate-50/30`}>
          {filteredStudents.map((student, idx) => (
            <StudentCard key={student.id} student={student} onClick={() => onSelectStudent(student.id)} index={idx} isAnonymous={isAnonymous} />
          ))}
        </div>

        {/* Desktop Table - only when viewMode is 'table' */}
        <div className={`${viewMode === 'table' ? 'hidden md:block' : 'hidden'} overflow-x-auto`}>
          <table className="w-full text-right">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 text-sm">
                <th className="px-6 py-4 font-semibold">שם התלמיד</th>
                <th className="px-6 py-4 font-semibold">ממוצע</th>
                <th className="px-6 py-4 font-semibold">מגמת ציונים <HelpTip text="השוואה בין ממוצע 3 הציונים האחרונים ל-3 שלפניהם. שיפור = עלייה, ירידה = ירידה." /></th>
                <th className="px-6 py-4 font-semibold">מגמת התנהגות <HelpTip text="מגמה לפי 12 האירועים האחרונים, עם משקל לאירועים שליליים." /></th>
                <th className="px-6 py-4 font-semibold">אירועים</th>
                <th className="px-6 py-4 font-semibold">סיכון <HelpTip text="ציון סיכון 1-10 (1=סיכון גבוה, 10=סיכון נמוך). מחושב לפי ציונים, מגמות, אירועים שליליים וחיסורים." /></th>
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
  label: React.ReactNode;
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

const MiniSparkline: React.FC<{ values: number[]; color: string; min?: number; max?: number }> = ({ values, color, min, max }) => {
  if (!values || values.length < 2) {
    return <span className="text-[10px] text-slate-300 block mt-1">אין נתונים</span>;
  }
  const width = 74;
  const height = 26;
  const pad = 2;
  const vmin = min ?? Math.min(...values);
  const vmax = max ?? Math.max(...values);
  const range = vmax - vmin || 1;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - vmin) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto mt-1">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
};

const StudentCard: React.FC<{ student: Student; onClick: () => void; index: number; isAnonymous?: boolean }> = ({ student, onClick, index, isAnonymous = false }) => {
  const gradeValues = [...student.grades]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-8)
    .map((g) => g.score);

  const behaviorValues = (() => {
    const events = [...student.behaviorEvents]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-12);
    let score = 0;
    return events.map((e) => {
      if (e.category === EventType.POSITIVE) score += 1;
      else if (e.category === EventType.NEGATIVE) score -= 1;
      return score;
    });
  })();

  return (
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
          <MiniSparkline values={gradeValues} color="#0c8ee6" min={0} max={100} />
        </div>
        <div className="text-center">
          <span className="text-[10px] text-slate-500 block mb-1">מגמת התנהגות</span>
          {student.behaviorTrend === 'improving' && <ArrowUpRight size={18} className="text-emerald-500 mx-auto" />}
          {student.behaviorTrend === 'declining' && <ArrowDownRight size={18} className="text-red-500 mx-auto" />}
          {student.behaviorTrend === 'stable' && <Minus size={18} className="text-slate-400 mx-auto" />}
          <MiniSparkline values={behaviorValues} color="#f59e0b" />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
