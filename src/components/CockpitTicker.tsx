import React from 'react';
import { AggregationSummary, MonteCarloStats, WorkforceConfig } from '../types';
import { Target, Clock, PhoneCall, PhoneOff, Activity, Users, ShieldCheck, AlertCircle } from 'lucide-react';

interface CockpitTickerProps {
  summary: AggregationSummary | null;
  mcStats: MonteCarloStats | null;
  config: WorkforceConfig;
  totalIntervals: number;
  workingHC: number;
  offHC: number;
}

export const CockpitTicker: React.FC<CockpitTickerProps> = ({
  summary,
  mcStats,
  config,
  totalIntervals,
  workingHC,
  offHC,
}) => {
  if (!summary) return null;

  const targetMet = summary.slaPercent >= config.slaPercentTarget;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 sm:p-3 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
      {/* 1. SLA Metric Chip */}
      <div className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border ${
        targetMet
          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
          : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
      }`}>
        <Target className="w-4 h-4 shrink-0" />
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Service Level (SLA)</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-extrabold font-mono">{summary.slaPercent}%</span>
            <span className="text-[10px] text-slate-400">/ {config.slaPercentTarget}% target</span>
          </div>
        </div>
      </div>

      {/* 2. ASA Metric Chip */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200">
        <Clock className="w-4 h-4 text-blue-400 shrink-0" />
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Avg Speed Answer (ASA)</div>
          <div className="text-base font-extrabold font-mono text-white">{summary.asaSeconds}s</div>
        </div>
      </div>

      {/* 3. Answer Rate */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200">
        <PhoneCall className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Answer Rate</div>
          <div className="text-base font-extrabold font-mono text-emerald-400">{summary.answerPercent ?? summary.answerRatePercent ?? 0}%</div>
        </div>
      </div>

      {/* 4. Abandon Rate */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200">
        <PhoneOff className="w-4 h-4 text-amber-400 shrink-0" />
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Abandon Rate</div>
          <div className="text-base font-extrabold font-mono text-amber-400">{summary.abandonPercent ?? summary.abandonRatePercent ?? 0}%</div>
        </div>
      </div>

      {/* 5. Occupancy */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200">
        <Activity className="w-4 h-4 text-purple-400 shrink-0" />
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Avg Occupancy</div>
          <div className="text-base font-extrabold font-mono text-purple-300">{summary.occupancyPercent ?? summary.averageOccupancyPercent ?? 0}%</div>
        </div>
      </div>

      {/* 6. Active Staffing Sizing */}
      <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200">
        <Users className="w-4 h-4 text-cyan-400 shrink-0" />
        <div>
          <div className="text-[10px] uppercase font-semibold text-slate-400">Roster Headcount</div>
          <div className="text-xs font-bold text-white">
            <span className="font-mono text-cyan-400">{config.totalHC}</span> Gross ({workingHC} Active / {offHC} OFF)
          </div>
        </div>
      </div>
    </div>
  );
};
