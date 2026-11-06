import React, { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Mail } from 'lucide-react';

type LegalDocument = 'privacy' | 'terms';

const privacySections = [
  {
    title: '1. Who we are and what this covers',
    paragraphs: [
      'Xecutd Journal ("Xecutd", "we", "us") provides a private trading journal and related review tools. This notice explains how information is handled when you use the Xecutd website and app.',
      'For privacy questions or requests, contact xecutddev03@gmail.com. This notice was last updated November 6, 2026.',
    ],
  },
  {
    title: '2. Information you provide',
    paragraphs: [
      'When you create an account or sign in, Supabase Authentication processes your email and account identifier. If you choose Google sign-in, Google handles that sign-in flow and shares basic account information needed to identify your account.',
      'Your journal may contain trade symbols, dates and times, direction, entry and exit details, risk, fees, results, sessions, strategy names, tags, psychology and execution selections, notes, links, screenshots, custom settings, analysis pages, and Raku chat history. Only enter information you are comfortable storing in your account.',
    ],
  },
  {
    title: '3. How information is stored',
    paragraphs: [
      'The app saves your journal to a Supabase database associated with your signed-in account. Row-level security policies restrict journal rows to their owner. Supabase also provides authentication and live sync between your signed-in devices.',
      'Your browser may keep your Supabase sign-in session, the selected theme, and any older local journal data that is available for optional import. The installable app caches app pages and static assets for loading; it does not cache the journal API responses for offline use.',
    ],
  },
  {
    title: '4. Raku and AI processing',
    paragraphs: [
      'If you use Raku, your prompt and the trade information needed for the requested review are sent to the authenticated Xecutd Cloudflare Worker. The Worker may send that request to the configured AI provider chain: Cloudflare Workers AI, Groq, Cerebras, SambaNova, Together AI, OpenRouter, or Google Gemini. Which provider receives a request depends on the deployment configuration and service availability.',
      'For journal summaries and chat, the Worker sends selected structured fields such as setup, asset class, side, R results, excursions, plan adherence, emotion, and mistake tags. To answer instrument-performance questions, it also sends aggregated results grouped by instrument name, including trade count, win rate, net P&L, and R-based performance. It does not send individual trade symbols or dates to the AI provider, or send prices, quantities, free-text journal notes, account details, and screenshot or link URLs. A single-trade AI review similarly sends a compact set of structured fields and omits those identifying or free-text fields. Your message to Raku is sent as written, so avoid including personal or confidential information in it.',
      'AI providers process requests under their own terms and privacy practices. Do not treat AI output as financial advice or as a guarantee of results.',
    ],
  },
  {
    title: '5. Other service providers',
    paragraphs: [
      'Cloudflare hosts the app and its server-side API. Supabase provides account authentication, database storage, and realtime sync. If the economic calendar feature is enabled, the server retrieves event data from FinanceCalendar; it does not include your journal entries in that calendar request. These providers process information to deliver the features you choose to use.',
    ],
  },
  {
    title: '6. Why we use information',
    paragraphs: [
      'We use account and journal information to authenticate you, save and sync your journal, display your analytics, generate requested AI reviews, provide the economic calendar where enabled, troubleshoot service issues, and protect the service from misuse. We do not sell or rent journal entries.',
    ],
  },
  {
    title: '7. Retention, export, and deletion',
    paragraphs: [
      'Your cloud journal remains associated with your account until it is deleted. You can delete individual trades in the app and export journal data from Settings. The app does not currently provide a self-service account deletion control. To request deletion of your account and associated journal data, email xecutddev03@gmail.com from the account email; we will respond to coordinate the request. Copies held by service providers may remain in backups for periods governed by their retention practices.',
      'You can clear local browser data through your browser settings. Doing so may remove the local sign-in session or older local journal data, but does not by itself delete the cloud journal.',
    ],
  },
  {
    title: '8. Security and transfers',
    paragraphs: [
      'We use account-scoped database access controls and authenticated server endpoints. Internet services and storage cannot be guaranteed completely secure. Our service providers may process information in locations outside your own; their processing is subject to their terms and applicable safeguards.',
    ],
  },
  {
    title: '9. Your choices and requests',
    paragraphs: [
      'You can choose what to record, use the export tools, avoid optional AI features, and contact us to request access, correction, or deletion help. We will handle requests under the laws that apply to the service and your location. Applicable privacy law may grant additional rights; for example, India’s Digital Personal Data Protection Act and Rules establish a framework for digital personal data processing, with commencement provisions that phase in over time.',
    ],
  },
  {
    title: '10. Changes and contact',
    paragraphs: [
      'We may update this notice as the app changes. We will update the date above when we publish a revision. For questions or privacy requests, contact xecutddev03@gmail.com.',
    ],
  },
];

