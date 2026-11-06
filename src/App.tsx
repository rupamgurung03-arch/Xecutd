/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import packageInfo from '../package.json';
import { Trade, TradeSide, PlaybookSetup, TradingRule, UserSettings } from './types/trade';
import { SupabaseAuthGate, type WelcomeKind } from './components/SupabaseAuthGate';
import { useSupabaseJournal } from './hooks/useSupabaseJournal';
import type { JournalSnapshot, RakuChatMessage, RakuChatSession } from './types/journal';
import { calculateStats, generateEquityCurveData } from './utils/calculations';
import { Header } from './components/Header';

const DashboardView = lazy(() => import('./components/DashboardView').then((module) => ({ default: module.DashboardView })));
const TradesLogView = lazy(() => import('./components/TradesLogView').then((module) => ({ default: module.TradesLogView })));
const CalendarView = lazy(() => import('./components/CalendarView').then((module) => ({ default: module.CalendarView })));
const PlaybookView = lazy(() => import('./components/PlaybookView').then((module) => ({ default: module.PlaybookView })));
const AnalysisView = lazy(() => import('./components/AnalysisView').then((module) => ({ default: module.AnalysisView })));
const SettingsView = lazy(() => import('./components/SettingsView').then((module) => ({ default: module.SettingsView })));
const AICoachView = lazy(() => import('./components/AICoachView').then((module) => ({ default: module.AICoachView })));
const PropFirmSimulatorView = lazy(() => import('./components/PropFirmSimulatorView').then((module) => ({ default: module.PropFirmSimulatorView })));
const NewTradeModal = lazy(() => import('./components/NewTradeModal').then((module) => ({ default: module.NewTradeModal })));
const TradeDetailModal = lazy(() => import('./components/TradeDetailModal').then((module) => ({ default: module.TradeDetailModal })));

export default function App() {
  return <SupabaseAuthGate>{(userId, onSignOut, welcomeKind, accountName, accountEmail) => <JournalApp userId={userId} onSignOut={onSignOut} welcomeKind={welcomeKind} accountName={accountName} accountEmail={accountEmail} />}</SupabaseAuthGate>;
}

