import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { INITIAL_PLAYBOOKS, INITIAL_RULES, INITIAL_USER_SETTINGS } from '../data/initialTrades';
import { supabase } from '../lib/supabaseClient';
import type { JournalSnapshot } from '../types/journal';
import { userStorageKey } from '../utils/userStorage';

export type JournalSyncStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'error';

const readUserValue = <T,>(userId: string, key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(userStorageKey(key, userId));
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const defaultSnapshot = (): JournalSnapshot => ({
  settings: { ...INITIAL_USER_SETTINGS },
  trades: [],
  playbooks: [],
  rules: INITIAL_RULES.map((rule) => ({ ...rule })),
  analysisPages: [{
    id: `analysis-${Date.now()}`,
    title: 'Trade ideas',
    date: new Date().toISOString().slice(0, 10),
    content: '',
    shapes: [],
    updatedAt: new Date().toISOString(),
  }],
  customMistakes: [],
  customQualities: [],
  customGrades: [],
});

const readLocalSnapshot = (userId: string): JournalSnapshot => {
  const defaults = defaultSnapshot();
  return {
    settings: { ...defaults.settings, ...readUserValue(userId, 'apextrade_settings', {}) },
    trades: readUserValue<JournalSnapshot['trades']>(userId, 'apextrade_trades', []).map((trade) => ({ ...trade, tradeStatus: trade.tradeStatus ?? 'EXECUTED' })),
    playbooks: readUserValue(userId, 'apextrade_playbooks', []),
    rules: readUserValue(userId, 'apextrade_rules', defaults.rules),
    analysisPages: readUserValue(userId, 'apextrade_analysis_pages', defaults.analysisPages),
    customMistakes: readUserValue(userId, 'apextrade_custom_mistakes', []),
    customQualities: readUserValue(userId, 'apextrade_execution_qualities', []),
    customGrades: readUserValue(userId, 'apextrade_custom_grades', []),
  };
};

const normalizeSnapshot = (value: unknown): JournalSnapshot => {
  const defaults = defaultSnapshot();
  if (!value || typeof value !== 'object') return defaults;
  const saved = value as Partial<JournalSnapshot>;
  return {
    settings: saved.settings && typeof saved.settings === 'object' ? { ...defaults.settings, ...saved.settings } : defaults.settings,
    trades: Array.isArray(saved.trades) ? saved.trades : defaults.trades,
    playbooks: Array.isArray(saved.playbooks) ? saved.playbooks : defaults.playbooks,
    rules: Array.isArray(saved.rules) ? saved.rules : defaults.rules,
    analysisPages: Array.isArray(saved.analysisPages) ? saved.analysisPages : defaults.analysisPages,
    customMistakes: Array.isArray(saved.customMistakes) ? saved.customMistakes : defaults.customMistakes,
    customQualities: Array.isArray(saved.customQualities) ? saved.customQualities : defaults.customQualities,
    customGrades: Array.isArray(saved.customGrades) ? saved.customGrades : defaults.customGrades,
  };
};

export const useSupabaseJournal = (userId: string) => {
  const [journal, setJournal] = useState<JournalSnapshot>(() => defaultSnapshot());
  const [status, setStatus] = useState<JournalSyncStatus>('loading');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const dirtyRef = useRef(false);
  const skipSaveRef = useRef(false);
  const revisionRef = useRef(0);
  const latestJournalRef = useRef(journal);
  latestJournalRef.current = journal;

  const loadFromCloud = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured for this build.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError('');
    setReady(false);
    try {
      const { data, error: loadError } = await supabase
        .from('user_journals')
        .select('payload')
        .eq('user_id', userId)
        .maybeSingle();
      if (loadError) throw loadError;

      const nextJournal = data?.payload ? normalizeSnapshot(data.payload) : readLocalSnapshot(userId);
      dirtyRef.current = false;
      skipSaveRef.current = Boolean(data?.payload);
      setJournal(nextJournal);
      setReady(true);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load this account’s journal from Supabase.');
      setStatus('error');
    }
  }, [userId]);

  const saveToCloud = useCallback(async (snapshot: JournalSnapshot, revision: number) => {
    const client = supabase;
    if (!client) return;
    setStatus('saving');
    setError('');
    try {
      const { error: saveError } = await client.from('user_journals').upsert({
        user_id: userId,
        payload: snapshot,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (saveError) throw saveError;
      if (revision === revisionRef.current) {
        dirtyRef.current = false;
        setStatus('saved');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this journal to Supabase.');
      setStatus('error');
    }
  }, [userId]);

  useEffect(() => {
    void loadFromCloud();
  }, [loadFromCloud]);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client.channel(`journal-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_journals',
        filter: `user_id=eq.${userId}`,
      }, (change) => {
        const changedRow = change.new as { payload?: unknown };
        if (dirtyRef.current || !changedRow.payload) return;
        skipSaveRef.current = true;
        setJournal(normalizeSnapshot(changedRow.payload));
        setStatus('saved');
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    dirtyRef.current = true;
    const revision = ++revisionRef.current;
    const timer = window.setTimeout(() => {
      void saveToCloud(latestJournalRef.current, revision);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [journal, ready, saveToCloud]);

  const updateField = useCallback(<K extends keyof JournalSnapshot>(key: K, action: SetStateAction<JournalSnapshot[K]>) => {
    dirtyRef.current = true;
    setJournal((current) => ({
      ...current,
      [key]: typeof action === 'function'
        ? (action as (previous: JournalSnapshot[K]) => JournalSnapshot[K])(current[key])
        : action,
    }));
  }, []);

  const retry = useCallback(() => {
    if (!ready) {
      void loadFromCloud();
      return;
    }
    const revision = ++revisionRef.current;
    void saveToCloud(latestJournalRef.current, revision);
  }, [loadFromCloud, ready, saveToCloud]);

  return { journal, updateField, status, error, retry, ready };
};
