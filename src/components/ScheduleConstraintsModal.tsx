import React from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  Users,
  Clock,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { WorkforceConfig, FeasibilityIssue } from '../types';

interface ScheduleConstraintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WorkforceConfig;
  onChange: (updated: Partial<WorkforceConfig>) => void;
  feasibilityIssues?: FeasibilityIssue[];
  onRerunSimulation?: () => void;
}

export const ScheduleConstraintsModal: React.FC<ScheduleConstraintsModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
  feasibilityIssues = [],
  onRerunSimulation,
}) => {
  if (!isOpen) return null;

  const femaleCount = Math.round(config.totalHC * ((config.genderFemalePercent ?? 40) / 100));
  const maleCount = config.totalHC - femaleCount;
  const teamCount = Math.ceil(config.totalHC / (config.teamSize || 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 my-8 text-slate-100 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Schedule Constraints &amp; Policy Rules
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-purple-950 text-purple-300 border border-purple-800">
                  PRD Sections 46–55, 89–91
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Configure team structures, female labor law constraints, min/max shift bounds, rest rules, and supervisor alignment.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto pr-1 space-y-6 py-4 flex-1">
          {/* Feasibility Diagnostic Banner (PRD Section 90) */}
          {feasibilityIssues.length > 0 ? (
            <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Schedule Infeasibility &amp; Constraint Conflict Detected (PRD 90)
              </div>
              {feasibilityIssues.map((issue, idx) => (
                <div key={idx} className="bg-slate-950/80 rounded-lg p-3 border border-rose-900/60 space-y-2">
                  <div className="text-xs font-bold text-rose-200">{issue.title}</div>
                  <p className="text-xs text-slate-300">{issue.description}</p>
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[11px] font-semibold text-amber-300 block mb-1">
                      Actionable Remedies:
                    </span>
                    <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5">
                      {issue.remedies.map((rem, rIdx) => (
                        <li key={rIdx}>{rem}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  All hard scheduling constraints feasible. Night staffing pool ({maleCount} male agents) satisfies curfew coverage and rest policies.
                </span>
              </div>
              <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                100% Compliant
              </span>
            </div>
          )}

          {/* Section 1: Gender Mix & Female Labor Constraints (PRD 50, 51) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                1. Gender Mix &amp; Female Labor Constraints (PRD 50 &amp; 51)
              </h3>
              <span className="text-[10px] text-slate-400">
                Policy Classification: <strong className="text-purple-300">HARD Constraint</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Female Headcount Ratio (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.genderFemalePercent ?? 40}
                    onChange={e => onChange({ genderFemalePercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-xs font-mono text-slate-400 shrink-0">
                    {femaleCount} 👩 / {maleCount} 👨
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Synthetic roster generates exact {femaleCount} female and {maleCount} male agents.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Earliest Female Start
                </label>
                <input
                  type="time"
                  value={config.femaleEarliestStart || '06:00'}
                  onChange={e => onChange({ femaleEarliestStart: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Female agents cannot start prior to this hour.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Latest Female Finish (Curfew)
                </label>
                <input
                  type="time"
                  value={config.femaleLatestFinish || '22:00'}
                  onChange={e => onChange({ femaleLatestFinish: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Night shifts past this hour allocated exclusively to male staff.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Female Min Shift Length (Hours)
                </label>
                <input
                  type="number"
                  min={4}
                  max={10}
                  value={config.femaleMinShiftHours || 6}
                  onChange={e => onChange({ femaleMinShiftHours: Math.max(4, parseInt(e.target.value, 10) || 6) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Female Max Shift Length (Hours)
                </label>
                <input
                  type="number"
                  min={4}
                  max={12}
                  value={config.femaleMaxShiftHours || 8}
                  onChange={e => onChange({ femaleMaxShiftHours: Math.max(4, parseInt(e.target.value, 10) || 8) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Enforcement Strictness
                </label>
                <select
                  value={config.femaleConstraintStrict ? 'hard' : 'soft'}
                  onChange={e => onChange({ femaleConstraintStrict: e.target.value === 'hard' })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="hard">HARD Constraint (Never Violate Curfew)</option>
                  <option value="soft">SOFT Constraint (High Penalty Weight)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Team-Based Scheduling (PRD 52-55) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                2. Team-Based Scheduling &amp; Pod Rules (PRD 52–55)
              </h3>
              <span className="text-[10px] text-slate-400">
                {teamCount} Teams Generated (Team A – {String.fromCharCode(65 + Math.min(25, teamCount - 1))})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Size (Agents per Team)
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={config.teamSize || 10}
                  onChange={e => onChange({ teamSize: Math.max(2, parseInt(e.target.value, 10) || 10) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {config.totalHC} HC divided into pods of ~{config.teamSize || 10} agents.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Shift Flexibility (Hours)
                </label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={config.teamShiftFlexibilityHours || 2}
                  onChange={e => onChange({ teamShiftFlexibilityHours: Math.max(0, parseInt(e.target.value, 10) || 2) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Max shift start variation between members of the same pod (e.g. 2h).
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team OFF-Day Deviation Allowance (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={config.teamOffDeviationPercent || 20}
                  onChange={e => onChange({ teamOffDeviationPercent: Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 20)) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {100 - (config.teamOffDeviationPercent || 20)}% of pod share identical weekly OFF days.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={config.enforceTeamOfficerShift ?? true}
                  onChange={e => onChange({ enforceTeamOfficerShift: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-800 text-blue-600 focus:ring-0"
                />
                <span>
                  <strong>Enforce Team Leader / Officer Rule (PRD 55):</strong> Team supervisors automatically scheduled to majority active pod shift start.
                </span>
              </label>
            </div>
          </div>

          {/* Section 3: Shift Length, Rest & Consecutive Work Rules (PRD 46-48) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              3. Shift Length, Rest &amp; Consecutive Working Days (PRD 46–48)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Min Shift Length (Hours)
                </label>
                <input
                  type="number"
                  min={4}
                  max={10}
                  value={config.minShiftHours || 6}
                  onChange={e => onChange({ minShiftHours: Math.max(4, parseInt(e.target.value, 10) || 6) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Max Shift Length (Hours)
                </label>
                <input
                  type="number"
                  min={6}
                  max={14}
                  value={config.maxShiftHours || 10}
                  onChange={e => onChange({ maxShiftHours: Math.max(6, parseInt(e.target.value, 10) || 10) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Min Rest Between Shifts (Hours)
                </label>
                <input
                  type="number"
                  min={8}
                  max={16}
                  value={config.minRestHoursBetweenShifts || 12}
                  onChange={e => onChange({ minRestHoursBetweenShifts: Math.max(8, parseInt(e.target.value, 10) || 12) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Max Consecutive Work Days
                </label>
                <input
                  type="number"
                  min={3}
                  max={7}
                  value={config.maxConsecutiveWorkDays || 6}
                  onChange={e => onChange({ maxConsecutiveWorkDays: Math.max(3, parseInt(e.target.value, 10) || 6) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={config.requireConsecutiveOff ?? true}
                  onChange={e => onChange({ requireConsecutiveOff: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-800 text-emerald-600 focus:ring-0"
                />
                <span>Consecutive OFF days required when &ge; 2 OFFs</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={config.allowOvertime ?? false}
                  onChange={e => onChange({ allowOvertime: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-800 text-emerald-600 focus:ring-0"
                />
                <span>Allow Overtime (PRD 78)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            Assumptions dynamically update the Roster and DES engine without losing uploaded data.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onChange({
                  genderFemalePercent: 40,
                  femaleEarliestStart: '06:00',
                  femaleLatestFinish: '22:00',
                  femaleMinShiftHours: 6,
                  femaleMaxShiftHours: 8,
                  femaleConstraintStrict: true,
                  teamSize: 10,
                  teamShiftFlexibilityHours: 2,
                  teamOffDeviationPercent: 20,
                  enforceTeamOfficerShift: true,
                  minRestHoursBetweenShifts: 12,
                  minConsecutiveWorkDays: 2,
                  maxConsecutiveWorkDays: 6,
                  requireConsecutiveOff: true,
                });
              }}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              Reset to PRD Defaults
            </button>
            <button
              onClick={() => {
                onClose();
                if (onRerunSimulation) onRerunSimulation();
              }}
              className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-md transition flex items-center gap-1.5"
            >
              Apply &amp; Re-Solve Roster
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