function JournalApp({ userId, onSignOut, welcomeKind, accountName, accountEmail }: { userId: string; onSignOut: () => Promise<void>; welcomeKind: WelcomeKind; accountName: string; accountEmail: string }) {
  const { journal, updateField, status, error: syncError, retry, ready } = useSupabaseJournal(userId, accountName);
  const lastJournalActivityRef = useRef(Date.now());
  const settings = journal.settings;
  const trades = journal.trades;
  const playbooks = journal.playbooks;
  const rules = journal.rules;
  const setSettings: React.Dispatch<React.SetStateAction<UserSettings>> = (value) => updateField('settings', value);
  const setTrades: React.Dispatch<React.SetStateAction<Trade[]>> = (value) => updateField('trades', value);
  const setPlaybooks: React.Dispatch<React.SetStateAction<PlaybookSetup[]>> = (value) => updateField('playbooks', value);
  const setRules: React.Dispatch<React.SetStateAction<TradingRule[]>> = (value) => updateField('rules', value);
  const setAnalysisPages: React.Dispatch<React.SetStateAction<JournalSnapshot['analysisPages']>> = (value) => updateField('analysisPages', value);
  const setCustomMistakes: React.Dispatch<React.SetStateAction<string[]>> = (value) => updateField('customMistakes', value);
  const setCustomQualities: React.Dispatch<React.SetStateAction<string[]>> = (value) => updateField('customQualities', value);
  const setCustomGrades: React.Dispatch<React.SetStateAction<string[]>> = (value) => updateField('customGrades', value);
  const setRakuChatHistory = useCallback((history: RakuChatMessage[]) => updateField('rakuChatHistory', history), [updateField]);
  const setRakuChatSessions = useCallback((sessions: RakuChatSession[]) => updateField('rakuChatSessions', sessions), [updateField]);
  const getLastJournalActivityAt = useCallback(() => lastJournalActivityRef.current, []);

  useEffect(() => {
    const markJournalActivity = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-raku-chat-area]')) return;
      lastJournalActivityRef.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((eventName) => window.addEventListener(eventName, markJournalActivity, { passive: true }));
    return () => events.forEach((eventName) => window.removeEventListener(eventName, markJournalActivity));
  }, []);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [loadingTheme, setLoadingTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('xecutd_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const navigateToTab = (tab: string) => {
    setShowWelcome(false);
    setCurrentTab(tab);
  };

  const handlePageSwipeStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest('button, a, input, textarea, select, [role="button"], [contenteditable="true"], .overflow-x-auto, .mobile-nav-scroll, [data-no-page-swipe]')) {
      swipeStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handlePageSwipeEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    const swipeTabs = ['dashboard', 'trades', 'calendar', 'playbook', 'analysis', 'coach', 'settings'];
    const currentIndex = swipeTabs.indexOf(currentTab);
    if (currentIndex < 0) return;
    const nextIndex = deltaX < 0 ? Math.min(swipeTabs.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    if (nextIndex !== currentIndex) navigateToTab(swipeTabs[nextIndex]);
  };

  // Modal states
  const [isNewTradeOpen, setIsNewTradeOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [newTradeDefaults, setNewTradeDefaults] = useState<{ symbol?: string; side?: TradeSide }>({});
  const [newTradeOpenKey, setNewTradeOpenKey] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const openTradeForm = (defaults: { symbol?: string; side?: TradeSide } = {}) => {
    setShowWelcome(false);
    setEditingTrade(null);
    setNewTradeDefaults(defaults);
    setNewTradeOpenKey((key) => key + 1);
    setIsNewTradeOpen(true);
  };

  // Apply the account's saved appearance preference.
  useEffect(() => {
    const isDark = settings.theme === 'dark';
    if (!isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    const themeColor = isDark ? '#0a0a0a' : '#f5f5f7';
    let themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = themeColor;
  }, [settings.theme]);
  useEffect(() => {
    if (!ready) return;
    setLoadingTheme(settings.theme);
    try {
      localStorage.setItem('xecutd_theme', settings.theme);
    } catch {
      // The saved account preference still applies when browser storage is unavailable.
    }
  }, [ready, settings.theme]);
  // Derived statistics and curves
  const stats = useMemo(() => calculateStats(trades), [trades]);
  const equityData = useMemo(() => generateEquityCurveData(trades), [trades]);

  // Trade management handlers
  const handleSaveTrade = (trade: Trade) => {
    setTrades((prev) => {
      const index = prev.findIndex((t) => t.id === trade.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = trade;
        return updated;
      }
      return [trade, ...prev];
    });
    setEditingTrade(null);
  };

  const handleDeleteTrade = (tradeId: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== tradeId));
    if (selectedTrade?.id === tradeId) setSelectedTrade(null);
  };

  const handleEditTradeTrigger = (trade: Trade) => {
    setEditingTrade(trade);
    setNewTradeDefaults({});
    setNewTradeOpenKey((key) => key + 1);
    setIsNewTradeOpen(true);
  };

  // Playbook & Rules handlers
  const handleAddPlaybook = (setup: PlaybookSetup) => {
    setPlaybooks((prev) => [...prev, setup]);
  };

  const handleDeletePlaybook = (setupId: string) => {
    setPlaybooks((prev) => prev.filter((setup) => setup.id !== setupId));
  };

  const handleAddRule = (rule: TradingRule) => {
    setRules((prev) => [...prev, rule]);
  };

  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, active: !r.active } : r))
    );
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleImportTrades = (imported: Trade[]) => {
    setTrades(imported.map((trade) => ({ ...trade, tradeStatus: trade.tradeStatus ?? 'EXECUTED' })));
  };

  if (status === 'loading') {
    return <main className={`flex min-h-screen items-center justify-center bg-background ${loadingTheme === 'dark' ? 'dark' : ''}`} role="status" aria-live="polite"><span className="sr-only">Loading your journal</span><div aria-hidden="true" className="h-14 w-14 rounded-full border border-outline-variant bg-surface-container-lowest p-1 xecutd-login-loader"><img src="/icons/xecutd-logo.svg" alt="" className="h-full w-full rounded-full object-cover" /></div></main>;
  }
  if (status === 'error' && !ready) {
    return <main className="flex min-h-screen items-center justify-center bg-background px-4 text-on-surface"><section className="w-full max-w-xl border border-outline-variant bg-surface-container-lowest p-6"><h1 className="font-headline-md text-headline-md font-semibold">Could not load your journal</h1><p className="mt-3 font-body-sm text-body-sm text-tertiary">{syncError || 'Check the Supabase journal table and your connection.'}</p><button type="button" onClick={retry} className="mt-5 bg-primary px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase text-on-primary">Retry</button></section></main>;
  }
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body-md antialiased selection:bg-secondary selection:text-white">
      
      {/* Universal Fixed Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={navigateToTab}
        onOpenNewTrade={openTradeForm}
        settings={settings}
        setSettings={setSettings}
        trades={trades}
      />

      {/* Main Workspace Canvas with top padding for fixed header */}
      <main className="flex-1 w-full pt-24 lg:pt-16 pb-4 lg:pb-12 bg-background touch-pan-y" onTouchStart={handlePageSwipeStart} onTouchEnd={handlePageSwipeEnd} onTouchCancel={() => { swipeStartRef.current = null; }}>
        <div className="w-full px-3 py-1 sm:px-gutter-desktop sm:py-space-lg">
          <Suspense fallback={<div className="flex min-h-48 items-center justify-center font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">Loading journal section…</div>}>
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              trades={trades}
              equityData={equityData}
              currency={settings.currency}
              startingBalance={settings.accountBalance}
              onSelectTrade={(t) => setSelectedTrade(t)}
              onOpenNewTrade={openTradeForm}
              onNavigateToTrades={() => setCurrentTab('trades')}
              welcomeKind={welcomeKind}
              profileName={settings.traderName}
              showWelcome={showWelcome}
              onBeginUsing={() => setShowWelcome(false)}
            />
          )}

          {currentTab === 'trades' && (
            <TradesLogView
              trades={trades}
              currency={settings.currency}
              onSelectTrade={(t) => setSelectedTrade(t)}
              onDeleteTrade={handleDeleteTrade}
              onOpenNewTrade={openTradeForm}
            />
          )}

          {currentTab === 'calendar' && (
            <CalendarView
              trades={trades}
              currency={settings.currency}
              onSelectTrade={(t) => setSelectedTrade(t)}
            />
          )}

          {currentTab === 'playbook' && (
            <PlaybookView
              playbooks={playbooks}
              rules={rules}
              trades={trades}
              currency={settings.currency}
              onAddPlaybook={handleAddPlaybook}
              onDeletePlaybook={handleDeletePlaybook}
              onAddRule={handleAddRule}
              onToggleRule={handleToggleRule}
              onDeleteRule={handleDeleteRule}
            />
          )}

          {currentTab === 'analysis' && <AnalysisView pages={journal.analysisPages} setPages={setAnalysisPages} syncStatus={status} />}

          {currentTab === 'prop-firm' && <PropFirmSimulatorView
            trades={trades}
            currency={settings.currency}
            config={journal.propFirmSim}
            onConfigChange={(config) => updateField('propFirmSim', config)}
          />}

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              trades={trades}
              onImportTrades={handleImportTrades}
              onSignOut={onSignOut}
              accountEmail={accountEmail}
            />
          )}

          {currentTab === 'coach' && (
            <AICoachView
              stats={stats}
              trades={trades}
              chatHistory={journal.rakuChatHistory || []}
              onChatHistoryChange={setRakuChatHistory}
              chatSessions={journal.rakuChatSessions || []}
              onChatSessionsChange={setRakuChatSessions}
              getLastJournalActivityAt={getLastJournalActivityAt}
            />
          )}
          </Suspense>
        </div>
      </main>

      {/* Journal status footer */}
      <footer className="w-full bg-surface-container-lowest py-space-lg border-t border-outline-variant shadow-xs mt-auto">
        <div className="w-full px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-md text-caption-mono text-tertiary font-caption-mono">
          <div className="flex items-center gap-space-md flex-wrap">
            <span>XECUTD JOURNAL</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
              {status === 'saving' ? 'Syncing with Supabase' : status === 'saved' || status === 'ready' ? 'Connected to Supabase' : status === 'error' ? 'Supabase sync issue' : 'Loading journal'}
            </span>
            {status === 'error' && ready && <button type='button' onClick={retry} className='font-caption-mono text-[10px] underline underline-offset-4'>Retry sync</button>}
          </div>
          <div className="flex items-center gap-space-lg">
            <nav className="flex items-center gap-space-md" aria-label="Legal pages">
              <a href="/privacypolicy" className="hover:text-on-surface">Privacy</a>
              <a href="/termsofservice" className="hover:text-on-surface">Terms</a>
            </nav>
            <span>v{packageInfo.version}</span>
            <span>{trades.length} trades logged</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {isNewTradeOpen && <Suspense fallback={null}><NewTradeModal
        key={newTradeOpenKey}
        isOpen={isNewTradeOpen}
        onClose={() => {
          setIsNewTradeOpen(false);
          setEditingTrade(null);
          setNewTradeDefaults({});
        }}
        onSaveTrade={handleSaveTrade}
        settings={settings}
        editingTrade={editingTrade}
        initialSymbol={newTradeDefaults.symbol}
        initialSide={newTradeDefaults.side}
        strategyOptions={playbooks.map((setup) => setup.name)}
        customMistakes={journal.customMistakes}
        setCustomMistakes={setCustomMistakes}
        customQualities={journal.customQualities}
        setCustomQualities={setCustomQualities}
        customGrades={journal.customGrades}
        setCustomGrades={setCustomGrades}
      /></Suspense>}

      {selectedTrade && <Suspense fallback={null}><TradeDetailModal
        isOpen={!!selectedTrade}
        trade={selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onEdit={handleEditTradeTrigger}
        onDelete={handleDeleteTrade}
        currency={settings.currency}
      /></Suspense>}

    </div>
  );
}
