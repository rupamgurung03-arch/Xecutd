import React, { useState, useMemo } from 'react';
import { Trade } from '../types/trade';
import { formatCurrency } from '../utils/calculations';

interface CalendarViewProps {
  trades: Trade[];
  currency: string;
  onSelectTrade: (trade: Trade) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  trades,
  currency,
  onSelectTrade,
}) => {
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDayString, setSelectedDayString] = useState<string>(() => localDateKey(new Date()));
  const [showWeekends, setShowWeekends] = useState(true);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const setToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayString(localDateKey(today));
  };

  const monthYearLabel = useMemo(() => {
    return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase();
  }, [currentDate]);

  // Aggregate trades by date
  const dayStatsMap = useMemo(() => {
    const map = new Map<string, { trades: Trade[]; netPnl: number; totalR: number; wins: number; losses: number; symbols: Set<string> }>();
    trades.forEach((t) => {
      const date = t.entryDate;
      if (!map.has(date)) {
        map.set(date, { trades: [], netPnl: 0, totalR: 0, wins: 0, losses: 0, symbols: new Set() });
      }
      const day = map.get(date)!;
      day.trades.push(t);
      if (t.tradeStatus !== 'MISSED') {
        day.netPnl += t.pnl || 0;
        day.totalR += t.realizedR || 0;
        if (t.pnl > 0) day.wins++;
        else if (t.pnl < 0) day.losses++;
      }
      day.symbols.add(t.symbol);
    });
    return map;
  }, [trades]);

  // Telemetry for current selected month
  const monthTelemetry = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let monthPnl = 0;
    let wins = 0;
    let losses = 0;
    let activeDays = 0;
    let monthTotalR = 0;
    let peakDay: { amount: number; date: string; setup: string; ticker: string } | null = null;
    let worstDay: { amount: number; date: string; setup: string; ticker: string } | null = null;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalWorkingDays = Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1).getDay()).filter((day) => day !== 0 && day !== 6).length;

    dayStatsMap.forEach((day, dateStr) => {
        const d = new Date(`${dateStr}T00:00:00`);
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (day.trades.some((trade) => trade.tradeStatus !== 'MISSED')) activeDays++;
        monthPnl += day.netPnl;
        wins += day.wins;
        losses += day.losses;
        monthTotalR += day.totalR;

        if (day.netPnl > 0 && (!peakDay || day.netPnl > peakDay.amount)) {
          peakDay = {
            amount: day.netPnl,
            date: dateStr,
            setup: day.trades[0]?.setup || 'No strategy set',
            ticker: day.trades[0]?.symbol || '',
          };
        }
        if (day.netPnl < 0 && (!worstDay || day.netPnl < worstDay.amount)) {
          worstDay = {
            amount: day.netPnl,
            date: dateStr,
            setup: day.trades[0]?.setup || 'No strategy set',
            ticker: day.trades[0]?.symbol || '',
          };
        }
      }
    });

    const totalTrades = wins + losses;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

    return {
      monthPnl,
      winRate,
      wins,
      losses,
      activeDays,
      totalWorkingDays,
      monthTotalR,
      peakDay: peakDay as { amount: number; date: string; setup: string; ticker: string } | null,
      worstDay: worstDay as { amount: number; date: string; setup: string; ticker: string } | null,
    };
  }, [currentDate, dayStatsMap]);

  // Calendar matrix days (7 cols x 5/6 rows)
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Prev month tail
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = localDateKey(prevDate);
      const stat = dayStatsMap.get(dateStr);
      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        stat,
      });
    }

    // Current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(dayNum).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      const stat = dayStatsMap.get(dateStr);
      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: true,
        stat,
      });
    }

    // Next month head
    const remaining = 35 - cells.length;
    for (let i = 1; i <= Math.max(0, remaining); i++) {
      const nextDate = new Date(year, month + 1, i);
      const dateStr = localDateKey(nextDate);
      const stat = dayStatsMap.get(dateStr);
      cells.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: false,
        stat,
      });
    }

    return cells;
  }, [currentDate, dayStatsMap]);

  // Trades on selected day
  const selectedDayTrades = useMemo(() => {
    return dayStatsMap.get(selectedDayString)?.trades || [];
  }, [selectedDayString, dayStatsMap]);
  const selectedDaySummary = useMemo(() => {
    const closed = selectedDayTrades.filter((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed');
    const wins = closed.filter((trade) => trade.pnl > 0).length;
    const setups = Array.from(new Set(closed.map((trade) => trade.setup).filter(Boolean)));
    return {
      pnl: closed.reduce((sum, trade) => sum + (trade.pnl || 0), 0),
      totalR: closed.reduce((sum, trade) => sum + (trade.realizedR || 0), 0),
      winRate: closed.length ? (wins / closed.length) * 100 : 0,
      closedCount: closed.length,
      setups,
    };
  }, [selectedDayTrades]);

  return (
    <div className="w-full flex flex-col gap-space-lg">
      
      {/* TOP TOOLBAR: Month Navigation & Mode Switchers */}
      <div className="w-full min-w-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 sm:gap-space-md bg-surface-container-lowest p-2.5 sm:p-space-md rounded-xl shadow-sm border border-outline-variant">
        <div className="flex min-w-0 w-full md:w-auto items-center gap-2 sm:gap-space-sm">
          <div className="flex min-w-0 w-full md:w-auto items-center gap-0.5 sm:gap-1 bg-surface-container-low rounded-full p-1 border border-outline-variant/80">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-body-lg">chevron_left</span>
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-1 sm:gap-space-xs px-1 sm:px-space-sm">
              <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-secondary"></span>
              <span className="truncate font-headline-md text-[11px] sm:text-body-md uppercase tracking-wider text-on-surface font-bold">
                {monthYearLabel}
              </span>
              <button
                onClick={setToday}
                className="sm:hidden shrink-0 px-2 py-1 rounded-full bg-surface-container-high hover:bg-surface-container text-tertiary hover:text-on-surface text-[9px] font-caption-mono tracking-wide uppercase transition-colors border border-outline-variant/80 cursor-pointer font-semibold"
              >
                Today
              </button>
            </div>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-body-lg">chevron_right</span>
            </button>
          </div>
          <button
            onClick={setToday}
            className="hidden sm:inline-flex px-space-md py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-tertiary hover:text-on-surface text-caption-mono font-caption-mono tracking-widest uppercase transition-all shadow-xs border border-outline-variant/80 cursor-pointer font-medium"
          >
            TODAY
          </button>
        </div>

        <div className="flex w-full md:w-auto items-center justify-between md:justify-end gap-2 sm:gap-space-sm">
          <button
            type="button"
            onClick={() => setShowWeekends((show) => !show)}
            aria-pressed={!showWeekends}
            className="flex min-w-0 items-center justify-center gap-space-xs rounded-full border border-outline-variant/80 bg-surface-container-low px-2.5 sm:px-space-md py-1.5 text-[10px] sm:text-caption-mono font-caption-mono font-semibold uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-body-md" aria-hidden="true">weekend</span>
            {showWeekends ? 'Hide weekends' : 'Show weekends'}
          </button>
          <label className="relative flex h-10 w-10 shrink-0 items-center justify-center gap-space-sm rounded-full border border-outline-variant/80 bg-surface-container-low px-2 sm:h-auto sm:w-auto sm:px-space-md sm:py-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-body-md" aria-hidden="true">calendar_month</span>
            <input
              type="month"
              aria-label="Jump to month"
              value={`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`}
              onChange={(event) => {
                if (!event.target.value) return;
                const [year, month] = event.target.value.split('-').map(Number);
                setCurrentDate(new Date(year, month - 1, 1));
                setSelectedDayString(`${event.target.value}-01`);
              }}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 sm:static sm:z-auto sm:h-auto sm:w-auto sm:min-w-0 sm:opacity-100 sm:bg-transparent font-caption-mono text-caption-mono font-semibold uppercase text-on-surface outline-none"
            />
          </label>
        </div>
      </div>

      {/* Monthly performance */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-space-md">
        
        {/* Primary Net Stat Card */}
        <div className="md:col-span-2 bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm relative overflow-hidden border border-outline-variant">
          <div className="absolute right-0 top-0 w-36 h-36 bg-gradient-to-br from-secondary/5 via-transparent to-transparent pointer-events-none rounded-full blur-2xl"></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs text-caption-mono font-caption-mono text-tertiary tracking-widest uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              MONTH P&amp;L
            </div>
            <span className="px-space-sm py-0.5 rounded-full bg-surface-container text-caption-mono font-caption-mono text-on-surface-variant font-medium border border-outline-variant/60">
              {monthTelemetry.winRate}% win rate
            </span>
          </div>
          <div className="my-space-md">
            <div className={`font-numeric-stat text-numeric-stat font-bold tracking-tight ${monthTelemetry.monthPnl >= 0 ? 'text-on-surface' : 'text-secondary'}`}>
              {monthTelemetry.monthPnl >= 0 ? '+' : ''}{formatCurrency(Math.abs(monthTelemetry.monthPnl), currency)}
            </div>
            <div className="flex items-center gap-space-sm mt-space-xs font-caption-mono text-caption-mono text-on-surface-variant">
              <span>REALIZED</span>
              <span>•</span>
              <span className="text-tertiary">{monthTelemetry.monthTotalR >= 0 ? '+' : ''}{monthTelemetry.monthTotalR.toFixed(2)}R</span>
            </div>
          </div>
          <div className="flex items-center gap-space-xs">
            <div className="h-1.5 flex-1 rounded-full bg-surface-container overflow-hidden flex">
              <div
                className="h-full bg-primary"
                style={{ width: `${monthTelemetry.winRate}%` }}
              ></div>
              <div
                className="h-full bg-secondary"
                style={{ width: `${100 - parseFloat(monthTelemetry.winRate)}%` }}
              ></div>
            </div>
            <span className="text-caption-mono font-caption-mono text-tertiary">
              {monthTelemetry.wins}W / {monthTelemetry.losses}L
            </span>
          </div>
        </div>

        {/* Execution Days Breakdown */}
        <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between text-caption-mono font-caption-mono text-tertiary tracking-widest uppercase font-semibold">
            <span>TRADING DAYS</span>
            <span className="material-symbols-outlined text-body-md text-tertiary">tune</span>
          </div>
          <div className="my-space-sm">
            <div className="font-numeric-stat text-numeric-stat text-on-surface font-bold">
              {monthTelemetry.activeDays} / {monthTelemetry.totalWorkingDays}
            </div>
            <div className="font-caption-mono text-caption-mono text-tertiary mt-space-xs uppercase">
              ACTIVE DAYS / WEEKDAYS
            </div>
          </div>
          <div className="flex items-center justify-between font-caption-mono text-caption-mono font-medium">
            <span className="text-on-surface flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> {monthTelemetry.wins} WINS
            </span>
            <span className="text-secondary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> {monthTelemetry.losses} LOSSES
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-start">
      {/* MAIN INTERACTIVE HEATMAP MATRIX */}
      <div className="lg:col-span-2 order-1 min-w-0 w-full bg-surface-container-lowest rounded-xl p-2.5 sm:p-space-lg shadow-sm flex flex-col gap-2 sm:gap-space-md border border-outline-variant">
        
        {/* Day Headers (Mon -> Sun) */}
        <div className={`grid min-w-0 ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} gap-1 sm:gap-space-sm text-center border-b border-outline-variant/80 pb-2`}>
          {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].filter((_, i) => showWeekends || i < 5).map((d, i) => (
            <div
              key={d}
              className={`min-w-0 text-[9px] sm:text-caption-mono font-caption-mono tracking-wide sm:tracking-widest uppercase py-1 ${i >= 5 ? 'text-tertiary' : 'text-on-surface-variant font-bold'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar 7x5 Matrix Cells */}
        <div className={`grid min-w-0 w-full ${showWeekends ? 'grid-cols-7' : 'grid-cols-5'} gap-1 sm:gap-space-sm`}>
          {calendarDays.filter((cell) => showWeekends || ![0, 6].includes(new Date(`${cell.dateStr}T00:00:00`).getDay())).map((cell, idx) => {
            const isSelected = selectedDayString === cell.dateStr;
            const hasTrades = !!cell.stat && cell.stat.trades.length > 0;
            const hasClosedTrades = !!cell.stat?.trades.some((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed');
            const isWin = hasTrades && cell.stat!.netPnl >= 0;
            const isLoss = hasTrades && cell.stat!.netPnl < 0;
            const mobilePnlClass = hasClosedTrades && cell.stat!.netPnl !== 0 ? (cell.stat!.netPnl < 0 ? 'calendar-mobile-loss' : 'calendar-mobile-win') : '';
            const isPeakDay = cell.isCurrentMonth && monthTelemetry.peakDay?.date === cell.dateStr;
            const isWeekend = [0, 6].includes(new Date(`${cell.dateStr}T00:00:00`).getDay());

            let cellClass = '';
            if (isSelected) {
              cellClass = 'ring-1 ring-primary-container border-primary-container bg-surface-container-high';
            } else if (!cell.isCurrentMonth) {
              cellClass = 'bg-surface-container-low flex flex-col justify-between opacity-45 select-none border border-outline-variant/50';
            } else if (hasTrades && isWin) {
              cellClass = 'day-cell cursor-pointer bg-surface-container-lowest border border-outline-variant flex flex-col justify-between transition-colors hover:border-on-surface-variant';
            } else if (hasTrades && isLoss) {
              cellClass = 'day-cell cursor-pointer bg-error-container/10 border border-error/60 flex flex-col justify-between transition-colors hover:border-error';
            } else {
              cellClass = `${isWeekend ? 'bg-surface-container-low' : 'bg-surface-container-lowest'} flex flex-col justify-between select-none border border-outline-variant/60`;
            }

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDayString(cell.dateStr);
                }}
                title={`${cell.dateStr}${hasTrades ? ` · ${formatCurrency(cell.stat!.netPnl, currency)}` : ''}`}
                className={`min-w-0 overflow-hidden rounded-sm p-0.5 sm:p-space-sm h-10 sm:h-24 lg:h-20 flex flex-col justify-between transition-colors cursor-pointer ${cellClass} ${mobilePnlClass}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-caption-mono text-caption-mono ${
                      isSelected ? 'text-on-surface font-bold' : cell.isCurrentMonth ? 'text-on-surface font-bold' : 'text-tertiary'
                    }`}
                  >
                    {String(cell.dayNum).padStart(2, '0')}
                  </span>
                  {isPeakDay && (
                    <span className="hidden sm:inline px-1 py-0.5 bg-primary text-on-primary text-[9px] leading-none font-caption-mono font-bold tracking-wide">
                      PEAK
                    </span>
                  )}
                  {hasTrades && (
                    <span className="hidden sm:inline px-space-xs py-0.5 rounded-full bg-surface-container-high text-[10px] font-caption-mono text-on-surface-variant font-semibold border border-outline-variant/50">
                      {cell.stat!.trades.length} T
                    </span>
                  )}
                </div>

                <div className="min-w-0 text-center">
                  {hasTrades ? (
                    <>
                    <div className="hidden sm:flex flex-col">
                      <span
                        className={`font-table-data text-table-data font-bold ${
                          isWin ? 'text-on-surface' : 'text-secondary'
                        }`}
                      >
                        {isWin ? '+' : '-'}${Math.abs(cell.stat!.netPnl).toFixed(0)}
                      </span>
                      <span className={`text-[10px] font-caption-mono font-semibold ${isWin ? 'text-on-surface' : 'text-secondary'}`}>
                        {cell.stat!.totalR >= 0 ? '+' : ''}{cell.stat!.totalR.toFixed(1)}R
                      </span>
                    </div>
                    </>
                  ) : (
                    <span className="hidden sm:inline text-tertiary/70 font-caption-mono text-[9px] uppercase tracking-wide">
                      {isWeekend && cell.isCurrentMonth ? 'MARKET CLOSED' : '·'}
                    </span>
                  )}
                </div>

                <div className="hidden sm:flex justify-between items-center text-caption-mono font-caption-mono text-tertiary pt-space-xs">
                  <span className="max-w-[70%] truncate px-space-xs rounded bg-surface-container-high text-[10px] font-caption-mono text-on-surface font-semibold border border-outline-variant/40 uppercase">
                    {hasTrades ? Array.from(cell.stat!.symbols).slice(0, 1).join('') : ''}
                  </span>
                  {hasTrades && (
                    <div className="flex gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${isWin ? 'bg-primary' : 'bg-secondary'}`}></span>
                      <span className={`w-1.5 h-1.5 rounded-full ${isWin ? 'bg-primary' : 'bg-secondary'}`}></span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="order-2 min-w-0 flex flex-col gap-space-lg">
      {/* Best and lowest trading day cards */}
      <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm border border-outline-variant">
        <div className="flex items-center justify-between text-caption-mono font-caption-mono text-tertiary tracking-widest uppercase font-semibold">
          <span>BEST DAY</span>
          <span className="flex items-center gap-space-sm">
            {monthTelemetry.peakDay && <span className="px-1.5 py-0.5 bg-primary text-on-primary text-[9px] font-caption-mono font-bold tracking-wide">PEAK</span>}
            <span className="material-symbols-outlined text-body-md text-on-surface">arrow_outward</span>
          </span>
        </div>
        <div className="my-space-sm">
          <div className="font-numeric-stat text-numeric-stat text-on-surface font-bold">
            {monthTelemetry.peakDay ? `+${formatCurrency(monthTelemetry.peakDay.amount, currency)}` : '—'}
          </div>
          <div className="font-caption-mono text-caption-mono text-tertiary mt-space-xs uppercase">
            {monthTelemetry.peakDay ? `${monthTelemetry.peakDay.date} · ${monthTelemetry.peakDay.setup}` : 'No profitable day logged this month'}
          </div>
        </div>
        <div className="flex items-center gap-space-xs text-caption-mono font-caption-mono text-tertiary">
          <span className="px-space-xs py-0.5 rounded bg-surface-container text-on-surface uppercase font-semibold border border-outline-variant/60">
            {monthTelemetry.peakDay?.ticker || '—'}
          </span>
          <span>Highest daily net P&amp;L</span>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between shadow-sm border border-outline-variant">
        <div className="flex items-center justify-between text-caption-mono font-caption-mono text-tertiary tracking-widest uppercase font-semibold">
          <span>LOWEST DAY</span>
          <span className="material-symbols-outlined text-body-md text-secondary">call_received</span>
        </div>
        <div className="my-space-sm">
          <div className="font-numeric-stat text-numeric-stat text-secondary font-bold">
            {monthTelemetry.worstDay ? formatCurrency(monthTelemetry.worstDay.amount, currency) : '—'}
          </div>
          <div className="font-caption-mono text-caption-mono text-tertiary mt-space-xs uppercase">
            {monthTelemetry.worstDay ? `${monthTelemetry.worstDay.date} · ${monthTelemetry.worstDay.setup}` : 'No losing day logged this month'}
          </div>
        </div>
        <div className="flex items-center gap-space-xs text-caption-mono font-caption-mono text-tertiary">
          <span className="px-space-xs py-0.5 rounded bg-surface-container text-on-surface uppercase font-semibold border border-outline-variant/60">
            {monthTelemetry.worstDay?.ticker || '—'}
          </span>
          <span>Lowest daily net P&amp;L</span>
        </div>
      </div>

      </div>
      {/* Selected day review */}
      <div className="order-3 lg:col-span-3 min-w-0 w-full bg-surface-container-lowest rounded-xl p-space-lg flex flex-col gap-space-md border border-outline-variant shadow-sm">
        
        {/* Selected Day Detail Panel (7 cols) */}
          <div className="flex items-center justify-between border-b border-outline-variant/80 pb-space-sm">
            <div className="flex items-center gap-space-xs font-caption-mono text-caption-mono text-tertiary uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span>SESSION DETAIL // {selectedDayString}</span>
            </div>
            <span className="font-caption-mono text-caption-mono bg-surface-container-low px-space-sm py-0.5 rounded-full text-on-surface font-semibold border border-outline-variant/60">
              {selectedDayTrades.length} EXECUTIONS
            </span>
          </div>

          {selectedDayTrades.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm">
              <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/60"><span className="block text-caption-mono text-tertiary">NET P&amp;L</span><strong className={selectedDaySummary.pnl >= 0 ? 'text-on-surface' : 'text-secondary'}>{formatCurrency(selectedDaySummary.pnl, currency)}</strong></div>
              <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/60"><span className="block text-caption-mono text-tertiary">TOTAL R</span><strong className={selectedDaySummary.totalR >= 0 ? 'text-on-surface' : 'text-secondary'}>{selectedDaySummary.totalR >= 0 ? '+' : ''}{selectedDaySummary.totalR.toFixed(2)}R</strong></div>
              <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/60"><span className="block text-caption-mono text-tertiary">WIN RATE</span><strong>{selectedDaySummary.closedCount ? `${selectedDaySummary.winRate.toFixed(0)}%` : '—'}</strong></div>
              <div className="p-space-sm rounded-lg bg-surface-container-low border border-outline-variant/60"><span className="block text-caption-mono text-tertiary">STRATEGIES</span><strong className="truncate block">{selectedDaySummary.setups.join(', ') || 'Not specified'}</strong></div>
            </div>
          )}

          <div className="flex flex-col gap-space-sm">
            {selectedDayTrades.length === 0 ? (
              <div className="py-12 text-center text-tertiary font-caption-mono text-caption-mono">
                NO EXECUTIONS RECORDED ON {selectedDayString}
              </div>
            ) : (
              selectedDayTrades.map((t) => {
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTrade(t)}
                    className="p-space-md bg-surface-container-low rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm hover:bg-surface-container transition-colors cursor-pointer border border-outline-variant/60 shadow-xs"
                  >
                    <div className="flex items-center gap-space-sm">
                      <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-display font-bold text-on-surface text-caption-mono border border-outline-variant/80 shadow-xs">
                        {t.symbol.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-space-xs">
                          <span className="font-display font-bold text-on-surface text-body-md">
                            {t.symbol}
                          </span>
                          <span
                            className={`px-space-xs py-0.5 rounded font-caption-mono text-caption-mono uppercase font-semibold ${
                              t.side === 'Long'
                                ? 'bg-surface-container text-on-surface border border-outline-variant/60'
                                : 'bg-surface-container-high text-tertiary border border-outline-variant/60'
                            }`}
                          >
                            {t.side}
                          </span>
                        </div>
                        <span className="font-caption-mono text-caption-mono text-tertiary">
                          {t.entryTime || '—'} • {t.setup || 'No strategy set'}
                        </span>
                        {(t.notes || t.tags?.length > 0) && <span className="font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2">{t.notes || t.tags.join(' · ')}</span>}
                        {t.imageUrl && <a href={t.imageUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} className="font-caption-mono text-caption-mono text-primary underline mt-1">View screenshot</a>}
                      </div>
                    </div>

                    <div className="flex items-center gap-space-md">
                      <div className="flex flex-col items-end">
                        <span
                          className={`font-table-data text-table-data font-bold ${
                            t.pnl < 0 ? 'text-secondary' : 'text-on-surface'
                          }`}
                        >
                          {t.tradeStatus === 'MISSED' ? `MISSED · ${formatCurrency(0, currency)}` : t.status === 'Closed' ? formatCurrency(t.pnl, currency) : t.status}
                        </span>
                        <span className="font-caption-mono text-caption-mono text-tertiary">
                          {t.tradeStatus === 'MISSED' ? `${t.hypotheticalOutcome || '—'} · ${t.plannedRR ?? '—'}R planned` : `${(t.realizedR || 0) >= 0 ? '+' : ''}${(t.realizedR || 0).toFixed(1)}R`}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-body-md text-tertiary">
                        chevron_right
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
