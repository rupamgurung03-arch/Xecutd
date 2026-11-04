import type { Trade, PlaybookSetup, TradingRule, UserSettings } from './trade';

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

export interface JournalSnapshot {
  settings: UserSettings;
  trades: Trade[];
  playbooks: PlaybookSetup[];
  rules: TradingRule[];
  analysisPages: AnalysisPage[];
  customMistakes: string[];
  customQualities: string[];
  customGrades: string[];
}
