import { Trade, TradeStats } from '../types/trade';

export function calculateTradePnL(
  side: 'Long' | 'Short',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  fee: number = 0
): { pnl: number; pnlPercent: number } {
  if (!entryPrice || !exitPrice || !quantity) return { pnl: 0, pnlPercent: 0 };
  
  let grossPnL = 0;
  if (side === 'Long') {
    grossPnL = (exitPrice - entryPrice) * quantity;
  } else {
    grossPnL = (entryPrice - exitPrice) * quantity;
  }

  const netPnL = grossPnL - fee;
  const investedAmount = entryPrice * quantity;
  const pnlPercent = investedAmount > 0 ? (grossPnL / investedAmount) * 100 : 0;

  return {
    pnl: parseFloat(netPnL.toFixed(2)),
    pnlPercent: parseFloat(pnlPercent.toFixed(2)),
  };
}

export function calculatePlannedR(
  side: 'Long' | 'Short',
  entryPrice: number,
  stopLoss: number,
  takeProfit: number
): number {
  if (!entryPrice || !stopLoss || !takeProfit) return 0;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  const reward = Math.abs(takeProfit - entryPrice);
  return parseFloat((reward / risk).toFixed(2));
}

export function calculateRealizedR(
  side: 'Long' | 'Short',
  entryPrice: number,
  exitPrice: number,
  stopLoss: number
): number {
  if (!entryPrice || !exitPrice || !stopLoss) return 0;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;
  const realizedMove = side === 'Long' ? (exitPrice - entryPrice) : (entryPrice - exitPrice);
  return parseFloat((realizedMove / risk).toFixed(2));
}

