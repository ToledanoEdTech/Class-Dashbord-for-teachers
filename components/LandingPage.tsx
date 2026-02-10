import React, { useState, useEffect } from 'react';
import { BarChart2, FileText, FileSpreadsheet, TrendingUp, ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react';
import { FileIcons } from '../constants/icons';

const BRAND_NAME = 'ToledanoEdTech';
const BRAND_TAGLINE = 'מערכת מעקב פדגוגית';

const LOGO_PATH = '/logo.png';

interface LandingPageProps {
  onStart: () => void;
}

const LandingLogo: React.FC = () => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <FileIcons.LogoFallback className="w-20 h-20 text-primary-500" strokeWidth={2} />;
  }
  return (
    <img
      src={LOGO_PATH}
      alt={`לוגו ${BRAND_NAME}`}
      className="w-full h-full object-contain p-2"
      onError={() => setFailed(true)}
    />
  );
};

interface PreviewImage {
  src: string;
  label: string;
}

const PreviewCarousel: React.FC<{ images: PreviewImage[] }> = ({ images }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length]);

  const goNext = () => setActiveIndex((i) => (i + 1) % images.length);
  const goPrev = () => setActiveIndex((i) => (i - 1 + images.length) % images.length);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-elevated bg-slate-50 ring-1 ring-slate-100">
      <div className="aspect-video max-h-[320px] md:max-h-[420px] bg-white relative">
        {images.map((img, i) => (
          <div
            key={img.src}
            className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
              i === activeIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              src={img.src}
              alt={img.label}
              className="w-full h-full object-contain object-center"
            />
          </div>
        ))}
        {/* כפתורי ניווט */}
        <button
          type="button"
          onClick={goPrev}
          aria-label="הקודם"
          className="absolute top-1/2 right-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ChevronRight size={22} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="הבא"
          className="absolute top-1/2 left-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 py-3 px-4 bg-white border-t border-slate-100">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              i === activeIndex
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            {img.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center px-4 py-6 md:py-10">
      <div className="w-full max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-8 md:mb-10 animate-slide-up">
          <div className="inline-flex items-center justify-center w-28 h-28 md:w-36 md:h-36 rounded-2xl bg-white shadow-elevated border border-slate-200/80 overflow-hidden mb-4 ring-2 ring-primary-100/80">
            <LandingLogo />
          </div>
          <h1 className="font-display font-bold text-2xl md:text-3xl text-slate-800 tracking-tight">
            {BRAND_NAME}
          </h1>
          <p className="text-primary-600 font-semibold text-base md:text-lg mt-1">
            {BRAND_TAGLINE}
          </p>
          <p className="text-slate-600 text-sm md:text-base max-w-xl mx-auto mt-3 leading-relaxed">
            דשבורד חכם לניתוח פדגוגי של הכיתה – ציונים, התנהגות ותובנות במבט אחד
          </p>
        </div>

        {/* Visual Preview - צילומי מסך מהמערכת */}
        <div className="mb-8 md:mb-10 animate-slide-up" style={{ animationDelay: '0.05s' }}>
          <PreviewCarousel
            images={[
              { src: '/dashboard-preview.png', label: 'דשבורד כיתתי' },
              { src: '/heatmap-preview.png', label: 'מפת חום' },
              { src: '/student-profile-preview.png', label: 'פרופיל תלמיד' },
            ]}
          />
        </div>

        {/* What / Upload / Get */}
        <div className="grid gap-4 md:grid-cols-3 mb-8 md:mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center mb-3">
              <BarChart2 size={22} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-1.5">מה המערכת עושה</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              מנתחת אוטומטית ציונים ואירועי התנהגות, מזהה מגמות, סיכונים וקשרים בין התנהגות לציונים.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <FileText size={20} className="ml-1" />
              <FileSpreadsheet size={20} className="-ml-1" />
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-1.5">מה צריך להעלות</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              <strong>קובץ התנהגות:</strong> יומן מחנך → דוחות → פירוט אירועי התנהגות.
              <br />
              <strong>קובץ ציונים:</strong> מערכת הציונים → ציונים שוטפים - סדין.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <TrendingUp size={22} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-slate-800 text-sm mb-1.5">מה מקבלים</h3>
            <p className="text-slate-600 text-xs leading-relaxed">
              דשבורד כיתתי, מפת חום, פרופיל תלמיד מפורט, אנליטיקת מורים, מטריצת מקצועות וייצוא לאקסל.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center animate-slide-up" style={{ animationDelay: '0.15s' }}>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-base md:text-lg bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <ArrowLeft size={24} className="rtl:rotate-180" strokeWidth={2.5} />
            התחל – העלאת קבצים
          </button>
          <p className="text-slate-500 text-xs mt-3">
            אין לך קבצים? אפשר לטעון נתוני דוגמה בשלב הבא
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
