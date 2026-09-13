import React from 'react';
import {
  WorkforceConfig,
  IntervalResult,
  DemandRow,
} from '../../types';
import {
  Cpu,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Layers,
  Sliders,
  Settings2,
  Sparkles,
} from 'lucide-react';

interface SimulationTabProps {
  config: WorkforceConfig;
  simulationStatus: 'not_run' | 'running' | 'complete' | 'stale' | 'failed';
  simulationProgress: number;
  simulationDurationMs: number | null;
  lastRunTimestamp: string | null;
  simulationMode: 'single' | 'monte_carlo';
  onModeChange: (mode: 'single' | 'monte_carlo') => void;
  onRunSimulation: () => void;
  onCancelSimulation?: () => void;
  demands: DemandRow[];
  simulationResults: IntervalResult[] | null;
  onNavigateToTab?: (tabKey: string) => void;
}

export const SimulationTab: React.FC<SimulationTabProps> = ({
  config,
  simulationStatus,
  simulationProgress,
  simulationDurationMs,
  lastRunTimestamp,
  simulationMode,
  onModeChange,
  onRunSimulation,
  onCancelSimulation,
  demands,
  simulationResults,
  onNavigateToTab,
}) => {
  const hasResults = simulationResults && simulationResults.length > 0;

  return (
    <div className="space-y-6 pb-8">
      {/* Execution Control & Live Status Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${
              simulationStatus === 'running'
                ? 'bg-blue-600/20 border-blue-500 text-blue-400 animate-pulse'
                : simulationStatus === 'complete'
                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                : simulationStatus === 'stale'
                ? 'bg-amber-600/20 border-amber-500 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Discrete Event Simulation Engine (DES)</h2>
                {/* Status Badge */}
                {simulationStatus === 'not_run' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-semibold border border-slate-700">
                    NOT RUN
                  </span>
                )}
                {simulationStatus === 'running' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-900/80 text-blue-300 text-xs font-semibold border border-blue-600 animate-pulse flex items-center gap-1">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    RUNNING {Math.round(simulationProgress)}%
                  </span>
                )}
                {simulationStatus === 'complete' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 text-xs font-semibold border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    COMPLETE
                  </span>
                )}
                {simulationStatus === 'stale' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 text-xs font-semibold border border-amber-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    STALE — INPUTS MODIFIED
                  </span>
                )}
                {simulationStatus === 'failed' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 text-xs font-semibold border border-rose-800 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    FAILED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulates exact Poisson contact arrivals, second-by-second agent state transitions, and finite customer abandonment curves.
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => onModeChange('single')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                simulationMode === 'single' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Single Run (Fast DES)
            </button>
            <button
              type="button"
              onClick={() => onModeChange('monte_carlo')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                simulationMode === 'monte_carlo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Monte Carlo ({config.monteCarloRuns ?? 25} Runs)</span>
            </button>
          </div>
        </div>

        {/* Running Progress Bar */}
        {simulationStatus === 'running' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-blue-300">
              <span>Executing DES queue simulation events...</span>
              <span>{Math.round(simulationProgress)}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-150 ease-out"
                style={{ width: `${simulationProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Trigger Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
          <div className="text-xs text-slate-400 font-mono">
            {lastRunTimestamp && (
              <span>Last completed at: <strong className="text-slate-200">{lastRunTimestamp}</strong> {simulationDurationMs ? `(${simulationDurationMs}ms)` : ''}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {simulationStatus === 'running' && onCancelSimulation && (
              <button
                type="button"
                onClick={onCancelSimulation}
                className="px-4 py-2 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-bold transition cursor-pointer"
              >
                Cancel Simulation
              </button>
            )}

            <button
              type="button"
              onClick={onRunSimulation}
              disabled={simulationStatus === 'running'}
              className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg transition cursor-pointer ${
                simulationStatus === 'running'
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : simulationStatus === 'stale'
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {simulationStatus === 'running' ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>SIMULATION IN PROGRESS...</span>
                </>
              ) : simulationStatus === 'stale' ? (
                <>
                  <RotateCw className="w-4 h-4" />
                  <span>RE-RUN SIMULATION (UPDATED INPUTS)</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>START DISCRETE SIMULATION</span>
                </>
              )}
            </button>

            {hasResults && onNavigateToTab && (
              <button
                type="button"
                onClick={() => onNavigateToTab('results')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
              >
                View Detailed Results
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Complete Simulation Assumptions Audit Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Active Operational Assumptions</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {/* Box 1: Headcount & Roster */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-300 font-sans border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Headcount &amp; Shifts</span>
              <span className="text-emerald-400">{config.totalHC} HC</span>
            </div>
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Daily Paid Hours:</span>
                <span className="text-white">{config.dailyPaidHours}h</span>
              </div>
              <div className="flex justify-between">
                <span>Work / Off Pattern:</span>
                <span className="text-white">{config.workDaysPerWeek}W / {config.offDaysPerWeek}O</span>
              </div>
              <div className="flex justify-between">
                <span>Min Rest Between:</span>
                <span className="text-white">{config.minRestHoursBetweenShifts ?? 12}h</span>
              </div>
              <div className="flex justify-between">
                <span>Shift Increment:</span>
                <span className="text-white">{config.shiftStartStepMinutes ?? 30}m</span>
              </div>
            </div>
          </div>

          {/* Box 2: Capacity Loss */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-300 font-sans border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Shrinkage &amp; Adherence</span>
              <span className="text-purple-400">{Math.round(config.shrinkageTotal * 100)}%</span>
            </div>
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Protected Breaks:</span>
                <span className="text-white">{Math.round((config.shrinkageBreakPercent ?? 0.07) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Out-of-Office Loss:</span>
                <span className="text-white">{Math.round((config.shrinkageOutOffice ?? 0.12) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>In-Office Loss:</span>
                <span className="text-white">{Math.round((config.shrinkageInOffice ?? 0.13) * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Adherence Target:</span>
                <span className="text-emerald-400">{Math.round((config.adherence ?? 0.90) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Box 3: Arrivals & Service Model */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-300 font-sans border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Contact Dynamics</span>
              <span className="text-blue-400 capitalize">{config.arrivalMode === 'fixed_forecast' ? 'Fixed' : 'Poisson'}</span>
            </div>
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>AHT Distribution:</span>
                <span className="text-white capitalize">{config.serviceTimeDist || 'fixed'}</span>
              </div>
              <div className="flex justify-between">
                <span>Target SLA:</span>
                <span className="text-white">{config.slaPercentTarget}% in {config.slaThresholdSeconds}s</span>
              </div>
              <div className="flex justify-between">
                <span>Caller Patience:</span>
                <span className="text-white">{config.defaultPatienceSeconds ?? 120}s</span>
              </div>
              <div className="flex justify-between">
                <span>Short Abandon Cap:</span>
                <span className="text-white">{config.shortAbandonThresholdSeconds ?? 5}s</span>
              </div>
            </div>
          </div>

          {/* Box 4: Execution Seeds & MC */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="font-bold text-slate-300 font-sans border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>Engine Control</span>
              <span className="text-cyan-400">Seed {config.seed ?? 42}</span>
            </div>
            <div className="space-y-1 text-slate-400 text-[11px]">
              <div className="flex justify-between">
                <span>Execution Mode:</span>
                <span className="text-white capitalize">{simulationMode}</span>
              </div>
              <div className="flex justify-between">
                <span>MC Replications:</span>
                <span className="text-white">{config.monteCarloRuns ?? 25}</span>
              </div>
              <div className="flex justify-between">
                <span>Queue Closure:</span>
                <span className="text-white">Finish Queued</span>
              </div>
              <div className="flex justify-between">
                <span>Voice Concurrency:</span>
                <span className="text-white">Strictly 1</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