export function calculateStats(trades: Trade[]): TradeStats {
  const executed = trades.filter((t) => t.tradeStatus !== 'MISSED');
  const closed = executed.filter((t) => t.status === 'Closed');
  const open = executed.filter((t) => t.status === 'Open');

  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalFees = 0;
  let totalRealizedR = 0;
  let totalPlannedR = 0;
  let compliantTrades = 0;

  // Streak tracking (sorted by date ascending)
  const sortedTrades = [...closed].sort((a, b) => {
    return new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime() - 
           new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime();
  });

  let currentStreak = 0;
  let streakType: 'Win' | 'Loss' | 'None' = 'None';

  // Calculate cumulative equity & drawdown
  let peakEquity = 0;
  let runningEquity = 0;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  sortedTrades.forEach((t) => {
    const pnl = t.pnl || 0;
    runningEquity += pnl;
    if (runningEquity > peakEquity) {
      peakEquity = runningEquity;
    }
    const currentDrawdown = peakEquity - runningEquity;
    if (currentDrawdown > maxDrawdownAmount) {
      maxDrawdownAmount = currentDrawdown;
    }
    if (peakEquity > 0) {
      const ddPercent = (currentDrawdown / peakEquity) * 100;
      if (ddPercent > maxDrawdownPercent) {
        maxDrawdownPercent = ddPercent;
      }
    }

    if (pnl > 0) {
      wins++;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLoss += Math.abs(pnl);
    } else {
      breakEven++;
    }

    totalFees += t.fee || 0;
    totalRealizedR += t.realizedR || 0;
    totalPlannedR += t.plannedR || 0;
    if (t.rulesFollowed) compliantTrades++;
  });

  // Calculate current streak
  if (sortedTrades.length > 0) {
    const lastTrade = sortedTrades[sortedTrades.length - 1];
    const isWin = lastTrade.pnl > 0;
    streakType = isWin ? 'Win' : lastTrade.pnl < 0 ? 'Loss' : 'None';
    
    for (let i = sortedTrades.length - 1; i >= 0; i--) {
      const p = sortedTrades[i].pnl;
      if (streakType === 'Win' && p > 0) {
        currentStreak++;
      } else if (streakType === 'Loss' && p < 0) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  const netPnL = grossProfit - grossLoss;
  const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const avgPlannedR = closed.length > 0 ? totalPlannedR / closed.length : 0;
  const avgRealizedR = closed.length > 0 ? totalRealizedR / closed.length : 0;
  const expectancy = closed.length > 0 ? netPnL / closed.length : 0;
  const rulesCompliance = executed.length > 0 ? (compliantTrades / executed.length) * 100 : 100;

  return {
    totalTrades: executed.length,
    closedTrades: closed.length,
    openTrades: open.length,
    wins,
    losses,
    breakEven,
    winRate: parseFloat(winRate.toFixed(1)),
    netPnL: parseFloat(netPnL.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    grossLoss: parseFloat(grossLoss.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    winLossRatio: parseFloat(winLossRatio.toFixed(2)),
    avgPlannedR: parseFloat(avgPlannedR.toFixed(2)),
    avgRealizedR: parseFloat(avgRealizedR.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdownPercent.toFixed(1)),
    maxDrawdownAmount: parseFloat(maxDrawdownAmount.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    currentStreak,
    streakType,
    rulesCompliance: parseFloat(rulesCompliance.toFixed(1)),
    totalFees: parseFloat(totalFees.toFixed(2)),
  };
}

export interface EquityPoint {
  index: number;
  date: string;
  time?: string;
  symbol: string;
  tradePnL: number;
  cumulativePnL: number;
  flawlessCumulativePnL: number;
  cumulativeR: number;
  flawlessCumulativeR: number;
  drawdown: number;
  isMissed?: boolean;
}

export function generateEquityCurveData(trades: Trade[]): EquityPoint[] {
  const curveTrades = trades
    .filter((t) => t.tradeStatus === 'MISSED' || t.status === 'Closed')
    .sort((a, b) => new Date(`${a.entryDate}T${a.entryTime || '00:00'}`).getTime() -
                    new Date(`${b.entryDate}T${b.entryTime || '00:00'}`).getTime());

  let actualPnL = 0;
  let flawlessPnL = 0;
  let actualR = 0;
  let flawlessR = 0;
  let peak = 0;
  const points: EquityPoint[] = [
    {
      index: 0,
      date: curveTrades[0]?.entryDate || 'Start',
      symbol: 'BASE',
      tradePnL: 0,
      cumulativePnL: 0,
      flawlessCumulativePnL: 0,
      cumulativeR: 0,
      flawlessCumulativeR: 0,
      drawdown: 0,
      isMissed: false,
    },
  ];

  curveTrades.forEach((t, i) => {
    const missed = t.tradeStatus === 'MISSED';
    const tradePnL = missed ? 0 : (t.pnl || 0);
    actualPnL += tradePnL;
    if (!missed) actualR += t.realizedR || 0;

    if (!missed && t.rulesFollowed) {
      flawlessPnL += tradePnL;
      flawlessR += t.realizedR || 0;
    } else if (missed && (t.missedReason === 'Hesitation' || t.missedReason === 'Distraction')) {
      const hypotheticalR = t.hypotheticalOutcome === 'Win'
        ? (t.plannedRR || 0)
        : t.hypotheticalOutcome === 'Loss' ? -1 : 0;
      flawlessR += hypotheticalR;
      flawlessPnL += hypotheticalR * (t.riskAmount || 0);
    }

    if (actualPnL > peak) peak = actualPnL;
    const dd = peak - actualPnL;
    points.push({
      index: i + 1,
      date: missed ? t.entryDate : (t.exitDate || t.entryDate),
      time: missed ? t.entryTime : (t.exitTime || t.entryTime),
      symbol: t.symbol,
      tradePnL,
      cumulativePnL: parseFloat(actualPnL.toFixed(2)),
      flawlessCumulativePnL: parseFloat(flawlessPnL.toFixed(2)),
      cumulativeR: parseFloat(actualR.toFixed(2)),
      flawlessCumulativeR: parseFloat(flawlessR.toFixed(2)),
      drawdown: parseFloat(dd.toFixed(2)),
      isMissed: missed,
    });
  });

  return points;
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : '$';
  const isNeg = amount < 0;
  const absVal = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${isNeg ? '-' : ''}${symbol}${absVal}`;
}
