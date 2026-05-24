import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Calendar, Users, ChevronLeft, Trash2, Loader2, CloudOff } from 'lucide-react';
import type { ClassGroup, PedagogicalMeeting } from '../types';
import { extractTeacherSubjectPairs } from '../utils/meetingTeachers';
import { listMeetings, createMeeting, deleteMeeting, formatMeetingError } from '../utils/meetingSync';
import { isFirebaseConfigured } from '../firebase';

interface PedagogicalMeetingsProps {
  activeClass: ClassGroup;
  homeroomUid: string;
  homeroomName: string;
  onOpenMeeting: (meetingId: string) => void;
  onBack?: () => void;
}

const STATUS_LABELS: Record<PedagogicalMeeting['status'], string> = {
  draft: 'טיוטה',
  collecting: 'איסוף הערות',
  in_progress: 'בישיבה',
  completed: 'הושלמה',
};

const STATUS_COLORS: Record<PedagogicalMeeting['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  collecting: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
};

const PedagogicalMeetings: React.FC<PedagogicalMeetingsProps> = ({
  activeClass,
  homeroomUid,
  homeroomName,
  onOpenMeeting,
}) => {
  const [meetings, setMeetings] = useState<PedagogicalMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teacherPairs = extractTeacherSubjectPairs(activeClass.students);
  const pairKey = (t: string, s: string) => `${t}\0${s}`;

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listMeetings(homeroomUid, activeClass.id);
      setMeetings(list);
    } catch (err) {
      console.error('listMeetings error:', err);
      setMeetings([]);
      setError(formatMeetingError(err));
    } finally {
      setLoading(false);
    }
  }, [homeroomUid, activeClass.id]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    const selected = teacherPairs.filter((p) => selectedPairs.has(pairKey(p.teacher, p.subject)));
    if (selected.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const meeting = await createMeeting(
        homeroomUid,
        homeroomName,
        activeClass.id,
        activeClass.name,
        title.trim(),
        selected.map((p) => ({ teacherName: p.teacher, subject: p.subject })),
        activeClass.students
      );
      setShowCreate(false);
      setTitle('');
      setSelectedPairs(new Set());
      await loadMeetings();
      onOpenMeeting(meeting.id);
    } catch (err) {
      console.error('createMeeting error:', err);
      setError(formatMeetingError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (meetingId: string) => {
    await deleteMeeting(homeroomUid, meetingId);
    setDeleteId(null);
    await loadMeetings();
  };

  const togglePair = (key: string) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!isFirebaseConfigured()) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <CloudOff size={48} className="mx-auto text-slate-400 mb-4" />
        <h2 className="text-xl font-bold text-slate-800 mb-2">נדרש חיבור לענן</h2>
        <p className="text-slate-600">ישיבות פדגוגיות דורשות התחברות ו-Firebase מוגדר. התחבר/י והגדר/י Firebase בהגדרות.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">ישיבות פדגוגיות</h1>
          <p className="text-slate-500 text-sm mt-1">כיתה {activeClass.name} · {activeClass.students.length} תלמידים</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            setTitle(`ישיבה פדגוגית – ${activeClass.name}`);
            setSelectedPairs(new Set(teacherPairs.map((p) => pairKey(p.teacher, p.subject))));
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors shrink-0"
        >
          <Plus size={18} />
          ישיבה חדשה
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Calendar size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">אין ישיבות עדיין</h3>
          <p className="text-slate-500 text-sm mb-6">צור/י ישיבה פדגוגית, שלח/י קישורים למורים והתחל/י לאסוף הערות</p>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700"
          >
            צור ישיבה ראשונה
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex items-center gap-4 hover:border-primary-200 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => onOpenMeeting(m.id)}
            >
              <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800 truncate">{m.title}</h3>
                <p className="text-sm text-slate-500">
                  {new Date(m.createdAt).toLocaleDateString('he-IL')} · {(m.participants ?? []).length} מורים · {(m.studentSnapshot ?? []).length} תלמידים
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${STATUS_COLORS[m.status]}`}>
                {STATUS_LABELS[m.status]}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDeleteId(m.id); }}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                aria-label="מחק ישיבה"
              >
                <Trash2 size={16} />
              </button>
              <ChevronLeft size={20} className="text-slate-400 shrink-0" />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-slate-800 mb-4">ישיבה פדגוגית חדשה</h2>
            <label className="block text-sm font-medium text-slate-700 mb-1">שם הישיבה</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 mb-4 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
              placeholder="ישיבה פדגוגית – כיתה..."
            />
            <p className="text-sm font-medium text-slate-700 mb-2">בחר/י מורים לשליחת קישור ({selectedPairs.size} נבחרו)</p>
            {teacherPairs.length === 0 ? (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-xl mb-4">לא נמצאו מורים בנתוני הכיתה. העלה/י קבצי ציונים והתנהגות.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 mb-4 border border-slate-100 rounded-xl p-2">
                {teacherPairs.map((p) => {
                  const key = pairKey(p.teacher, p.subject);
                  return (
                    <label key={key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPairs.has(key)}
                        onChange={() => togglePair(key)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-slate-700">{p.teacher}</span>
                      <span className="text-xs text-slate-400 mr-auto">{p.subject}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50">
                ביטול
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !title.trim() || selectedPairs.size === 0}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={18} className="animate-spin" /> : 'צור ופתח'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-2xl shadow-elevated w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 mb-2">מחיקת ישיבה</h3>
            <p className="text-slate-600 text-sm mb-6">האם למחוק את הישיבה? כל ההערות וההחלטות יימחקו לצמיתות.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium">ביטול</button>
              <button type="button" onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600">מחק</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedagogicalMeetings;
