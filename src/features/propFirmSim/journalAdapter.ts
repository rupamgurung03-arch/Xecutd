import type { Trade } from '../../types/trade';

/** Convert journal records into net R outcomes accepted by LuxAlgo's bootstrap profile. */
export function toJournalRSeries(trades: Trade[], includeExecutionCosts = true) {
  const eligible = trades
    .filter((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed')
    .map((trade) => {
      const risk = Number(trade.riskAmount);
      const netPnl = Number(trade.pnl);
      const pnl = includeExecutionCosts ? netPnl : netPnl + (Number(trade.fee) || 0);
      return {
        trade,
        timestamp: `${trade.exitDate || trade.entryDate}T${trade.exitTime || trade.entryTime || '00:00'}:00`,
        r: risk > 0 && Number.isFinite(pnl) ? pnl / risk : null,
      };
    })
    .filter((item): item is typeof item & { r: number } => item.r !== null && Number.isFinite(item.r))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return {
    rSeries: eligible.map(({ r }) => r),
    excludedForMissingRisk: trades.filter((trade) => trade.tradeStatus !== 'MISSED' && trade.status === 'Closed' && !(Number(trade.riskAmount) > 0)).length,
    eligibleCount: eligible.length,
  };
}
