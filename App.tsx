import React, { useState, useEffect, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import FileUpload from './components/FileUpload';
import LoginSignup from './components/LoginSignup';
import StudentLogin from './components/StudentLogin';
import StudentDashboard from './components/StudentDashboard';
import FirebaseConfigDialog from './components/FirebaseConfigDialog';
import Dashboard from './components/Dashboard';
import StudentProfile from './components/StudentProfile';
import SettingsPanel from './components/SettingsPanel';
import TeachersAnalytics from './components/TeachersAnalytics';
import SubjectMatrix from './components/SubjectMatrix';
import { Student, AppState, ClassGroup, RiskSettings, PerClassRiskSettings, PeriodDefinition, DEFAULT_RISK_SETTINGS } from './types';
import { processFiles } from './utils/processing';
import { calculateStudentStats } from './utils/processing';
import { loadFromStorage, savePreferences, loadPreferences, loadDashboardWidgets } from './utils/storage';
import { deleteClassFromFirestore } from './utils/firestoreSync';
import { useAuth } from './context/AuthContext';
import { useCloudSync, type CloudSyncPayload } from './hooks/useCloudSync';
import { useSidebar } from './hooks/useSidebar';
import { Menu, X, LogIn, LogOut } from 'lucide-react';
import { NavIcons, FileIcons } from './constants/icons';

const LOGO_PATH = '/logo.png';

const Logo: React.FC<{ fallback: React.ReactNode }> = ({ fallback }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    <img
      src={LOGO_PATH}
      alt="לוגו ToledanoEdTech"
      className="w-full h-full object-contain p-1"
      onError={() => setFailed(true)}
    />
  );
};

const BRAND_NAME = 'ToledanoEdTech';
const BRAND_TAGLINE = 'מערכת מעקב פדגוגית';

const getEmptyDataState = () => ({
  classes: [] as ClassGroup[],
  activeClassId: null as string | null,
  riskSettings: DEFAULT_RISK_SETTINGS,
  perClassRiskSettings: {} as PerClassRiskSettings,
  periodDefinitions: [] as PeriodDefinition[],
});

const getInitialState = (): AppState => {
  const loaded = loadFromStorage(null);
  return {
    view: 'landing',
    selectedStudentId: null,
    classes: loaded.classes,
    activeClassId: loaded.activeClassId,
    isAnonymous: false,
    riskSettings: loaded.riskSettings,
    perClassRiskSettings: loaded.perClassRiskSettings ?? {},
    periodDefinitions: loaded.periodDefinitions ?? [],
    loading: false,
  };
};

function getEffectiveRiskSettings(
  activeClassId: string | null,
  globalSettings: RiskSettings,
  perClass: PerClassRiskSettings
): RiskSettings {
  if (!activeClassId || !perClass[activeClassId]) return globalSettings;
  return perClass[activeClassId];
}

