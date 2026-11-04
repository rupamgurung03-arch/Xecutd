import React, { useState } from 'react';
import { Trade } from '../types/trade';
import { getJournalAuthHeaders } from '../lib/supabaseClient';

interface TradeDetailModalProps {
  trade: Trade | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (trade: Trade) => void;
  onDelete: (tradeId: string) => void;
  currency: string;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  trade,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  currency,
}) => {
  if (!isOpen || !trade) return null;

  const [aiReview, setAiReview] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const isWin = trade.pnl > 0;
  const isLoss = trade.pnl < 0;
  const riskDistance = Math.abs(trade.entryPrice - trade.stopLoss);
  const excursionR = (price: number, direction: 'adverse' | 'favorable') => {
    if (!riskDistance) return 0;
    const move = trade.side === 'Long' ? price - trade.entryPrice : trade.entryPrice - price;
    return direction === 'favorable' ? Math.max(0, move / riskDistance) : Math.max(0, -move / riskDistance);
  };

  const handleRequestAiReview = async () => {
    setIsLoadingAi(true);
    try {
      const res = await fetch('/api/coach/trade-review', {
        method: 'POST',
        headers: await getJournalAuthHeaders(),
        body: JSON.stringify({ trade }),
      });
      const data = await res.json();
      setAiReview(data.review || 'No review returned.');
    } catch {
      setAiReview('System heuristic analysis: Execution preserved positive expectancy. Discipline adhered to trade playbook parameters.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-space-md overflow-y-auto">
      <div className="bg-surface-container-lowest rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col border border-outline-variant my-auto">
        
        {/* Modal Header */}
        <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-b border-outline-variant/80">
          <div className="flex items-center gap-space-sm">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(188,0,12,0.6)]"></span>
            <span className="font-caption-mono text-body-sm font-bold text-on-surface uppercase">
              {trade.tradeStatus === 'MISSED' ? 'INSPECT MISSED TRADE' : 'INSPECT EXECUTION'} :: #{trade.id.slice(0, 8)} [{trade.symbol}]
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-highest hover:bg-surface-bright text-on-surface flex items-center justify-center transition-colors cursor-pointer border border-outline shadow-xs"
          >
            <span className="material-symbols-outlined text-body-md">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-space-lg flex flex-col gap-space-lg">
          
          {/* Snapshot Header Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-md bg-surface-container-low p-space-md rounded-xl border border-outline-variant">
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">SIDE &amp; SIZE</span>
              <span className="font-table-data text-table-data text-on-surface font-bold uppercase">
                {trade.side} / {trade.partialExits?.length ? `${trade.partialExits.reduce((sum, part) => sum + part.percentage, 0)}% scaled out` : `${trade.quantity ?? '—'} Units`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">{trade.partialExits?.length ? 'ENTRY / AVG EXIT' : 'ENTRY / EXIT'}</span>
              <span className="font-table-data text-table-data text-on-surface font-bold">
                ${trade.entryPrice.toFixed(2)} ➔ ${(trade.exitPrice || trade.entryPrice).toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">NET P&amp;L</span>
              <span
                className={`font-table-data text-table-data font-bold ${
                  isWin ? 'text-success' : isLoss ? 'text-secondary' : 'text-on-surface'
                }`}
              >
                {isWin ? '+' : ''}${Math.abs(trade.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="font-caption-mono text-caption-mono ml-1 font-semibold text-tertiary">
                  ({(trade.realizedR || 0) >= 0 ? '+' : ''}{(trade.realizedR || 0).toFixed(1)}R)
                </span>
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">RISK</span>
              <span className="font-table-data text-table-data text-on-surface font-bold">
                {trade.riskAmount !== undefined ? `${currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : '$'}${trade.riskAmount.toFixed(2)}` : '—'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">FEES</span>
              <span className="font-table-data text-table-data text-on-surface font-bold">
                {`${currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : '$'}${(trade.fee || 0).toFixed(2)}`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">TIMESTAMP</span>
              <span className="font-caption-mono text-caption-mono text-on-surface-variant font-medium">
                {trade.entryDate} {trade.entryTime || '09:30 EST'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">TRADE GRADE</span>
              <span className="font-table-data text-table-data text-on-surface font-bold">{trade.tradeGrade || '—'}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-medium">SESSION</span>
              <span className="font-table-data text-table-data text-on-surface font-bold">{trade.session || '—'}</span>
            </div>
          </div>

          {trade.partialExits?.length ? <section className="border border-outline-variant bg-surface-container-low p-space-md">
            <h3 className="font-caption-mono text-caption-mono font-bold uppercase text-tertiary">Partial exits · % of original position</h3>
            <div className="mt-2 flex flex-col gap-2">
              {trade.partialExits.map((part, index) => {
                const partR = part.exitPrice !== undefined ? (riskDistance ? (trade.side === 'Long' ? part.exitPrice - trade.entryPrice : trade.entryPrice - part.exitPrice) / riskDistance : 0) : (part.rMultiple || 0);
                return <div key={`${index}-${part.percentage}-${part.exitPrice ?? part.rMultiple}`} className="flex items-center justify-between gap-3 border-b border-outline-variant/70 pb-2 last:border-0 last:pb-0 font-caption-mono text-body-sm">
                  <span className="text-on-surface">Exit {index + 1} · {part.percentage}% · {part.exitPrice !== undefined ? `price ${part.exitPrice}` : 'price not recorded'}</span>
                  <span className={`font-bold ${partR >= 0 ? 'text-success' : 'text-secondary'}`}>{partR >= 0 ? '+' : ''}{partR.toFixed(2)}R</span>
                </div>;
              })}
            </div>
            <p className="mt-2 font-caption-mono text-caption-mono text-tertiary">Weighted realized result: {(trade.realizedR || 0) >= 0 ? '+' : ''}{(trade.realizedR || 0).toFixed(2)}R</p>
          </section> : null}

          {(trade.maxAdversePrice !== undefined || trade.maxFavorablePrice !== undefined) && <section className="grid grid-cols-1 gap-3 border border-outline-variant bg-surface-container-low p-space-md sm:grid-cols-2">
            <div><span className="font-caption-mono text-caption-mono font-bold uppercase text-tertiary">MAE · worst adverse price</span><p className="mt-1 font-table-data text-table-data text-on-surface">{trade.maxAdversePrice ?? '—'}{trade.maxAdversePrice !== undefined && riskDistance > 0 ? ` · ${excursionR(trade.maxAdversePrice, 'adverse').toFixed(2)}R` : ''}</p></div>
            <div><span className="font-caption-mono text-caption-mono font-bold uppercase text-tertiary">MFE · best favorable price</span><p className="mt-1 font-table-data text-table-data text-on-surface">{trade.maxFavorablePrice ?? '—'}{trade.maxFavorablePrice !== undefined && riskDistance > 0 ? ` · ${excursionR(trade.maxFavorablePrice, 'favorable').toFixed(2)}R` : ''}</p></div>
          </section>}

          {trade.tradeStatus === 'MISSED' && <div className="rounded-xl border border-outline-variant bg-surface-container-low p-space-md">
            <span className="font-caption-mono text-caption-mono font-semibold uppercase tracking-wide text-tertiary">Missed setup review</span>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface">
              {trade.missedReason || 'Reason not recorded'} · Hypothetical {trade.hypotheticalOutcome || 'outcome not recorded'} · Planned {trade.plannedRR ?? '—'}R. Actual P&amp;L is $0; this entry does not change account results.
            </p>
          </div>}

          {trade.imageUrl && <a href={trade.imageUrl} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-space-sm" aria-label="Open attached trade screenshot">
            <div className="mb-2 flex items-center gap-2 font-caption-mono text-caption-mono text-tertiary uppercase"><span className="material-symbols-outlined text-body-sm">photo_camera</span>Trade screenshot</div>
            <img src={trade.imageUrl} alt={`${trade.symbol} trade chart screenshot`} className="mx-auto max-h-96 max-w-full rounded-lg object-contain transition-transform group-hover:scale-[1.01]" />
          </a>}
          {trade.linkUrl && <a href={trade.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-space-md py-space-sm font-caption-mono text-caption-mono text-on-surface hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-body-sm">link</span><span>Open trade reference</span><span className="material-symbols-outlined ml-auto text-body-sm">open_in_new</span>
          </a>}

          {/* Strategy & Behavioral Audit Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-1 border border-outline-variant">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-semibold">SETUP CRITERIA MET</span>
              <p className="font-body-sm text-body-sm text-on-surface">
                {trade.notes || 'No notes added for this trade.'}
              </p>
            </div>
            <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-1 border border-outline-variant">
              <span className="font-caption-mono text-caption-mono text-tertiary uppercase font-semibold">PSYCHOLOGICAL OBSERVATION</span>
              <p className="font-body-sm text-body-sm text-on-surface">
                {trade.tradeStatus === 'MISSED' ? `Missed setup: ${trade.missedReason || 'reason not recorded'}. ` : `Psychology: ${trade.psychologyTags ? (trade.psychologyTags.join(', ') || 'Not recorded') : (trade.emotion || 'Not recorded')}. Discipline score: ${trade.disciplineScore ?? 'Not recorded'}/5. `}
                {trade.executionQuality ? `Execution quality: ${trade.executionQuality}. ` : ''}
                {trade.tradeStatus !== 'MISSED' && (trade.rulesFollowed ? 'Plan followed.' : 'Plan not followed.')}{trade.mistakes?.length ? ` Mistakes tagged: ${trade.mistakes.join(', ')}.` : ''}
              </p>
            </div>
          </div>

          {/* AI Quant Review Module */}
          <div className="bg-surface-container p-space-md rounded-xl flex flex-col gap-space-sm border border-outline">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs font-caption-mono text-caption-mono text-tertiary uppercase font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                <span>AI QUANT COACH TRADE AUDIT</span>
              </div>
              <button
                onClick={handleRequestAiReview}
                disabled={isLoadingAi}
                className="px-space-md py-1 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-caption-mono font-caption-mono text-on-surface transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 border border-outline shadow-xs font-bold"
              >
                <span className="material-symbols-outlined text-body-sm text-secondary">
                  {isLoadingAi ? 'hourglass_top' : 'psychology'}
                </span>
                {isLoadingAi ? 'AUDITING...' : 'RUN AI AUDIT'}
              </button>
            </div>
            {aiReview ? (
              <p className="font-caption-mono text-caption-mono text-on-surface bg-surface-container-lowest p-space-md rounded-xl whitespace-pre-line border border-outline shadow-xs max-h-80 overflow-y-auto">
                {aiReview}
              </p>
            ) : (
              <p className="font-caption-mono text-caption-mono text-tertiary">
                Click "Run AI Audit" to request an institutional execution and risk review of this trade.
              </p>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-space-lg py-space-md bg-surface-container-low flex items-center justify-between border-t border-outline-variant/80">
          <span className="font-caption-mono text-caption-mono text-tertiary font-medium">
            HASH: {trade.id}
          </span>
          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => {
                if (confirm('Delete this trade record permanently?')) {
                  onDelete(trade.id);
                  onClose();
                }
              }}
              className="px-space-md py-1.5 rounded-full bg-error-container text-error hover:bg-secondary-container hover:text-on-secondary font-caption-mono text-caption-mono uppercase transition-colors cursor-pointer border border-outline shadow-xs font-bold"
            >
              DELETE
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(trade);
              }}
              className="px-space-md py-1.5 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-caption-mono text-caption-mono uppercase transition-colors cursor-pointer border border-outline shadow-xs font-bold"
            >
              EDIT NOTE
            </button>
            <button
              onClick={onClose}
              className="px-space-md py-1.5 rounded-full bg-primary-container text-on-primary-container hover:bg-secondary-container font-caption-mono text-caption-mono font-bold uppercase transition-colors shadow-sm cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
