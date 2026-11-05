import type { Trade, PlaybookSetup, TradingRule, UserSettings } from './trade';
import type { ChallengeSpecInput } from '@luxalgo/prop-firm-sim-core';

export interface AnalysisShape {
  id: string;
  type: 'pen' | 'line' | 'arrow' | 'circle' | 'rectangle';
  start: { x: number; y: number };
  end: { x: number; y: number };
  points?: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface AnalysisPage {
  id: string;
  title: string;
  date: string;
  content: string;
  shapes?: AnalysisShape[];
  updatedAt: string;
}

export interface RakuChatMessage {
  id: string;
  sender: 'user' | 'coach';
  text: string;
  timestamp: string;
  sources?: { title: string; uri: string }[];
}

export interface JournalSnapshot {
  settings: UserSettings;
  trades: Trade[];
  playbooks: PlaybookSetup[];
  rules: TradingRule[];
  analysisPages: AnalysisPage[];
  customMistakes: string[];
  customQualities: string[];
  customGrades: string[];
  rakuChatHistory?: RakuChatMessage[];
  propFirmSim?: {
    challengeKey?: string;
    profileMode?: 'journal' | 'custom';
    customProfile?: { winRate: number; avgWinR: number; avgLossR: number };
    customChallenges?: Array<{
      id: string;
      firmName: string;
      name: string;
      spec?: ChallengeSpecInput;
      instantRules?: Omit<ChallengeSpecInput, 'steps'>;
      accountType?: 'evaluation' | 'instant';
      createdAt: string;
      riskPerTradePct?: number;
      includeExecutionCosts?: boolean;
    }>;
    riskMode: 'percent-of-initial' | 'percent-of-balance' | 'fixed-amount';
    riskValue: number;
    tradesPerDay: number;
    paths: number;
  };
}