const termsSections = [
  {
    title: '1. Agreement and the service',
    paragraphs: [
      'These Terms govern your use of Xecutd Journal ("Xecutd", "we", "us"). By using the app, you agree to these Terms. If you do not agree, do not use the service. Xecutd is a personal trading journal and review tool.',
      'Effective and last updated: November 6, 2026.',
    ],
  },
  {
    title: '2. Accounts',
    paragraphs: [
      'You are responsible for keeping your sign-in credentials secure and for activity performed through your account. Provide accurate account details, keep access to your email current, and tell us promptly if you suspect unauthorized access. Do not share your account with others or use another person’s account without permission.',
    ],
  },
  {
    title: '3. Your journal content',
    paragraphs: [
      'You retain your rights to the information and materials you add. You give us permission to host, store, back up, display, and process that content only as reasonably needed to operate the journal features you use, including synchronization, analytics, export, and any AI review you request.',
      'You are responsible for having the rights to upload any screenshots, links, notes, or other material you add. Do not upload someone else’s confidential information or material that is unlawful, harmful, or infringes another person’s rights.',
    ],
  },
  {
    title: '4. Trading and AI disclaimer',
    paragraphs: [
      'Xecutd is not a broker, investment adviser, financial planner, or trading venue. It does not place, route, or execute trades. Statistics, simulations, Raku responses, and other outputs are provided for record-keeping and educational purposes only; they may be incomplete or inaccurate and are not a recommendation to buy, sell, or hold any asset.',
      'Trading involves risk, including the possible loss of some or all capital. You are solely responsible for your trading decisions, risk controls, and verifying information before acting. Past results and simulated results do not guarantee future results.',
    ],
  },
  {
    title: '5. Acceptable use',
    paragraphs: [
      'Do not misuse the service, interfere with its operation, attempt to access another user’s data, probe or bypass security controls, upload malicious code, or use the service in violation of applicable law. Do not use Xecutd as a substitute for maintaining your own records or backups.',
    ],
  },
  {
    title: '6. Third-party services',
    paragraphs: [
      'Xecutd relies on third-party services such as Supabase, Cloudflare, AI providers, and (where enabled) FinanceCalendar. Their services may have separate terms and privacy practices. We are not responsible for third-party services or their availability. Use of Raku may transmit your prompt and selected structured journal information to the configured AI provider, as described in the Privacy Policy.',
    ],
  },
  {
    title: '7. Availability and changes',
    paragraphs: [
      'We may add, change, suspend, or discontinue features, and may temporarily limit access for maintenance or security. We aim to keep the service useful but do not promise uninterrupted availability, permanent storage, or that every feature will remain available.',
      'You can export your journal from Settings. You should keep your own copy of important records. We may update these Terms and will revise the date above when we publish changes. Continued use after an update means you accept the revised Terms, to the extent allowed by applicable law.',
    ],
  },
  {
    title: '8. Intellectual property',
    paragraphs: [
      'Xecutd and its interface, branding, and software are owned by their respective rights holders. These Terms do not transfer ownership of the service to you. We grant you a limited, personal, non-exclusive, non-transferable permission to use the service for its intended purpose while your account is in good standing.',
    ],
  },
  {
    title: '9. Suspension and termination',
    paragraphs: [
      'You may stop using Xecutd at any time. We may restrict or suspend access if reasonably necessary to protect users or the service, address a security issue, comply with law, or respond to a serious breach of these Terms. Contact xecutddev03@gmail.com to request account and journal deletion; the app does not currently offer self-service account deletion.',
    ],
  },
  {
    title: '10. Warranty and liability',
    paragraphs: [
      'To the extent permitted by law, the service is provided “as is” and “as available,” without warranties that it will be uninterrupted, error-free, or fit for a particular purpose. To the extent permitted by law, Xecutd will not be liable for indirect or consequential loss, lost profits, trading losses, or loss of data arising from use of the service. Nothing in these Terms excludes liability or rights that cannot legally be excluded or limited.',
    ],
  },
  {
    title: '11. Contact',
    paragraphs: [
      'Questions about these Terms or the service? Email xecutddev03@gmail.com.',
    ],
  },
];

