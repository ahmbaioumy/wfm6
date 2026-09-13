import React, { useState, useId } from 'react';

// ============================================================================
// 1. Line & Area Chart (SVG with interactive hover tooltip)
// ============================================================================
export interface ChartSeries {
  key: string;
  name: string;
  color: string;
  strokeWidth?: number;
  areaFill?: boolean;
  strokeDasharray?: string;
}

export interface LineChartProps {
  data: Array<{ label: string; [key: string]: any }>;
  series: ChartSeries[];
  height?: number;
  yAxisLabel?: string;
  valueFormatter?: (val: number) => string;
  referenceY?: number;
  referenceLabel?: string;
}

export const LineChartSvg: React.FC<LineChartProps> = ({
  data,
  series,
  height = 240,
  valueFormatter = (val) => String(Math.round(val * 10) / 10),
  referenceY,
  referenceLabel,
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartId = useId();

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-slate-500 font-mono">
        No chart data available
      </div>
    );
  }

  const padLeft = 40;
  const padRight = 16;
  const padTop = 20;
  const padBottom = 28;
  const width = 800; // SVG viewBox coordinate system width

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Compute min/max
  let minVal = 0;
  let maxVal = 1;
  for (const item of data) {
    for (const s of series) {
      const v = Number(item[s.key]) || 0;
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }
  }
  if (referenceY !== undefined) {
    if (referenceY > maxVal) maxVal = referenceY;
    if (referenceY < minVal) minVal = referenceY;
  }
  maxVal = maxVal * 1.1; // head-room

  const getY = (val: number) => {
    if (maxVal === minVal) return padTop + plotH / 2;
    const ratio = (val - minVal) / (maxVal - minVal);
    return padTop + plotH - ratio * plotH;
  };

  const getX = (index: number) => {
    if (data.length <= 1) return padLeft + plotW / 2;
    return padLeft + (index / (data.length - 1)) * plotW;
  };

  // Build grid ticks
  const gridSteps = 4;
  const yTicks = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = minVal + (i / gridSteps) * (maxVal - minVal);
    return { val, y: getY(val) };
  });

  const xInterval = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          {series.map(s => (
            <linearGradient key={s.key} id={`grad_${chartId}_${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.0} />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal Grid lines */}
        {yTicks.map((t, idx) => (
          <g key={idx}>
            <line
              x1={padLeft}
              y1={t.y}
              x2={padLeft + plotW}
              y2={t.y}
              stroke="#334155"
              strokeWidth="0.75"
              strokeDasharray={idx === 0 ? undefined : '3 3'}
            />
            <text
              x={padLeft - 6}
              y={t.y + 3}
              textAnchor="end"
              className="fill-slate-500 font-mono text-[9px]"
            >
              {valueFormatter(t.val)}
            </text>
          </g>
        ))}

        {/* Reference Line if given */}
        {referenceY !== undefined && (
          <g>
            <line
              x1={padLeft}
              y1={getY(referenceY)}
              x2={padLeft + plotW}
              y2={getY(referenceY)}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
            {referenceLabel && (
              <text
                x={padLeft + plotW - 4}
                y={getY(referenceY) - 4}
                textAnchor="end"
                className="fill-rose-400 font-mono text-[9px] font-bold"
              >
                {referenceLabel}
              </text>
            )}
          </g>
        )}

        {/* Area and Line for each series */}
        {series.map((s) => {
          const points = data.map((d, i) => `${getX(i)},${getY(Number(d[s.key]) || 0)}`).join(' ');
          const firstX = getX(0);
          const lastX = getX(data.length - 1);
          const baseY = getY(0);
          const areaPoints = `${points} ${lastX},${baseY} ${firstX},${baseY}`;

          return (
            <g key={s.key}>
              {s.areaFill && (
                <polygon
                  points={areaPoints}
                  fill={`url(#grad_${chartId}_${s.key})`}
                />
              )}
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth={s.strokeWidth || 2}
                strokeDasharray={s.strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* X Axis Labels */}
        {data.map((d, i) => {
          if (i % xInterval !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={getX(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-slate-500 font-mono text-[9px]"
            >
              {d.label}
            </text>
          );
        })}

        {/* Hover Crosshair & Trigger Rectangles */}
        {data.map((d, i) => {
          const x = getX(i);
          const stepW = plotW / Math.max(1, data.length - 1);
          return (
            <rect
              key={i}
              x={x - stepW / 2}
              y={padTop}
              width={stepW}
              height={plotH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={() => setHoverIndex(i)}
            />
          );
        })}

        {/* Active Hover Guide & Points */}
        {hoverIndex !== null && data[hoverIndex] && (
          <g pointerEvents="none">
            <line
              x1={getX(hoverIndex)}
              y1={padTop}
              x2={getX(hoverIndex)}
              y2={padTop + plotH}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            {series.map((s) => {
              const val = Number(data[hoverIndex][s.key]) || 0;
              return (
                <circle
                  key={s.key}
                  cx={getX(hoverIndex)}
                  cy={getY(val)}
                  r="3.5"
                  fill={s.color}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* Interactive Tooltip Card */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div
          className="absolute z-30 pointer-events-none p-2 rounded-lg bg-slate-900/95 border border-slate-700 shadow-xl text-xs font-mono backdrop-blur-sm transform -translate-y-full -translate-x-1/2 transition-transform duration-75"
          style={{
            left: `${((getX(hoverIndex) - 40) / (width - 56)) * 100}%`,
            top: `${padTop + 40}px`,
          }}
        >
          <div className="text-[10px] text-slate-400 font-sans border-b border-slate-800 pb-1 mb-1">
            {data[hoverIndex].label}
          </div>
          <div className="space-y-0.5 text-[11px]">
            {series.map(s => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1 text-slate-300">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span>{s.name}:</span>
                </span>
                <span className="font-bold text-white">
                  {valueFormatter(Number(data[hoverIndex][s.key]) || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Series Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-xs">
        {series.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 2. Bar Chart (SVG with hover and surplus/deficit colors)
// ============================================================================
export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarItem[];
  height?: number;
  valueFormatter?: (val: number) => string;
  positiveColor?: string;
  negativeColor?: string;
}

export const BarChartSvg: React.FC<BarChartProps> = ({
  data,
  height = 240,
  valueFormatter = (val) => String(Math.round(val * 10) / 10),
  positiveColor = '#10b981',
  negativeColor = '#f43f5e',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-slate-500 font-mono">
        No bar chart data available
      </div>
    );
  }

  const padLeft = 40;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const width = 800;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  let minVal = 0;
  let maxVal = 1;
  for (const item of data) {
    if (item.value > maxVal) maxVal = item.value;
    if (item.value < minVal) minVal = item.value;
  }
  maxVal = maxVal * 1.1;
  if (minVal < 0) minVal = minVal * 1.1;

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return padTop + plotH - ratio * plotH;
  };

  const zeroY = getY(0);
  const barWidth = Math.max(2, (plotW / data.length) * 0.7);
  const stepW = plotW / data.length;

  const xInterval = Math.max(1, Math.floor(data.length / 10));

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Zero baseline */}
        <line
          x1={padLeft}
          y1={zeroY}
          x2={padLeft + plotW}
          y2={zeroY}
          stroke="#475569"
          strokeWidth="1"
        />

        {/* Bars */}
        {data.map((d, i) => {
          const x = padLeft + i * stepW + (stepW - barWidth) / 2;
          const y = d.value >= 0 ? getY(d.value) : zeroY;
          const barH = Math.max(1, Math.abs(getY(d.value) - zeroY));
          const color = d.color || (d.value >= 0 ? positiveColor : negativeColor);

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                fill={color}
                rx={barWidth > 6 ? 2 : 0}
                className="transition-all hover:brightness-125 cursor-pointer"
                onMouseEnter={() => setHoverIndex(i)}
              />
              {(i % xInterval === 0 || i === data.length - 1) && (
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[9px]"
                >
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover Card */}
      {hoverIndex !== null && data[hoverIndex] && (
        <div
          className="absolute z-30 pointer-events-none p-2 rounded-lg bg-slate-900 border border-slate-700 shadow-xl text-xs font-mono backdrop-blur-sm -translate-y-full -translate-x-1/2"
          style={{
            left: `${((padLeft + hoverIndex * stepW) / width) * 100}%`,
            top: `${padTop + 30}px`,
          }}
        >
          <div className="text-slate-400 text-[10px]">{data[hoverIndex].label}</div>
          <div className="font-bold text-white mt-0.5">
            {valueFormatter(data[hoverIndex].value)}
          </div>
        </div>
      )}
    </div>
  );
};
