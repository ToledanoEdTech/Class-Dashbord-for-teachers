import React, { useState, useEffect, useCallback } from 'react';
import { Save, Check, Loader2, AlertCircle, GraduationCap } from 'lucide-react';
import type { MeetingLinkData } from '../utils/meetingSync';
import { loadMeetingLink, loadParticipantNotes, saveParticipantNote } from '../utils/meetingSync';

interface MeetingTeacherFormProps {
  linkToken: string;
  homeroomUid: string;
}

const MeetingTeacherForm: React.FC<MeetingTeacherFormProps> = ({ linkToken, homeroomUid }) => {
  const [linkData, setLinkData] = useState<MeetingLinkData | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAll, setSavedAll] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadMeetingLink(homeroomUid, linkToken);
      if (!data) {
        setError('הקישור אינו תקין או שפג תוקפו');
        return;
      }
      setLinkData(data);
      const existing = await loadParticipantNotes(homeroomUid, linkToken);
      setNotes(existing);
    } catch {
      setError('שגיאה בטעינת הנתונים. נסה/י שוב.');
    } finally {
      setLoading(false);
    }
  }, [linkToken, homeroomUid]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveStudent = async (studentId: string) => {
    if (!linkData) return;
    setSaving(studentId);
    try {
      await saveParticipantNote(linkData, linkToken, studentId, notes[studentId] ?? '');
    } catch {
      alert('שגיאה בשמירה. נסה/י שוב.');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveAll = async () => {
    if (!linkData) return;
    setSaving('all');
    try {
      for (const student of linkData.students) {
        await saveParticipantNote(linkData, linkToken, student.id, notes[student.id] ?? '');
      }
      setSavedAll(true);
      setTimeout(() => setSavedAll(false), 3000);
    } catch {
      alert('שגיאה בשמירה. נסה/י שוב.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-primary-50/30">
        <Loader2 size={36} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !linkData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-primary-50/30 p-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">קישור לא תקין</h2>
          <p className="text-slate-600">{error ?? 'לא ניתן לטעון את הישיבה'}</p>
        </div>
      </div>
    );
  }

  const filledCount = linkData.students.filter((s) => (notes[s.id] ?? '').trim()).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50/30">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
              <GraduationCap size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-slate-800 truncate">{linkData.meetingTitle}</h1>
              <p className="text-sm text-slate-500">
                {linkData.className} · {linkData.subject} · {linkData.teacherName}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4">
          <p className="text-sm text-primary-800">
            שלום {linkData.teacherName}, אנא כתוב/י הערות על התלמידים שלך במקצוע {linkData.subject}.
            ההערות יוצגו בישיבה הפדגוגית.
          </p>
          <p className="text-xs text-primary-600 mt-2">
            {filledCount}/{linkData.students.length} תלמידים עם הערות
          </p>
        </div>

        {linkData.students.map((student) => {
          const isExpanded = expandedStudent === student.id;
          const hasNote = !!(notes[student.id] ?? '').trim();
          return (
            <div key={student.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedStudent(isExpanded ? null : student.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium text-slate-800 flex-1">{student.name}</span>
                {student.averageScore != null && (
                  <span className="text-xs text-slate-400">ממוצע: {student.averageScore.toFixed(1)}</span>
                )}
                {student.riskLevel === 'high' && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">סיכון גבוה</span>
                )}
                {hasNote && <Check size={16} className="text-green-500 shrink-0" />}
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <textarea
                    value={notes[student.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [student.id]: e.target.value }))}
                    rows={4}
                    placeholder="כתוב/י הערות על התלמיד/ה..."
                    className="w-full mt-3 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/30 resize-y text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveStudent(student.id)}
                    disabled={saving === student.id}
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving === student.id ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    שמור
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="sticky bottom-4 pt-2">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving === 'all'}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 shadow-lg"
          >
            {saving === 'all' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : savedAll ? (
              <>
                <Check size={20} />
                נשמר בהצלחה!
              </>
            ) : (
              <>
                <Save size={20} />
                שמור הכל וסיים
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
};

export default MeetingTeacherForm;
