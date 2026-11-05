import { useEffect, useMemo, useState } from 'react';
import { adaptFirm, type AdaptedChallenge, type DirectoryFirmRow } from '@luxalgo/prop-firm-sim-core/directory';
import { simulate, type ChallengeSpecInput, type SimResult } from '@luxalgo/prop-firm-sim-core';
import type { Trade } from '../types/trade';
import type { JournalSnapshot } from '../types/journal';
import { toJournalRSeries } from '../features/propFirmSim/journalAdapter';

const DIRECTORY_URL = 'https://app.luxalgo.com/api/propfirms/list';
const defaultOptions: NonNullable<JournalSnapshot['propFirmSim']> = {
  riskMode: 'percent-of-initial', riskValue: 1, tradesPerDay: 3, paths: 5000, customChallenges: [], profileMode: 'journal', customProfile: { winRate: 50, avgWinR: 1.5, avgLossR: 1 },
};

type CustomChallenge = NonNullable<NonNullable<JournalSnapshot['propFirmSim']>['customChallenges']>[number];
const emptyRuleForm = {
  firmName: '', name: '', accountSize: '50000', currency: 'USD', productType: 'futures' as 'futures' | 'cfd' | 'equities',
  stepCount: '1', targetOne: '8', targetTwo: '5', targetThree: '5', minDays: '0', consistencyEnabled: false, consistencyPct: '50', maxDays: '',
  dailyLossEnabled: true, dailyLossKind: 'percent' as 'percent' | 'amount', dailyLoss: '5',
  dailyBasis: 'prior-day-balance' as 'prior-day-balance' | 'prior-day-equity', dailyLimitBasis: 'initial-balance' as 'initial-balance' | 'anchor', includesOpenPnl: true, dailyEvaluation: 'intraday' as 'intraday' | 'end-of-day',
  maxLossKind: 'percent' as 'percent' | 'amount', maxLoss: '10', maxLossMode: 'static-initial' as 'static-initial' | 'trailing-realized-eod' | 'trailing-intraday-unrealized' | 'trailing-locks-at-initial',
  fee: '500', billing: 'one-time' as 'one-time' | 'monthly', resetFee: '', activationFee: '0', refundable: false, includeExecutionCosts: true,
  fundedTargetPct: '0', fundedConsistency: false, fundedConsistencyPct: '50', profitSplit: '80', minPayoutDays: '14', minWinningDays: '0', payoutBuffer: '0', maxPayoutAmount: '', payoutFrequency: 'biweekly' as 'weekly' | 'biweekly' | 'monthly' | 'on-demand',
  newsTrading: false, weekendHolding: false, overnightHolding: false, stopLossRequired: false,
};

