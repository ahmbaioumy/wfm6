import React from 'react';
import { Target, Shuffle, Timer, Sliders, ShieldCheck } from 'lucide-react';
import { WorkforceConfig, ArrivalMode, ServiceTimeDist, PatienceDist, QueueAttribution, ErlangModelType, QueueClosureBehavior } from '../types';

interface OperationalRulesStepProps {
  config: WorkforceConfig;
  onChange: (updated: Partial<WorkforceConfig>) => void;
}

export const OperationalRulesStep: React.FC<OperationalRulesStepProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h2 className="text-sm font-semibold text-white">DES Engine Assumptions</h2>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
            {config.slaPercentTarget}% in {config.slaThresholdSeconds}s
          </span>
        </div>

        {/* SLA & Patience Row */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Target SLA (% / sec)
            </label>
            <div className="flex gap-1.5">
              <div className="w-3/5">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.slaPercentTarget ?? 90}
                  onChange={e => {
                    const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                    onChange({ slaPercentTarget: val });
                  }}
                  className={`w-full bg-slate-950 border rounded px-2 py-1.5 text-xs text-white focus:outline-none ${
                    config.slaPercentTarget !== undefined && (config.slaPercentTarget < 1 || config.slaPercentTarget > 100)
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 focus:border-blue-500'
                  }`}
                />
                {config.slaPercentTarget !== undefined && (config.slaPercentTarget < 1 || config.slaPercentTarget > 100) && (
                  <span className="text-[9px] text-amber-400 block mt-0.5">Range: 1–100%</span>
                )}
              </div>
              <div className="w-2/5">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={config.slaThresholdSeconds ?? 20}
                  onChange={e => {
                    const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                    onChange({ slaThresholdSeconds: val });
                  }}
                  className={`w-full bg-slate-950 border rounded px-2 py-1.5 text-xs text-white focus:outline-none ${
                    config.slaThresholdSeconds !== undefined && config.slaThresholdSeconds < 1
                      ? 'border-amber-500 text-amber-300'
                      : 'border-slate-800 focus:border-blue-500'
                  }`}
                />
                {config.slaThresholdSeconds !== undefined && config.slaThresholdSeconds < 1 && (
                  <span className="text-[9px] text-amber-400 block mt-0.5">&ge; 1s</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Customer Patience (sec)
            </label>
            <input
              type="number"
              min={10}
              max={1800}
              value={config.defaultPatienceSeconds ?? 120}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({ defaultPatienceSeconds: val });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.defaultPatienceSeconds !== undefined && config.defaultPatienceSeconds < 1
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.defaultPatienceSeconds !== undefined && config.defaultPatienceSeconds < 1 && (
              <span className="text-[9px] text-amber-400 block mt-0.5">Patience must be &ge; 1s</span>
            )}
          </div>
        </div>

        {/* Erlang Model & Queue Closure */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Erlang Benchmark Model
            </label>
            <select
              value={config.erlangModel || 'erlang_c'}
              onChange={e => onChange({ erlangModel: e.target.value as ErlangModelType })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="erlang_c">Erlang C (Infinite Queue)</option>
              <option value="erlang_a">Erlang A (With Reneging)</option>
              <option value="erlang_b">Erlang B (Blocking Loss)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Queue Closure Rule
            </label>
            <select
              value={config.queueClosureBehavior || 'finish_queued'}
              onChange={e => onChange({ queueClosureBehavior: e.target.value as QueueClosureBehavior })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="finish_queued">Finish Queued Calls (Default)</option>
              <option value="abandon_at_closure">Abandon at Closure</option>
              <option value="carry_forward">Carry Forward to Next Day</option>
              <option value="overtime_clearance">Overtime Clearance</option>
            </select>
          </div>
        </div>

        {/* Arrival & Service Time Distributions */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Arrival Mode
            </label>
            <select
              value={config.arrivalMode}
              onChange={e => onChange({ arrivalMode: e.target.value as ArrivalMode })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="fixed_forecast">Fixed Forecast (Exact Count)</option>
              <option value="poisson_uncertainty">Poisson Uncertainty</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Service Time (AHT)
            </label>
            <select
              value={config.serviceTimeDist}
              onChange={e => onChange({ serviceTimeDist: e.target.value as ServiceTimeDist })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="fixed">Fixed Duration (Uploaded AHT)</option>
              <option value="lognormal">Lognormal (CV 0.50)</option>
              <option value="exponential">Exponential (M/M/c)</option>
            </select>
          </div>
        </div>

        {/* Patience Distribution & Concurrency */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Patience Distribution
            </label>
            <select
              value={config.patienceDist}
              onChange={e => onChange({ patienceDist: e.target.value as PatienceDist })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="fixed">Fixed Patience</option>
              <option value="exponential">Exponential (Erlang A)</option>
              <option value="lognormal">Lognormal (Realistic)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Chat Concurrency (Slots)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={config.chatConcurrency ?? 1}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({ chatConcurrency: val });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.chatConcurrency !== undefined && config.chatConcurrency < 1
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.chatConcurrency !== undefined && config.chatConcurrency < 1 && (
              <span className="text-[9px] text-amber-400 block mt-0.5">&ge; 1 slot</span>
            )}
          </div>
        </div>

        {/* Short Abandon Threshold & Exclusion */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-[11px]">
              <input
                type="checkbox"
                checked={config.excludeShortAbandons}
                onChange={e => onChange({ excludeShortAbandons: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-0"
              />
              <span>Exclude short abandons (&le; {config.shortAbandonThresholdSeconds ?? 5}s)</span>
            </label>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">Threshold:</span>
              <input
                type="number"
                min={0}
                max={60}
                value={config.shortAbandonThresholdSeconds ?? 5}
                onChange={e => {
                  const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                  onChange({ shortAbandonThresholdSeconds: val });
                }}
                className="w-12 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-white text-center focus:border-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-500">s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <span className="text-slate-400 block flex items-center gap-1">
            <Shuffle className="w-3 h-3 text-slate-500" /> Monte Carlo Runs
          </span>
          <span className="text-white font-semibold text-sm">{config.monteCarloRuns} Reps (Seed {config.seed})</span>
        </div>
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <span className="text-slate-400 block flex items-center gap-1">
            <Target className="w-3 h-3 text-slate-500" /> Max Occupancy Cap
          </span>
          <span className="text-white font-semibold text-sm">{config.maxOccupancyThreshold}% threshold</span>
        </div>
      </div>
    </div>
  );
};
