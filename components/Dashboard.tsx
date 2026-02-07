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
} from 'recharts';

interface DashboardProps {
  students: Student[];
  classAverage: number;
  onSelectStudent: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ students, classAverage, onSelectStudent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'average' | 'risk'>('risk');

  const totalStudents = students.length;
  const atRiskCount = students.filter(s => s.riskLevel === 'high').length;
  const totalNegative = students.reduce((sum, s) => sum + s.negativeCount, 0);

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

  const gradeDistribution = [
    { name: '0-59', count: students.filter(s => s.averageScore < 60).length },
    { name: '60-69', count: students.filter(s => s.averageScore >= 60 && s.averageScore < 70).length },
    { name: '70-79', count: students.filter(s => s.averageScore >= 70 && s.averageScore < 80).length },
    { name: '80-89', count: students.filter(s => s.averageScore >= 80 && s.averageScore < 90).length },
    { name: '90-100', count: students.filter(s => s.averageScore >= 90).length },
  ];

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
    const score = totalEvents > 0 ? Math.round((totalPos / totalEvents) * 100) : 50;

    const topTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    return { behaviorTypeDistribution: topTypes, classBehaviorScore: score };
  }, [students]);

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
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24 md:pb-10">
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPICard
          label="סה״כ תלמידים"
          value={totalStudents}
          icon={Users}
          color="primary"
          gradient="from-primary-500 to-primary-600"
        />
        <KPICard
          label="ממוצע כיתתי"
          value={classAverage.toFixed(1)}
          icon={BarChart2}
          color="success"
          gradient="from-emerald-500 to-teal-500"
          highlight={classAverage > 75}
        />
        <KPICard
          label="אירועי משמעת"
          value={totalNegative}
          icon={AlertTriangle}
          color="danger"
          gradient="from-red-500 to-rose-500"
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
          <div className="h-56 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gradeDistribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} interval={0} />
                <YAxis hide />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(12, 142, 230, 0.05)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-shadow duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <PieChartIcon size={20} className="text-primary-500" />
              מדד התנהגות
            </h3>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold
              ${classBehaviorScore >= 80 ? 'bg-emerald-50 text-emerald-700' : classBehaviorScore >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
              {classBehaviorScore >= 80 ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              ציון: {classBehaviorScore}
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 min-h-[220px]">
            {behaviorTypeDistribution.length > 0 ? (
              <>
                <div className="w-full md:w-3/5 h-48 md:h-56">
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

      {/* Students List */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4 items-stretch md:items-center">
          <h3 className="text-lg font-bold text-slate-800">רשימת תלמידים</h3>
          
          <div className="flex gap-3 flex-1 md:flex-initial md:max-w-md">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="חיפוש תלמיד..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all text-sm"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-sm font-medium text-slate-700"
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
            <StudentCard key={student.id} student={student} onClick={() => onSelectStudent(student.id)} index={idx} />
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
              {filteredStudents.map((student) => (
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
                        <div className="font-semibold text-slate-800">{student.name}</div>
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
                    <RiskBadge level={student.riskLevel} />
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
}> = ({ label, value, icon: Icon, gradient, highlight }) => (
  <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 p-5 md:p-6 hover:shadow-card-hover transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-slate-500 text-xs md:text-sm font-medium mb-1">{label}</p>
        <p className={`text-2xl md:text-3xl font-bold ${highlight ? 'text-emerald-600' : 'text-slate-800'}`}>
          {value}
        </p>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg opacity-90 group-hover:opacity-100 transition-opacity`}>
        <Icon size={22} strokeWidth={2} />
      </div>
    </div>
  </div>
);

const RiskBadge: React.FC<{ level: 'high' | 'medium' | 'low' }> = ({ level }) => {
  const styles = {
    high: 'bg-red-50 text-red-700 border-red-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  };
  const labels = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-semibold border ${styles[level]}`}>
      {labels[level]}
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

const StudentCard: React.FC<{ student: Student; onClick: () => void; index: number }> = ({ student, onClick }) => (
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
          <h4 className="font-bold text-slate-800">{student.name}</h4>
          <span className="text-xs text-slate-400">{student.id}</span>
        </div>
      </div>
      <RiskBadge level={student.riskLevel} />
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
