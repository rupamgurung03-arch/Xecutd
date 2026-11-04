import React, { useState, useMemo, useRef } from 'react';
import { PlaybookSetup, TradingRule, Trade } from '../types/trade';
import { formatCurrency } from '../utils/calculations';

interface PlaybookViewProps {
  playbooks: PlaybookSetup[];
  rules: TradingRule[];
  trades: Trade[];
  currency: string;
  onAddPlaybook: (setup: PlaybookSetup) => void;
  onDeletePlaybook: (setupId: string) => void;
  onAddRule: (rule: TradingRule) => void;
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
}

export const PlaybookView: React.FC<PlaybookViewProps> = ({
  playbooks,
  rules,
  trades,
  currency,
  onAddPlaybook,
  onDeletePlaybook,
  onAddRule,
  onToggleRule,
  onDeleteRule,
}) => {
  const [showAddSetup, setShowAddSetup] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // New setup form state
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBestCond, setNewBestCond] = useState('');
  const [newInvalidation, setNewInvalidation] = useState('');
  const [newRR, setNewRR] = useState('');
  const [newTimeframes, setNewTimeframes] = useState('');
  const [newExampleUrl, setNewExampleUrl] = useState('');
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');
  const [screenshotError, setScreenshotError] = useState('');
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [newRulesText, setNewRulesText] = useState('');

  // New rule form state
  const [newRuleText, setNewRuleText] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState<'Risk' | 'Execution' | 'Psychology'>('Risk');

  // Compute stats per setup from trades
  const getSetupStats = (setupName: string) => {
    const matching = trades.filter((t) => t.tradeStatus !== 'MISSED' && t.status === 'Closed' && t.setup?.toLowerCase() === setupName.toLowerCase());
    if (matching.length === 0) {
      return { count: 0, winRate: 0, profitFactor: 0, avgRR: 0, netPnL: 0 };
    }
    const wins = matching.filter((t) => t.pnl > 0).length;
    const losses = matching.filter((t) => t.pnl < 0).length;
    const grossWins = matching.filter((t) => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
    const grossLosses = Math.abs(matching.filter((t) => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;
    const netPnL = matching.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const winRate = ((wins / matching.length) * 100).toFixed(0);
    const avgRR = (matching.reduce((acc, t) => acc + (t.realizedR || 0), 0) / matching.length).toFixed(2);

    return {
      count: matching.length,
      winRate: parseFloat(winRate),
      profitFactor: parseFloat(profitFactor.toFixed(1)),
      avgRR: parseFloat(avgRR),
      netPnL,
    };
  };

  const setupResults = playbooks
    .map((setup) => ({ setup, stats: getSetupStats(setup.name) }))
    .filter((item) => item.stats.count > 0);
  const bestWinRate = [...setupResults].sort((a, b) => b.stats.winRate - a.stats.winRate)[0];
  const bestNetPnl = [...setupResults].sort((a, b) => b.stats.netPnL - a.stats.netPnL)[0];

  const handleScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScreenshotError('Choose an image file for the strategy screenshot.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setScreenshotError('That image is over 15 MB. Choose a smaller screenshot.');
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
      setNewScreenshotUrl(canvas.toDataURL('image/jpeg', 0.78));
      setScreenshotError('');
    } catch (error) {
      setScreenshotError(error instanceof Error ? error.message : 'Could not attach that image.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleCreateSetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const rulesList = newRulesText
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const setup: PlaybookSetup = {
      id: `setup_${Date.now()}`,
      name: newName.trim(),
      description: newDesc.trim(),
      timeframes: newTimeframes.split(',').map((timeframe) => timeframe.trim()).filter(Boolean),
      targetRiskReward: parseFloat(newRR) || 0,
      rules: rulesList,
      invalidationCriteria: newInvalidation.trim(),
      bestConditions: newBestCond.trim(),
      exampleUrl: newExampleUrl.trim(),
      screenshotUrl: newScreenshotUrl || undefined,
    };

    onAddPlaybook(setup);
    setShowAddSetup(false);
    setNewName('');
    setNewDesc('');
    setNewBestCond('');
    setNewInvalidation('');
    setNewRulesText('');
    setNewTimeframes('');
    setNewExampleUrl('');
    setNewScreenshotUrl('');
    setScreenshotError('');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;

    const rule: TradingRule = {
      id: `rule_${Date.now()}`,
      text: newRuleText.trim(),
      category: newRuleCategory,
      active: true,
    };

    onAddRule(rule);
    setShowAddRule(false);
    setNewRuleText('');
  };

  const strategyNames = useMemo(() => Array.from(new Set(playbooks.map((p) => p.name))), [playbooks]);
  const filteredPlaybooks = useMemo(() => {
    return playbooks.filter((p) => {
      if (selectedTag !== 'ALL' && p.name !== selectedTag) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [playbooks, searchQuery, selectedTag]);

  return (
    <div className="w-full flex flex-col gap-space-xl">
      
      {/* Top Bar: Playbook System Meta & Global CTA */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-xs text-caption-mono font-caption-mono text-tertiary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
            <span>Strategy library</span>
            <span>::</span>
            <span className="text-on-surface-variant font-medium">
              {playbooks.length} saved strategies
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface font-semibold">
            Your strategies
          </h1>
          <p className="font-caption-mono text-table-data text-secondary flex items-center gap-space-xs">
            <span>Define your setups and review results from your logged trades.</span>
          </p>
        </div>

        {/* Action Cluster */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-space-md text-body-md text-tertiary pointer-events-none">
              search
            </span>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-container-low text-on-surface font-caption-mono text-caption-mono pl-9 pr-space-md py-2 rounded-full placeholder:text-tertiary focus:outline-none focus:bg-surface-container transition-all border border-outline-variant/80 uppercase"
              placeholder="Search strategies..."
              type="text"
            />
          </div>
          <button
            onClick={() => setShowAddSetup(true)}
            className="flex items-center gap-space-sm bg-primary text-on-primary hover:bg-neutral-800 px-space-lg py-2 rounded-full transition-transform active:scale-95 shadow-sm cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shrink-0"></span>
            <span className="font-headline-md text-body-sm font-semibold tracking-wide uppercase text-on-primary">
              + New strategy
            </span>
          </button>
        </div>
      </div>

      {/* Quick Telemetry Micro-Cards (Bento KPI Strip) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        
        {/* Metric 1 */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md flex flex-col justify-between relative overflow-hidden shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between">
            <span className="font-caption-mono text-caption-mono text-tertiary uppercase tracking-wider font-semibold">
              SAVED STRATEGIES
            </span>
            <span className="material-symbols-outlined text-body-md text-tertiary">schema</span>
          </div>
          <div className="mt-space-md flex items-baseline gap-space-sm">
            <span className="font-numeric-stat text-numeric-stat text-on-surface font-bold">
              {String(playbooks.length).padStart(2, '0')}
            </span>
            <span className="font-caption-mono text-caption-mono text-secondary font-medium">USER CREATED</span>
          </div>
          <div className="mt-space-xs flex items-center gap-space-xs font-caption-mono text-caption-mono text-tertiary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
            <span>{playbooks.length} strategies in your library</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md flex flex-col justify-between relative overflow-hidden shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between">
            <span className="font-caption-mono text-caption-mono text-tertiary uppercase tracking-wider font-semibold">
              BEST WIN RATE
            </span>
            <span className="w-2 h-2 rounded-full bg-secondary"></span>
          </div>
          <div className="mt-space-md flex flex-col">
            <span className="font-headline-md text-body-lg text-on-surface font-bold">
              {bestWinRate?.setup.name || 'No results yet'}
            </span>
            <div className="flex items-baseline gap-space-xs mt-0.5">
              <span className="font-numeric-stat text-numeric-stat text-success font-bold">{bestWinRate ? `${bestWinRate.stats.winRate}%` : '—'}</span>
              <span className="font-caption-mono text-caption-mono text-success font-medium">
                {bestWinRate ? `${bestWinRate.stats.count} closed trades` : 'Log trades to compare'}
              </span>
            </div>
          </div>
          <div className="mt-space-xs font-caption-mono text-caption-mono text-tertiary">
            <span>Based on logged trade outcomes</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-surface-container-lowest rounded-xl p-space-md flex flex-col justify-between relative overflow-hidden shadow-sm border border-outline-variant">
          <div className="flex items-center justify-between">
            <span className="font-caption-mono text-caption-mono text-tertiary uppercase tracking-wider font-semibold">
              BEST NET P&amp;L
            </span>
            <span className="material-symbols-outlined text-body-md text-tertiary">timeline</span>
          </div>
          <div className="mt-space-md flex flex-col">
            <span className="font-headline-md text-body-lg text-on-surface font-bold">
              {bestNetPnl?.setup.name || 'No results yet'}
            </span>
            <div className="flex items-baseline gap-space-xs mt-0.5">
              <span className="font-numeric-stat text-numeric-stat text-on-surface font-bold">{bestNetPnl ? `${bestNetPnl.stats.netPnL >= 0 ? '+' : ''}${formatCurrency(bestNetPnl.stats.netPnL, currency)}` : '—'}</span>
              <span className="font-caption-mono text-caption-mono text-secondary font-medium">NET P&amp;L</span>
            </div>
          </div>
          <div className="mt-space-xs font-caption-mono text-caption-mono text-tertiary">
            <span>{bestNetPnl ? `${bestNetPnl.stats.count} closed trades` : 'No trades logged yet'}</span>
          </div>
        </div>

      </div>

      {/* Filter & Sort Tag Strip */}
      <div className="flex flex-wrap items-center gap-space-xs pb-space-xs">
        <span className="font-caption-mono text-caption-mono text-tertiary mr-space-xs font-semibold">TAGS //</span>
        {(['ALL', ...strategyNames] as const).map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(tag)}
            className={`px-space-md py-1 rounded-full font-caption-mono text-caption-mono transition-colors cursor-pointer font-medium ${
              selectedTag === tag
                ? 'bg-primary text-on-primary font-bold shadow-xs flex items-center gap-1.5'
                : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/80'
            }`}
          >
            {selectedTag === tag && <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>}
            {tag === 'ALL' ? `ALL STRATEGIES (${playbooks.length})` : tag}
          </button>
        ))}
      </div>

      {/* Playbook Cards Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-lg">
        {filteredPlaybooks.map((setup, index) => {
          const stats = getSetupStats(setup.name);

          return (
            <div
              key={setup.id}
              className="bg-surface-container-lowest rounded-xl p-space-lg flex flex-col justify-between gap-space-lg shadow-sm border border-outline-variant hover:border-outline transition-all group"
            >
              <div className="flex flex-col gap-space-md">
                
                {/* Card Header & Badge */}
                <div className="flex items-start justify-between gap-space-md">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-space-xs font-caption-mono text-caption-mono text-tertiary font-semibold">
                      <span>STRATEGY {String(index + 1).padStart(2, '0')}</span>
                      <span>•</span>
                      <span className="text-on-surface-variant uppercase">
                        {setup.timeframes?.join(' · ') || 'Timeframe not set'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-secondary">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                        Your setup
                      </span>
                    </div>
                    <h2 className="font-headline-md text-headline-md text-on-surface font-bold group-hover:text-primary transition-colors">
                      {setup.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onDeletePlaybook(setup.id);
                      if (selectedTag === setup.name) setSelectedTag('ALL');
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-outline-variant/60 bg-surface-container-low px-2.5 py-1.5 text-caption-mono text-tertiary transition-colors hover:border-secondary/50 hover:text-secondary cursor-pointer"
                    aria-label={`Remove ${setup.name} from your strategy library`}
                    title="Remove strategy"
                  >
                    <span className="material-symbols-outlined text-body-sm">delete</span>
                    <span>REMOVE</span>
                  </button>
                </div>

                {/* Performance Telemetry Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs bg-surface-container-low p-space-sm rounded-lg border border-outline-variant/60">
                  <div className="flex flex-col px-space-xs">
                    <span className="font-caption-mono text-caption-mono text-tertiary font-medium">WIN RATE</span>
                    <span className="font-table-data text-table-data text-success font-bold">
                      {stats.winRate}%
                    </span>
                  </div>
                  <div className="flex flex-col px-space-xs">
                    <span className="font-caption-mono text-caption-mono text-tertiary font-medium">PROFIT FACTOR</span>
                    <span className="font-table-data text-table-data text-on-surface font-bold">
                      {stats.count ? (Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞') : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col px-space-xs">
                    <span className="font-caption-mono text-caption-mono text-tertiary font-medium">TARGET R</span>
                    <span className="font-table-data text-table-data text-on-surface font-bold">
                      {setup.targetRiskReward ? `${setup.targetRiskReward}R` : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col px-space-xs">
                    <span className="font-caption-mono text-caption-mono text-tertiary font-medium">SAMPLE SIZE</span>
                    <span className="font-table-data text-table-data text-tertiary font-bold">
                      {stats.count > 0 ? `${stats.count} closed` : 'No trades yet'}
                    </span>
                  </div>
                </div>

                {setup.screenshotUrl && (
                  <a href={setup.screenshotUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-low" aria-label={`Open ${setup.name} strategy screenshot`}>
                    <img src={setup.screenshotUrl} alt={`${setup.name} strategy example`} className="max-h-72 w-full object-contain" />
                  </a>
                )}

                {/* Setup Rules & Checklist */}
                <div className="flex flex-col gap-space-xs font-caption-mono text-caption-mono">
                  <div className="text-tertiary uppercase tracking-wider font-semibold">
                    CONFIRMATION CHECKLIST
                  </div>
                  {setup.rules.map((rule, rIdx) => (
                    <div key={rIdx} className="flex items-start gap-space-xs text-on-surface font-medium">
                      <span className="text-tertiary">0{rIdx + 1}.</span>
                      <span>{rule}</span>
                    </div>
                  ))}
                  <div className="flex items-start gap-space-xs text-secondary mt-1 font-semibold">
                    <span className="material-symbols-outlined text-body-sm text-secondary">close</span>
                    <span>INVALIDATION: {setup.invalidationCriteria || 'Not specified'}</span>
                  </div>
                </div>

              </div>

              {/* Bottom footer status */}
              <div className="flex items-center justify-between border-t border-outline-variant/60 pt-space-sm font-caption-mono text-caption-mono text-tertiary">
                <span>MARKET CONTEXT: {setup.bestConditions || 'Not specified'}</span>
                <span className="text-on-surface font-bold">{stats.count} closed trades reviewed</span>
                {setup.exampleUrl && <a href={setup.exampleUrl} target="_blank" rel="noreferrer" className="text-primary underline">View reference link</a>}
              </div>
            </div>
          );
        })}
      </div>

      {/* PRE-MARKET VERIFICATION & PSYCHOLOGY SAFEGUARDS */}
      <section className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-outline-variant flex flex-col gap-space-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md border-b border-outline-variant/60 pb-space-md">
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs text-caption-mono font-caption-mono text-tertiary uppercase font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
              <span>::: SAFEGUARD_REGIME :::</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight uppercase">
              PRE-MARKET VERIFICATION &amp; EMOTIONAL SAFEGUARDS
            </h3>
          </div>
          <button
            onClick={() => setShowAddRule(true)}
            className="flex items-center gap-space-xs bg-surface-container-low hover:bg-surface-container text-on-surface px-space-md py-1.5 rounded-full transition-all font-body-sm border border-outline-variant/80 cursor-pointer self-start sm:self-auto font-medium"
          >
            <span className="material-symbols-outlined text-body-sm">add</span>
            <span className="font-caption-mono text-caption-mono uppercase tracking-wider font-semibold">
              ADD VERIFICATION GATE
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {rules.map((rule) => (
            <div
              key={rule.id}
              onClick={() => onToggleRule(rule.id)}
              className="min-w-0 p-2.5 sm:p-space-md bg-surface-container-low rounded-lg flex items-center justify-between gap-2 sm:gap-space-md border border-outline-variant/60 cursor-pointer hover:bg-surface-container transition-colors shadow-xs"
            >
              <div className="flex min-w-0 flex-1 items-center gap-space-sm">
                <span
                  className={`material-symbols-outlined text-body-lg shrink-0 ${
                    rule.active ? 'text-primary' : 'text-tertiary/40'
                  }`}
                >
                  {rule.active ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <span
                  title={rule.text}
                  className={`block min-w-0 flex-1 truncate whitespace-nowrap font-body-sm text-body-sm font-semibold ${
                    rule.active ? 'text-on-surface' : 'text-tertiary line-through'
                  }`}
                >
                  {rule.text}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteRule(rule.id);
                }}
                className="text-tertiary hover:text-secondary transition-colors p-1"
                title="Remove Rule"
              >
                <span className="material-symbols-outlined text-body-sm">delete</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Modal: New Playbook Setup */}
      {showAddSetup && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-surface-container-high/60 rounded-xl p-space-lg w-full max-w-xl shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between border-b border-surface-container-high/40 pb-space-sm">
              <div className="flex items-center gap-space-xs font-caption-mono text-caption-mono text-tertiary uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                <span>New strategy</span>
              </div>
              <button
                onClick={() => setShowAddSetup(false)}
                className="text-tertiary hover:text-on-surface cursor-pointer"
              >
                <span className="material-symbols-outlined text-body-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSetup} className="flex flex-col gap-space-md">
              <div className="flex flex-col gap-1">
                <span className="font-caption-mono text-caption-mono text-tertiary uppercase">Strategy name</span>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. 15m FVG retest"
                  className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-md outline-none border border-white/5"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-caption-mono text-caption-mono text-tertiary uppercase">Entry conditions</label>
                <textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What must be true before you enter?" className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-sm outline-none border border-white/5" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-caption-mono text-caption-mono text-tertiary uppercase">Confirmation checklist · one per line</label>
                <textarea rows={3} value={newRulesText} onChange={(e) => setNewRulesText(e.target.value)} placeholder="15m FVG present\n5m candle closes in my direction" className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-sm outline-none border border-white/5" />
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="font-caption-mono text-caption-mono text-tertiary uppercase">Timeframes</label>
                  <input value={newTimeframes} onChange={(e) => setNewTimeframes(e.target.value)} placeholder="15m, 5m" className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-sm outline-none border border-white/5" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-caption-mono text-caption-mono text-tertiary uppercase">Target R</label>
                  <input type="number" step="0.1" value={newRR} onChange={(e) => setNewRR(e.target.value)} placeholder="Optional" className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-sm outline-none border border-white/5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <span className="font-caption-mono text-caption-mono text-tertiary uppercase">Market context</span>
                  <input
                    value={newBestCond}
                    onChange={(e) => setNewBestCond(e.target.value)}
                    placeholder="Optional"
                    className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-caption-mono text-body-md outline-none border border-white/5"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-caption-mono text-caption-mono text-tertiary uppercase">Invalidation</span>
                  <input
                    value={newInvalidation}
                    onChange={(e) => setNewInvalidation(e.target.value)}
                    placeholder="Wick break of key high"
                    className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-caption-mono text-body-sm outline-none border border-white/5"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-space-sm">
                <label className="font-caption-mono text-caption-mono text-tertiary uppercase">Strategy screenshot</label>
                <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                <div className="flex flex-wrap items-center gap-space-sm">
                  <button type="button" onClick={() => screenshotInputRef.current?.click()} className="inline-flex items-center gap-space-xs rounded-full border border-outline-variant bg-surface-container px-space-md py-2 font-caption-mono text-caption-mono font-semibold uppercase text-on-surface hover:bg-surface-container-high cursor-pointer">
                    <span className="material-symbols-outlined text-body-sm">add_a_photo</span>
                    {newScreenshotUrl ? 'Change screenshot' : 'Add screenshot'}
                  </button>
                  {newScreenshotUrl && <button type="button" onClick={() => setNewScreenshotUrl('')} className="font-caption-mono text-caption-mono uppercase text-secondary hover:underline">Remove</button>}
                </div>
                {screenshotError && <p className="font-body-sm text-body-sm text-secondary">{screenshotError}</p>}
                {newScreenshotUrl && <img src={newScreenshotUrl} alt="Strategy screenshot preview" className="max-h-40 w-fit max-w-full rounded-lg border border-outline-variant bg-surface-container-low object-contain p-1" />}
                <label className="mt-space-xs font-caption-mono text-caption-mono text-tertiary uppercase">Reference link · optional</label>
                <input type="url" value={newExampleUrl} onChange={(e) => setNewExampleUrl(e.target.value)} placeholder="https://..." className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-sm outline-none border border-white/5" />
              </div>

              <div className="flex justify-end gap-space-sm pt-space-sm border-t border-surface-container-high/40">
                <button
                  type="button"
                  onClick={() => setShowAddSetup(false)}
                  className="px-space-md py-2 rounded-full font-caption-mono text-caption-mono text-tertiary hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-lg py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-caption-mono text-caption-mono font-semibold uppercase shadow-md cursor-pointer hover:bg-on-surface"
                >
                  Save strategy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Rule */}
      {showAddRule && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-low border border-surface-container-high/60 rounded-xl p-space-lg w-full max-w-md shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between border-b border-surface-container-high/40 pb-space-sm">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase">
                ADD VERIFICATION GATE
              </span>
              <button onClick={() => setShowAddRule(false)} className="text-tertiary hover:text-on-surface">
                <span className="material-symbols-outlined text-body-lg">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateRule} className="flex flex-col gap-space-md">
              <input
                required
                value={newRuleText}
                onChange={(e) => setNewRuleText(e.target.value)}
                placeholder="Rule text (e.g. Max 3 trades per morning session)"
                className="bg-surface-container px-space-md py-2 rounded-lg text-on-surface font-body-md outline-none border border-white/5"
              />
              <div className="flex gap-2">
                {(['Risk', 'Execution', 'Psychology'] as const).map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setNewRuleCategory(cat)}
                    className={`px-3 py-1 rounded-full font-caption-mono text-caption-mono uppercase cursor-pointer ${
                      newRuleCategory === cat
                        ? 'bg-inverse-surface text-inverse-on-surface font-medium'
                        : 'bg-surface-container text-tertiary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="w-full py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-caption-mono text-caption-mono font-semibold uppercase cursor-pointer"
              >
                ENFORCE RULE
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
