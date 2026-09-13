import React from 'react';
import { Target, Clock, PhoneCall, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { AggregationSummary, MonteCarloStats, WorkforceConfig } from '../types';

interface KpiCardsProps {
  summary: AggregationSummary | null;
  mcStats: MonteCarloStats | null;
  config: WorkforceConfig;
}

export const KpiCards: React.FC<KpiCardsProps> = ({
  summary,
  mcStats,
  config,
}) => {
  if (!summary) return null;

  const targetMet = summary.slaPercent >= config.slaPercentTarget;
  const slaColor = targetMet ? 'text-emerald-400' : 'text-rose-400';
  const slaBg = targetMet ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. SLA Card */}
      <div className={`rounded-xl border p-4 sm:p-5 bg-slate-900 shadow-sm relative overflow-hidden ${slaBg}`}>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">Service Level (SLA)</span>
          <Target className="w-4 h-4 text-slate-400" />
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className={`text-3xl font-extrabold tracking-tight ${slaColor}`}>
            {summary.slaPercent}%
          </span>
          <span className="text-xs text-slate-400">
            vs {config.slaPercentTarget}% target
          </span>
        </div>

        <div className="text-xs text-slate-300 mt-2 space-y-0.5">
          {mcStats ? (
            <div className="flex justify-between items-center text-[11px] text-slate-400">
              <span>95% CI: [{mcStats.ci95Lower}% – {mcStats.ci95Upper}%]</span>
              <span>P10: {mcStats.p10Sla}%</span>
            </div>
          ) : (
            <div className="text-[11px] text-slate-400">
              {summary.intervalsMetSla} of {summary.intervalsCount} intervals met target
            </div>
          )}
          <div className="flex items-center gap-1 font-medium text-[11px] pt-0.5">
            {targetMet ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Target Achieved
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> SLA Deficit ({(summary.slaPercent - config.slaPercentTarget).toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. ASA Card */}
      <div className="rounded-xl border border-slate-800 p-4 sm:p-5 bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">Speed of Answer (ASA)</span>
          <Clock className="w-4 h-4 text-blue-400" />
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className="text-3xl font-extrabold tracking-tight text-white">
            {summary.asaSeconds}s
          </span>
          <span className="text-xs text-slate-400">average wait</span>
        </div>

        <div className="text-xs text-slate-300 mt-2 space-y-0.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Waiting Sum: {(summary.totalWaitingSeconds / 60).toFixed(0)} min</span>
            {mcStats && <span>P90: {mcStats.p90Asa}s</span>}
          </div>
          <div className="text-[11px] text-slate-400">
            Arrival threshold: &le; {config.slaThresholdSeconds} seconds
          </div>
        </div>
      </div>

      {/* 3. Answer / Abandon Card */}
      <div className="rounded-xl border border-slate-800 p-4 sm:p-5 bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">Answer % / Abandon %</span>
          <PhoneCall className="w-4 h-4 text-indigo-400" />
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className="text-3xl font-extrabold tracking-tight text-emerald-400">
            {summary.answerPercent}%
          </span>
          <span className="text-sm font-semibold text-rose-400">
            / {summary.abandonPercent}%
          </span>
        </div>

        <div className="text-xs text-slate-300 mt-2 space-y-0.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Answered: {summary.answered.toLocaleString()}</span>
            <span>Abandoned: {summary.abandoned.toLocaleString()}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Total Offered: {summary.offered.toLocaleString()} contacts
          </div>
        </div>
      </div>

      {/* 4. Occupancy Card */}
      <div className="rounded-xl border border-slate-800 p-4 sm:p-5 bg-slate-900 shadow-sm">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="font-semibold uppercase tracking-wider">Agent Occupancy</span>
          <Activity className="w-4 h-4 text-amber-400" />
        </div>

        <div className="flex items-baseline gap-2 my-1">
          <span className={`text-3xl font-extrabold tracking-tight ${summary.occupancyPercent > config.maxOccupancyThreshold ? 'text-amber-400' : 'text-white'}`}>
            {summary.occupancyPercent}%
          </span>
          <span className="text-xs text-slate-400">
            vs {config.maxOccupancyThreshold}% cap
          </span>
        </div>

        <div className="text-xs text-slate-300 mt-2 space-y-0.5">
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Avg Sched: {summary.scheduledAvg}</span>
            <span>Effective: {summary.effectiveAvg}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Erlang Req: {summary.erlangReqAvg} | Pop: {config.totalHC} HC
          </div>
        </div>
      </div>
    </div>
  );
};
