import React, { useState, useMemo, useEffect } from 'react';
import { Student, EventType } from '../types';
import { ArrowRight, Calendar, AlertCircle, AlertTriangle, Award, BookOpen, Clock, Info, Download, UserX } from 'lucide-react';
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

interface StudentProfileProps {
  student: Student;
  onBack: () => void;
  classAverage: number;
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
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg text-right text-sm z-50 min-w-[150px]">
                <p className="font-bold text-slate-700 border-b pb-1 mb-2">{label}</p>
                
                <div className="space-y-2">
                    {positives.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-green-600 mb-1">חיזוקים:</p>
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
                            <p className="text-xs font-bold text-red-600 mb-1">טעון שיפור:</p>
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
                    
                    <div className="mt-2 pt-2 border-t text-xs font-bold flex justify-between">
                        <span>ציון מאזן:</span>
                        <span dir="ltr" className={data.score >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {data.score > 0 ? '+' : ''}{data.score}
                        </span>
                    </div>
                </div>
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
            <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg text-right text-sm z-50 min-w-[200px]">
                <p className="font-bold text-slate-700 border-b pb-1 mb-2">{label}</p>
                <div className="mb-2 flex justify-between text-slate-800 font-bold text-xs">
                    <span>ממוצע שבועי:</span>
                    <span>{data.score.toFixed(1)}</span>
                </div>
                
                <div className="space-y-1 max-h-40 overflow-y-auto">
                    {grades.map((g: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 p-1 rounded">
                             <div className="flex flex-col">
                                <span className="font-medium text-slate-700">{g.subject}</span>
                                <span className="text-[10px] text-slate-400">{g.assignment}</span>
                             </div>
                             <span className={`font-bold ${g.score < 70 ? 'text-red-500' : 'text-slate-600'}`}>{g.score}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

const StudentProfile: React.FC<StudentProfileProps> = ({ student, onBack, classAverage }) => {
  const [activeTab, setActiveTab] = useState<'trends' | 'grades' | 'behavior' | 'insights'>('trends');

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
    XLSX.writeFile(wb, `דוח_תלמיד_${student.name}.xlsx`);
  };

  // Chart Data: Grades - Aggregated by Week
  const gradeChartData = useMemo(() => {
    if (student.grades.length === 0) return [];

    const grades = student.grades;
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
  }, [student.grades]);

  // Chart Data: Behavior Trends
  const { chartData: behaviorChartData, viewMode } = useMemo(() => {
    const events = student.behaviorEvents;
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
  }, [student.behaviorEvents]);

  // Absence Analysis
  const absenceData = useMemo(() => {
    const counts: Record<string, number> = {};
    student.behaviorEvents.forEach(e => {
        // Look for typical Hebrew keywords for absence
        const type = e.type || '';
        if (type.includes('חיסור') || type.includes('הברזה') || type.includes('אי הגעה') || type.includes('נעדר')) {
            const subj = e.subject || 'כללי';
            counts[subj] = (counts[subj] || 0) + 1;
        }
    });
    
    // Sort by count descending and return array
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .filter(([_, count]) => count > 0);
  }, [student.behaviorEvents]);

  return (
    <div className="pb-20 animate-fade-in bg-slate-50 min-h-screen">
      
      {/* Sticky Header Wrapper */}
      <div className="sticky top-16 z-40 bg-slate-50/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-4"
            >
                <ArrowRight size={20} />
                חזרה לדשבורד
            </button>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md
                        ${student.averageScore < 60 ? 'bg-red-500' : student.averageScore < 80 ? 'bg-orange-400' : 'bg-green-500'}
                    `}>
                        {Math.round(student.averageScore)}
                    </div>
                    <div>
                    <h1 className="text-2xl font-bold text-slate-800">{student.name}</h1>
                    <div className="text-slate-500 text-sm flex gap-3">
                        <span>ת.ז: {student.id}</span>
                        <span className="text-slate-300">|</span>
                        <span>{student.grades.length} ציונים</span>
                        <span className="text-slate-300">|</span>
                        <span>{student.behaviorEvents.length} אירועי התנהגות</span>
                    </div>
                    </div>
                </div>
                
                <div className="flex gap-2 items-center">
                    <div className="flex flex-col items-end mr-2">
                        {student.riskLevel === 'high' && (
                            <span className="text-red-700 font-bold text-sm bg-red-50 px-2 py-0.5 rounded border border-red-100">סיכון גבוה</span>
                        )}
                        {student.riskLevel === 'medium' && (
                            <span className="text-orange-700 font-bold text-sm bg-orange-50 px-2 py-0.5 rounded border border-orange-100">סיכון בינוני</span>
                        )}
                        {student.riskLevel === 'low' && (
                            <span className="text-green-700 font-bold text-sm bg-green-50 px-2 py-0.5 rounded border border-green-100">סיכון נמוך</span>
                        )}
                        <span className="text-[10px] text-slate-400 mt-0.5">ציון סיכון: {student.riskScore}/10</span>
                    </div>
                    
                    <button 
                        onClick={handleExport} 
                        className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 font-medium text-sm flex items-center gap-2"
                    >
                        <Download size={16} />
                        ייצוא לאקסל
                    </button>
                </div>
            </div>

            {/* Tabs inside Sticky Header */}
            <div className="flex gap-1 overflow-x-auto mt-6">
                {[
                { id: 'trends', label: 'מגמות וניתוח' },
                { id: 'grades', label: 'גיליון ציונים' },
                { id: 'behavior', label: 'יומן התנהגות' },
                { id: 'insights', label: 'תובנות והמלצות' },
                ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap text-sm
                    ${activeTab === tab.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}
                >
                    {tab.label}
                </button>
                ))}
            </div>
          </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-6 min-h-[500px]">
        {activeTab === 'trends' && (
          <div className="grid grid-cols-1 gap-6">
            {/* Grades Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-700">מגמת ציונים (ממוצע שבועי)</h3>
                    <div className="flex gap-4 text-xs">
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
                <div className="h-72 w-full">
                {gradeChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={gradeChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            tickMargin={10}
                        />
                        <YAxis domain={[0, 100]} />
                        <Tooltip content={<CustomGradeTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
                        <ReferenceLine y={55} label={{ value: "55", position: 'right', fill: 'red', fontSize: 10 }} stroke="red" strokeDasharray="3 3" />
                        <ReferenceLine y={classAverage} label={{ value: "כיתתי", position: 'right', fill: 'orange', fontSize: 10 }} stroke="orange" strokeDasharray="5 5" />
                        <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 4 }} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                     <div className="h-full flex items-center justify-center text-slate-400">אין מספיק נתוני ציונים להצגה</div>
                )}
                </div>
            </div>

            {/* Behavior Chart */}
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-700">מאזן התנהגות</h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {viewMode === 'daily' ? 'תצוגה יומית' : 'תצוגה שבועית'}
                    </span>
                </div>
                <div className="h-80 w-full">
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
                                minTickGap={10}
                            />
                            <YAxis allowDecimals={false} />
                            <Tooltip content={<CustomBehaviorTooltip />} cursor={{fill: 'transparent'}} />
                            <ReferenceLine y={0} stroke="#cbd5e1" />
                            <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                                {behaviorChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.score >= 0 ? '#22c55e' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">אין מספיק נתונים להצגת גרף התנהגות</div>
                )}
               
                </div>
            </div>
          </div>
        )}

        {activeTab === 'grades' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-500 text-sm">
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
                                    <span className={`font-bold px-2 py-1 rounded
                                        ${grade.score < 60 ? 'bg-red-100 text-red-700' : 
                                          grade.score < 80 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}
                                    `}>
                                        {grade.score}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}

        {activeTab === 'behavior' && (
             <div className="space-y-4">
                 {student.behaviorEvents.length === 0 ? (
                     <div className="text-center py-10 text-slate-400 bg-white rounded-2xl">אין אירועי התנהגות רשומים.</div>
                 ) : (
                    student.behaviorEvents.map((event, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-100 flex items-start gap-4">
                            <div className={`mt-1 p-2 rounded-full shrink-0 
                                ${event.category === EventType.POSITIVE ? 'bg-green-100 text-green-600' : 
                                  event.category === EventType.NEGATIVE ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                {event.category === EventType.POSITIVE && <Award size={20} />}
                                {event.category === EventType.NEGATIVE && <AlertTriangle size={20} />}
                                {event.category === EventType.NEUTRAL && <Info size={20} />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-slate-800">{event.type}</h4>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Calendar size={12} />
                                        {format(event.date, 'dd/MM/yyyy')}
                                    </span>
                                </div>
                                <p className="text-slate-600 text-sm mt-1">
                                    <span className="font-medium text-slate-800">{event.subject}</span> • המורה {event.teacher}
                                </p>
                                {event.comment && (
                                    <div className="mt-2 bg-slate-50 p-2 rounded text-sm text-slate-600 italic">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Absence Analysis Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserX className="text-red-500" />
                        מוקדי חיסורים
                    </h3>
                    {absenceData.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600 mb-2">פירוט מקצועות בהם נרשמו חיסורים:</p>
                            {absenceData.map(([subject, count], idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                                    <span className="font-medium text-slate-700">{subject}</span>
                                    <span className={`text-sm font-bold px-2 py-0.5 rounded
                                        ${count > 3 ? 'bg-red-100 text-red-700' : 'bg-orange-50 text-orange-700'}
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

                {/* Recommendations */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <BookOpen className="text-green-500" />
                        המלצות למורה
                    </h3>
                    <ul className="space-y-4">
                        {/* Auto-generated Attendance Insight */}
                        {absenceData.some(([_, count]) => count > 3) && (
                             <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs font-bold">!</div>
                                <p className="text-sm text-slate-700">
                                    שים לב: התלמיד צובר חיסורים רבים ב-
                                    <span className="font-bold"> {absenceData[0][0]}</span>.
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
                        {student.gradeTrend === 'improving' && (
                            <li className="flex gap-3 items-start">
                                <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 text-xs font-bold">✓</div>
                                <p className="text-sm text-slate-700">מגמת ציונים בעלייה! חשוב לשמר את המוטיבציה עם מילה טובה.</p>
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
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs font-bold">?</div>
                                <p className="text-sm text-slate-700">נראה כי אירועי משמעת משפיעים על הציונים (או להיפך). שקול התערבות יועצת.</p>
                            </li>
                        )}
                    </ul>
                </div>

                {/* Correlations (Moved to be the 3rd card in grid, full width on mobile or just flow) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <AlertCircle className="text-blue-500" />
                        הצלבות והקשרים
                    </h3>
                    {student.correlations.length > 0 ? (
                        <ul className="space-y-4">
                            {student.correlations.map((corr, idx) => (
                                <li key={idx} className="p-3 bg-blue-50 rounded-lg text-sm text-blue-900 border-r-4 border-blue-500">
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
      </div>
    </div>
  );
};

export default StudentProfile;