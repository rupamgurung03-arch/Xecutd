/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Trade, TradeSide, PlaybookSetup, TradingRule, UserSettings } from './types/trade';
import { SupabaseAuthGate, type WelcomeKind } from './components/SupabaseAuthGate';
import { useSupabaseJournal } from './hooks/useSupabaseJournal';
import type { JournalSnapshot } from './types/journal';
import { calculateStats, generateEquityCurveData } from './utils/calculations';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { TradesLogView } from './components/TradesLogView';
import { CalendarView } from './components/CalendarView';
import { PlaybookView } from './components/PlaybookView';
import { AnalysisView } from './components/AnalysisView';
import { SettingsView } from './components/SettingsView';
import { AICoachView } from './components/AICoachView';
import { NewTradeModal } from './components/NewTradeModal';
import { TradeDetailModal } from './components/TradeDetailModal';

export default function App() {
  return <SupabaseAuthGate>{(userId, onSignOut, welcomeKind) => <JournalApp userId={userId} onSignOut={onSignOut} welcomeKind={welcomeKind} />}</SupabaseAuthGate>;
}

function JournalApp({ userId, onSignOut, welcomeKind }: { userId: string; onSignOut: () => Promise<void>; welcomeKind: WelcomeKind }) {
  const { journal, updateField, status, error: syncError, retry, ready } = useSupabaseJournal(userId);
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

  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Modal states
  const [isNewTradeOpen, setIsNewTradeOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [newTradeDefaults, setNewTradeDefaults] = useState<{ symbol?: string; side?: TradeSide }>({});
  const [newTradeOpenKey, setNewTradeOpenKey] = useState(0);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const openTradeForm = (defaults: { symbol?: string; side?: TradeSide } = {}) => {
    setEditingTrade(null);
    setNewTradeDefaults(defaults);
    setNewTradeOpenKey((key) => key + 1);
    setIsNewTradeOpen(true);
  };

  // Apply the account's saved appearance preference.
  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [settings.theme]);
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
    return <main className="flex min-h-screen items-center justify-center bg-background font-caption-mono text-caption-mono uppercase tracking-wider text-tertiary">Loading your journal from Supabase…</main>;
  }
  if (status === 'error' && !ready) {
    return <main className="flex min-h-screen items-center justify-center bg-background px-4 text-on-surface"><section className="w-full max-w-xl border border-outline-variant bg-surface-container-lowest p-6"><h1 className="font-headline-md text-headline-md font-semibold">Could not load your journal</h1><p className="mt-3 font-body-sm text-body-sm text-tertiary">{syncError || 'Check the Supabase journal table and your connection.'}</p><button type="button" onClick={retry} className="mt-5 bg-primary px-4 py-2 font-caption-mono text-caption-mono font-semibold uppercase text-on-primary">Retry</button></section></main>;
  }
  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-body-md antialiased selection:bg-secondary selection:text-white">
      
      {/* Universal Fixed Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenNewTrade={openTradeForm}
        settings={settings}
        setSettings={setSettings}
        trades={trades}
      />

      {/* Main Workspace Canvas with top padding for fixed header */}
      <main className="flex-1 w-full pt-16 pb-12 bg-background">
        <div className="w-full px-gutter-desktop py-space-lg">
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

          {currentTab === 'settings' && (
            <SettingsView
              settings={settings}
              setSettings={setSettings}
              trades={trades}
              onImportTrades={handleImportTrades}
              onSignOut={onSignOut}
            />
          )}

          {currentTab === 'coach' && (
            <AICoachView
              stats={stats}
              trades={trades}
            />
          )}
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
            <span>{trades.length} trades logged</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <NewTradeModal
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
      />

      <TradeDetailModal
        isOpen={!!selectedTrade}
        trade={selectedTrade}
        onClose={() => setSelectedTrade(null)}
        onEdit={handleEditTradeTrigger}
        onDelete={handleDeleteTrade}
        currency={settings.currency}
      />

    </div>
  );
}
