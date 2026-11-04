import assert from 'node:assert/strict';
import test from 'node:test';
import type { Trade } from '../types/trade';
import { calculateTradeMetrics, generateAiSummaryPayload } from './tradeAnalyticsEngine';

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: 'T-1', symbol: 'TEST', assetClass: 'Futures', side: 'Long', status: 'Closed',
  entryDate: '2026-11-01', entryTime: '09:00', exitDate: '2026-11-01', exitTime: '09:45',
  entryPrice: 100, exitPrice: 102, stopLoss: 99, takeProfit: 104, quantity: 1, fee: 0,
  pnl: 200, pnlPercent: 2, plannedR: 4, realizedR: 2, setup: 'test', timeframe: '5M',
  rulesFollowed: true, disciplineScore: 5, emotion: 'Calm', mistakes: [], notes: '', tags: [],
  ...overrides,
});

test('calculates long MAE, MFE, realized R, and efficiency from prices', () => {
  const result = calculateTradeMetrics(makeTrade({ maxAdversePrice: 99.5, maxFavorablePrice: 104 }));
  assert.equal(result.mae_r, -0.5);
  assert.equal(result.mfe_r, 4);
  assert.equal(result.realized_r, 2);
  assert.equal(result.efficiency_pct, 50);
});

test('calculates short MAE and MFE with inverse price direction', () => {
  const result = calculateTradeMetrics(makeTrade({ side: 'Short', entryPrice: 100, stopLoss: 102, exitPrice: 96, maxAdversePrice: 101.5, maxFavorablePrice: 94 }));
  assert.equal(result.mae_r, -0.75);
  assert.equal(result.mfe_r, 3);
  assert.equal(result.realized_r, 2);
  assert.equal(result.efficiency_pct, 66.7);
});

test('returns safe zero R metrics when risk distance is zero', () => {
  const result = calculateTradeMetrics(makeTrade({ stopLoss: 100, maxAdversePrice: 95, maxFavorablePrice: 110 }));
  assert.equal(result.mae_r, 0);
  assert.equal(result.mfe_r, 0);
  assert.equal(result.realized_r, 0);
  assert.equal(result.efficiency_pct, 0);
});

test('aggregates closed trades, excursion thresholds, anomalies, and giveback', () => {
  const winner = makeTrade({ maxAdversePrice: 99.5, maxFavorablePrice: 104 });
  const loser = makeTrade({ id: 'T-2', exitTime: '09:45', exitPrice: 99, pnl: -100, realizedR: -1, maxAdversePrice: 98, maxFavorablePrice: 101 });
  const payload = generateAiSummaryPayload([winner, loser, makeTrade({ id: 'open', status: 'Open' })]);
  assert.equal(payload.overall_performance.total_trades, 2);
  assert.equal(payload.overall_performance.win_rate_pct, 50);
  assert.equal(payload.excursion_metrics.mfe_distribution_pct.at_least_4r, 100);
  assert.equal(payload.execution_anomalies.trades_over_30m_with_mae_below_minus_0_70r, 1);
  assert.equal(payload.execution_anomalies.loss_probability_pct, 100);
  assert.equal(payload.execution_anomalies.total_r_given_back_on_winners_over_1_5r, 2);
});

