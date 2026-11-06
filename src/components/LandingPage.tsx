import React from 'react';
import { ArrowRight, ArrowUpRight, BookOpenCheck, CalendarDays, ChartNoAxesCombined, CircleDot } from 'lucide-react';

const PreviewChart = () => (
  <svg viewBox="0 0 640 210" className="h-full w-full" role="img" aria-label="Illustrative equity curve">
    <defs><linearGradient id="landing-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e30613" stopOpacity=".16" /><stop offset="100%" stopColor="#e30613" stopOpacity="0" /></linearGradient></defs>
    {[40, 88, 136, 184].map((y) => <line key={y} x1="12" x2="628" y1={y} y2={y} stroke="currentColor" strokeOpacity=".08" />)}
    <path d="M12 172 L82 155 L145 163 L214 115 L280 126 L348 88 L410 102 L478 61 L544 71 L628 30 L628 198 L12 198 Z" fill="url(#landing-chart-fill)" />
    <path d="M12 172 L82 155 L145 163 L214 115 L280 126 L348 88 L410 102 L478 61 L544 71 L628 30" fill="none" stroke="#e30613" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    {[82, 214, 348, 478, 628].map((x, i) => <circle key={x} cx={x} cy={[155, 115, 88, 61, 30][i]} r="4" fill="var(--surface-container-lowest)" stroke="#e30613" strokeWidth="2" />)}
  </svg>
);

