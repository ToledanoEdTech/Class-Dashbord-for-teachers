import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronRight, Copy, Check, Download, Plus, Trash2, Loader2,
  Link2, Users, FileText, ClipboardList,
} from 'lucide-react';
import type { PedagogicalMeeting, StudentMeetingNote, MeetingDecision } from '../types';
import {
  getMeeting,
  getParticipantLinks,
  buildShareUrl,
  subscribeMeetingNotes,
  subscribeMeetingDecisions,
  addMeetingDecision,
  deleteMeetingDecision,
  updateMeetingStatus,
  formatMeetingError,
} from '../utils/meetingSync';
import { exportPedagogicalMeetingToExcel } from '../utils/exportMeeting';

interface MeetingViewProps {
  meetingId: string;
  homeroomUid: string;
  homeroomName: string;
  onBack: () => void;
}

const STATUS_OPTIONS: { value: PedagogicalMeeting['status']; label: string }[] = [
  { value: 'collecting', label: 'איסוף הערות' },
  { value: 'in_progress', label: 'בישיבה' },
  { value: 'completed', label: 'הושלמה' },
];

const MeetingView: React.FC<MeetingViewProps> = ({ meetingId, homeroomUid, homeroomName, onBack }) => {
  const [meeting, setMeeting] = useState<PedagogicalMeeting | null>(null);
  const [notes, setNotes] = useState<StudentMeetingNote[]>([]);
  const [decisions, setDecisions] = useState<MeetingDecision[]>([]);
  const [links, setLinks] = useState<{ participantId: string; teacherName: string; subject: string; linkToken: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'decisions' | 'links'>('notes');
  const [newDecision, setNewDecision] = useState('');
  const [newDecisionStudent, setNewDecisionStudent] = useState('');
  const [authorRole, setAuthorRole] = useState<'homeroom' | 'coordinator'>('homeroom');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeeting = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await getMeeting(homeroomUid, meetingId);
      if (!m) {
        setError('הישיבה לא נמצאה');
        setMeeting(null);
        return;
      }
      setMeeting(m);
      const l = await getParticipantLinks(homeroomUid, meetingId);
      setLinks(l);
    } catch (err) {
      console.error('loadMeeting error:', err);
      setError(formatMeetingError(err));
      setMeeting(null);
    } finally {
      setLoading(false);
    }
  }, [homeroomUid, meetingId]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  useEffect(() => {
    const unsubNotes = subscribeMeetingNotes(homeroomUid, meetingId, setNotes, (err) => {
      setError(formatMeetingError(err));
    });
    const unsubDecisions = subscribeMeetingDecisions(homeroomUid, meetingId, setDecisions, (err) => {
      setError(formatMeetingError(err));
    });
    return () => { unsubNotes(); unsubDecisions(); };
  }, [homeroomUid, meetingId]);

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(buildShareUrl(homeroomUid, token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleAddDecision = async () => {
    if (!newDecision.trim() || !meeting) return;
    const student = meeting.studentSnapshot.find((s) => s.id === newDecisionStudent);
    await addMeetingDecision(homeroomUid, meetingId, {
      studentId: newDecisionStudent || undefined,
      studentName: student?.name,
      text: newDecision.trim(),
      authorName: homeroomName,
      authorRole,
    });
    setNewDecision('');
    setNewDecisionStudent('');
  };

  const handleExport = async () => {
    if (!meeting) return;
    setExporting(true);
    try {
      await exportPedagogicalMeetingToExcel(meeting, notes, decisions);
    } finally {
      setExporting(false);
    }
  };

  const getNote = (studentId: string, participantId: string) =>
    notes.find((n) => n.studentId === studentId && n.participantId === participantId)?.note ?? '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="max-w-lg mx-auto p-8 text-center space-y-4">
        <p className="text-red-600">{error ?? 'לא ניתן לטעון את הישיבה'}</p>
        <button type="button" onClick={onBack} className="px-5 py-2.5 rounded-xl bg-primary-600 text-white font-medium">
          חזרה לרשימה
        </button>
      </div>
    );
  }

  const participants = meeting.participants ?? [];
  const studentSnapshot = meeting.studentSnapshot ?? [];
  const submittedCount = participants.filter((p) => p.submittedAt || notes.some((n) => n.participantId === p.id && n.note.trim())).length;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-start gap-4">
        <button type="button" onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 shrink-0 mt-1">
          <ChevronRight size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-slate-800">{meeting.title}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {meeting.className} · {submittedCount}/{participants.length} מורים הגישו הערות
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={meeting.status}
            onChange={(e) => {
              const status = e.target.value as PedagogicalMeeting['status'];
              updateMeetingStatus(homeroomUid, meetingId, status);
              setMeeting({ ...meeting, status });
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium bg-white"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            ייצוא Excel
          </button>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 w-fit">
        {([
          { id: 'notes' as const, label: 'הערות מורים', icon: FileText },
          { id: 'decisions' as const, label: 'החלטות', icon: ClipboardList },
          { id: 'links' as const, label: 'קישורים', icon: Link2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'notes' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-primary-600 text-white">
                  <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-primary-600 min-w-[140px]">תלמיד</th>
                  <th className="px-3 py-3 text-center font-semibold min-w-[60px]">ממוצע</th>
                  <th className="px-3 py-3 text-center font-semibold min-w-[60px]">סיכון</th>
                  {participants.map((p) => (
                    <th key={p.id} className="px-3 py-3 text-right font-semibold min-w-[180px]">
                      <div>{p.subject}</div>
                      <div className="text-xs font-normal opacity-80">{p.teacherName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentSnapshot.map((student, i) => (
                  <tr key={student.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                    <td className="px-4 py-3 font-medium text-slate-800 sticky right-0 bg-inherit border-l border-slate-100">{student.name}</td>
                    <td className="px-3 py-3 text-center text-slate-600">{student.averageScore?.toFixed(1) ?? '–'}</td>
                    <td className="px-3 py-3 text-center">
                      {student.riskLevel === 'high' && <span className="text-red-600 font-medium">גבוה</span>}
                      {student.riskLevel === 'medium' && <span className="text-amber-600 font-medium">בינוני</span>}
                      {student.riskLevel === 'low' && <span className="text-green-600 font-medium">נמוך</span>}
                    </td>
                    {participants.map((p) => {
                      const note = getNote(student.id, p.id);
                      return (
                        <td key={p.id} className="px-3 py-3 text-slate-700 align-top">
                          {note ? (
                            <p className="whitespace-pre-wrap leading-relaxed">{note}</p>
                          ) : (
                            <span className="text-slate-300 italic text-xs">טרם נכתב</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'decisions' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3">הוספת החלטה / המלצה</h3>
            <div className="flex flex-wrap gap-3 mb-3">
              <select
                value={newDecisionStudent}
                onChange={(e) => setNewDecisionStudent(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="">כללי (כיתה)</option>
                {studentSnapshot.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select
                value={authorRole}
                onChange={(e) => setAuthorRole(e.target.value as 'homeroom' | 'coordinator')}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="homeroom">מחנך/ת</option>
                <option value="coordinator">רכז/ת</option>
              </select>
            </div>
            <textarea
              value={newDecision}
              onChange={(e) => setNewDecision(e.target.value)}
              rows={3}
              placeholder="כתוב/י החלטה או המלצה להמשך..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/30 resize-y mb-3"
            />
            <button
              type="button"
              onClick={handleAddDecision}
              disabled={!newDecision.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Plus size={18} />
              הוסף החלטה
            </button>
          </div>

          {decisions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
              טרם נרשמו החלטות. הוסף/י החלטות והמלצות בסיום הישיבה.
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.map((d) => (
                <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex gap-4">
                  <div className="flex-1">
                    {d.studentName && (
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium mb-2">
                        {d.studentName}
                      </span>
                    )}
                    {!d.studentName && (
                      <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium mb-2">כללי</span>
                    )}
                    <p className="text-slate-800 whitespace-pre-wrap">{d.text}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {d.authorName} · {d.authorRole === 'coordinator' ? 'רכז/ת' : 'מחנך/ת'} · {new Date(d.createdAt).toLocaleString('he-IL')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMeetingDecision(homeroomUid, meetingId, d.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 shrink-0 self-start"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 mb-4">
            שלח/י לכל מורה את הקישור האישי שלו. המורה יוכל למלא הערות על התלמידים ללא צורך בהתחברות.
          </p>
          {links.map((l) => {
            const hasNotes = notes.some((n) => n.participantId === l.participantId && n.note.trim());
            return (
              <div key={l.participantId} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <Users size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{l.teacherName}</p>
                  <p className="text-sm text-slate-500">{l.subject}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${hasNotes ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {hasNotes ? 'הגיש/ה' : 'ממתין/ה'}
                </span>
                <button
                  type="button"
                  onClick={() => copyLink(l.linkToken)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 text-primary-700 font-medium text-sm hover:bg-primary-100 shrink-0"
                >
                  {copiedToken === l.linkToken ? <Check size={16} /> : <Copy size={16} />}
                  {copiedToken === l.linkToken ? 'הועתק!' : 'העתק קישור'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MeetingView;
