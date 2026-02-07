import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import StudentProfile from './components/StudentProfile';
import { Student, AppState } from './types';
import { processFiles } from './utils/processing';
import { GraduationCap } from 'lucide-react';

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
      // Simulate slight delay for UX
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Navigation - Sticky */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 text-blue-600 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setState(prev => ({...prev, view: 'upload', students: []}))}>
            <GraduationCap size={32} />
            <span className="font-bold text-xl tracking-tight">ToledanoEdTech</span>
          </div>
          {state.view !== 'upload' && (
             <div className="flex items-center gap-4">
                <div className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full hidden sm:block">
                    דשבורד כיתתי
                </div>
             </div>
          )}
        </div>
      </nav>

      <main>
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
          />
        )}
      </main>
    </div>
  );
};

export default App;