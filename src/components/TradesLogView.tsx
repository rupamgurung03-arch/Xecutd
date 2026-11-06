import React, { useState, useMemo, useEffect } from 'react';
import { Trade, TradeSide } from '../types/trade';
import { formatCurrency } from '../utils/calculations';
import { getTradeExcursionDisplay } from '../utils/tradeAnalyticsEngine';

interface TradesLogViewProps {
  trades: Trade[];
  currency: string;
  onSelectTrade: (trade: Trade) => void;
  onDeleteTrade: (tradeId: string) => void;
  onOpenNewTrade: () => void;
}

export const TradesLogView: React.FC<TradesLogViewProps> = ({
  trades,
  currency,
  onSelectTrade,
  onDeleteTrade,
  onOpenNewTrade,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaybook, setSelectedPlaybook] = useState<string>('ALL');
  const [sideFilter, setSideFilter] = useState<'ALL' | 'LONG' | 'SHORT'>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'WINS' | 'LOSSES' | 'BE'>('ALL');
  const [rowsPerPage, setRowsPerPage] = useState<number>(8);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [dateRangeError, setDateRangeError] = useState('');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const updateMobileView = () => setIsMobileView(media.matches);
    updateMobileView();
    media.addEventListener('change', updateMobileView);
    return () => media.removeEventListener('change', updateMobileView);
  }, []);

  // Playbook list
  const playbooks = useMemo(() => {
    const set = new Set<string>();
    trades.forEach((t) => {
      if (t.setup) set.add(t.setup);
    });
    return Array.from(set);
  }, [trades]);

  // Calculations for Metric Tape
  const tapeStats = useMemo(() => {
    const closed = trades.filter((t) => t.tradeStatus !== 'MISSED' && t.status === 'Closed');
    const total = closed.length;
    const wins = closed.filter((t) => t.pnl > 0).length;
    const losses = closed.filter((t) => t.pnl < 0).length;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0';

    const netPnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const totalFees = closed.reduce((acc, t) => acc + (t.fee || 0), 0);
    const totalR = closed.reduce((acc, t) => acc + (t.realizedR || 0), 0);

    const grossWins = closed.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
    const grossLosses = Math.abs(closed.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLosses > 0 ? (grossWins / grossLosses).toFixed(2) : grossWins > 0 ? '∞' : '—';

    return {
      total,
      wins,
      losses,
      winRate,
      netPnl,
      totalFees,
      totalR,
      profitFactor,
      expectancy: total ? netPnl / total : 0,
    };
  }, [trades]);

  // Filtering
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchSymbol = t.symbol.toLowerCase().includes(query);
        const matchId = t.id.toLowerCase().includes(query);
        const matchSetup = t.setup?.toLowerCase().includes(query);
        const matchNotes = t.notes?.toLowerCase().includes(query);
        const matchTags = t.tags?.some((tag) => tag.toLowerCase().includes(query));
        if (!matchSymbol && !matchId && !matchSetup && !matchNotes && !matchTags) return false;
      }

      // Playbook
      if (selectedPlaybook !== 'ALL') {
        if (t.setup?.toLowerCase() !== selectedPlaybook.toLowerCase()) return false;
      }

      // Side
      if (sideFilter === 'LONG' && t.side !== 'Long') return false;
      if (sideFilter === 'SHORT' && t.side !== 'Short') return false;

      // Outcome
      if (outcomeFilter !== 'ALL' && t.tradeStatus === 'MISSED') return false;
      if (outcomeFilter === 'WINS' && t.pnl <= 0) return false;
      if (outcomeFilter === 'LOSSES' && t.pnl >= 0) return false;
      if (outcomeFilter === 'BE' && Math.abs(t.pnl) > 5) return false;
      if (outcomeFilter !== 'ALL' && t.status !== 'Closed') return false;

      // Entry date range
      if (dateFrom && t.entryDate < dateFrom) return false;
      if (dateTo && t.entryDate > dateTo) return false;

      return true;
    });
  }, [trades, searchTerm, selectedPlaybook, sideFilter, outcomeFilter, dateFrom, dateTo]);

  // Pagination
  const pageSize = isMobileView ? 6 : rowsPerPage;
  const totalPages = Math.ceil(filteredTrades.length / pageSize) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, currentPage, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const activeFilterCount = Number(selectedPlaybook !== 'ALL') + Number(sideFilter !== 'ALL') + Number(outcomeFilter !== 'ALL');

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = ['ID', 'Date', 'Time', 'Symbol', 'Side', 'Session', 'RecordStatus', 'MissedReason', 'HypotheticalOutcome', 'PlannedRR', 'Qty', 'PartialExits', 'MAEPrice', 'MAER', 'MFEPrice', 'MFER', 'EntryPrice', 'ExitPrice', 'NetPnL', 'RealizedR', 'Setup', 'Discipline'];
    const rows = trades.map((t) => [
      t.id,
      t.entryDate,
      t.entryTime || '09:30',
      t.symbol,
      t.side,
        t.session || '',
      t.tradeStatus || 'EXECUTED',
      t.missedReason || '',
      t.hypotheticalOutcome || '',
      t.plannedRR ?? '',
      t.partialExits?.length ? '' : (t.quantity ?? ''),
      t.partialExits?.map((part) => `${part.percentage}%@${part.exitPrice ?? `${part.rMultiple ?? ''}R`}`).join('; ') || '',
      t.maxAdversePrice ?? '',
      t.maeR ?? '',
      t.maxFavorablePrice ?? '',
      t.mfeR ?? '',
      t.entryPrice,
      t.exitPrice || t.entryPrice,
      t.pnl,
      t.realizedR || 0,
      `"${t.setup || ''}"`,
      t.rulesFollowed ? 'Clean' : 'Violation',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `apextrade_journal_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col gap-3 sm:gap-space-lg">
      
      {/* LEDGER SUMMARY + GLYPH ANIMATION */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.25fr)] gap-space-md">
        <div className="bg-surface-container-lowest rounded-2xl p-space-md border border-outline-variant flex items-center justify-between shadow-sm">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase tracking-wider">
                TOTAL FEES
              </span>
            </div>
            <span className="font-numeric-stat text-numeric-stat text-tertiary font-bold">
              {formatCurrency(-tapeStats.totalFees, currency)}
            </span>
            <span className="font-caption-mono text-caption-mono text-tertiary">From logged trades</span>
          </div>
          <span className="material-symbols-outlined text-3xl text-tertiary">receipt_long</span>
        </div>
        <div className="min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm flex items-center gap-space-md overflow-hidden">
          <div className="shrink-0">
            <span className="block font-caption-mono text-caption-mono uppercase tracking-widest text-tertiary">CHOMP CHOMP</span>
            <span className="mt-1 block font-body-sm text-body-sm text-on-surface-variant">One block at a time.</span>
          </div>
          <div className="trade-pacman-track" role="img" aria-label="Pac-Man style glyph chomping blocks">
            <span className="trade-pacman-dot dot-one" /><span className="trade-pacman-dot dot-two" /><span className="trade-pacman-dot dot-three" /><span className="trade-pacman-dot dot-four" /><span className="trade-pacman-dot dot-five" />
            <svg className="trade-pacman-glyph" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="22" fill="var(--on-surface)" />
              <path className="trade-pacman-mouth" d="M24 24 L46 11 A25.5 25.5 0 0 1 46 37 Z" fill="var(--surface-container-low)" />
              <circle cx="27" cy="12" r="2" fill="var(--primary-container)" />
            </svg>
          </div>
        </div>
      </div>

      {/* FILTER ENGINE & SYNC CONTROLS TOOLBAR */}
      <div className="bg-surface-container-lowest rounded-xl p-space-md flex flex-col gap-space-md border border-outline-variant shadow-sm">
        
        {/* Upper Strip: Search, Strategy, Date, Export */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
          {/* Left: Search & Range Picker */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-space-sm min-w-0">
            <div className="relative col-span-2 sm:col-span-1 flex min-w-0 w-full sm:w-auto items-center bg-surface-container-low border border-outline-variant/80 rounded-full px-space-md py-1.5 sm:min-w-[220px]">
              <span className="material-symbols-outlined text-body-md text-tertiary mr-space-xs">search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="FILTER TICKER / ID"
                className="bg-transparent border-0 outline-none text-on-surface placeholder:text-tertiary font-caption-mono text-body-sm w-full uppercase"
              />
              <span className="hidden md:inline font-caption-mono text-caption-mono text-tertiary bg-surface-container-high px-1.5 py-0.5 rounded border border-outline-variant/60">
                ⌘K
              </span>
            </div>

            <div className="relative">
              <button type="button" aria-expanded={datePickerOpen} onClick={() => { setDraftDateFrom(dateFrom); setDraftDateTo(dateTo); setDateRangeError(''); setDatePickerOpen((open) => !open); }} className="flex min-w-0 items-center justify-center gap-space-xs bg-surface-container-low hover:bg-surface-container border border-outline-variant/80 px-2.5 sm:px-space-md py-1.5 rounded-full text-on-surface transition-colors font-body-sm">
                <span className="material-symbols-outlined text-body-sm text-tertiary">calendar_month</span>
                <span className="truncate font-caption-mono text-[10px] sm:text-caption-mono tracking-wide uppercase font-medium">{dateFrom || dateTo ? `${dateFrom || 'START'} — ${dateTo || 'END'}`.replaceAll('-', '.') : 'ALL DATES'}</span>
                <span className="material-symbols-outlined text-body-sm text-tertiary">arrow_drop_down</span>
              </button>
              {datePickerOpen && <div className="absolute left-0 top-full z-40 mt-2 w-[min(19rem,calc(100vw-2.5rem))] rounded-2xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-xl">
                <div className="mb-3 flex items-center justify-between"><h3 className="font-caption-mono text-caption-mono font-bold uppercase tracking-wide text-on-surface">Filter by entry date</h3><button type="button" aria-label="Close date filter" onClick={() => setDatePickerOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full text-tertiary hover:bg-surface-container cursor-pointer"><span className="material-symbols-outlined text-body-sm">close</span></button></div>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">From<input type="date" value={draftDateFrom} onChange={(event) => { setDraftDateFrom(event.target.value); setDateRangeError(''); }} className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-sm text-on-surface outline-none focus:border-on-surface" /></label>
                  <label className="flex flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">To<input type="date" value={draftDateTo} onChange={(event) => { setDraftDateTo(event.target.value); setDateRangeError(''); }} className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-body-sm text-on-surface outline-none focus:border-on-surface" /></label>
                </div>
                {dateRangeError && <p role="alert" className="mt-2 font-body-sm text-body-sm text-secondary">{dateRangeError}</p>}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); setDraftDateFrom(''); setDraftDateTo(''); setCurrentPage(1); setDatePickerOpen(false); }} className="rounded-full px-3 py-2 font-caption-mono text-[10px] font-semibold text-tertiary hover:bg-surface-container cursor-pointer">Clear</button>
                  <div className="flex gap-2"><button type="button" onClick={() => setDatePickerOpen(false)} className="rounded-full px-3 py-2 font-caption-mono text-[10px] font-semibold text-on-surface-variant hover:bg-surface-container cursor-pointer">Cancel</button><button type="button" onClick={() => { if (draftDateFrom && draftDateTo && draftDateFrom > draftDateTo) { setDateRangeError('Start date must be before end date.'); return; } setDateFrom(draftDateFrom); setDateTo(draftDateTo); setCurrentPage(1); setDatePickerOpen(false); }} className="rounded-full bg-on-surface px-4 py-2 font-caption-mono text-[10px] font-bold uppercase text-surface-container-lowest cursor-pointer">Apply</button></div>
                </div>
              </div>}
            </div>

            <button type="button" aria-expanded={mobileFiltersOpen} aria-controls="mobile-ledger-filters" onClick={() => setMobileFiltersOpen((open) => !open)} className="md:hidden flex items-center justify-center gap-1.5 border border-outline-variant bg-surface-container-low px-2.5 py-1.5 rounded-full font-caption-mono text-[10px] font-semibold uppercase text-on-surface">
              <span className="material-symbols-outlined text-sm">tune</span>
              <span>FILTER</span>
              {activeFilterCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center bg-primary text-on-primary px-1 text-[9px]">{activeFilterCount}</span>}
              <span className="material-symbols-outlined text-sm">{mobileFiltersOpen ? 'expand_less' : 'expand_more'}</span>
            </button>

            {/* Strategy Playbook Multi-Filter Pill */}
            <div className="hidden md:flex items-center gap-space-xs overflow-x-auto py-1">
              <button
                onClick={() => setSelectedPlaybook('ALL')}
                className={`px-space-md py-1 rounded-full font-caption-mono text-caption-mono tracking-wider uppercase font-medium transition-all flex items-center gap-1.5 ${
                  selectedPlaybook === 'ALL'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/80'
                }`}
              >
                {selectedPlaybook === 'ALL' && <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>}
                ALL PLAYBOOKS
              </button>
              {playbooks.slice(0, 4).map((pb) => (
                <button
                  key={pb}
                  onClick={() => setSelectedPlaybook(pb)}
                  className={`px-space-md py-1 rounded-full font-caption-mono text-caption-mono tracking-wider uppercase transition-all font-medium ${
                    selectedPlaybook === pb
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/80'
                  }`}
                >
                  {pb}
                </button>
              ))}
            </div>
          </div>

          {/* Export and trade-entry actions */}
          <div className="hidden md:flex items-center gap-space-sm shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-space-xs bg-surface-container-low hover:bg-surface-container border border-outline-variant/80 text-on-surface px-space-md py-1.5 rounded-full transition-all font-body-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-body-sm text-tertiary">file_download</span>
              <span className="font-caption-mono text-caption-mono tracking-wider uppercase font-medium">CSV EXPORT</span>
            </button>
            <button
              onClick={onOpenNewTrade}
              className="flex items-center gap-space-xs bg-primary text-on-primary hover:bg-neutral-800 px-space-md py-1.5 rounded-full transition-transform active:scale-95 shadow-sm font-body-sm cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="font-caption-mono text-caption-mono tracking-wider uppercase font-semibold text-on-primary">+ RECORD</span>
            </button>
          </div>
        </div>

        {mobileFiltersOpen && <div id="mobile-ledger-filters" className="md:hidden flex flex-col gap-3 border-t border-outline-variant/50 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-caption-mono text-[10px] font-bold uppercase tracking-wider text-tertiary">Filter options</span>
            <button type="button" onClick={() => { setSearchTerm(''); setSelectedPlaybook('ALL'); setSideFilter('ALL'); setOutcomeFilter('ALL'); setDateFrom(''); setDateTo(''); setDraftDateFrom(''); setDraftDateTo(''); setCurrentPage(1); }} className="font-caption-mono text-[10px] font-semibold uppercase text-on-surface underline underline-offset-2">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['ALL', ...playbooks].map((playbook) => <button key={playbook} type="button" aria-pressed={selectedPlaybook === playbook} onClick={() => { setSelectedPlaybook(playbook); setCurrentPage(1); }} className={`max-w-full truncate border px-2.5 py-1.5 font-caption-mono text-[9px] uppercase tracking-wide ${selectedPlaybook === playbook ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant bg-surface-container-low text-on-surface-variant'}`}>{playbook === 'ALL' ? 'All playbooks' : playbook}</button>)}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-caption-mono text-[9px] uppercase tracking-wider text-tertiary">Direction</span>
            <div className="grid grid-cols-3 border border-outline-variant bg-surface-container-low p-0.5">
              {(['ALL', 'LONG', 'SHORT'] as const).map((side) => <button key={side} type="button" aria-pressed={sideFilter === side} onClick={() => { setSideFilter(side); setCurrentPage(1); }} className={`py-1.5 font-caption-mono text-[9px] uppercase ${sideFilter === side ? 'bg-on-surface text-surface-container-lowest font-bold' : 'text-tertiary'}`}>{side}</button>)}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-caption-mono text-[9px] uppercase tracking-wider text-tertiary">Outcome</span>
            <div className="grid grid-cols-4 border border-outline-variant bg-surface-container-low p-0.5">
              {(['ALL', 'WINS', 'LOSSES', 'BE'] as const).map((outcome) => <button key={outcome} type="button" aria-pressed={outcomeFilter === outcome} onClick={() => { setOutcomeFilter(outcome); setCurrentPage(1); }} className={`py-1.5 font-caption-mono text-[9px] uppercase ${outcomeFilter === outcome ? 'bg-on-surface text-surface-container-lowest font-bold' : 'text-tertiary'}`}>{outcome}</button>)}
            </div>
          </div>
        </div>}

        {/* Lower Sub-strip: Side & Outcome Toggles */}
        <div className="hidden md:flex flex-wrap items-center justify-between gap-space-sm pt-space-xs border-t border-outline-variant/50">
          <div className="flex items-center gap-space-md flex-wrap">
            {/* Side Pill Group */}
            <div className="flex items-center bg-surface-container-low p-0.5 rounded-full border border-outline-variant/80">
              {(['ALL', 'LONG', 'SHORT'] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setSideFilter(side)}
                  className={`px-space-md py-1 rounded-full text-caption-mono font-caption-mono uppercase tracking-wider transition-all font-medium ${
                    sideFilter === side
                      ? 'bg-primary text-on-primary font-bold shadow-sm'
                      : 'text-tertiary hover:text-on-surface'
                  }`}
                >
                  {side === 'ALL' ? 'SIDE: ALL' : side}
                </button>
              ))}
            </div>

            {/* Outcome Pill Group */}
            <div className="flex items-center bg-surface-container-low p-0.5 rounded-full border border-outline-variant/80">
              {(['ALL', 'WINS', 'LOSSES', 'BE'] as const).map((outcome) => (
                <button
                  key={outcome}
                  onClick={() => setOutcomeFilter(outcome)}
                  className={`px-space-md py-1 rounded-full text-caption-mono font-caption-mono uppercase tracking-wider transition-all font-medium ${
                    outcomeFilter === outcome
                      ? 'bg-surface-container-highest text-on-surface font-bold shadow-xs'
                      : 'text-tertiary hover:text-on-surface'
                  }`}
                >
                  {outcome === 'ALL' ? 'OUTCOME: ALL' : outcome}
                </button>
              ))}
            </div>
          </div>

          {/* Telemetry readout right */}
          <div className="hidden md:flex items-center gap-space-sm text-caption-mono font-caption-mono text-tertiary">
            <span>SHOWING {filteredTrades.length} OF {trades.length} EXECUTIONS</span>
            <span>•</span>
            <span className="text-on-surface-variant font-medium">SORT: TIMESTAMP DESC</span>
          </div>
        </div>
      </div>

      {/* MAIN DATA LEDGER TABLE CONTAINER */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden flex flex-col">
        
        {/* Table Header Bar */}
        <div className="px-space-lg py-space-md bg-surface-container-low border-b border-outline-variant/80 flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
            <span className="font-caption-mono text-caption-mono text-on-surface uppercase tracking-widest font-bold">
              Trades
            </span>
          </div>
          <div className="flex items-center gap-space-md font-caption-mono text-caption-mono text-tertiary">
            <span>{filteredTrades.length} matching entries</span>
          </div>
        </div>

        {/* Scrollable Table Wrapper */}
        <div className="md:hidden flex flex-col gap-2 p-2">
          {paginatedTrades.length === 0 ? (
            <p className="py-8 text-center font-body-sm text-on-surface-variant">No trades match these filters.</p>
          ) : paginatedTrades.map((trade) => {
            const isMissed = trade.tradeStatus === 'MISSED';
            const isWin = !isMissed && trade.status === 'Closed' && trade.pnl > 0;
            const isLoss = !isMissed && trade.status === 'Closed' && trade.pnl < 0;
            const profitText = isMissed ? 'MISSED' : trade.status === 'Closed' ? formatCurrency(trade.pnl, currency) : 'OPEN';
            const excursion = getTradeExcursionDisplay(trade);
            const tradeDate = /^\d{4}-\d{2}-\d{2}$/.test(trade.entryDate)
              ? new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${trade.entryDate}T00:00:00Z`))
              : trade.entryDate;
            return (
              <article key={trade.id} role="button" tabIndex={0} aria-label={`${trade.symbol}, ${trade.side}, ${profitText}. Tap to review trade.`} onClick={() => onSelectTrade(trade)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectTrade(trade); } }} className="flex min-h-14 flex-col gap-1.5 border border-outline-variant bg-surface-container-low px-3 py-2.5 cursor-pointer active:bg-surface-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-on-surface">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="max-w-[55vw] truncate font-display text-base font-bold text-on-surface">{trade.symbol}</span>
                    <span className="shrink-0 border border-outline-variant px-2 py-1 font-caption-mono text-[10px] font-semibold uppercase text-on-surface-variant">{trade.side}</span>
                  </div>
                  <span className={`shrink-0 font-table-data text-sm font-bold ${isWin ? 'text-success' : isLoss ? 'text-secondary' : 'text-on-surface'}`}>{profitText}</span>
                </div>
                <div className="font-caption-mono text-[10px] uppercase tracking-wide text-tertiary">{tradeDate}{trade.entryTime ? ` · ${trade.entryTime}` : ''}{isMissed && trade.missedReason ? ` · Missed: ${trade.missedReason}` : ''}</div>
                {(excursion.mfeR !== null || excursion.maeR !== null || excursion.exitEfficiencyPct !== null) && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline-variant/70 pt-1.5 font-caption-mono text-[9px] uppercase tracking-wide">
                  {excursion.mfeR !== null && <span className="text-cyan-700 dark:text-cyan-300">MFE +{excursion.mfeR.toFixed(1)}R</span>}
                  {excursion.maeR !== null && <span className="text-amber-700 dark:text-amber-300">MAE -{Math.abs(excursion.maeR).toFixed(1)}R</span>}
                  {excursion.exitEfficiencyPct !== null && <span className="border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-tertiary">{excursion.exitEfficiencyPct.toFixed(0)}% exit efficiency</span>}
                  {excursion.gainedGivenBack && <span className="font-bold text-secondary">Gained Given Back</span>}
                </div>}
              </article>
            );
          })}
        </div>
        <div className="hidden md:block w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1380px]">
            <thead>
              <tr className="bg-surface border-b border-outline-variant text-tertiary font-caption-mono text-caption-mono uppercase tracking-wider">
                <th className="py-space-md px-space-md text-left font-semibold">STATUS &amp; ID</th>
                <th className="py-space-md px-space-md text-left font-semibold">ENTRY DATE / TIME</th>
                <th className="py-space-md px-space-md text-left font-semibold">ASSET / TICKER</th>
                <th className="py-space-md px-space-md text-left font-semibold">SIDE</th>
                <th className="py-space-md px-space-md text-right font-semibold">SIZE / UNITS</th>
                <th className="py-space-md px-space-md text-right font-semibold">ENTRY ➔ EXIT</th>
                <th className="py-space-md px-space-md text-right font-semibold">NET P&amp;L</th>
                <th className="py-space-md px-space-md text-right font-semibold">R-MULT</th>
                <th className="py-space-md px-space-md text-right font-semibold">EXCURSION / EFFICIENCY</th>
                <th className="py-space-md px-space-md text-left font-semibold">STRATEGY PLAYBOOK</th>
                <th className="py-space-md px-space-md text-left font-semibold">DISCIPLINE / PSYCH</th>
                <th className="py-space-md px-space-md text-center font-semibold">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 text-body-md font-body-md bg-surface-container-lowest">
              {paginatedTrades.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-tertiary font-caption-mono text-body-sm">
                    NO EXECUTIONS MATCHING CURRENT FILTER PARAMETERS
                  </td>
                </tr>
              ) : (
                paginatedTrades.map((t) => {
                  const isMissed = t.tradeStatus === 'MISSED';
                  const isWin = !isMissed && t.pnl > 0;
                  const isLoss = !isMissed && t.pnl < 0;
                  const initials = t.symbol.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'TR';
                  const excursion = getTradeExcursionDisplay(t);

                  return (
                    <tr
                      key={t.id}
                      className="group hover:bg-surface transition-colors"
                    >
                      {/* ID */}
                      <td className="py-space-md px-space-md whitespace-nowrap">
                        <div className="flex items-center gap-space-xs font-table-data text-table-data text-on-surface">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isWin ? 'bg-secondary' : isLoss ? 'bg-error' : 'bg-outline-variant'
                            }`}
                          ></span>
                          <span className="font-bold text-on-surface">
                            #{t.id.slice(0, 8)}
                          </span>
                        </div>
                        {isMissed && <span className="mt-1 block font-caption-mono text-[10px] uppercase text-tertiary">Missed · {t.missedReason}</span>}
                      </td>

                      {/* Timestamp */}
                      <td className="py-space-md px-space-md whitespace-nowrap font-caption-mono text-caption-mono text-on-surface-variant">
                        {t.entryDate} <span className="text-tertiary">{t.entryTime || '—'}</span>
                      </td>

                      {/* Asset */}
                      <td className="py-space-md px-space-md whitespace-nowrap">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center font-caption-mono text-caption-mono text-on-surface font-bold border border-outline-variant/60">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-table-data text-table-data font-bold text-on-surface">
                              {t.symbol}
                            </span>
                            <span className="font-caption-mono text-caption-mono text-tertiary uppercase">
                              {t.assetClass || '—'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Side */}
                      <td className="py-space-md px-space-md whitespace-nowrap">
                        <span
                          className={`px-space-md py-0.5 rounded-full font-caption-mono text-caption-mono font-bold tracking-wider uppercase border ${
                            t.side === 'Long'
                              ? 'bg-surface-container text-on-surface border-outline-variant'
                              : 'bg-surface-container-high text-tertiary border-outline-variant'
                          }`}
                        >
                          {t.side}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-space-md px-space-md text-right whitespace-nowrap font-table-data text-table-data text-on-surface font-medium">
                        {t.partialExits?.length ? 'Partial exits' : `${t.quantity ?? '—'} Units`}
                      </td>

                      {/* Entry -> Exit */}
                      <td className="py-space-md px-space-md text-right whitespace-nowrap font-table-data text-table-data">
                        <span className="text-tertiary">${t.entryPrice.toFixed(2)}</span>
                        <span className="text-outline-variant mx-1">➔</span>
                        <span
                          className={`font-semibold ${
                            isWin ? 'text-success' : isLoss ? 'text-secondary' : 'text-on-surface'
                          }`}
                        >
                          ${(t.exitPrice || t.entryPrice).toFixed(2)}
                        </span>
                      </td>

                      {/* Net P&L */}
                      <td className="py-space-md px-space-md text-right whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-table-data text-table-data font-bold ${
                              isWin
                                ? 'text-success'
                                : isLoss
                                ? 'text-secondary'
                                : 'text-on-surface'
                            }`}
                          >
                            {isMissed ? 'MISSED · $0.00' : `${isWin ? '+' : ''}$${Math.abs(t.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </span>
                          <span
                            className={`font-caption-mono text-caption-mono font-medium ${
                              isLoss ? 'text-secondary/80' : 'text-success/80'
                            }`}
                          >
                            {t.pnlPercent >= 0 ? '+' : ''}{t.pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* R-Mult */}
                      <td className="py-space-md px-space-md text-right whitespace-nowrap">
                        <span
                          className={`font-table-data text-table-data font-bold px-space-sm py-0.5 rounded-full border ${
                            isWin
                              ? 'bg-success-container text-success border-success/30'
                              : isLoss
                              ? 'bg-error-container text-secondary border-error/30'
                              : 'bg-surface-container text-on-surface-variant border-outline-variant/60'
                          }`}
                        >
                          {isMissed ? `${t.hypotheticalOutcome || '—'} · ${t.plannedRR ?? '—'}R` : `${(t.realizedR || 0) >= 0 ? '+' : ''}${(t.realizedR || 0).toFixed(1)}R`}
                        </span>
                      </td>

                      {/* MFE / MAE / exit efficiency */}
                      <td className="py-space-md px-space-md text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-0.5 font-caption-mono text-[10px] uppercase">
                          <span className="text-cyan-700 dark:text-cyan-300">MFE {excursion.mfeR === null ? '—' : `+${excursion.mfeR.toFixed(1)}R`}</span>
                          <span className="text-amber-700 dark:text-amber-300">MAE {excursion.maeR === null ? '—' : `-${Math.abs(excursion.maeR).toFixed(1)}R`}</span>
                          {excursion.exitEfficiencyPct !== null && <span className="border border-outline-variant bg-surface-container-lowest px-1.5 py-0.5 text-tertiary">{excursion.exitEfficiencyPct.toFixed(0)}% Exit Efficiency</span>}
                          {excursion.gainedGivenBack && <span className="font-bold text-secondary">Gained Given Back</span>}
                        </div>
                      </td>

                      {/* Strategy */}
                      <td className="py-space-md px-space-md whitespace-nowrap">
                        <span className="px-space-md py-1 rounded-full bg-surface-container text-on-surface font-caption-mono text-caption-mono border border-outline-variant uppercase font-medium">
                          {t.setup || 'No strategy set'}
                        </span>
                      </td>

                      {/* Discipline */}
                      <td className="py-space-md px-space-md whitespace-nowrap">
                        <div
                          className={`flex items-center gap-space-xs font-caption-mono text-caption-mono ${
                            t.rulesFollowed ? 'text-success font-medium' : 'text-secondary font-medium'
                          }`}
                        >
                          <span className="material-symbols-outlined text-body-sm">
                            {t.rulesFollowed ? 'check_circle' : 'warning'}
                          </span>
                          <span>
                            {t.rulesFollowed ? 'CLEAN PLAN EXECUTED' : t.mistakes?.[0] || 'RULE DEVIATION'}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-space-md px-space-md text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onSelectTrade(t)}
                            className="p-1.5 rounded-full hover:bg-surface-container text-tertiary hover:text-on-surface transition-colors cursor-pointer"
                            title="Inspect Trade Detail"
                          >
                            <span className="material-symbols-outlined text-body-lg">visibility</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTrade(t.id);
                            }}
                            className="p-1.5 rounded-full hover:bg-error-container/40 text-tertiary hover:text-secondary transition-colors cursor-pointer"
                            title="Delete Execution"
                          >
                            <span className="material-symbols-outlined text-body-sm">delete</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-3 sm:px-space-lg py-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md border-t border-outline-variant/80">
          <div className="flex items-center gap-space-md">
            <div className="hidden md:flex items-center gap-space-xs">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase">ROWS PER PAGE:</span>
              <div className="flex items-center bg-white rounded-full p-0.5 border border-outline-variant shadow-xs">
                {[8, 25, 50, 100].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setRowsPerPage(num);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-0.5 rounded-full font-caption-mono text-caption-mono cursor-pointer transition-colors ${
                      rowsPerPage === num
                        ? 'bg-primary text-on-primary font-bold shadow-xs'
                        : 'text-tertiary hover:text-on-surface'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <span className="font-caption-mono text-caption-mono text-tertiary hidden md:inline">
              PAGE {currentPage} OF {totalPages}
            </span>
            <span className="md:hidden font-caption-mono text-[10px] text-tertiary uppercase">6 per page · Page {currentPage} of {totalPages}</span>
          </div>

          <div className="flex items-center gap-space-xs">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-full bg-white hover:bg-surface-container flex items-center justify-center text-tertiary hover:text-on-surface transition-colors border border-outline-variant shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-body-md">chevron_left</span>
            </button>
            <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-caption-mono text-caption-mono font-bold shadow-xs">
              {currentPage}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 rounded-full bg-white hover:bg-surface-container flex items-center justify-center text-tertiary hover:text-on-surface transition-colors border border-outline-variant shadow-xs disabled:opacity-40 cursor-pointer"
            >
              <span className="material-symbols-outlined text-body-md">chevron_right</span>
            </button>
          </div>
        </div>

      </div>

      <section className="bg-surface-container-lowest rounded-xl p-space-lg border border-outline-variant shadow-sm">
        <div className="mb-space-md border-b border-outline-variant/60 pb-space-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface font-bold">Journal coverage</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">A quick look at how complete your trade records are.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          <div><p className="font-caption-mono text-caption-mono text-tertiary">WITH NOTES</p><p className="font-numeric-stat text-numeric-stat text-on-surface font-bold">{trades.filter((trade) => trade.notes?.trim()).length} <span className="text-body-sm font-normal text-tertiary">/ {trades.length}</span></p></div>
          <div><p className="font-caption-mono text-caption-mono text-tertiary">WITH SCREENSHOTS</p><p className="font-numeric-stat text-numeric-stat text-on-surface font-bold">{trades.filter((trade) => trade.imageUrl).length} <span className="text-body-sm font-normal text-tertiary">/ {trades.length}</span></p></div>
          <div><p className="font-caption-mono text-caption-mono text-tertiary">PLAN FOLLOWED</p><p className="font-numeric-stat text-numeric-stat text-on-surface font-bold">{trades.filter((trade) => trade.tradeStatus !== 'MISSED').length ? `${((trades.filter((trade) => trade.tradeStatus !== 'MISSED' && trade.rulesFollowed).length / trades.filter((trade) => trade.tradeStatus !== 'MISSED').length) * 100).toFixed(0)}%` : '—'}</p></div>
        </div>
      </section>

    </div>
  );
};
