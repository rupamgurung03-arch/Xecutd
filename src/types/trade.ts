export type AssetClass = 'Equities' | 'Crypto' | 'Futures' | 'Forex' | 'Options';
export type TradeSide = 'Long' | 'Short';
export type TradeStatus = 'Closed' | 'Open' | 'Pending';
export type TradeOutcome = 'Win' | 'Loss' | 'BreakEven';
export type TradeRecordStatus = 'EXECUTED' | 'MISSED';
export type MissedTradeReason = 'Hesitation' | 'Distraction' | 'Limit Not Filled (Spread/Slippage)' | 'Other';
export type HypotheticalOutcome = 'Win' | 'Loss' | 'Breakeven';
export type TradeSession = 'Asia' | 'London' | 'New York';

/** A scale-out portion as a percent of original position. `rMultiple` reads older journal records. */
export interface PartialExit {
  percentage: number;
  exitPrice?: number;
  rMultiple?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  assetClass: AssetClass;
  side: TradeSide;
  status: TradeStatus;
  tradeStatus?: TradeRecordStatus;
  missedReason?: MissedTradeReason;
  hypotheticalOutcome?: HypotheticalOutcome;
  plannedRR?: number;
  session?: TradeSession;
  entryDate: string; // YYYY-MM-DD
  entryTime: string; // HH:MM
  exitDate?: string;
  exitTime?: string;
  entryPrice: number;
  exitPrice?: number;
  partialExits?: PartialExit[];
  maxAdversePrice?: number;
  maxFavorablePrice?: number;
  maeR?: number;
  mfeR?: number;
  lowestPrice?: number;
  highestPrice?: number;
  stopLoss: number;
  takeProfit: number;
  quantity?: number;
  riskAmount?: number;
  fee: number;
  pnl: number; // Net $
  pnlPercent: number; // %
  plannedR: number; // e.g. 2.5
  realizedR: number; // e.g. +2.1 or -1.0
  setup: string;
  timeframe: string;
  rulesFollowed: boolean;
  disciplineScore: number; // 1 to 5
  emotion: 'Calm' | 'Confident' | 'Anxious' | 'FOMO' | 'Revenge' | 'Greedy' | 'Fearful' | 'Bored';
  psychologyTags?: string[];
  mistakes: string[];
  notes: string;
  imageUrl?: string;
  linkUrl?: string;
  tradeGrade?: string;
  executionQuality?: string;
  tags: string[];
}

export interface TradeStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number; // %
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  avgPlannedR: number;
  avgRealizedR: number;
  maxDrawdown: number; // %
  maxDrawdownAmount: number; // $
  expectancy: number; // $ per trade
  currentStreak: number;
  streakType: 'Win' | 'Loss' | 'None';
  rulesCompliance: number; // %
  totalFees: number;
}

export interface PlaybookSetup {
  id: string;
  name: string;
  description: string;
  timeframes: string[];
  rules: string[];
  bestConditions: string;
  invalidationCriteria: string;
  targetRiskReward: number;
  exampleUrl?: string;
  screenshotUrl?: string;
}

export interface TradingRule {
  id: string;
  text: string;
  category: 'Risk' | 'Execution' | 'Psychology';
  active: boolean;
}

export interface UserSettings {
  traderName: string;
  avatarPreset?: string;
  profileImage?: string;
  accountBalance: number;
  currency: string;
  riskPercentDefault: number;
  theme: 'dark' | 'light';
  journalTimeZone?: string;
}


