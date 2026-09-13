import React from 'react';
import {
  Play,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Activity,
  XCircle,
} from 'lucide-react';

interface BottomStatusBarProps {
  intervalCount: number;
  dateRange: string;
  totalHC: number;
  activeAgentsCount: number;
  offAgentsCount: number;
  requiredPeakHC: number;
  effectivePeakHC: number;
  simulationStatus: 'not_run' | 'running' | 'complete' | 'stale' | 'failed';
  simulationProgress: number;
  onRunSimulation: () => void;
  onCancelSimulation?: () => void;
}

export const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  intervalCount,
  dateRange,
  totalHC,
  activeAgentsCount,
  offAgentsCount,
  requiredPeakHC,
  effectivePeakHC,
  simulationStatus,
  simulationProgress,
  onRunSimulation,
  onCancelSimulation,
}) => {
  return (
    <footer className="h-[48px] bg-slate-900 border-t border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky bottom-0 z-40 select-none text-xs font-mono">
      {/* LEFT: Engine Status */}
      <div className="flex items-center gap-4 text-slate-300 truncate">
        {/* Data Status */}
        <div className="flex items-center gap-1.5" title="Demand Input State">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Data:</span>
          <span className="font-semibold text-white truncate max-w-[160px]">
            {intervalCount} intervals ({dateRange || 'None'})
          </span>
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-800" />

        {/* Roster Status */}
        <div className="hidden sm:flex items-center gap-1.5" title="Synthetic Roster State">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Roster:</span>
          <span className="font-semibold text-white">
            {totalHC} HC ({activeAgentsCount} Active / {offAgentsCount} Off)
          </span>
        </div>

        <div className="hidden md:block w-px h-4 bg-slate-800" />

        {/* Simulation State */}
        <div className="flex items-center gap-1.5">
          {simulationStatus === 'not_run' && (
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Sim: Not Run</span>
            </span>
          )}
          {simulationStatus === 'running' && (
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold animate-pulse">
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Running {Math.round(simulationProgress)}%</span>
            </span>
          )}
          {simulationStatus === 'complete' && (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Sim: Up to Date</span>
            </span>
          )}
          {simulationStatus === 'stale' && (
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold" title="Parameters were modified since last simulation. Re-run required.">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Sim: Stale (Inputs Changed)</span>
            </span>
          )}
          {simulationStatus === 'failed' && (
            <span className="flex items-center gap-1.5 text-red-400 font-semibold">
              <XCircle className="w-3.5 h-3.5 text-red-400" />
              <span>Sim: Failed</span>
            </span>
          )}
        </div>
      </div>

      {/* CENTER: Key Staffing Peaks */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] text-slate-400">
        <div>
          Gross HC: <span className="font-bold text-white">{totalHC ?? 0}</span>
        </div>
        <div>
          Required Peak: <span className="font-bold text-amber-400">{(requiredPeakHC ?? 0).toFixed(1)}</span>
        </div>
        <div>
          Effective Peak: <span className="font-bold text-cyan-400">{(effectivePeakHC ?? 0).toFixed(1)}</span>
        </div>
      </div>

      {/* RIGHT: Quick Simulation Trigger */}
      <div className="flex items-center gap-2 shrink-0">
        {simulationStatus === 'running' && onCancelSimulation && (
          <button
            type="button"
            onClick={onCancelSimulation}
            className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          onClick={onRunSimulation}
          disabled={simulationStatus === 'running'}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer ${
            simulationStatus === 'running'
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : simulationStatus === 'stale'
              ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title="Run Discrete Event Simulation (DES) Engine"
        >
          {simulationStatus === 'running' ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Simulating...</span>
            </>
          ) : simulationStatus === 'stale' ? (
            <>
              <RotateCw className="w-3.5 h-3.5" />
              <span>RE-RUN SIMULATION</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>RUN SIMULATION</span>
            </>
          )}
        </button>
      </div>
    </footer>
  );
};
