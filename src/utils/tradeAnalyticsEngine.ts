import type { Trade } from '../types/trade';

export interface TradeMetrics {
  trade_id: string;
  symbol: string;
  side: Trade['side'];
  entry_date: string;
  duration_minutes: number | null;
  mae_r: number;
  mfe_r: number;
  realized_r: number;
  planned_r: number;
  /** Favorable-excursion capture: realized R divided by MFE R. */
  realization_efficiency_pct: number;
  /** Target realization: realized R divided by planned R. */
  target_realization_rate_pct: number;
  /** @deprecated Use realization_efficiency_pct. Kept for existing local callers. */
  efficiency_pct: number;
  pnl_usd: number;
}

export interface AiSummaryPayload {
  user_profile: { period_evaluated: string; total_trades_count: number };
  overall_performance: {
    total_trades: number;
    win_rate_pct: number;
    winning_trades: number;
    losing_trades: number;
    net_realized_r: number;
    total_pnl_usd: number;
  };
  excursion_metrics: {
    avg_realized_r_per_win: number;
    avg_mfe_r_per_win: number;
    avg_mae_r_on_winners: number;
    realization_efficiency_pct: number;
    target_realization_rate_pct: number;
    profit_capture_efficiency_pct: number;
    mfe_distribution_pct: { at_least_1r: number; at_least_2r: number; at_least_3r: number; at_least_4r: number };
  };
  execution_anomalies: {
    trades_over_30m_with_mae_below_minus_0_70r: number;
    losses_among_those_trades: number;
    loss_probability_pct: number;
    total_r_given_back_on_winners_over_1_5r: number;
    trades_giving_back_over_1_5r: number;
  };
  trade_metrics: TradeMetrics[];
}

export interface TradeExcursionDisplay {
  mfeR: number | null;
  maeR: number | null;
  exitEfficiencyPct: number | null;
  gainedGivenBack: boolean;
}

const round2 = (value: number): number => Number.isFinite(value) ? Number(value.toFixed(2)) : 0;
const round1 = (value: number): number => Number.isFinite(value) ? Number(value.toFixed(1)) : 0;

