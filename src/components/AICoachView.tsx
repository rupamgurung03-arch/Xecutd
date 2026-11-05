import React, { useEffect, useState } from 'react';
import { Trade, TradeStats } from '../types/trade';
import type { RakuChatMessage } from '../types/journal';
import { getJournalAuthHeaders } from '../lib/supabaseClient';
import { getTradeExcursionDisplay } from '../utils/tradeAnalyticsEngine';

interface AICoachViewProps {
  stats: TradeStats;
  trades: Trade[];
  chatHistory: RakuChatMessage[];
  onChatHistoryChange: (history: RakuChatMessage[]) => void;
}

export const AICoachView: React.FC<AICoachViewProps> = ({ stats, trades, chatHistory, onChatHistoryChange }) => {
  const [reviewScope, setReviewScope] = useState<'overall' | 'last-week' | 'last-month' | 'month' | 'custom'>('overall');
  const [reviewMonth, setReviewMonth] = useState(new Date().toISOString().slice(0, 7));
  const [customStart, setCustomStart] = useState(new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState(new Date().toISOString().slice(0, 10));
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [auditMode, setAuditMode] = useState<string | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [chatMessages, setChatMessages] = useState<RakuChatMessage[]>(chatHistory);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (chatMessages.length) onChatHistoryChange(chatMessages);
  }, [chatMessages, onChatHistoryChange]);

  const welcomeMessage: RakuChatMessage = {
    id: 'welcome',
    sender: 'coach',
    text: `I’m Raku. I can help review the ${trades.length} trades in your journal. Ask about your results, setups, or plan-following patterns.`,
    timestamp: 'READY',
  };
  const visibleChatMessages = chatMessages.length ? chatMessages : [welcomeMessage];

  const getBuddyScope = () => {
    if (reviewScope === 'overall') return { type: 'overall' as const };
    if (reviewScope === 'month') return { type: 'month' as const, month: reviewMonth };
    const today = new Date();
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (reviewScope === 'custom') return { type: 'custom' as const, startDate: customStart, endDate: customEnd };
    const days = reviewScope === 'last-week' ? 7 : 30;
    return { type: 'custom' as const, startDate: dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))), endDate: dateKey(today) };
  };

  // Send only fields needed by the authenticated Worker aggregator. No IDs, dollars, prices, notes, or attachments.
  const getBuddyRecords = (scope: ReturnType<typeof getBuddyScope>) => {
    const previousMonth = scope.type === 'month' ? (() => {
      const [year, month] = scope.month.split('-').map(Number);
      const date = new Date(year, month - 2, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    })() : '';
    return trades.filter((trade) => {
      if (trade.tradeStatus === 'MISSED' || trade.status !== 'Closed') return false;
      if (scope.type === 'overall') return true;
      if (scope.type === 'month') return trade.entryDate.startsWith(scope.month) || trade.entryDate.startsWith(previousMonth);
      return trade.entryDate >= scope.startDate && trade.entryDate <= scope.endDate;
    }).map((trade) => {
      const excursion = getTradeExcursionDisplay(trade);
      return {
        status: trade.status, tradeStatus: trade.tradeStatus, entryDate: trade.entryDate, entryTime: trade.entryTime,
        side: trade.side, setup: trade.setup, session: trade.session, plannedR: trade.plannedR, realizedR: trade.realizedR,
        mfeR: excursion.mfeR, maeR: excursion.maeR, rulesFollowed: trade.rulesFollowed,
        disciplineScore: trade.disciplineScore, mistakes: trade.mistakes, psychologyTags: trade.psychologyTags, emotion: trade.emotion,
      };
    });
  };

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      const scope = getBuddyScope();
      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        headers: await getJournalAuthHeaders(),
        body: JSON.stringify({ scope, trades: getBuddyRecords(scope) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Raku service returned HTTP ${res.status}.`);
      setAuditReport(data.analysis || 'Analysis complete.');
      setAuditMode(data.mode || 'heuristic');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown connection error.';
      setAuditReport(`Raku could not complete the review: ${reason}\n\nYour journal currently has ${stats.closedTrades} closed trades and a ${stats.winRate}% win rate.`);
      setAuditMode('heuristic');
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const query = customText || inputMessage;
    if (!query.trim() || isSending) return;

    const userMsg: RakuChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...(prev.length ? prev : [welcomeMessage]), userMsg]);
    if (!customText) setInputMessage('');
    setIsSending(true);

    try {
      const scope = getBuddyScope();
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: await getJournalAuthHeaders(),
        body: JSON.stringify({
          message: query,
          scope,
          trades: getBuddyRecords(scope),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Raku service returned HTTP ${res.status}.`);
      if (!data.reply) throw new Error('The AI endpoint returned no reply. Check the Worker API deployment and runtime settings.');
      const botMsg: RakuChatMessage = {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text: data.reply || 'Analysis received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: data.sources || [],
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown connection error.';
      const botMsg: RakuChatMessage = {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text: `Raku couldn't complete that request: ${reason}\n\nYour journal has ${stats.closedTrades} closed trades and a ${stats.winRate}% win rate.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 sm:gap-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-caption-mono font-caption-mono text-tertiary">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-sm"></span>
            <span>RAKU</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface uppercase font-bold">
            Raku, your trading coach
          </h1>
          <p className="font-body-md text-body-md text-tertiary">
            Review your logged trades, setups, and plan-following patterns.
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="buddy-review-scope" className="font-caption-mono text-[11px] uppercase text-tertiary">Review period</label>
            <select id="buddy-review-scope" value={reviewScope} onChange={(e) => setReviewScope(e.target.value as typeof reviewScope)} className="bg-surface-container-lowest px-3 py-2 rounded-lg border border-outline-variant font-caption-mono text-[11px] text-on-surface">
              <option value="overall">Overall</option>
              <option value="last-week">Last 7 days</option>
              <option value="last-month">Last 30 days</option>
              <option value="month">Choose a month</option>
              <option value="custom">Custom date range</option>
            </select>
            {reviewScope === 'month' && <input aria-label="Choose month" type="month" value={reviewMonth} onChange={(e) => setReviewMonth(e.target.value)} className="bg-surface-container-lowest px-2 py-2 rounded-lg border border-outline-variant font-caption-mono text-[11px] text-on-surface" />}
            {reviewScope === 'custom' && <div className="flex gap-2"><input aria-label="Start date" type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} className="min-w-0 bg-surface-container-lowest px-2 py-2 rounded-lg border border-outline-variant font-caption-mono text-[11px] text-on-surface" /><input aria-label="End date" type="date" value={customEnd} min={customStart} onChange={(e) => setCustomEnd(e.target.value)} className="min-w-0 bg-surface-container-lowest px-2 py-2 rounded-lg border border-outline-variant font-caption-mono text-[11px] text-on-surface" /></div>}
          </div>
          <button
            onClick={handleRunAudit}
            disabled={isRunningAudit || (reviewScope === 'custom' && (!customStart || !customEnd || customStart > customEnd))}
            className="flex items-center justify-center gap-2 bg-on-surface text-surface-container-lowest hover:opacity-90 px-6 py-2.5 rounded-full transition-transform active:scale-95 shadow-sm font-caption-mono text-caption-mono uppercase font-bold cursor-pointer disabled:opacity-50"
          >
            <span className="w-2 h-2 rounded-full bg-primary-container"></span>
            <span>{isRunningAudit ? 'Reviewing trades…' : 'Generate review'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 12 Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-6 items-start">
        
        {/* Left: Audit Report & Metrics (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-3 sm:gap-6">
          
          {/* Quick Metrics pod */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-outline-variant flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">
                Journal metrics
              </span>
              <span className="font-caption-mono text-caption-mono px-2.5 py-0.5 rounded-full bg-surface-container-low border border-outline-variant text-on-surface font-semibold">
                {trades.length} TRADES
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 font-caption-mono text-caption-mono">
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 flex flex-col">
                <span className="text-[11px] text-tertiary uppercase">PROFIT FACTOR</span>
                <span className="text-on-surface font-numeric-stat text-body-lg font-bold">
                  {stats.grossLoss > 0 ? stats.profitFactor.toFixed(2) : stats.grossProfit > 0 ? '∞' : '—'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/60 flex flex-col">
                <span className="text-[11px] text-tertiary uppercase">RULES ADHERENCE</span>
                <span className="text-on-surface font-numeric-stat text-body-lg font-bold">
                  {stats.rulesCompliance.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* Audit Report card */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-outline-variant flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2 font-caption-mono text-[11px] text-tertiary uppercase font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                <span>SYSTEM PERFORMANCE AUDIT</span>
              </div>
              {auditMode && (
                <span className="font-caption-mono text-caption-mono text-secondary font-bold uppercase">
                  {auditMode === 'edge-engine' || auditMode === 'heuristic' ? 'LOCAL REVIEW' : `${auditMode.replaceAll('-', ' ')} REVIEW`}
                </span>
              )}
            </div>

            {auditReport ? (
              <div className="font-caption-mono text-caption-mono text-on-surface whitespace-pre-line leading-relaxed max-h-[460px] overflow-y-auto pr-1">
                {auditReport}
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-center gap-3">
                <span className="material-symbols-outlined text-display text-tertiary/40">
                  psychology
                </span>
                <p className="font-caption-mono text-caption-mono text-tertiary max-w-xs">
                  Run a system audit to generate a comprehensive breakdown of your edge and leakages.
                </p>
                <button
                  onClick={handleRunAudit}
                  className="px-4 py-2 rounded-full bg-surface-container-low hover:bg-surface-container text-caption-mono text-caption-mono text-on-surface font-semibold transition-colors cursor-pointer border border-outline-variant"
                >
                  Generate Audit Now
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right: Interactive Terminal Chat (7 cols) */}
        <div className="xl:col-span-7 bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant flex flex-col h-[650px] overflow-hidden">
          
          {/* Terminal header */}
          <div className="px-6 py-4 bg-surface-container-low flex items-center justify-between border-b border-outline-variant shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-sm"></span>
              <span className="font-caption-mono text-body-sm font-bold text-on-surface uppercase tracking-wider">
                RAKU INTERACTION CONSOLE
              </span>
            </div>
            <span className="font-caption-mono text-caption-mono text-tertiary">
              {trades.length} logged trades
            </span>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
            {visibleChatMessages.map((msg) => {
              const isCoach = msg.sender === 'coach';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    isCoach ? 'self-start' : 'self-end items-end'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-caption-mono text-[10px] text-tertiary uppercase font-medium">
                    <span>{isCoach ? 'RAKU' : 'YOU'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-4 rounded-xl font-caption-mono text-caption-mono whitespace-pre-line leading-relaxed shadow-xs ${
                      isCoach
                        ? 'bg-surface-container-low text-on-surface border border-outline-variant'
                        : 'bg-on-surface text-surface-container-lowest font-medium'
                    }`}
                  >
                    {msg.text}

                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-outline-variant/60 flex flex-wrap gap-1">
                        <span className="text-[10px] text-tertiary block w-full uppercase font-medium">
                          SOURCES:
                        </span>
                        {msg.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded bg-surface-container-lowest text-[10px] text-primary hover:underline flex items-center gap-1 border border-outline-variant"
                          >
                            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                            {src.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="self-start flex items-center gap-2 font-caption-mono text-caption-mono text-tertiary bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span>
                <span>Thinking…</span>
              </div>
            )}
          </div>

          {/* Quick prompt chips */}
          <div className="px-4 py-2.5 bg-surface-container-low/70 border-t border-outline-variant flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
            <span className="font-caption-mono text-[10px] text-tertiary mr-1 uppercase font-semibold">QUICK:</span>
            {[
              'Audit my NVDA executions',
              'Analyze my win rate vs R:R',
              'How to mitigate revenge trading?',
              'Review my plan-following patterns',
            ].map((prompt, pIdx) => (
              <button
                key={pIdx}
                onClick={() => handleSendMessage(undefined, prompt)}
                className="px-3 py-1 rounded-full bg-surface-container-lowest hover:bg-surface-container text-tertiary hover:text-on-surface font-caption-mono text-[11px] whitespace-nowrap cursor-pointer transition-colors border border-outline-variant/80 shadow-2xs"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input strip */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 bg-surface-container-low flex items-center gap-3 border-t border-outline-variant shrink-0"
          >
            <input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="ASK RAKU (e.g. 'Review stop placement on my losses')..."
              className="flex-1 bg-surface-container-lowest px-4 py-2.5 rounded-full font-caption-mono text-body-sm text-on-surface outline-none border border-outline-variant focus:border-on-surface placeholder:text-tertiary transition-colors shadow-2xs"
            />
            <button
              type="submit"
              disabled={isSending || !inputMessage.trim()}
              className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-body-md">arrow_forward</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
};
