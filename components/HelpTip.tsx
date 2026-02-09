import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

const HelpTip: React.FC<{ text: string }> = ({ text }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const updatePos = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPos({ top: rect.top - 8, left: rect.right });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [show]);

  return (
    <span ref={wrapperRef} className="relative inline-flex items-center mr-1">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex items-center justify-center cursor-help focus:outline-none"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((v) => !v)}
        aria-label="עזרה"
      >
        <HelpCircle size={14} className="text-slate-400 hover:text-primary-500 transition-colors" />
      </button>
      {show && pos && (
        <span
          className="fixed px-3 py-2.5 bg-slate-800 text-white text-xs leading-relaxed rounded-lg z-[9999] w-64 text-right shadow-lg animate-fade-in"
          style={{ top: pos.top, left: pos.left, transform: 'translate(-100%, -100%)' }}
        >
          {text}
        </span>
      )}
    </span>
  );
};

export default HelpTip;
