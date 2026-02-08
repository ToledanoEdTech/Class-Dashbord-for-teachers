import React, { useState, useEffect, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import StudentProfile from './components/StudentProfile';
import SettingsPanel from './components/SettingsPanel';
import TeachersAnalytics from './components/TeachersAnalytics';
import SubjectMatrix from './components/SubjectMatrix';
import { Student, AppState, ClassGroup, RiskSettings } from './types';
import { processFiles } from './utils/processing';
import { calculateStudentStats } from './utils/processing';
import { saveToStorage, loadFromStorage } from './utils/storage';
import { GraduationCap, LayoutDashboard, Upload, Menu, X, Settings, PlusCircle, BookOpen, Pencil, Check, Eye, EyeOff, BarChart3, Grid3X3 } from 'lucide-react';

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

const getInitialState = (): AppState => {
  const { classes, activeClassId, riskSettings } = loadFromStorage();
  return {
    view: classes.length === 0 ? 'upload' : activeClassId ? 'dashboard' : 'upload',
    selectedStudentId: null,
    classes,
    activeClassId,
    isAnonymous: false,
    riskSettings,
    loading: false,
  };
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(getInitialState);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const activeClass = state.classes.find((c) => c.id === state.activeClassId);
  const students = activeClass?.students ?? [];
  const classAverage =
    students.length > 0
      ? students.reduce((sum, s) => sum + s.averageScore, 0) / students.length
      : 0;
  const selectedStudent = students.find((s) => s.id === state.selectedStudentId);
  const selectedStudentIndex = state.selectedStudentId ? students.findIndex((s) => s.id === state.selectedStudentId) : -1;

  useEffect(() => {
    saveToStorage({
      classes: state.classes,
      activeClassId: state.activeClassId,
      riskSettings: state.riskSettings,
    });
  }, [state.classes, state.activeClassId, state.riskSettings]);

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
        setState((prev) => ({
          ...prev,
          view: 'dashboard',
          selectedStudentId: null,
          classes: [...prev.classes, newClass],
          activeClassId: newClass.id,
          loading: false,
        }));
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
    setSidebarOpen(false);
  }, []);

  const handleSelectStudent = useCallback((id: string) => {
    setState((prev) => ({ ...prev, view: 'student', selectedStudentId: id }));
  }, []);

  const handleBack = useCallback(() => {
    setState((prev) => ({ ...prev, view: 'dashboard', selectedStudentId: null }));
  }, []);

  const handleUpdateStudent = useCallback(
    (updatedStudent: Student) => {
      if (!state.activeClassId) return;
      const recalculated = calculateStudentStats(updatedStudent, state.riskSettings);
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
    [state.activeClassId, state.riskSettings]
  );

  const handleSaveRiskSettings = useCallback((riskSettings: RiskSettings) => {
    setState((prev) => ({ ...prev, riskSettings, view: 'dashboard' }));
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

  const showSidebar = state.classes.length > 0 || state.view === 'upload';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 font-sans text-slate-900 flex">
      {/* Sidebar - collapsible on mobile */}
      {showSidebar && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/20 md:hidden ${sidebarOpen ? '' : 'pointer-events-none opacity-0'}`}
            onClick={() => setSidebarOpen(false)}
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
                onClick={() => setSidebarOpen(false)}
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
                        <Check size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSelectClass(c.id)}
                        className="flex-1 min-w-0 text-right flex items-center gap-3"
                      >
                        <BookOpen size={18} className="shrink-0" />
                        <span className="truncate">{c.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">{c.students.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEditClass(c); }}
                        className={`p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 shrink-0 transition-opacity ${state.activeClassId === c.id ? 'opacity-70' : 'opacity-0 group-hover:opacity-100'}`}
                        aria-label="עריכת שם כיתה"
                      >
                        <Pencil size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, view: 'upload' }));
                  setSidebarOpen(false);
                }}
                className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl text-primary-600 hover:bg-primary-50 font-medium transition-colors border border-dashed border-primary-200"
              >
                <PlusCircle size={18} className="shrink-0" />
                הוסף כיתה
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, view: 'settings' }));
                  setSidebarOpen(false);
                }}
                className="w-full text-right flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50 font-medium transition-colors mt-2"
              >
                <Settings size={18} className="shrink-0" />
                הגדרות סיכון
              </button>
            </nav>
          </aside>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Nav */}
        <nav className="glass border-b border-slate-200/80 sticky top-0 z-30 shadow-soft">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 md:h-[4.5rem]">
              <div className="flex items-center gap-3">
                {showSidebar && (
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600"
                    aria-label="תפריט"
                  >
                    <Menu size={22} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, view: 'upload', activeClassId: prev.activeClassId }))}
                  className="flex items-center gap-3 group transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow-lg overflow-hidden ring-1 ring-slate-200/50 group-hover:ring-primary-200 transition-all">
                    <Logo fallback={<GraduationCap size={22} strokeWidth={2.5} className="text-primary-600" />} />
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg md:text-xl text-slate-800 group-hover:text-primary-600 transition-colors tracking-tight block">
                      ToledanoEdTech
                    </span>
                    <span className="text-xs text-slate-500 font-medium hidden sm:block">מערכת מעקב פדגוגית</span>
                  </div>
                </button>
              </div>

              {state.view !== 'upload' && state.view !== 'settings' && (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {/* Navigation: Dashboard | Teacher Analytics | Subject Matrix */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'dashboard' }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.view === 'dashboard' || state.view === 'student' ? 'bg-white text-primary-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <LayoutDashboard size={16} />
                      <span className="hidden sm:inline">דשבורד</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'teachers' }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.view === 'teachers' ? 'bg-white text-primary-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <BarChart3 size={16} />
                      <span className="hidden sm:inline">אנליטיקת מורים</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setState((prev) => ({ ...prev, view: 'matrix' }))}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${state.view === 'matrix' ? 'bg-white text-primary-700 shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                      <Grid3X3 size={16} />
                      <span className="hidden sm:inline">מטריצת מקצועות</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, isAnonymous: !prev.isAnonymous }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${state.isAnonymous ? 'bg-primary-100 text-primary-700 border border-primary-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'}`}
                    title={state.isAnonymous ? 'כיבוי מצב פרטיות' : 'הפעלת מצב פרטיות'}
                    aria-label={state.isAnonymous ? 'כיבוי מצב פרטיות' : 'הפעלת מצב פרטיות'}
                  >
                    {state.isAnonymous ? <EyeOff size={18} /> : <Eye size={18} />}
                    <span className="hidden sm:inline">{state.isAnonymous ? 'פרטיות פעילה' : 'פרטיות'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setState((prev) => ({ ...prev, view: 'upload' }))}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-500 hover:text-primary-600 hover:bg-primary-50/50 transition-colors text-sm font-medium"
                  >
                    <Upload size={16} />
                    <span className="hidden sm:inline">העלאת קבצים</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        <main className="animate-fade-in flex-1">
          {state.view === 'upload' && (
            <FileUpload onProcess={handleProcess} loading={state.loading} />
          )}

          {state.view === 'dashboard' && activeClass && (
            <Dashboard
              students={students}
              classAverage={classAverage}
              onSelectStudent={handleSelectStudent}
              riskSettings={state.riskSettings}
              isAnonymous={state.isAnonymous}
            />
          )}

          {state.view === 'student' && selectedStudent && activeClass && (
            <StudentProfile
              student={selectedStudent}
              onBack={handleBack}
              classAverage={classAverage}
              onUpdateStudent={handleUpdateStudent}
              riskSettings={state.riskSettings}
              isAnonymous={state.isAnonymous}
              studentIndex={selectedStudentIndex >= 0 ? selectedStudentIndex : 0}
            />
          )}

          {state.view === 'teachers' && activeClass && (
            <TeachersAnalytics students={students} isAnonymous={state.isAnonymous} />
          )}

          {state.view === 'matrix' && activeClass && (
            <SubjectMatrix students={students} isAnonymous={state.isAnonymous} />
          )}

          {state.view === 'settings' && (
            <SettingsPanel
              riskSettings={state.riskSettings}
              onSave={handleSaveRiskSettings}
              onBack={() => setState((prev) => ({ ...prev, view: 'dashboard' }))}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
