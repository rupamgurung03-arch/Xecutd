import React, { useState, useMemo } from 'react';
import { EquityPoint, formatCurrency } from '../utils/calculations';
import { ArrowUpRight, ArrowDownRight, Maximize2 } from 'lucide-react';

interface EquityChartProps {
  data: EquityPoint[];
  currency?: string;
}

export const EquityChart: React.FC<EquityChartProps> = ({ data, currency = 'USD' }) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [filterRange, setFilterRange] = useState<'all' | '30d' | '90d'>('all');

  // Filter points based on range if applicable
  const filteredData = useMemo(() => {
    if (data.length <= 1) return data;
    if (filterRange === 'all') return data;
    const count = filterRange === '30d' ? Math.min(data.length, 15) : Math.min(data.length, 30);
    return data.slice(-count);
  }, [data, filterRange]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return { min: 0, max: 1000, startVal: 0, endVal: 0, change: 0 };
    const values = filteredData.map((d) => d.cumulativePnL);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 100);
    const startVal = filteredData[0]?.cumulativePnL || 0;
    const endVal = filteredData[filteredData.length - 1]?.cumulativePnL || 0;
    const change = endVal - startVal;
    return { min, max, startVal, endVal, change };
  }, [filteredData]);

  const activePoint = hoverIndex !== null && filteredData[hoverIndex] 
    ? filteredData[hoverIndex] 
    : filteredData[filteredData.length - 1];

  const width = 800;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 35, left: 65 };

  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Coordinate scaling
  const rangeY = (stats.max - stats.min) || 1;
  const getY = (val: number) => {
    return padding.top + graphHeight - ((val - stats.min) / rangeY) * graphHeight;
  };

  const getX = (index: number) => {
    if (filteredData.length <= 1) return padding.left;
    return padding.left + (index / (filteredData.length - 1)) * graphWidth;
  };

  const pathD = useMemo(() => {
    if (filteredData.length === 0) return '';
    return filteredData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(d.cumulativePnL).toFixed(1)}`)
      .join(' ');
  }, [filteredData, stats]);

  const areaD = useMemo(() => {
    if (filteredData.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(filteredData.length - 1);
    const zeroY = getY(0);
    return `${pathD} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${firstX.toFixed(1)} ${zeroY.toFixed(1)} Z`;
  }, [pathD, filteredData, stats]);

  const isPositiveOverall = stats.change >= 0;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs">
      {/* Header controls & live hover readouts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider font-caption-mono">
              Cumulative Equity Curve
            </span>
            <span className="text-tertiary/60">·</span>
            <span className="text-[11px] text-tertiary font-caption-mono">
              {filteredData.length} Data Points
            </span>
          </div>

          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold font-numeric-stat tabular-nums text-on-surface">
              {formatCurrency(activePoint?.cumulativePnL ?? 0, currency)}
            </span>
            <div className={`flex items-center text-xs font-bold font-numeric-stat tabular-nums ${
              isPositiveOverall ? 'text-success' : 'text-secondary'
            }`}>
              {isPositiveOverall ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{isPositiveOverall ? '+' : ''}{formatCurrency(stats.change, currency)}</span>
            </div>
          </div>
        </div>

        {/* Hover Inspector Card */}
        {activePoint && (
          <div className="flex items-center gap-4 text-xs font-caption-mono bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant">
            <div>
              <span className="text-tertiary block text-[10px] uppercase">TICKER / DATE</span>
              <span className="font-semibold text-on-surface">
                {activePoint.symbol} · {activePoint.date}
              </span>
            </div>
            <div className="border-l border-outline-variant pl-3">
              <span className="text-tertiary block text-[10px] uppercase">TRADE P&L</span>
              <span className={`font-bold ${
                activePoint.tradePnL >= 0 ? 'text-success' : 'text-secondary'
              }`}>
                {activePoint.tradePnL >= 0 ? '+' : ''}{formatCurrency(activePoint.tradePnL, currency)}
              </span>
            </div>
            {activePoint.drawdown > 0 && (
              <div className="border-l border-outline-variant pl-3">
                <span className="text-tertiary block text-[10px] uppercase">DRAWDOWN</span>
                <span className="text-secondary font-bold">
                  -{formatCurrency(activePoint.drawdown, currency)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Range filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-lg shrink-0 border border-outline-variant">
          {(['all', '90d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setFilterRange(range)}
              className={`px-2.5 py-1 text-xs font-caption-mono font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                filterRange === range
                  ? 'bg-on-surface text-surface-container-lowest font-bold shadow-xs'
                  : 'text-tertiary hover:text-on-surface'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full h-64 mt-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const val = stats.min + ratio * (stats.max - stats.min);
            const y = getY(val);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-100 dark:text-slate-800/80"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-slate-400 dark:fill-slate-500 tabular-nums"
                >
                  {formatCurrency(val, currency)}
                </text>
              </g>
            );
          })}

          {/* Zero baseline */}
          {stats.min < 0 && stats.max > 0 && (
            <line
              x1={padding.left}
              y1={getY(0)}
              x2={width - padding.right}
              y2={getY(0)}
              stroke="currentColor"
              className="text-slate-300 dark:text-slate-700"
              strokeWidth="1.5"
            />
          )}

          {/* Filled Area */}
          <path d={areaD} fill="url(#equityGrad)" />

          {/* Equity Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive hover line & data points */}
          {filteredData.map((d, i) => {
            const x = getX(i);
            const y = getY(d.cumulativePnL);
            const isHovered = hoverIndex === i;

            return (
              <g key={i}>
                {/* Invisible hover hitbox */}
                <rect
                  x={x - 12}
                  y={padding.top}
                  width={24}
                  height={graphHeight}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(i)}
                />
                {/* Data point dot */}
                {(isHovered || i === filteredData.length - 1) && (
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? 5.5 : 4}
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all"
                  />
                )}
              </g>
            );
          })}

          {/* Crosshair when hovering */}
          {hoverIndex !== null && filteredData[hoverIndex] && (
            <line
              x1={getX(hoverIndex)}
              y1={padding.top}
              x2={getX(hoverIndex)}
              y2={height - padding.bottom}
              stroke="#10b981"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}
        </svg>
      </div>
    </div>
  );
};