interface Props {
  trades: Trade[];
  config?: JournalSnapshot['propFirmSim'];
  onConfigChange: (config: NonNullable<JournalSnapshot['propFirmSim']>) => void;
  currency: string;
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const money = (value: number, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

function normalizeLossLimit<T extends { pct?: number; amount?: number } | null | undefined>(rule: T): T {
  if (!rule || rule.pct === undefined || rule.amount === undefined) return rule;
  const { amount: _duplicateAmount, ...percentageRule } = rule;
  return percentageRule as T;
}

function normalizeChallengeSpec(spec: ChallengeSpecInput): ChallengeSpecInput {
  return {
    ...spec,
    dailyLoss: normalizeLossLimit(spec.dailyLoss),
    maxLoss: normalizeLossLimit(spec.maxLoss),
    steps: spec.steps.map((step) => ({
      ...step,
      dailyLoss: step.dailyLoss === undefined ? undefined : normalizeLossLimit(step.dailyLoss),
      maxLoss: step.maxLoss === undefined ? undefined : normalizeLossLimit(step.maxLoss),
    })),
    funded: {
      ...spec.funded,
      dailyLoss: spec.funded.dailyLoss === undefined ? undefined : normalizeLossLimit(spec.funded.dailyLoss),
      maxLoss: spec.funded.maxLoss === undefined ? undefined : normalizeLossLimit(spec.funded.maxLoss),
    },
  };
}

export function PropFirmSimulatorView({ trades, config, onConfigChange, currency }: Props) {
  const options = { ...defaultOptions, ...config };
  const [challenges, setChallenges] = useState<AdaptedChallenge[]>([]);
  const [directoryState, setDirectoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [result, setResult] = useState<SimResult | null>(null);
  const [runError, setRunError] = useState('');
  const [busy, setBusy] = useState(false);
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const customChallenges = options.customChallenges || [];

  useEffect(() => {
    let active = true;
    setDirectoryState('loading');
    fetch(DIRECTORY_URL)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Directory request failed (${response.status}).`);
        return response.json() as Promise<{ data?: { propfirms?: DirectoryFirmRow[] } }>;
      })
      .then((payload) => {
        if (!active) return;
        const firms = payload.data?.propfirms;
        if (!Array.isArray(firms)) throw new Error('The directory response did not include firm rules.');
        const adapted = firms.flatMap((firm) => adaptFirm(firm));
        setChallenges(adapted);
        setDirectoryState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        void error;
        setDirectoryState('error');
      });
    return () => { active = false; };
  }, []);

  const customSelected = customChallenges.find((challenge) => `custom:${challenge.id}` === options.challengeKey);
  const directorySelected = challenges.find((challenge) => `${challenge.propfirmId}:${challenge.challengeId}` === options.challengeKey)
    || (!customSelected ? challenges[0] : undefined);
  const rawSelectedSpec = customSelected?.spec || directorySelected?.spec;
  const selectedSpec = rawSelectedSpec ? normalizeChallengeSpec(rawSelectedSpec) : undefined;
  const selectedName = customSelected ? `${customSelected.firmName} · ${customSelected.name || customSelected.spec?.name || 'Custom challenge'}` : directorySelected ? `${directorySelected.firmName} · ${directorySelected.challengeName}` : '';
  const selectedCurrency = selectedSpec?.currency || customSelected?.instantRules?.currency || currency;
  const history = useMemo(() => toJournalRSeries(trades, customSelected?.includeExecutionCosts ?? true), [trades, customSelected?.includeExecutionCosts]);
  const winningRs = history.rSeries.filter((value) => value > 0);
  const losingRs = history.rSeries.filter((value) => value < 0);
  const journalStats = { winRate: history.rSeries.length ? (winningRs.length / history.rSeries.length) * 100 : 0, avgWinR: winningRs.length ? winningRs.reduce((sum, value) => sum + value, 0) / winningRs.length : 0, avgLossR: losingRs.length ? Math.abs(losingRs.reduce((sum, value) => sum + value, 0) / losingRs.length) : 0 };

  const updateConfig = (changes: Partial<NonNullable<JournalSnapshot['propFirmSim']>>) => onConfigChange({ ...options, ...changes });

  const addCustomChallenge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const accountSize = Number(ruleForm.accountSize);
    const maxLossValue = Number(ruleForm.maxLoss);
    const dailyLossValue = Number(ruleForm.dailyLoss);
    const isInstant = ruleForm.stepCount === 'instant';
    const targets = isInstant ? [] : [ruleForm.targetOne, ruleForm.targetTwo, ruleForm.targetThree].slice(0, Number(ruleForm.stepCount)).map(Number);
    const positive = [accountSize, maxLossValue, ...targets, ...(ruleForm.dailyLossEnabled ? [dailyLossValue] : [])].every((value) => Number.isFinite(value) && value > 0);
    if (!ruleForm.firmName.trim() || !ruleForm.name.trim() || !positive) return;
    const maxLoss = ruleForm.maxLossKind === 'percent'
      ? { pct: maxLossValue, mode: ruleForm.maxLossMode }
      : { amount: maxLossValue, mode: ruleForm.maxLossMode };
    const dailyLoss = !ruleForm.dailyLossEnabled ? null : {
      [ruleForm.dailyLossKind]: dailyLossValue,
      basis: ruleForm.dailyBasis,
      limitBasis: ruleForm.dailyLimitBasis,
      includesOpenPnl: ruleForm.includesOpenPnl,
      evaluation: ruleForm.dailyEvaluation,
    };
    const challengeId = `${ruleForm.firmName}-${ruleForm.name}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const coreRules: Omit<ChallengeSpecInput, 'steps'> = {
      challengeId,
      name: ruleForm.name.trim(), productType: ruleForm.productType, accountSize, currency: ruleForm.currency.toUpperCase().slice(0, 3),
      dailyLoss, maxLoss,
      fees: { price: Math.max(0, Number(ruleForm.fee) || 0), billing: ruleForm.billing, resetFee: ruleForm.resetFee ? Number(ruleForm.resetFee) : null, activationFee: Math.max(0, Number(ruleForm.activationFee) || 0), refundableOnPass: ruleForm.refundable },
      funded: {
        profitSplitPct: Number(ruleForm.profitSplit), payoutFrequency: ruleForm.payoutFrequency,
        firstPayoutMinDays: Number(ruleForm.minPayoutDays) || 0,
        payoutRules: {
          ...(ruleForm.fundedConsistency ? { consistencyMaxBestDayPct: Number(ruleForm.fundedConsistencyPct) } : {}),
          minWinningDays: Number(ruleForm.minWinningDays) || 0,
          bufferAmount: Number(ruleForm.payoutBuffer) || 0,
          ...(Number(ruleForm.maxPayoutAmount) > 0 ? { maxPayoutAmount: Number(ruleForm.maxPayoutAmount) } : {}),
        },
        notes: Number(ruleForm.fundedTargetPct) > 0 ? `Funded-stage profit target: ${Number(ruleForm.fundedTargetPct)}% (recorded for reference; not simulated).` : undefined,
      },
      constraints: { newsTrading: ruleForm.newsTrading, weekendHolding: ruleForm.weekendHolding, overnightHolding: ruleForm.overnightHolding, stopLossRequired: ruleForm.stopLossRequired },
      flagsNotSimulated: Number(ruleForm.fundedTargetPct) > 0 ? ['funded-profit-target'] : [],
    };
    const spec: ChallengeSpecInput | undefined = isInstant ? undefined : {
      ...coreRules,
      steps: targets.map((profitTargetPct) => ({
        profitTargetPct,
        minTradingDays: Number(ruleForm.minDays) || 0,
        maxDays: Number(ruleForm.maxDays) > 0 ? Number(ruleForm.maxDays) : null,
        consistency: ruleForm.consistencyEnabled ? { maxBestDayProfitPct: Number(ruleForm.consistencyPct) } : null,
      })),
    };
    const saved: CustomChallenge = { id: challengeId, firmName: ruleForm.firmName.trim(), name: ruleForm.name.trim(), accountType: isInstant ? 'instant' : 'evaluation', spec, instantRules: isInstant ? coreRules : undefined, createdAt: new Date().toISOString(), includeExecutionCosts: ruleForm.includeExecutionCosts };
    updateConfig({ customChallenges: [...customChallenges, saved], challengeKey: `custom:${saved.id}` });
    setResult(null);
    setCustomFormOpen(false);
    setRuleForm(emptyRuleForm);
  };

  const removeCustomChallenge = (id: string) => {
    updateConfig({ customChallenges: customChallenges.filter((item) => item.id !== id), challengeKey: options.challengeKey === `custom:${id}` ? undefined : options.challengeKey });
    setResult(null);
  };

  const runSimulation = () => {
    if (!selectedSpec || (options.profileMode !== 'custom' && history.rSeries.length < 10)) return;
    setBusy(true);
    setRunError('');
    setResult(null);
    // Yield one frame so the loading affordance appears before CPU work begins.
    window.setTimeout(() => {
      try {
        const sourceProfile = options.profileMode === 'custom'
          ? { kind: 'parametric' as const, winRate: (options.customProfile?.winRate || 0) / 100, avgWinR: options.customProfile?.avgWinR || 0, avgLossR: options.customProfile?.avgLossR || 1, tradesPerDay: Number(options.tradesPerDay), tradesPerDayModel: 'poisson' as const, risk: { mode: options.riskMode, value: Number(options.riskValue) } }
          : { kind: 'bootstrap' as const, rSeries: history.rSeries, blockMeanLength: 3, tradesPerDay: Number(options.tradesPerDay), tradesPerDayModel: 'poisson' as const, risk: { mode: options.riskMode, value: Number(options.riskValue) } };
        const next = simulate(selectedSpec, sourceProfile, { paths: Number(options.paths), seed: 42 });
        setResult(next);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : 'The simulation could not be run with these inputs.');
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const selectClass = 'mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 text-on-surface outline-none focus:border-primary-container';
  const inputClass = selectClass;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="font-caption-mono text-[10px] uppercase tracking-[0.18em] text-tertiary">Journal tools</p><h1 className="mt-1 text-3xl font-semibold">Prop firm simulator</h1><p className="mt-1 text-sm text-tertiary">Replay your journal or a custom profile against a challenge’s rules.</p></div>
        <span className="rounded-full border border-outline-variant px-3 py-1 font-caption-mono text-[10px] uppercase text-tertiary">LuxAlgo core · {history.eligibleCount} usable trades</span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
          <h2 className="font-semibold">Challenge & risk</h2>
          {directoryState === 'loading' && <p className="mt-4 text-sm text-tertiary">Loading the public firm rules directory…</p>}
          {directoryState === 'error' && <p className="mt-3 rounded-xl bg-surface-container-low px-3 py-2 text-xs text-tertiary">Published firm rules are temporarily unavailable. You can still add and simulate your own rules below.</p>}
          {directoryState === 'ready' && <label className="mt-4 block text-xs font-medium text-tertiary">Published firm challenge<select className={selectClass} value={directorySelected ? `${directorySelected.propfirmId}:${directorySelected.challengeId}` : ''} onChange={(event) => { updateConfig({ challengeKey: event.target.value }); setResult(null); }}><option value="" disabled>Select a published challenge</option>{challenges.map((challenge) => <option key={`${challenge.propfirmId}:${challenge.challengeId}`} value={`${challenge.propfirmId}:${challenge.challengeId}`}>{challenge.firmName} · {challenge.challengeName} · {challenge.spec.currency} {challenge.spec.accountSize.toLocaleString()}</option>)}</select></label>}
          {customChallenges.length > 0 && <div className="mt-4 flex items-end gap-2"><label className="block min-w-0 flex-1 text-xs font-medium text-tertiary">Your saved rules<select className={selectClass} value={customSelected ? `custom:${customSelected.id}` : ''} onChange={(event) => { updateConfig({ challengeKey: event.target.value }); setResult(null); }}><option value="">Choose your own rules</option>{customChallenges.map((challenge) => <option key={challenge.id} value={`custom:${challenge.id}`}>{challenge.firmName} · {challenge.name || challenge.spec?.name || 'Custom challenge'}{challenge.accountType === 'instant' ? ' · Instant' : ''}</option>)}</select></label>{customSelected && <button type="button" onClick={() => removeCustomChallenge(customSelected.id)} className="mb-0.5 rounded-full border border-outline-variant px-3 py-2.5 text-xs text-tertiary hover:text-secondary">Remove</button>}</div>}
          <div className="mt-4 rounded-xl border border-outline-variant p-3 sm:p-4">
            <button type="button" onClick={() => setCustomFormOpen((open) => !open)} className="flex w-full items-center justify-between gap-3 text-left"><span><span className="block text-sm font-semibold">Add your own firm rules</span><span className="mt-1 block text-xs text-tertiary">Save a challenge spec for firms missing from the directory.</span></span><span className="rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-semibold">{customFormOpen ? 'Close' : '+ Add rules'}</span></button>
            {customFormOpen && <form onSubmit={addCustomChallenge} className="mt-4 space-y-4 border-t border-outline-variant pt-4">
              <div className="grid gap-3 sm:grid-cols-2"><Field label="Firm name"><input required className={inputClass} value={ruleForm.firmName} onChange={(e) => setRuleForm({ ...ruleForm, firmName: e.target.value })} placeholder="e.g. My Prop Firm" /></Field><Field label="Challenge name"><input required className={inputClass} value={ruleForm.name} onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })} placeholder="e.g. 50K Evaluation" /></Field></div>
              <div className="grid gap-3 xl:grid-cols-3">
                <fieldset className="min-w-0 space-y-3 rounded-xl border border-outline-variant p-3"><legend className="px-1 text-xs font-semibold uppercase tracking-wider text-primary">1. Account setup</legend><div className="grid grid-cols-2 gap-2"><Field label="Account cost"><input type="number" min="0" step="1" className={inputClass} value={ruleForm.fee} onChange={(e) => setRuleForm({ ...ruleForm, fee: e.target.value })} /></Field><Field label="Billing"><select className={selectClass} value={ruleForm.billing} onChange={(e) => setRuleForm({ ...ruleForm, billing: e.target.value as typeof ruleForm.billing })}><option value="one-time">One time</option><option value="monthly">Monthly</option></select></Field></div><div className="grid grid-cols-2 gap-2"><Field label="Account size"><input required type="number" min="1" className={inputClass} value={ruleForm.accountSize} onChange={(e) => setRuleForm({ ...ruleForm, accountSize: e.target.value })} /></Field><Field label="Currency"><input required minLength={3} maxLength={3} className={inputClass} value={ruleForm.currency} onChange={(e) => setRuleForm({ ...ruleForm, currency: e.target.value.toUpperCase() })} /></Field></div><Field label="Market"><select className={selectClass} value={ruleForm.productType} onChange={(e) => setRuleForm({ ...ruleForm, productType: e.target.value as typeof ruleForm.productType })}><option value="futures">Futures</option><option value="cfd">CFD / Forex</option><option value="equities">Equities</option></select></Field><div className="grid grid-cols-2 gap-2"><Field label="Reset fee (optional)"><input type="number" min="0" step="1" className={inputClass} value={ruleForm.resetFee} onChange={(e) => setRuleForm({ ...ruleForm, resetFee: e.target.value })} /></Field><Field label="Activation fee"><input type="number" min="0" step="1" className={inputClass} value={ruleForm.activationFee} onChange={(e) => setRuleForm({ ...ruleForm, activationFee: e.target.value })} /></Field></div><label className="flex items-start gap-2 text-xs text-tertiary"><input type="checkbox" checked={ruleForm.includeExecutionCosts} onChange={(e) => setRuleForm({ ...ruleForm, includeExecutionCosts: e.target.checked })} /><span>Include execution costs<span className="mt-1 block opacity-80">On uses net journal P&amp;L after logged fees; off uses gross P&amp;L before fees.</span></span></label></fieldset>
                <fieldset className="min-w-0 space-y-3 rounded-xl border border-outline-variant p-3"><legend className="px-1 text-xs font-semibold uppercase tracking-wider text-primary">2. Challenge rules</legend>
                  <Field label="Account type"><select className={selectClass} value={ruleForm.stepCount} onChange={(e) => setRuleForm({ ...ruleForm, stepCount: e.target.value })}><option value="instant">Instant account · no evaluation</option><option value="1">1-step challenge</option><option value="2">2-step challenge</option><option value="3">3-step challenge</option></select></Field>
                  {ruleForm.stepCount === 'instant' ? <p className="rounded-lg bg-surface-container-low p-2 text-xs text-tertiary">Instant rules can be saved. This simulator currently models evaluation challenges only, so pass-rate simulation is unavailable for instant accounts.</p> : <>
                    <div className="grid gap-2 sm:grid-cols-2"><Field label="Phase 1 target (%)"><input required type="number" min="0.1" step="0.1" className={inputClass} value={ruleForm.targetOne} onChange={(e) => setRuleForm({ ...ruleForm, targetOne: e.target.value })} /></Field>{Number(ruleForm.stepCount) >= 2 && <Field label="Phase 2 target (%)"><input required type="number" min="0.1" step="0.1" className={inputClass} value={ruleForm.targetTwo} onChange={(e) => setRuleForm({ ...ruleForm, targetTwo: e.target.value })} /></Field>}{Number(ruleForm.stepCount) >= 3 && <Field label="Phase 3 target (%)"><input required type="number" min="0.1" step="0.1" className={inputClass} value={ruleForm.targetThree} onChange={(e) => setRuleForm({ ...ruleForm, targetThree: e.target.value })} /></Field>}</div>
                    <div className="grid grid-cols-2 gap-2"><Field label="Min trading days"><input type="number" min="0" step="1" className={inputClass} value={ruleForm.minDays} onChange={(e) => setRuleForm({ ...ruleForm, minDays: e.target.value })} /></Field><Field label="Max days (blank = none)"><input type="number" min="1" step="1" className={inputClass} value={ruleForm.maxDays} onChange={(e) => setRuleForm({ ...ruleForm, maxDays: e.target.value })} /></Field></div>
                    <label className="flex items-center gap-2 text-xs text-tertiary"><input type="checkbox" checked={ruleForm.consistencyEnabled} onChange={(e) => setRuleForm({ ...ruleForm, consistencyEnabled: e.target.checked })} />Apply challenge consistency rule</label>{ruleForm.consistencyEnabled && <Field label="Best day cap (% of profit)"><input type="number" min="1" max="100" step="1" className={inputClass} value={ruleForm.consistencyPct} onChange={(e) => setRuleForm({ ...ruleForm, consistencyPct: e.target.value })} /></Field>}
                  </>}
                  <Field label="Drawdown type"><select className={selectClass} value={ruleForm.maxLossMode} onChange={(e) => setRuleForm({ ...ruleForm, maxLossMode: e.target.value as typeof ruleForm.maxLossMode })}><option value="static-initial">Static balance drawdown</option><option value="trailing-realized-eod">Trailing, end of day</option><option value="trailing-intraday-unrealized">Trailing intraday</option><option value="trailing-locks-at-initial">Trailing, locks at start</option></select></Field>
                  <div className="grid grid-cols-2 gap-2"><Field label="Total max DD (%)"><input required type="number" min="0.1" step="0.1" className={inputClass} value={ruleForm.maxLoss} onChange={(e) => setRuleForm({ ...ruleForm, maxLossKind: 'percent', maxLoss: e.target.value })} /></Field><Field label="Daily max DD (%)"><input required type="number" min="0.1" step="0.1" className={inputClass} value={ruleForm.dailyLoss} onChange={(e) => setRuleForm({ ...ruleForm, dailyLossEnabled: true, dailyLossKind: 'percent', dailyLoss: e.target.value })} /></Field></div>
                </fieldset>
                <fieldset className="min-w-0 space-y-3 rounded-xl border border-outline-variant p-3"><legend className="px-1 text-xs font-semibold uppercase tracking-wider text-primary">3. Funded & payout rules</legend><Field label="Funded profit target (%) · 0 = none"><input type="number" min="0" step="0.1" className={inputClass} value={ruleForm.fundedTargetPct} onChange={(e) => setRuleForm({ ...ruleForm, fundedTargetPct: e.target.value })} /></Field><label className="flex items-center gap-2 text-xs text-tertiary"><input type="checkbox" checked={ruleForm.fundedConsistency} onChange={(e) => setRuleForm({ ...ruleForm, fundedConsistency: e.target.checked })} />Apply funded consistency rule</label>{ruleForm.fundedConsistency && <Field label="Best day cap (% per payout window)"><input type="number" min="1" max="100" step="1" className={inputClass} value={ruleForm.fundedConsistencyPct} onChange={(e) => setRuleForm({ ...ruleForm, fundedConsistencyPct: e.target.value })} /></Field>}<div className="grid grid-cols-2 gap-2"><Field label="Payout split (%)"><input required type="number" min="0" max="100" step="1" className={inputClass} value={ruleForm.profitSplit} onChange={(e) => setRuleForm({ ...ruleForm, profitSplit: e.target.value })} /></Field><Field label="Min days to payout"><input type="number" min="0" step="1" className={inputClass} value={ruleForm.minPayoutDays} onChange={(e) => setRuleForm({ ...ruleForm, minPayoutDays: e.target.value })} /></Field></div><Field label="Payout schedule"><select className={selectClass} value={ruleForm.payoutFrequency} onChange={(e) => setRuleForm({ ...ruleForm, payoutFrequency: e.target.value as typeof ruleForm.payoutFrequency })}><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="on-demand">On demand</option></select></Field><label className="flex items-center gap-2 text-xs text-tertiary"><input type="checkbox" checked={ruleForm.refundable} onChange={(e) => setRuleForm({ ...ruleForm, refundable: e.target.checked })} />Account fee refunded on pass</label></fieldset>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2">{([['newsTrading', 'News trading allowed'], ['weekendHolding', 'Weekend holding allowed'], ['overnightHolding', 'Overnight holding allowed'], ['stopLossRequired', 'Stop loss required']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs text-tertiary"><input type="checkbox" checked={ruleForm[key]} onChange={(e) => setRuleForm({ ...ruleForm, [key]: e.target.checked })} />{label}</label>)}</div>
              <p className="text-xs text-tertiary">Add the rules as your firm publishes them. Informational restrictions are saved but aren’t simulated by the engine.</p><button type="submit" className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary">Save rules</button>
            </form>}
          </div>
          <div className="mt-4 rounded-xl bg-surface-container-low p-3 sm:p-4">
            <p className="text-sm font-medium">Trading profile data source</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="radio" name="prop-profile-source" checked={options.profileMode !== 'custom'} onChange={() => { updateConfig({ profileMode: 'journal' }); setResult(null); }} />Use logged trades ({history.eligibleCount} eligible)</label><label className="flex items-center gap-2"><input type="radio" name="prop-profile-source" checked={options.profileMode === 'custom'} onChange={() => { updateConfig({ profileMode: 'custom' }); setResult(null); }} />Create a custom profile</label></div>
            {options.profileMode === 'custom' ? <div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-xs font-medium text-tertiary">Win rate (%)<input className={inputClass} type="number" min="0" max="100" step="0.1" value={options.customProfile?.winRate ?? 50} onChange={(e) => updateConfig({ customProfile: { ...(options.customProfile || { winRate: 50, avgWinR: 1.5, avgLossR: 1 }), winRate: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } })} /></label><label className="text-xs font-medium text-tertiary">Average win (R)<input className={inputClass} type="number" min="0.1" step="0.1" value={options.customProfile?.avgWinR ?? 1.5} onChange={(e) => updateConfig({ customProfile: { ...(options.customProfile || { winRate: 50, avgWinR: 1.5, avgLossR: 1 }), avgWinR: Math.max(0.1, Number(e.target.value) || 0.1) } })} /></label><label className="text-xs font-medium text-tertiary">Average loss (R)<input className={inputClass} type="number" min="0.1" step="0.1" value={options.customProfile?.avgLossR ?? 1} onChange={(e) => updateConfig({ customProfile: { ...(options.customProfile || { winRate: 50, avgWinR: 1.5, avgLossR: 1 }), avgLossR: Math.max(0.1, Number(e.target.value) || 0.1) } })} /></label></div> : <p className="mt-2 text-xs text-tertiary">{history.eligibleCount ? `${history.eligibleCount} logged trades · ${journalStats.winRate.toFixed(1)}% wins · avg win ${journalStats.avgWinR.toFixed(2)}R · avg loss ${journalStats.avgLossR.toFixed(2)}R` : 'No eligible closed trades in this profile yet. You can enter a custom trading profile.'}</p>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-tertiary">Risk sizing<select className={selectClass} value={options.riskMode} onChange={(event) => updateConfig({ riskMode: event.target.value as typeof options.riskMode })}><option value="percent-of-initial">% of starting balance</option><option value="percent-of-balance">% of current balance</option><option value="fixed-amount">Fixed amount</option></select></label>
            <label className="text-xs font-medium text-tertiary">Risk per trade<input className={inputClass} type="number" min="0.1" step="0.1" value={options.riskValue} onChange={(event) => updateConfig({ riskValue: Math.max(0.1, Number(event.target.value) || 0.1) })} /></label>
            <label className="text-xs font-medium text-tertiary">Trades per day<input className={inputClass} type="number" min="0.1" max="30" step="0.5" value={options.tradesPerDay} onChange={(event) => updateConfig({ tradesPerDay: Math.max(0.1, Number(event.target.value) || 0.1) })} /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3">
            <p className="text-sm">History sample <strong className="font-caption-mono">{history.eligibleCount}</strong> closed executed trades</p>
            <button type="button" onClick={runSimulation} disabled={!selectedSpec || (options.profileMode !== 'custom' && history.rSeries.length < 10) || busy} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Simulating…' : 'Run simulation'}</button>
          </div>
          {customSelected?.accountType === 'instant' && <p className="text-xs text-tertiary">This instant account is saved, but the current simulation engine only supports evaluation challenges. Its funded rules are retained for reference.</p>}
          {history.excludedForMissingRisk > 0 && <p className="mt-3 text-xs text-tertiary">{history.excludedForMissingRisk} closed trades were excluded because no risk amount was saved. Add risk values to include them.</p>}
          {history.eligibleCount < 10 && options.profileMode !== 'custom' && <p className="mt-3 text-sm text-tertiary">Missed and open trades are excluded. The real-trade bootstrap requires at least 10 closed trades with saved risk.</p>}
          {(selectedSpec || customSelected?.accountType === 'instant') && <div className="mt-4 border-t border-outline-variant pt-4"><p className="font-caption-mono text-[10px] uppercase text-tertiary">Rule source</p><p className="mt-1 text-sm">{selectedName} · {customSelected ? 'Custom rules entered by you' : directorySelected?.provenance === 'directory+inferred' ? `Some rules inferred: ${directorySelected.inferredFields.join(', ') || 'see package notes'}` : 'Structured rules from public directory'}</p><p className="mt-1 text-xs text-tertiary">{customSelected?.accountType === 'instant' ? 'Instant account rules are saved. Pass-rate simulation is unavailable because this engine requires an evaluation phase.' : customSelected ? 'Check these values against your firm’s current terms before relying on the estimate.' : 'Rules can change; confirm details with the firm before relying on this estimate.'}</p></div>}
        </section>

        <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
          <h2 className="font-semibold">Simulation result</h2>
          {!result && !runError && <p className="mt-4 text-sm text-tertiary">{customSelected?.accountType === 'instant' ? 'Instant funding rules saved. This engine cannot estimate a no-evaluation account yet.' : 'Run a simulation to see an estimated pass rate, attempts, cost, and outcome range.'}</p>}
          {runError && <p className="mt-4 text-sm text-secondary">{runError}</p>}
          {result && <>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Pass per attempt" value={pct(result.perAttempt.passProbability)} />
              <Metric label="Funded chance" value={pct(result.journey.fundedProbability)} />
              <Metric label="Expected attempts" value={result.journey.attempts.mean.toFixed(1)} />
              <Metric label="Expected challenge cost" value={money(result.journey.cost.mean, selectedCurrency)} />
            </div>
            <p className="mt-4 text-xs text-tertiary">95% pass interval: {pct(result.perAttempt.passProbabilityCi.low)}–{pct(result.perAttempt.passProbabilityCi.high)} · {result.meta.paths.toLocaleString()} paths · deterministic seed {result.meta.seed}</p>
            {result.assumptions.flags.length > 0 && <details className="mt-4 rounded-xl bg-surface-container-low p-3"><summary className="cursor-pointer text-sm font-medium">Simulation assumptions ({result.assumptions.flags.length})</summary><ul className="mt-2 space-y-2 text-xs text-tertiary">{result.assumptions.flags.map((flag) => <li key={flag.id}>{flag.detail}</li>)}</ul></details>}
            <p className="mt-3 text-xs text-tertiary">This is a Monte Carlo estimate based on your historical outcomes and the selected rule set, not a guarantee of future performance.</p>
          </>}
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-surface-container-low p-3"><p className="font-caption-mono text-[9px] uppercase tracking-wider text-tertiary">{label}</p><p className="mt-1 font-numeric-stat text-lg font-semibold">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-tertiary">{label}{children}</label>;
}
