import React, { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Trade, PartialExit, AssetClass, TradeSide, TradeStatus, TradeRecordStatus, MissedTradeReason, HypotheticalOutcome, TradeSession, UserSettings } from '../types/trade';
import { calculateTradePnL, calculatePlannedR, calculateRealizedR, formatCurrency } from '../utils/calculations';

interface NewTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTrade: (trade: Trade) => void;
  settings: UserSettings;
  editingTrade?: Trade | null;
  strategyOptions: string[];
  initialSymbol?: string;
  initialSide?: TradeSide;
  customMistakes: string[];
  setCustomMistakes: Dispatch<SetStateAction<string[]>>;
  customQualities: string[];
  setCustomQualities: Dispatch<SetStateAction<string[]>>;
  customGrades: string[];
  setCustomGrades: Dispatch<SetStateAction<string[]>>;
}

const COMMON_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'BTC/USDT', 'SPY', 'QQQ', 'NQ=F', 'ES=F', 'AMD', 'MSFT'];
const COMMON_MISTAKES = [
  'Early entry',
  'Late entry',
  'FOMO',
  'Oversized position',
  'Premature exit',
];

export const NewTradeModal: React.FC<NewTradeModalProps> = ({
  isOpen,
  onClose,
  onSaveTrade,
  settings,
  editingTrade,
  strategyOptions,
  initialSymbol,
  initialSide,
  customMistakes,
  setCustomMistakes,
  customQualities,
  setCustomQualities,
  customGrades,
  setCustomGrades,
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  const [symbol, setSymbol] = useState(editingTrade?.symbol || initialSymbol || '');
  const [assetClass, setAssetClass] = useState<AssetClass>(editingTrade?.assetClass || 'Equities');
  const [side, setSide] = useState<TradeSide>(editingTrade?.side || initialSide || 'Long');
  const [status, setStatus] = useState<TradeStatus>(editingTrade?.status || 'Closed');
  const [isAdvancedLog, setIsAdvancedLog] = useState(Boolean(editingTrade));
  const [quickOutcome, setQuickOutcome] = useState<'WIN' | 'LOSS' | null>(null);
  const [tradeStatus, setTradeStatus] = useState<TradeRecordStatus>(editingTrade?.tradeStatus || 'EXECUTED');
  const [missedReason, setMissedReason] = useState<MissedTradeReason | ''>(editingTrade?.missedReason || '');
  const [hypotheticalOutcome, setHypotheticalOutcome] = useState<HypotheticalOutcome | ''>(editingTrade?.hypotheticalOutcome || '');
  const [plannedRRInput, setPlannedRRInput] = useState(editingTrade?.plannedRR ? String(editingTrade.plannedRR) : '');
  const [session, setSession] = useState<TradeSession | ''>(editingTrade?.session || '');
  
  const [entryDate, setEntryDate] = useState(editingTrade?.entryDate || defaultDate);
  const [entryTime, setEntryTime] = useState(editingTrade?.entryTime || '09:45');
  const [exitDate, setExitDate] = useState(editingTrade?.exitDate || defaultDate);
  const [exitTime, setExitTime] = useState(editingTrade?.exitTime || '10:30');

  const [entryPrice, setEntryPrice] = useState<string>(editingTrade ? String(editingTrade.entryPrice) : '');
  const [exitPrice, setExitPrice] = useState<string>(editingTrade?.exitPrice ? String(editingTrade.exitPrice) : '');
  const [usePartialExits, setUsePartialExits] = useState(Boolean(editingTrade?.partialExits?.length));
  const [partialExits, setPartialExits] = useState<PartialExit[]>(editingTrade?.partialExits?.length ? editingTrade.partialExits.map((part) => ({
    percentage: part.percentage,
    exitPrice: part.exitPrice ?? (editingTrade.entryPrice + (editingTrade.side === 'Long' ? 1 : -1) * Math.abs(editingTrade.entryPrice - editingTrade.stopLoss) * (part.rMultiple ?? editingTrade.realizedR ?? 0)),
  })) : [{ percentage: 100, exitPrice: editingTrade?.exitPrice ?? editingTrade?.entryPrice ?? 0 }]);
  const [maxAdversePrice, setMaxAdversePrice] = useState(editingTrade?.maxAdversePrice === undefined ? '' : String(editingTrade.maxAdversePrice));
  const [maxFavorablePrice, setMaxFavorablePrice] = useState(editingTrade?.maxFavorablePrice === undefined ? '' : String(editingTrade.maxFavorablePrice));
  const [stopLoss, setStopLoss] = useState<string>(editingTrade ? String(editingTrade.stopLoss) : '');
  const [takeProfit, setTakeProfit] = useState<string>(editingTrade ? String(editingTrade.takeProfit) : '');
  const [riskAmount, setRiskAmount] = useState<string>(editingTrade?.riskAmount !== undefined ? String(editingTrade.riskAmount) : '');
  const [fee, setFee] = useState<string>(editingTrade ? String(editingTrade.fee ?? '') : '');
  const [formError, setFormError] = useState('');

  const [setup, setSetup] = useState(editingTrade?.setup || '');
  const [tagsInput, setTagsInput] = useState((editingTrade?.tags || []).filter((tag) => tag !== editingTrade?.setup && tag !== editingTrade?.assetClass).join(', '));
  const [timeframe, setTimeframe] = useState(editingTrade?.timeframe || '15M');
  const [rulesFollowed, setRulesFollowed] = useState(editingTrade ? editingTrade.rulesFollowed : true);
  const [disciplineScore, setDisciplineScore] = useState(editingTrade ? editingTrade.disciplineScore : 5);
  const [psychologyTags, setPsychologyTags] = useState<string[]>(() => editingTrade?.psychologyTags ?? (editingTrade?.emotion ? [editingTrade.emotion] : ['Calm']));
  const [mistakes, setMistakes] = useState<string[]>(editingTrade?.mistakes || []);
  const [executionQuality, setExecutionQuality] = useState(editingTrade?.executionQuality || '');
  const [customMistakeDraft, setCustomMistakeDraft] = useState('');
  const [customQualityDraft, setCustomQualityDraft] = useState('');
  const [notes, setNotes] = useState(editingTrade?.notes || '');
  const [imageUrl, setImageUrl] = useState(editingTrade?.imageUrl || '');
  const [imageError, setImageError] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [linkUrl, setLinkUrl] = useState(editingTrade?.linkUrl || '');
  const [showLinkInput, setShowLinkInput] = useState(Boolean(editingTrade?.linkUrl));
  const [linkError, setLinkError] = useState('');
  const [showGradePrompt, setShowGradePrompt] = useState(false);
  const [tradeGrade, setTradeGrade] = useState(editingTrade?.tradeGrade || '');
  const [newGrade, setNewGrade] = useState('');


  // Dynamic calculations
  const numEntry = parseFloat(entryPrice) || 0;
  const numExit = parseFloat(exitPrice) || 0;
  const numSL = parseFloat(stopLoss) || 0;
  const numTP = parseFloat(takeProfit) || 0;
  const numRiskAmount = riskAmount.trim() ? Number(riskAmount) : 0;
  const numFee = fee.trim() ? Number(fee) : Number.NaN;
  const numPlannedRR = plannedRRInput.trim() ? Number(plannedRRInput) : 0;
  const isMissed = tradeStatus === 'MISSED';

  // Position size is derived from the dollar risk and stop distance since the
  // entry form intentionally has no separate quantity field.
  const riskPerUnit = Math.abs(numEntry - numSL);
  useEffect(() => {
    if (!quickOutcome || numEntry <= 0 || riskPerUnit <= 0) return;
    if (quickOutcome === 'LOSS') {
      setExitPrice(String(numSL));
      return;
    }
    const target = numTP > 0 && (side === 'Long' ? numTP > numEntry : numTP < numEntry)
      ? numTP
      : numEntry + (side === 'Long' ? riskPerUnit : -riskPerUnit);
    setExitPrice(String(target));
  }, [quickOutcome, numEntry, numSL, numTP, riskPerUnit, side]);
  const numQty = riskPerUnit > 0 && numRiskAmount > 0
    ? numRiskAmount / riskPerUnit
    : editingTrade?.quantity || 1;
  const partialPercent = partialExits.reduce((sum, part) => sum + (Number(part.percentage) || 0), 0);
  const partialR = (price: number) => riskPerUnit > 0 ? (side === 'Long' ? price - numEntry : numEntry - price) / riskPerUnit : 0;
  const weightedPartialR = partialExits.reduce((sum, part) => sum + (Number(part.percentage) || 0) * partialR(Number(part.exitPrice) || 0), 0) / 100;
  const effectiveExitPrice = usePartialExits
    ? partialExits.reduce((sum, part) => sum + (Number(part.percentage) || 0) * (Number(part.exitPrice) || 0), 0) / 100
    : numExit;
  const effectiveExitText = usePartialExits ? String(effectiveExitPrice || '') : exitPrice;
  const { pnl, pnlPercent } = calculateTradePnL(side, numEntry, effectiveExitPrice, numQty, numFee);
  const partialPercentValid = Math.abs(partialPercent - 100) < 0.01;
  const partialPricesValid = partialExits.length > 0 && partialExits.every((part) => Number(part.percentage) > 0 && Number(part.exitPrice) > 0 && Number.isFinite(Number(part.exitPrice)));
  const partialsValid = !usePartialExits || (partialPricesValid && partialPercentValid);
  const pnlReady = !isMissed && status === 'Closed' && effectiveExitText.trim() !== '' &&
    riskAmount.trim() !== '' && fee.trim() !== '' && numEntry > 0 && effectiveExitPrice > 0 &&
    numSL > 0 && riskPerUnit > 0 && numRiskAmount > 0 && Number.isFinite(numRiskAmount) &&
    Number.isFinite(numFee) && numFee >= 0 && numQty > 0 && partialsValid;
  const plannedR = calculatePlannedR(side, numEntry, numSL, numTP);
  const realizedR = usePartialExits ? weightedPartialR : calculateRealizedR(side, numEntry, numExit, numSL);
  const maePriceValue = maxAdversePrice.trim() ? Number(maxAdversePrice) : Number.NaN;
  const mfePriceValue = maxFavorablePrice.trim() ? Number(maxFavorablePrice) : Number.NaN;
  const maeR = riskPerUnit > 0 && Number.isFinite(maePriceValue) ? Math.max(0, (side === 'Long' ? numEntry - maePriceValue : maePriceValue - numEntry) / riskPerUnit) : null;
  const mfeR = riskPerUnit > 0 && Number.isFinite(mfePriceValue) ? Math.max(0, (side === 'Long' ? mfePriceValue - numEntry : numEntry - mfePriceValue) / riskPerUnit) : null;

  const updatePartialExit = (index: number, field: keyof PartialExit, value: string) => {
    setPartialExits((current) => current.map((part, partIndex) => partIndex === index ? { ...part, [field]: value === '' ? 0 : Number(value) } : part));
  };

  const toggleMistake = (m: string) => {
    setMistakes((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const togglePsychology = (state: string) => {
    setPsychologyTags((previous) => previous.includes(state) ? previous.filter((item) => item !== state) : [...previous, state]);
  };

  const addCustomOption = (kind: 'mistake' | 'quality') => {
    const draft = (kind === 'mistake' ? customMistakeDraft : customQualityDraft).trim().slice(0, 32);
    const defaults = kind === 'mistake' ? COMMON_MISTAKES : ['Excellent', 'Good', 'Poor'];
    const current = kind === 'mistake' ? customMistakes : customQualities;
    const existing = [...defaults, ...current].find((item) => item.toLowerCase() === draft.toLowerCase());
    if (!draft) return;
    const selected = existing || draft;
    if (!existing) {
      const updated = [...current, selected];
      if (kind === 'mistake') {
        setCustomMistakes(updated);
        setCustomMistakeDraft('');
        toggleMistake(selected);
      } else {
        setCustomQualities(updated);
        setCustomQualityDraft('');
        setExecutionQuality(selected);
      }
      return;
    }
    if (kind === 'mistake') { setCustomMistakeDraft(''); toggleMistake(selected); }
    else { setCustomQualityDraft(''); setExecutionQuality(selected); }
  };

  const handleScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageError('Choose an image file for your trade screenshot.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImageError('That image is over 15 MB. Choose a smaller screenshot.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not read this image.'));
        image.src = objectUrl;
      });
      const scale = Math.min(1, 1600 / image.width, 1600 / image.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image processing is unavailable in this browser.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setImageUrl(canvas.toDataURL('image/jpeg', 0.78));
      setImageError('');
    } catch (error) {
      setImageError(error instanceof Error ? error.message : 'Could not attach that image.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const addCustomGrade = () => {
    const grade = newGrade.trim().slice(0, 12);
    if (!grade) return;
    const existingGrade = ['A', 'A+', 'B', 'C', ...customGrades].find((item) => item.toLowerCase() === grade.toLowerCase());
    if (!existingGrade) {
      const updatedGrades = [...customGrades, grade];
      setCustomGrades(updatedGrades);
    }
    setTradeGrade(existingGrade || grade);
    setNewGrade('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol || !numEntry) return;
    if (!riskAmount.trim() || !Number.isFinite(numRiskAmount) || numRiskAmount <= 0) {
      setFormError('Enter the dollar amount you risked on this trade.');
      return;
    }
    if (!isMissed && (!fee.trim() || !Number.isFinite(numFee) || numFee < 0)) {
      setFormError('Enter your total fees. Use 0 if there were no fees.');
      return;
    }
    if (isMissed && !missedReason) {
      setFormError('Choose why this trade was missed.');
      return;
    }
    if (!isMissed && !session) {
      setFormError('Choose the trading session for this trade.');
      return;
    }
    if (isMissed && (!hypotheticalOutcome || !plannedRRInput.trim() || !Number.isFinite(numPlannedRR) || numPlannedRR <= 0)) {
      setFormError('Choose the hypothetical outcome and enter the planned R:R.');
      return;
    }
    if (!isMissed && status === 'Closed' && (!exitPrice.trim() || !numExit || !Number.isFinite(numExit))) {
      if (!usePartialExits) {
        setFormError('Enter the exit price to calculate P&L for a closed trade.');
        return;
      }
    }
    if (!isMissed && status === 'Closed' && usePartialExits && !partialsValid) {
      setFormError(!partialPercentValid ? `Partial exit percentages must add up to 100% (currently ${partialPercent.toFixed(2)}%).` : 'Enter a valid exit price for each partial.');
      return;
    }
    if (!isMissed && status === 'Closed' && (!numSL || riskPerUnit <= 0)) {
      setFormError('Enter a stop loss different from the entry price so position size and P&L can be calculated from your risk.');
      return;
    }
    setFormError('');

    const normalizedLink = linkUrl.trim();
    if (normalizedLink) {
      try {
        const parsedLink = new URL(normalizedLink);
        if (!['http:', 'https:'].includes(parsedLink.protocol)) throw new Error();
      } catch {
        setLinkError('Enter a valid http or https link.');
        return;
      }
    }

    if (isAdvancedLog && !showGradePrompt) {
      setShowGradePrompt(true);
      return;
    }
    if (isAdvancedLog && !tradeGrade) return;

    const trade: Trade = {
      id: editingTrade?.id || `TR-${Date.now().toString().slice(-4)}`,
      symbol: symbol.toUpperCase().trim(),
      assetClass,
      side,
      status: isMissed ? 'Closed' : status,
      tradeStatus,
      missedReason: isMissed ? missedReason || undefined : undefined,
      hypotheticalOutcome: isMissed ? hypotheticalOutcome || undefined : undefined,
      plannedRR: isMissed ? numPlannedRR : undefined,
      session: session || undefined,
      entryDate,
      entryTime,
      exitDate: !isMissed && status === 'Closed' ? exitDate : undefined,
      exitTime: !isMissed && status === 'Closed' ? exitTime : undefined,
      entryPrice: numEntry,
      exitPrice: !isMissed && status === 'Closed' ? effectiveExitPrice : undefined,
      partialExits: !isMissed && status === 'Closed' && usePartialExits ? partialExits.map((part) => ({ percentage: part.percentage, exitPrice: Number(part.exitPrice), rMultiple: partialR(Number(part.exitPrice)) })) : undefined,
      maxAdversePrice: maxAdversePrice.trim() && Number.isFinite(Number(maxAdversePrice)) ? Number(maxAdversePrice) : undefined,
      maxFavorablePrice: maxFavorablePrice.trim() && Number.isFinite(Number(maxFavorablePrice)) ? Number(maxFavorablePrice) : undefined,
      maeR: maeR ?? undefined,
      mfeR: mfeR ?? undefined,
      lowestPrice: (side === 'Long' ? maxAdversePrice : maxFavorablePrice).trim() && Number.isFinite(Number(side === 'Long' ? maxAdversePrice : maxFavorablePrice)) ? Number(side === 'Long' ? maxAdversePrice : maxFavorablePrice) : undefined,
      highestPrice: (side === 'Long' ? maxFavorablePrice : maxAdversePrice).trim() && Number.isFinite(Number(side === 'Long' ? maxFavorablePrice : maxAdversePrice)) ? Number(side === 'Long' ? maxFavorablePrice : maxAdversePrice) : undefined,
      stopLoss: numSL,
      takeProfit: numTP,
      quantity: usePartialExits ? undefined : numQty,
      riskAmount: numRiskAmount,
      fee: isMissed ? 0 : numFee,
      pnl: isMissed ? 0 : pnlReady ? pnl : 0,
      pnlPercent: isMissed ? 0 : pnlReady ? pnlPercent : 0,
      plannedR: isMissed ? numPlannedRR : plannedR,
      realizedR: !isMissed && status === 'Closed' ? realizedR : 0,
      setup,
      timeframe,
      rulesFollowed,
      disciplineScore,
      emotion: (psychologyTags[0] || 'Calm') as Trade['emotion'],
      psychologyTags,
      mistakes,
      executionQuality,
      notes,
      imageUrl: imageUrl || undefined,
      linkUrl: normalizedLink || undefined,
      tradeGrade,
      tags: Array.from(new Set(tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean))),
    };

    onSaveTrade(trade);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-space-md overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant my-auto">
        
        {/* Header */}
        <div className="px-6 py-4 bg-surface-container-low flex items-center gap-3 border-b border-outline-variant">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-2 h-2 shrink-0 rounded-full bg-primary-container animate-pulse shadow-sm"></span>
            <span className="truncate font-caption-mono text-body-sm font-bold text-on-surface uppercase tracking-wider">
              {editingTrade ? `Edit trade · ${editingTrade.id}` : isAdvancedLog ? 'Advanced log' : 'Quick log'}
            </span>
          </div>
          {!editingTrade && !isMissed && status === 'Closed' && !usePartialExits && <div className="flex shrink-0 items-center gap-1.5" aria-label="Quick result">
            {(['WIN', 'LOSS'] as const).map((outcome) => <button key={outcome} type="button" aria-pressed={quickOutcome === outcome} onClick={() => { setQuickOutcome(outcome); setFormError(''); }} className={`min-h-9 min-w-14 border-2 px-3 py-1.5 font-caption-mono text-[11px] font-extrabold uppercase tracking-wide shadow-sm transition-colors ${quickOutcome === outcome ? outcome === 'WIN' ? 'border-emerald-800 bg-emerald-700 text-white' : 'border-red-800 bg-red-700 text-white' : outcome === 'WIN' ? 'border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-red-700 bg-red-50 text-red-800 hover:bg-red-100'}`}>{outcome}</button>)}
          </div>}
          <button
            onClick={onClose}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-tertiary transition-colors hover:bg-surface-container-high hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-body-md">close</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {!editingTrade && <div className="border border-primary-container bg-primary-container/10 p-3">
            {!isAdvancedLog ? <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-caption-mono text-[11px] font-bold uppercase text-on-surface">Quick trade log</p><p className="mt-1 font-body-sm text-caption-mono text-tertiary">Record the core prices and risk. Add a full review when you need more detail.</p></div>
              <button type="button" onClick={() => setIsAdvancedLog(true)} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 bg-on-surface px-5 py-2 font-caption-mono text-[11px] font-bold uppercase tracking-wide text-surface-container-lowest shadow-md hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-container">
                <span className="material-symbols-outlined text-body-sm" aria-hidden="true">tune</span>Advanced log
              </button>
            </div> : <div className="flex items-center justify-between gap-3">
              <div><p className="font-caption-mono text-[11px] font-bold uppercase text-on-surface">Full trade review</p><p className="mt-1 font-body-sm text-caption-mono text-tertiary">Add strategy, psychology, excursions, partial exits, and evidence.</p></div>
              <button type="button" onClick={() => setIsAdvancedLog(false)} className="shrink-0 border border-outline-variant px-3 py-2 font-caption-mono text-[10px] font-bold uppercase text-on-surface">Quick log</button>
            </div>}
          </div>}
          
          <section className="flex flex-col gap-3">
          <h3 className="font-headline-md text-body-lg text-on-surface font-bold">Trade</h3>
          {/* Symbol & Side & Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">SYMBOL / TICKER</span>
              <input
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="NVDA"
                className="min-w-0 bg-surface-container-lowest px-3 py-2.5 rounded-xl text-on-surface font-caption-mono text-body-md uppercase outline-none border border-outline-variant focus:border-on-surface transition-colors"
              />
            </div>

            <label className="flex flex-col gap-1 font-caption-mono text-[11px] font-medium uppercase text-tertiary">Asset class
              <select value={assetClass} onChange={(event) => setAssetClass(event.target.value as AssetClass)} className="min-w-0 min-h-11 border border-outline-variant bg-surface-container-lowest px-3 font-body-sm text-on-surface outline-none focus:border-on-surface">
                {(['Equities', 'Futures', 'Forex', 'Crypto', 'Options'] as const).map((asset) => <option key={asset} value={asset}>{asset}</option>)}
              </select>
            </label>
            
            <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">SIDE</span>
              <div className="flex min-w-0 items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant">
                {(['Long', 'Short'] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setSide(s)}
                    className={`min-w-0 flex-1 py-1.5 rounded-full font-caption-mono text-caption-mono uppercase cursor-pointer transition-colors ${
                      side === s
                        ? 'bg-on-surface text-surface-container-lowest font-bold shadow-xs'
                        : 'text-tertiary hover:text-on-surface'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {!isMissed && <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">STATUS</span>
              <div className="flex min-w-0 items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant">
                {(['Closed', 'Open'] as const).map((st) => (
                  <button
                    type="button"
                    key={st}
                    onClick={() => setStatus(st)}
                    className={`min-w-0 flex-1 py-1.5 rounded-full font-caption-mono text-caption-mono uppercase cursor-pointer transition-colors ${
                      status === st
                        ? 'bg-on-surface text-surface-container-lowest font-bold shadow-xs'
                        : 'text-tertiary hover:text-on-surface'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>}
          </div>
          <div className={`${isAdvancedLog ? '' : 'hidden'} flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <span className="block font-caption-mono text-[11px] font-semibold uppercase tracking-wide text-tertiary">Trade record</span>
              <span className="font-body-sm text-body-sm text-tertiary">Separate real fills from setups you missed.</span>
            </div>
            <div className="flex min-w-0 items-center gap-1 rounded-full border border-outline-variant bg-surface-container-lowest p-1">
              {(['EXECUTED', 'MISSED'] as const).map((recordStatus) => (
                <button
                  key={recordStatus}
                  type="button"
                  aria-pressed={tradeStatus === recordStatus}
                  onClick={() => {
                    setTradeStatus(recordStatus);
                    setFormError('');
                    if (recordStatus === 'MISSED') {
                      setStatus('Closed');
                      setFee('');
                    }
                  }}
                  className={`rounded-full px-4 py-1.5 font-caption-mono text-[11px] font-bold tracking-wide transition-colors ${tradeStatus === recordStatus ? 'bg-on-surface text-surface-container-lowest' : 'text-tertiary hover:text-on-surface'}`}
                >
                  {recordStatus}
                </button>
              ))}
            </div>
          </div>
          {isAdvancedLog && isMissed && <div className="grid grid-cols-1 gap-3 rounded-xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1 font-caption-mono text-[11px] font-medium uppercase text-tertiary">
              Missed reason · required
              <select required value={missedReason} onChange={(event) => { setMissedReason(event.target.value as MissedTradeReason | ''); setFormError(''); }} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-sm normal-case text-on-surface outline-none focus:border-on-surface">
                <option value="">Choose a reason</option>
                <option>Hesitation</option>
                <option>Distraction</option>
                <option>Limit Not Filled (Spread/Slippage)</option>
                <option>Other</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 font-caption-mono text-[11px] font-medium uppercase text-tertiary">
              Hypothetical outcome · required
              <select required value={hypotheticalOutcome} onChange={(event) => { setHypotheticalOutcome(event.target.value as HypotheticalOutcome | ''); setFormError(''); }} className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-sm normal-case text-on-surface outline-none focus:border-on-surface">
                <option value="">Choose outcome</option>
                <option value="Win">Win</option>
                <option value="Loss">Loss</option>
                <option value="Breakeven">Breakeven</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 font-caption-mono text-[11px] font-medium uppercase text-tertiary">
              Planned R:R · required
              <input required type="number" min="0.01" step="0.01" value={plannedRRInput} onChange={(event) => { setPlannedRRInput(event.target.value); setFormError(''); }} placeholder="e.g. 2" className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-body-sm normal-case text-on-surface outline-none focus:border-on-surface" />
            </label>
          </div>}
          {!isAdvancedLog && <div className="grid grid-cols-1 gap-3 border border-outline-variant bg-surface-container-low p-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">Entry date &amp; time
              <span className="flex gap-2"><input type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="min-w-0 flex-1 border border-outline-variant bg-surface-container-lowest px-2 py-2 text-on-surface" /><input type="time" value={entryTime} onChange={(event) => setEntryTime(event.target.value)} className="w-28 border border-outline-variant bg-surface-container-lowest px-2 py-2 text-on-surface" /></span>
            </label>
            {status === 'Closed' && <label className="flex flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">Exit date &amp; time
              <span className="flex gap-2"><input type="date" value={exitDate} onChange={(event) => setExitDate(event.target.value)} className="min-w-0 flex-1 border border-outline-variant bg-surface-container-lowest px-2 py-2 text-on-surface" /><input type="time" value={exitTime} onChange={(event) => setExitTime(event.target.value)} className="w-28 border border-outline-variant bg-surface-container-lowest px-2 py-2 text-on-surface" /></span>
            </label>}
            <label className="flex min-w-0 flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">Session · required
              <select required={!isMissed} value={session} onChange={(event) => { setSession(event.target.value as TradeSession | ''); setFormError(''); }} className="min-w-0 border border-outline-variant bg-surface-container-lowest px-2 py-2 text-on-surface">
                <option value="">Choose session</option>
                <option value="Asia">Asia</option><option value="London">London</option><option value="New York">New York</option>
              </select>
            </label>
          </div>}
          </section>

          {/* Quick symbol presets */}
          <div className={`${isAdvancedLog ? '' : 'hidden'} flex flex-wrap items-center gap-2 pb-1`}>
            {COMMON_SYMBOLS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => setSymbol(s)}
                className="px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-tertiary hover:text-on-surface font-caption-mono text-[11px] border border-outline-variant/60 cursor-pointer transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-headline-md text-body-lg text-on-surface font-bold">{isMissed ? 'Planned setup' : 'Execution'}</h3>
            <div className="flex flex-col items-end">
              <span className="font-caption-mono text-caption-mono text-tertiary">{isMissed ? 'Not included in actual account results' : 'R multiple calculates automatically'}</span>
              {!isMissed && <span className={`font-caption-mono text-[11px] font-bold ${realizedR >= 0 ? 'text-success' : 'text-secondary'}`}>REALIZED {realizedR >= 0 ? '+' : ''}{realizedR.toFixed(1)}R</span>}
            </div>
          </div>
          {!isMissed && status === 'Closed' && isAdvancedLog && <div className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
            <label className="flex items-center gap-2 font-caption-mono text-[11px] font-semibold uppercase text-on-surface cursor-pointer">
              <input type="checkbox" checked={usePartialExits} onChange={(event) => { setUsePartialExits(event.target.checked); setFormError(''); }} className="accent-primary-container" />
              Log partial exits by % of position and price
            </label>
            {usePartialExits && <div className="flex flex-col gap-2">
              <p className="font-body-sm text-caption-mono text-tertiary">Enter the percent closed and exit price for each portion. R and P&amp;L are calculated from your entry, stop, and dollar risk; no contract/share quantity is needed.</p>
              {partialExits.map((part, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="flex flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">Position closed %
                  <input type="number" min="0.01" max="100" step="any" value={part.percentage || ''} onChange={(event) => updatePartialExit(index, 'percentage', event.target.value)} className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-caption-mono text-body-sm text-on-surface" />
                </label>
                <label className="flex flex-col gap-1 font-caption-mono text-[10px] uppercase text-tertiary">Exit price
                  <input type="number" min="0.00000001" step="any" value={part.exitPrice || ''} onChange={(event) => updatePartialExit(index, 'exitPrice', event.target.value)} className="min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-caption-mono text-body-sm text-on-surface" />
                  <span className="normal-case">{riskPerUnit > 0 ? `${partialR(Number(part.exitPrice) || 0) >= 0 ? '+' : ''}${partialR(Number(part.exitPrice) || 0).toFixed(2)}R` : 'Add entry and stop to see R'}</span>
                </label>
                <button type="button" disabled={partialExits.length === 1} onClick={() => setPartialExits((current) => current.filter((_, partIndex) => partIndex !== index))} className="h-10 border border-outline-variant px-3 font-caption-mono text-xs text-secondary disabled:opacity-40">Remove</button>
              </div>)}
              <div className="flex items-center justify-between gap-2">
                <button type="button" onClick={() => setPartialExits((current) => [...current, { percentage: Math.max(0, 100 - partialPercent), exitPrice: numEntry }])} className="border border-outline-variant px-3 py-2 font-caption-mono text-[10px] font-bold uppercase text-on-surface">+ Add partial</button>
                <span className={`font-caption-mono text-[11px] font-bold ${Math.abs(partialPercent - 100) < 0.01 ? 'text-success' : 'text-secondary'}`}>{partialPercent.toFixed(2)}% / 100%</span>
              </div>
            </div>}
          </div>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface-container-low p-4 rounded-2xl border border-outline-variant">
            <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Entry</span>
              <input
                required
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
            </div>

            {!isMissed && status === 'Closed' && !usePartialExits && <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Exit price</span>
              <input
                type="number"
                step="any"
                value={exitPrice}
                required={status === 'Closed'}
                onChange={(e) => { setQuickOutcome(null); setExitPrice(e.target.value); }}
                className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
            </div>}

            <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Stop loss</span>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
            </div>

            <div className={`${isAdvancedLog ? '' : 'hidden'} flex flex-col gap-1`}>
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Take profit</span>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="trade-risk-amount" className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Risk ({settings.currency}) · required</label>
              <input
                id="trade-risk-amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                value={riskAmount}
                onChange={(e) => { setRiskAmount(e.target.value); setFormError(''); }}
                placeholder="e.g. 50"
                className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
            </div>
            {!isMissed && <div className="flex flex-col gap-1">
              <label htmlFor="trade-fees" className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Fees ({settings.currency}) · required</label>
              <input
                id="trade-fees"
                required
                type="number"
                min="0"
                step="0.01"
                value={fee}
                onChange={(e) => { setFee(e.target.value); setFormError(''); }}
                placeholder="Enter 0 if none"
                className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
            </div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3">
            <span className="font-caption-mono text-[11px] font-semibold text-tertiary">{isMissed ? 'ACTUAL P&L' : 'NET P&L'}</span>
            {isMissed ? (
              <span className="font-caption-mono text-body-md font-bold text-on-surface">{formatCurrency(0, settings.currency)} · Missed trade</span>
            ) : pnlReady ? (
              <span className={`font-caption-mono text-body-md font-bold ${pnl >= 0 ? 'text-success' : 'text-secondary'}`}>
                {pnl >= 0 ? '+' : ''}{formatCurrency(pnl, settings.currency)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
              </span>
            ) : (
              <span className="font-body-sm text-body-sm text-tertiary">
                {status === 'Open' ? 'P&L appears after the trade is closed.' : usePartialExits && !partialsValid ? (!partialPercentValid ? 'Partial exit percentages must total 100%.' : 'Enter an exit price for each partial.') : 'Enter risk, fees, entry, stop loss, and exit details to show P&L.'}
              </span>
            )}
          </div>
          {!isMissed && isAdvancedLog && <div className="grid grid-cols-1 gap-3 border border-outline-variant bg-surface-container-low p-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-caption-mono text-[10px] font-semibold uppercase text-tertiary">MAE · worst price against the trade
              <input type="number" min={side === 'Short' ? String(numEntry) : '0.00000001'} max={side === 'Long' ? String(numEntry) : undefined} step="any" value={maxAdversePrice} onChange={(event) => setMaxAdversePrice(event.target.value)} placeholder={side === 'Long' ? 'Lowest price while open' : 'Highest price while open'} className="min-w-0 border border-outline-variant bg-surface-container-lowest px-3 py-2 font-caption-mono text-body-sm text-on-surface" />
              <span className="normal-case">{maeR === null ? 'Optional · enter the adverse extreme price' : `${maeR.toFixed(2)}R adverse`}</span>
            </label>
            <label className="flex flex-col gap-1 font-caption-mono text-[10px] font-semibold uppercase text-tertiary">MFE · best price in your favor
              <input type="number" min={side === 'Long' ? String(numEntry) : '0.00000001'} max={side === 'Short' ? String(numEntry) : undefined} step="any" value={maxFavorablePrice} onChange={(event) => setMaxFavorablePrice(event.target.value)} placeholder={side === 'Long' ? 'Highest price while open' : 'Lowest price while open'} className="min-w-0 border border-outline-variant bg-surface-container-lowest px-3 py-2 font-caption-mono text-body-sm text-on-surface" />
              <span className="normal-case">{mfeR === null ? 'Optional · enter the favorable extreme price' : `${mfeR.toFixed(2)}R favorable`}</span>
            </label>
          </div>}
          {formError && <p role="alert" className="rounded-lg border border-error/30 bg-error-container/40 px-3 py-2 font-body-sm text-body-sm text-secondary">{formError}</p>}
          </section>

          <section className={`flex flex-col gap-3 ${isAdvancedLog ? '' : 'hidden'}`}>
          <h3 className="font-headline-md text-body-lg text-on-surface font-bold">Journal</h3>
          {/* Strategy Setup & Timeframe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Strategy</span>
              <input
                value={setup}
                onChange={(e) => setSetup(e.target.value)}
                placeholder="Create or choose a strategy"
                list="apextrade-strategy-suggestions"
                className="bg-surface-container-lowest px-3 py-2 rounded-lg text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface"
              />
              <datalist id="apextrade-strategy-suggestions">
                {strategyOptions.map((strategy) => <option key={strategy} value={strategy} />)}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Date &amp; time</span>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-surface-container-lowest px-3 py-2 rounded-lg text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface flex-1"
                />
                <input
                  type="time"
                  value={entryTime}
                  onChange={(e) => setEntryTime(e.target.value)}
                  className="bg-surface-container-lowest px-3 py-2 rounded-lg text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface w-28"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.8fr)] gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="trade-tags" className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Tags / events</label>
              <input id="trade-tags" value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} placeholder="15m FVG, 5m confirmation, sweep" className="min-w-0 bg-surface-container-lowest px-3 py-2 rounded-lg text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface" />
              <span className="font-caption-mono text-caption-mono text-tertiary">Separate tags with commas.</span>
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor="trade-session" className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Session · required</label>
              <select id="trade-session" required={isAdvancedLog} value={session} onChange={(event) => setSession(event.target.value as TradeSession | '')} className="min-w-0 w-full bg-surface-container-lowest px-3 py-2 rounded-lg text-on-surface font-caption-mono text-body-sm outline-none border border-outline-variant focus:border-on-surface">
                <option value="">Choose session</option>
                <option value="Asia">Asia</option>
                <option value="London">London</option>
                <option value="New York">New York</option>
              </select>
            </div>
          </div>
          </section>

          {/* Psychology, plan adherence, mistakes, and execution quality only apply to executed trades. */}
          {!isMissed && isAdvancedLog && <div className="flex flex-col gap-2 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
            <div className="flex items-center justify-between">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Psychology &amp; plan</span>
              <label className="flex items-center gap-2 cursor-pointer font-caption-mono text-caption-mono">
                <input
                  type="checkbox"
                  checked={rulesFollowed}
                  onChange={(e) => setRulesFollowed(e.target.checked)}
                  className="accent-primary-container"
                />
                <span className={rulesFollowed ? 'text-success font-bold' : 'text-secondary font-bold'}>
                  {rulesFollowed ? 'Plan followed' : 'Plan not followed'}
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="mr-1 font-caption-mono text-[9px] uppercase tracking-wide text-tertiary">Select all that fit</span>
              {['Calm', 'Confident', 'Anxious', 'FOMO', 'Revenge', 'Fearful'].map((em) => (
                <button
                  type="button"
                  key={em}
                  aria-pressed={psychologyTags.includes(em)}
                  onClick={() => togglePsychology(em)}
                  className={`px-3 py-1 rounded-full font-caption-mono text-[11px] cursor-pointer transition-colors border ${
                    psychologyTags.includes(em)
                      ? 'bg-on-surface text-surface-container-lowest font-bold border-on-surface'
                      : 'bg-surface-container-lowest text-tertiary hover:text-on-surface border-outline-variant'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 items-start gap-2 border-t border-outline-variant/70 pt-2">
              <details className="w-full min-w-0 self-start overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
                <summary className="flex w-full min-w-0 cursor-pointer list-none items-center gap-2 px-3 py-2 font-caption-mono text-[11px] font-semibold uppercase text-on-surface [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1 truncate">Mistakes</span><span className="flex shrink-0 items-center gap-1 text-[10px] text-tertiary normal-case">{mistakes.length ? `${mistakes.length} selected` : 'Optional'}<span className="material-symbols-outlined text-body-sm">expand_more</span></span>
                </summary>
                <div className="min-w-0 max-w-full border-t border-outline-variant/70 p-3">
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {[...COMMON_MISTAKES, ...customMistakes].map((mistake) => <button key={mistake} type="button" aria-pressed={mistakes.includes(mistake)} onClick={() => toggleMistake(mistake)} className={`rounded-full border px-2.5 py-1 font-caption-mono text-[10px] transition-colors cursor-pointer ${mistakes.includes(mistake) ? 'border-on-surface bg-on-surface text-surface-container-lowest font-bold' : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}>{mistake}</button>)}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <input value={customMistakeDraft} onChange={(event) => setCustomMistakeDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomOption('mistake'); } }} placeholder="Add your own" maxLength={32} aria-label="Custom mistake tag" className="min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-body-sm text-on-surface outline-none focus:border-on-surface" />
                    <button type="button" onClick={() => addCustomOption('mistake')} disabled={!customMistakeDraft.trim()} className="rounded-full border border-outline-variant px-3 font-caption-mono text-[10px] font-bold text-on-surface disabled:opacity-40 cursor-pointer">Add</button>
                  </div>
                </div>
              </details>
              <details className="w-full min-w-0 self-start overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
                <summary className="flex w-full min-w-0 cursor-pointer list-none items-center gap-2 px-3 py-2 font-caption-mono text-[11px] font-semibold uppercase text-on-surface [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1 truncate">Execution quality</span><span className="flex shrink-0 items-center gap-1 text-[10px] text-tertiary normal-case">{executionQuality || 'Optional'}<span className="material-symbols-outlined text-body-sm">expand_more</span></span>
                </summary>
                <div className="min-w-0 max-w-full border-t border-outline-variant/70 p-3">
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {Array.from(new Set(['Excellent', 'Good', 'Poor', ...customQualities])).map((quality) => <button key={quality} type="button" aria-pressed={executionQuality === quality} onClick={() => setExecutionQuality(executionQuality === quality ? '' : quality)} className={`rounded-full border px-2.5 py-1 font-caption-mono text-[10px] transition-colors cursor-pointer ${executionQuality === quality ? 'border-on-surface bg-on-surface text-surface-container-lowest' : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:text-on-surface'}`}>{quality}</button>)}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <input value={customQualityDraft} onChange={(event) => setCustomQualityDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomOption('quality'); } }} placeholder="Add your own" maxLength={32} aria-label="Custom execution quality" className="min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-3 py-1.5 font-body-sm text-on-surface outline-none focus:border-on-surface" />
                    <button type="button" onClick={() => addCustomOption('quality')} disabled={!customQualityDraft.trim()} className="rounded-full border border-outline-variant px-3 font-caption-mono text-[10px] font-bold text-on-surface disabled:opacity-40 cursor-pointer">Add</button>
                  </div>
                </div>
              </details>
            </div>
          </div>}

          {/* Notes and screenshot */}
          <div className={`${isAdvancedLog ? '' : 'hidden'} flex flex-col gap-2`}>
            <div className="flex items-center justify-between gap-3">
              <span className="font-caption-mono text-[11px] text-tertiary uppercase font-medium">Notes</span>
              <div className="flex items-center gap-2">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 font-caption-mono text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer" aria-label={imageUrl ? 'Change trade screenshot' : 'Attach trade screenshot'}>
                  <span className="material-symbols-outlined text-body-sm">photo_camera</span>
                  {imageUrl ? 'Change screenshot' : 'Add screenshot'}
                </button>
                <button type="button" onClick={() => { setShowLinkInput((visible) => !visible); setLinkError(''); }} className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1.5 font-caption-mono text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer" aria-expanded={showLinkInput}>
                  <span className="material-symbols-outlined text-body-sm">link</span>
                  {linkUrl ? 'Edit link' : 'Add link'}
                </button>
              </div>
            </div>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was the setup? What did you notice or learn?"
              className="bg-surface-container-lowest px-3 py-2 rounded-lg text-on-surface font-body-sm outline-none border border-outline-variant focus:border-on-surface"
            />
            {imageError && <p role="alert" className="font-body-sm text-body-sm text-secondary">{imageError}</p>}
            {imageUrl && <div className="relative w-fit max-w-full rounded-xl border border-outline-variant bg-surface-container-low p-2">
              <img src={imageUrl} alt="Trade chart screenshot preview" className="block max-h-48 max-w-full rounded-lg object-contain" />
              <button type="button" onClick={() => setImageUrl('')} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container cursor-pointer" aria-label="Remove trade screenshot"><span className="material-symbols-outlined text-body-sm">close</span></button>
            </div>}
            {showLinkInput && <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <input type="url" value={linkUrl} onChange={(event) => { setLinkUrl(event.target.value); setLinkError(''); }} placeholder="Paste a chart or reference link" className="min-w-0 flex-1 bg-surface-container-lowest px-3 py-2 rounded-full text-on-surface font-body-sm outline-none border border-outline-variant focus:border-on-surface" aria-label="Trade reference link" />
                {linkUrl && <button type="button" onClick={() => { setLinkUrl(''); setLinkError(''); }} className="rounded-full border border-outline-variant px-3 text-on-surface-variant hover:bg-surface-container cursor-pointer" aria-label="Remove trade link"><span className="material-symbols-outlined text-body-sm">close</span></button>}
              </div>
              {linkError && <p role="alert" className="font-body-sm text-body-sm text-secondary">{linkError}</p>}
            </div>}
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full font-caption-mono text-caption-mono text-tertiary hover:text-on-surface cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 bg-on-surface text-surface-container-lowest hover:opacity-90 px-6 py-2.5 rounded-full transition-transform active:scale-95 shadow-sm font-caption-mono text-caption-mono font-bold uppercase cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-primary-container"></span>
              <span>{editingTrade ? 'Save changes' : 'Save trade'}</span>
            </button>
          </div>

          {showGradePrompt && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm dark:bg-black/75" role="dialog" aria-modal="true" aria-labelledby="trade-grade-title">
            <div className="w-full max-w-sm rounded-2xl border border-outline dark:border-white/20 bg-surface p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-1 ring-black/5 dark:ring-white/10">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-caption-mono text-[10px] tracking-widest text-tertiary uppercase">Trade review</p><h3 id="trade-grade-title" className="mt-1 font-headline-md text-headline-md font-bold text-on-surface">Rate your trade</h3></div>
                <button type="button" onClick={() => setShowGradePrompt(false)} aria-label="Close trade rating" className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-tertiary hover:bg-surface-container cursor-pointer"><span className="material-symbols-outlined text-body-sm">close</span></button>
              </div>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">Grade your execution against your own plan.</p>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {Array.from(new Set(['A', 'A+', 'B', 'C', ...customGrades])).map((grade) => <button key={grade} type="button" aria-pressed={tradeGrade === grade} onClick={() => setTradeGrade(grade)} className={`min-h-11 rounded-xl border font-display text-body-lg font-bold transition-colors cursor-pointer ${tradeGrade === grade ? 'border-primary-container bg-primary-container text-on-primary-container shadow-[0_3px_12px_rgba(227,6,19,0.28)]' : 'border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container'}`}>{grade}</button>)}
              </div>
              <div className="mt-4 flex gap-2">
                <input value={newGrade} onChange={(event) => setNewGrade(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomGrade(); } }} placeholder="Create a grade" maxLength={12} className="min-w-0 flex-1 rounded-full border border-outline-variant bg-surface-container-lowest px-4 py-2 font-body-sm text-on-surface outline-none focus:border-on-surface" aria-label="Custom grade name" />
                <button type="button" onClick={addCustomGrade} disabled={!newGrade.trim()} className="rounded-full border border-outline-variant bg-surface-container-low px-4 py-2 font-caption-mono text-caption-mono font-semibold text-on-surface disabled:opacity-45 cursor-pointer">Add</button>
              </div>
              <button type="submit" disabled={!tradeGrade} className="mt-4 w-full rounded-full bg-on-surface px-5 py-3 font-caption-mono text-caption-mono font-bold uppercase text-surface-container-lowest disabled:opacity-40 cursor-pointer">Save rated trade</button>
            </div>
          </div>}

        </form>

      </div>
    </div>
  );
};

