import React, { useEffect } from 'react';
import { ArrowRight, X } from 'lucide-react';

interface FirstVisitPopupProps {
  onClose: () => void;
}

export const FirstVisitPopup: React.FC<FirstVisitPopupProps> = ({ onClose }) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm dark:bg-black/75"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-visit-title"
        className="relative my-auto w-full max-w-lg border border-outline-variant bg-surface-container-lowest p-6 text-on-surface shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center border border-outline-variant text-tertiary transition-colors hover:bg-surface-container-low hover:text-on-surface"
          aria-label="Close welcome message"
        >
          <X size={17} />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <span className="h-10 w-10 overflow-hidden rounded-full border border-outline-variant bg-black">
            <img src="/icons/xecutd-logo.svg" alt="" className="h-full w-full object-cover" />
          </span>
          <div>
            <p className="font-caption-mono text-[10px] uppercase tracking-[.18em] text-tertiary">A note from the dev</p>
            <p className="mt-1 flex items-center gap-2 font-caption-mono text-[10px] font-bold uppercase tracking-widest text-on-surface"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Xecutd Journal</p>
          </div>
        </div>

        <h1 id="first-visit-title" className="font-headline-lg text-2xl font-semibold tracking-tight sm:text-3xl">Hey, thanks for stopping by!</h1>
        <div className="mt-4 space-y-4 font-body-md text-sm leading-6 text-on-surface-variant sm:text-base sm:leading-7">
          <p>I built Xecutd to give us a user-friendly space to track trades and protect our risk. Unfortunately, it’s a passion project, so I couldn’t add a real-time broker connection. Maybe I will in the future.</p>
          <p>Take a look around, test out Raku, and make yourself at home. If anything breaks or you have ideas, hit me up anytime at <a href="mailto:xecutddev03@gmail.com" className="font-semibold text-on-surface underline decoration-primary underline-offset-4">xecutddev03@gmail.com</a>.</p>
        </div>

        <div className="mt-6 border-l-2 border-primary pl-3">
          <p className="font-body-md text-sm font-semibold text-on-surface">Trade well and stay disciplined!</p>
          <p className="mt-1 font-caption-mono text-[10px] uppercase tracking-widest text-tertiary">— Dev</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3 font-caption-mono text-xs font-bold uppercase tracking-wider text-on-primary transition-opacity hover:opacity-90"
        >
          Let’s get started <ArrowRight size={15} />
        </button>
      </section>
    </div>
  );
};
