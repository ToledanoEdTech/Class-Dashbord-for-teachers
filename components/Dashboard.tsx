import React, { useState, useMemo } from 'react';
import { Student, EventType, Grade, BehaviorEvent, isAbsenceEvent, isOtherNegativeEvent, RiskSettings, ClassGroup, PeriodDefinition } from '../types';
import { Search, ChevronRight, PieChart as PieChartIcon, Filter, ChevronDown, Printer, LayoutGrid, LayoutList, Download, FileSpreadsheet, FileText, AlertCircle, TrendingUp, Check, X, Trash2 } from 'lucide-react';
import { MetricIcons } from '../constants/icons';
import { exportStudentsAtRiskToExcel, exportClassSummaryToExcel, exportClassSummaryToPDF } from '../utils/export';
import { generateClassCertificates } from '../utils/certificate';
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
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, differenceInDays, eachWeekOfInterval, endOfWeek, isSameWeek, eachDayOfInterval, isSameDay, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { computeStudentStatsFromData } from '../utils/processing';
import { getDisplayName } from '../utils/displayName';
import ClassHeatmap from './ClassHeatmap';
import HelpTip from './HelpTip';
import type { DashboardWidgetsState, DashboardWidgetId } from '../constants/dashboardWidgets';
import { getDefaultDashboardWidgets } from '../constants/dashboardWidgets';

interface DashboardProps {
  students: Student[];
  classAverage: number;
  onSelectStudent: (id: string) => void;
  riskSettings?: RiskSettings;
  isAnonymous?: boolean;
  className?: string;
  classGroup?: ClassGroup;
  periodDefinitions?: PeriodDefinition[];
  visibleWidgets?: DashboardWidgetsState;
  onHideWidget?: (id: DashboardWidgetId) => void;
}

const getDefaultDateRange = (): { start: Date; end: Date } => {
  const now = new Date();
  const year = now.getFullYear();
  let sept1 = new Date(year, 8, 1);
  if (now < sept1) sept1 = new Date(year - 1, 8, 1);
  return { start: sept1, end: startOfDay(now) };
};

/** Wrapper for dashboard widgets: hover-to-show remove button, exit animation when hiding */
function DashboardWidgetWrap({
  id,
  onRemove,
  removingId,
  setRemovingId,
  children,
  className = '',
}: {
  id: DashboardWidgetId;
  onRemove?: (id: DashboardWidgetId) => void;
  removingId: DashboardWidgetId | null;
  setRemovingId: (v: DashboardWidgetId | null) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isRemoving = removingId === id;
  const showRemove = !!onRemove;

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onRemove) return;
    setRemovingId(id);
  };

  return (
    <div
      className={`group/widget relative transition-all duration-300 ease-out ${isRemoving ? 'opacity-0 scale-[0.98] pointer-events-none' : ''} ${className}`}
    >
      {showRemove && (
        <button
          type="button"
          onClick={handleRemove}
          aria-label="הסר רכיב מדשבורד"
          className="no-print absolute left-2 top-2 z-10 p-1.5 rounded-lg bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/30 dark:hover:text-red-400 opacity-0 group-hover/widget:opacity-100 transition-opacity duration-200 shadow-sm border border-slate-200 dark:border-slate-500"
        >
          <Trash2 size={16} />
        </button>
      )}
      {children}
    </div>
  );
}

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

/** התאמת מקצוע לסינון: בחר "מתמטיקה" = כל "מתמטיקה", "מתמטיקה א", "מתמטיקה ב" וכו'. */
const subjectMatchesFilter = (filter: string, subjectValue: string | undefined): boolean => {
  if (!filter) return true;
  const s = (subjectValue || '').trim();
  if (!s) return false;
  return s === filter || s.startsWith(filter + ' ');
};

