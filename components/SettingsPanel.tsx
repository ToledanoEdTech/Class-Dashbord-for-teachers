import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  RiskSettings,
  DEFAULT_RISK_SETTINGS,
  DEFAULT_RISK_WEIGHTS,
  PeriodDefinition,
  PerClassRiskSettings,
  ClassGroup,
  Student,
  normalizeRiskSettings,
} from '../types';
import { calculateStudentStats } from '../utils/processing';
import { ArrowRight, Sliders, Copy, Calendar, Plus, Trash2, LayoutGrid, Users, Download, Check, X, RefreshCw } from 'lucide-react';
import {
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDGET_LABELS,
  type DashboardWidgetsState,
  type DashboardWidgetId,
} from '../constants/dashboardWidgets';
import {
  createStudentAccount,
  deleteStudentAccount,
  resetStudentAccountCredentials,
  getStudentAccountsForClass,
  exportStudentAccountsToExcel,
  generateTemporaryPassword,
  type StudentAccount,
} from '../utils/studentAccountManagement';
import * as XLSX from 'xlsx';

interface SettingsPanelProps {
  riskSettings: RiskSettings;
  globalRiskSettings: RiskSettings;
  perClassRiskSettings: PerClassRiskSettings;
  activeClassId: string | null;
  classes: ClassGroup[];
  students: Student[];
  onSave: (settings: RiskSettings, forCurrentClassOnly?: boolean) => void;
  onSavePeriodDefinitions: (periods: PeriodDefinition[]) => void;
  periodDefinitions: PeriodDefinition[];
  onBack: () => void;
  dashboardWidgets: DashboardWidgetsState;
  onSaveDashboardWidgets: (widgets: DashboardWidgetsState) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  riskSettings,
  globalRiskSettings,
  perClassRiskSettings,
  activeClassId,
  classes,
  students,
  onSave,
  onSavePeriodDefinitions,
  periodDefinitions,
  onBack,
  dashboardWidgets,
  onSaveDashboardWidgets,
}) => {
  const [minGradeThreshold, setMinGradeThreshold] = useState(riskSettings.minGradeThreshold);
  const [maxNegativeBehaviors, setMaxNegativeBehaviors] = useState(riskSettings.maxNegativeBehaviors);
  const [attendanceThreshold, setAttendanceThreshold] = useState(riskSettings.attendanceThreshold);
  const [riskScoreHighThreshold, setRiskScoreHighThreshold] = useState(riskSettings.riskScoreHighThreshold ?? 4);
  const [riskScoreMediumThreshold, setRiskScoreMediumThreshold] = useState(riskSettings.riskScoreMediumThreshold ?? 7);
  const [weightGrades, setWeightGrades] = useState(riskSettings.weights?.grades ?? DEFAULT_RISK_WEIGHTS.grades);
  const [weightAbsences, setWeightAbsences] = useState(riskSettings.weights?.absences ?? DEFAULT_RISK_WEIGHTS.absences);
  const [weightNegativeEvents, setWeightNegativeEvents] = useState(
    riskSettings.weights?.negativeEvents ?? DEFAULT_RISK_WEIGHTS.negativeEvents
  );
  const [penaltyPerAbsence, setPenaltyPerAbsence] = useState<number | ''>(
    riskSettings.penaltyPerAbsenceAboveThreshold ?? ''
  );
  const [useForThisClassOnly, setUseForThisClassOnly] = useState(!!(activeClassId && perClassRiskSettings[activeClassId]));
  const [periods, setPeriods] = useState<PeriodDefinition[]>(periodDefinitions);
  const [widgets, setWidgets] = useState<DashboardWidgetsState>(dashboardWidgets);
  const [activeSection, setActiveSection] = useState<'risk' | 'periods' | 'widgets' | 'students'>('risk');
  const [studentAccounts, setStudentAccounts] = useState<Map<string, StudentAccount>>(new Map());
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const [creatingAccount, setCreatingAccount] = useState<string | null>(null);
  const [newAccountCredentials, setNewAccountCredentials] = useState<Map<string, StudentAccount>>(new Map());
  const lastLoadedAccountsKeyRef = useRef<string | null>(null);
  const credentialsStorageKey = activeClassId ? `toledano-temp-student-creds-${activeClassId}` : 'toledano-temp-student-creds';

  const persistTempCredential = (studentId: string, account: StudentAccount | null) => {
    setNewAccountCredentials((prev) => {
      const next = new Map(prev);
      if (account) next.set(studentId, account);
      else next.delete(studentId);
      try {
        const asObject = Object.fromEntries(next);
        localStorage.setItem(credentialsStorageKey, JSON.stringify(asObject));
      } catch (e) {
        console.warn('Failed to persist temporary credentials locally:', e);
      }
      return next;
    });
  };

  useEffect(() => {
    setMinGradeThreshold(riskSettings.minGradeThreshold);
    setMaxNegativeBehaviors(riskSettings.maxNegativeBehaviors);
    setAttendanceThreshold(riskSettings.attendanceThreshold);
    setRiskScoreHighThreshold(riskSettings.riskScoreHighThreshold ?? 4);
    setRiskScoreMediumThreshold(riskSettings.riskScoreMediumThreshold ?? 7);
    setWeightGrades(riskSettings.weights?.grades ?? DEFAULT_RISK_WEIGHTS.grades);
    setWeightAbsences(riskSettings.weights?.absences ?? DEFAULT_RISK_WEIGHTS.absences);
    setWeightNegativeEvents(riskSettings.weights?.negativeEvents ?? DEFAULT_RISK_WEIGHTS.negativeEvents);
    setPenaltyPerAbsence(riskSettings.penaltyPerAbsenceAboveThreshold ?? '');
    setUseForThisClassOnly(!!(activeClassId && perClassRiskSettings[activeClassId]));
    setPeriods(periodDefinitions);
    setWidgets(dashboardWidgets);
  }, [riskSettings, activeClassId, perClassRiskSettings, periodDefinitions, dashboardWidgets]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(credentialsStorageKey);
      if (!raw) {
        setNewAccountCredentials(new Map());
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, StudentAccount>;
      setNewAccountCredentials(new Map(Object.entries(parsed)));
    } catch (e) {
      console.warn('Failed to load temporary credentials from local storage:', e);
      setNewAccountCredentials(new Map());
    }
  }, [credentialsStorageKey]);

  // Load student accounts when students change
  useEffect(() => {
    if (activeSection !== 'students' || students.length === 0) return;
    const sortedIds = [...students.map((s) => s.id)].sort().join('|');
    const loadKey = `${activeClassId ?? 'none'}:${sortedIds}`;
    if (lastLoadedAccountsKeyRef.current === loadKey) return;
    lastLoadedAccountsKeyRef.current = loadKey;
    loadStudentAccounts();
  }, [students, activeSection, activeClassId]);

  useEffect(() => {
    // Force refresh on class switch when accounts tab is open.
    if (activeSection === 'students') {
      lastLoadedAccountsKeyRef.current = null;
    }
  }, [activeClassId, activeSection]);

  const loadStudentAccounts = async (showLoader = true) => {
    if (showLoader) setLoadingAccounts(true);
    try {
      const accounts = await getStudentAccountsForClass(students, activeClassId ?? undefined);
      setStudentAccounts(accounts);
    } catch (error: any) {
      console.error('Error loading student accounts:', error);
      const msg = error?.message ?? String(error);
      alert('טעינת חשבונות תלמידים נכשלה: ' + msg);
    } finally {
      if (showLoader) setLoadingAccounts(false);
    }
  };

  const handleCreateAccount = async (student: Student) => {
    if (creatingAccount === student.id) return;
    setCreatingAccount(student.id);
    setBusyStudentId(student.id);
    try {
      const account = await createStudentAccount(student, undefined, undefined, {
        classId: activeClassId ?? undefined,
      });
      const newMap = new Map(studentAccounts);
      newMap.set(student.id, account);
      setStudentAccounts(newMap);
      persistTempCredential(student.id, account);
    } catch (error: any) {
      console.error('Error creating student account:', error);
      const errorMessage = error?.message || error?.code || 'שגיאה ביצירת חשבון';
      alert(`שגיאה ביצירת חשבון: ${errorMessage}`);
      // Don't logout on error - just show the error
    } finally {
      setBusyStudentId(null);
      setCreatingAccount(null);
    }
  };

  const handleDeleteAccount = async (studentId: string) => {
    const account = studentAccounts.get(studentId);
    if (!account) return;
    
    if (!confirm('האם אתה בטוח שברצונך למחוק את חשבון התלמיד?')) return;
    
    setBusyStudentId(studentId);
    try {
      await deleteStudentAccount(account.uid, {
        studentId,
        classId: activeClassId ?? undefined,
      });
      const newMap = new Map(studentAccounts);
      newMap.delete(studentId);
      setStudentAccounts(newMap);
      persistTempCredential(studentId, null);
    } catch (error: any) {
      alert(error?.message || 'שגיאה במחיקת חשבון');
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleResetPassword = async (student: Student) => {
    const account = studentAccounts.get(student.id);
    if (!account) return;
    if (!confirm('לאפס סיסמה לתלמיד זה? תיווצר סיסמה זמנית חדשה.')) return;

    setCreatingAccount(student.id);
    setBusyStudentId(student.id);
    try {
      const nextPassword = generateTemporaryPassword();
      const updated = await resetStudentAccountCredentials(student, account, {
        username: account.username,
        password: nextPassword,
        classId: activeClassId ?? undefined,
      });

      const accountsMap = new Map(studentAccounts);
      accountsMap.set(student.id, updated);
      setStudentAccounts(accountsMap);
      persistTempCredential(student.id, updated);
    } catch (error: any) {
      alert(error?.message || 'שגיאה באיפוס סיסמה');
    } finally {
      setBusyStudentId(null);
      setCreatingAccount(null);
    }
  };

  const handleResetUsername = async (student: Student) => {
    const account = studentAccounts.get(student.id);
    if (!account) return;
    const requested = prompt('הזן שם משתמש חדש:', account.username);
    if (!requested) return;

    setCreatingAccount(student.id);
    setBusyStudentId(student.id);
    try {
      const updated = await resetStudentAccountCredentials(student, account, {
        username: requested,
        password: generateTemporaryPassword(),
        classId: activeClassId ?? undefined,
      });

      const accountsMap = new Map(studentAccounts);
      accountsMap.set(student.id, updated);
      setStudentAccounts(accountsMap);
      persistTempCredential(student.id, updated);
    } catch (error: any) {
      alert(error?.message || 'שגיאה באיפוס שם משתמש');
    } finally {
      setBusyStudentId(null);
      setCreatingAccount(null);
    }
  };

  const handleCreateAllAccounts = async () => {
    if (!confirm('האם אתה בטוח שברצונך ליצור חשבונות לכל התלמידים?')) return;

    setLoadingAccounts(true);
    const newCreds = new Map(newAccountCredentials);
    const newAccounts = new Map(studentAccounts);
    const errors: string[] = [];

    try {
      for (const student of students) {
        if (!newAccounts.has(student.id)) {
          try {
            const account = await createStudentAccount(student, undefined, undefined, {
              classId: activeClassId ?? undefined,
            });
            newAccounts.set(student.id, account);
            newCreds.set(student.id, account);
          } catch (error: any) {
            const msg = error?.message ?? String(error);
            console.error(`Failed to create account for ${student.name}:`, error);
            errors.push(`${student.name} (${student.id}): ${msg}`);
          }
        }
      }
      setStudentAccounts(newAccounts);
      setNewAccountCredentials(newCreds);
      try {
        localStorage.setItem(credentialsStorageKey, JSON.stringify(Object.fromEntries(newCreds)));
      } catch (e) {
        console.warn('Failed to persist bulk credentials locally:', e);
      }
      if (errors.length > 0) {
        const created = students.filter((s) => newAccounts.has(s.id)).length;
        alert(
          `נוצרו ${created} חשבונות. ${errors.length} נכשלו:\n\n` +
            errors.slice(0, 5).join('\n') +
            (errors.length > 5 ? `\n... ועוד ${errors.length - 5}` : '')
        );
      }
    } finally {
      setLoadingAccounts(false);
    }
  };

  const handleExportPasswords = () => {
    const accountsArray = Array.from(studentAccounts.values());
    const exportData = exportStudentAccountsToExcel(accountsArray);
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'חשבונות תלמידים');
    XLSX.writeFile(wb, `student-accounts-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const draftSettings: RiskSettings = useMemo(
    () =>
      normalizeRiskSettings({
        minGradeThreshold,
        maxNegativeBehaviors,
        attendanceThreshold,
        riskScoreHighThreshold,
        riskScoreMediumThreshold,
        weights: { grades: weightGrades, absences: weightAbsences, negativeEvents: weightNegativeEvents },
        penaltyPerAbsenceAboveThreshold:
          penaltyPerAbsence === '' ? undefined : Math.max(0, Math.min(2, Number(penaltyPerAbsence))),
      }),
    [
      minGradeThreshold,
      maxNegativeBehaviors,
      attendanceThreshold,
      riskScoreHighThreshold,
      riskScoreMediumThreshold,
      weightGrades,
      weightAbsences,
      weightNegativeEvents,
      penaltyPerAbsence,
    ]
  );

  const previewCounts = useMemo(() => {
    let high = 0,
      medium = 0,
      low = 0;
    students.forEach((s) => {
      const computed = calculateStudentStats(s, draftSettings);
      if (computed.riskLevel === 'high') high++;
      else if (computed.riskLevel === 'medium') medium++;
      else low++;
    });
    return { high, medium, low };
  }, [students, draftSettings]);

  const otherClassesWithSettings = useMemo(
    () => classes.filter((c) => c.id !== activeClassId && perClassRiskSettings[c.id]),
    [classes, activeClassId, perClassRiskSettings]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draftSettings, useForThisClassOnly);
  };

  const handleReset = () => {
    setMinGradeThreshold(DEFAULT_RISK_SETTINGS.minGradeThreshold);
    setMaxNegativeBehaviors(DEFAULT_RISK_SETTINGS.maxNegativeBehaviors);
    setAttendanceThreshold(DEFAULT_RISK_SETTINGS.attendanceThreshold);
    setRiskScoreHighThreshold(DEFAULT_RISK_SETTINGS.riskScoreHighThreshold);
    setRiskScoreMediumThreshold(DEFAULT_RISK_SETTINGS.riskScoreMediumThreshold);
    setWeightGrades(DEFAULT_RISK_WEIGHTS.grades);
    setWeightAbsences(DEFAULT_RISK_WEIGHTS.absences);
    setWeightNegativeEvents(DEFAULT_RISK_WEIGHTS.negativeEvents);
    setPenaltyPerAbsence('');
  };

  const handleCopyFromClass = (classId: string) => {
    const src = perClassRiskSettings[classId];
    if (!src) return;
    setMinGradeThreshold(src.minGradeThreshold);
    setMaxNegativeBehaviors(src.maxNegativeBehaviors);
    setAttendanceThreshold(src.attendanceThreshold);
    setRiskScoreHighThreshold(src.riskScoreHighThreshold ?? 4);
    setRiskScoreMediumThreshold(src.riskScoreMediumThreshold ?? 7);
    setWeightGrades(src.weights?.grades ?? 3);
    setWeightAbsences(src.weights?.absences ?? 3);
    setWeightNegativeEvents(src.weights?.negativeEvents ?? 3);
    setPenaltyPerAbsence(src.penaltyPerAbsenceAboveThreshold ?? '');
    setUseForThisClassOnly(true);
  };

  const addPeriod = () => {
    const id = `period-${Date.now()}`;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPeriods((p) => [...p, { id, name: `תקופה ${p.length + 1}`, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }]);
  };

  const updatePeriod = (id: string, patch: Partial<PeriodDefinition>) => {
    setPeriods((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const removePeriod = (id: string) => {
    setPeriods((p) => p.filter((x) => x.id !== id));
  };

  const savePeriods = () => {
    onSavePeriodDefinitions(periods);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 pb-safe animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-primary-600 transition-colors mb-6 text-sm font-medium"
      >
        <ArrowRight size={18} strokeWidth={2} />
        חזרה
      </button>

      <div className="flex gap-2 mb-4 p-1 rounded-xl bg-slate-100 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveSection('risk')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === 'risk' ? 'bg-white text-primary-700 shadow' : 'text-slate-600 hover:text-slate-800'}`}
        >
          <Sliders size={16} className="inline-block ml-1.5 align-middle" />
          הגדרות סיכון
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('periods')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === 'periods' ? 'bg-white text-primary-700 shadow' : 'text-slate-600 hover:text-slate-800'}`}
        >
          <Calendar size={16} className="inline-block ml-1.5 align-middle" />
          תקופות
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('widgets')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === 'widgets' ? 'bg-white text-primary-700 shadow' : 'text-slate-600 hover:text-slate-800'}`}
        >
          <LayoutGrid size={16} className="inline-block ml-1.5 align-middle" />
          רכיבי דשבורד
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveSection('students');
            loadStudentAccounts();
          }}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === 'students' ? 'bg-white text-primary-700 shadow' : 'text-slate-600 hover:text-slate-800'}`}
        >
          <Users size={16} className="inline-block ml-1.5 align-middle" />
          ניהול חשבונות תלמידים
        </button>
      </div>

      {activeSection === 'risk' && (
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-primary-50/50 to-white">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Sliders size={22} className="text-primary-500" />
              הגדרות סיכון
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              הגדר מתי תלמיד ייחשב &quot;בסיכון&quot; ולפי אילו משקלים. שינוי נשמר גלובלית או לכיתה הנבחרת בלבד.
            </p>
          </div>

          {activeClassId && classes.length > 1 && (
            <div className="px-5 pt-4 space-y-3 border-b border-slate-100 pb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useForThisClassOnly}
                  onChange={(e) => setUseForThisClassOnly(e.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-slate-700">הגדרות סיכון לכיתה זו בלבד</span>
              </label>
              {otherClassesWithSettings.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500">העתק מכיתה:</span>
                  {otherClassesWithSettings.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCopyFromClass(c.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-primary-50 hover:text-primary-700 text-sm font-medium transition-colors"
                    >
                      <Copy size={14} />
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
            {students.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-sm font-bold text-slate-700 mb-2">תצוגה מקדימה עם ההגדרות הנוכחיות</p>
                <p className="text-slate-600 text-sm">
                  כרגע <strong className="text-red-600">{previewCounts.high}</strong> תלמידים ייחשבו בסיכון גבוה,{' '}
                  <strong className="text-amber-600">{previewCounts.medium}</strong> בינוני,{' '}
                  <strong className="text-emerald-600">{previewCounts.low}</strong> נמוך.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="minGrade" className="block text-sm font-bold text-slate-700 mb-2">
                ציון מינימלי (מתחתיו נכשל)
              </label>
              <input
                id="minGrade"
                type="number"
                min={0}
                max={100}
                value={minGradeThreshold}
                onChange={(e) => setMinGradeThreshold(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">תלמיד עם ממוצע מתחת לסף זה מקבל ניקוד סיכון גבוה יותר.</p>
            </div>

            <div>
              <label htmlFor="maxNegative" className="block text-sm font-bold text-slate-700 mb-2">
                מספר אירועים שליליים (מעליו נחשב בסיכון)
              </label>
              <input
                id="maxNegative"
                type="number"
                min={0}
                max={100}
                value={maxNegativeBehaviors}
                onChange={(e) => setMaxNegativeBehaviors(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">מעל כמות זו התלמיד מקבל ניקוד סיכון גבוה יותר.</p>
            </div>

            <div>
              <label htmlFor="attendance" className="block text-sm font-bold text-slate-700 mb-2">
                סף חיסורים (מעליו נחשב בסיכון)
              </label>
              <input
                id="attendance"
                type="number"
                min={0}
                max={100}
                value={attendanceThreshold}
                onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">תלמיד עם {attendanceThreshold} חיסורים או יותר ייחשב בסיכון.</p>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">ספי רמות סיכון (ציון 1–10)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="riskHigh" className="block text-xs font-medium text-slate-600 mb-1">
                    מתחת או שווה ל = סיכון גבוה
                  </label>
                  <input
                    id="riskHigh"
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={riskScoreHighThreshold}
                    onChange={(e) => setRiskScoreHighThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="riskMed" className="block text-xs font-medium text-slate-600 mb-1">
                    מתחת או שווה ל = סיכון בינוני
                  </label>
                  <input
                    id="riskMed"
                    type="number"
                    min={1}
                    max={10}
                    step={0.5}
                    value={riskScoreMediumThreshold}
                    onChange={(e) => setRiskScoreMediumThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3">משקלים באלגוריתם (1–5)</h3>
              <p className="text-xs text-slate-500 mb-3">ככל שהמשקל גבוה יותר, ההשפעה של הגורם על ציון הסיכון גדולה יותר.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">משקל ציונים</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={weightGrades}
                    onChange={(e) => setWeightGrades(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
                  />
                  <span className="text-sm font-medium text-slate-700">{weightGrades}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">משקל חיסורים</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={weightAbsences}
                    onChange={(e) => setWeightAbsences(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
                  />
                  <span className="text-sm font-medium text-slate-700">{weightAbsences}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">משקל אירועים שליליים</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={weightNegativeEvents}
                    onChange={(e) => setWeightNegativeEvents(Number(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none bg-slate-200 accent-primary-600"
                  />
                  <span className="text-sm font-medium text-slate-700">{weightNegativeEvents}</span>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="penaltyAbsence" className="block text-sm font-bold text-slate-700 mb-2">
                הורדה לכל חיסור מעל הסף (אופציונלי)
              </label>
              <input
                id="penaltyAbsence"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={penaltyPerAbsence}
                onChange={(e) => setPenaltyPerAbsence(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="לא מוגדר"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 text-slate-800"
              />
              <p className="text-xs text-slate-500 mt-1">כמה להוריד מציון הסיכון עבור כל חיסור מעל סף החיסורים. ריק = שימוש במשקל בלבד.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl font-bold bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 transition-all"
              >
                שמור הגדרות
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="py-3 px-6 rounded-xl font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                אפס לברירת מחדל
              </button>
            </div>
          </form>
        </div>
      )}

      {activeSection === 'periods' && (
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-primary-50/50 to-white">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={22} className="text-primary-500" />
              תקופות להשוואה
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              הגדר תקופות (למשל סמסטר א׳, ב׳). בדשבורד יוצגו נתונים והשוואה לפי תקופות.
            </p>
          </div>
          <div className="p-5 md:p-6 space-y-4">
            {periods.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50"
              >
                <input
                  type="text"
                  value={p.name}
                  onChange={(e) => updatePeriod(p.id, { name: e.target.value })}
                  placeholder="שם התקופה"
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                />
                <input
                  type="date"
                  value={p.startDate}
                  onChange={(e) => updatePeriod(p.id, { startDate: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                />
                <span className="text-slate-400">עד</span>
                <input
                  type="date"
                  value={p.endDate}
                  onChange={(e) => updatePeriod(p.id, { endDate: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => removePeriod(p.id)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  aria-label="מחק תקופה"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPeriod}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-primary-300 text-primary-600 hover:bg-primary-50 font-medium transition-colors"
            >
              <Plus size={18} />
              הוסף תקופה
            </button>
            <button
              type="button"
              onClick={savePeriods}
              className="w-full py-3 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >
              שמור תקופות
            </button>
          </div>
        </div>
      )}

      {activeSection === 'widgets' && (
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-primary-50/50 to-white">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <LayoutGrid size={22} className="text-primary-500" />
              רכיבי דשבורד
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              בחר אילו רכיבים להציג בדשבורד. ניתן להסתיר רכיבים כדי לפשט את המסך ולהחזיר אותם בכל עת.
            </p>
          </div>
          <div className="p-5 md:p-6 space-y-3">
            {DASHBOARD_WIDGET_IDS.map((id: DashboardWidgetId) => (
              <label
                key={id}
                className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={widgets[id]}
                  onChange={(e) => setWidgets((prev) => ({ ...prev, [id]: e.target.checked }))}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-5 h-5"
                />
                <span className="text-sm font-medium text-slate-800 flex-1">{DASHBOARD_WIDGET_LABELS[id]}</span>
                <span className="text-xs text-slate-500">{widgets[id] ? 'מוצג' : 'מוסתר'}</span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                onSaveDashboardWidgets(widgets);
              }}
              className="w-full py-3 rounded-xl font-bold bg-primary-600 text-white hover:bg-primary-700 transition-colors mt-4"
            >
              שמור רכיבי דשבורד
            </button>
          </div>
        </div>
      )}

      {activeSection === 'students' && (
        <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-primary-50/50 to-white">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users size={22} className="text-primary-500" />
              ניהול חשבונות תלמידים
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              צור חשבונות התחברות לתלמידים כדי שיוכלו לראות את הפרופיל שלהם בלבד.
            </p>
          </div>
          <div className="p-5 md:p-6 space-y-4">
            {students.length === 0 ? (
              <p className="text-slate-500 text-center py-8">אין תלמידים בכיתה זו</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    type="button"
                    onClick={handleCreateAllAccounts}
                    disabled={loadingAccounts}
                    className="px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    צור חשבונות לכל התלמידים
                  </button>
                  <button
                    type="button"
                    onClick={() => loadStudentAccounts(true)}
                    disabled={loadingAccounts}
                    className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    title="טען מחדש חשבונות וסיסמאות מהענן"
                  >
                    <RefreshCw size={18} />
                    רענן רשימה
                  </button>
                  {studentAccounts.size > 0 && (
                    <button
                      type="button"
                      onClick={handleExportPasswords}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors flex items-center gap-2"
                    >
                      <Download size={18} />
                      ייצא רשימת סיסמאות
                    </button>
                  )}
                </div>
                <div className="md:hidden space-y-3">
                  {students.map((student) => {
                    const account = studentAccounts.get(student.id);
                    const newCreds = newAccountCredentials.get(student.id);
                    const hasAccount = !!account;
                    const isBusy = creatingAccount === student.id || busyStudentId === student.id;

                    return (
                      <div key={student.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50/40">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{student.name}</p>
                            <p className="text-xs text-slate-500">{student.id}</p>
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${hasAccount ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                            {hasAccount ? 'יש חשבון' : 'אין חשבון'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                          <div>
                            <p className="text-slate-500 mb-1">שם משתמש</p>
                            <code className="bg-white border border-slate-200 px-2 py-1 rounded block truncate">
                              {(newCreds?.username || account?.username || '-')}
                            </code>
                          </div>
                          <div>
                            <p className="text-slate-500 mb-1">סיסמה זמנית</p>
                            <code className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-1 rounded block truncate">
                              {(newCreds?.password || account?.password || '(לא זמין – אפס סיסמה לשמירת סיסמה חדשה)')}
                            </code>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!hasAccount ? (
                            <button
                              type="button"
                              onClick={() => handleCreateAccount(student)}
                              disabled={isBusy}
                              className="px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {isBusy ? 'יוצר...' : 'צור חשבון'}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleResetPassword(student)}
                                disabled={isBusy}
                                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                אפס סיסמה
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetUsername(student)}
                                disabled={isBusy}
                                className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                אפס שם משתמש
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(student.id)}
                                disabled={isBusy}
                                className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                מחק חשבון
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">שם תלמיד</th>
                        <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">ת.ז</th>
                        <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">שם משתמש</th>
                        <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">סיסמה זמנית</th>
                        <th className="text-right py-3 px-4 text-sm font-bold text-slate-700">יש חשבון</th>
                        <th className="text-right py-3 px-4 text-sm font-bold text-slate-700 sticky left-0 bg-white z-10">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((student) => {
                        const account = studentAccounts.get(student.id);
                        const newCreds = newAccountCredentials.get(student.id);
                        const hasAccount = !!account;
                        const isBusy = creatingAccount === student.id || busyStudentId === student.id;
                        
                        return (
                          <tr key={student.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-800">{student.name}</td>
                            <td className="py-3 px-4 text-sm text-slate-600">{student.id}</td>
                            <td className="py-3 px-4 text-sm">
                              {newCreds ? (
                                <div className="flex items-center gap-2">
                                  <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{newCreds.username}</code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(newCreds.username);
                                    }}
                                    className="p-1 rounded hover:bg-slate-200"
                                    title="העתק"
                                  >
                                    <Copy size={14} className="text-slate-500" />
                                  </button>
                                </div>
                              ) : account ? (
                                <code className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">{account.username}</code>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {newCreds ? (
                                <div className="flex items-center gap-2">
                                  <code className="bg-amber-50 px-2 py-1 rounded text-xs font-mono text-amber-700 border border-amber-200">{newCreds.password}</code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(newCreds.password);
                                    }}
                                    className="p-1 rounded hover:bg-slate-200"
                                    title="העתק"
                                  >
                                    <Copy size={14} className="text-slate-500" />
                                  </button>
                                </div>
                              ) : account?.password ? (
                                <div className="flex items-center gap-2">
                                  <code className="bg-amber-50 px-2 py-1 rounded text-xs font-mono text-amber-700 border border-amber-200">{account.password}</code>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(account.password);
                                    }}
                                    className="p-1 rounded hover:bg-slate-200"
                                    title="העתק"
                                  >
                                    <Copy size={14} className="text-slate-500" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400" title="אפס סיסמה כדי ליצור סיסמה חדשה שנשמרת">(לא זמין – אפס סיסמה)</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm">
                              {hasAccount ? (
                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                  <Check size={16} />
                                  כן
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400">
                                  <X size={16} />
                                  לא
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-sm sticky left-0 bg-white">
                              <div className="flex items-center gap-2">
                                {!hasAccount ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCreateAccount(student)}
                                    disabled={isBusy}
                                    className="px-3 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                  >
                                    {isBusy ? 'יוצר...' : 'צור חשבון'}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleResetPassword(student)}
                                      disabled={isBusy}
                                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                      אפס סיסמה
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleResetUsername(student)}
                                      disabled={isBusy}
                                      className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                      אפס שם משתמש
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAccount(student.id)}
                                      disabled={isBusy}
                                      className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                      מחק חשבון
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
