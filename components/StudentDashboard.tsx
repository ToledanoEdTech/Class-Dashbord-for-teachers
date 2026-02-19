import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getFirebaseDb } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import StudentProfile from './StudentProfile';
import { Student, RiskSettings, PeriodDefinition } from '../types';
import { DEFAULT_RISK_SETTINGS } from '../types';
import { LogOut, Loader2 } from 'lucide-react';
import { loadStudentDataForStudent } from '../utils/studentDataLoader';

interface StudentDashboardProps {
  onLogout: () => void;
}

export default function StudentDashboard({ onLogout }: StudentDashboardProps) {
  const { user, signOut } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>('');
  const [riskSettings] = useState<RiskSettings>(DEFAULT_RISK_SETTINGS);
  const [periodDefinitions] = useState<PeriodDefinition[]>([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get user role and studentId from Firestore
        const db = getFirebaseDb();
        if (!db) {
          setError('חיבור לענן לא זמין');
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          setError('חשבון לא נמצא');
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        if (userData.role !== 'student' || !userData.studentId) {
          setError('חשבון לא תקין');
          setLoading(false);
          return;
        }

        if (!userData.teacherUid) {
          setError('החשבון דורש עדכון על ידי המורה. היכנסו לניהול חשבונות תלמידים וצרו/עדכנו את החשבון מחדש.');
          setLoading(false);
          return;
        }

        setStudentName(userData.displayName || userData.username || 'תלמיד');

        // Load student data
        const studentData = await loadStudentDataForStudent(userData.studentId, userData.teacherUid);
        
        if (!studentData) {
          setError('נתוני התלמיד לא נמצאו');
          setLoading(false);
          return;
        }

        setStudent(studentData);
      } catch (err) {
        console.error('Error loading student data:', err);
        setError('שגיאה בטעינת הנתונים');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-slate-600">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-elevated border border-slate-200 p-8 max-w-md w-full text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">שגיאה</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
          >
            חזרה להתחברות
          </button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">לא נמצאו נתונים</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30">
      {/* Header */}
      <nav className="glass border-b border-slate-200/80 sticky top-0 z-30 shadow-soft">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between min-h-[4rem] py-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-800">{studentName}</h1>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
            >
              <LogOut size={18} />
              התנתק
            </button>
          </div>
        </div>
      </nav>

      {/* Student Profile */}
      <main className="max-w-7xl mx-auto p-4 md:p-8">
        <StudentProfile
          student={student}
          students={[student]}
          currentIndex={0}
          onBack={() => {}} // No back button for students
          classAverage={student.averageScore}
          riskSettings={riskSettings}
          isAnonymous={false}
          studentIndex={0}
          periodDefinitions={periodDefinitions}
        />
      </main>
    </div>
  );
}