const App: React.FC = () => {
  const { user, userRole, loading: authLoading, signOut } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showStudentLogin, setShowStudentLogin] = useState(false);
  const [showFirebaseConfig, setShowFirebaseConfig] = useState(false);
  const [state, setState] = useState<AppState>(getInitialState);
  const { sidebarOpen, closeSidebar, openSidebar } = useSidebar();
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteConfirmClassId, setDeleteConfirmClassId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => loadPreferences().darkMode);
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => loadPreferences().fontSize);
  const [dashboardWidgets, setDashboardWidgets] = useState(() => loadDashboardWidgets());

  // Handle student routing - redirect students to student dashboard
  useEffect(() => {
    if (!authLoading && user && userRole === 'student') {
      // Student is logged in - ensure they're on student dashboard
      // This will be handled by rendering StudentDashboard component
    } else if (!authLoading && user && userRole === 'teacher') {
      // Teacher is logged in - ensure they're not on student routes
      if (showStudentLogin) {
        setShowStudentLogin(false);
      }
    }
  }, [user, userRole, authLoading, showStudentLogin]);

  const cloudSyncPayload: CloudSyncPayload = {
    classes: state.classes,
    activeClassId: state.activeClassId,
    riskSettings: state.riskSettings,
    perClassRiskSettings: state.perClassRiskSettings,
    periodDefinitions: state.periodDefinitions,
  };
  const setCloudSyncPayload = useCallback((update: React.SetStateAction<CloudSyncPayload>) => {
    setState((prev) => {
      const prevPayload: CloudSyncPayload = {
        classes: prev.classes,
        activeClassId: prev.activeClassId,
        riskSettings: prev.riskSettings,
        perClassRiskSettings: prev.perClassRiskSettings,
        periodDefinitions: prev.periodDefinitions,
      };
      const nextPayload = typeof update === 'function' ? update(prevPayload) : update;
      return { ...prev, ...nextPayload };
    });
  }, []);
  const { cloudLoaded, cloudLoadPending, cloudSyncError, setCloudSyncError, markClassAdded, flushSave } = useCloudSync({
    userId: user?.uid,
    payload: cloudSyncPayload,
    preferences: { darkMode, fontSize, dashboardWidgets },
    setPayload: setCloudSyncPayload,
    setPreferences: (p) => {
      if (p.darkMode !== undefined) setDarkMode(p.darkMode);
      if (p.fontSize !== undefined) setFontSize(p.fontSize);
      if (p.dashboardWidgets !== undefined) setDashboardWidgets(p.dashboardWidgets);
    },
    getEmptyPayload: getEmptyDataState,
  });

  const activeClass = state.classes.find((c) => c.id === state.activeClassId);
  const effectiveRiskSettings = getEffectiveRiskSettings(state.activeClassId, state.riskSettings, state.perClassRiskSettings);
  const students = activeClass?.students ?? [];
  const classAverage =
    students.length > 0
      ? students.reduce((sum, s) => sum + s.averageScore, 0) / students.length
      : 0;
  const selectedStudent = students.find((s) => s.id === state.selectedStudentId);
  const selectedStudentIndex = state.selectedStudentId ? students.findIndex((s) => s.id === state.selectedStudentId) : -1;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    savePreferences({ darkMode, fontSize, dashboardViewMode: 'table' });
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.classList.remove('font-scale-sm', 'font-scale-md', 'font-scale-lg');
    const cls = fontSize === 'small' ? 'font-scale-sm' : fontSize === 'large' ? 'font-scale-lg' : 'font-scale-md';
    document.documentElement.classList.add(cls);
    savePreferences({ darkMode, fontSize, dashboardViewMode: 'table' });
  }, [fontSize]);

  const handleProcess = useCallback(
    async (behaviorFile: File | string, gradesFile: File | string, className: string) => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const studentsList = await processFiles(behaviorFile, gradesFile);
        const now = new Date();
        const newClass: ClassGroup = {
          id: `class-${Date.now()}`,
          name: className.trim() || `כיתה ${now.toLocaleDateString('he-IL')}`,
          students: studentsList,
          lastUpdated: now,
        };
        markClassAdded();
        setState((prev) => ({
          ...prev,
          view: 'dashboard',
          selectedStudentId: null,
          classes: [...prev.classes, newClass],
          activeClassId: newClass.id,
          loading: false,
        }));
        setTimeout(() => flushSave(), 450);
      } catch (error) {
        console.error('Error processing files', error);
        alert('שגיאה בעיבוד הקבצים. אנא וודא שהפורמט תקין.');
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    []
  );

  const handleSelectClass = useCallback((classId: string) => {
    setState((prev) => ({
      ...prev,
      activeClassId: classId,
      view: 'dashboard',
      selectedStudentId: null,
    }));
    closeSidebar();
  }, [closeSidebar]);

  const handleSelectStudent = useCallback((id: string) => {
    setState((prev) => ({ ...prev, view: 'student', selectedStudentId: id }));
  }, []);

  const handleBack = useCallback(() => {
    setState((prev) => ({ ...prev, view: 'dashboard', selectedStudentId: null }));
  }, []);

  const handleUpdateStudent = useCallback(
    (updatedStudent: Student) => {
      if (!state.activeClassId) return;
      const recalculated = calculateStudentStats(updatedStudent, effectiveRiskSettings);
      setState((prev) => {
        const nextClasses = prev.classes.map((c) =>
          c.id === prev.activeClassId
            ? {
                ...c,
                students: c.students.map((s) =>
                  s.id === recalculated.id ? recalculated : s
                ),
                lastUpdated: new Date(),
              }
            : c
        );
        return { ...prev, classes: nextClasses };
      });
    },
    [state.activeClassId, effectiveRiskSettings]
  );

  const handleSaveRiskSettings = useCallback(
    (riskSettings: RiskSettings, forCurrentClassOnly?: boolean) => {
      setState((prev) => {
        if (forCurrentClassOnly && prev.activeClassId) {
          const nextPerClass = { ...prev.perClassRiskSettings, [prev.activeClassId]: riskSettings };
          return { ...prev, perClassRiskSettings: nextPerClass, view: 'dashboard' };
        }
        const nextPerClass = { ...prev.perClassRiskSettings };
        if (prev.activeClassId) delete nextPerClass[prev.activeClassId];
        return { ...prev, riskSettings, perClassRiskSettings: nextPerClass, view: 'dashboard' };
      });
    },
    []
  );

  const handleSavePeriodDefinitions = useCallback((periodDefinitions: PeriodDefinition[]) => {
    setState((prev) => ({ ...prev, periodDefinitions }));
  }, []);

  const handleRenameClass = useCallback((classId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      classes: prev.classes.map((c) =>
        c.id === classId ? { ...c, name: trimmed, lastUpdated: new Date() } : c
      ),
    }));
    setEditingClassId(null);
    setEditingName('');
  }, []);

  const startEditClass = useCallback((c: ClassGroup) => {
    setEditingClassId(c.id);
    setEditingName(c.name);
  }, []);

  const handleDeleteClass = useCallback((classId: string) => {
    if (user?.uid) {
      deleteClassFromFirestore(user.uid, classId).catch((error) => {
        console.error('Failed deleting class from Firestore:', error);
        setCloudSyncError('מחיקת הכיתה בענן נכשלה.');
      });
    }
    setState((prev) => {
      const nextClasses = prev.classes.filter((c) => c.id !== classId);
      let nextActiveId = prev.activeClassId;
      let nextView: AppState['view'] = prev.view;
      if (prev.activeClassId === classId) {
        nextActiveId = nextClasses.length > 0 ? nextClasses[0].id : null;
        nextView = nextClasses.length > 0 ? 'dashboard' : 'landing';
      }
      return { ...prev, classes: nextClasses, activeClassId: nextActiveId, view: nextView, selectedStudentId: null };
    });
    setDeleteConfirmClassId(null);
  }, [setCloudSyncError, user?.uid]);

  const userLabel = user?.email ?? 'משתמש מחובר';
  const handleSignOut = useCallback(async () => {
    await signOut();
    setShowStudentLogin(false);
  }, [signOut]);
  const handleSwitchUser = useCallback(async () => {
    await signOut();
    setShowStudentLogin(false);
    setShowAuthModal(true);
  }, [signOut]);

  const showSidebar = (state.classes.length > 0 || state.view === 'upload') && state.view !== 'landing';

  // Show loading while auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">טוען...</p>
        </div>
      </div>
    );
  }

  // Show student dashboard if student is logged in
  if (user && userRole === 'student') {
    return (
      <StudentDashboard
        onLogout={() => {
          setShowStudentLogin(false);
        }}
      />
    );
  }

  // Show student login if requested
  if (showStudentLogin && !user) {
    return (
      <StudentLogin
        onBackToTeacher={() => {
          setShowStudentLogin(false);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 font-sans text-slate-900 flex">
      {/* Sidebar - collapsible on mobile */}
      {showSidebar && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/20 md:hidden ${sidebarOpen ? '' : 'pointer-events-none opacity-0'}`}
            onClick={closeSidebar}
            aria-hidden="true"
          />
          <aside
            className={`fixed top-0 right-0 z-50 h-full w-64 bg-white border-l border-slate-200 shadow-elevated flex flex-col transition-transform duration-300 md:static md:z-auto md:shadow-none md:border-l md:border-r
              ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="font-bold text-slate-700">כיתות</span>
              <button
                type="button"
                onClick={closeSidebar}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="סגור תפריט"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {state.classes.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-colors
                    ${state.activeClassId === c.id ? 'bg-primary-50 text-primary-700 border border-primary-100' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {editingClassId === c.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameClass(c.id, editingName);
                          if (e.key === 'Escape') {
                            setEditingClassId(null);
                            setEditingName('');
                          }
                        }}
                        onBlur={() => editingName.trim() && handleRenameClass(c.id, editingName)}
                        className="flex-1 min-w-0 px-2 py-1 text-sm rounded-lg border border-primary-200 bg-white focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleRenameClass(c.id, editingName)}
                        className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-600 shrink-0"
                        aria-label="שמור"
                      >
                        <NavIcons.Check size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectClass(c.id)}
                        className="flex-1 min-w-0 text-right flex items-center gap-3"
                      >
                        <NavIcons.Class size={18} className="shrink-0" />
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">{c.students.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEditClass(c); }}
                        className={`p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 shrink-0 transition-opacity ${state.activeClassId === c.id ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'}`}
                        aria-label="עריכת שם כיתה"
                      >
                        <NavIcons.Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmClassId(c.id); }}
                        className={`p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 shrink-0 transition-all ${state.activeClassId === c.id ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'}`}
                        aria-label="מחיקת כיתה"
                      >
                        <NavIcons.Delete size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, view: 'upload' }));
                  closeSidebar();
                }}
                className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl text-primary-600 hover:bg-primary-50 font-medium transition-colors border border-dashed border-primary-200"
              >
                <NavIcons.AddClass size={18} className="shrink-0" />
                הוסף כיתה
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, view: 'settings' }));
                  closeSidebar();
                }}
                className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-medium transition-colors mt-2"
              >
                <NavIcons.Settings size={18} className="shrink-0" />
                הגדרות
              </button>
              <div className="px-3 py-3 mt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-500 block mb-2 px-1">גודל גופן</span>
                <div className="flex items-center gap-1">
                  {(['small', 'medium', 'large'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setFontSize(size)}
                      className={`flex-1 py-2 rounded-lg text-center font-medium transition-colors text-sm ${fontSize === size ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'text-slate-500 hover:bg-slate-100 border border-transparent'}`}
                    >
                      {size === 'small' ? 'A-' : size === 'large' ? 'A+' : 'A'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 py-3 mt-auto border-t border-slate-100">
                {user && (
                  <div className="mb-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[11px] text-slate-500 mb-1">מחובר כעת:</p>
                    <p className="text-xs font-medium text-slate-700 truncate mb-2">{userLabel}</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        התנתק
                      </button>
                      <button
                        type="button"
                        onClick={handleSwitchUser}
                        className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                      >
                        החלף משתמש
                      </button>
                    </div>
                  </div>
                )}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setState((prev) => ({ ...prev, view: 'landing' })); closeSidebar(); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-primary-50/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <Logo fallback={<FileIcons.LogoFallback size={16} className="text-primary-600" />} />
                  </div>
                  <div className="text-right min-w-0">
                    <span className="font-display font-bold text-sm text-slate-700 group-hover:text-primary-600 block truncate">{BRAND_NAME}</span>
                    <span className="text-[10px] text-slate-500 block">{BRAND_TAGLINE}</span>
                  </div>
                </a>
              </div>
            </nav>
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Nav */}
        <nav className="glass border-b border-slate-200/80 sticky top-0 z-30 shadow-soft pt-[env(safe-area-inset-top)]">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            {/* Mobile Layout - Stacked */}
            <div className="md:hidden">
              {/* First Row: Logo and Menu */}
              <div className="flex items-center justify-between min-h-[3.5rem] py-2">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  {showSidebar && (
                    <button
                      type="button"
                      onClick={openSidebar}
                      className="p-2 rounded-xl hover:bg-slate-100 active:bg-slate-200 text-slate-600 transition-colors shrink-0"
                      aria-label="תפריט"
                    >
                      <Menu size={20} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, view: 'landing', activeClassId: prev.activeClassId }))}
                    className="flex items-center gap-2.5 group transition-all duration-200 flex-1 min-w-0"
                  >
                    <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-white shadow-lg overflow-hidden ring-1 ring-slate-200/50 group-hover:ring-primary-200 transition-all shrink-0">
                      <Logo fallback={<FileIcons.LogoFallback size={28} strokeWidth={2.5} className="text-primary-600" />} />
                    </div>
                    <div className="text-right min-w-0">
                      <span className="font-display font-bold text-base text-slate-800 group-hover:text-primary-600 transition-colors tracking-tight block truncate">
                        {BRAND_NAME}
                      </span>
                      <span className="text-[10px] text-slate-500 block">{BRAND_TAGLINE}</span>
                    </div>
                  </button>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                {!user ? (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="p-2 rounded-xl bg-primary-100 text-primary-600 active:bg-primary-200 flex items-center gap-1.5"
                    aria-label="התחבר"
                  >
                    <LogIn size={18} />
                    <span className="text-xs font-medium">התחבר</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSwitchUser}
                    className="p-2 rounded-xl bg-slate-100 text-slate-700 active:bg-slate-200 flex items-center gap-1.5"
                    aria-label="החלף משתמש"
                    title={userLabel}
                  >
                    <LogOut size={18} />
                    <span className="text-xs font-medium truncate max-w-[110px]">{userLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDarkMode((d) => !d)}
                  className={`p-2 rounded-xl transition-colors no-print ${darkMode ? 'bg-amber-100 text-amber-700 active:bg-amber-200' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}
                  aria-label={darkMode ? 'מצב בהיר' : 'מצב כהה'}
                  title={darkMode ? 'מצב בהיר' : 'מצב כהה'}
                >
                  {darkMode ? <NavIcons.Light size={18} /> : <NavIcons.Dark size={18} />}
                </button>
              </div>
              </div>

              {/* Second Row: Navigation Buttons (only when not in upload/settings) */}
              {state.view !== 'upload' && state.view !== 'settings' && state.view !== 'landing' && (
                <div className="pb-2.5 space-y-2">
                  {/* Main Navigation Tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-700/90 border border-slate-200/80 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'dashboard' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                        state.view === 'dashboard' || state.view === 'student'
                          ? 'bg-white text-primary-700 shadow-sm border border-slate-200/80 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500'
                          : 'text-slate-600 dark:text-slate-300 active:bg-slate-200/60 dark:active:bg-slate-600'
                      }`}
                      aria-label="דשבורד"
                    >
                      <NavIcons.Dashboard size={18} className="shrink-0" />
                      <span className="text-xs sm:text-sm">דשבורד</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'teachers' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                        state.view === 'teachers'
                          ? 'bg-white text-primary-700 shadow-sm border border-slate-200/80 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500'
                          : 'text-slate-600 dark:text-slate-300 active:bg-slate-200/60 dark:active:bg-slate-600'
                      }`}
                      aria-label="אנליטיקת מורים"
                    >
                      <NavIcons.TeachersAnalytics size={18} className="shrink-0" />
                      <span className="text-xs sm:text-sm">אנליטיקה</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'matrix' }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[40px] ${
                        state.view === 'matrix'
                          ? 'bg-white text-primary-700 shadow-sm border border-slate-200/80 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500'
                          : 'text-slate-600 dark:text-slate-300 active:bg-slate-200/60 dark:active:bg-slate-600'
                      }`}
                      aria-label="מטריצת מקצועות"
                    >
                      <NavIcons.SubjectMatrix size={18} className="shrink-0" />
                      <span className="text-xs sm:text-sm">מטריצה</span>
                    </button>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, isAnonymous: !prev.isAnonymous }))}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[40px] ${
                        state.isAnonymous
                          ? 'bg-primary-100 text-primary-700 border border-primary-200 active:bg-primary-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 active:bg-slate-200'
                      }`}
                      title={state.isAnonymous ? 'כיבוי מצב פרטיות' : 'הפעלת מצב פרטיות'}
                      aria-label={state.isAnonymous ? 'כיבוי מצב פרטיות' : 'הפעלת מצב פרטיות'}
                    >
                      {state.isAnonymous ? <NavIcons.PrivacyOff size={18} /> : <NavIcons.Privacy size={18} />}
                      <span className="text-xs sm:text-sm">{state.isAnonymous ? 'פרטיות' : 'פרטיות'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'upload' }))}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-slate-600 hover:text-primary-600 hover:bg-primary-50/60 active:bg-primary-100 border border-slate-200 transition-all text-sm font-medium min-h-[40px]"
                      aria-label="העלאת קבצים"
                    >
                      <NavIcons.Upload size={18} className="shrink-0" />
                      <span className="text-xs sm:text-sm">העלה</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Layout - Horizontal */}
            <div className="hidden md:flex items-center justify-between min-h-[4.5rem]">
              <div className="flex items-center gap-3">
                {showSidebar && (
                  <button
                    type="button"
                    onClick={openSidebar}
                    className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600"
                    aria-label="תפריט"
                  >
                    <Menu size={22} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, view: 'landing', activeClassId: prev.activeClassId }))}
                  className="flex items-center gap-3 group transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-20 h-20 rounded-xl bg-white shadow-lg overflow-hidden ring-1 ring-slate-200/50 group-hover:ring-primary-200 transition-all">
                    <Logo fallback={<FileIcons.LogoFallback size={32} strokeWidth={2.5} className="text-primary-600" />} />
                  </div>
                  <div className="text-right">
                    <span className="font-display font-bold text-lg md:text-xl text-slate-800 group-hover:text-primary-600 transition-colors tracking-tight block">
                      {BRAND_NAME}
                    </span>
                    <span className="text-xs text-slate-500 font-medium hidden sm:block">{BRAND_TAGLINE}</span>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {state.view !== 'upload' && state.view !== 'settings' && state.view !== 'landing' && (
                  <>
                    {/* Navigation: Dashboard | Teacher Analytics | Subject Matrix */}
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-700/90 border border-slate-200/80 dark:border-slate-600">
                      <button
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, view: 'dashboard' }))}
                        className={`flex items-center justify-start gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                          state.view === 'dashboard' || state.view === 'student'
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                        }`}
                        aria-label="דשבורד"
                      >
                        <NavIcons.Dashboard size={18} className="shrink-0" />
                        <span>דשבורד</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, view: 'teachers' }))}
                        className={`flex items-center justify-start gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                          state.view === 'teachers'
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                        }`}
                        aria-label="אנליטיקת מורים"
                      >
                        <NavIcons.TeachersAnalytics size={18} className="shrink-0" />
                        <span>אנליטיקת מורים</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, view: 'matrix' }))}
                        className={`flex items-center justify-start gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                          state.view === 'matrix'
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200 dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                        }`}
                        aria-label="מטריצת מקצועות"
                      >
                        <NavIcons.SubjectMatrix size={18} className="shrink-0" />
                        <span>מטריצת מקצועות</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, isAnonymous: !prev.isAnonymous }))}
                        className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                          state.isAnonymous
                            ? 'bg-primary-100 text-primary-700 border border-primary-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                        title={state.isAnonymous ? 'כיבוי מצב פרטיות' : 'הפעלת מצב פרטיות'}
                        aria-label={state.isAnonymous ? 'כיבוי מצב פרטיות' : 'הפעלת מצב פרטיות'}
                      >
                        {state.isAnonymous ? <NavIcons.PrivacyOff size={18} /> : <NavIcons.Privacy size={18} />}
                        <span>{state.isAnonymous ? 'פרטיות פעילה' : 'פרטיות'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, view: 'upload' }))}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50/50 transition-colors text-sm font-medium min-h-[44px]"
                        aria-label="העלאת קבצים"
                      >
                        <NavIcons.Upload size={18} className="shrink-0" />
                        <span>העלאת קבצים</span>
                      </button>
                    </div>
                  </>
                )}
                {!user ? (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-primary-100 text-primary-600 hover:bg-primary-200 font-medium text-sm"
                    aria-label="התחבר"
                  >
                    <LogIn size={18} />
                    התחבר
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSwitchUser}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium text-sm max-w-[320px]"
                    aria-label="החלף משתמש"
                    title={userLabel}
                  >
                    <LogOut size={18} />
                    <span className="truncate">{userLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDarkMode((d) => !d)}
                  className={`p-2.5 rounded-xl transition-colors no-print ${darkMode ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  aria-label={darkMode ? 'מצב בהיר' : 'מצב כהה'}
                  title={darkMode ? 'מצב בהיר' : 'מצב כהה'}
                >
                  {darkMode ? <NavIcons.Light size={18} /> : <NavIcons.Dark size={18} />}
                </button>
              </div>
            </div>
          </div>
        </nav>

        {showAuthModal && (
          <LoginSignup
            onClose={() => setShowAuthModal(false)}
            onOpenFirebaseConfig={() => {
              setShowAuthModal(false);
              setShowFirebaseConfig(true);
            }}
          />
        )}
        {showFirebaseConfig && <FirebaseConfigDialog onClose={() => setShowFirebaseConfig(false)} />}

        <main className="animate-fade-in flex-1 relative">
          {cloudSyncError && user && (
            <div className="mx-4 mt-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm flex items-center justify-between gap-2">
              <span>{cloudSyncError}</span>
              <button type="button" onClick={() => setCloudSyncError(null)} className="shrink-0 p-1 rounded hover:bg-amber-200/50" aria-label="סגור">×</button>
            </div>
          )}
          {cloudLoadPending && user && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/95 dark:bg-slate-900/95">
              <div className="text-center">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400 font-medium">טוען נתונים מהענן...</p>
              </div>
            </div>
          )}
          {state.view === 'landing' && (
            <LandingPage
              onOpenAuth={() => setShowAuthModal(true)}
              onOpenStudentLogin={() => setShowStudentLogin(true)}
              onStart={() => {
                setState((prev) => {
                  if (prev.classes.length > 0) {
                    const nextActiveId =
                      prev.activeClassId && prev.classes.some((c) => c.id === prev.activeClassId)
                        ? prev.activeClassId
                        : prev.classes[0].id;
                    return { ...prev, view: 'dashboard', activeClassId: nextActiveId };
                  }
                  return { ...prev, view: 'upload' };
                });
              }}
            />
          )}

          {state.view === 'upload' && (
            <FileUpload onProcess={handleProcess} loading={state.loading} />
          )}

          {state.view === 'dashboard' && activeClass && (
            <Dashboard
              students={students}
              classAverage={classAverage}
              onSelectStudent={handleSelectStudent}
              riskSettings={effectiveRiskSettings}
              isAnonymous={state.isAnonymous}
              className={activeClass.name}
              classGroup={activeClass}
              periodDefinitions={state.periodDefinitions}
              visibleWidgets={dashboardWidgets}
              onHideWidget={(id) => {
                const next = { ...dashboardWidgets, [id]: false };
                setDashboardWidgets(next);
                savePreferences({ ...loadPreferences(), dashboardWidgets: next });
              }}
            />
          )}

          {state.view === 'student' && selectedStudent && activeClass && (
            <StudentProfile
              student={selectedStudent}
              students={students}
              currentIndex={selectedStudentIndex >= 0 ? selectedStudentIndex : 0}
              onSelectStudent={handleSelectStudent}
              onBack={handleBack}
              classAverage={classAverage}
              onUpdateStudent={handleUpdateStudent}
              riskSettings={effectiveRiskSettings}
              isAnonymous={state.isAnonymous}
              studentIndex={selectedStudentIndex >= 0 ? selectedStudentIndex : 0}
              periodDefinitions={state.periodDefinitions}
            />
          )}

          {state.view === 'teachers' && activeClass && (
            <TeachersAnalytics students={students} isAnonymous={state.isAnonymous} periodDefinitions={state.periodDefinitions} />
          )}

          {state.view === 'matrix' && activeClass && (
            <SubjectMatrix students={students} isAnonymous={state.isAnonymous} />
          )}

          {state.view === 'settings' && (
            <SettingsPanel
              riskSettings={effectiveRiskSettings}
              globalRiskSettings={state.riskSettings}
              perClassRiskSettings={state.perClassRiskSettings}
              activeClassId={state.activeClassId}
              classes={state.classes}
              students={activeClass?.students ?? []}
              onSave={handleSaveRiskSettings}
              onSavePeriodDefinitions={handleSavePeriodDefinitions}
              periodDefinitions={state.periodDefinitions}
              onBack={() => setState((prev) => ({ ...prev, view: 'dashboard' }))}
              dashboardWidgets={dashboardWidgets}
              onSaveDashboardWidgets={(widgets) => {
                setDashboardWidgets(widgets);
                savePreferences({ ...loadPreferences(), dashboardWidgets: widgets });
              }}
            />
          )}
        </main>

        {/* Delete Class Confirmation */}
        {deleteConfirmClassId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteConfirmClassId(null)}>
            <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 w-full max-w-sm p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-4">
                  <NavIcons.Delete size={26} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">מחיקת כיתה</h3>
                <p className="text-slate-600 text-sm mb-6">
                  האם אתה בטוח שברצונך למחוק את &quot;<strong>{state.classes.find((c) => c.id === deleteConfirmClassId)?.name}</strong>&quot;?
                  <br />פעולה זו אינה ניתנת לביטול.
                </p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setDeleteConfirmClassId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">
                    ביטול
                  </button>
                  <button type="button" onClick={() => handleDeleteClass(deleteConfirmClassId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors">
                    מחק
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
