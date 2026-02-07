import React, { useState, useMemo } from 'react';
import { Student, EventType } from '../types';
import { Users, TrendingUp, AlertTriangle, Search, ChevronRight, BarChart2, PieChart as PieChartIcon, CheckCircle } from 'lucide-react';
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
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">דשבורד כיתתי</h2>
        <div className="text-sm text-slate-500">עודכן לאחרונה: {new Date().toLocaleDateString()}</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-sm font-medium">סה"כ תלמידים</div>
            <div className="text-3xl font-bold text-slate-800">{totalStudents}</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-full text-blue-600">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-sm font-medium">ממוצע כיתתי</div>
            <div className={`text-3xl font-bold ${classAverage > 75 ? 'text-green-600' : 'text-orange-500'}`}>
              {classAverage.toFixed(1)}
            </div>
          </div>
          <div className="p-3 bg-green-50 rounded-full text-green-600">
            <BarChart2 size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-sm font-medium">אירועי משמעת</div>
            <div className="text-3xl font-bold text-red-500">{totalNegative}</div>
          </div>
          <div className="p-3 bg-red-50 rounded-full text-red-600">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-slate-400 text-sm font-medium">תלמידים בסיכון</div>
            <div className="text-3xl font-bold text-orange-600">{atRiskCount}</div>
          </div>
          <div className="p-3 bg-orange-50 rounded-full text-orange-600">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-700 mb-6">התפלגות ציונים</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  contentStyle={{ direction: 'rtl', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Class Behavior Index */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-700">מדד התנהגות כיתתי</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2
                    ${classBehaviorScore >= 80 ? 'bg-green-100 text-green-700' : classBehaviorScore >= 60 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}
                `}>
                    ציון: {classBehaviorScore}
                    {classBehaviorScore >= 80 ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
                </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
                {behaviorTypeDistribution.length > 0 ? (
                    <div className="w-full h-64 flex gap-4">
                         <ResponsiveContainer width="60%" height="100%">
                            <PieChart>
                                <Pie
                                    data={behaviorTypeDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={80}
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
                        <div className="flex-1 flex flex-col justify-center gap-2 text-sm">
                            {behaviorTypeDistribution.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                                    <span className="text-slate-600 truncate">{item.name}</span>
                                    <span className="font-bold text-slate-800 mr-auto">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-400">אין נתוני התנהגות מספיקים</div>
                )}
            </div>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-center">
          <h3 className="text-lg font-bold text-slate-700">רשימת תלמידים</h3>
          
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="חיפוש תלמיד..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="risk">סיכון (גבוה-נמוך)</option>
              <option value="average">ממוצע (גבוה-נמוך)</option>
              <option value="name">שם (א-ת)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
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