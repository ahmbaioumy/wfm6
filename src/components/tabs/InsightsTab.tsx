import React, { useState, useMemo } from 'react';
import {
  IntervalResult,
  DemandRow,
  IntervalStaffing,
  WorkforceConfig,
} from '../../types';
import {
  AlertTriangle,
  Flame,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Sliders,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface InsightsTabProps {
  simulationResults: IntervalResult[] | null;
  demands: DemandRow[];
  intervalStaffing: IntervalStaffing[];
  config: WorkforceConfig;
  onApplyConfig: (updated: Partial<WorkforceConfig>) => void;
  onRunSimulation: () => void;
}

export const InsightsTab: React.FC<InsightsTabProps> = ({
  simulationResults,
  demands,
  intervalStaffing,
  config,
  onApplyConfig,
  onRunSimulation,
}) => {
  const [targetSlaSlider, setTargetSlaSlider] = useState<number>(config.slaPercentTarget);

  const hasResults = simulationResults && simulationResults.length > 0;

  // Categorize interval insights
  const { criticalInsights, warningInsights, opportunityInsights, healthyCount } = useMemo(() => {
    const critical: Array<{ title: string; desc: string; count: number }> = [];
    const warning: Array<{ title: string; desc: string; count: number }> = [];
    const opportunity: Array<{ title: string; desc: string; count: number }> = [];
    let healthy = 0;

    if (!hasResults || !simulationResults) {
      // Analyze from staffing alone
      const understaffed = intervalStaffing.filter(s => s.effectiveHC < s.requiredHC - 1.0);
      if (understaffed.length > 0) {
        critical.push({
          title: 'Severe Capacity Deficit',
          desc: `${understaffed.length} intervals have effective capacity more than 1 HC below Erlang benchmark.`,
          count: understaffed.length,
        });
      }
      const overstaffed = intervalStaffing.filter(s => s.effectiveHC > s.requiredHC + 2.0);
      if (overstaffed.length > 0) {
        opportunity.push({
          title: 'Excess Agent Capacity Available',
          desc: `${overstaffed.length} intervals exceed required headcount by 2+ HC. Shifts can be re-centered or breaks staggered.`,
          count: overstaffed.length,
        });
      }
      return { criticalInsights: critical, warningInsights: warning, opportunityInsights: opportunity, healthyCount: intervalStaffing.length - understaffed.length };
    }

    // Full DES simulation analysis
    let severeSlaCount = 0;
    let highOccCount = 0;
    let highAbandonCount = 0;
    let overstaffedCount = 0;

    simulationResults.forEach((res, idx) => {
      const staff = intervalStaffing[idx];
      const isSevereSla = (res.slaPercent ?? 0) < 50;
      const isBurnoutOcc = (res.occupancyPercent ?? 0) > config.maxOccupancyThreshold;
      const isHighAbandon = (res.abandonPercent ?? 0) > 10;
      const isOverstaffed = staff && (staff.effectiveHC ?? 0) > (staff.requiredHC ?? 0) + 2.0;

      if (isSevereSla) severeSlaCount++;
      if (isBurnoutOcc) highOccCount++;
      if (isHighAbandon) highAbandonCount++;
      if (isOverstaffed) overstaffedCount++;

      if (!isSevereSla && !isBurnoutOcc && !isHighAbandon && res.slaPercent >= config.slaPercentTarget) {
        healthy++;
      }
    });

    if (severeSlaCount > 0) {
      critical.push({
        title: 'Severe Service Level Collapses (SLA < 50%)',
        desc: `${severeSlaCount} intervals suffered queue build-ups where fewer than half of callers were answered within threshold.`,
        count: severeSlaCount,
      });
    }

    if (highAbandonCount > 0) {
      critical.push({
        title: 'High Caller Abandonment (> 10%)',
        desc: `${highAbandonCount} intervals experienced elevated abandonment rates where frustrated customers hung up.`,
        count: highAbandonCount,
      });
    }

    if (highOccCount > 0) {
      warning.push({
        title: 'Agent Burnout Risk (Occupancy > Ceiling)',
        desc: `${highOccCount} intervals exceeded the ${config.maxOccupancyThreshold}% occupancy ceiling, leaving insufficient breather time between interactions.`,
        count: highOccCount,
      });
    }

    if (overstaffedCount > 0) {
      opportunity.push({
        title: 'Overstaffed Buffer Intervals',
        desc: `${overstaffedCount} intervals maintain surplus agents (>2 HC above requirement). Staggering shifts earlier or later could balance understaffed peaks.`,
        count: overstaffedCount,
      });
    }

    return {
      criticalInsights: critical,
      warningInsights: warning,
      opportunityInsights: opportunity,
      healthyCount: healthy,
    };
  }, [simulationResults, intervalStaffing, config.slaPercentTarget, config.maxOccupancyThreshold, hasResults]);

  // Reverse Mode Staffing Solver calculation
  const solverRecommendation = useMemo(() => {
    // Current total Erlang required HC average
    const totalRequiredSum = intervalStaffing.reduce((sum, s) => sum + s.requiredHC, 0);
    const totalEffectiveSum = intervalStaffing.reduce((sum, s) => sum + s.effectiveHC, 0);
    const intervalsCount = intervalStaffing.length || 1;

    const avgReq = totalRequiredSum / intervalsCount;
    const avgEff = totalEffectiveSum / intervalsCount;

    // Headcount scaling factor based on shrinkage & work hours
    const netMultiplier = (config.dailyPaidHours * config.workDaysPerWeek) / (7 * config.dailyPaidHours);
    const shrinkageMultiplier = 1 / Math.max(0.2, 1 - config.shrinkageTotal);
    const adherenceMultiplier = 1 / Math.max(0.5, config.adherence ?? 0.90);

    // Compute additional HC required to hit target SLA
    const slaGapFactor = Math.max(0, (targetSlaSlider - config.slaPercentTarget) / 100);
    const baseStaffingDeficit = Math.max(0, avgReq - avgEff);

    const neededExtraGrossHC = Math.round(
      (baseStaffingDeficit + (slaGapFactor * avgReq * 0.4)) * shrinkageMultiplier * adherenceMultiplier
    );

    const recommendedGrossHC = config.totalHC + neededExtraGrossHC;

    return {
      neededExtraGrossHC,
      recommendedGrossHC,
      currentGrossHC: config.totalHC,
      targetSla: targetSlaSlider,
    };
  }, [intervalStaffing, config, targetSlaSlider]);

  return (
    <div className="space-y-6 pb-8">
      {/* Reverse Mode Staffing Solver Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-600/50 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Reverse Mode Staffing Solver</h3>
              <p className="text-xs text-slate-300">
                Solve exact gross headcount needed to achieve your desired Service Level Target.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">Target SLA:</span>
            <input
              type="range"
              min={50}
              max={99}
              value={targetSlaSlider}
              onChange={(e) => setTargetSlaSlider(parseInt(e.target.value, 10))}
              className="w-32 accent-blue-500 cursor-pointer"
            />
            <span className="text-sm font-bold font-mono text-blue-400 w-12 text-right">
              {targetSlaSlider}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-slate-400 font-sans">Current Gross Headcount</div>
            <div className="text-2xl font-bold text-white">{solverRecommendation.currentGrossHC} HC</div>
            <div className="text-[11px] text-slate-500 font-sans">Active in roster</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <div className="text-slate-400 font-sans">Recommended Headcount</div>
            <div className="text-2xl font-bold text-emerald-400">
              {solverRecommendation.recommendedGrossHC} HC
            </div>
            <div className="text-[11px] text-slate-400 font-sans">
              {solverRecommendation.neededExtraGrossHC > 0
                ? `+${solverRecommendation.neededExtraGrossHC} HC additional needed`
                : 'Current HC is sufficient'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
            <div className="text-slate-400 font-sans">Action</div>
            <button
              type="button"
              onClick={() => {
                onApplyConfig({
                  totalHC: solverRecommendation.recommendedGrossHC,
                  slaPercentTarget: solverRecommendation.targetSla,
                });
              }}
              disabled={solverRecommendation.neededExtraGrossHC === 0}
              className={`w-full py-2 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                solverRecommendation.neededExtraGrossHC > 0
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <span>Apply Recommended HC</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Operational Diagnostic Breakdown */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white">Operational Diagnostician</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Critical Category */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Critical Issues ({criticalInsights.length})
              </span>
            </div>
            {criticalInsights.length > 0 ? (
              <div className="space-y-2">
                {criticalInsights.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-200">
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-rose-300/80 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-950/20 text-emerald-300 border border-emerald-900/50">
                Zero critical capacity collapses detected.
              </div>
            )}
          </div>

          {/* Warning Category */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Warnings &amp; Burnout Risk ({warningInsights.length})
              </span>
            </div>
            {warningInsights.length > 0 ? (
              <div className="space-y-2">
                {warningInsights.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-200">
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-amber-300/80 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-emerald-950/20 text-emerald-300 border border-emerald-900/50">
                Agent occupancy and workload are within healthy boundaries.
              </div>
            )}
          </div>

          {/* Opportunity Category */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-400 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Optimization Opportunities ({opportunityInsights.length})
              </span>
            </div>
            {opportunityInsights.length > 0 ? (
              <div className="space-y-2">
                {opportunityInsights.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/50 text-blue-200">
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="text-[11px] text-blue-300/80 mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-950 text-slate-400">
                Shift alignment matches demand curve without excess buffers.
              </div>
            )}
          </div>

          {/* Healthy Category */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Healthy Intervals
              </span>
              <span className="font-mono text-emerald-400 font-bold">{healthyCount} Intervals</span>
            </div>
            <div className="p-3 rounded-lg bg-emerald-950/20 text-emerald-300 border border-emerald-900/50 text-[11px] leading-relaxed">
              These intervals fully meet SLA targets, maintain agent occupancy below burnout thresholds, and have stable wait queues.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
