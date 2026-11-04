import React, { useState } from 'react';
import { Trade, TradeStats } from '../types/trade';
import { getJournalAuthHeaders } from '../lib/supabaseClient';

interface AICoachViewProps {
  stats: TradeStats;
  trades: Trade[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
  sources?: { title: string; uri: string }[];
}

export const AICoachView: React.FC<AICoachViewProps> = ({ stats, trades }) => {
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [auditMode, setAuditMode] = useState<'gemini' | 'heuristic' | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'coach',
      text: `I can help review the ${trades.length} trades in your journal. Ask about your results, setups, or plan-following patterns.`,
      timestamp: 'READY',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Compute top mistakes & setups to pass to AI
  const getAuditPayload = () => {
    const mistakeCounts: { [tag: string]: number } = {};
    const setupCounts: { [s: string]: { count: number; wins: number } } = {};

    trades.filter((trade) => trade.tradeStatus !== 'MISSED').forEach((t) => {
      if (t.mistakes) {
        t.mistakes.forEach((m) => {
          mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
        });
      }
      if (t.setup) {
        if (!setupCounts[t.setup]) setupCounts[t.setup] = { count: 0, wins: 0 };
        setupCounts[t.setup].count++;
        if (t.pnl > 0) setupCounts[t.setup].wins++;
      }
    });

    return {
      stats,
      topMistakes: Object.entries(mistakeCounts).map(([tag, count]) => ({ tag, count })),
      topSetups: Object.entries(setupCounts).map(([setup, data]) => ({
        setup,
        winRate: `${((data.wins / data.count) * 100).toFixed(0)}%`,
      })),
      tradesSummary: trades.filter((trade) => trade.tradeStatus !== 'MISSED').slice(0, 10).map((t) => ({
        symbol: t.symbol,
        side: t.side,
        pnl: t.pnl,
        setup: t.setup,
        rulesFollowed: t.rulesFollowed,
        mistakes: t.mistakes,
      })),
    };
  };

  const handleRunAudit = async () => {
    setIsRunningAudit(true);
    try {
      const payload = getAuditPayload();
      const res = await fetch('/api/coach/analyze', {
        method: 'POST',
        headers: await getJournalAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setAuditReport(data.analysis || 'Analysis complete.');
      setAuditMode(data.mode || 'heuristic');
    } catch {
      setAuditReport(`I couldn't reach the coach service. Your journal currently has ${stats.closedTrades} closed trades, a ${stats.winRate}% win rate, and ${stats.expectancy >= 0 ? '+' : ''}$${Math.abs(stats.expectancy).toFixed(2)} expectancy per trade. Check that the local server is running, then try again.`);
      setAuditMode('heuristic');
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const query = customText || inputMessage;
    if (!query.trim() || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputMessage('');
    setIsSending(true);

    try {
      const auditPayload = getAuditPayload();
      const res = await fetch('/api/coach/chat', {
        method: 'POST',
        headers: await getJournalAuthHeaders(),
        body: JSON.stringify({
          message: query,
          journalContext: {
            totalTrades: stats.totalTrades,
            winRate: stats.winRate,
            netPnL: stats.netPnL,
            topMistakes: auditPayload.topMistakes.map((item) => item.tag),
          },
          trades: trades.slice(0, 15),
        }),
      });
      const data = await res.json();
      const botMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text: data.reply || 'Analysis received.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: data.sources || [],
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch {
      const botMsg: ChatMessage = {
        id: `coach-${Date.now()}`,
        sender: 'coach',
        text: `I couldn't reach the coach service. From your journal: ${stats.closedTrades} closed trades, ${stats.winRate}% win rate, and ${stats.expectancy >= 0 ? '+' : ''}$${Math.abs(stats.expectancy).toFixed(2)} expectancy per trade.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-outline-variant pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-caption-mono font-caption-mono text-tertiary">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-sm"></span>
            <span>BUDDY</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface uppercase font-bold">
            Your trading buddy
          </h1>
          <p className="font-body-md text-body-md text-tertiary">
            Review your logged trades, setups, and plan-following patterns.
          </p>
        </div>

        <button
          onClick={handleRunAudit}
          disabled={isRunningAudit}
          className="flex items-center gap-2 bg-on-surface text-surface-container-lowest hover:opacity-90 px-6 py-2.5 rounded-full transition-transform active:scale-95 shadow-sm font-caption-mono text-caption-mono uppercase font-bold cursor-pointer disabled:opacity-50"
        >
          <span className="w-2 h-2 rounded-full bg-primary-container"></span>
          <span>{isRunningAudit ? 'Reviewing trades…' : 'Generate review'}</span>
        </button>
      </div>

      {/* Main Grid: 12 Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* Left: Audit Report & Metrics (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
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
                  {auditMode === 'gemini' ? 'AI REVIEW' : 'LOCAL REVIEW'}
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
                COACH INTERACTION CONSOLE
              </span>
            </div>
            <span className="font-caption-mono text-caption-mono text-tertiary">
              {trades.length} logged trades
            </span>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
            {chatMessages.map((msg) => {
              const isCoach = msg.sender === 'coach';

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    isCoach ? 'self-start' : 'self-end items-end'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-caption-mono text-[10px] text-tertiary uppercase font-medium">
                    <span>{isCoach ? 'XECUTD COACH' : 'YOU'}</span>
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
              placeholder="ASK QUANT COACH (e.g. 'Review stop placement on my losses')..."
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