export const LegalPage: React.FC<{ document: LegalDocument }> = ({ document }) => {
  const [dark] = useState(() => {
    try { return localStorage.getItem('xecutd_theme') === 'dark'; } catch { return false; }
  });
  const isPrivacy = document === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  const sections = isPrivacy ? privacySections : termsSections;
  const otherPath = isPrivacy ? '/termsofservice' : '/privacypolicy';
  const otherLabel = isPrivacy ? 'Terms of Service' : 'Privacy Policy';

  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen bg-background text-on-surface`}>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant py-4 sm:py-5">
          <a href="/" className="flex items-center gap-2.5 font-caption-mono text-sm font-bold tracking-widest text-on-surface" aria-label="Xecutd home">
            <span className="h-8 w-8 overflow-hidden rounded-full border border-outline-variant bg-black"><img src="/icons/xecutd-logo.svg" alt="" className="h-full w-full object-cover" /></span>
            XECUTD
          </a>
          <nav className="flex items-center gap-3 font-caption-mono text-[10px] uppercase sm:gap-5" aria-label="Legal pages">
            <a href="/privacypolicy" aria-current={isPrivacy ? 'page' : undefined} className={`hover:text-on-surface ${isPrivacy ? 'font-bold text-on-surface' : 'text-tertiary'}`}>Privacy</a>
            <a href="/termsofservice" aria-current={!isPrivacy ? 'page' : undefined} className={`hover:text-on-surface ${!isPrivacy ? 'font-bold text-on-surface' : 'text-tertiary'}`}>Terms</a>
            <a href="/journal" className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 font-bold text-on-primary">Open journal <ArrowUpRight size={13} /></a>
          </nav>
        </header>

        <main className="flex-1 py-9 sm:py-14">
          <a href="/" className="mb-6 inline-flex items-center gap-2 font-caption-mono text-[10px] uppercase tracking-wider text-tertiary hover:text-on-surface"><ArrowLeft size={14} /> Xecutd home</a>
          <div className="mb-8 border-b border-outline-variant pb-6 sm:mb-10 sm:pb-8">
            <p className="font-caption-mono text-[10px] uppercase tracking-[.18em] text-primary-container">Xecutd Journal · Legal</p>
            <h1 className="mt-3 font-headline-lg text-3xl font-bold tracking-tight text-on-surface sm:text-5xl">{title}</h1>
            <p className="mt-3 font-body-sm text-body-sm text-tertiary">Effective November 6, 2026</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
            <article className="min-w-0 space-y-8 sm:space-y-9">
              {sections.map((section) => (
                <section key={section.title} className="scroll-mt-8">
                  <h2 className="font-headline-md text-lg font-semibold text-on-surface sm:text-xl">{section.title}</h2>
                  <div className="mt-3 space-y-3 font-body-md text-sm leading-7 text-on-surface-variant sm:text-base">
                    {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  </div>
                </section>
              ))}
              <p className="border-t border-outline-variant pt-5 font-body-sm text-xs leading-6 text-tertiary">This page describes the current Xecutd product and is general information, not legal advice. Privacy and consumer laws vary by location and may change.</p>
            </article>

            <aside className="h-fit rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 lg:sticky lg:top-6">
              <p className="font-caption-mono text-[10px] uppercase tracking-widest text-tertiary">Need help?</p>
              <h2 className="mt-2 font-headline-md text-lg font-semibold">Contact Xecutd</h2>
              <p className="mt-2 font-body-sm text-sm leading-6 text-tertiary">Questions, privacy requests, or account deletion requests.</p>
              <a href="mailto:xecutddev03@gmail.com" className="mt-4 inline-flex items-center gap-2 font-body-sm text-sm font-semibold text-on-surface underline decoration-outline-variant underline-offset-4"><Mail size={15} /> xecutddev03@gmail.com</a>
              <a href={otherPath} className="mt-5 block border-t border-outline-variant pt-4 font-caption-mono text-[10px] uppercase tracking-wide text-tertiary hover:text-on-surface">Read {otherLabel} →</a>
            </aside>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant py-5 font-caption-mono text-[10px] text-tertiary">
          <span>© XECUTD JOURNAL</span>
          <a href="mailto:xecutddev03@gmail.com" className="hover:text-on-surface">xecutddev03@gmail.com</a>
        </footer>
      </div>
    </div>
  );
};