const timestamp = (date?: string, time?: string): number | null => {
  if (!date || !time) return null;
  const parsed = Date.parse(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isFinite(parsed) ? parsed : null;
};

const durationMinutes = (trade: Trade): number | null => {
  const start = timestamp(trade.entryDate, trade.entryTime);
  const end = timestamp(trade.exitDate ?? trade.entryDate, trade.exitTime);
  return start === null || end === null || end < start ? null : round2((end - start) / 60_000);
};

const weightedExitPrice = (trade: Trade): number | null => {
  const parts = trade.partialExits?.filter((part) => Number.isFinite(part.exitPrice) && (part.exitPrice ?? 0) > 0) ?? [];
  if (parts.length && parts.reduce((sum, part) => sum + part.percentage, 0) >= 99.99) {
    return parts.reduce((sum, part) => sum + (part.exitPrice as number) * part.percentage, 0) / 100;
  }
  return trade.exitPrice ?? null;
};

/** Deterministically derives excursion and exit-efficiency metrics for one closed trade. */
export function calculateTradeMetrics(trade: Trade): TradeMetrics {
  const riskDist = Math.abs(trade.entryPrice - trade.stopLoss);
  if (riskDist === 0) {
    return {
      trade_id: trade.id, symbol: trade.symbol, side: trade.side, entry_date: trade.entryDate,
      duration_minutes: durationMinutes(trade), mae_r: 0, mfe_r: 0, realized_r: 0, planned_r: round2(trade.plannedR),
      realization_efficiency_pct: 0, target_realization_rate_pct: 0, efficiency_pct: 0, pnl_usd: round2(trade.pnl),
    };
  }

  // Existing journal fields hold the lowest/adverse and highest/favorable prices observed.
  const lowestPrice = trade.lowestPrice ?? (trade.side === 'Long' ? trade.maxAdversePrice : trade.maxFavorablePrice) ?? trade.entryPrice;
  const highestPrice = trade.highestPrice ?? (trade.side === 'Long' ? trade.maxFavorablePrice : trade.maxAdversePrice) ?? trade.entryPrice;
  const rawMae = trade.side === 'Long' ? lowestPrice - trade.entryPrice : trade.entryPrice - highestPrice;
  const rawMfe = trade.side === 'Long' ? highestPrice - trade.entryPrice : trade.entryPrice - lowestPrice;
  const exitPrice = weightedExitPrice(trade);
  const realizedPnlInPoints = exitPrice === null
    ? (trade.realizedR || 0) * riskDist
    : trade.side === 'Long' ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
  const maeR = round2(rawMae / riskDist);
  const mfeR = round2(rawMfe / riskDist);
  const realizedR = round2(realizedPnlInPoints / riskDist);
  const realizationEfficiencyPct = mfeR > 0 ? round1((realizedR / mfeR) * 100) : 0;
  const targetRealizationRatePct = trade.plannedR > 0 ? round1((realizedR / trade.plannedR) * 100) : 0;

  return {
    trade_id: trade.id, symbol: trade.symbol, side: trade.side, entry_date: trade.entryDate,
    duration_minutes: durationMinutes(trade), mae_r: maeR, mfe_r: mfeR, realized_r: realizedR, planned_r: round2(trade.plannedR),
    realization_efficiency_pct: realizationEfficiencyPct,
    target_realization_rate_pct: targetRealizationRatePct,
    efficiency_pct: realizationEfficiencyPct, pnl_usd: round2(trade.pnl),
  };
}

/** Returns only recorded/derivable excursion values for journal displays. */
export function getTradeExcursionDisplay(trade: Trade): TradeExcursionDisplay {
  const metrics = calculateTradeMetrics(trade);
  const hasMfe = trade.mfeR !== undefined || trade.maxFavorablePrice !== undefined ||
    (trade.side === 'Long' ? trade.highestPrice !== undefined : trade.lowestPrice !== undefined);
  const hasMae = trade.maeR !== undefined || trade.maxAdversePrice !== undefined ||
    (trade.side === 'Long' ? trade.lowestPrice !== undefined : trade.highestPrice !== undefined);
  const mfeR = hasMfe
    ? round2(Math.max(0, trade.mfeR !== undefined ? trade.mfeR : metrics.mfe_r))
    : null;
  const maeR = hasMae
    ? round2(-Math.abs(trade.maeR !== undefined ? trade.maeR : metrics.mae_r))
    : null;
  const realizedR = Number.isFinite(trade.realizedR) ? trade.realizedR : metrics.realized_r;
  const exitEfficiencyPct = mfeR !== null && mfeR > 0
    ? round1((realizedR / mfeR) * 100)
    : null;
  return { mfeR, maeR, exitEfficiencyPct, gainedGivenBack: mfeR !== null && mfeR > 2 && realizedR < 0 };
}

/** Builds the rounded, JSON-safe aggregate payload for a future AI summary model. */
export function generateAiSummaryPayload(trades: Trade[]): AiSummaryPayload {
  const closedTrades = trades.filter((trade) => trade.status === 'Closed' && trade.tradeStatus !== 'MISSED');
  const metrics = closedTrades.map(calculateTradeMetrics);
  const winners = metrics.filter((metric) => metric.pnl_usd > 0);
  const losers = metrics.filter((metric) => metric.pnl_usd < 0);
  const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const thresholdPct = (threshold: number) => winners.length ? round1(winners.filter((metric) => metric.mfe_r >= threshold).length / winners.length * 100) : 0;
  const avgRealizedR = mean(winners.map((metric) => metric.realized_r));
  const avgMfeR = mean(winners.map((metric) => metric.mfe_r));
  const avgPlannedR = mean(winners.map((metric) => metric.planned_r));
  const realizationEfficiencyPct = avgMfeR > 0 ? round1((avgRealizedR / avgMfeR) * 100) : 0;
  const targetRealizationRatePct = avgPlannedR > 0 ? round1((avgRealizedR / avgPlannedR) * 100) : 0;
  const anomalyTrades = metrics.filter((metric) => metric.duration_minutes !== null && metric.duration_minutes > 30 && metric.mae_r < -0.7);
  const givebackTrades = winners.filter((metric) => metric.mfe_r - metric.realized_r > 1.5);
  const dates = closedTrades.map((trade) => trade.entryDate).filter(Boolean).sort();

  return {
    user_profile: {
      period_evaluated: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No closed trades',
      total_trades_count: closedTrades.length,
    },
    overall_performance: {
      total_trades: closedTrades.length,
      win_rate_pct: closedTrades.length ? round1(winners.length / closedTrades.length * 100) : 0,
      winning_trades: winners.length,
      losing_trades: losers.length,
      net_realized_r: round2(metrics.reduce((sum, metric) => sum + metric.realized_r, 0)),
      total_pnl_usd: round2(metrics.reduce((sum, metric) => sum + metric.pnl_usd, 0)),
    },
    excursion_metrics: {
      avg_realized_r_per_win: round2(avgRealizedR),
      avg_mfe_r_per_win: round2(avgMfeR),
      avg_mae_r_on_winners: round2(mean(winners.map((metric) => metric.mae_r))),
      realization_efficiency_pct: realizationEfficiencyPct,
      target_realization_rate_pct: targetRealizationRatePct,
      profit_capture_efficiency_pct: realizationEfficiencyPct,
      mfe_distribution_pct: {
        at_least_1r: thresholdPct(1), at_least_2r: thresholdPct(2),
        at_least_3r: thresholdPct(3), at_least_4r: thresholdPct(4),
      },
    },
    execution_anomalies: {
      trades_over_30m_with_mae_below_minus_0_70r: anomalyTrades.length,
      losses_among_those_trades: anomalyTrades.filter((metric) => metric.pnl_usd < 0).length,
      loss_probability_pct: anomalyTrades.length ? round1(anomalyTrades.filter((metric) => metric.pnl_usd < 0).length / anomalyTrades.length * 100) : 0,
      total_r_given_back_on_winners_over_1_5r: round2(givebackTrades.reduce((sum, metric) => sum + metric.mfe_r - metric.realized_r, 0)),
      trades_giving_back_over_1_5r: givebackTrades.length,
    },
    trade_metrics: metrics,
  };
}

