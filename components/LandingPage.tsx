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
    <div className="relative rounded-xl overflow-hidden border border-slate-200/80 shadow-elevated bg-slate-50 ring-1 ring-slate-100 w-full mx-auto h-full">
      <div className="w-full h-full bg-white relative">
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
          <ChevronRight size={20} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="הבא"
          className="absolute top-1/2 left-2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/90 hover:bg-white shadow-lg border border-slate-200/80 flex items-center justify-center text-slate-600 hover:text-primary-600 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 py-2 px-4 bg-white border-t border-slate-100">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
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
    <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-2 overflow-hidden">
      <div className="w-full flex flex-col h-full justify-between">
        {/* Hero - Compact */}
        <div className="text-center mb-1 animate-slide-up flex-shrink-0">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl bg-white shadow-elevated border border-slate-200/80 overflow-hidden mb-1 ring-2 ring-primary-100/80">
            <LandingLogo />
          </div>
          <h1 className="font-display font-bold text-lg md:text-xl text-slate-800 tracking-tight">
            {BRAND_NAME}
          </h1>
          <p className="text-primary-600 font-semibold text-xs md:text-sm mt-0.5">
            {BRAND_TAGLINE}
          </p>
          <p className="text-slate-600 text-[10px] md:text-xs max-w-xl mx-auto mt-1 leading-tight">
            דשבורד חכם לניתוח פדגוגי של הכיתה – ציונים, התנהגות ותובנות במבט אחד
          </p>
        </div>

        {/* Visual Preview - Centered and Large */}
        <div className="flex-1 flex items-center justify-center min-h-0 mb-1 animate-slide-up w-full" style={{ animationDelay: '0.05s' }}>
          <div className="w-full max-w-5xl h-full">
            <PreviewCarousel
              images={[
                { src: '/dashboard-preview.png', label: 'דשבורד כיתתי' },
                { src: '/heatmap-preview.png', label: 'מטריצות' },
                { src: '/student-profile-preview.png', label: 'פרופיל תלמיד' },
              ]}
            />
          </div>
        </div>

        {/* What / Upload / Get - Compact */}
        <div className="grid gap-1 md:grid-cols-3 mb-1 animate-slide-up flex-shrink-0" style={{ animationDelay: '0.1s' }}>
          <div className="bg-white rounded-lg border border-slate-100 p-2 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-7 h-7 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center mb-1">
              <BarChart2 size={16} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-slate-800 text-xs mb-0.5">מה המערכת עושה</h3>
            <p className="text-slate-600 text-[10px] leading-tight">
              מנתחת אוטומטית ציונים ואירועי התנהגות, מזהה מגמות, סיכונים וקשרים בין התנהגות לציונים.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-100 p-2 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
              <FileText size={14} className="ml-0.5" />
              <FileSpreadsheet size={14} className="-ml-0.5" />
            </div>
            <h3 className="font-bold text-slate-800 text-xs mb-0.5">מה צריך להעלות</h3>
            <p className="text-slate-600 text-[10px] leading-tight">
              <strong>קובץ התנהגות:</strong> יומן מחנך → דוחות → פירוט אירועי התנהגות.
              <br />
              <strong>קובץ ציונים:</strong> מערכת הציונים → ציונים שוטפים - סדין.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-100 p-2 shadow-card hover:shadow-card-hover transition-shadow">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
              <TrendingUp size={16} strokeWidth={2} />
            </div>
            <h3 className="font-bold text-slate-800 text-xs mb-0.5">מה מקבלים</h3>
            <p className="text-slate-600 text-[10px] leading-tight">
              דשבורד כיתתי, מפת חום, פרופיל תלמיד מפורט, אנליטיקת מורים, מטריצת מקצועות וייצוא לאקסל.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center animate-slide-up flex-shrink-0" style={{ animationDelay: '0.15s' }}>
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm md:text-base bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg shadow-primary-500/30 hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <ArrowLeft size={20} className="rtl:rotate-180" strokeWidth={2.5} />
            התחל – העלאת קבצים
          </button>
          <p className="text-slate-500 text-[10px] mt-1">
            אין לך קבצים? אפשר לטעון נתוני דוגמה בשלב הבא
          </p>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