const Dashboard: React.FC<DashboardProps> = ({ students, classAverage, onSelectStudent, riskSettings, isAnonymous = false, className = 'כיתה', classGroup, periodDefinitions = [], visibleWidgets: visibleWidgetsProp, onHideWidget }) => {
  const visibleWidgets = visibleWidgetsProp ?? getDefaultDashboardWidgets();
  const [removingWidgetId, setRemovingWidgetId] = useState<DashboardWidgetId | null>(null);
  const { start: defaultStart, end: defaultEnd } = useMemo(getDefaultDateRange, []);
  const dataRange = useMemo(() => getDateRangeFromStudents(students), [students]);
  const [startDate, setStartDate] = useState<Date>(defaultStart);
  const [endDate, setEndDate] = useState<Date>(defaultEnd);

  React.useEffect(() => {
    if (!removingWidgetId || !onHideWidget) return;
    const t = setTimeout(() => {
      onHideWidget(removingWidgetId);
      setRemovingWidgetId(null);
    }, 300);
    return () => clearTimeout(t);
  }, [removingWidgetId, onHideWidget]);

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
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showCertificateDialog, setShowCertificateDialog] = useState(false);
  const [selectedSubjectsForCertificates, setSelectedSubjectsForCertificates] = useState<Set<string>>(new Set());
  /** כשנבחרת תקופה – טווח התאריכים של הדשבורד מוגבל לתקופה זו */
  const [dashboardPeriodId, setDashboardPeriodId] = useState<string | null>(null);

  React.useEffect(() => {
    try { localStorage.setItem('toledano-view-mode', viewMode); } catch {}
  }, [viewMode]);

  // סגירת תפריט ייצוא בלחיצה מחוץ לתפריט
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (exportMenuOpen && !target.closest('.export-menu-container')) {
        setExportMenuOpen(false);
      }
    };
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportMenuOpen]);

  const activeFilterCount = [riskFilter !== 'all', trendFilter !== 'all', !!subjectFilter, !!teacherFilter].filter(Boolean).length;

  const rangeStart = useMemo(() => startOfDay(startDate), [startDate]);
  const rangeEnd = useMemo(() => endOfDay(endDate), [endDate]);

  /** סינון מקצוע/מורה משפיע על כל הדשבורד: רק ציונים ואירועים שמתאימים. מקצוע תואם גם קבוצות (מתמטיקה א, מתמטיקה ב). */
  const studentsFilteredBySubjectTeacher = useMemo(() => {
    if (!subjectFilter && !teacherFilter) return students;
    return students.map((s) => ({
      ...s,
      grades: s.grades.filter(
        (gr) =>
          subjectMatchesFilter(subjectFilter, gr.subject) &&
          (!teacherFilter || (gr.teacher || '').trim() === teacherFilter)
      ),
      behaviorEvents: s.behaviorEvents.filter(
        (ev) =>
          subjectMatchesFilter(subjectFilter, ev.subject) &&
          (!teacherFilter || (ev.teacher || '').trim() === teacherFilter)
      ),
    }));
  }, [students, subjectFilter, teacherFilter]);

  const studentsInRange = useMemo(() => {
    return studentsFilteredBySubjectTeacher.map((s) => {
      const g = s.grades.filter((gr) => gr.date >= rangeStart && gr.date <= rangeEnd);
      const e = s.behaviorEvents.filter((ev) => ev.date >= rangeStart && ev.date <= rangeEnd);
      const stats = computeStudentStatsFromData(g, e, riskSettings);
      return { ...s, ...stats, grades: g, behaviorEvents: e };
    });
  }, [studentsFilteredBySubjectTeacher, rangeStart, rangeEnd, riskSettings]);

  const periodLengthDays = useMemo(
    () => Math.max(1, differenceInDays(rangeEnd, rangeStart) + 1),
    [rangeStart, rangeEnd]
  );
  const prevPeriodEnd = useMemo(() => subDays(rangeStart, 1), [rangeStart]);
  const prevPeriodStart = useMemo(() => subDays(prevPeriodEnd, periodLengthDays - 1), [prevPeriodEnd, periodLengthDays]);

  const prevStats = useMemo(() => {
    const prevStart = startOfDay(prevPeriodStart);
    const prevEnd = endOfDay(prevPeriodEnd);
    return studentsFilteredBySubjectTeacher.map((s) => {
      const g = s.grades.filter((gr) => gr.date >= prevStart && gr.date <= prevEnd);
      const e = s.behaviorEvents.filter((ev) => ev.date >= prevStart && ev.date <= prevEnd);
      return computeStudentStatsFromData(g, e, riskSettings);
    });
  }, [studentsFilteredBySubjectTeacher, prevPeriodStart, prevPeriodEnd, riskSettings]);

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

  const totalPositive = useMemo(
    () => studentsInRange.reduce((sum, s) => sum + s.positiveCount, 0),
    [studentsInRange]
  );

  const avgChangePercent =
    prevClassAvg > 0 ? ((classAverageInRange - prevClassAvg) / prevClassAvg) * 100 : 0;

  const { allSubjects, allTeachers } = useMemo(() => {
    const subjects = new Set<string>();
    const teachers = new Set<string>();
    const addSubject = (raw: string) => {
      const t = raw?.trim();
      if (!t || /^\d+$/.test(t)) return;
      subjects.add(t);
      const lastSpace = t.lastIndexOf(' ');
      if (lastSpace > 0) {
        const base = t.slice(0, lastSpace).trim();
        if (base) subjects.add(base);
      }
    };
    students.forEach((s) => {
      s.grades.forEach((g) => {
        if (g.subject) addSubject(g.subject);
        if (g.teacher?.trim()) teachers.add(g.teacher.trim());
      });
      s.behaviorEvents.forEach((e) => {
        if (e.subject) addSubject(e.subject);
        if (e.teacher?.trim()) teachers.add(e.teacher.trim());
      });
    });
    return {
      allSubjects: Array.from(subjects).sort((a, b) => a.localeCompare(b, 'he')),
      allTeachers: Array.from(teachers).sort((a, b) => a.localeCompare(b, 'he')),
    };
  }, [students]);

  // Handle Certificate Generation for all students
  const handleGenerateClassCertificates = async () => {
    try {
      const subjectsArray = selectedSubjectsForCertificates.size > 0
        ? Array.from(selectedSubjectsForCertificates)
        : undefined;
      
      await generateClassCertificates(studentsInRange, {
        selectedSubjects: subjectsArray
      });
      
      setShowCertificateDialog(false);
      setSelectedSubjectsForCertificates(new Set());
    } catch (error) {
      console.error('Error generating certificates:', error);
      alert('שגיאה ביצירת התעודות');
    }
  };

  const filteredStudents = useMemo(() => {
    let result = studentsInRange.filter((s) => {
      if (searchTerm && !s.name.includes(searchTerm) && !s.id.includes(searchTerm)) return false;
      if (riskFilter !== 'all' && s.riskLevel !== riskFilter) return false;
      if (trendFilter !== 'all' && s.gradeTrend !== trendFilter) return false;
      if (subjectFilter || teacherFilter) {
        if (s.grades.length === 0 && s.behaviorEvents.length === 0) return false;
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

  /** תלמידים שדורשים תשומת לב מיידית: סיכון גבוה + (מגמה מידרדרת או חיסורים גבוהים) */
  const immediateAttentionList = useMemo(() => {
    const attThr = riskSettings?.attendanceThreshold ?? 4;
    return studentsInRange
      .filter(
        (s) =>
          s.riskLevel === 'high' &&
          (s.gradeTrend === 'declining' ||
            s.behaviorTrend === 'declining' ||
            s.behaviorEvents.filter((e) => isAbsenceEvent(e)).length >= attThr)
      )
      .sort((a, b) => a.riskScore - b.riskScore)
      .slice(0, 5);
  }, [studentsInRange, riskSettings?.attendanceThreshold]);

  const improvingCount = useMemo(
    () => studentsInRange.filter((s) => s.gradeTrend === 'improving' || s.behaviorTrend === 'improving').length,
    [studentsInRange]
  );

  /** מגמה כיתתית לאורך זמן: שבועות או חודשים (מושפע ממקצוע/מורה) */
  const timelineData = useMemo(() => {
    const days = differenceInDays(rangeEnd, rangeStart) + 1;
    const useMonths = days > 90;
    const points: { period: string; ממוצע: number; חיסורים: number; שליליים: number; חיוביים: number; fullDate: Date }[] = [];
    const src = studentsFilteredBySubjectTeacher;
    if (useMonths) {
      let d = startOfMonth(rangeStart);
      while (d <= rangeEnd) {
        const periodEnd = endOfMonth(d);
        const periodStart = startOfDay(d);
        const periodEndClamped = periodEnd > rangeEnd ? rangeEnd : periodEnd;
        const inRange = (date: Date) => date >= periodStart && date <= periodEndClamped;
        const stInPeriod = src.map((s) => {
          const g = s.grades.filter((gr) => inRange(gr.date));
          const e = s.behaviorEvents.filter((ev) => inRange(ev.date));
          return computeStudentStatsFromData(g, e, riskSettings);
        });
        const withData = stInPeriod.filter((_, i) => {
          const orig = src[i];
          return orig.grades.some((gr) => inRange(gr.date)) || orig.behaviorEvents.some((ev) => inRange(ev.date));
        });
        const avgVal = withData.length > 0 ? withData.reduce((s, x) => s + x.averageScore, 0) / withData.length : 0;
        let abs = 0;
        let neg = 0;
        let pos = 0;
        src.forEach((s) => {
          s.behaviorEvents.forEach((ev) => {
            if (!inRange(ev.date)) return;
            if (isAbsenceEvent(ev)) abs++;
            else if (ev.category === EventType.NEGATIVE) neg++;
            else if (ev.category === EventType.POSITIVE) pos++;
          });
        });
        points.push({
          period: format(d, 'MMM yyyy'),
          ממוצע: Math.round(avgVal * 10) / 10,
          חיסורים: abs,
          שליליים: neg,
          חיוביים: pos,
          fullDate: new Date(d),
        });
        d = addMonths(d, 1);
      }
    } else {
      const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 0 });
      weeks.forEach((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const periodEnd = weekEnd > rangeEnd ? rangeEnd : weekEnd;
        const periodStart = weekStart < rangeStart ? rangeStart : weekStart;
        const inRange = (date: Date) => date >= periodStart && date <= periodEnd;
        const stInPeriod = src.map((s) => {
          const g = s.grades.filter((gr) => inRange(gr.date));
          const e = s.behaviorEvents.filter((ev) => inRange(ev.date));
          return computeStudentStatsFromData(g, e, riskSettings);
        });
        const withData = stInPeriod.filter((_, i) => {
          const orig = src[i];
          return orig.grades.some((gr) => inRange(gr.date)) || orig.behaviorEvents.some((ev) => inRange(ev.date));
        });
        const avgVal = withData.length > 0 ? withData.reduce((s, x) => s + x.averageScore, 0) / withData.length : 0;
        let abs = 0;
        let neg = 0;
        let pos = 0;
        src.forEach((s) => {
          s.behaviorEvents.forEach((ev) => {
            if (!inRange(ev.date)) return;
            if (isAbsenceEvent(ev)) abs++;
            else if (ev.category === EventType.NEGATIVE) neg++;
            else if (ev.category === EventType.POSITIVE) pos++;
          });
        });
        points.push({
          period: format(weekStart, 'd/M'),
          ממוצע: Math.round(avgVal * 10) / 10,
          חיסורים: abs,
          שליליים: neg,
          חיוביים: pos,
          fullDate: new Date(weekStart),
        });
      });
    }
    return points;
  }, [studentsFilteredBySubjectTeacher, rangeStart, rangeEnd, riskSettings]);

  /** סטטיסטיקות לפי תקופות מוגדרות (מושפע ממקצוע/מורה) */
  const periodStats = useMemo(() => {
    if (!periodDefinitions?.length) return [];
    const src = studentsFilteredBySubjectTeacher;
    return periodDefinitions.map((p) => {
      const pStart = startOfDay(new Date(p.startDate));
      const pEnd = endOfDay(new Date(p.endDate));
      const inRange = (date: Date) => date >= pStart && date <= pEnd;
      const stInPeriod = src.map((s) => {
        const g = s.grades.filter((gr) => inRange(gr.date));
        const e = s.behaviorEvents.filter((ev) => inRange(ev.date));
        return computeStudentStatsFromData(g, e, riskSettings);
      });
      const withGrades = stInPeriod.filter((_, i) => src[i].grades.some((gr) => inRange(gr.date)));
      const avg = withGrades.length > 0 ? withGrades.reduce((s, x) => s + x.averageScore, 0) / withGrades.length : 0;
      const atRisk = stInPeriod.filter((x) => x.riskLevel === 'high').length;
      let abs = 0;
      src.forEach((s) => {
        s.behaviorEvents.forEach((ev) => {
          if (inRange(ev.date) && isAbsenceEvent(ev)) abs++;
        });
      });
      return { name: p.name, ממוצע: Math.round(avg * 10) / 10, בסיכון: atRisk, חיסורים: abs };
    });
  }, [studentsFilteredBySubjectTeacher, periodDefinitions, riskSettings]);

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
    if (totalOtherNegative > 0) items.push({ name: 'אירועים שליליים', value: totalOtherNegative });
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
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Export Dropdown */}
          <div className="relative export-menu-container">
            <button
              type="button"
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="no-print flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 text-sm font-medium transition-colors"
              aria-label="ייצוא נתונים"
              aria-expanded={exportMenuOpen}
            >
              <Download size={16} />
              <span className="hidden sm:inline">ייצוא</span>
            </button>
            {(exportMenuOpen || false) && (
              <div className="absolute left-0 top-full mt-2 w-56 bg-white rounded-xl shadow-elevated border border-slate-200 z-50">
                <div className="p-2">
                <button
                  type="button"
                  onClick={async () => {
                    const atRiskStudents = studentsInRange.filter((s) => s.riskLevel === 'high');
                    if (atRiskStudents.length === 0) {
                      alert('אין תלמידים בסיכון לייצוא');
                      return;
                    }
                    try {
                      await exportStudentsAtRiskToExcel(atRiskStudents, className, riskSettings);
                      setExportMenuOpen(false);
                    } catch (error) {
                      console.error('Error exporting:', error);
                      alert('שגיאה בייצוא הקובץ');
                    }
                  }}
                  className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary-50 active:bg-primary-100 text-slate-700 hover:text-primary-700 transition-colors"
                >
                  <FileSpreadsheet size={18} className="text-primary-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">ייצוא תלמידים בסיכון</div>
                    <div className="text-xs text-slate-500">Excel</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!classGroup) {
                      alert('חסרים נתוני כיתה לייצוא');
                      return;
                    }
                    try {
                      await exportClassSummaryToExcel(classGroup, classAverageInRange, riskSettings);
                      setExportMenuOpen(false);
                    } catch (error) {
                      console.error('Error exporting:', error);
                      alert('שגיאה בייצוא הקובץ');
                    }
                  }}
                  className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary-50 active:bg-primary-100 text-slate-700 hover:text-primary-700 transition-colors"
                >
                  <FileSpreadsheet size={18} className="text-primary-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">ייצוא סיכום כיתתי</div>
                    <div className="text-xs text-slate-500">Excel</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!classGroup) {
                      alert('חסרים נתוני כיתה לייצוא');
                      return;
                    }
                    try {
                      exportClassSummaryToPDF(classGroup, classAverageInRange, riskSettings);
                      setExportMenuOpen(false);
                    } catch (error) {
                      console.error('Error exporting:', error);
                      alert('שגיאה בייצוא הקובץ');
                    }
                  }}
                  className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-primary-50 active:bg-primary-100 text-slate-700 hover:text-primary-700 transition-colors"
                >
                  <FileText size={18} className="text-primary-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">ייצוא סיכום כיתתי</div>
                    <div className="text-xs text-slate-500">PDF</div>
                  </div>
                </button>
                <div className="border-t border-slate-200 my-2"></div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCertificateDialog(true);
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 text-slate-700 hover:text-emerald-700 transition-colors"
                >
                  <FileText size={18} className="text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">הפקת תעודות לכיתה</div>
                    <div className="text-xs text-slate-500">PDF - תעודה לכל תלמיד</div>
                  </div>
                </button>
                </div>
              </div>
            )}
          </div>
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

      {/* Executive Summary + Immediate Attention - קומפקטי */}
      {visibleWidgets.summary && (
      <DashboardWidgetWrap id="summary" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 bg-gradient-to-br from-primary-50/80 to-white rounded-xl shadow-card border border-primary-100/80 p-3.5 md:p-4">
          <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-primary-500" />
            סיכום מהיר
          </h3>
          <div className="text-slate-700 text-sm leading-snug space-y-2">
            <p>
              {totalStudents > 0 ? (
                <>בכיתה <strong>{totalStudents}</strong> תלמידים. <strong className="text-red-600">{atRiskCount}</strong> תלמידים בסיכון גבוה, <strong className="text-emerald-600">{improvingCount}</strong> במגמת שיפור (ציונים או התנהגות).
                  {immediateAttentionList.length > 0 ? (
                    <> <strong className="text-amber-700">{immediateAttentionList.length}</strong> דורשים תשומת לב מיידית.</>
                  ) : (
                    <> אין תלמידים שדורשים תשומת לב מיידית כרגע.</>
                  )}
                </>
              ) : (
                <>אין עדיין נתונים בטווח התאריכים שנבחר.</>
              )}
            </p>
            {totalStudents > 0 && (
              <p className="text-slate-600">
                {atRiskCount === 0 && improvingCount > totalStudents / 2 && (
                  <>הכיתה במצב טוב: רוב התלמידים במגמת שיפור. כדאי להמשיך בחיזוקים חיוביים.</>
                )}
                {atRiskCount === 0 && improvingCount <= totalStudents / 2 && (
                  <>מומלץ לחזק תלמידים שמגמתם יציבה כדי להניע שיפור.</>
                )}
                {atRiskCount > 0 && improvingCount > atRiskCount && (
                  <>מומלץ להתמקד במי שבדירוג הסיכון הגבוה ולשמור על החיזוקים לאחרים.</>
                )}
                {atRiskCount > 0 && improvingCount <= atRiskCount && atRiskCount <= 3 && (
                  <>התמקדות בתלמידים בסיכון ובמגמת הציונים וההתנהגות עשויה לשפר את המצב.</>
                )}
                {atRiskCount > 3 && (
                  <>מומלץ לבדוק מקצועות ומועדים בעייתיים ולתכנן התערבות כיתתית וממוקדת.</>
                )}
              </p>
            )}
            {totalStudents > 0 && (atRiskCount > 0 || immediateAttentionList.length > 0) && (
              <p className="text-slate-500 text-xs">
                {immediateAttentionList.length > 0 ? (
                  <>לחיצה על שם ברשימת &quot;תשומת לב מיידית&quot; מציגה את פרופיל התלמיד לפעולה ממוקדת.</>
                ) : (
                  <>לחיצה על תלמיד ברשימה למטה פותחת את פרופילו עם פירוט ציונים והתנהגות.</>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-card border border-slate-100/80 p-3.5 md:p-4">
          <h3 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-amber-500" />
            תשומת לב מיידית
          </h3>
          {immediateAttentionList.length === 0 ? (
            <p className="text-slate-400 text-xs">אין ברשימה זו</p>
          ) : (
            <ul className="space-y-1">
              {immediateAttentionList.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => onSelectStudent(s.id)}
                    className="w-full text-right flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/80 border border-amber-100 hover:bg-amber-100/80 transition-colors text-sm"
                  >
                    <span className="font-medium text-slate-800 truncate">{getDisplayName(s.name, studentsInRange.findIndex((x) => x.id === s.id), isAnonymous)}</span>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </DashboardWidgetWrap>
      )}

      {/* Date Range Filter */}
      {visibleWidgets.dateFilter && (
      <DashboardWidgetWrap id="dateFilter" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-4 md:p-5">
        <h3 className="text-sm font-bold text-slate-600 mb-3">סינון לפי טווח תאריכים</h3>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          {periodDefinitions.length > 0 && (
            <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-slate-600 text-sm font-medium flex-1 sm:flex-initial">
              <span>תקופה:</span>
              <select
                value={dashboardPeriodId ?? ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setDashboardPeriodId(id);
                  if (id) {
                    const p = periodDefinitions.find((x) => x.id === id);
                    if (p) {
                      setStartDate(startOfDay(new Date(p.startDate)));
                      setEndDate(endOfDay(new Date(p.endDate)));
                    }
                  } else if (dataRange) {
                    setStartDate(dataRange.min);
                    setEndDate(dataRange.max);
                  }
                }}
                className="w-full sm:w-auto min-w-[140px] px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium min-h-[44px]"
              >
                <option value="">כל הנתונים</option>
                {periodDefinitions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-slate-600 text-sm font-medium flex-1 sm:flex-initial">
            <span>מתאריך:</span>
            <input
              type="date"
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => { setStartDate(new Date(e.target.value)); setDashboardPeriodId(null); }}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium min-h-[44px]"
            />
          </label>
          <label className="flex flex-col sm:flex-row sm:items-center gap-1.5 text-slate-600 text-sm font-medium flex-1 sm:flex-initial">
            <span>עד תאריך:</span>
            <input
              type="date"
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={(e) => { setEndDate(new Date(e.target.value)); setDashboardPeriodId(null); }}
              className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800 font-medium min-h-[44px]"
            />
          </label>
        </div>
      </div>
      </DashboardWidgetWrap>
      )}

      {/* Advanced Filters */}
      {visibleWidgets.advancedFilters && (
      <DashboardWidgetWrap id="advancedFilters" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
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
      </DashboardWidgetWrap>
      )}

      {/* KPI Cards - 2 cols on mobile, 6 on large */}
      {visibleWidgets.kpiCards && (
      <DashboardWidgetWrap id="kpiCards" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
        <KPICard
          label="סה״כ תלמידים"
          value={totalStudents}
          icon={MetricIcons.Students}
          color="primary"
          gradient="from-primary-500 to-primary-600"
        />
        <KPICard
          label="ממוצע כיתתי"
          value={classAverageInRange.toFixed(1)}
          icon={MetricIcons.ClassAverage}
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
          icon={MetricIcons.Absences}
          color="danger"
          gradient="from-red-500 to-rose-500"
        />
        <KPICard
          label="אירועים שליליים"
          value={totalOtherNegative}
          icon={MetricIcons.NegativeEvents}
          color="danger"
          gradient="from-rose-500 to-red-600"
        />
        <KPICard
          label="אירועים חיוביים"
          value={totalPositive}
          icon={MetricIcons.PositiveEvents}
          color="success"
          gradient="from-emerald-500 to-teal-500"
        />
        <KPICard
          label={<>תלמידים בסיכון <HelpTip text="תלמידים עם ציון סיכון נמוך (1-3 מתוך 10). מחושב לפי ממוצע ציונים, מגמות, אירועים שליליים וחיסורים." /></>}
          value={atRiskCount}
          icon={MetricIcons.Risk}
          color="danger"
          gradient="from-red-500 to-rose-500"
        />
      </div>
      </DashboardWidgetWrap>
      )}

      {/* Timeline - מגמה כיתתית */}
      {visibleWidgets.timeline && timelineData.length > 0 && (
        <DashboardWidgetWrap id="timeline" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <TrendingUp size={20} className="text-primary-500" />
            מגמה כיתתית לאורך זמן
          </h3>
          <div className="h-64 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ direction: 'rtl', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  formatter={(value: number) => [value, '']}
                  labelFormatter={(label) => `תקופה: ${label}`}
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="ממוצע" stroke="#0c8ee6" strokeWidth={2} dot={{ r: 4 }} name="ממוצע כיתתי" />
                <Line yAxisId="left" type="monotone" dataKey="חיסורים" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} name="חיסורים" />
                <Line yAxisId="left" type="monotone" dataKey="שליליים" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} name="אירועים שליליים" />
                <Line yAxisId="left" type="monotone" dataKey="חיוביים" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} name="אירועים חיוביים" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        </DashboardWidgetWrap>
      )}

      {/* השוואה בין תקופות (כשמוגדרות בהגדרות) – טבלה + גרף */}
      {visibleWidgets.periodComparison && periodStats.length > 0 && (
        <DashboardWidgetWrap id="periodComparison" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <MetricIcons.ClassAverage size={20} className="text-primary-500" />
            השוואה בין תקופות
          </h3>
          <div className="overflow-x-auto mb-5">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 px-4 font-bold text-slate-600">תקופה</th>
                  <th className="py-3 px-4 font-bold text-slate-600">ממוצע כיתתי</th>
                  <th className="py-3 px-4 font-bold text-slate-600">תלמידים בסיכון</th>
                  <th className="py-3 px-4 font-bold text-slate-600">חיסורים</th>
                </tr>
              </thead>
              <tbody>
                {periodStats.map((row) => (
                  <tr key={row.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-medium text-slate-800">{row.name}</td>
                    <td className="py-3 px-4">{row.ממוצע}</td>
                    <td className="py-3 px-4">
                      <span className={row.בסיכון > 0 ? 'text-red-600 font-medium' : 'text-slate-600'}>{row.בסיכון}</span>
                    </td>
                    <td className="py-3 px-4">{row.חיסורים}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {periodStats.length >= 2 && (() => {
            const maxחיסורים = Math.max(1, ...periodStats.map((r) => r.חיסורים));
            const maxבסיכון = Math.max(1, ...periodStats.map((r) => r.בסיכון));
            const domainחיסורים = [0, Math.ceil(maxחיסורים * 1.15) || 10];
            const domainבסיכון = [0, Math.max(5, maxבסיכון + 1)];
            return (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodStats} margin={{ top: 8, right: 56, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="rightAbsences" orientation="right" domain={domainחיסורים} tick={{ fontSize: 10, fill: '#b45309' }} width={28} />
                  <YAxis yAxisId="rightRisk" orientation="right" domain={domainבסיכון} tick={{ fontSize: 10, fill: '#dc2626' }} width={28} />
                  <Tooltip
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="bg-white/95 border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-sm text-right">
                        <p className="font-bold text-slate-800 mb-1">{payload[0].payload.name}</p>
                        <p className="text-primary-600">ממוצע כיתתי: {payload[0].payload.ממוצע}</p>
                        <p className="text-red-600">בסיכון: {payload[0].payload.בסיכון}</p>
                        <p className="text-amber-700">חיסורים: {payload[0].payload.חיסורים}</p>
                      </div>
                    ) : null}
                  />
                  <Bar yAxisId="left" dataKey="ממוצע" name="ממוצע כיתתי" fill="#0c8ee6" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar yAxisId="rightAbsences" dataKey="חיסורים" name="חיסורים" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar yAxisId="rightRisk" dataKey="בסיכון" name="תלמידים בסיכון" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            );
          })()}
        </div>
        </DashboardWidgetWrap>
      )}

      {/* Charts */}
      {(visibleWidgets.gradeDistribution || visibleWidgets.behaviorChart) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 transition-all duration-300">
        {visibleWidgets.gradeDistribution && (
        <DashboardWidgetWrap id="gradeDistribution" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
            <MetricIcons.ClassAverage size={20} className="text-primary-500" />
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
        </DashboardWidgetWrap>
        )}
        {visibleWidgets.behaviorChart && (
        <DashboardWidgetWrap id="behaviorChart" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
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
        </DashboardWidgetWrap>
        )}
      </div>
      )}

      {/* Class Heatmap */}
      {visibleWidgets.heatmap && (
      <ClassHeatmap students={studentsInRange} />
      )}

      {/* Students List */}
      {visibleWidgets.studentsList && (
      <DashboardWidgetWrap id="studentsList" onRemove={onHideWidget} removingId={removingWidgetId} setRemovingId={setRemovingWidgetId}>
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
      </DashboardWidgetWrap>
      )}

      {/* Certificate Generation Dialog */}
      {showCertificateDialog && (
        <CertificateDialog
          availableSubjects={allSubjects}
          selectedSubjects={selectedSubjectsForCertificates}
          onToggleSubject={(subject) => {
            const newSet = new Set(selectedSubjectsForCertificates);
            if (newSet.has(subject)) {
              newSet.delete(subject);
            } else {
              newSet.add(subject);
            }
            setSelectedSubjectsForCertificates(newSet);
          }}
          onSelectAll={() => {
            setSelectedSubjectsForCertificates(new Set(allSubjects));
          }}
          onDeselectAll={() => {
            setSelectedSubjectsForCertificates(new Set());
          }}
          onGenerate={handleGenerateClassCertificates}
          onClose={() => {
            setShowCertificateDialog(false);
            setSelectedSubjectsForCertificates(new Set());
          }}
          studentCount={studentsInRange.length}
        />
      )}
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
  comparison?: {
    percent?: number;
    absoluteDelta?: number;
    isImprovement: boolean;
    label: string;
  };
}> = ({ label, value, icon: Icon, gradient, highlight, comparison }) => (
  <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-xs md:text-sm font-medium mb-1">{label}</p>
        <p className={`text-2xl md:text-3xl font-bold ${highlight ? 'text-grade-success' : 'text-slate-800'}`}>
          {value}
        </p>
        {comparison != null && (
          <div
            className={`mt-1 flex items-center gap-1 text-xs font-medium ${comparison.isImprovement ? 'text-grade-success' : 'text-grade-danger'}`}
            title={comparison.label}
          >
            {comparison.isImprovement ? (
              <MetricIcons.TrendUp size={14} strokeWidth={2.5} />
            ) : (
              <MetricIcons.TrendDown size={14} strokeWidth={2.5} />
            )}
            <span>
              {comparison.absoluteDelta !== undefined
                ? `${comparison.absoluteDelta >= 0 ? '+' : ''}${comparison.absoluteDelta}`
                : `${(comparison.percent ?? 0) >= 0 ? '+' : ''}${(comparison.percent ?? 0).toFixed(1)}%`}
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
    high: 'bg-red-50 text-risk-high border-red-100',
    medium: 'bg-amber-50 text-risk-medium border-amber-100',
    low: 'bg-emerald-50 text-risk-low border-emerald-100',
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
    improving: { icon: MetricIcons.TrendUp, text: type === 'grade' ? 'שיפור' : 'משתפר', class: 'bg-emerald-50 text-grade-success' },
    declining: { icon: MetricIcons.TrendDown, text: type === 'grade' ? 'ירידה' : 'מידרדר', class: 'bg-red-50 text-grade-danger' },
    stable: { icon: MetricIcons.TrendStable, text: 'יציב', class: 'bg-slate-100 text-slate-600' },
  };
  const { icon: Icon, text, class: cls } = config[trend];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${cls}`}>
      <Icon size={14} strokeWidth={2.5} />
      {text}
    </span>
  );
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getGradeSparklineValues = (grades: Grade[]): number[] => {
  if (grades.length === 0) return [];
  const timestamps = grades.map((g) => g.date.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const startDate = getStartOfWeek(new Date(minTime));
  const endDate = endOfWeek(new Date(maxTime));
  const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
  return weeks
    .map((weekStart) => {
      const weeklyGrades = grades.filter((g) => isSameWeek(g.date, weekStart));
      if (weeklyGrades.length === 0) return null;
      const avg = weeklyGrades.reduce((sum, g) => sum + g.score, 0) / weeklyGrades.length;
      return parseFloat(avg.toFixed(1));
    })
    .filter((v): v is number => v !== null);
};

const getBehaviorSparklineValues = (events: BehaviorEvent[]): number[] => {
  const filtered = events.filter((e) => !isAbsenceEvent(e));
  if (filtered.length === 0) return [];
  const dates = filtered.map((e) => e.date);
  const timestamps = dates.map((d) => d.getTime());
  const startDate = new Date(Math.min(...timestamps));
  const endDate = new Date(Math.max(...timestamps));
  const daySpan = differenceInDays(endDate, startDate);
  const isDailyView = daySpan <= 30;
  const intervals = isDailyView
    ? eachDayOfInterval({ start: startDate, end: endDate })
    : eachWeekOfInterval({ start: startDate, end: endDate });

  return intervals.map((datePoint) => {
    const relevant = isDailyView
      ? filtered.filter((e) => isSameDay(e.date, datePoint))
      : filtered.filter((e) => isSameWeek(e.date, datePoint));
    let score = 0;
    relevant.forEach((e) => {
      if (e.category === EventType.POSITIVE) score += 1;
      else if (e.category === EventType.NEGATIVE) score -= 1;
    });
    return score;
  });
};

/** Smooth values with moving average to reduce jitter */
function smoothValues(values: number[], window = 2): number[] {
  if (values.length < 3) return values;
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(values.length - 1, i + window);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) {
      sum += values[j];
      count++;
    }
    result.push(sum / count);
  }
  return result;
}

/** Create smooth SVG path through points using Catmull-Rom-like curve */
function pointsToSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const path: string[] = [];
  path.push(`M ${points[0].x} ${points[0].y}`);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.3; // 0 = smooth, 1 = sharp
    const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
    const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
    const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
    const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
    path.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`);
  }
  return path.join(' ');
}

const MiniSparkline: React.FC<{ values: number[]; color: string; min?: number; max?: number }> = ({ values, color, min, max }) => {
  if (!values || values.length < 2) {
    return <span className="text-[10px] text-slate-300 block mt-1">אין נתונים</span>;
  }
  const width = 74;
  const height = 26;
  const pad = 2;
  const smoothed = smoothValues(values, 1);
  const vmin = min ?? Math.min(...smoothed);
  const vmax = max ?? Math.max(...smoothed);
  const range = vmax - vmin || 1;
  const points = smoothed.map((v, i) => ({
    x: pad + (i / (smoothed.length - 1)) * (width - pad * 2),
    y: height - pad - ((v - vmin) / range) * (height - pad * 2),
  }));
  const pathD = pointsToSmoothPath(points);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto mt-1">
      <path
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={pathD}
      />
    </svg>
  );
};

const StudentCard: React.FC<{ student: Student; onClick: () => void; index: number; isAnonymous?: boolean }> = ({ student, onClick, index, isAnonymous = false }) => {
  const gradeValues = getGradeSparklineValues(student.grades);
  const behaviorValues = getBehaviorSparklineValues(student.behaviorEvents);
  const behaviorMin = Math.min(0, ...behaviorValues);
  const behaviorMax = Math.max(0, ...behaviorValues);

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
          {student.gradeTrend === 'improving' && <MetricIcons.TrendUp size={18} className="text-grade-success mx-auto" />}
          {student.gradeTrend === 'declining' && <MetricIcons.TrendDown size={18} className="text-grade-danger mx-auto" />}
          {student.gradeTrend === 'stable' && <MetricIcons.TrendStable size={18} className="text-slate-400 mx-auto" />}
          <MiniSparkline values={gradeValues} color="#0c8ee6" min={0} max={100} />
        </div>
        <div className="text-center">
          <span className="text-[10px] text-slate-500 block mb-1">מגמת התנהגות</span>
          {student.behaviorTrend === 'improving' && <MetricIcons.TrendUp size={18} className="text-grade-success mx-auto" />}
          {student.behaviorTrend === 'declining' && <MetricIcons.TrendDown size={18} className="text-grade-danger mx-auto" />}
          {student.behaviorTrend === 'stable' && <MetricIcons.TrendStable size={18} className="text-slate-400 mx-auto" />}
          <MiniSparkline values={behaviorValues} color="#f59e0b" min={behaviorMin} max={behaviorMax} />
        </div>
      </div>
    </div>
  );
};

/* --- Certificate Dialog Component --- */
const CertificateDialog: React.FC<{
  availableSubjects: string[];
  selectedSubjects: Set<string>;
  onToggleSubject: (subject: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onGenerate: () => void;
  onClose: () => void;
  studentCount?: number;
}> = ({ availableSubjects, selectedSubjects, onToggleSubject, onSelectAll, onDeselectAll, onGenerate, onClose, studentCount }) => {
  const allSelected = availableSubjects.length > 0 && selectedSubjects.size === availableSubjects.length;
  const noneSelected = selectedSubjects.size === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-lg p-6 animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-primary-500" size={20} />
            הפקת תעודות לכיתה
            {studentCount !== undefined && (
              <span className="text-sm font-normal text-slate-500">({studentCount} תלמידים)</span>
            )}
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            בחר את המקצועות שיופיעו בתעודות. אם לא תבחר מקצועות, כל המקצועות יופיעו בכל תעודה.
            {studentCount !== undefined && (
              <span className="block mt-1 text-xs text-slate-500">
                יווצר קובץ PDF אחד עם {studentCount} עמודים - עמוד לכל תלמיד.
              </span>
            )}
          </p>
          
          {availableSubjects.length > 0 ? (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  בחר הכל
                </button>
                <button
                  type="button"
                  onClick={onDeselectAll}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  בטל הכל
                </button>
              </div>
              
              <div className="border border-slate-200 rounded-xl p-4 max-h-64 overflow-y-auto">
                <div className="space-y-2">
                  {availableSubjects.map((subject) => {
                    const isSelected = selectedSubjects.has(subject);
                    return (
                      <label
                        key={subject}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-50 border-2 border-primary-300'
                            : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-primary-500 border-primary-500'
                            : 'border-slate-300'
                        }`}>
                          {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="flex-1 text-sm font-medium text-slate-700">{subject}</span>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSubject(subject)}
                          className="sr-only"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
              
              <div className="text-xs text-slate-500 text-center">
                {selectedSubjects.size === 0
                  ? 'כל המקצועות יופיעו בתעודות'
                  : `נבחרו ${selectedSubjects.size} מתוך ${availableSubjects.length} מקצועות`}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <p className="text-sm">אין מקצועות זמינים להצגה בתעודות.</p>
            </div>
          )}
          
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={onGenerate}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium hover:from-primary-600 hover:to-primary-700 shadow-md shadow-primary-500/25"
            >
              <span className="flex items-center justify-center gap-2">
                <FileText size={16} />
                צור תעודות
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
