import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import StudentProfile from './components/StudentProfile';
import { Student, AppState } from './types';
import { processFiles } from './utils/processing';
import { GraduationCap, LayoutDashboard, Upload } from 'lucide-react';

// הלוגו: שים קובץ logo.png (או logo.svg) בתיקייה public/
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

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    view: 'upload',
    selectedStudentId: null,
    students: [],
    classAverage: 0,
    loading: false
  });

  const handleProcess = async (behaviorFile: File | string, gradesFile: File | string) => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const students = await processFiles(behaviorFile, gradesFile);
      const totalAvg = students.reduce((sum, s) => sum + s.averageScore, 0) / (students.length || 1);
      
      setState({
        view: 'dashboard',
        selectedStudentId: null,
        students,
        classAverage: totalAvg,
        loading: false
      });
    } catch (error) {
      console.error("Error processing files", error);
      alert("שגיאה בעיבוד הקבצים. אנא וודא שהפורמט תקין.");
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSelectStudent = (id: string) => {
    setState(prev => ({ ...prev, view: 'student', selectedStudentId: id }));
  };

  const handleBack = () => {
    setState(prev => ({ ...prev, view: 'dashboard', selectedStudentId: null }));
  };

  const selectedStudent = state.students.find(s => s.id === state.selectedStudentId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 font-sans text-slate-900">
      {/* Premium Navigation */}
      <nav className="glass border-b border-slate-200/80 sticky top-0 z-50 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[4.5rem]">
            <button
              onClick={() => setState(prev => ({...prev, view: 'upload', students: []}))}
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

            {state.view !== 'upload' && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50/80 border border-primary-100 text-primary-700 font-medium text-sm">
                  <LayoutDashboard size={18} />
                  דשבורד כיתתי
                </div>
                <button
                  onClick={() => setState(prev => ({...prev, view: 'upload', students: []}))}
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

      <main className="animate-fade-in">
        {state.view === 'upload' && (
          <FileUpload onProcess={handleProcess} loading={state.loading} />
        )}

        {state.view === 'dashboard' && (
          <Dashboard 
            students={state.students} 
            classAverage={state.classAverage} 
            onSelectStudent={handleSelectStudent}
          />
        )}

        {state.view === 'student' && selectedStudent && (
          <StudentProfile 
            student={selectedStudent} 
            onBack={handleBack} 
            classAverage={state.classAverage}
          />
        )}
      </main>
    </div>
  );
};

export default App;
