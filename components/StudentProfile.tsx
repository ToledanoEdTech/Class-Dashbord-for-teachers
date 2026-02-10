import React, { useState, useMemo, useEffect } from 'react';
import { Student, EventType, Grade, BehaviorEvent, RiskSettings, isAbsenceEvent } from '../types';
import { calculateStudentStats } from '../utils/processing';
import { ArrowRight, Calendar, AlertCircle, AlertTriangle, Award, BookOpen, Clock, Info, Download, UserX, Plus, X, CalendarX2, Printer, TrendingUp, TrendingDown, BarChart3, Target, Users, Zap, Star, MessageSquare, ThumbsUp } from 'lucide-react';
import HelpTip from './HelpTip';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { format, differenceInDays, eachDayOfInterval, eachWeekOfInterval, isSameDay, isSameWeek, endOfWeek } from 'date-fns';
import * as XLSX from 'xlsx';
import { getDisplayName } from '../utils/displayName';

interface StudentProfileProps {
  student: Student;
  onBack: () => void;
  classAverage: number;
  onUpdateStudent?: (student: Student) => void;
  riskSettings?: RiskSettings;
  isAnonymous?: boolean;
  studentIndex?: number;
}

// Local helper for startOfWeek to avoid import issues
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const CustomBehaviorTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const details = data.details || {};
        const positives = Object.entries(details).filter(([key, val]: any) => val > 0 && data.positiveTypes.includes(key));
        const negatives = Object.entries(details).filter(([key, val]: any) => val > 0 && data.negativeTypes.includes(key));

        return (
            <div className="bg-white/95 backdrop-blur-sm p-4 border border-slate-200 rounded-xl shadow-elevated text-right text-sm z-50 min-w-[180px]">
                <p className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">{label}</p>
                <div className="space-y-3">
                    {positives.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-emerald-600 mb-1.5">חיזוקים:</p>
                            {positives.map(([key, val]: any) => (
                                <div key={key} className="flex justify-between text-slate-600 text-xs">
                                    <span>{key}</span>
                                    <span className="font-medium">{val}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {negatives.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-red-600 mb-1.5">טעון שיפור:</p>
                            {negatives.map(([key, val]: any) => (
                                <div key={key} className="flex justify-between text-slate-600 text-xs">
                                    <span>{key}</span>
                                    <span className="font-medium">{val}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {positives.length === 0 && negatives.length === 0 && (
                        <p className="text-slate-400 text-xs">אין אירועים רשומים בתקופה זו</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-slate-100 text-xs font-bold flex justify-between">
                        <span>ציון מאזן:</span>
                        <span dir="ltr" className={data.score >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {data.score > 0 ? '+' : ''}{data.score}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

const CustomAbsenceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const count = data.count ?? 0;
        const bySubject = data.bySubject || [];
        return (
            <div className="bg-white/95 backdrop-blur-sm p-4 border border-amber-200/80 rounded-xl shadow-elevated text-right text-sm z-50 min-w-[160px]">
                <p className="font-bold text-slate-800 border-b border-amber-100 pb-2 mb-2">{label}</p>
                <p className="text-amber-700 font-semibold text-sm">{count} חיסור{count !== 1 ? 'ים' : ''}</p>
                {bySubject.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-amber-100 space-y-1">
                        {bySubject.map(({ subject, count: c }: { subject: string; count: number }, i: number) => (
                            <div key={i} className="flex justify-between text-xs text-slate-600">
                                <span>{subject}</span>
                                <span className="font-medium">{c}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const CustomGradeTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const grades = data.grades || [];

        return (
            <div className="bg-white/95 backdrop-blur-sm px-2.5 py-2 border border-slate-200 rounded-lg shadow-elevated text-right text-xs z-50 max-w-[200px]">
                <p className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-1.5 text-xs">{label}</p>
                <div className="flex justify-between text-slate-700 font-medium mb-1.5 text-[11px]">
                    <span>ממוצע שבועי:</span>
                    <span className="text-primary-600">{data.score.toFixed(1)}</span>
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                    {grades.map((g: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] bg-slate-50/80 px-1.5 py-1 rounded">
                            <div className="flex flex-col min-w-0 truncate">
                                <span className="font-medium text-slate-700 truncate">{g.subject}</span>
                                <span className="text-[10px] text-slate-400 truncate">{g.assignment}</span>
                            </div>
                            <span className={`font-bold shrink-0 mr-1 ${g.score < 70 ? 'text-red-600' : 'text-slate-700'}`}>{g.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const StudentProfile: React.FC<StudentProfileProps> = ({ student, onBack, classAverage, onUpdateStudent, riskSettings, isAnonymous = false, studentIndex = 0 }) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'grades' | 'behavior' | 'insights'>('trends');
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Unique subjects from grades and behavior (for filter dropdown)
  const subjectOptions = useMemo(() => {
    const fromGrades = new Set(student.grades.map(g => g.subject).filter(Boolean));
    student.behaviorEvents.forEach(e => {
      const s = e.subject?.trim();
      if (s && !/^\d+$/.test(s)) fromGrades.add(e.subject!);
    });
    return Array.from(fromGrades).sort((a, b) => a.localeCompare(b));
  }, [student.grades, student.behaviorEvents]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle Export to Excel
  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryData = [
        ["שם התלמיד", student.name],
        ["ת.ז", student.id],
        ["ממוצע ציונים", student.averageScore],
        ["ממוצע כיתתי", classAverage],
        ["אירועים שליליים", student.negativeCount],
        ["אירועים חיוביים", student.positiveCount],
        ["רמת סיכון", student.riskLevel],
        ["ציון סיכון", student.riskScore]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "סיכום");

    // 2. Grades Sheet
    const gradesData = student.grades.map(g => ({
        "מקצוע": g.subject,
        "מורה": g.teacher,
        "מטלה": g.assignment,
        "תאריך": format(g.date, 'dd/MM/yyyy'),
        "משקל": g.weight,
        "ציון": g.score
    }));
    const wsGrades = XLSX.utils.json_to_sheet(gradesData);
    XLSX.utils.book_append_sheet(wb, wsGrades, "ציונים");

    // 3. Behavior Sheet
    const behaviorData = student.behaviorEvents.map(e => ({
        "תאריך": format(e.date, 'dd/MM/yyyy'),
        "סוג": e.type,
        "קטגוריה": e.category === EventType.POSITIVE ? 'חיובי' : e.category === EventType.NEGATIVE ? 'שלילי' : 'ניטרלי',
        "מקצוע": e.subject,
        "מורה": e.teacher,
        "הערה": e.comment
    }));
    const wsBehavior = XLSX.utils.json_to_sheet(behaviorData);
    XLSX.utils.book_append_sheet(wb, wsBehavior, "התנהגות");

    // Save File
    XLSX.writeFile(wb, `דוח_תלמיד_${getDisplayName(student.name, studentIndex ?? 0, isAnonymous ?? false)}.xlsx`);
  };

  // Chart Data: Grades - Aggregated by Week (optional filter by subject)
  const gradeChartData = useMemo(() => {
    const grades = selectedSubject
      ? student.grades.filter(g => g.subject === selectedSubject)
      : student.grades;
    if (grades.length === 0) return [];

    const timestamps = grades.map(g => g.date.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const startDate = getStartOfWeek(new Date(minTime));
    const endDate = endOfWeek(new Date(maxTime));

    const weeks = eachWeekOfInterval({ start: startDate, end: endDate });

    return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart);
        const weeklyGrades = grades.filter(g => isSameWeek(g.date, weekStart));
        
        if (weeklyGrades.length === 0) return null;

        const avg = weeklyGrades.reduce((sum, g) => sum + g.score, 0) / weeklyGrades.length;
        
        return {
            date: `${format(weekStart, 'dd/MM')}-${format(weekEnd, 'dd/MM')}`,
            score: parseFloat(avg.toFixed(1)), // Weekly Average
            grades: weeklyGrades, // Details for tooltip
            count: weeklyGrades.length
        };
    }).filter(Boolean); // Remove empty weeks
  }, [student.grades, selectedSubject]);

  // Chart Data: Behavior Trends (excluding absences – positive + other negative only), optional subject filter
  const { chartData: behaviorChartData, viewMode } = useMemo(() => {
    let events = student.behaviorEvents.filter((e) => !isAbsenceEvent(e));
    if (selectedSubject) events = events.filter(e => e.subject === selectedSubject);
    if (events.length === 0) return { chartData: [], viewMode: 'daily' };

    const dates = events.map(e => e.date);
    const timestamps = dates.map(d => d.getTime());
    const startDate = new Date(Math.min(...timestamps));
    const endDate = new Date(Math.max(...timestamps));
    
    const daySpan = differenceInDays(endDate, startDate);
    const isDailyView = daySpan <= 30;

    let timeIntervals: Date[] = [];
    
    if (isDailyView) {
        timeIntervals = eachDayOfInterval({ start: startDate, end: endDate });
    } else {
        timeIntervals = eachWeekOfInterval({ start: startDate, end: endDate });
    }

    const aggregateEvents = (subsetEvents: typeof events, label: string) => {
        const positiveTypes: string[] = [];
        const negativeTypes: string[] = [];
        const details: Record<string, number> = {};
        let positive = 0;
        let negative = 0;

        subsetEvents.forEach(e => {
            const typeKey = e.type || 'אחר';
            if (e.category === EventType.POSITIVE) {
                positive++;
                positiveTypes.push(typeKey);
            } else if (e.category === EventType.NEGATIVE) {
                negative++;
                negativeTypes.push(typeKey);
            }
            if (e.category !== EventType.NEUTRAL) {
                details[typeKey] = (details[typeKey] || 0) + 1;
            }
        });

        return {
            dateLabel: label,
            positive,
            negative,
            score: positive - negative,
            details,
            positiveTypes,
            negativeTypes
        };
    };

    const data = timeIntervals.map(datePoint => {
        let relevantEvents: typeof events = [];
        let label = '';

        if (isDailyView) {
            relevantEvents = events.filter(e => isSameDay(e.date, datePoint));
            label = format(datePoint, 'dd/MM');
        } else {
            relevantEvents = events.filter(e => isSameWeek(e.date, datePoint));
            const endOfWeekDate = endOfWeek(datePoint);
            label = `${format(datePoint, 'dd/MM')}-${format(endOfWeekDate, 'dd/MM')}`;
        }

        return aggregateEvents(relevantEvents, label);
    });

    return { chartData: data, viewMode: isDailyView ? 'daily' : 'weekly' };
  }, [student.behaviorEvents, selectedSubject]);

  // Chart Data: Absences only (same time range and daily/weekly logic as behavior), optional subject filter
  const { chartData: absenceChartData, viewMode: absenceViewMode } = useMemo(() => {
    const allEvents = student.behaviorEvents;
    let absenceEvents = allEvents.filter(isAbsenceEvent);
    if (selectedSubject) absenceEvents = absenceEvents.filter(e => e.subject === selectedSubject);
    if (allEvents.length === 0) return { chartData: [], viewMode: 'daily' as const };

    const dates = allEvents.map((e) => e.date);
    const timestamps = dates.map((d) => d.getTime());
    const startDate = new Date(Math.min(...timestamps));
    const endDate = new Date(Math.max(...timestamps));
    const daySpan = differenceInDays(endDate, startDate);
    const isDailyView = daySpan <= 30;

    let timeIntervals: Date[] = [];
    if (isDailyView) {
      timeIntervals = eachDayOfInterval({ start: startDate, end: endDate });
    } else {
      timeIntervals = eachWeekOfInterval({ start: startDate, end: endDate });
    }

    const displaySubject = (raw: string) => (/^\d+$/.test(String(raw).trim()) ? 'מקצוע לא צוין' : (raw || 'כללי'));

    const data = timeIntervals.map((datePoint) => {
      let relevant: typeof absenceEvents = [];
      let label = '';
      if (isDailyView) {
        relevant = absenceEvents.filter((e) => isSameDay(e.date, datePoint));
        label = format(datePoint, 'dd/MM');
      } else {
        relevant = absenceEvents.filter((e) => isSameWeek(e.date, datePoint));
        const endOfWeekDate = endOfWeek(datePoint);
        label = `${format(datePoint, 'dd/MM')}-${format(endOfWeekDate, 'dd/MM')}`;
      }
      const bySubject: Record<string, number> = {};
      relevant.forEach((e) => {
        const subj = displaySubject(e.subject ?? '');
        bySubject[subj] = (bySubject[subj] || 0) + 1;
      });
      return {
        dateLabel: label,
        count: relevant.length,
        bySubject: Object.entries(bySubject).map(([subject, count]) => ({ subject, count })),
      };
    });

    return { chartData: data, viewMode: isDailyView ? 'daily' : 'weekly' };
  }, [student.behaviorEvents, selectedSubject]);

  // Absence Analysis (subject can be numeric on mobile when column order differs in Excel parsing)
  const displaySubject = (raw: string) => (/^\d+$/.test(String(raw).trim()) ? 'מקצוע לא צוין' : (raw || 'כללי'));

  const absenceData = useMemo(() => {
    const counts: Record<string, number> = {};
    student.behaviorEvents.forEach(e => {
        const type = e.type || '';
        if (type.includes('חיסור') || type.includes('הברזה') || type.includes('אי הגעה') || type.includes('נעדר')) {
            const raw = e.subject ?? '';
            const subj = /^\d+$/.test(String(raw).trim()) ? 'כללי' : (raw || 'כללי');
            counts[subj] = (counts[subj] || 0) + 1;
        }
    });
    
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count > 0);
  }, [student.behaviorEvents]);

  // ניתוח מקצועות - חוזקות וחולשות
  const subjectAnalysis = useMemo(() => {
    const subjectStats: Record<string, { avg: number; count: number; trend: 'improving' | 'declining' | 'stable'; behaviorScore: number }> = {};
    
    // Calculate grades per subject
    student.grades.forEach(g => {
      const subj = displaySubject(g.subject);
      if (!subjectStats[subj]) {
        subjectStats[subj] = { avg: 0, count: 0, trend: 'stable', behaviorScore: 0 };
      }
      subjectStats[subj].avg += g.score;
      subjectStats[subj].count += 1;
    });
    
    // Calculate averages and trends
    Object.keys(subjectStats).forEach(subj => {
      const stats = subjectStats[subj];
      if (stats.count > 0) {
        stats.avg = stats.avg / stats.count;
        
        // Calculate trend for this subject
        const subjectGrades = student.grades
          .filter(g => displaySubject(g.subject) === subj)
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        
        if (subjectGrades.length >= 2) {
          const recent = subjectGrades.slice(-Math.min(3, subjectGrades.length));
          const older = subjectGrades.slice(0, Math.max(0, subjectGrades.length - recent.length));
          if (older.length > 0) {
            const recentAvg = recent.reduce((s, g) => s + g.score, 0) / recent.length;
            const olderAvg = older.reduce((s, g) => s + g.score, 0) / older.length;
            if (recentAvg - olderAvg > 3) stats.trend = 'improving';
            else if (recentAvg - olderAvg < -3) stats.trend = 'declining';
          }
        }
      }
      
      // Calculate behavior score for this subject
      const subjectEvents = student.behaviorEvents.filter(e => displaySubject(e.subject) === subj);
      stats.behaviorScore = subjectEvents.reduce((sum, e) => {
        if (e.category === EventType.POSITIVE) return sum + 1;
        if (e.category === EventType.NEGATIVE) return sum - 2;
        return sum;
      }, 0);
    });
    
    const sorted = Object.entries(subjectStats)
      .filter(([_, stats]) => stats.count > 0)
      .sort((a, b) => b[1].avg - a[1].avg);
    
    return {
      strongest: sorted.slice(0, 3),
      weakest: sorted.slice(-3).reverse(),
      all: sorted
    };
  }, [student.grades, student.behaviorEvents]);

  // ניתוח זמני - דפוסים יומיים
  const temporalAnalysis = useMemo(() => {
    const dayOfWeekCounts: Record<number, { absences: number; negatives: number; positives: number }> = {};
    
    student.behaviorEvents.forEach(e => {
      const dayOfWeek = e.date.getDay(); // 0 = Sunday, 6 = Saturday
      if (!dayOfWeekCounts[dayOfWeek]) {
        dayOfWeekCounts[dayOfWeek] = { absences: 0, negatives: 0, positives: 0 };
      }
      
      if (isAbsenceEvent(e)) {
        dayOfWeekCounts[dayOfWeek].absences++;
      } else if (e.category === EventType.NEGATIVE) {
        dayOfWeekCounts[dayOfWeek].negatives++;
      } else if (e.category === EventType.POSITIVE) {
        dayOfWeekCounts[dayOfWeek].positives++;
      }
    });
    
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const problemDays = Object.entries(dayOfWeekCounts)
      .filter(([_, counts]) => counts.absences + counts.negatives > 2)
      .map(([day, counts]) => ({
        day: parseInt(day),
        dayName: dayNames[parseInt(day)],
        ...counts
      }))
      .sort((a, b) => (b.absences + b.negatives) - (a.absences + a.negatives));
    
    // Time-based trend (early vs late semester)
    const sortedGrades = [...student.grades].sort((a, b) => a.date.getTime() - b.date.getTime());
    const sortedEvents = [...student.behaviorEvents].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    let earlyLateComparison: { early: { avg: number; behaviorScore: number }; late: { avg: number; behaviorScore: number } } | null = null;
    
    if (sortedGrades.length >= 4 && sortedEvents.length >= 4) {
      const midPoint = Math.floor(sortedGrades.length / 2);
      const earlyGrades = sortedGrades.slice(0, midPoint);
      const lateGrades = sortedGrades.slice(midPoint);
      
      const midEventPoint = Math.floor(sortedEvents.length / 2);
      const earlyEvents = sortedEvents.slice(0, midEventPoint);
      const lateEvents = sortedEvents.slice(midEventPoint);
      
      const earlyAvg = earlyGrades.length > 0 ? earlyGrades.reduce((s, g) => s + g.score, 0) / earlyGrades.length : 0;
      const lateAvg = lateGrades.length > 0 ? lateGrades.reduce((s, g) => s + g.score, 0) / lateGrades.length : 0;
      
      const earlyBehaviorScore = earlyEvents.reduce((sum, e) => {
        if (e.category === EventType.POSITIVE) return sum + 1;
        if (e.category === EventType.NEGATIVE) return sum - 2;
        return sum;
      }, 0);
      
      const lateBehaviorScore = lateEvents.reduce((sum, e) => {
        if (e.category === EventType.POSITIVE) return sum + 1;
        if (e.category === EventType.NEGATIVE) return sum - 2;
        return sum;
      }, 0);
      
      earlyLateComparison = {
        early: { avg: earlyAvg, behaviorScore: earlyBehaviorScore },
        late: { avg: lateAvg, behaviorScore: lateBehaviorScore }
      };
    }
    
    return { problemDays, earlyLateComparison };
  }, [student.behaviorEvents, student.grades]);

  // ניתוח התנהגות מפורט
  const behaviorAnalysis = useMemo(() => {
    const behaviorTypes: Record<string, { count: number; category: EventType }> = {};
    
    student.behaviorEvents.forEach(e => {
      const type = e.type || 'אחר';
      if (!behaviorTypes[type]) {
        behaviorTypes[type] = { count: 0, category: e.category };
      }
      behaviorTypes[type].count++;
    });
    
    const mostCommon = Object.entries(behaviorTypes)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    
    const positiveRatio = student.behaviorEvents.length > 0 
      ? student.positiveCount / student.behaviorEvents.length 
      : 0;
    
    // Behavior by subject
    const behaviorBySubject: Record<string, { positive: number; negative: number; neutral: number }> = {};
    student.behaviorEvents.forEach(e => {
      const subj = displaySubject(e.subject);
      if (!behaviorBySubject[subj]) {
        behaviorBySubject[subj] = { positive: 0, negative: 0, neutral: 0 };
      }
      if (e.category === EventType.POSITIVE) behaviorBySubject[subj].positive++;
      else if (e.category === EventType.NEGATIVE) behaviorBySubject[subj].negative++;
      else behaviorBySubject[subj].neutral++;
    });
    
    const problematicSubjects = Object.entries(behaviorBySubject)
      .filter(([_, counts]) => counts.negative > counts.positive && counts.negative > 1)
      .sort((a, b) => (b[1].negative - b[1].positive) - (a[1].negative - a[1].positive));
    
    const positiveSubjects = Object.entries(behaviorBySubject)
      .filter(([_, counts]) => counts.positive > counts.negative * 2 && counts.positive > 2)
      .sort((a, b) => (b[1].positive - b[1].negative) - (a[1].positive - a[1].negative));
    
    return { mostCommon, positiveRatio, problematicSubjects, positiveSubjects };
  }, [student.behaviorEvents]);

  // ניתוח מגמות מתקדם
  const advancedTrends = useMemo(() => {
    const sortedGrades = [...student.grades].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Consistency (volatility) - standard deviation
    let consistency = 0;
    if (sortedGrades.length >= 2) {
      const avg = sortedGrades.reduce((s, g) => s + g.score, 0) / sortedGrades.length;
      const variance = sortedGrades.reduce((s, g) => s + Math.pow(g.score - avg, 2), 0) / sortedGrades.length;
      consistency = Math.sqrt(variance);
    }
    
    // Rate of change (acceleration)
    let acceleration: 'accelerating' | 'decelerating' | 'stable' = 'stable';
    if (sortedGrades.length >= 6) {
      const thirds = [
        sortedGrades.slice(0, Math.floor(sortedGrades.length / 3)),
        sortedGrades.slice(Math.floor(sortedGrades.length / 3), Math.floor(sortedGrades.length * 2 / 3)),
        sortedGrades.slice(Math.floor(sortedGrades.length * 2 / 3))
      ];
      
      const avgs = thirds.map(third => 
        third.length > 0 ? third.reduce((s, g) => s + g.score, 0) / third.length : 0
      );
      
      const change1 = avgs[1] - avgs[0];
      const change2 = avgs[2] - avgs[1];
      
      if (change2 > change1 + 2) acceleration = 'accelerating';
      else if (change2 < change1 - 2) acceleration = 'decelerating';
    }
    
    // Recovery patterns - grades after negative events
    const recoveryPatterns: Array<{ eventDate: Date; gradesAfter: number[] }> = [];
    const negativeEvents = student.behaviorEvents
      .filter(e => e.category === EventType.NEGATIVE && !isAbsenceEvent(e))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    negativeEvents.forEach(event => {
      const gradesAfter = sortedGrades
        .filter(g => {
          const daysDiff = (g.date.getTime() - event.date.getTime()) / (1000 * 60 * 60 * 24);
          return daysDiff > 0 && daysDiff <= 7; // Grades within 7 days after event
        })
        .map(g => g.score);
      
      if (gradesAfter.length > 0) {
        recoveryPatterns.push({ eventDate: event.date, gradesAfter });
      }
    });
    
    const avgRecovery = recoveryPatterns.length > 0
      ? recoveryPatterns.reduce((sum, p) => sum + (p.gradesAfter.reduce((s, g) => s + g, 0) / p.gradesAfter.length), 0) / recoveryPatterns.length
      : null;
    
    return { consistency, acceleration, avgRecovery, recoveryPatterns: recoveryPatterns.length };
  }, [student.grades, student.behaviorEvents]);

  // השוואות עם ממוצע כיתתי
  const comparisonAnalysis = useMemo(() => {
    const subjectComparisons = subjectAnalysis.all.map(([subj, stats]) => {
      // For now, we compare to class average (could be enhanced with per-subject class averages)
      const diff = stats.avg - classAverage;
      const percentage = classAverage > 0 ? ((diff / classAverage) * 100) : 0;
      
      return {
        subject: subj,
        studentAvg: stats.avg,
        classAvg: classAverage,
        diff,
        percentage,
        status: diff > 5 ? 'above' : diff < -5 ? 'below' : 'similar'
      };
    });
    
    return {
      overallDiff: student.averageScore - classAverage,
      overallPercentage: classAverage > 0 ? ((student.averageScore - classAverage) / classAverage) * 100 : 0,
      subjectComparisons: subjectComparisons.filter(c => Math.abs(c.diff) > 3) // Only show significant differences
    };
  }, [student.averageScore, classAverage, subjectAnalysis]);

  const riskStyles = {
    high: 'text-red-700 font-bold bg-red-50 border-red-200',
    medium: 'text-amber-700 font-bold bg-amber-50 border-amber-200',
    low: 'text-emerald-700 font-bold bg-emerald-50 border-emerald-200',
  };
  const riskLabels = { high: 'סיכון גבוה', medium: 'סיכון בינוני', low: 'סיכון נמוך' };

  const handleAddGrade = (subject: string, score: number, assignment: string, date: Date, weight: number) => {
    const newGrade: Grade = {
      studentId: student.id,
      studentName: student.name,
      subject: subject || 'כללי',
      teacher: '',
      assignment: assignment || 'מטלה',
      date,
      score,
      weight: weight || 1,
    };
    const updated: Student = { ...student, grades: [...student.grades, newGrade] };
    const recalculated = riskSettings ? calculateStudentStats(updated, riskSettings) : updated;
    onUpdateStudent?.(recalculated);
    setShowAddGrade(false);
  };

  const handleAddEvent = (type: string, category: EventType, subject: string, date: Date, comment: string) => {
    const newEvent: BehaviorEvent = {
      id: `evt-manual-${Date.now()}`,
      studentId: student.id,
      studentName: student.name,
      date,
      type: type || 'הערה',
      category,
      teacher: '',
      subject: subject || 'כללי',
      lessonNumber: 0,
      justification: '',
      comment: comment || '',
    };
    const updated: Student = { ...student, behaviorEvents: [...student.behaviorEvents, newEvent] };
    const recalculated = riskSettings ? calculateStudentStats(updated, riskSettings) : updated;
    onUpdateStudent?.(recalculated);
    setShowAddEvent(false);
  };

  return (
    <div className="pb-safe animate-fade-in min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/20">
      {/* Sticky Header - Compact on Mobile */}
      <div className="sticky top-16 z-40 glass border-b border-slate-200/80 shadow-soft">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-2 md:py-5">
          {/* Mobile Compact Layout */}
          <div className="md:hidden">
            {/* Back Button - Smaller */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-slate-500 hover:text-primary-600 transition-colors mb-2 text-xs font-medium"
            >
              <ArrowRight size={14} strokeWidth={2} />
              חזרה
            </button>

            {/* Student Info - Compact Row */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold text-white shadow-md shrink-0
                ${student.averageScore < 60 ? 'bg-gradient-to-br from-red-500 to-rose-600' : 
                  student.averageScore < 80 ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 
                  'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                {Math.round(student.averageScore)}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-slate-800 leading-tight tracking-tight truncate">{getDisplayName(student.name, studentIndex, isAnonymous)}</h1>
                <div className="text-slate-500 text-[10px] flex items-center gap-1.5 mt-0.5">
                  <span className="truncate">ת.ז: {student.id}</span>
                  <span className="text-slate-300">•</span>
                  <span>{student.grades.length} ציונים</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] border ${riskStyles[student.riskLevel]}`}>
                  {riskLabels[student.riskLevel]}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => window.print()}
                    className="no-print bg-white border border-slate-200 text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all"
                    title="הדפסה"
                  >
                    <Printer size={14} strokeWidth={2} />
                  </button>
                  <button
                    onClick={handleExport}
                    className="bg-white border border-slate-200 text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-all"
                    title="ייצוא"
                  >
                    <Download size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs - Compact */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide -mx-1 px-1">
              {[
                { id: 'trends', label: 'מגמות' },
                { id: 'grades', label: 'ציונים' },
                { id: 'behavior', label: 'התנהגות' },
                { id: 'insights', label: 'תובנות' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all whitespace-nowrap text-xs flex-shrink-0
                    ${activeTab === tab.id
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-md shadow-primary-500/25'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:block">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-500 hover:text-primary-600 transition-colors mb-4 text-sm md:text-base font-medium"
            >
              <ArrowRight size={18} strokeWidth={2} />
              חזרה לדשבורד
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start md:items-center gap-4">
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-xl md:text-2xl font-bold text-white shadow-lg shrink-0
                  ${student.averageScore < 60 ? 'bg-gradient-to-br from-red-500 to-rose-600' : 
                    student.averageScore < 80 ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 
                    'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                  {Math.round(student.averageScore)}
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight tracking-tight">{getDisplayName(student.name, studentIndex, isAnonymous)}</h1>
                  <div className="text-slate-500 text-xs md:text-sm flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    <span>ת.ז: {student.id}</span>
                    <span className="text-slate-300 hidden md:inline">|</span>
                    <span>{student.grades.length} ציונים</span>
                    <span className="text-slate-300 hidden md:inline">|</span>
                    <span>{student.behaviorEvents.length} אירועי התנהגות</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-row md:flex-col justify-between md:justify-end items-center md:items-end gap-3 mt-2 md:mt-0">
                <div className="flex gap-2 items-center md:flex-col md:items-end md:gap-1">
                  <span className={`px-3 py-1 rounded-xl text-xs md:text-sm border ${riskStyles[student.riskLevel]}`}>
                    {riskLabels[student.riskLevel]}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden md:block">ציון סיכון: {student.riskScore}/10 <HelpTip text="ציון סיכון מ-1 עד 10. ציון נמוך = סיכון גבוה. מחושב לפי ממוצע ציונים, מגמות, אירועים שליליים וחיסורים." /></span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="no-print bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 font-medium text-sm flex items-center gap-2 shadow-card transition-all"
                  >
                    <Printer size={16} strokeWidth={2} />
                    <span className="hidden md:inline">הדפסה</span>
                  </button>
                  <button
                    onClick={handleExport}
                    className="bg-white border border-slate-200 text-slate-700 px-3 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 font-medium text-sm flex items-center gap-2 shadow-card transition-all"
                  >
                    <Download size={16} strokeWidth={2} />
                    <span className="hidden md:inline">ייצוא לאקסל</span>
                    <span className="md:hidden">ייצוא</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto mt-5 pb-1 scrollbar-hide">
              {[
                { id: 'trends', label: 'מגמות וניתוח' },
                { id: 'grades', label: 'גיליון ציונים' },
                { id: 'behavior', label: 'יומן התנהגות' },
                { id: 'insights', label: 'תובנות' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap text-sm flex-shrink-0
                    ${activeTab === tab.id
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-3 md:p-6 min-h-[500px]">
        {activeTab === 'trends' && (
          <div className="grid grid-cols-1 gap-5 md:gap-6">
            {/* Subject filter for all three charts */}
            <div className="bg-white p-3 md:p-4 rounded-2xl shadow-card border border-slate-100/80 flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-slate-700">מגמה לפי מקצוע:</span>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 min-w-[180px]"
              >
                <option value="">כל המקצועות</option>
                {subjectOptions.map((subj) => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>
              {selectedSubject && (
                <span className="text-xs text-slate-500">מציג ציונים, התנהגות וחיסורים במקצוע נבחר בלבד</span>
              )}
            </div>

            {/* Grades Chart */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-6 gap-2">
                    <h3 className="text-lg font-bold text-slate-700">
                      מגמת ציונים (ממוצע שבועי)
                      {selectedSubject && <span className="text-primary-600 font-normal text-base"> – {selectedSubject}</span>}
                    </h3>
                    <div className="flex gap-4 text-xs flex-wrap">
                         <div className="flex items-center gap-1">
                            <div className="w-3 h-0.5 bg-red-500"></div>
                            <span>סף נכשל (55)</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <div className="w-3 h-0.5 bg-orange-400 border-dashed border-t"></div>
                            <span>ממוצע כיתתי ({classAverage.toFixed(1)})</span>
                         </div>
                    </div>
                </div>
                {/* Scrollable Container for Mobile */}
                <div className="overflow-x-auto">
                    <div className="h-64 md:h-72 w-full min-w-[500px] md:min-w-0">
                    {gradeChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={gradeChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis 
                                dataKey="date" 
                                tick={{ fontSize: 10, fill: '#64748b' }}
                                tickMargin={10}
                            />
                            <YAxis domain={[0, 100]} hide={false} width={30} tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomGradeTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
                            <ReferenceLine y={55} label={{ value: "55", position: 'right', fill: 'red', fontSize: 10 }} stroke="red" strokeDasharray="3 3" />
                            <ReferenceLine y={classAverage} label={{ value: "כיתתי", position: 'right', fill: 'orange', fontSize: 10 }} stroke="orange" strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="score" stroke="#0c8ee6" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">אין מספיק נתוני ציונים להצגה</div>
                    )}
                    </div>
                </div>
            </div>

            {/* Behavior Chart – positive & negative (no absences) */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                <div className="flex justify-between items-center mb-4 md:mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-slate-700">
                          אירועי משמעת – חיזוקים וטעון שיפור
                          {selectedSubject && <span className="text-primary-600 font-normal text-base"> – {selectedSubject}</span>}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">ללא חיסורים (מוצגים בגרף נפרד)</p>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                        {viewMode === 'daily' ? 'תצוגה יומית' : 'תצוגה שבועית'}
                    </span>
                </div>
                
                 {/* Scrollable Container for Mobile */}
                 <div className="overflow-x-auto">
                    <div className="h-64 md:h-80 w-full min-w-[500px] md:min-w-0">
                        {behaviorChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={behaviorChartData} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis 
                                        dataKey="dateLabel" 
                                        height={60}
                                        tick={{ fontSize: 10, fill: '#64748b' }}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        minTickGap={5}
                                        interval={0}
                                    />
                                    <YAxis allowDecimals={false} width={30} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomBehaviorTooltip />} cursor={{fill: 'transparent'}} />
                                    <ReferenceLine y={0} stroke="#cbd5e1" />
                                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                                        {behaviorChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.score >= 0 ? '#10b981' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">אין מספיק נתונים להצגת גרף התנהגות (חיובי/שלילי)</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Absences Chart – separate chart */}
            <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 p-5 md:p-6 rounded-2xl shadow-card border border-amber-100/80 hover:shadow-card-hover transition-shadow">
                <div className="flex justify-between items-center mb-4 md:mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                            <CalendarX2 size={22} strokeWidth={2} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">
                              חיסורים לאורך זמן
                              {selectedSubject && <span className="text-primary-600 font-normal text-base"> – {selectedSubject}</span>}
                            </h3>
                            <p className="text-xs text-amber-700/90 mt-0.5">חיסורים (ללא הצדקה) לפי תאריך</p>
                        </div>
                    </div>
                    <span className="text-xs font-medium text-amber-700 bg-amber-100/80 px-2 py-1 rounded-lg">
                        {absenceViewMode === 'daily' ? 'תצוגה יומית' : 'תצוגה שבועית'}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <div className="h-64 md:h-72 w-full min-w-[500px] md:min-w-0">
                        {absenceChartData.some((d) => d.count > 0) ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={absenceChartData} margin={{ bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#fde68a" />
                                    <XAxis
                                        dataKey="dateLabel"
                                        height={60}
                                        tick={{ fontSize: 10, fill: '#92400e' }}
                                        tickMargin={10}
                                        angle={-45}
                                        textAnchor="end"
                                        minTickGap={5}
                                        interval={0}
                                    />
                                    <YAxis allowDecimals={false} width={30} tick={{ fontSize: 10, fill: '#92400e' }} />
                                    <Tooltip content={<CustomAbsenceTooltip />} cursor={{ fill: 'rgba(251,191,36,0.15)' }} />
                                    <Bar dataKey="count" name="חיסורים" radius={[6, 6, 0, 0]} fill="#f59e0b" stroke="#d97706" strokeWidth={1}>
                                        {absenceChartData.map((entry, index) => (
                                            <Cell
                                                key={`absence-cell-${index}`}
                                                fill={entry.count > 0 ? '#f59e0b' : 'transparent'}
                                                stroke={entry.count > 0 ? '#d97706' : 'transparent'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-amber-800/70">
                                <CalendarX2 size={40} className="opacity-50 mb-2" />
                                <p className="text-sm font-medium">לא נרשמו חיסורים לתלמיד זה</p>
                                <p className="text-xs text-amber-700/70 mt-1">חיסורים יופיעו כאן כאשר יוזנו במערכת</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'grades' && (
            <div className="space-y-4">
                 {onUpdateStudent && (
                   <div className="flex justify-end">
                     <button
                       type="button"
                       onClick={() => setShowAddGrade(true)}
                       className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors shadow-card"
                     >
                       <Plus size={18} />
                       הוסף ציון
                     </button>
                   </div>
                 )}
                 {/* Mobile Cards View for Grades */}
                 <div className="md:hidden space-y-3">
                    {student.grades.map((grade, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card flex justify-between items-center">
                            <div>
                                <h4 className="font-bold text-slate-800">{grade.subject}</h4>
                                <div className="text-sm text-slate-600 mt-1">{grade.assignment}</div>
                                <div className="text-xs text-slate-400 mt-2 flex gap-3">
                                    <span>{format(grade.date, 'dd/MM')}</span>
                                    <span>•</span>
                                    <span>משקל {grade.weight}%</span>
                                </div>
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold
                                ${grade.score < 60 ? 'bg-red-50 text-red-600 border border-red-100' : 
                                  grade.score < 80 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}
                            `}>
                                {grade.score}
                            </div>
                        </div>
                    ))}
                 </div>

                {/* Desktop Table View for Grades */}
                <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden hidden md:block">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50/80 text-slate-500 text-sm">
                            <tr>
                                <th className="px-6 py-4">מקצוע</th>
                                <th className="px-6 py-4">מטלה</th>
                                <th className="px-6 py-4">תאריך</th>
                                <th className="px-6 py-4">משקל</th>
                                <th className="px-6 py-4">ציון</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {student.grades.map((grade, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium">{grade.subject}</td>
                                    <td className="px-6 py-4 text-slate-600">{grade.assignment}</td>
                                    <td className="px-6 py-4 text-slate-400 text-sm">{format(grade.date, 'dd/MM/yyyy')}</td>
                                    <td className="px-6 py-4 text-slate-400">{grade.weight}%</td>
                                    <td className="px-6 py-4">
                                        <span className={`font-bold px-2 py-1 rounded-lg
                                            ${grade.score < 60 ? 'bg-red-50 text-red-700' : 
                                            grade.score < 80 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}
                                        `}>
                                            {grade.score}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'behavior' && (
             <div className="space-y-3 md:space-y-4">
                 {onUpdateStudent && (
                   <div className="flex justify-end">
                     <button
                       type="button"
                       onClick={() => setShowAddEvent(true)}
                       className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors shadow-card"
                     >
                       <Plus size={18} />
                       הוסף אירוע
                     </button>
                   </div>
                 )}
                 {student.behaviorEvents.length === 0 ? (
                     <div className="text-center py-12 text-slate-400 bg-white rounded-2xl shadow-card border border-slate-100">אין אירועי התנהגות רשומים.</div>
                 ) : (
                    student.behaviorEvents.map((event, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card flex items-start gap-3 md:gap-4 hover:shadow-card-hover transition-shadow">
                            <div className={`mt-1 p-2 rounded-full shrink-0 
                                ${event.category === EventType.POSITIVE ? 'bg-emerald-100 text-emerald-600' : 
                                  event.category === EventType.NEGATIVE ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                {event.category === EventType.POSITIVE && <Award size={18} className="md:w-5 md:h-5" />}
                                {event.category === EventType.NEGATIVE && <AlertTriangle size={18} className="md:w-5 md:h-5" />}
                                {event.category === EventType.NEUTRAL && <Info size={18} className="md:w-5 md:h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-800 text-sm md:text-base truncate">{event.type}</h4>
                                    <span className="text-xs text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-full shrink-0">
                                        <Calendar size={10} />
                                        {format(event.date, 'dd/MM')}
                                    </span>
                                </div>
                                <p className="text-slate-600 text-xs md:text-sm mt-1 truncate">
                                    <span className="font-medium text-slate-800">{displaySubject(event.subject)}</span> • המורה {event.teacher}
                                </p>
                                {event.comment && (
                                    <div className="mt-2 bg-slate-50 p-2 rounded text-xs md:text-sm text-slate-600 italic">
                                        "{event.comment}"
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                 )}
             </div>
        )}

        {activeTab === 'insights' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                
                {/* ניתוח מקצועות - חוזקות וחולשות */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChart3 className="text-primary-500" size={20} />
                        ניתוח מקצועות
                    </h3>
                    {subjectAnalysis.all.length > 0 ? (
                        <div className="space-y-4">
                            {subjectAnalysis.strongest.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-emerald-600 mb-2">חוזקות:</p>
                                    <div className="space-y-2">
                                        {subjectAnalysis.strongest.map(([subj, stats], idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                                <div className="flex-1">
                                                    <span className="font-medium text-slate-700 text-sm">{subj}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-600">ממוצע: {stats.avg.toFixed(1)}</span>
                                                        {stats.trend === 'improving' && <TrendingUp size={12} className="text-emerald-600" />}
                                                        {stats.trend === 'declining' && <TrendingDown size={12} className="text-red-600" />}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                                                    {stats.avg.toFixed(0)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {subjectAnalysis.weakest.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-red-600 mb-2">חולשות:</p>
                                    <div className="space-y-2">
                                        {subjectAnalysis.weakest.map(([subj, stats], idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-red-50/50 rounded-lg border border-red-100">
                                                <div className="flex-1">
                                                    <span className="font-medium text-slate-700 text-sm">{subj}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-slate-600">ממוצע: {stats.avg.toFixed(1)}</span>
                                                        {stats.trend === 'improving' && <TrendingUp size={12} className="text-emerald-600" />}
                                                        {stats.trend === 'declining' && <TrendingDown size={12} className="text-red-600" />}
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-1 rounded">
                                                    {stats.avg.toFixed(0)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">אין מספיק נתוני ציונים לניתוח מקצועות.</p>
                    )}
                </div>

                {/* Absence Analysis Card */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserX className="text-red-500" size={20} />
                        מוקדי חיסורים
                    </h3>
                    {absenceData.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 mb-2">פירוט מקצועות בהם נרשמו חיסורים:</p>
                            {absenceData.map(([subject, count], idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                    <span className="font-medium text-slate-700 text-sm">{displaySubject(subject)}</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-lg
                                        ${count > 3 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}
                                    `}>
                                        {count} חיסורים
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">לא נרשמו חיסורים לתלמיד זה.</p>
                    )}
                </div>

                {/* ניתוח זמני */}
                {temporalAnalysis.problemDays.length > 0 && (
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar className="text-amber-500" size={20} />
                            דפוסים זמניים
                        </h3>
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 mb-2">ימים בעייתיים (חיסורים ואירועים שליליים):</p>
                            {temporalAnalysis.problemDays.slice(0, 3).map((day, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-amber-50/50 rounded-lg border border-amber-100">
                                    <span className="font-medium text-slate-700 text-sm">יום {day.dayName}</span>
                                    <div className="flex gap-2 text-xs">
                                        {day.absences > 0 && (
                                            <span className="bg-red-100 text-red-700 px-2 py-1 rounded">{day.absences} חיסורים</span>
                                        )}
                                        {day.negatives > 0 && (
                                            <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">{day.negatives} שליליים</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {temporalAnalysis.earlyLateComparison && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="text-xs font-semibold text-slate-600 mb-2">השוואת תחילת/סוף תקופה:</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-50 p-2 rounded">
                                        <div className="font-medium text-slate-700">תחילת תקופה</div>
                                        <div className="text-slate-600">ממוצע: {temporalAnalysis.earlyLateComparison.early.avg.toFixed(1)}</div>
                                    </div>
                                    <div className={`p-2 rounded ${
                                        temporalAnalysis.earlyLateComparison.late.avg > temporalAnalysis.earlyLateComparison.early.avg + 3
                                            ? 'bg-emerald-50 border border-emerald-200' 
                                            : temporalAnalysis.earlyLateComparison.late.avg < temporalAnalysis.earlyLateComparison.early.avg - 3
                                            ? 'bg-red-50 border border-red-200'
                                            : 'bg-slate-50'
                                    }`}>
                                        <div className="font-medium text-slate-700">סוף תקופה</div>
                                        <div className="text-slate-600">ממוצע: {temporalAnalysis.earlyLateComparison.late.avg.toFixed(1)}</div>
                                        {temporalAnalysis.earlyLateComparison.late.avg > temporalAnalysis.earlyLateComparison.early.avg + 3 && (
                                            <div className="text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                                                <TrendingUp size={12} />
                                                שיפור של {(temporalAnalysis.earlyLateComparison.late.avg - temporalAnalysis.earlyLateComparison.early.avg).toFixed(1)} נקודות!
                                            </div>
                                        )}
                                        {temporalAnalysis.earlyLateComparison.late.avg < temporalAnalysis.earlyLateComparison.early.avg - 3 && (
                                            <div className="text-red-700 font-semibold mt-1 flex items-center gap-1">
                                                <TrendingDown size={12} />
                                                ירידה של {(temporalAnalysis.earlyLateComparison.early.avg - temporalAnalysis.earlyLateComparison.late.avg).toFixed(1)} נקודות
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ניתוח התנהגות מפורט */}
                {behaviorAnalysis.mostCommon.length > 0 && (
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Target className="text-purple-500" size={20} />
                            ניתוח התנהגות מפורט
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-semibold text-slate-600 mb-2">סוגי התנהגות נפוצים:</p>
                                <div className="space-y-2">
                                    {behaviorAnalysis.mostCommon.map(([type, data], idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-sm text-slate-700">{type}</span>
                                            <span className={`text-xs font-bold px-2 py-1 rounded
                                                ${data.category === EventType.POSITIVE ? 'bg-emerald-100 text-emerald-700' :
                                                  data.category === EventType.NEGATIVE ? 'bg-red-100 text-red-700' :
                                                  'bg-slate-100 text-slate-700'}
                                            `}>
                                                {data.count}x
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-3 border-t border-slate-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">יחס חיובי/שלילי:</span>
                                    <span className={`text-sm font-bold px-2 py-1 rounded
                                        ${behaviorAnalysis.positiveRatio > 0.5 ? 'bg-emerald-100 text-emerald-700' :
                                          behaviorAnalysis.positiveRatio > 0.3 ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-700'}
                                    `}>
                                        {(behaviorAnalysis.positiveRatio * 100).toFixed(0)}% חיובי
                                    </span>
                                </div>
                            </div>
                            {behaviorAnalysis.positiveSubjects && behaviorAnalysis.positiveSubjects.length > 0 && (
                                <div className="pt-3 border-t border-slate-200">
                                    <p className="text-xs font-semibold text-emerald-600 mb-2">מקצועות עם התנהגות מצוינת:</p>
                                    <div className="space-y-1">
                                        {behaviorAnalysis.positiveSubjects.slice(0, 3).map(([subj, counts], idx) => (
                                            <div key={idx} className="text-xs text-emerald-700 flex items-center gap-2">
                                                <ThumbsUp size={12} />
                                                {subj}: {counts.positive} חיוביים, {counts.negative} שליליים
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {behaviorAnalysis.problematicSubjects.length > 0 && (
                                <div className="pt-3 border-t border-slate-200">
                                    <p className="text-xs font-semibold text-red-600 mb-2">מקצועות בעייתיים:</p>
                                    <div className="space-y-1">
                                        {behaviorAnalysis.problematicSubjects.slice(0, 3).map(([subj, counts], idx) => (
                                            <div key={idx} className="text-xs text-slate-600">
                                                {subj}: {counts.negative} שליליים, {counts.positive} חיוביים
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ניתוח מגמות מתקדם */}
                {student.grades.length >= 3 && (
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Zap className="text-blue-500" size={20} />
                            ניתוח מגמות מתקדם
                        </h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                <span className="text-sm text-slate-700">עקביות בציונים:</span>
                                <span className={`text-xs font-bold px-2 py-1 rounded
                                    ${advancedTrends.consistency < 10 ? 'bg-emerald-100 text-emerald-700' :
                                      advancedTrends.consistency < 15 ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'}
                                `}>
                                    {advancedTrends.consistency.toFixed(1)} (סטיית תקן)
                                </span>
                            </div>
                            {advancedTrends.acceleration !== 'stable' && (
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-sm text-slate-700">קצב שינוי:</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1
                                        ${advancedTrends.acceleration === 'accelerating' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                                    `}>
                                        {advancedTrends.acceleration === 'accelerating' ? (
                                            <>מאיץ <TrendingUp size={12} /></>
                                        ) : (
                                            <>מאט <TrendingDown size={12} /></>
                                        )}
                                    </span>
                                </div>
                            )}
                            {advancedTrends.avgRecovery !== null && (
                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                    <span className="text-sm text-slate-700">ממוצע התאוששות:</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded
                                        ${advancedTrends.avgRecovery! > 70 ? 'bg-emerald-100 text-emerald-700' :
                                          advancedTrends.avgRecovery! > 60 ? 'bg-amber-100 text-amber-700' :
                                          'bg-red-100 text-red-700'}
                                    `}>
                                        {advancedTrends.avgRecovery!.toFixed(1)} (אחרי אירועים שליליים)
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* השוואות עם ממוצע כיתתי */}
                {comparisonAnalysis.subjectComparisons.length > 0 && (
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Users className="text-indigo-500" size={20} />
                            השוואה לכיתה
                        </h3>
                        <div className="space-y-3">
                            <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-medium text-slate-700">ממוצע כללי</span>
                                    <span className={`text-sm font-bold
                                        ${comparisonAnalysis.overallDiff > 0 ? 'text-emerald-700' :
                                          comparisonAnalysis.overallDiff < 0 ? 'text-red-700' : 'text-slate-700'}
                                    `}>
                                        {comparisonAnalysis.overallDiff > 0 ? '+' : ''}{comparisonAnalysis.overallDiff.toFixed(1)}
                                        <span className="text-xs text-slate-500 mr-1">({comparisonAnalysis.overallPercentage > 0 ? '+' : ''}{comparisonAnalysis.overallPercentage.toFixed(1)}%)</span>
                                    </span>
                                </div>
                                <div className="text-xs text-slate-600">
                                    תלמיד: {student.averageScore.toFixed(1)} | כיתה: {classAverage.toFixed(1)}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-slate-600 mb-2">הבדלים משמעותיים לפי מקצוע:</p>
                                <div className="space-y-2">
                                    {comparisonAnalysis.subjectComparisons.slice(0, 5).map((comp, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                            <span className="text-sm text-slate-700">{comp.subject}</span>
                                            <span className={`text-xs font-bold px-2 py-1 rounded
                                                ${comp.status === 'above' ? 'bg-emerald-100 text-emerald-700' :
                                                  comp.status === 'below' ? 'bg-red-100 text-red-700' :
                                                  'bg-slate-100 text-slate-700'}
                                            `}>
                                                {comp.diff > 0 ? '+' : ''}{comp.diff.toFixed(1)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* הישגים וחוזקות */}
                {(student.averageScore >= 85 || student.positiveCount > student.negativeCount * 2 || comparisonAnalysis.overallDiff > 5 || student.gradeTrend === 'improving') && (
                    <div className="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-5 md:p-6 rounded-2xl shadow-card border border-emerald-100/80 hover:shadow-card-hover transition-shadow md:col-span-2">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Star className="text-emerald-600" size={20} />
                            הישגים וחוזקות
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {student.averageScore >= 85 && (
                                <div className="bg-white/70 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Award className="text-emerald-600" size={16} />
                                        <span className="font-bold text-emerald-700 text-sm">תלמיד מצטיין</span>
                                    </div>
                                    <p className="text-xs text-slate-700">ממוצע ציונים גבוה: {student.averageScore.toFixed(1)}</p>
                                </div>
                            )}
                            {comparisonAnalysis.overallDiff > 5 && (
                                <div className="bg-white/70 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="text-emerald-600" size={16} />
                                        <span className="font-bold text-emerald-700 text-sm">מעל הממוצע הכיתתי</span>
                                    </div>
                                    <p className="text-xs text-slate-700">ב-{comparisonAnalysis.overallDiff.toFixed(1)} נקודות מהממוצע</p>
                                </div>
                            )}
                            {student.positiveCount > student.negativeCount * 2 && student.positiveCount > 0 && (
                                <div className="bg-white/70 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ThumbsUp className="text-emerald-600" size={16} />
                                        <span className="font-bold text-emerald-700 text-sm">התנהגות מצוינת</span>
                                    </div>
                                    <p className="text-xs text-slate-700">{student.positiveCount} אירועים חיוביים לעומת {student.negativeCount} שליליים</p>
                                </div>
                            )}
                            {student.gradeTrend === 'improving' && (
                                <div className="bg-white/70 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="text-emerald-600" size={16} />
                                        <span className="font-bold text-emerald-700 text-sm">מגמה חיובית</span>
                                    </div>
                                    <p className="text-xs text-slate-700">מגמת ציונים בעלייה מתמשכת</p>
                                </div>
                            )}
                            {subjectAnalysis.strongest.length > 0 && subjectAnalysis.strongest[0][1].avg >= 90 && (
                                <div className="bg-white/70 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Star className="text-emerald-600" size={16} />
                                        <span className="font-bold text-emerald-700 text-sm">מצטיין במקצוע</span>
                                    </div>
                                    <p className="text-xs text-slate-700">ב-{subjectAnalysis.strongest[0][0]} עם ממוצע {subjectAnalysis.strongest[0][1].avg.toFixed(1)}</p>
                                </div>
                            )}
                            {advancedTrends.acceleration === 'accelerating' && (
                                <div className="bg-white/70 p-3 rounded-xl border border-emerald-200">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Zap className="text-emerald-600" size={16} />
                                        <span className="font-bold text-emerald-700 text-sm">האצה חיובית</span>
                                    </div>
                                    <p className="text-xs text-slate-700">קצב השיפור מואץ - מגמה מעולה!</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Recommendations */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 hover:shadow-card-hover transition-shadow md:col-span-2">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BookOpen className="text-emerald-500" size={20} />
                        המלצות למורה
                    </h3>
                    <ul className="space-y-4">
                        {/* המלצות חיוביות - לתלמידים מצטיינים */}
                        {student.averageScore >= 85 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">⭐</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">תלמיד מצטיין - מומלץ לחזק!</p>
                                    <p className="text-sm text-slate-700">
                                        התלמיד מציג ביצועים מעולים (ממוצע: {student.averageScore.toFixed(1)}). 
                                        <span className="font-medium"> מומלץ לשלוח הודעת חיזוק להורים</span>, להציע אתגרים נוספים, 
                                        ולשקול תפקידים מנהיגותיים בכיתה.
                                    </p>
                                </div>
                            </li>
                        )}
                        {comparisonAnalysis.overallDiff > 5 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">↑</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">ביצועים מעל הממוצע הכיתתי</p>
                                    <p className="text-sm text-slate-700">
                                        התלמיד מצטיין ביחס לכיתה (ב-{comparisonAnalysis.overallDiff.toFixed(1)} נקודות מהממוצע). 
                                        <span className="font-medium"> חשוב לחזק את המוטיבציה</span> עם מילים טובות, 
                                        להציע פרויקטים מאתגרים, ולשקול שיתוף ההורים בהישגים.
                                    </p>
                                </div>
                            </li>
                        )}
                        {student.positiveCount > student.negativeCount * 2 && student.positiveCount > 3 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">👍</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">התנהגות מצוינת - ראוי להכרה!</p>
                                    <p className="text-sm text-slate-700">
                                        התלמיד מציג יחס חיובי מאוד ({student.positiveCount} אירועים חיוביים). 
                                        <span className="font-medium"> מומלץ לשלוח הודעת חיזוק להורים</span>, 
                                        להכיר בפומבי בכיתה, ולשקול תפקידים אחראיים.
                                    </p>
                                </div>
                            </li>
                        )}
                        {student.gradeTrend === 'improving' && student.averageScore >= 75 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">📈</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">מגמת שיפור מתמשכת</p>
                                    <p className="text-sm text-slate-700">
                                        התלמיד מראה שיפור עקבי בציונים. 
                                        <span className="font-medium"> חשוב לשמר את המוטיבציה</span> עם משוב חיובי, 
                                        להציע אתגרים נוספים, ולשתף את ההורים במגמה החיובית.
                                    </p>
                                </div>
                            </li>
                        )}
                        {subjectAnalysis.strongest.length > 0 && subjectAnalysis.strongest[0][1].avg >= 90 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">🏆</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">מצטיין במקצוע ספציפי</p>
                                    <p className="text-sm text-slate-700">
                                        התלמיד מצטיין ב-<span className="font-bold">{subjectAnalysis.strongest[0][0]}</span> (ממוצע: {subjectAnalysis.strongest[0][1].avg.toFixed(1)}). 
                                        <span className="font-medium"> מומלץ להציע פרויקטים מתקדמים</span> במקצוע זה, 
                                        לשקול תפקיד עוזר מורה, ולשתף את ההורים בהישג.
                                    </p>
                                </div>
                            </li>
                        )}
                        {advancedTrends.acceleration === 'accelerating' && student.averageScore >= 70 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">⚡</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">האצה חיובית במגמה</p>
                                    <p className="text-sm text-slate-700">
                                        קצב השיפור מואץ - התלמיד מתקדם במהירות! 
                                        <span className="font-medium"> חשוב לחזק את המוטיבציה</span> עם משוב חיובי, 
                                        להציע אתגרים נוספים, ולשקול הודעת חיזוק להורים.
                                    </p>
                                </div>
                            </li>
                        )}
                        {advancedTrends.consistency < 8 && student.averageScore >= 80 && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">✓</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">עקביות גבוהה</p>
                                    <p className="text-sm text-slate-700">
                                        התלמיד מציג עקביות מעולה בציונים (סטיית תקן נמוכה). 
                                        <span className="font-medium"> זה מעיד על עבודה מסודרת ועקבית</span> - 
                                        מומלץ להכיר בכך ולשקול תפקידים הדורשים אחריות.
                                    </p>
                                </div>
                            </li>
                        )}
                        {student.behaviorTrend === 'improving' && (
                            <li className="flex gap-3 items-start bg-emerald-50/50 p-3 rounded-lg border-r-4 border-emerald-500">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs font-bold">✨</div>
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-emerald-800 mb-1">שיפור בהתנהגות</p>
                                    <p className="text-sm text-slate-700">
                                        זוהה שיפור משמעותי בהתנהגות. 
                                        <span className="font-medium"> חשוב לחזק את המגמה החיובית</span> עם מילים טובות 
                                        ולשקול הודעת חיזוק להורים על השיפור.
                                    </p>
                                </div>
                            </li>
                        )}
                        
                        {/* קו מפריד בין המלצות חיוביות לשליליות */}
                        {(student.averageScore >= 85 || comparisonAnalysis.overallDiff > 5 || student.positiveCount > student.negativeCount * 2) && 
                         (student.averageScore < 65 || student.negativeCount > 3 || absenceData.some(([_, count]) => count > 3)) && (
                            <li className="border-t border-slate-200 pt-4 mt-4"></li>
                        )}

                        {/* המלצות לטיפול בבעיות - רק אם יש בעיות */}
                        {/* Auto-generated Attendance Insight */}
                        {absenceData.some(([_, count]) => count > 3) && (
                             <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">
                                    שים לב: התלמיד צובר חיסורים רבים ב-
                                    <span className="font-bold"> {displaySubject(absenceData[0][0])}</span>.
                                     מומלץ לברר את הסיבה מולו.
                                </p>
                            </li>
                        )}

                        {student.averageScore < 65 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">1</div>
                                <p className="text-sm text-slate-700">התלמיד בסיכון אקדמי. מומלץ לזמן שיחה עם ההורים ולבנות תוכנית תגבור.</p>
                            </li>
                        )}
                        {student.negativeCount > 3 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">ריבוי אירועי משמעת. יש לבדוק האם הקושי נובע מחוסר עניין בחומר או בעיות אישיות.</p>
                            </li>
                        )}
                         {student.behaviorTrend === 'declining' && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">זוהתה הידרדרות משמעותית בהתנהגות לאחרונה. נדרשת בדיקת עומק.</p>
                            </li>
                        )}
                        {student.correlations.length > 0 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0 text-xs font-bold">?</div>
                                <p className="text-sm text-slate-700">נראה כי אירועי משמעת משפיעים על הציונים (או להיפך). שקול התערבות יועצת.</p>
                            </li>
                        )}
                        {subjectAnalysis.weakest.length > 0 && subjectAnalysis.weakest[0][1].avg < 60 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">
                                    חולשה משמעותית ב-<span className="font-bold">{subjectAnalysis.weakest[0][0]}</span> (ממוצע: {subjectAnalysis.weakest[0][1].avg.toFixed(1)}). 
                                    מומלץ לתגבר במקצוע זה ולבדוק את הסיבות לקושי.
                                </p>
                            </li>
                        )}
                        {temporalAnalysis.problemDays.length > 0 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">
                                    דפוס זמני: התלמיד נוטה לבעיות ביום {temporalAnalysis.problemDays[0].dayName}. 
                                    מומלץ לבדוק מה קורה ביום זה ולסייע בהכנה מראש.
                                </p>
                            </li>
                        )}
                        {behaviorAnalysis.problematicSubjects.length > 0 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">
                                    בעיות התנהגות ב-<span className="font-bold">{behaviorAnalysis.problematicSubjects[0][0]}</span>. 
                                    יש לבדוק את הקשר בין הקושי במקצוע להתנהגות.
                                </p>
                            </li>
                        )}
                        {advancedTrends.acceleration === 'decelerating' && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">מגמת הציונים מאטה - קצב השיפור יורד. חשוב לזהות את הגורם ולטפל בזמן.</p>
                            </li>
                        )}
                        {comparisonAnalysis.overallDiff < -5 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">
                                    התלמיד מתחת לממוצע הכיתתי ב-{Math.abs(comparisonAnalysis.overallDiff).toFixed(1)} נקודות. 
                                    מומלץ לבנות תוכנית תגבור מותאמת.
                                </p>
                            </li>
                        )}
                        {advancedTrends.consistency > 15 && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">חוסר עקביות בציונים (סטיית תקן גבוהה). התלמיד עשוי להזדקק לתמיכה נוספת בלמידה.</p>
                            </li>
                        )}
                    </ul>
                </div>

                {/* Correlations */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-card border border-slate-100/80 md:col-span-2 hover:shadow-card-hover transition-shadow">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertCircle className="text-primary-500" size={20} />
                        הצלבות והקשרים
                        <HelpTip text="קורלציות: ציון נמוך (מתחת ל-70) שנמצא בסמיכות של עד 4 ימים לאירועי משמעת שליליים. מראה קשר אפשרי בין התנהגות לציונים." />
                    </h3>
                    {student.correlations.length > 0 ? (
                        <ul className="space-y-3 md:space-y-4">
                            {student.correlations.map((corr, idx) => (
                                <li key={idx} className="p-4 bg-primary-50/80 rounded-xl text-sm text-slate-800 border-r-4 border-primary-500">
                                    {corr.description}
                                    <div className="text-xs text-blue-400 mt-1">{format(corr.date, 'dd/MM/yyyy')}</div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-500 text-sm">לא נמצאו קורלציות ישירות בין התנהגות לציונים.</p>
                    )}
                </div>
            </div>
        )}

        {/* Add Grade Modal */}
        {showAddGrade && (
          <AddGradeModal
            onClose={() => setShowAddGrade(false)}
            onSubmit={handleAddGrade}
          />
        )}

        {/* Add Event Modal */}
        {showAddEvent && (
          <AddEventModal
            onClose={() => setShowAddEvent(false)}
            onSubmit={handleAddEvent}
          />
        )}
      </div>
    </div>
  );
};

/* --- Add Grade Modal --- */
const AddGradeModal: React.FC<{
  onClose: () => void;
  onSubmit: (subject: string, score: number, assignment: string, date: Date, weight: number) => void;
}> = ({ onClose, onSubmit }) => {
  const [subject, setSubject] = useState('');
  const [score, setScore] = useState('');
  const [assignment, setAssignment] = useState('מטלה');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weight, setWeight] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = parseFloat(score);
    if (isNaN(s) || s < 0 || s > 100) return;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    onSubmit(subject, s, assignment, d, parseInt(weight, 10) || 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">הוסף ציון</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">מקצוע</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="מתמטיקה" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">ציון (0–100)</label>
            <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} required className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">מטלה</label>
            <input type="text" value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="מטלה" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תאריך</label>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">משקל (%)</label>
            <input type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium">ביטול</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">שמור</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* --- Add Event Modal --- */
const AddEventModal: React.FC<{
  onClose: () => void;
  onSubmit: (type: string, category: EventType, subject: string, date: Date, comment: string) => void;
}> = ({ onClose, onSubmit }) => {
  const [type, setType] = useState('');
  const [category, setCategory] = useState<EventType>(EventType.NEUTRAL);
  const [subject, setSubject] = useState('');
  const [dateStr, setDateStr] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [comment, setComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return;
    onSubmit(type || 'הערה', category, subject, d, comment);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-md p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">הוסף אירוע</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">סוג האירוע</label>
            <input type="text" value={type} onChange={(e) => setType(e.target.value)} placeholder="למשל: חיסור, מילה טובה" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">קטגוריה</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as EventType)} className="w-full px-3 py-2 rounded-xl border border-slate-200">
              <option value={EventType.POSITIVE}>חיובי</option>
              <option value={EventType.NEGATIVE}>שלילי</option>
              <option value={EventType.NEUTRAL}>ניטרלי</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">מקצוע</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="כללי" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">תאריך</label>
            <input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">הערה</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium">ביטול</button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">שמור</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentProfile;