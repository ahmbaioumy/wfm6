import React, { useState } from 'react';
import { SimulationInsight, WorkforceConfig, IntervalDemand } from '../types';
import { Lightbulb, AlertTriangle, CheckCircle2, TrendingUp, Cpu, ArrowRight } from 'lucide-react';
import { solveReverseModeHC } from '../engines/insights';

interface InsightsViewProps {
  insights: SimulationInsight[];
  config: WorkforceConfig;
  demands: IntervalDemand[];
  onApplyHC: (newHC: number) => void;
}

export const InsightsView: React.FC<InsightsViewProps> = ({
  insights,
  config,
  demands,
  onApplyHC,
}) => {
  const [isSolvingReverse, setIsSolvingReverse] = useState(false);
  const [reverseResult, setReverseResult] = useState<{
    requiredHC: number;
    achievedSla: number;
    feasible: boolean;
    iterations: Array<{ hc: number; sla: number }>;
  } | null>(null);

  const handleRunReverseMode = () => {
    setIsSolvingReverse(true);
    setTimeout(() => {
      const res = solveReverseModeHC(demands, config, config.slaPercentTarget);
      setReverseResult(res);
      setIsSolvingReverse(false);
    }, 100);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">Actionable Insights &amp; Reverse Optimization</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational recommendations and real rosterable headcount solver (Forward vs. Reverse Mode).
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunReverseMode}
          disabled={isSolvingReverse || demands.length === 0}
          className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5"
        >
          <Cpu className="w-3.5 h-3.5" />
          {isSolvingReverse ? 'Optimizing Roster...' : 'Find Required HC (Reverse Mode)'}
        </button>
      </div>

      {/* Reverse Mode Result Banner */}
      {reverseResult && (
        <div className={`mb-4 p-4 rounded-lg border text-xs ${
          reverseResult.feasible
            ? 'bg-indigo-950/60 border-indigo-500/40'
            : 'bg-rose-950/60 border-rose-500/40'
        }`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className={`font-semibold uppercase tracking-wider block text-[10px] ${
                reverseResult.feasible ? 'text-indigo-300' : 'text-rose-300'
              }`}>
                Reverse Mode Solution (Target: &ge; {config.slaPercentTarget}% SLA)
              </span>
              {reverseResult.feasible ? (
                <>
                  <p className="text-slate-200 mt-1">
                    To achieve your target SLA across all intervals under realistic roster constraints, {Math.round(config.shrinkageTotal * 100)}% shrinkage, and {Math.round(config.adherence * 100)}% adherence:
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold text-emerald-400">
                      {reverseResult.requiredHC} Headcount
                    </span>
                    <span className="text-slate-400">
                      (Achieved simulated SLA: <strong>{reverseResult.achievedSla}%</strong>)
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-1 space-y-1">
                  <p className="text-rose-200 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 inline shrink-0" />
                    Target Infeasible within Operational Staffing Bounds
                  </p>
                  <p className="text-slate-300 text-[11px]">
                    Maximum tested staffing ({reverseResult.requiredHC} HC) achieved only {reverseResult.achievedSla}% SLA (target: {config.slaPercentTarget}%). Consider increasing shift hours, relaxing shrinkage/concurrency constraints, or adding shifts.
                  </p>
                </div>
              )}
            </div>

            {reverseResult.feasible && (
              <button
                type="button"
                onClick={() => onApplyHC(reverseResult.requiredHC)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs transition flex items-center gap-1 shadow"
              >
                Apply {reverseResult.requiredHC} HC &amp; Re-simulate
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2.5 pt-2 border-t border-indigo-500/20 flex flex-wrap gap-2 text-[10px] text-slate-400">
            <span>Iterations tested:</span>
            {reverseResult.iterations.map((it, idx) => (
              <span key={idx} className="bg-slate-900/80 px-1.5 py-0.5 rounded font-mono">
                {it.hc} HC &rarr; {it.sla}% SLA
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Insights List */}
      <div className="space-y-3">
        {insights.map(ins => {
          let borderClass = 'border-l-blue-500 bg-blue-950/20';
          let icon = <Lightbulb className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;

          if (ins.severity === 'critical') {
            borderClass = 'border-l-rose-500 bg-rose-950/20';
            icon = <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />;
          } else if (ins.severity === 'warning') {
            borderClass = 'border-l-amber-500 bg-amber-950/20';
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
          } else if (ins.severity === 'success') {
            borderClass = 'border-l-emerald-500 bg-emerald-950/20';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />;
          }

          return (
            <div
              key={ins.id}
              className={`p-3.5 rounded-r-lg border-l-4 border-y border-r border-slate-800/80 text-xs ${borderClass}`}
            >
              <div className="flex items-start gap-2.5">
                {icon}
                <div className="flex-1">
                  <h4 className="font-semibold text-white text-sm">{ins.title}</h4>
                  <p className="text-slate-300 mt-1">{ins.description}</p>
                  
                  <div className="mt-2.5 flex flex-col sm:flex-row gap-2 sm:items-center text-[11px]">
                    <div className="bg-slate-900/90 px-2.5 py-1 rounded text-slate-200 border border-slate-800">
                      <strong className="text-blue-400 font-semibold">Recommendation: </strong>
                      {ins.recommendation}
                    </div>
                    <div className="text-emerald-400 font-medium">
                      {ins.impact}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
