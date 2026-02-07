import React, { useState, useMemo } from 'react';
import { Student, EventType } from '../types';
import { Users, TrendingUp, AlertTriangle, Search, ChevronRight, BarChart2, PieChart as PieChartIcon, CheckCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
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
  Legend
} from 'recharts';

interface DashboardProps {
  students: Student[];
  classAverage: number;
  onSelectStudent: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ students, classAverage, onSelectStudent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'average' | 'risk'>('risk');

  // Stats
  const totalStudents = students.length;
  const atRiskCount = students.filter(s => s.riskLevel === 'high').length;
  const totalNegative = students.reduce((sum, s) => sum + s.negativeCount, 0);

  // Filter & Sort
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => s.name.includes(searchTerm) || s.id.includes(searchTerm));
    
    return result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'average') return b.averageScore - a.averageScore;
      if (sortBy === 'risk') {
         const riskScore = { high: 3, medium: 2, low: 1 };
         return riskScore[b.riskLevel] - riskScore[a.riskLevel];
      }
      return 0;
    });
  }, [students, searchTerm, sortBy]);

  // Chart Data: Grade Distribution
  const gradeDistribution = [
    { name: '0-59', count: students.filter(s => s.averageScore < 60).length },
    { name: '60-69', count: students.filter(s => s.averageScore >= 60 && s.averageScore < 70).length },
    { name: '70-79', count: students.filter(s => s.averageScore >= 70 && s.averageScore < 80).length },
    { name: '80-89', count: students.filter(s => s.averageScore >= 80 && s.averageScore < 90).length },
    { name: '90-100', count: students.filter(s => s.averageScore >= 90).length },
  ];

  // Logic: Class Behavior Stats
  const { behaviorTypeDistribution, classBehaviorScore } = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    let totalPos = 0;
    let totalNeg = 0;

    students.forEach(s => {
        s.behaviorEvents.forEach(e => {
            if (e.category !== EventType.NEUTRAL && e.type) {
                typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            }
            if (e.category === EventType.POSITIVE) totalPos++;
            if (e.category === EventType.NEGATIVE) totalNeg++;
        });
    });

    const totalEvents = totalPos + totalNeg;
    // Score 0-100. If 50% positive, score is 50. If 100% positive, score 100.
    const score = totalEvents > 0 ? Math.round((totalPos / totalEvents) * 100) : 50;

    // Top 5 behavior types
    const topTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));

    return { behaviorTypeDistribution: topTypes, classBehaviorScore: score };
  }, [students]);

  const PIE_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6'];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-fade-in pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
            <h2 className="text-2xl font-bold text-slate-800">דשבורד כיתתי</h2>
            <p className="text-slate-500 text-sm md:hidden">סקירה כללית של מצב הכיתה</p>
        </div>
        <div className="text-xs md:text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            עודכן: {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">סה"כ תלמידים</div>
            <div className="text-2xl md:text-3xl font-bold text-slate-800">{totalStudents}</div>
          </div>
          <div className="p-2 md:p-3 bg-blue-50 rounded-full text-blue-600 self-end md:self-auto">
            <Users size={20} className="md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">ממוצע כיתתי</div>
            <div className={`text-2xl md:text-3xl font-bold ${classAverage > 75 ? 'text-green-600' : 'text-orange-500'}`}>
              {classAverage.toFixed(1)}
            </div>
          </div>
          <div className="p-2 md:p-3 bg-green-50 rounded-full text-green-600 self-end md:self-auto">
            <BarChart2 size={20} className="md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">אירועי משמעת</div>
            <div className="text-2xl md:text-3xl font-bold text-red-500">{totalNegative}</div>
          </div>
          <div className="p-2 md:p-3 bg-red-50 rounded-full text-red-600 self-end md:self-auto">
            <AlertTriangle size={20} className="md:w-6 md:h-6" />
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
          <div>
            <div className="text-slate-400 text-xs md:text-sm font-medium">תלמידים בסיכון</div>
            <div className="text-2xl md:text-3xl font-bold text-orange-600">{atRiskCount}</div>
          </div>
          <div className="p-2 md:p-3 bg-orange-50 rounded-full text-orange-600 self-end md:self-auto">
            <TrendingUp size={20} className="md:w-6 md:h-6" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Grade Distribution */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-700 mb-4 md:mb-6">התפלגות ציונים</h3>
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
                <YAxis hide={true} /> {/* Hide Y Axis on mobile to save space, tooltip is enough */}
                <Tooltip 
                  contentStyle={{ direction: 'rtl', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Class Behavior Index */}
        <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-700">מדד התנהגות</h3>
                <div className={`px-2 py-1 md:px-3 rounded-full text-xs md:text-sm font-bold flex items-center gap-2
                    ${classBehaviorScore >= 80 ? 'bg-green-100 text-green-700' : classBehaviorScore >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}
                `}>
                    ציון: {classBehaviorScore}
                    {classBehaviorScore >= 80 ? <CheckCircle size={14}/> : <AlertTriangle size={14}/>}
                </div>
            </div>
            
            <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-4">
                {behaviorTypeDistribution.length > 0 ? (
                    <>
                        <div className="w-full md:w-3/5 h-48 md:h-64">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={behaviorTypeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={35}
                                        outerRadius={70}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {behaviorTypeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full md:w-2/5 flex flex-wrap md:flex-col justify-center gap-x-4 gap-y-2 text-xs md:text-sm">
                            {behaviorTypeDistribution.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 min-w-[45%]">
                                    <div className="w-2 h-2 md:w-3 md:h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                    <span className="text-slate-600 truncate max-w-[100px]">{item.name}</span>
                                    <span className="font-bold text-slate-800 mr-auto">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-slate-400">אין נתוני התנהגות מספיקים</div>
                )}
            </div>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-center">
          <h3 className="text-lg font-bold text-slate-700 w-full md:w-auto">רשימת תלמידים</h3>
          
          <div className="flex gap-2 md:gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="חיפוש..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 md:px-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="risk">סיכון</option>
              <option value="average">ממוצע</option>
              <option value="name">שם</option>
            </select>
          </div>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden p-4 space-y-3 bg-slate-50/50">
            {filteredStudents.map((student) => (
                <div 
                    key={student.id} 
                    onClick={() => onSelectStudent(student.id)}
                    className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:border-blue-400 active:bg-blue-50 transition-all"
                >
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3 items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm
                                ${student.averageScore < 60 ? 'bg-red-500' : student.averageScore < 80 ? 'bg-orange-400' : 'bg-green-500'}
                            `}>
                                {Math.round(student.averageScore)}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">{student.name}</h4>
                                <span className="text-xs text-slate-400">{student.id}</span>
                            </div>
                        </div>
                        {student.riskLevel === 'high' && <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">סיכון גבוה</span>}
                        {student.riskLevel === 'medium' && <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">סיכון בינוני</span>}
                        {student.riskLevel === 'low' && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">סיכון נמוך</span>}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2 border-t pt-3 mt-1">
                        <div className="text-center border-l border-slate-100">
                             <span className="text-[10px] text-slate-500 block mb-1">משמעת</span>
                             <div className="text-sm font-bold">
                                <span className="text-red-500">{student.negativeCount}</span>
                                <span className="text-slate-300 mx-1">/</span>
                                <span className="text-green-500">{student.positiveCount}</span>
                             </div>
                        </div>
                        <div className="text-center border-l border-slate-100">
                             <span className="text-[10px] text-slate-500 block mb-1">מגמת ציונים</span>
                             {student.gradeTrend === 'improving' && <ArrowUpRight size={16} className="text-green-500 mx-auto" />}
                             {student.gradeTrend === 'declining' && <ArrowDownRight size={16} className="text-red-500 mx-auto" />}
                             {student.gradeTrend === 'stable' && <Minus size={16} className="text-slate-400 mx-auto" />}
                        </div>
                        <div className="text-center">
                             <span className="text-[10px] text-slate-500 block mb-1">מגמת התנהגות</span>
                             {student.behaviorTrend === 'improving' && <ArrowUpRight size={16} className="text-green-500 mx-auto" />}
                             {student.behaviorTrend === 'declining' && <ArrowDownRight size={16} className="text-red-500 mx-auto" />}
                             {student.behaviorTrend === 'stable' && <Minus size={16} className="text-slate-400 mx-auto" />}
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 text-slate-500 text-sm">
              <tr>
                <th className="px-6 py-4 font-medium">שם התלמיד</th>
                <th className="px-6 py-4 font-medium">ממוצע משוקלל</th>
                <th className="px-6 py-4 font-medium">מגמת ציונים</th>
                <th className="px-6 py-4 font-medium">מגמת התנהגות</th>
                <th className="px-6 py-4 font-medium">אירועים (ש/ח)</th>
                <th className="px-6 py-4 font-medium">רמת סיכון</th>
                <th className="px-6 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr 
                    key={student.id} 
                    onClick={() => onSelectStudent(student.id)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{student.name}</div>
                    <div className="text-xs text-slate-400">{student.id}</div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">
                    <span className={student.averageScore < 70 ? 'text-red-500' : ''}>
                        {student.averageScore}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {student.gradeTrend === 'improving' && <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">📈 שיפור</span>}
                    {student.gradeTrend === 'declining' && <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">📉 ירידה</span>}
                    {student.gradeTrend === 'stable' && <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs">➖ יציב</span>}
                  </td>
                  <td className="px-6 py-4">
                    {student.behaviorTrend === 'improving' && <span className="text-green-600 bg-green-50 px-2 py-1 rounded text-xs">⭐ משתפר</span>}
                    {student.behaviorTrend === 'declining' && <span className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs">⚠️ מידרדר</span>}
                    {student.behaviorTrend === 'stable' && <span className="text-slate-500 bg-slate-100 px-2 py-1 rounded text-xs">➖ יציב</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 text-sm">
                        <span className="text-red-500 font-medium" title="שליליים">{student.negativeCount}</span> / 
                        <span className="text-green-500 font-medium" title="חיוביים">{student.positiveCount}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {student.riskLevel === 'high' && <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-full text-xs font-medium">גבוה</span>}
                    {student.riskLevel === 'medium' && <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-3 py-1 rounded-full text-xs font-medium">בינוני</span>}
                    {student.riskLevel === 'low' && <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium">נמוך</span>}
                  </td>
                  <td className="px-6 py-4 text-left">
                    <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
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

export default Dashboard;