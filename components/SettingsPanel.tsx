import React, { useState, useEffect } from 'react';
import { RiskSettings, DEFAULT_RISK_SETTINGS } from '../types';
import { ArrowRight, Sliders } from 'lucide-react';

interface SettingsPanelProps {
  riskSettings: RiskSettings;
  onSave: (settings: RiskSettings) => void;
  onBack: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ riskSettings, onSave, onBack }) => {
  const [minGradeThreshold, setMinGradeThreshold] = useState(riskSettings.minGradeThreshold);
  const [maxNegativeBehaviors, setMaxNegativeBehaviors] = useState(riskSettings.maxNegativeBehaviors);
  const [attendanceThreshold, setAttendanceThreshold] = useState(riskSettings.attendanceThreshold);

  useEffect(() => {
    setMinGradeThreshold(riskSettings.minGradeThreshold);
    setMaxNegativeBehaviors(riskSettings.maxNegativeBehaviors);
    setAttendanceThreshold(riskSettings.attendanceThreshold);
  }, [riskSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      minGradeThreshold: Math.max(0, Math.min(100, minGradeThreshold)),
      maxNegativeBehaviors: Math.max(0, Math.min(100, maxNegativeBehaviors)),
      attendanceThreshold: Math.max(0, Math.min(100, attendanceThreshold)),
    });
  };

  const handleReset = () => {
    setMinGradeThreshold(DEFAULT_RISK_SETTINGS.minGradeThreshold);
    setMaxNegativeBehaviors(DEFAULT_RISK_SETTINGS.maxNegativeBehaviors);
    setAttendanceThreshold(DEFAULT_RISK_SETTINGS.attendanceThreshold);
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

      <div className="bg-white rounded-2xl shadow-card border border-slate-100/80 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 bg-gradient-to-br from-primary-50/50 to-white">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sliders size={22} className="text-primary-500" />
            הגדרות סיכון
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            הגדר מתי תלמיד ייחשב &quot;בסיכון&quot; לפי ציונים, אירועים שליליים וחיסורים.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
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
            <p className="text-xs text-slate-500 mt-1">ברירת מחדל: 55. ציון מתחת לסף זה מגדיל משמעותית את דירוג הסיכון.</p>
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
            <p className="text-xs text-slate-500 mt-1">ברירת מחדל: 5. מעל כמות זו התלמיד מקבל ניקוד סיכון גבוה יותר.</p>
          </div>

          <div>
            <label htmlFor="attendance" className="block text-sm font-bold text-slate-700 mb-2">
              סף חיסורים (מספר חיסורים מעליו נחשב בסיכון)
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
            <p className="text-xs text-slate-500 mt-1">ברירת מחדל: 4. חיסורים (ללא הצדקה) מעל מספר זה מגדילים את דירוג הסיכון.</p>
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
    </div>
  );
};

export default SettingsPanel;
