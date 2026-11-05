import React, { useState, useMemo, useEffect } from 'react';
import { Trade, TradeStats, TradeSide } from '../types/trade';
import { EquityPoint, formatCurrency } from '../utils/calculations';
import { getTradeExcursionDisplay } from '../utils/tradeAnalyticsEngine';
import type { WelcomeKind } from './SupabaseAuthGate';

interface DashboardViewProps {
  stats: TradeStats;
  trades: Trade[];
  equityData: EquityPoint[];
  currency: string;
  startingBalance: number;
  onSelectTrade: (trade: Trade) => void;
  onOpenNewTrade: (defaults?: { symbol?: string; side?: TradeSide }) => void;
  onNavigateToTrades: () => void;
  welcomeKind: WelcomeKind;
  profileName: string;
  showWelcome: boolean;
  onBeginUsing: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  trades,
  equityData,
  currency,
  startingBalance,
  onSelectTrade,
  onOpenNewTrade,
  onNavigateToTrades,
  welcomeKind,
  profileName,
  showWelcome,
  onBeginUsing,
}) => {
  const [timePeriod, setTimePeriod] = useState<'1D' | '1W' | '1M' | '3M' | 'YTD' | 'ALL'>('ALL');
  const [showEquityDetails, setShowEquityDetails] = useState(false);
  const [selectedEmotion, setSelectedEmotion] = useState<string>('NEUTRAL');
  const [quickTicker, setQuickTicker] = useState<string>('');
  const [quickSide, setQuickSide] = useState<TradeSide>('Long');
  const [riskPeriod, setRiskPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [customRiskStart, setCustomRiskStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customRiskEnd, setCustomRiskEnd] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [sessionPerformancePeriod, setSessionPerformancePeriod] = useState<'D' | 'W' | 'M' | 'ALL'>('M');
  const [sessionWidgetExpanded, setSessionWidgetExpanded] = useState(true);
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Filter equity data based on selected time period
  const filteredEquity = useMemo(() => {
    if (!equityData || equityData.length === 0) return [];
    if (timePeriod === 'ALL') return equityData;
    const now = new Date();
    const cutoff = new Date(now);
    if (timePeriod === '1D') cutoff.setDate(now.getDate() - 1);
    else if (timePeriod === '1W') cutoff.setDate(now.getDate() - 7);
    else if (timePeriod === '1M') cutoff.setMonth(now.getMonth() - 1);
    else if (timePeriod === '3M') cutoff.setMonth(now.getMonth() - 3);
    else cutoff.setMonth(0, 1);
    return equityData.filter((point) => point.date === 'Start' || new Date(`${point.date}T00:00:00`) >= cutoff);
  }, [equityData, timePeriod]);

  // SVG coordinates calculation for equity curve
  const chartGeometry = useMemo(() => {
    const baseCapital = startingBalance;
    const actualPeakPnL = Math.max(0, ...filteredEquity.map((point) => point.cumulativePnL));
    if (!filteredEquity || filteredEquity.length < 2) {
      return {
        pathPoints: '20,260 980,260',
        flawlessPathPoints: '20,260 980,260',
        fillPoints: '20,260 980,260 980,300 20,300',
        peak: { x: 980, y: 260, val: actualPeakPnL },
        dots: [] as { x: number; y: number; isWin: boolean; isMissed: boolean }[],
        minVal: baseCapital,
        maxVal: baseCapital + actualPeakPnL,
      };
    }

    const balances = filteredEquity.flatMap((d) => [baseCapital + d.cumulativePnL, baseCapital + d.flawlessCumulativePnL]);
    const minVal = Math.min(...balances);
    const maxVal = Math.max(...balances);
    const range = maxVal - minVal || 1;

    const width = 1000;
    const height = 300;
    const paddingX = 40;
    const paddingTop = 40;
    const paddingBottom = 40;
    const usableWidth = width - paddingX * 2;
    const usableHeight = height - paddingTop - paddingBottom;

    const pts = filteredEquity.map((d, i) => {
      const x = paddingX + (i / (filteredEquity.length - 1)) * usableWidth;
      const balance = baseCapital + d.cumulativePnL;
      const normalizedY = (balance - minVal) / range;
      const y = height - paddingBottom - normalizedY * usableHeight;
      return { x, y, balance, pnl: d.tradePnL || 0 };
    });
    const flawlessPts = filteredEquity.map((d, i) => {
      const x = paddingX + (i / (filteredEquity.length - 1)) * usableWidth;
      const balance = baseCapital + d.flawlessCumulativePnL;
      const normalizedY = (balance - minVal) / range;
      const y = height - paddingBottom - normalizedY * usableHeight;
      return { x, y };
    });

    const pathPoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const flawlessPathPoints = flawlessPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const first = pts[0];
    const last = pts[pts.length - 1];
    const fillPoints = `${first.x.toFixed(1)},${first.y.toFixed(1)} ${pathPoints} ${last.x.toFixed(1)},${height} ${first.x.toFixed(1)},${height}`;

    // Find peak
    let maxIdx = 0;
    let highest = pts[0].balance;
    pts.forEach((p, idx) => {
      if (p.balance > highest) {
        highest = p.balance;
        maxIdx = idx;
      }
    });

    const dots = pts.map((p, index) => ({
      x: p.x,
      y: p.y,
      isWin: p.pnl >= 0,
      isMissed: filteredEquity[index]?.isMissed ?? false,
    }));

    return {
      pathPoints,
      flawlessPathPoints,
      fillPoints,
      peak: { x: pts[maxIdx].x, y: pts[maxIdx].y, val: actualPeakPnL },
      dots,
      minVal,
      maxVal,
    };
  }, [filteredEquity, startingBalance]);

  // Recent 5 executed trades
  const recentTrades = useMemo(() => {
    return trades.filter((trade) => trade.tradeStatus !== 'MISSED')
      .sort((a, b) => new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime() - 
                     new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime())
      .slice(0, 5);
  }, [trades]);

  // 30-day cadence, derived only from logged trades
  const monthDays = useMemo(() => {
    const today = new Date();
    const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const dateMap = new Map<string, number>();
    trades.forEach((t) => {
      if (t.tradeStatus === 'MISSED' || t.status !== 'Closed') return;
      dateMap.set(t.entryDate, (dateMap.get(t.entryDate) || 0) + (t.pnl || 0));
    });
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29 + index);
      const key = dateKey(date);
      const pnl = dateMap.get(key);
      return { date: key, day: date.getDate(), status: pnl === undefined ? 'none' as const : pnl > 0 ? 'profit' as const : pnl < 0 ? 'loss' as const : 'none' as const, isToday: key === dateKey(today), pnl: pnl || 0 };
    });
  }, [trades]);

  const winRatePercent = stats.winRate.toFixed(1);
  const winCount = stats.wins;
  const lossCount = stats.losses;
  const excursionSummary = useMemo(() => {
    const completed = trades.filter((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed');
    const values = completed.map(getTradeExcursionDisplay);
    const mean = (numbers: number[]) => numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : null;
    const mfe = values.map((value) => value.mfeR).filter((value): value is number => value !== null);
    const mae = values.map((value) => value.maeR).filter((value): value is number => value !== null);
    const efficiency = values.map((value) => value.exitEfficiencyPct).filter((value): value is number => value !== null);
    return { avgMfe: mean(mfe), avgMae: mean(mae), avgEfficiency: mean(efficiency), recorded: values.filter((value) => value.mfeR !== null || value.maeR !== null).length, gainedBack: values.filter((value) => value.gainedGivenBack).length };
  }, [trades]);
  const chartAxis = filteredEquity.length > 1
    ? [0, 0.25, 0.5, 0.75, 1].map((fraction) => filteredEquity[Math.round((filteredEquity.length - 1) * fraction)].date)
    : [];
  const netPnL = stats.netPnL;
  const lastEquityPoint = equityData.at(-1);
  // Show the distance between the two cumulative R curves. A missed Loss moves
  // the flawless curve down by 1R, so the gap is still a positive 1R distance.
  const disciplineGapR = Math.abs((lastEquityPoint?.flawlessCumulativeR ?? 0) - (lastEquityPoint?.cumulativeR ?? 0));
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayTrades = useMemo(() => trades.filter((trade) => trade.entryDate === localDateKey(clockNow)), [trades, clockNow]);
  const weekTrades = useMemo(() => {
    const monday = new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const mondayKey = localDateKey(monday);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const sundayKey = localDateKey(sunday);
    return trades.filter((trade) => trade.entryDate >= mondayKey && trade.entryDate <= sundayKey);
  }, [trades, clockNow]);
  const monthTrades = useMemo(() => trades.filter((trade) => trade.entryDate.slice(0, 7) === localDateKey(clockNow).slice(0, 7)), [trades, clockNow]);
  const customRangeTrades = useMemo(() => trades.filter((trade) => trade.entryDate >= customRiskStart && trade.entryDate <= customRiskEnd), [trades, customRiskStart, customRiskEnd]);
  const riskTrades = riskPeriod === 'daily' ? todayTrades : riskPeriod === 'weekly' ? weekTrades : riskPeriod === 'monthly' ? monthTrades : customRangeTrades;
  const executedRiskTrades = riskTrades.filter((trade) => trade.tradeStatus !== 'MISSED');
  const followedPlanCount = executedRiskTrades.filter((trade) => trade.rulesFollowed).length;
  const adherencePercent = executedRiskTrades.length ? Math.round((followedPlanCount / executedRiskTrades.length) * 100) : null;
  const adherenceGrade = adherencePercent === null ? '—'
    : adherencePercent >= 95 ? 'A′'
    : adherencePercent >= 90 ? 'A'
    : adherencePercent >= 85 ? 'B′'
    : adherencePercent >= 80 ? 'B'
    : adherencePercent >= 75 ? 'C′'
    : adherencePercent >= 70 ? 'C'
    : adherencePercent >= 60 ? 'D'
    : 'F';
  const periodDrawdown = useMemo(() => {
    const closed = riskTrades.filter((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed').sort((a, b) => `${a.entryDate}T${a.entryTime || '00:00'}`.localeCompare(`${b.entryDate}T${b.entryTime || '00:00'}`));
    let runningPnl = 0;
    let peakPnl = 0;
    let maxDrawdown = 0;
    closed.forEach((trade) => {
      runningPnl += trade.pnl || 0;
      peakPnl = Math.max(peakPnl, runningPnl);
      maxDrawdown = Math.max(maxDrawdown, peakPnl - runningPnl);
    });
    return maxDrawdown;
  }, [riskTrades]);
  const riskPeriodLabel = riskPeriod === 'daily' ? 'Daily' : riskPeriod === 'weekly' ? 'Weekly' : riskPeriod === 'monthly' ? 'Monthly' : 'Range';
  const latestRiskTrade = [...executedRiskTrades].sort((a, b) => `${b.entryDate}T${b.entryTime || '00:00'}`.localeCompare(`${a.entryDate}T${a.entryTime || '00:00'}`))[0];
  const sessionPerformance = useMemo(() => {
    const todayKey = localDateKey(clockNow);
    const cutoff = new Date(clockNow.getFullYear(), clockNow.getMonth(), clockNow.getDate());
    if (sessionPerformancePeriod === 'D') cutoff.setDate(cutoff.getDate());
    else if (sessionPerformancePeriod === 'W') cutoff.setDate(cutoff.getDate() - 6);
    else if (sessionPerformancePeriod === 'M') cutoff.setDate(cutoff.getDate() - 29);
    const cutoffKey = localDateKey(cutoff);
    const completed = trades.filter((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed' && trade.session &&
      (sessionPerformancePeriod === 'ALL' || (trade.exitDate || trade.entryDate) >= cutoffKey && (trade.exitDate || trade.entryDate) <= todayKey));
    return (['Asia', 'London', 'New York'] as const).map((name) => {
      const records = completed.filter((trade) => trade.session === name);
      const wins = records.filter((trade) => trade.pnl > 0).length;
      const pnl = records.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const grossWins = records.filter((trade) => trade.pnl > 0).reduce((sum, trade) => sum + trade.pnl, 0);
      const grossLosses = Math.abs(records.filter((trade) => trade.pnl < 0).reduce((sum, trade) => sum + trade.pnl, 0));
      return { name, records, count: records.length, wins, losses: records.filter((trade) => trade.pnl < 0).length, pnl, winRate: records.length ? (wins / records.length) * 100 : 0, totalR: records.reduce((sum, trade) => sum + (trade.realizedR || 0), 0), averageR: records.length ? records.reduce((sum, trade) => sum + (trade.realizedR || 0), 0) / records.length : 0, profitFactor: grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0, topSetup: Object.entries(records.reduce<Record<string, number>>((counts, trade) => { const setup = trade.setup?.trim(); if (setup) counts[setup] = (counts[setup] || 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] };
    });
  }, [trades, clockNow, sessionPerformancePeriod]);
  const sessionPerformancePnl = sessionPerformance.reduce((sum, session) => sum + session.pnl, 0);
  const sessionMaxAbsPnl = Math.max(1, ...sessionPerformance.map((session) => Math.abs(session.pnl)));
  const dashboardRankings = useMemo(() => {
    const mistakeCounts = new Map<string, number>();
    const strategyPnl = new Map<string, { pnl: number; trades: number }>();
    trades.forEach((trade) => {
      (trade.mistakes || []).forEach((mistake) => {
        const label = mistake.trim();
        if (label) mistakeCounts.set(label, (mistakeCounts.get(label) || 0) + 1);
      });
      if (trade.tradeStatus === 'MISSED' || trade.status !== 'Closed') return;
      const strategy = trade.setup?.trim();
      if (!strategy) return;
      const current = strategyPnl.get(strategy) || { pnl: 0, trades: 0 };
      strategyPnl.set(strategy, { pnl: current.pnl + (trade.pnl || 0), trades: current.trades + 1 });
    });
    const totalMistakes = [...mistakeCounts.values()].reduce((sum, count) => sum + count, 0);
    const profitableStrategies = [...strategyPnl].map(([name, value]) => ({ name, ...value })).filter((strategy) => strategy.pnl > 0).sort((a, b) => b.pnl - a.pnl || a.name.localeCompare(b.name));
    const totalStrategyGains = profitableStrategies.reduce((sum, strategy) => sum + strategy.pnl, 0);
    return {
      mistakes: [...mistakeCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([name, count]) => ({ name, count, share: totalMistakes ? Math.round((count / totalMistakes) * 100) : 0 })),
      strategies: profitableStrategies.slice(0, 3).map((strategy) => ({ ...strategy, share: totalStrategyGains ? Math.round((strategy.pnl / totalStrategyGains) * 100) : 0 })),
    };
  }, [trades]);
  const sessionClock = (timeZone: string) => new Intl.DateTimeFormat(undefined, { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(clockNow);
  const sessionState = (timeZone: string, opensAt: number, closesAt: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(clockNow);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
    if (weekday === 'Sat' || weekday === 'Sun') return 'CLOSED';
    if (hour >= opensAt && hour < closesAt) return 'OPEN';
    return hour < opensAt ? 'PRE-OPEN' : 'CLOSED';
  };
  const sessionUtcStart = (timeZone: string, localOpenHour: number) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(clockNow);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const localAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
    const offset = Math.round((localAsUtc - clockNow.getTime()) / 60000);
    return ((localOpenHour * 60 - offset) % 1440 + 1440) % 1440;
  };
  return (
    <div className="w-full flex flex-col gap-3 sm:gap-space-lg" onClickCapture={(event) => {
      if (!(event.target as HTMLElement).closest('[data-welcome-card]')) onBeginUsing();
    }}>

      {showWelcome && <section data-welcome-card className="flex flex-col gap-1 border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm" aria-live="polite">
        <p className="flex items-center gap-2 font-caption-mono text-caption-mono uppercase tracking-[.16em] text-tertiary">
          <span className="h-2 w-2 bg-primary" aria-hidden="true" />
          {welcomeKind === 'new' ? 'NEW JOURNAL' : welcomeKind === 'daily' ? 'FIRST CHECK-IN TODAY' : 'JOURNAL READY'}
        </p>
        <h1 className="font-headline-lg text-headline-lg font-semibold tracking-tight text-on-surface">
          {welcomeKind === 'new'
            ? `Welcome to Xecutd${profileName ? `, ${profileName}` : ''}`
            : welcomeKind === 'daily'
              ? `${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}${profileName ? `, ${profileName}` : ''}`
              : `Welcome back${profileName ? `, ${profileName}` : ''}`}
        </h1>
        <p className="font-body-sm text-body-sm text-tertiary">
          {welcomeKind === 'new'
            ? 'Your journal is ready. Log your first trade whenever you’re ready.'
            : welcomeKind === 'daily'
              ? 'A new trading day. Review your plan, then focus on one decision at a time.'
              : 'Your journal is synced and ready. Keep following your process.'}
        </p>
      </section>}
      
      {/* TOP SUMMARY METRICS BAR */}
      <section className="grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest p-2.5 shadow-sm sm:gap-space-md sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none xl:grid-cols-6">
        
        {/* Metric 1: Net Cumulative P&L */}
        <div className="relative flex min-w-0 min-h-[112px] flex-col justify-between overflow-hidden border-r border-b border-outline-variant/60 p-2.5 sm:min-h-0 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm sm:hover:shadow-md sm:hover:border-outline sm:transition-all">
          <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-primary-container/10 blur-xl pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              <span className="font-caption-mono text-[9px] sm:text-caption-mono text-tertiary tracking-widest uppercase font-semibold">
                NET P&amp;L
              </span>
            </div>
            <span className="hidden sm:inline font-caption-mono text-caption-mono text-on-surface font-semibold">
              {stats.closedTrades} CLOSED
            </span>
          </div>
          <div className="my-2 sm:my-space-md">
            <div
              className={`font-numeric-stat text-xl sm:text-numeric-stat tracking-tight font-bold truncate ${
                stats.netPnL >= 0 ? 'text-on-surface' : 'text-secondary'
              }`}
            >
              {stats.netPnL >= 0 ? '+' : ''}{formatCurrency(Math.abs(stats.netPnL), currency)}
            </div>
            <div className="font-body-sm text-[10px] sm:text-body-sm text-on-surface-variant flex items-center gap-space-xs mt-1 font-medium">
              <span>{stats.totalTrades} executed trades</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center justify-between text-caption-mono font-caption-mono text-tertiary pt-space-xs border-t border-outline-variant/60 font-medium">
            <span>MAX DRAWDOWN {formatCurrency(stats.maxDrawdownAmount, currency)}</span>
            <span>{stats.openTrades} OPEN</span>
          </div>
        </div>

        {/* Metric 2: Win Rate */}
        <div className="flex min-w-0 min-h-[112px] flex-col justify-between border-b border-outline-variant/60 p-2.5 sm:min-h-0 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm sm:hover:shadow-md sm:hover:border-outline sm:transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span className="font-caption-mono text-[9px] sm:text-caption-mono text-tertiary tracking-widest uppercase font-semibold">
                WIN RATE
              </span>
            </div>
            <span className="hidden sm:inline font-caption-mono text-caption-mono text-tertiary uppercase font-medium">
              {stats.totalTrades} TRADES
            </span>
          </div>
          <div className="my-2 sm:my-space-sm flex items-center justify-between">
            <div>
              <div className="font-numeric-stat text-xl sm:text-numeric-stat text-on-surface tracking-tight font-bold">
                {winRatePercent}%
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant mt-1 font-medium">
                <span className="text-on-surface font-caption-mono font-bold">{winCount} W</span>
                <span className="mx-1 font-caption-mono text-tertiary">/</span>
                <span className="text-secondary font-caption-mono font-bold">{lossCount} L</span>
              </div>
            </div>
            {/* Glyph circular radial progress */}
            <div className="relative hidden sm:flex w-14 h-14 shrink-0 items-center justify-center">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 48 48">
                <circle
                  className="text-surface-container-highest"
                  cx="24"
                  cy="24"
                  fill="transparent"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="3.5"
                ></circle>
                <circle
                  className="text-primary"
                  cx="24"
                  cy="24"
                  fill="transparent"
                  r="20"
                  stroke="currentColor"
                  strokeDasharray="125.66"
                  strokeDashoffset={String(125.66 * (1 - Math.min(100, Math.max(0, stats.winRate)) / 100))}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                ></circle>
              </svg>
              <span className="absolute font-caption-mono text-caption-mono text-on-surface font-bold">
                {Math.round(stats.winRate)}%
              </span>
            </div>
          </div>
          <div className="w-full bg-surface-container-highest h-1 rounded-full overflow-hidden flex">
            <div className="bg-primary h-full" style={{ width: `${stats.winRate}%` }}></div>
            <div className="bg-surface-container h-full" style={{ width: `${100 - stats.winRate}%` }}></div>
          </div>
        </div>

        {/* Metric 3: Profit Factor & R:R */}
        <div className="flex min-w-0 min-h-[112px] flex-col justify-between border-r border-b border-outline-variant/60 p-2.5 sm:min-h-0 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm sm:hover:shadow-md sm:hover:border-outline sm:transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span className="font-caption-mono text-[9px] sm:text-caption-mono text-tertiary tracking-widest uppercase font-semibold">
                PROFIT FACTOR
              </span>
            </div>
            <span className="hidden sm:inline font-caption-mono text-caption-mono text-on-surface font-semibold">
              {stats.closedTrades} TRADES
            </span>
          </div>
          <div className="my-2 sm:my-space-md">
            <div className="font-numeric-stat text-xl sm:text-numeric-stat text-on-surface tracking-tight font-bold">
              {stats.grossLoss > 0 ? stats.profitFactor.toFixed(2) : stats.grossProfit > 0 ? '∞' : '—'}
            </div>
            <div className="font-body-sm text-[9px] sm:text-body-sm text-on-surface-variant flex items-center gap-space-xs mt-1 font-medium">
              <span>AVG WIN / AVG LOSS:</span>
              <span className="font-caption-mono text-on-surface font-bold">
                {stats.winLossRatio.toFixed(2)}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center justify-between text-caption-mono font-caption-mono text-tertiary pt-space-xs border-t border-outline-variant/60 font-medium">
            <span>GROSS PROFIT {formatCurrency(stats.grossProfit, currency)}</span>
            <span>GROSS LOSS {formatCurrency(stats.grossLoss, currency)}</span>
          </div>
        </div>

        {/* Metric 4: Avg Trade Expectancy */}
        <div className="flex min-w-0 min-h-[112px] flex-col justify-between border-b border-outline-variant/60 p-2.5 sm:min-h-0 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm sm:hover:shadow-md sm:hover:border-outline sm:transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span className="font-caption-mono text-[9px] sm:text-caption-mono text-tertiary tracking-widest uppercase font-semibold">
                <span className="sm:hidden">EXPECTANCY</span><span className="hidden sm:inline">EXPECTANCY / TRADE</span>
              </span>
            </div>
            <span className="hidden sm:inline font-caption-mono text-caption-mono text-on-surface font-bold">
              {stats.avgRealizedR >= 0 ? '+' : ''}{stats.avgRealizedR.toFixed(2)} R
            </span>
          </div>
          <div className="my-2 sm:my-space-md">
            <div
              className={`font-numeric-stat text-xl sm:text-numeric-stat tracking-tight font-bold truncate ${
                stats.expectancy >= 0 ? 'text-on-surface' : 'text-secondary'
              }`}
            >
              {stats.expectancy >= 0 ? '+' : ''}{formatCurrency(Math.abs(stats.expectancy), currency)}
            </div>
            <div className="font-body-sm text-[9px] sm:text-body-sm text-on-surface-variant flex items-center gap-space-xs mt-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span>PLAN FOLLOWED {stats.closedTrades ? `${stats.rulesCompliance.toFixed(0)}%` : '—'}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center justify-between text-caption-mono font-caption-mono text-tertiary pt-space-xs border-t border-outline-variant/60 font-medium">
            <span>AVG WIN: {formatCurrency(stats.avgWin, currency)}</span>
            <span>AVG LOSS: {formatCurrency(-Math.abs(stats.avgLoss), currency)}</span>
          </div>
        </div>

        <div className="flex min-w-0 min-h-[112px] flex-col justify-between border-r border-outline-variant/60 p-2.5 sm:min-h-0 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm">
          <span className="font-caption-mono text-[9px] sm:text-caption-mono text-tertiary uppercase tracking-wider font-semibold"><span className="sm:hidden">MAX DD</span><span className="hidden sm:inline">MAX DRAWDOWN</span></span>
          <div className="my-2 sm:my-space-sm">
            <span className="font-numeric-stat text-xl sm:text-numeric-stat text-secondary font-bold truncate">{formatCurrency(-Math.abs(stats.maxDrawdownAmount), currency)}</span>
            <p className="font-body-sm text-[9px] sm:text-body-sm text-on-surface-variant mt-1">{stats.maxDrawdown.toFixed(1)}% of peak</p>
          </div>
          <span className="hidden sm:inline font-caption-mono text-caption-mono text-tertiary">Closed trades only</span>
        </div>

        <div className="flex min-w-0 min-h-[112px] flex-col justify-between p-2.5 sm:min-h-0 sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm">
          <span className="font-caption-mono text-[9px] sm:text-caption-mono text-tertiary uppercase tracking-wider font-semibold"><span className="sm:hidden">AVG R / TRADE</span><span className="hidden sm:inline">AVERAGE R / TRADE</span></span>
          <div className="my-2 sm:my-space-sm">
            <span className={`font-numeric-stat text-xl sm:text-numeric-stat font-bold ${stats.avgRealizedR < 0 ? 'text-secondary' : 'text-on-surface'}`}>{stats.avgRealizedR >= 0 ? '+' : ''}{stats.avgRealizedR.toFixed(2)}R</span>
            <p className="font-body-sm text-[9px] sm:text-body-sm text-on-surface-variant mt-1">{stats.closedTrades} closed trades</p>
          </div>
          <span className="hidden sm:inline font-caption-mono text-caption-mono text-tertiary">Realized R average</span>
        </div>

      </section>

      {/* TRADE EXCURSION CARD */}
      <section className="grid grid-cols-2 gap-3 border border-outline-variant bg-surface-container-lowest p-3 shadow-sm sm:grid-cols-4 sm:gap-4 sm:p-space-lg" aria-label="Trade excursion analytics">
        <div className="col-span-2 flex items-center justify-between border-b border-outline-variant pb-2 sm:col-span-4">
          <h2 className="font-caption-mono text-[10px] font-bold uppercase tracking-widest text-on-surface">Trade excursions</h2>
          <span className="font-caption-mono text-[9px] uppercase text-tertiary">{excursionSummary.recorded} trades with recorded highs/lows</span>
        </div>
        <div><span className="block font-caption-mono text-[9px] uppercase tracking-wide text-tertiary">Average MFE</span><span className="font-numeric-stat text-lg font-bold text-cyan-700 dark:text-cyan-300">{excursionSummary.avgMfe === null ? '—' : `+${excursionSummary.avgMfe.toFixed(2)}R`}</span></div>
        <div><span className="block font-caption-mono text-[9px] uppercase tracking-wide text-tertiary">Average MAE</span><span className="font-numeric-stat text-lg font-bold text-amber-700 dark:text-amber-300">{excursionSummary.avgMae === null ? '—' : `-${Math.abs(excursionSummary.avgMae).toFixed(2)}R`}</span></div>
        <div><span className="block font-caption-mono text-[9px] uppercase tracking-wide text-tertiary">Exit efficiency</span><span className="font-numeric-stat text-lg font-bold text-on-surface">{excursionSummary.avgEfficiency === null ? '—' : `${excursionSummary.avgEfficiency.toFixed(1)}%`}</span></div>
        <div><span className="block font-caption-mono text-[9px] uppercase tracking-wide text-tertiary">Gained given back</span><span className="font-numeric-stat text-lg font-bold text-secondary">{excursionSummary.gainedBack}</span></div>
      </section>

      {/* MAIN GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-space-lg">
        
        {/* LEFT / CENTER: 8 COLUMNS */}
        <div className="lg:col-span-8 flex flex-col gap-3 sm:gap-space-lg min-w-0">
          
          {/* EQUITY CURVE & DRAWDOWN MODULE */}
          <div className="flex min-w-0 flex-col gap-3 bg-transparent p-0 shadow-none sm:gap-space-md sm:rounded-xl sm:border sm:border-outline-variant sm:bg-surface-container-lowest sm:p-space-lg sm:shadow-sm">
            
            {/* Chart controls: compact range and balance row on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-space-md pb-space-sm border-b border-outline-variant/60">
              <div className="hidden sm:flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="font-caption-mono text-caption-mono text-tertiary tracking-widest uppercase font-semibold">
                    Equity curve
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                  EQUITY LOG // DRAWDOWN OVERLAY
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-4 font-caption-mono text-[10px] uppercase tracking-wide text-tertiary">
                  <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 bg-on-surface"></span>Actual equity</span>
                  <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 border-t-2 border-dashed border-[#e30613]"></span>Flawless execution</span>
                </div>
              </div>

              {/* Time Range Selectors */}
              <div className="hidden sm:flex items-center bg-surface-container-low border border-outline-variant p-1 rounded-full self-start sm:self-auto">
                {(['1D', '1W', '1M', '3M', 'YTD', 'ALL'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`px-space-md py-1 rounded-full font-caption-mono text-caption-mono transition-all uppercase cursor-pointer ${
                      timePeriod === period
                        ? 'bg-primary text-on-primary font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface font-medium'
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                <label className="flex min-w-0 items-center gap-1.5 border border-outline-variant bg-surface-container-low px-2.5 py-2 font-caption-mono text-[10px] uppercase text-on-surface-variant">
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">calendar_month</span>
                  <select aria-label="Equity chart date range" value={timePeriod} onChange={(event) => setTimePeriod(event.target.value as typeof timePeriod)} className="min-w-0 w-full appearance-none bg-transparent font-caption-mono text-[10px] font-semibold text-on-surface outline-none">
                    {(['1D', '1W', '1M', '3M', 'YTD', 'ALL'] as const).map((period) => <option key={period} value={period}>{period}</option>)}
                  </select>
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">expand_more</span>
                </label>
                <button type="button" aria-expanded={showEquityDetails} onClick={() => setShowEquityDetails((open) => !open)} className="flex min-w-0 items-center justify-between gap-1 border border-outline-variant bg-surface-container-low px-2.5 py-2 text-left">
                  <span className="min-w-0"><span className="block font-caption-mono text-[8px] uppercase tracking-wide text-tertiary">Net P&amp;L</span><span className="block truncate font-table-data text-xs font-bold text-on-surface">{formatCurrency(netPnL, currency)}</span></span>
                  <span className="material-symbols-outlined text-base text-tertiary" aria-hidden="true">{showEquityDetails ? 'expand_less' : 'expand_more'}</span>
                </button>
              </div>
            </div>

            {/* Secondary Telemetry Micro-Readouts */}
            <div className="hidden sm:flex flex-wrap items-center gap-space-md font-caption-mono text-caption-mono text-tertiary py-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                  <span className="text-on-surface font-medium">NET P&amp;L: {formatCurrency(netPnL, currency)}</span>
              </div>
              <span>//</span>
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary-container"></span>
                <span className="text-secondary font-medium">MAX DRAWDOWN: {formatCurrency(-Math.abs(stats.maxDrawdownAmount), currency)} ({stats.maxDrawdown.toFixed(1)}%)</span>
              </div>
              <span>//</span>
              <div className="flex items-center gap-space-xs" title="Absolute distance between the flawless and actual cumulative R curves">
                <span className="w-2 h-2 rounded-full bg-[#e30613]"></span>
                <span className="text-on-surface font-medium">DISCIPLINE GAP: <span className={disciplineGapR > 0 ? 'text-secondary' : 'text-on-surface'}>{disciplineGapR.toFixed(2)}R</span></span>
              </div>
              <span>//</span>
              <div className="flex items-center gap-space-xs">
                <span className="text-on-surface font-bold">STATUS:</span>
                <span className="text-on-surface font-semibold">
                  {stats.closedTrades} CLOSED TRADES
                </span>
              </div>
            </div>
            {showEquityDetails && <div className="grid grid-cols-2 gap-2 sm:hidden">
              <div className="border border-outline-variant bg-surface-container-low p-2"><span className="block font-caption-mono text-[8px] uppercase text-tertiary">Max drawdown</span><span className="font-caption-mono text-[10px] font-semibold text-secondary">{formatCurrency(-Math.abs(stats.maxDrawdownAmount), currency)} · {stats.maxDrawdown.toFixed(1)}%</span></div>
              <div className="border border-outline-variant bg-surface-container-low p-2"><span className="block font-caption-mono text-[8px] uppercase text-tertiary">Discipline gap</span><span className={`font-caption-mono text-[10px] font-semibold ${disciplineGapR > 0 ? 'text-secondary' : 'text-on-surface'}`}>{disciplineGapR.toFixed(2)}R</span></div>
              <div className="col-span-2 border border-outline-variant bg-surface-container-low p-2"><span className="font-caption-mono text-[8px] uppercase text-tertiary">Status</span><span className="ml-2 font-caption-mono text-[10px] font-semibold text-on-surface">{stats.closedTrades} closed trades</span></div>
            </div>}

            {/* Geometric Light/Dark Vector Line Chart (Inline SVG) */}
            <div className="group relative flex h-[clamp(14rem,62vw,20rem)] w-full min-w-0 flex-col justify-between overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-space-md shadow-inner sm:h-80">
              
              {/* Grid Matrix Background Lines */}
              <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-40">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="border-b border-r border-outline-variant/60"></div>
                ))}
              </div>

              {/* SVG Vector Data Line */}
              <svg className="absolute inset-0 w-full h-full p-4 overflow-visible text-on-surface" preserveAspectRatio="none" viewBox="0 0 1000 300">
                <defs>
                  <linearGradient id="glyphEquityFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Main Equity Curve Gradient Fill Area */}
                <polygon fill="url(#glyphEquityFill)" points={chartGeometry.fillPoints} />

                {/* Flawless execution equity path */}
                <polyline
                  fill="none"
                  points={chartGeometry.flawlessPathPoints}
                  stroke="#e30613"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />

                {/* Main Equity Path Stroke */}
                <polyline
                  fill="none"
                  points={chartGeometry.pathPoints}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                />

                {/* Peak indicator crosshair marker */}
                <circle
                  cx={chartGeometry.peak.x}
                  cy={chartGeometry.peak.y}
                  fill="currentColor"
                  stroke="#ffffff"
                  strokeWidth="2"
                  r="5"
                />
                <line
                  opacity="0.4"
                  stroke="#747878"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                  x1={chartGeometry.peak.x}
                  x2={chartGeometry.peak.x}
                  y1="10"
                  y2="290"
                />

                {/* Trade execution dots */}
                {chartGeometry.dots.filter((dot) => !dot.isMissed).slice(-10).map((dot, idx) => (
                  <g key={idx}>
                    <circle
                      cx={dot.x}
                      cy={dot.y}
                      fill={dot.isWin ? 'currentColor' : '#e30613'}
                      r={dot.isWin ? 4.5 : 5}
                    />
                    {dot.isWin && (
                      <circle cx={dot.x} cy={dot.y} fill="#ffffff" r="2" />
                    )}
                  </g>
                ))}
              </svg>

              {/* Floating Peak Card Overlay */}
              <div className="relative z-10 self-end bg-white/95 dark:bg-surface-container/95 backdrop-blur-md border border-outline-variant px-space-md py-space-xs rounded-full shadow-sm flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                <span className="font-caption-mono text-caption-mono text-on-surface font-bold">
                  PEAK P&L: {formatCurrency(chartGeometry.peak.val, currency)}
                </span>
                <span className="font-caption-mono text-caption-mono text-tertiary">| OPEN TRADES: {stats.openTrades}</span>
              </div>

              {/* Bottom Axis Labels */}
              <div className="relative z-10 w-full flex items-center justify-between font-caption-mono text-caption-mono text-tertiary pt-2 border-t border-outline-variant/60 font-medium">
                {chartAxis.map((date, index) => <span key={`${date}-${index}`}>{date === 'Start' ? 'Start' : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>)}
              </div>
            </div>

          </div>

          {/* RECENT EXECUTED TRADES SNIPPET */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-3 sm:p-space-lg shadow-sm flex flex-col gap-2 sm:gap-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-space-sm">
              <div className="flex items-center gap-space-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-primary-container"></div>
                <h3 className="font-headline-md text-sm sm:text-headline-md text-on-surface font-bold">
                  RECENT EXECUTIONS
                </h3>
                <span className="hidden sm:inline font-caption-mono text-caption-mono text-on-surface-variant bg-surface-container-high px-space-sm py-0.5 rounded-full font-semibold">
                  BATCH #{trades.length}
                </span>
              </div>
              <button
                onClick={onNavigateToTrades}
                className="hidden sm:flex font-caption-mono text-caption-mono text-on-surface hover:text-outline transition-colors items-center gap-1 font-semibold group cursor-pointer"
              >
                <span>EXPLORE COMPLETE LEDGER</span>
                <span className="material-symbols-outlined text-body-sm group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>

            {/* Trades List Container */}
            <div className="flex flex-col gap-space-xs">
              {recentTrades.map((t) => {
                const tickerClean = t.symbol.replace(/[^a-zA-Z0-9]/g, '');
                const initials = tickerClean.slice(0, 2).toUpperCase() || 'TR';
                const isWin = t.pnl >= 0;

                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTrade(t)}
                    className="bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 p-2.5 sm:p-space-md rounded-xl transition-all flex flex-row items-center justify-between gap-2 sm:gap-space-sm group cursor-pointer"
                  >
                    <div className="flex items-center gap-2 sm:gap-space-md min-w-0">
                      <div className="hidden sm:flex w-10 h-10 rounded-full bg-surface-container-highest text-on-surface items-center justify-center font-display text-body-md font-bold shrink-0 border border-outline-variant/60">
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 sm:gap-space-sm flex-wrap">
                          <span className="font-display text-sm sm:text-body-lg font-bold text-on-surface">
                            {t.symbol}
                          </span>
                          <span
                            className={`px-1.5 sm:px-space-sm py-0.5 rounded-full font-caption-mono text-[9px] sm:text-caption-mono uppercase font-bold ${
                              t.side === 'Long'
                                ? 'bg-surface-container-highest text-on-surface'
                                : 'bg-surface-container text-outline'
                            }`}
                          >
                            {t.side}
                          </span>
                          <span className="hidden sm:inline px-space-sm py-0.5 rounded-full bg-surface-container font-caption-mono text-caption-mono text-outline font-medium uppercase">
                            {t.setup || 'CORE_EXEC'}
                          </span>
                          <span className="hidden sm:inline px-space-sm py-0.5 rounded-full bg-surface-container font-caption-mono text-caption-mono text-outline font-medium">
                            {t.partialExits?.length ? 'PARTIAL EXITS' : `${t.quantity ?? '—'} UNITS`}
                          </span>
                        </div>
                        <div className="hidden sm:flex font-caption-mono text-caption-mono text-on-surface-variant items-center gap-space-xs mt-0.5 font-medium">
                          <span>ENTRY: ${t.entryPrice.toFixed(2)}</span>
                          <span>→</span>
                          <span>EXIT: ${(t.exitPrice || t.entryPrice).toFixed(2)}</span>
                          <span>•</span>
                          <span>HOLD: {t.timeframe || '15M'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center justify-between md:justify-end gap-space-lg shrink-0">
                      <div className="flex flex-col items-start md:items-end">
                        <span
                          className={`font-table-data text-table-data font-bold ${
                            isWin ? 'text-on-surface' : 'text-secondary'
                          }`}
                        >
                          {isWin ? '+' : ''}${Math.abs(t.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="font-caption-mono text-caption-mono text-outline font-medium">
                          {isWin ? '+' : ''}{(t.realizedR || 0).toFixed(2)} R-MULTIPLE
                        </span>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full ${
                          isWin ? 'bg-primary' : 'bg-primary-container'
                        }`}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom execution status micro-bar */}
            <div className="hidden sm:flex items-center justify-end bg-surface-container-low border border-outline-variant px-space-md py-space-sm rounded-full">
              <span className="font-caption-mono text-caption-mono text-on-surface font-semibold">
                CLOSED TRADES: {stats.closedTrades} · NET {formatCurrency(stats.netPnL, currency)}
              </span>
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: 4 COLUMNS (WIDGETS & HARDWARE-INSPIRED OS MODULES) */}
        <div className="lg:col-span-4 flex flex-col gap-3 sm:gap-space-lg min-w-0">
          <div className="hidden lg:flex bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-lg shadow-sm flex-col gap-space-md">
            <div className="flex items-start justify-between gap-space-sm">
              <div>
                <p className="flex items-center gap-1.5 font-caption-mono text-caption-mono text-tertiary tracking-widest uppercase"><span className="h-1.5 w-1.5 rounded-full bg-primary-container" />Trade entry</p>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold mt-1">Log a trade</h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Start here, then add the execution details.</p>
              </div>
              <button onClick={() => onOpenNewTrade()} aria-label="Open trade form" className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_4px_12px_rgba(227,6,19,0.3)] shrink-0 cursor-pointer">
                <span className="material-symbols-outlined text-headline-md">add</span>
              </button>
            </div>
            <div className="flex items-center justify-between gap-space-sm font-caption-mono text-caption-mono text-tertiary">
              <span>Opens the full trade form</span>
              <button onClick={() => onOpenNewTrade()} className="font-semibold text-on-surface underline cursor-pointer">Advanced entry</button>
            </div>
          </div>

          <section className="relative bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm flex flex-col gap-space-sm overflow-hidden">
            <span aria-hidden="true" className="pointer-events-none absolute left-2 top-2 h-2 w-2 border-l border-t border-outline-variant" />
            <span aria-hidden="true" className="pointer-events-none absolute right-2 top-2 h-2 w-2 border-r border-t border-outline-variant" />
            <span aria-hidden="true" className="pointer-events-none absolute left-2 bottom-2 h-2 w-2 border-l border-b border-outline-variant" />
            <span aria-hidden="true" className="pointer-events-none absolute right-2 bottom-2 h-2 w-2 border-r border-b border-outline-variant" />
            <div className="flex items-center justify-between gap-space-sm border-b border-outline-variant/60 pb-space-sm px-1">
              <span className="flex items-center gap-2 font-caption-mono text-caption-mono text-on-surface tracking-[0.22em] uppercase font-bold"><span className="h-1.5 w-1.5 rounded-full bg-primary-container shadow-[0_0_8px_rgba(227,6,19,0.5)]" />Risk check-in</span>
              <div className="inline-flex shrink-0 rounded-full bg-surface-container-low p-0.5" role="group" aria-label="Risk check-in period">
                {(['daily', 'weekly', 'monthly', 'custom'] as const).map((period) => <button key={period} type="button" aria-pressed={riskPeriod === period} onClick={() => setRiskPeriod(period)} className={`px-2 py-1 rounded-full font-caption-mono text-[9px] sm:text-[10px] tracking-wider uppercase transition-colors cursor-pointer ${riskPeriod === period ? 'bg-on-surface text-surface-container-lowest shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>{period === 'custom' ? 'Dates' : period}</button>)}
              </div>
            </div>
            {riskPeriod === 'custom' && <div className="flex items-center gap-2 px-1" aria-label="Custom risk adherence date range"><label className="min-w-0 flex-1"><span className="sr-only">Start date</span><input type="date" value={customRiskStart} max={customRiskEnd} onChange={(event) => setCustomRiskStart(event.target.value)} className="min-h-8 w-full min-w-0 rounded-md border border-outline-variant bg-surface-container-low px-2 font-caption-mono text-[10px] text-on-surface" /></label><span className="font-caption-mono text-[10px] text-tertiary">to</span><label className="min-w-0 flex-1"><span className="sr-only">End date</span><input type="date" value={customRiskEnd} min={customRiskStart} max={localDateKey(clockNow)} onChange={(event) => setCustomRiskEnd(event.target.value)} className="min-h-8 w-full min-w-0 rounded-md border border-outline-variant bg-surface-container-low px-2 font-caption-mono text-[10px] text-on-surface" /></label></div>}
            <div className="grid grid-cols-2 divide-x divide-outline-variant/70 py-1">
              <div className="pr-3"><p className="font-caption-mono text-[10px] text-tertiary tracking-wider uppercase">Plan followed · {riskPeriodLabel}</p><p className="font-display text-4xl leading-none text-on-surface font-bold mt-1">{adherencePercent === null ? '—' : <>{adherencePercent}<span className="text-xl text-tertiary">%</span></>}</p><p className="font-caption-mono text-[10px] text-on-surface-variant mt-1.5">{followedPlanCount} of {executedRiskTrades.length} executed trades</p></div>
              <div className="pl-3"><p className="font-caption-mono text-[10px] text-tertiary tracking-wider uppercase">{periodDrawdown > 0 ? `${riskPeriodLabel} drawdown` : 'Adherence grade'}</p><p className={`font-display text-4xl leading-none font-bold tracking-tight mt-1 ${periodDrawdown > 0 ? 'text-secondary' : 'text-on-surface'}`}>{periodDrawdown > 0 ? `−${formatCurrency(periodDrawdown, currency)}` : adherenceGrade.endsWith('′') ? <>{adherenceGrade.slice(0, -1)}<span className="text-primary-container">′</span></> : adherenceGrade}</p><p className="font-caption-mono text-[10px] text-on-surface-variant mt-1.5">{periodDrawdown > 0 ? 'From period peak' : adherencePercent === null ? 'No score yet' : `${adherencePercent}% adherence`}</p></div>
            </div>
            <div className="h-[3px] rounded-full bg-surface-container-highest overflow-hidden" aria-label={`${adherencePercent ?? 0}% plan adherence`}><div className={`h-full transition-all ${adherencePercent !== null && adherencePercent < 70 ? 'bg-secondary' : 'bg-primary'}`} style={{ width: `${adherencePercent ?? 0}%` }} /></div>
            <div className="flex items-center justify-between gap-2 border-t border-outline-variant/60 pt-space-sm px-1 min-w-0">
              <p className="font-caption-mono text-[10px] text-on-surface-variant truncate">{latestRiskTrade ? <><span className="text-tertiary">✓&nbsp; Latest check-in:</span> <span className="text-on-surface font-semibold">{latestRiskTrade.emotion}</span> · {latestRiskTrade.rulesFollowed ? 'plan followed' : 'plan not followed'}</> : 'Log a trade to track your plan adherence.'}</p>
              {latestRiskTrade && <span className={`shrink-0 font-caption-mono text-[9px] font-bold tracking-wide ${latestRiskTrade.rulesFollowed ? 'text-primary' : 'text-secondary'}`}>{latestRiskTrade.rulesFollowed ? '[ON PLAN]' : '[OFF PLAN]'}</span>}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm flex flex-col gap-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-space-sm">
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-on-surface" /><span className="font-caption-mono text-caption-mono text-on-surface tracking-widest uppercase font-semibold">GLOBAL_SESSIONS</span></span>
              </div>
              <span className="ml-2 flex shrink-0 items-center gap-1.5 font-caption-mono text-[10px] text-tertiary"><span className="h-1.5 w-1.5 rounded-full bg-primary-container animate-pulse" />REALTIME</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {[
                { name: 'LONDON', zone: 'Europe/London', open: 8, close: 17 },
                { name: 'NEW YORK', zone: 'America/New_York', open: 8, close: 17 },
                { name: 'TOKYO', zone: 'Asia/Tokyo', open: 9, close: 18 },
              ].map((session) => {
                const state = sessionState(session.zone, session.open, session.close);
                const isOpen = state === 'OPEN';
                const icon = session.name === 'TOKYO' ? 'bedtime' : session.name === 'NEW YORK' ? 'nest_clock_farsight_analog' : 'schedule';
                return <div key={session.name} className={`min-w-0 rounded-xl border px-1 py-2 flex flex-col items-center justify-center gap-1 transition-colors ${isOpen ? 'border-on-surface bg-surface-container-low' : 'border-outline-variant bg-surface-container-low'}`}>
                  <span className={`font-caption-mono text-[9px] tracking-wide font-semibold ${isOpen ? 'text-on-surface' : 'text-tertiary'}`}>{session.name}</span>
                  <span className={`relative w-8 h-8 rounded-full flex items-center justify-center ${isOpen ? 'bg-on-surface text-surface' : 'bg-surface-container-highest text-tertiary'}`}><span className="material-symbols-outlined text-body-sm">{icon}</span>{isOpen && <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-primary-container" />}</span>
                  <span className="font-caption-mono text-[10px] text-on-surface font-bold tabular-nums">{sessionClock(session.zone)}</span>
                  <span className={`rounded-full px-2 py-0.5 font-caption-mono text-[9px] tracking-wide font-bold ${isOpen ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-highest text-tertiary'}`}>{state}</span>
                </div>;
              })}
            </div>
            <section className="flex min-w-0 flex-col gap-space-sm">
              <div className="flex items-center justify-between gap-2">
                <button type="button" aria-expanded={sessionWidgetExpanded} onClick={() => setSessionWidgetExpanded((expanded) => !expanded)} className="flex min-w-0 items-center gap-1 font-caption-mono text-[10px] font-bold tracking-wider text-on-surface uppercase cursor-pointer">
                  <span className="text-secondary">[03]</span><span>Trades by session</span><span className="material-symbols-outlined text-body-sm text-tertiary">{sessionWidgetExpanded ? 'expand_less' : 'expand_more'}</span>
                </button>
                <div className="inline-flex shrink-0 rounded-full bg-surface-container-highest p-0.5" role="group" aria-label="Session performance period">
                  {(['D', 'W', 'M', 'ALL'] as const).map((period) => <button key={period} type="button" aria-pressed={sessionPerformancePeriod === period} onClick={() => setSessionPerformancePeriod(period)} className={`rounded-full px-2 py-1 font-caption-mono text-[9px] font-bold transition-colors ${sessionPerformancePeriod === period ? 'bg-on-surface text-surface-container-lowest' : 'text-on-surface-variant hover:text-on-surface'}`}>{period}</button>)}
                </div>
              </div>
              {sessionWidgetExpanded && <>
              <div className="space-y-2">
                {sessionPerformance.map((session) => {
                  const recent = [...session.records].sort((a, b) => `${b.exitDate || b.entryDate}T${b.exitTime || b.entryTime || '00:00'}`.localeCompare(`${a.exitDate || a.entryDate}T${a.exitTime || a.entryTime || '00:00'}`)).slice(0, 10).reverse();
                  return <div key={session.name} className={`rounded-lg border p-2.5 ${session.name === 'New York' && sessionState('America/New_York', 8, 17) === 'OPEN' ? 'border-secondary' : 'border-outline-variant'} bg-surface-container-lowest`}>
                    <div className="flex items-center justify-between gap-2"><span className="font-body-sm text-body-sm font-bold text-on-surface">{session.name.toUpperCase()} {session.name === 'New York' && sessionState('America/New_York', 8, 17) === 'OPEN' ? <span className="text-secondary">· OPEN</span> : null}</span><span className={`font-table-data text-body-sm font-bold ${session.pnl < 0 ? 'text-secondary' : 'text-success'}`}>{session.pnl > 0 ? '+' : ''}{formatCurrency(session.pnl, currency)}</span></div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {[
                        ['TRADES', String(session.count)],
                        ['WIN RATE', `${session.winRate.toFixed(1)}%`],
                        ['AVG R:R', `${session.averageR >= 0 ? '+' : ''}${session.averageR.toFixed(2)}R`],
                        ['PROFIT FACTOR', session.profitFactor === Infinity ? '∞' : session.profitFactor.toFixed(2)],
                      ].map(([label, value]) => <div key={label} className="rounded border border-outline-variant bg-surface-container-low px-2 py-1"><span className="block font-caption-mono text-[8px] text-tertiary">{label}</span><span className="font-caption-mono text-[10px] font-bold text-on-surface">{value}</span></div>)}
                    </div>
                    <div className="mt-2 flex items-center justify-between"><span className="font-caption-mono text-[8px] text-tertiary">EXECUTION PIPS · LAST 10</span><span className="font-caption-mono text-[8px] text-tertiary">{session.wins}W / {session.losses}L</span></div>
                    <div className="mt-1 flex gap-1">{recent.map((trade) => <span key={trade.id} title={`${trade.symbol}: ${trade.pnl > 0 ? '+' : ''}${formatCurrency(trade.pnl, currency)}`} className={`h-2.5 w-2.5 ${trade.pnl > 0 ? 'bg-on-surface' : trade.pnl < 0 ? 'bg-secondary' : 'bg-outline-variant'}`} />)}</div>
                    {session.topSetup && <p className="mt-2 truncate font-caption-mono text-[8px] text-tertiary">TOP SETUP · <span className="text-on-surface">{session.topSetup}</span></p>}
                  </div>;
                })}
                {!sessionPerformance.some((session) => session.count > 0) && <p className="font-caption-mono text-[9px] text-tertiary">No session-tagged closed trades in this period.</p>}
              </div>
              </>}
            </section>
          </section>

          <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-space-md shadow-sm flex flex-col gap-space-sm" aria-label="Trading insights">
            <div className="flex items-center justify-between gap-2 border-b border-outline-variant/60 pb-space-sm"><div className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary-container" /><h2 className="font-caption-mono text-[10px] tracking-[0.16em] text-on-surface uppercase font-bold">Trade insights</h2></div><span className="border border-outline-variant bg-surface-container-low px-2 py-1 font-caption-mono text-[8px] tracking-wider text-tertiary uppercase">Session diagnostics</span></div>
            <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-1">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center justify-between gap-2"><p className="font-caption-mono text-[8px] tracking-[0.14em] text-tertiary uppercase">Most tagged mistakes</p><span className="font-caption-mono text-[7px] tracking-wider text-tertiary uppercase">Relative frequency</span></div>
                {dashboardRankings.mistakes.length ? <ol className="space-y-2">{dashboardRankings.mistakes.map(({ name, count, share }, index) => <li key={name} className="min-w-0"><div className="mb-1 flex min-w-0 items-center justify-between gap-2"><span className="truncate font-caption-mono text-[9px] text-on-surface"><span className="mr-1.5 text-tertiary">0{index + 1}</span>{name}</span><span className="shrink-0 font-caption-mono text-[8px] tabular-nums text-secondary">{count}× <span className="text-tertiary">({share}%)</span></span></div><div className="h-1 rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-primary-container" style={{ width: `${share}%` }} /></div></li>)}</ol> : <p className="font-caption-mono text-[9px] text-tertiary">No mistakes tagged yet.</p>}
              </div>
              <div className="min-w-0 border-t border-outline-variant/60 pt-space-sm sm:border-l sm:border-t-0 sm:pl-space-md sm:pt-0 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-space-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2"><p className="font-caption-mono text-[8px] tracking-[0.14em] text-tertiary uppercase">Most profitable strategies</p><span className="font-caption-mono text-[7px] tracking-wider text-tertiary uppercase">Gain share</span></div>
                {dashboardRankings.strategies.length ? <ol className="space-y-2">{dashboardRankings.strategies.map((strategy, index) => <li key={strategy.name} className="min-w-0"><div className="mb-1 flex min-w-0 items-center justify-between gap-2"><span className="truncate font-caption-mono text-[9px] text-on-surface"><span className="mr-1.5 text-tertiary">0{index + 1}</span>{strategy.name}</span><span className="shrink-0 font-caption-mono text-[8px] tabular-nums text-on-surface">+{formatCurrency(strategy.pnl, currency)} <span className="text-tertiary">({strategy.share}%)</span></span></div><div className="h-1 rounded-full bg-surface-container-highest"><div className="h-full rounded-full bg-on-surface" style={{ width: `${strategy.share}%` }} /></div></li>)}</ol> : <p className="font-caption-mono text-[9px] text-tertiary">No profitable strategy results yet.</p>}
              </div>
            </div>
          </section>

          <div className="hidden">
          
          {/* QUICK TRADE QUICK-LOGGER DRAWER TRIGGER CARD */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg shadow-sm relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
                  <span className="font-caption-mono text-caption-mono text-outline tracking-widest uppercase font-semibold">
                    RECORDER_MODULE
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface font-bold mt-1">
                  LOG LIVE EXECUTION
                </h3>
                <p className="font-body-sm text-body-sm text-outline mt-1 font-medium">
                  Manual trade imprint &amp; psychological state snapshot.
                </p>
              </div>
              {/* Nothing Iconic Red Button Trigger */}
              <button
                onClick={() => onOpenNewTrade()}
                className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_4px_12px_rgba(227,6,19,0.35)] shrink-0 cursor-pointer"
                title="Open Trade Log Modal"
              >
                <span className="material-symbols-outlined text-body-lg">add</span>
              </button>
            </div>

            {/* Fast Mini Input Fields Inside Card */}
            <div className="mt-space-md grid grid-cols-2 gap-space-sm">
              <div className="bg-surface-container-low border border-outline-variant px-space-md py-space-xs rounded-xl flex flex-col">
                <span className="font-caption-mono text-caption-mono text-outline uppercase font-semibold">TICKER</span>
                <input
                  value={quickTicker}
                  onChange={(e) => setQuickTicker(e.target.value.toUpperCase())}
                  className="bg-transparent font-caption-mono text-body-md text-on-surface font-bold outline-none placeholder:text-outline-variant uppercase"
                  placeholder="$ES_F"
                  type="text"
                />
              </div>
              <div className="bg-surface-container-low border border-outline-variant px-space-md py-space-xs rounded-xl flex flex-col">
                <span className="font-caption-mono text-caption-mono text-outline uppercase font-semibold">SIDE</span>
                <div className="flex items-center gap-space-xs mt-1">
                  <button
                    onClick={() => setQuickSide('Long')}
                    className={`px-space-sm py-0.5 rounded-full font-caption-mono text-caption-mono font-bold transition-all cursor-pointer ${
                      quickSide === 'Long'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-highest text-outline hover:text-on-surface font-medium'
                    }`}
                  >
                    LONG
                  </button>
                  <button
                    onClick={() => setQuickSide('Short')}
                    className={`px-space-sm py-0.5 rounded-full font-caption-mono text-caption-mono font-bold transition-all cursor-pointer ${
                      quickSide === 'Short'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-highest text-outline hover:text-on-surface font-medium'
                    }`}
                  >
                    SHORT
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-space-sm flex items-center justify-between text-caption-mono font-caption-mono text-outline px-1">
              <span>DEFAULT RISK: 1.0% ($840)</span>
              <button
                onClick={() => onOpenNewTrade()}
                className="text-on-surface font-semibold underline cursor-pointer hover:text-primary"
              >
                ADVANCED LOG +
              </button>
            </div>
          </div>

          {/* DAILY DISCIPLINE & EMOTION GAUGE */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span className="font-caption-mono text-caption-mono text-outline tracking-widest uppercase font-semibold">
                  DISCIPLINE_CORE
                </span>
              </div>
              <span className="font-caption-mono text-caption-mono bg-surface-container-low border border-outline-variant px-space-sm py-0.5 rounded-full text-on-surface font-bold">
                SESSION #{trades.length || 88}
              </span>
            </div>

            {/* Score readout */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-caption-mono text-caption-mono text-outline block font-medium">
                  RULE COMPLIANCE
                </span>
                <span className="font-display text-display text-on-surface tracking-tighter font-bold">
                  {stats.winRate > 60 ? '94%' : '88%'}
                </span>
              </div>
              <div className="text-right">
                <span className="font-caption-mono text-caption-mono text-outline block font-medium">GRADE</span>
                <span className="font-headline-lg text-headline-lg text-on-surface font-bold">
                  {stats.winRate > 60 ? 'A_PRIME' : 'B_PASS'}
                </span>
              </div>
            </div>

            {/* Daily Drawdown Limiter Bar */}
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center justify-between font-caption-mono text-caption-mono">
                <span className="text-outline">MAX DAILY DRAWDOWN USED</span>
                <span className="text-on-surface font-bold">
                  $320 / $3,500 (9.1%)
                </span>
              </div>
              <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: '9.1%' }}
                ></div>
              </div>
              <span className="font-caption-mono text-caption-mono text-outline">
                CIRCUIT BREAKER: 3 STOP-OUTS REMAINING
              </span>
            </div>

            {/* Emotional State Tracker Pills */}
            <div className="flex flex-col gap-space-xs pt-space-xs">
              <span className="font-caption-mono text-caption-mono text-outline tracking-wider uppercase font-semibold">
                PSYCHOLOGICAL STATE VECTOR:
              </span>
              <div className="flex flex-wrap gap-space-xs">
                {(['NEUTRAL', 'FOCUSED', 'PATIENT', 'REVENGE-FREE'] as const).map((emotion) => {
                  const isActive = selectedEmotion === emotion;
                  return (
                    <button
                      key={emotion}
                      onClick={() => setSelectedEmotion(emotion)}
                      className={`px-space-md py-1 rounded-full font-caption-mono text-caption-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-primary text-on-primary font-bold shadow-sm'
                          : 'bg-surface-container-low border border-outline-variant text-outline hover:text-on-surface font-medium'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          emotion === 'REVENGE-FREE'
                            ? 'bg-primary-container'
                            : isActive
                            ? 'bg-on-primary'
                            : 'bg-outline-variant'
                        }`}
                      ></span>
                      <span>{emotion}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* MARKET SESSION TELEMETRY WIDGET */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                <span className="font-caption-mono text-caption-mono text-outline tracking-widest uppercase font-semibold">
                  GLOBAL_SESSIONS
                </span>
              </div>
              <span className="font-caption-mono text-caption-mono text-on-surface font-bold">SYNC: REALTIME</span>
            </div>

            {/* Session Clocks (London / NY / Tokyo) */}
            <div className="grid grid-cols-3 gap-space-sm text-center">
              {/* London */}
              <div className="bg-surface-container-low border border-outline-variant p-space-sm rounded-xl flex flex-col items-center">
                <span className="font-caption-mono text-caption-mono text-outline font-semibold">LONDON</span>
                <div className="w-10 h-10 my-1 rounded-full bg-surface-container-highest flex items-center justify-center relative">
                  <span className="material-symbols-outlined text-body-sm text-on-surface-variant">schedule</span>
                </div>
                <span className="font-caption-mono text-caption-mono text-on-surface font-bold">15:32</span>
                <span className="font-caption-mono text-caption-mono text-outline mt-0.5">CLOSING</span>
              </div>

              {/* New York (Active) */}
              <div className="bg-surface-container-low border-2 border-primary/20 p-space-sm rounded-xl flex flex-col items-center relative overflow-hidden shadow-sm">
                <span className="font-caption-mono text-caption-mono text-on-surface font-bold">NEW YORK</span>
                <div className="w-10 h-10 my-1 rounded-full bg-primary text-on-primary flex items-center justify-center relative shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-primary-container absolute top-1 right-1"></span>
                  <span className="material-symbols-outlined text-body-sm">nest_clock_farsight_analog</span>
                </div>
                <span className="font-caption-mono text-caption-mono text-on-surface font-bold">10:32</span>
                <span className="font-caption-mono text-caption-mono text-primary font-bold mt-0.5">OPEN_PEAK</span>
              </div>

              {/* Tokyo */}
              <div className="bg-surface-container-low border border-outline-variant p-space-sm rounded-xl flex flex-col items-center opacity-70">
                <span className="font-caption-mono text-caption-mono text-outline font-semibold">TOKYO</span>
                <div className="w-10 h-10 my-1 rounded-full bg-surface-container-highest flex items-center justify-center relative">
                  <span className="material-symbols-outlined text-body-sm text-on-surface-variant">bedtime</span>
                </div>
                <span className="font-caption-mono text-caption-mono text-outline font-medium">00:32</span>
                <span className="font-caption-mono text-caption-mono text-outline mt-0.5">DORMANT</span>
              </div>
            </div>

            {/* VIX Level Pod */}
            <div className="bg-surface-container-low border border-outline-variant p-space-md rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-body-md text-on-surface">waves</span>
                <div className="flex flex-col">
                  <span className="font-caption-mono text-caption-mono text-outline uppercase font-semibold">IMPLIED VOLATILITY (VIX)</span>
                  <span className="font-table-data text-table-data text-on-surface font-bold">14.82 REGIME</span>
                </div>
              </div>
              <div className="px-space-md py-1 rounded-full bg-surface-container-highest border border-surface-container-highest font-caption-mono text-caption-mono text-on-surface font-bold">
                LOW RISK
              </div>
            </div>

            {/* News Catalyst Alert Pill Banner */}
            <div className="bg-surface-container-low border border-outline-variant p-space-md rounded-xl flex items-start gap-space-sm">
              <span className="w-2 h-2 rounded-full bg-primary-container shrink-0 mt-1 shadow-[0_0_8px_rgba(227,6,19,0.7)]"></span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center justify-between gap-space-xs">
                  <span className="font-caption-mono text-caption-mono text-on-surface font-bold">
                    FED SPEECH CATALYST // IN 1H 28M
                  </span>
                  <span className="font-caption-mono text-caption-mono text-outline font-medium">15:00 UTC</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
                  FOMC Member Waller remarks on liquidity reserves. Anticipate spread widening on $NQ and $ES.
                </p>
              </div>
            </div>

          </div>

          </div>
        </div>

      </div>

      {/* Recent 30 days */}
      <section className="hidden md:flex bg-surface-container-lowest border border-outline-variant rounded-xl p-space-lg shadow-sm flex-col gap-space-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b border-outline-variant/60 pb-space-sm">
          <div className="flex items-center gap-space-sm">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
              CADENCE HEATMAP // 30-DAY EXECUTION MATRIX
            </h3>
          </div>
          <div className="flex items-center gap-space-md font-caption-mono text-caption-mono text-outline font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-surface-container-low border border-outline-variant"></span>NO TRADE
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-error-container border border-error/20"></span>SCRATCH/LOSS
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary"></span>PROFITABLE
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-container"></span>TODAY
            </span>
          </div>
        </div>

        {/* 30-Day Dot/Tile Grid */}
        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-30 gap-1.5 py-space-xs">
          {monthDays.map((d) => {
            if (d.isToday) {
              return (
                <div
                  key={d.day}
                  className="h-9 rounded-sm bg-surface-container border-2 border-primary flex flex-col items-center justify-center font-caption-mono text-caption-mono text-on-surface font-bold relative shadow-sm"
                  title={`${d.date}: ${d.status === 'none' ? 'No closed trades' : `${formatCurrency(d.pnl, currency)} net`}`}
                >
                  <span>{String(d.day).padStart(2, '0')}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                </div>
              );
            }
            if (d.status === 'profit') {
              return (
                <div
                  key={d.day}
                  className="h-9 rounded-sm bg-primary flex items-center justify-center font-caption-mono text-caption-mono text-on-primary font-bold shadow-xs transition-transform hover:scale-105"
                  title={`${d.date}: ${formatCurrency(d.pnl, currency)} net`}
                >
                  {String(d.day).padStart(2, '0')}
                </div>
              );
            }
            if (d.status === 'loss') {
              return (
                <div
                  key={d.day}
                  className="h-9 rounded-sm bg-error-container border border-error/30 flex items-center justify-center font-caption-mono text-caption-mono text-secondary font-bold transition-transform hover:scale-105"
                  title={`${d.date}: ${formatCurrency(d.pnl, currency)} net`}
                >
                  {String(d.day).padStart(2, '0')}
                </div>
              );
            }
            return (
              <div
                key={d.day}
                className="h-9 rounded-sm bg-surface-container-low border border-outline-variant flex items-center justify-center font-caption-mono text-caption-mono text-outline font-medium"
                title={`${d.date}: No closed trades`}
              >
                {String(d.day).padStart(2, '0')}
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
};