export const LandingPage: React.FC = () => (
  <main className="landing-page min-h-screen overflow-hidden bg-[#f6f6f4] text-[#151515]">
    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
      <header className="flex h-[76px] items-center justify-between border-b border-black/10">
        <a href="/" className="flex items-center gap-2.5 text-sm font-bold tracking-[0.1em]" aria-label="Xecutd home">
          <span className="h-8 w-8 overflow-hidden rounded-full border border-black/10 bg-black"><img src="/icons/xecutd-logo.svg" alt="" className="h-full w-full object-cover" /></span>
          <span>XECUTD</span>
        </a>
        <nav className="hidden items-center gap-8 text-sm text-black/55 md:flex"><a href="#features" className="hover:text-black">What you can track</a><a href="#preview" className="hover:text-black">Preview</a></nav>
        <a href="/journal" className="inline-flex items-center gap-2 rounded-full bg-[#151515] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#333]">Open journal <ArrowUpRight size={15} /></a>
      </header>

      <section className="grid items-center gap-12 pb-14 pt-14 md:grid-cols-[0.82fr_1.18fr] md:gap-10 md:pb-20 md:pt-20">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-black/55"><CircleDot size={12} className="text-[#e30613]" /> A calmer way to review your trades</div>
          <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.98] tracking-[-0.065em] sm:text-6xl lg:text-[4.6rem]">Trade the plan.<br /><span className="text-black/40">Learn from</span><br />the rest.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-black/60">A clean trading journal for the decisions behind every trade. Log your execution, review your process, and spot the patterns worth keeping.</p>
          <div className="mt-8 flex flex-wrap items-center gap-4"><a href="/journal" className="inline-flex items-center gap-2 rounded-full bg-[#e30613] px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(227,6,19,.16)] transition hover:bg-[#bf0711]">Open the journal <ArrowRight size={16} /></a><a href="#features" className="px-2 py-3 text-sm font-medium text-black/55 hover:text-black">Take a look around</a></div>
          <div className="mt-10 flex items-center gap-3 text-xs text-black/45"><span className="flex -space-x-2"><span className="h-7 w-7 rounded-full border-2 border-[#f6f6f4] bg-[#d9d9d5]" /><span className="h-7 w-7 rounded-full border-2 border-[#f6f6f4] bg-[#c8c8c3]" /><span className="h-7 w-7 rounded-full border-2 border-[#f6f6f4] bg-[#b8b8b2]" /></span><span>Built for honest reviews, not perfect screenshots.</span></div>
        </div>

        <div id="preview" className="relative min-w-0">
          <div className="absolute -right-10 -top-12 h-56 w-56 rounded-full bg-[#e30613]/[0.06] blur-3xl" />
          <div className="relative rotate-[1deg] rounded-[26px] border border-black/10 bg-white p-2 shadow-[0_30px_90px_rgba(25,25,25,.12)] sm:p-3">
            <div className="overflow-hidden rounded-[19px] border border-black/[0.06] bg-[#fafaf9]">
              <div className="flex h-12 items-center justify-between border-b border-black/[0.07] px-4 sm:px-5">
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.1em]"><span className="h-2 w-2 rounded-full bg-[#e30613]" /> XECUTD <span className="font-normal text-black/40">/ JOURNAL</span></div>
                <div className="hidden items-center gap-4 font-mono text-[9px] tracking-wider text-black/40 sm:flex"><span className="text-black">OVERVIEW</span><span>TRADES</span><span>CALENDAR</span></div>
                <div className="rounded-full bg-[#151515] px-3 py-1 font-mono text-[9px] tracking-wider text-white">SAMPLE</div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="mb-5 flex items-end justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-black/40">Your journal</p><h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">Session overview</h2></div><div className="hidden rounded-full border border-black/10 bg-white px-3 py-1.5 font-mono text-[9px] text-black/45 sm:block">LAST 30 DAYS</div></div>
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-xl border border-black/[0.07] bg-white p-3 sm:p-4"><p className="font-mono text-[8px] tracking-widest text-black/40">NET RESULT</p><p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">+8.4<span className="ml-1 text-sm font-medium text-black/40">R</span></p><p className="mt-1 text-[9px] text-black/40">Closed trades</p></div>
                  <div className="rounded-xl border border-black/[0.07] bg-white p-3 sm:p-4"><p className="font-mono text-[8px] tracking-widest text-black/40">WIN RATE</p><p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">64<span className="text-sm font-medium text-black/40">%</span></p><p className="mt-1 text-[9px] text-black/40">Across 25 trades</p></div>
                  <div className="rounded-xl border border-black/[0.07] bg-white p-3 sm:p-4"><p className="font-mono text-[8px] tracking-widest text-black/40">PLAN FOLLOWED</p><p className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">88<span className="text-sm font-medium text-black/40">%</span></p><p className="mt-1 text-[9px] text-black/40">Process score</p></div>
                </div>
                <div className="mt-3 rounded-xl border border-black/[0.07] bg-white p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><div><p className="font-mono text-[8px] tracking-widest text-black/40">EQUITY CURVE</p><p className="mt-1 text-sm font-semibold">Steady progress</p></div><span className="rounded-full bg-[#fcebed] px-2.5 py-1 font-mono text-[9px] text-[#c8101b]">+8.4R</span></div><div className="h-32 text-black/20 sm:h-40"><PreviewChart /></div><div className="mt-2 flex justify-between font-mono text-[8px] text-black/35"><span>WEEK 01</span><span>WEEK 02</span><span>WEEK 03</span><span>WEEK 04</span></div></div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#151515] px-4 py-3 text-white"><div><p className="font-mono text-[8px] tracking-widest text-white/45">PROCESS OVER PREDICTION</p><p className="mt-1 text-xs font-medium">Keep the review simple. Keep the edge yours.</p></div><ChartNoAxesCombined className="text-white/55" size={19} /></div>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-5 hidden rounded-2xl border border-black/10 bg-white p-3 shadow-lg sm:block"><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fcebed] text-[#c8101b]"><CalendarDays size={16} /></span><div><p className="font-mono text-[8px] uppercase tracking-widest text-black/40">Review by day</p><p className="text-xs font-semibold">Patterns, at a glance</p></div></div></div>
        </div>
      </section>

      <section id="features" className="border-t border-black/10 py-12 md:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-black/40">A journal, not another chart terminal</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">Make the review count.</h2></div><a href="/journal" className="inline-flex items-center gap-2 text-sm font-semibold text-black/65 hover:text-black">Explore the journal <ArrowUpRight size={15} /></a></div>
        <div className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-black/10 bg-white/70 p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fcebed] text-[#c8101b]"><BookOpenCheck size={17} /></span><h3 className="mt-5 font-semibold">Log the why</h3><p className="mt-2 text-sm leading-6 text-black/55">Capture setup, execution, mindset, screenshots, and the notes you’ll want next time.</p></article>
          <article className="rounded-2xl border border-black/10 bg-white/70 p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fcebed] text-[#c8101b]"><CalendarDays size={17} /></span><h3 className="mt-5 font-semibold">See the rhythm</h3><p className="mt-2 text-sm leading-6 text-black/55">Review results by day and find the sessions where your process feels strongest.</p></article>
          <article className="rounded-2xl border border-black/10 bg-white/70 p-5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fcebed] text-[#c8101b]"><ChartNoAxesCombined size={17} /></span><h3 className="mt-5 font-semibold">Learn from your data</h3><p className="mt-2 text-sm leading-6 text-black/55">Follow equity, risk, and execution trends without burying the useful details.</p></article>
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 py-6 text-xs text-black/40"><span className="font-mono tracking-wider">XECUTD JOURNAL</span><span>A place to study your process.</span><nav className="flex flex-wrap items-center gap-4" aria-label="Legal and app links"><a href="/privacypolicy" className="hover:text-black">Privacy Policy</a><a href="/termsofservice" className="hover:text-black">Terms of Service</a><a href="/journal" className="font-semibold text-black/65 hover:text-black">Open journal →</a></nav></footer>
    </div>
  </main>
);
