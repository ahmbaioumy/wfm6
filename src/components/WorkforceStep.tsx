import React from 'react';
import { Users, Briefcase, CalendarCheck, ShieldAlert } from 'lucide-react';
import { WorkforceConfig } from '../types';

interface WorkforceStepProps {
  config: WorkforceConfig;
  onChange: (updated: Partial<WorkforceConfig>) => void;
  offCount: number;
  workingCount: number;
  onOpenConstraintsModal?: () => void;
}

export const WorkforceStep: React.FC<WorkforceStepProps> = ({
  config,
  onChange,
  offCount,
  workingCount,
  onOpenConstraintsModal,
}) => {
  const femaleCount = Math.round(config.totalHC * ((config.genderFemalePercent ?? 40) / 100));
  const maleCount = config.totalHC - femaleCount;
  const teamCount = Math.ceil(config.totalHC / (config.teamSize || 10));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h2 className="text-sm font-semibold text-white">Workforce &amp; Roster Rules</h2>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenConstraintsModal && (
              <button
                type="button"
                onClick={onOpenConstraintsModal}
                className="text-[11px] px-2.5 py-1 rounded bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800/80 transition font-medium flex items-center gap-1"
                title="Open Team Pods, Female Curfew, Min/Max Shifts, Rest Rules (PRD 46-55)"
              >
                <ShieldAlert className="w-3 h-3 text-purple-400" />
                Schedule Constraints
              </button>
            )}
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {config.totalHC} HC ({workingCount} Active / {offCount} OFF)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Available Headcount (HC)
            </label>
            <input
              type="number"
              min={1}
              max={5000}
              value={config.totalHC ?? 150}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({ totalHC: val });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.totalHC !== undefined && config.totalHC < 1
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.totalHC !== undefined && config.totalHC < 1 && (
              <span className="text-[9px] text-amber-400 block mt-0.5">HC must be &ge; 1</span>
            )}
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Daily Paid Hours
            </label>
            <input
              type="number"
              min={4}
              max={12}
              value={config.dailyPaidHours ?? 8}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({ dailyPaidHours: val });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.dailyPaidHours !== undefined && (config.dailyPaidHours < 1 || config.dailyPaidHours > 24)
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.dailyPaidHours !== undefined && (config.dailyPaidHours < 1 || config.dailyPaidHours > 24) && (
              <span className="text-[9px] text-amber-400 block mt-0.5">1–24 hours</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Working Days / Week
            </label>
            <input
              type="number"
              min={1}
              max={7}
              value={config.workDaysPerWeek ?? 6}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({
                  workDaysPerWeek: val,
                  offDaysPerWeek: typeof val === 'number' && !isNaN(val) ? Math.max(0, 7 - val) : config.offDaysPerWeek,
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              OFF Days / Week (Per Agent)
            </label>
            <input
              type="number"
              min={0}
              max={6}
              value={config.offDaysPerWeek ?? 1}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({
                  offDaysPerWeek: val,
                  workDaysPerWeek: typeof val === 'number' && !isNaN(val) ? Math.max(0, 7 - val) : config.workDaysPerWeek,
                });
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Gender Mix & Curfew Quick Config (PRD 50-51) */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5 p-2 rounded-lg bg-purple-950/20 border border-purple-900/40">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-purple-300">
                Female HC Ratio (%)
              </label>
              <span className="text-[9px] text-purple-400 font-mono">
                {femaleCount}F / {maleCount}M
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              value={config.genderFemalePercent ?? 40}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({ genderFemalePercent: val });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.genderFemalePercent !== undefined && (config.genderFemalePercent < 0 || config.genderFemalePercent > 100)
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-purple-500'
              }`}
            />
            {config.genderFemalePercent !== undefined && (config.genderFemalePercent < 0 || config.genderFemalePercent > 100) && (
              <span className="text-[9px] text-amber-400 block mt-0.5">Ratio must be 0–100%</span>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-purple-300">
                Female Curfew Window
              </label>
              <span className="text-[9px] text-purple-400 font-mono">
                {config.femaleEarliestStart || '06:00'}–{config.femaleLatestFinish || '22:00'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="time"
                value={config.femaleEarliestStart || '06:00'}
                onChange={e => onChange({ femaleEarliestStart: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded px-1.5 py-1.5 text-[11px] text-white focus:border-purple-500 focus:outline-none"
              />
              <span className="text-slate-500 text-xs">-</span>
              <input
                type="time"
                value={config.femaleLatestFinish || '22:00'}
                onChange={e => onChange({ femaleLatestFinish: e.target.value })}
                className="w-1/2 bg-slate-950 border border-slate-800 rounded px-1.5 py-1.5 text-[11px] text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Team-Based Scheduling Quick Config (PRD 52-55) */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5 p-2 rounded-lg bg-blue-950/20 border border-blue-900/40">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-blue-300">
                Team Size (Agents/Pod)
              </label>
              <span className="text-[9px] text-blue-400 font-mono">
                {teamCount} Teams
              </span>
            </div>
            <input
              type="number"
              min={2}
              max={50}
              value={config.teamSize || 10}
              onChange={e => onChange({ teamSize: Math.max(2, parseInt(e.target.value, 10) || 10) })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-blue-300">
                Team Shift Flexibility
              </label>
              <span className="text-[9px] text-blue-400 font-mono">
                &plusmn;{config.teamShiftFlexibilityHours || 2}h pod
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={6}
              value={config.teamShiftFlexibilityHours || 2}
              onChange={e => onChange({ teamShiftFlexibilityHours: Math.max(0, parseInt(e.target.value, 10) || 2) })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="mb-2.5">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-[11px] font-medium text-slate-400">
              Weekly OFF Strategy (Volume / FCT Trend)
            </label>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded">
              100% Weekly Fulfilled
            </span>
          </div>
          <select
            value={config.offDistributionMode || 'dynamic_volume_trend'}
            onChange={e => onChange({ offDistributionMode: e.target.value as 'dynamic_volume_trend' | 'flat_rotation' })}
            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          >
            <option value="dynamic_volume_trend">
              Dynamic Volume Trend (Peak Days = Fewer OFFs, Low Days = More OFFs)
            </option>
            <option value="flat_rotation">
              Flat Rotation (Equal OFFs Every Day)
            </option>
          </select>
          <p className="text-[10px] text-slate-500 mt-1">
            Guarantees each agent receives exactly {config.offDaysPerWeek} OFF days/week; no agent works without off.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Shift Start Step
            </label>
            <select
              value={config.shiftStartStepMinutes}
              onChange={e => onChange({ shiftStartStepMinutes: parseInt(e.target.value, 10) })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes (Standard)</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Minimum Coverage
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.minCoverage ?? 1}
              onChange={e => {
                const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                onChange({ minCoverage: val });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.minCoverage !== undefined && config.minCoverage < 0
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.minCoverage !== undefined && config.minCoverage < 0 && (
              <span className="text-[9px] text-amber-400 block mt-0.5">&ge; 0</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-slate-400">
                Breaks % (Must / Protected)
              </label>
              <span className="text-[9px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1 rounded">
                Non-reducible
              </span>
            </div>
            <input
              type="number"
              min={1}
              max={30}
              value={config.shrinkageBreakPercent !== undefined ? Math.round(config.shrinkageBreakPercent * 100) : 7}
              onChange={e => {
                const raw = e.target.value === '' ? ('' as any) : Number(e.target.value);
                const b = typeof raw === 'number' ? raw / 100 : (raw as any);
                onChange({ shrinkageBreakPercent: b });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.shrinkageBreakPercent !== undefined && (config.shrinkageBreakPercent < 0 || config.shrinkageBreakPercent > 0.5)
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.shrinkageBreakPercent !== undefined && (config.shrinkageBreakPercent < 0 || config.shrinkageBreakPercent > 0.5) && (
              <span className="text-[9px] text-amber-400 block mt-0.5">Valid range: 0–50%</span>
            )}
            <p className="text-[10px] text-slate-500 mt-0.5">
              Guaranteed rest/meal floor during all peak &amp; low days.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-medium text-slate-400">
                Total Shrinkage (%)
              </label>
              <span className="text-[9px] text-blue-400 bg-blue-950/60 border border-blue-800/60 px-1 rounded">
                Flex: {Math.max(0, Math.round(((config.shrinkageTotal ?? 0.25) - (config.shrinkageBreakPercent ?? 0.07)) * 100))}%
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={80}
              value={config.shrinkageTotal !== undefined ? Math.round(config.shrinkageTotal * 100) : 25}
              onChange={e => {
                const raw = e.target.value === '' ? ('' as any) : Number(e.target.value);
                const tot = typeof raw === 'number' ? raw / 100 : (raw as any);
                onChange({ shrinkageTotal: tot });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.shrinkageTotal !== undefined && (config.shrinkageTotal < (config.shrinkageBreakPercent ?? 0.07) || config.shrinkageTotal > 0.9)
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.shrinkageTotal !== undefined && config.shrinkageTotal < (config.shrinkageBreakPercent ?? 0.07) && (
              <span className="text-[9px] text-amber-400 block mt-0.5">Must be &ge; Break % ({Math.round((config.shrinkageBreakPercent ?? 0.07) * 100)}%)</span>
            )}
            <p className="text-[10px] text-slate-500 mt-0.5">
              Annual leave, sick, &amp; rest flex dynamically around volume.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Shrinkage Volume Strategy
            </label>
            <select
              value={config.shrinkageDistributionMode || 'dynamic_volume_trend'}
              onChange={e => onChange({ shrinkageDistributionMode: e.target.value as 'dynamic_volume_trend' | 'flat' })}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="dynamic_volume_trend">Dynamic (Peak = Low Flex, Weekend = High Flex)</option>
              <option value="flat">Flat Shrinkage (Equal Every Day)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Schedule Adherence (%)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.adherence !== undefined ? Math.round(config.adherence * 100) : 90}
              onChange={e => {
                const raw = e.target.value === '' ? ('' as any) : Number(e.target.value);
                const adh = typeof raw === 'number' ? raw / 100 : (raw as any);
                onChange({ adherence: adh });
              }}
              className={`w-full bg-slate-950 border rounded px-2.5 py-1.5 text-xs text-white focus:outline-none ${
                config.adherence !== undefined && (config.adherence < 0.1 || config.adherence > 1)
                  ? 'border-amber-500 text-amber-300'
                  : 'border-slate-800 focus:border-blue-500'
              }`}
            />
            {config.adherence !== undefined && (config.adherence < 0.1 || config.adherence > 1) && (
              <span className="text-[9px] text-amber-400 block mt-0.5">Range: 10–100%</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <span className="text-slate-400 block flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-500" /> Active Roster Pool
          </span>
          <span className="text-white font-semibold text-sm">{workingCount} agents working</span>
        </div>
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <span className="text-slate-400 block flex items-center gap-1">
            <CalendarCheck className="w-3 h-3 text-slate-500" /> Rotational OFF
          </span>
          <span className="text-white font-semibold text-sm">{offCount} agents off</span>
        </div>
      </div>
    </div>
  );
};
