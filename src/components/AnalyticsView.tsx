import React, { useMemo } from 'react';
import { Trade } from '../types/trade';
import { formatCurrency } from '../utils/calculations';
import {
  TrendingUp,
  AlertOctagon,
  Clock,
  Calendar,
  Layers,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface AnalyticsViewProps {
  trades: Trade[];
  currency: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ trades, currency }) => {
  const closed = useMemo(() => trades.filter((t) => t.tradeStatus !== 'MISSED' && t.status === 'Closed'), [trades]);

  // 1. Setup Breakdown Matrix
  const setupStats = useMemo(() => {
    const map: { [setup: string]: { count: number; wins: number; pnl: number; grossWin: number; grossLoss: number; totalR: number } } = {};
    closed.forEach((t) => {
      const s = t.setup || 'General / Unclassified';
      if (!map[s]) map[s] = { count: 0, wins: 0, pnl: 0, grossWin: 0, grossLoss: 0, totalR: 0 };
      map[s].count++;
      map[s].pnl += t.pnl || 0;
      map[s].totalR += t.realizedR || 0;
      if (t.pnl > 0) {
        map[s].wins++;
        map[s].grossWin += t.pnl;
      } else if (t.pnl < 0) {
        map[s].grossLoss += Math.abs(t.pnl);
      }
    });

    return Object.entries(map).map(([name, data]) => {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      const profitFactor = data.grossLoss > 0 ? data.grossWin / data.grossLoss : data.grossWin > 0 ? Infinity : 0;
      const avgR = data.count > 0 ? data.totalR / data.count : 0;
      return {
        name,
        count: data.count,
        winRate: parseFloat(winRate.toFixed(1)),
        pnl: parseFloat(data.pnl.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
        avgR: parseFloat(avgR.toFixed(2)),
      };
    }).sort((a, b) => b.pnl - a.pnl);
  }, [closed]);

  // 2. Cost of Mistakes / Behavioral Leak Matrix
  const mistakeStats = useMemo(() => {
    const map: { [tag: string]: { count: number; totalCost: number; avgCost: number } } = {};
    closed.forEach((t) => {
      if (t.mistakes && t.mistakes.length > 0) {
        t.mistakes.forEach((m) => {
          if (!map[m]) map[m] = { count: 0, totalCost: 0, avgCost: 0 };
          map[m].count++;
          if (t.pnl < 0) map[m].totalCost += Math.abs(t.pnl);
        });
      }
    });

    return Object.entries(map).map(([tag, data]) => ({
      tag,
      count: data.count,
      totalCost: parseFloat(data.totalCost.toFixed(2)),
      avgCost: data.count > 0 ? parseFloat((data.totalCost / data.count).toFixed(2)) : 0,
    })).sort((a, b) => b.totalCost - a.totalCost);
  }, [closed]);

  // 3. Time-of-Day Window Breakdown
  const timeOfDayStats = useMemo(() => {
    const windows = [
      { id: 'morning', label: 'Morning Open (09:30 - 11:00)', count: 0, wins: 0, pnl: 0 },
      { id: 'midday', label: 'Midday Chop (11:00 - 14:00)', count: 0, wins: 0, pnl: 0 },
      { id: 'afternoon', label: 'Power Hour (14:00 - 16:00)', count: 0, wins: 0, pnl: 0 },
      { id: 'offhours', label: 'Off-hours / global sessions', count: 0, wins: 0, pnl: 0 },
      { id: 'unknown', label: 'Time not recorded', count: 0, wins: 0, pnl: 0 },
    ];

    closed.forEach((t) => {
      if (!t.entryTime) {
        windows[4].count++;
        windows[4].pnl += t.pnl || 0;
        if (t.pnl > 0) windows[4].wins++;
        return;
      }
      const time = t.entryTime;
      const [h, m] = time.split(':').map(Number);
      const minutes = h * 60 + m;

      let idx = 3;
      if (minutes >= 570 && minutes < 660) idx = 0; // 9:30 - 11:00
      else if (minutes >= 660 && minutes < 840) idx = 1; // 11:00 - 14:00
      else if (minutes >= 840 && minutes <= 960) idx = 2; // 14:00 - 16:00

      windows[idx].count++;
      windows[idx].pnl += t.pnl || 0;
      if (t.pnl > 0) windows[idx].wins++;
    });

    return windows.map((w) => ({
      ...w,
      winRate: w.count > 0 ? parseFloat(((w.wins / w.count) * 100).toFixed(1)) : 0,
    }));
  }, [closed]);

  // 4. Day-of-Week Breakdown
  const dayOfWeekStats = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'];
    const map = days.map((d) => ({ day: d, count: 0, wins: 0, pnl: 0 }));

    closed.forEach((t) => {
      const dt = new Date(`${t.entryDate}T12:00:00`);
      const dayNum = dt.getDay(); // 0 is Sun, 1 is Mon...
      let idx = 5; // weekend
      if (dayNum >= 1 && dayNum <= 5) idx = dayNum - 1;

      map[idx].count++;
      map[idx].pnl += t.pnl || 0;
      if (t.pnl > 0) map[idx].wins++;
    });

    return map.map((d) => ({
      ...d,
      winRate: d.count > 0 ? parseFloat(((d.wins / d.count) * 100).toFixed(1)) : 0,
    }));
  }, [closed]);

  // 5. Asset Class Performance
  const assetClassStats = useMemo(() => {
    const map: { [asset: string]: { count: number; wins: number; pnl: number } } = {};
    closed.forEach((t) => {
      const a = t.assetClass;
      if (!map[a]) map[a] = { count: 0, wins: 0, pnl: 0 };
      map[a].count++;
      map[a].pnl += t.pnl || 0;
      if (t.pnl > 0) map[a].wins++;
    });

    return Object.entries(map).map(([asset, data]) => ({
      asset,
      count: data.count,
      pnl: parseFloat(data.pnl.toFixed(2)),
      winRate: data.count > 0 ? parseFloat(((data.wins / data.count) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.pnl - a.pnl);
  }, [closed]);

  const totalMistakeDrain = mistakeStats.reduce((acc, m) => acc + m.totalCost, 0);

  return (
    <div className="space-y-6">
      
      {/* 1. Setup Performance Matrix */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Playbook Setup Expectancy & Win Rates
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {setupStats.length} Unique Setups Tracked
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-medium">
              <tr>
                <th className="py-2.5 px-4">Setup Strategy</th>
                <th className="py-2.5 px-4 text-center">Trades</th>
                <th className="py-2.5 px-4 text-right">Win Rate</th>
                <th className="py-2.5 px-4 text-right">Profit Factor</th>
                <th className="py-2.5 px-4 text-right">Avg Realized R</th>
                <th className="py-2.5 px-4 text-right">Net P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {setupStats.map((s) => {
                const isWin = s.pnl >= 0;
                return (
                  <tr key={s.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-900 dark:text-slate-100">
                      {s.name}
                    </td>
                    <td className="py-2.5 px-4 text-center tabular-nums text-slate-600 dark:text-slate-400">
                      {s.count}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className={s.winRate >= 60 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                        {s.winRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {Number.isFinite(s.profitFactor) ? s.profitFactor.toFixed(2) : '∞'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">
                      <span className={s.avgR >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>
                        {s.avgR >= 0 ? `+${s.avgR}` : s.avgR}R
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                      <span className={isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {isWin ? '+' : ''}{formatCurrency(s.pnl, currency)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Dual Breakdown: The Cost of Mistakes vs Time-of-Day Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Cost of Mistakes / Behavioral Leak Matrix */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                The "Cost of Mistakes" Leak Matrix
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
              Total Leak: -{formatCurrency(totalMistakeDrain, currency)}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-4 leading-relaxed">
            Quantifying the exact dollar amount forfeited by deviating from your rules.
          </p>

          {mistakeStats.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              Zero tagged execution leaks in current journal. Flawless discipline.
            </div>
          ) : (
            <div className="space-y-3">
              {mistakeStats.map((m) => {
                const percentOfTotal = totalMistakeDrain > 0 ? (m.totalCost / totalMistakeDrain) * 100 : 0;
                return (
                  <div key={m.tag} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {m.tag} <span className="text-slate-400 font-mono text-[11px]">({m.count}x)</span>
                      </span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(m.totalCost, currency)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${percentOfTotal}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Average drain: -{formatCurrency(m.avgCost, currency)} per occurrence
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Time-of-Day Window Analytics */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Performance by Session Window
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">EST Trading Hours</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-4 leading-relaxed">
            Pinpoints the times of day where your statistical edge is highest vs where you bleed capital.
          </p>

          <div className="space-y-4">
            {timeOfDayStats.map((w) => {
              const isPositive = w.pnl >= 0;
              return (
                <div key={w.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs">
                  <div className="flex justify-between items-center font-medium">
                    <span className="text-slate-900 dark:text-slate-100">{w.label}</span>
                    <span className={`font-mono font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isPositive ? '+' : ''}{formatCurrency(w.pnl, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    <span>{w.count} Trades</span>
                    <span>Win Rate: <strong className="text-slate-900 dark:text-slate-100">{w.winRate}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 3. Day of Week & Asset Class Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Day of Week */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Day-of-Week Edge Analysis
            </h3>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 text-center text-xs">
            {dayOfWeekStats.map((d) => (
              <div key={d.day} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                  {d.day.slice(0, 3)}
                </span>
                <span className={`block font-mono font-bold text-xs mt-1 ${d.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {d.pnl >= 0 ? '+' : ''}{formatCurrency(d.pnl, currency)}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                  {d.winRate}% WR
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Asset Class Matrix */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Layers className="w-4 h-4 text-cyan-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Asset Class Breakdown
            </h3>
          </div>

          <div className="space-y-3 mt-4 text-xs font-mono">
            {assetClassStats.map((a) => (
              <div key={a.asset} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <div className="font-sans font-semibold text-slate-900 dark:text-slate-100">
                  {a.asset} <span className="text-slate-400 font-mono text-[11px] font-normal">({a.count} trades)</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 dark:text-slate-400">
                    {a.winRate}% WR
                  </span>
                  <span className={`font-bold ${a.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {a.pnl >= 0 ? '+' : ''}{formatCurrency(a.pnl, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
