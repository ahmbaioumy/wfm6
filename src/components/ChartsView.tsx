import React, { useRef, useEffect } from 'react';
import { IntervalResult, WorkforceConfig } from '../types';

interface ChartsViewProps {
  results: IntervalResult[];
  config: WorkforceConfig;
}

export const ChartsView: React.FC<ChartsViewProps> = ({
  results,
  config,
}) => {
  const workloadCanvasRef = useRef<HTMLCanvasElement>(null);
  const perfCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!results || results.length === 0) return;

    // 1. Render Workload Canvas
    const c1 = workloadCanvasRef.current;
    if (c1) {
      const ctx = c1.getContext('2d');
      if (ctx) {
        const rect = c1.getBoundingClientRect();
        c1.width = rect.width * 2;
        c1.height = 240 * 2;
        ctx.scale(2, 2);
        ctx.clearRect(0, 0, rect.width, 240);

        const padLeft = 38;
        const padBottom = 30;
        const padTop = 20;
        const padRight = 16;
        const w = rect.width - padLeft - padRight;
        const h = 240 - padBottom - padTop;
        const n = results.length;

        let maxVal = 1;
        results.forEach(r => {
          maxVal = Math.max(maxVal, r.trafficErlangs, r.erlangReqHC, r.effectiveHC, r.scheduledHC);
        });
        maxVal = Math.ceil(maxVal * 1.15);

        // Grid lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
          const y = padTop + (g / 4) * h;
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + w, y);
          ctx.stroke();

          const val = Math.round(maxVal * (1 - g / 4));
          ctx.fillStyle = '#64748b';
          ctx.font = '10px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(String(val), padLeft - 6, y + 3);
        }

        // Bars: Traffic Erlangs vs Effective HC
        const groupW = w / n;
        const barW = Math.max(3, groupW * 0.35);

        for (let i = 0; i < n; i++) {
          const r = results[i];
          const x = padLeft + i * groupW + (groupW - barW * 2) / 2;

          // Traffic Erlangs (blue)
          const erlH = (r.trafficErlangs / maxVal) * h;
          ctx.fillStyle = 'rgba(59, 130, 246, 0.45)';
          ctx.fillRect(x, padTop + h - erlH, barW, erlH);

          // Effective Staffing (emerald)
          const effH = (r.effectiveHC / maxVal) * h;
          ctx.fillStyle = '#10b981';
          ctx.fillRect(x + barW, padTop + h - effH, barW, effH);

          // Interval label every 2-3 intervals
          if (i % Math.ceil(n / 8) === 0 || i === n - 1) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(r.interval, x + barW, padTop + h + 16);
          }
        }

        // Line: Erlang Required Benchmark
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const r = results[i];
          const x = padLeft + i * groupW + groupW / 2;
          const y = padTop + h - (r.erlangReqHC / maxVal) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Legend
        ctx.textAlign = 'left';
        ctx.font = '11px sans-serif';

        ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.fillRect(padLeft, 6, 10, 8);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Traffic Erlangs', padLeft + 14, 13);

        ctx.fillStyle = '#10b981';
        ctx.fillRect(padLeft + 110, 6, 10, 8);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Effective Staffing', padLeft + 124, 13);

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(padLeft + 230, 6, 10, 8);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Erlang Benchmark Req', padLeft + 244, 13);
      }
    }

    // 2. Render Performance Canvas (SLA & Occupancy)
    const c2 = perfCanvasRef.current;
    if (c2) {
      const ctx = c2.getContext('2d');
      if (ctx) {
        const rect = c2.getBoundingClientRect();
        c2.width = rect.width * 2;
        c2.height = 240 * 2;
        ctx.scale(2, 2);
        ctx.clearRect(0, 0, rect.width, 240);

        const padLeft = 38;
        const padBottom = 30;
        const padTop = 20;
        const padRight = 16;
        const w = rect.width - padLeft - padRight;
        const h = 240 - padBottom - padTop;
        const n = results.length;

        // Grid lines for 0%, 25%, 50%, 75%, 100%
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        for (let g = 0; g <= 4; g++) {
          const y = padTop + (g / 4) * h;
          ctx.beginPath();
          ctx.moveTo(padLeft, y);
          ctx.lineTo(padLeft + w, y);
          ctx.stroke();

          const pct = 100 - g * 25;
          ctx.fillStyle = '#64748b';
          ctx.font = '10px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(`${pct}%`, padLeft - 6, y + 3);
        }

        // Target SLA line (dashed red)
        const targetY = padTop + h - (config.slaPercentTarget / 100) * h;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padLeft, targetY);
        ctx.lineTo(padLeft + w, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // SLA Line
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const r = results[i];
          const x = padLeft + (i / (n - 1 || 1)) * w;
          const y = padTop + h - (Math.min(100, Math.max(0, r.slaPercent)) / 100) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Occupancy Line
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const r = results[i];
          const x = padLeft + (i / (n - 1 || 1)) * w;
          const y = padTop + h - (Math.min(100, Math.max(0, r.occupancyPercent)) / 100) * h;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // X Axis labels
        for (let i = 0; i < n; i++) {
          if (i % Math.ceil(n / 8) === 0 || i === n - 1) {
            const x = padLeft + (i / (n - 1 || 1)) * w;
            ctx.fillStyle = '#94a3b8';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(results[i].interval, x, padTop + h + 16);
          }
        }

        // Legend
        ctx.textAlign = 'left';
        ctx.font = '11px sans-serif';

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(padLeft, 6, 12, 3);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Simulated SLA %', padLeft + 16, 11);

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(padLeft + 120, 6, 12, 3);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('Agent Occupancy %', padLeft + 136, 11);

        ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
        ctx.fillRect(padLeft + 260, 6, 12, 2);
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText(`${config.slaPercentTarget}% SLA Target`, padLeft + 276, 11);
      }
    }
  }, [results, config]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
          <span>Demand Workload vs. Roster Capacity</span>
          <span className="text-[11px] text-slate-400 font-mono">Erlang vs. Effective HC</span>
        </h3>
        <canvas ref={workloadCanvasRef} className="w-full h-60 block rounded-lg bg-slate-950 border border-slate-800/80" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center justify-between">
          <span>DES Simulated SLA % &amp; Occupancy % Curves</span>
          <span className="text-[11px] text-slate-400 font-mono">Continuous Queue Dynamics</span>
        </h3>
        <canvas ref={perfCanvasRef} className="w-full h-60 block rounded-lg bg-slate-950 border border-slate-800/80" />
      </div>
    </div>
  );
};
