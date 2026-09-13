import React, { useMemo } from 'react';
import {
  AggregationSummary,
  MonteCarloStats,
  WorkforceConfig,
  DemandRow,
  IntervalStaffing,
  IntervalResult,
} from '../../types';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Users,
  ShieldCheck,
  Percent,
  Play,
  RotateCw,
  Sparkles,
  ArrowRight,
  Database,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { LineChartSvg } from '../common/SimpleSvgCharts';

interface OverviewTabProps {
  summary: AggregationSummary | null;
  mcStats: MonteCarloStats | null;
  config: WorkforceConfig;
  demands: DemandRow[];
  intervalStaffing: IntervalStaffing[];
  simulationResults: IntervalResult[] | null;
  simulationStatus: 'not_run' | 'running' | 'complete' | 'stale' | 'failed';
  onRunSimulation: () => void;
  onNavigateToTab?: (tabKey: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  summary,
  mcStats,
  config,
  demands,
  intervalStaffing,
  simulationResults,
  simulationStatus,
  onRunSimulation,
  onNavigateToTab,
}) => {
  const hasResults = simulationResults && simulationResults.length > 0 && summary;

  // Chart data: Workload, Erlang required HC, Roster scheduled HC, and Effective HC
  const workloadTimelineData = useMemo(() => {
    if (demands.length === 0) return [];
    return demands.slice(0, 96).map((d, idx) => {
      const staff = intervalStaffing[idx];
      const res = simulationResults ? simulationResults[idx] : null;
      return {
        label: d.intervalStart,
        trafficErlangs: d.trafficErlangs,
        requiredHC: staff ? staff.requiredHC : 0,
        scheduledHC: staff ? staff.scheduledHC : 0,
        effectiveHC: staff ? staff.effectiveHC : 0,
        answered: res ? res.answered : 0,
        offered: d.volume,
      };
    });
  }, [demands, intervalStaffing, simulationResults]);

  // SLA & Occupancy Timeline Data
  const performanceTimelineData = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0) return [];
    return simulationResults.slice(0, 96).map((res) => ({
      label: res.interval || res.intervalStart || '',
      slaPercent: res.slaPercent ?? 0,
      occupancyPercent: res.occupancyPercent ?? 0,
      abandonPercent: res.abandonPercent ?? 0,
    }));
  }, [simulationResults]);

  // Overall calculations
  const totalVolume = useMemo(() => demands.reduce((acc, d) => acc + (d.volume || 0), 0), [demands]);
  const avgAht = useMemo(() => {
    if (demands.length === 0) return 0;
    const totalAht = demands.reduce((acc, d) => acc + (d.ahtSeconds || 0) * (d.volume || 0), 0);
    return totalVolume > 0 ? Math.round(totalAht / totalVolume) : 0;
  }, [demands, totalVolume]);

  const peakRequiredHC = useMemo(() => {
    if (intervalStaffing.length === 0) return 0;
    return Math.max(...intervalStaffing.map(s => s.requiredHC || 0), 0);
  }, [intervalStaffing]);

  const peakEffectiveHC = useMemo(() => {
    if (intervalStaffing.length === 0) return 0;
    return Math.max(...intervalStaffing.map(s => s.effectiveHC || 0), 0);
  }, [intervalStaffing]);

  const slaValue = summary ? (summary.slaPercent ?? 0) : null;
  const isSlaMeetingTarget = slaValue !== null ? slaValue >= config.slaPercentTarget : true;

  return (
    <div className="space-y-6 pb-8">
      {/* Simulation Stale / Not Run Banner */}
      {simulationStatus === 'stale' && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <strong className="text-white font-semibold">Configuration Modified Since Last Run</strong>
              <p className="text-amber-300/80 text-[11px] mt-0.5">
                Headcount or operational parameters have been updated. Re-run simulation to refresh KPIs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRunSimulation}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Re-run DES Simulation</span>
          </button>
        </div>
      )}

      {simulationStatus === 'not_run' && (
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-200">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <strong className="text-white font-semibold">Discrete-Event Simulation Ready</strong>
              <p className="text-blue-300/80 text-[11px] mt-0.5">
                Synthetic roster generated with {config.totalHC} HC. Click to compute exact SLA, wait times, and queue dynamics.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRunSimulation}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run DES Simulation</span>
          </button>
        </div>
      )}

      {/* Primary KPI Scorecard */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 font-mono">
        {/* KPI 1: SLA Target vs Actual */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between">
            <span>Service Level (SLA)</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="my-2">
            <div className={`text-2xl sm:text-3xl font-bold ${
              slaValue === null ? 'text-slate-400' : isSlaMeetingTarget ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {slaValue !== null ? `${slaValue.toFixed(1)}%` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Target: <span className="text-slate-200 font-mono">{config.slaPercentTarget}% in {config.slaThresholdSeconds}s</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-sans">
            {slaValue !== null ? (isSlaMeetingTarget ? '✓ SLA Achieved' : '⚠ Below Target SLA') : 'Awaiting simulation'}
          </div>
        </div>

        {/* KPI 2: ASA */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between">
            <span>Avg Speed Answer (ASA)</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold text-white">
              {summary ? `${(summary.asaSeconds ?? 0).toFixed(1)}s` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Wait time before pickup
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-sans">
            {summary ? `Max wait: ${Math.round(summary.maxWaitSeconds || 0)}s` : 'DES wait simulation'}
          </div>
        </div>

        {/* KPI 3: Answer Rate */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between">
            <span>Answer Rate %</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold text-emerald-400">
              {summary ? `${(summary.answerPercent ?? 0).toFixed(1)}%` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              {summary ? `${(summary.answered ?? 0).toLocaleString()} contacts` : 'Offered vs answered'}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-sans">
            Reconstructed from totals
          </div>
        </div>

        {/* KPI 4: Abandonment Rate */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between">
            <span>Abandonment Rate %</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="my-2">
            <div className={`text-2xl sm:text-3xl font-bold ${
              summary && (summary.abandonPercent ?? 0) > 5 ? 'text-rose-400' : 'text-white'
            }`}>
              {summary ? `${(summary.abandonPercent ?? 0).toFixed(1)}%` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              {summary ? `${(summary.abandoned ?? 0).toLocaleString()} abandons` : 'Impatience drop-offs'}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-sans">
            Patience curve: {config.defaultPatienceSeconds}s
          </div>
        </div>

        {/* KPI 5: Occupancy */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between">
            <span>Agent Occupancy %</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="my-2">
            <div className={`text-2xl sm:text-3xl font-bold ${
              summary && (summary.occupancyPercent ?? 0) > config.maxOccupancyThreshold ? 'text-rose-400' : 'text-purple-300'
            }`}>
              {summary ? `${(summary.occupancyPercent ?? 0).toFixed(1)}%` : '--'}
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Ceiling: <span className="text-slate-200 font-mono">{config.maxOccupancyThreshold}%</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-sans">
            Handling time / Logged in
          </div>
        </div>

        {/* KPI 6: Headcount & Roster */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between">
            <span>Roster Headcount</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="my-2">
            <div className="text-2xl sm:text-3xl font-bold text-cyan-400">
              {config.totalHC} HC
            </div>
            <div className="text-[11px] text-slate-400 font-sans mt-0.5">
              Peak Req: <span className="text-slate-200 font-mono">{(peakRequiredHC ?? 0).toFixed(1)}</span> · Eff: <span className="text-slate-200 font-mono">{(peakEffectiveHC ?? 0).toFixed(1)}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-1.5 font-sans">
            Net shrinkage: {Math.round(config.shrinkageTotal * 100)}%
          </div>
        </div>
      </div>

      {/* High-Impact Visual Charts (SVG Standalone) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Staffing vs Demand Curve */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span>Demand vs Effective Headcount Capacity</span>
              </h3>
              <p className="text-xs text-slate-400">Traffic Erlangs vs Erlang Required vs Net Effective Staffing</p>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('coverage')}
                className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
              >
                <span>Full Coverage</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <LineChartSvg
            data={workloadTimelineData}
            height={260}
            series={[
              { key: 'trafficErlangs', name: 'Traffic (Erlangs)', color: '#38bdf8', strokeWidth: 2, areaFill: true },
              { key: 'requiredHC', name: 'Required HC (Erlang)', color: '#f59e0b', strokeWidth: 2, strokeDasharray: '4 3' },
              { key: 'effectiveHC', name: 'Effective Capacity HC', color: '#10b981', strokeWidth: 2.5 },
            ]}
          />
        </div>

        {/* Chart 2: Service Level Performance Timeline */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>SLA &amp; Occupancy Trajectory</span>
              </h3>
              <p className="text-xs text-slate-400">Interval SLA % vs Occupancy % with SLA Target Threshold</p>
            </div>
            {onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('results')}
                className="text-xs text-blue-400 hover:text-blue-300 font-mono flex items-center gap-1 cursor-pointer"
              >
                <span>All Intervals</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {performanceTimelineData.length > 0 ? (
            <LineChartSvg
              data={performanceTimelineData}
              height={260}
              referenceY={config.slaPercentTarget}
              referenceLabel={`Target ${config.slaPercentTarget}%`}
              valueFormatter={(v) => `${Math.round(v)}%`}
              series={[
                { key: 'slaPercent', name: 'SLA % (Simulated)', color: '#10b981', strokeWidth: 2 },
                { key: 'occupancyPercent', name: 'Occupancy %', color: '#a855f7', strokeWidth: 2 },
                { key: 'abandonPercent', name: 'Abandon %', color: '#f43f5e', strokeWidth: 1.5, strokeDasharray: '3 2' },
              ]}
            />
          ) : (
            <div className="h-[260px] flex flex-col items-center justify-center text-center p-4">
              <Clock className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-xs text-slate-400">Run Discrete Simulation to generate SLA &amp; Occupancy trajectory.</p>
              <button
                type="button"
                onClick={onRunSimulation}
                className="mt-3 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Run Simulation</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dataset & Assumptions Snapshot */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-slate-500">Demands Loaded:</span>{' '}
            <strong className="text-white">{demands.length} Intervals</strong> ({totalVolume.toLocaleString()} Total Contacts)
          </div>
          <div>
            <span className="text-slate-500">Average AHT:</span>{' '}
            <strong className="text-white">{avgAht}s</strong>
          </div>
          <div>
            <span className="text-slate-500">Queue Model:</span>{' '}
            <strong className="text-white uppercase">{config.erlangModel || 'Erlang C'}</strong>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('demand')}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span>Inspect Demand Data</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
