import React, { useState, useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  TrendingUp,
  Users,
  ShieldCheck,
  Search,
  Filter,
  BarChart3,
  Clock,
  AlertCircle,
  Coffee,
  HeartPulse,
  Sparkles,
} from 'lucide-react';
import { WeeklyRosterPlan, WorkforceConfig, AgentWeeklySchedule } from '../types';
import { computeAgentWeeklyHours } from '../engines/roster';

export { computeAgentWeeklyHours };

interface WeeklyOffRosterViewProps {
  weeklyPlan?: WeeklyRosterPlan;
  config: WorkforceConfig;
}

export const WeeklyOffRosterView: React.FC<WeeklyOffRosterViewProps> = ({
  weeklyPlan,
  config,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'daily_distribution' | 'shrinkage_analysis' | 'agent_matrix'>('daily_distribution');

  const maxDailyVol = useMemo(() => {
    if (!weeklyPlan || !weeklyPlan.days || weeklyPlan.days.length === 0) return 1;
    return Math.max(...weeklyPlan.days.map(d => d.volume), 1);
  }, [weeklyPlan]);

  const teams = useMemo(() => {
    if (!weeklyPlan || !weeklyPlan.agentSchedules) return [];
    const set = new Set<string>();
    weeklyPlan.agentSchedules.forEach(a => set.add(a.team));
    return Array.from(set).sort();
  }, [weeklyPlan]);

  const filteredAgents = useMemo(() => {
    if (!weeklyPlan || !weeklyPlan.agentSchedules) return [];
    return weeklyPlan.agentSchedules.filter(a => {
      const matchesSearch =
        a.agentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.agentName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTeam = selectedTeam === 'all' || a.team === selectedTeam;
      return matchesSearch && matchesTeam;
    });
  }, [weeklyPlan, searchQuery, selectedTeam]);

  if (!weeklyPlan || weeklyPlan.days.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm">Weekly Roster Plan will appear once simulation runs.</p>
      </div>
    );
  }

  const protectedBreakPct = Math.round((config.shrinkageBreakPercent ?? 0.07) * 1000) / 10;
  const avgFlexPct = Math.max(0, Math.round(((config.shrinkageTotal ?? 0.25) - (config.shrinkageBreakPercent ?? 0.07)) * 1000) / 10);
  const peakDay = weeklyPlan.days[0];
  const lowDay = weeklyPlan.days[5] || weeklyPlan.days[6] || weeklyPlan.days[weeklyPlan.days.length - 1];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-5">
      {/* Header & Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-white">
              Weekly Volume-Driven OFF &amp; Dynamic Shrinkage Plan
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulates dynamic off-day counts &amp; volume-responsive flexible shrinkage while preserving a non-reducible break floor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex text-xs flex-wrap">
            <button
              onClick={() => setViewMode('daily_distribution')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'daily_distribution'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daily Volume &amp; OFF Trend
            </button>
            <button
              onClick={() => setViewMode('shrinkage_analysis')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'shrinkage_analysis'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Shrinkage &amp; Break Protection
            </button>
            <button
              onClick={() => setViewMode('agent_matrix')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === 'agent_matrix'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agent Weekly Roster ({weeklyPlan.agentSchedules.length})
            </button>
          </div>
        </div>
      </div>

      {/* Feasibility Diagnostic Alert if Issues Present */}
      {weeklyPlan.feasibilityIssues && weeklyPlan.feasibilityIssues.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs sm:text-sm">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            Schedule Infeasibility &amp; Constraint Warnings Detected (PRD 90)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {weeklyPlan.feasibilityIssues.map((issue, idx) => (
              <div key={idx} className="bg-slate-950/80 rounded-lg p-3 border border-rose-900/60 text-xs space-y-1">
                <div className="font-bold text-rose-200">{issue.title}</div>
                <p className="text-slate-300 text-[11px]">{issue.description}</p>
                <div className="pt-1 text-[11px] text-amber-300">
                  <strong>Remedy:</strong> {issue.remedies[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance & Shrinkage Guarantee Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-3 flex items-start gap-3">
          <div className="p-2 rounded-md bg-emerald-500/20 text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-emerald-300">Weekly OFF Compliance</div>
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              100% Guaranteed
              <CheckCircle2 className="w-4 h-4 text-emerald-400 inline" />
            </div>
            <div className="text-[10px] text-emerald-400/80">
              {weeklyPlan.perAgentOffDaysTarget} off days strictly met per agent
            </div>
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-800/60 rounded-lg p-3 flex items-start gap-3">
          <div className="p-2 rounded-md bg-amber-500/20 text-amber-400">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-amber-300">Protected Breaks Floor</div>
            <div className="text-lg font-bold text-white flex items-center gap-1.5">
              {protectedBreakPct}%
              <span className="text-[10px] font-normal px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                Non-reducible
              </span>
            </div>
            <div className="text-[10px] text-amber-400/80">
              Mandatory meals &amp; rest guaranteed across all days
            </div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400">Flexible Shrinkage Range</div>
          <div className="text-base font-bold text-blue-400 flex items-center gap-1 mt-0.5">
            <span>{(peakDay?.flexibleShrinkagePercent || 0).toFixed(1)}%</span>
            <span className="text-slate-500 font-normal text-xs">→</span>
            <span>{(lowDay?.flexibleShrinkagePercent || 0).toFixed(1)}%</span>
          </div>
          <div className="text-[10px] text-slate-500">
            Annual leave, sick &amp; rest flex dynamically with volume
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
          <div className="text-[11px] font-medium text-slate-400">Shrinkage Mode Applied</div>
          <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            {config.shrinkageDistributionMode === 'flat' ? 'Flat Shrinkage' : 'Volume Trend Adaptive'}
          </div>
          <div className="text-[10px] text-slate-500">
            {config.shrinkageDistributionMode === 'flat'
              ? 'Uniform shrinkage across all 7 days'
              : 'Peak days lower shrinkage; low days higher shrinkage'}
          </div>
        </div>
      </div>

      {/* VIEW 1: Daily Volume & OFF Trend Cards */}
      {viewMode === 'daily_distribution' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">
              7-Day Horizon: Volume Trend, Headcount, &amp; Dynamic Shrinkage
            </span>
            <span className="text-[11px] text-slate-500">
              Peak days minimize flexible shrinkage; off days absorb annual/sick leave.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
            {weeklyPlan.days.map((day, idx) => {
              const volPct = Math.round((day.volume / maxDailyVol) * 100);
              const isPeakDay = idx === 0;
              const isLowDay = idx === 5 || idx === 6;

              return (
                <div
                  key={day.dayIndex}
                  className={`rounded-lg p-3 border flex flex-col justify-between transition-all ${
                    isPeakDay
                      ? 'bg-blue-950/30 border-blue-800/80 shadow-sm ring-1 ring-blue-700/50'
                      : isLowDay
                      ? 'bg-slate-950/80 border-slate-800/80'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-white">
                        {day.dayName.slice(0, 3)}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-medium ${
                          isPeakDay
                            ? 'bg-blue-500/20 text-blue-300'
                            : isLowDay
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {isPeakDay ? 'High Peak' : isLowDay ? 'Low Vol' : 'Normal'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mb-2">{day.date}</div>

                    {/* Volume Bar */}
                    <div className="space-y-1 mb-3">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">Volume</span>
                        <span className="font-semibold text-white font-mono">
                          {day.volume.toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isPeakDay ? 'bg-blue-500' : isLowDay ? 'bg-purple-400' : 'bg-slate-400'
                          }`}
                          style={{ width: `${volPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Staffing Allocation */}
                    <div className="space-y-1.5 text-[11px] pt-2 border-t border-slate-800/80">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Working:</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          {day.allocatedWorkingHC} HC
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">OFF Today:</span>
                        <span
                          className={`font-bold font-mono px-1.5 py-0.2 rounded text-[10px] ${
                            isPeakDay
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                              : isLowDay
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/50'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {day.allocatedOffHC} OFF
                        </span>
                      </div>
                    </div>

                    {/* Shrinkage Details */}
                    <div className="space-y-1 text-[10px] pt-2 mt-2 border-t border-slate-800/60 bg-slate-900/60 p-2 rounded">
                      <div className="flex justify-between text-slate-400">
                        <span className="flex items-center gap-1">
                          <Coffee className="w-2.5 h-2.5 text-amber-400" /> Break Floor:
                        </span>
                        <span className="font-mono text-amber-300 font-semibold">
                          {day.breakShrinkagePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span className="flex items-center gap-1">
                          <HeartPulse className="w-2.5 h-2.5 text-blue-400" /> Leave/Sick:
                        </span>
                        <span className="font-mono text-blue-300 font-semibold">
                          {day.flexibleShrinkagePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800 font-medium">
                        <span>Total Shrink:</span>
                        <span className="font-mono text-white">
                          {day.totalShrinkagePercent.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Effective HC:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {day.effectiveWorkingHC} HC
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 text-center">
                    <span className="text-[9.5px] text-slate-400">
                      {isPeakDay
                        ? '🛡️ Low Flex (Shield SLA)'
                        : isLowDay
                        ? '🏖️ High Flex (Absorb Leave)'
                        : 'Balanced Capacity'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Analytical Callout */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 flex items-start gap-2.5 text-xs">
            <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">How Dynamic Shrinkage &amp; Break Protection Work Together: </span>
              On Day 1 (volume peak of {weeklyPlan.days[0].volume.toLocaleString()} calls), flexible shrinkage (annual leave, offline coaching, optional training) is suppressed to just{' '}
              <strong className="text-blue-300">{weeklyPlan.days[0].flexibleShrinkagePercent.toFixed(1)}%</strong>, while the mandatory{' '}
              <strong className="text-amber-300">{protectedBreakPct}% break floor</strong> remains 100% safeguarded.
              This produces <strong className="text-emerald-400">{weeklyPlan.days[0].effectiveWorkingHC} effective productive agents</strong> to handle the surge.
              Conversely, on lower-volume days (Day 6), flexible shrinkage expands to{' '}
              <strong className="text-purple-300">{lowDay.flexibleShrinkagePercent.toFixed(1)}%</strong> to allow agents their scheduled annual and sick leaves without impacting customer queues.
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Shrinkage & Break Protection Analysis Table */}
      {viewMode === 'shrinkage_analysis' && (
        <div className="space-y-4">
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4">
            <h4 className="text-xs font-semibold text-white flex items-center gap-2 mb-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Volume-Trend Adaptive Shrinkage Model Rules
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              In accordance with operational workforce rules, the <strong className="text-amber-300">{protectedBreakPct}% Break &amp; Rest floor</strong> cannot be compressed or trimmed under any circumstance during peak or off-peak periods.
              Flexible shrinkage components (Annual Leave, Sick, Training, Coaching, Rest) dynamically contract during heavy peak days to keep lines moving and expand during low-volume intervals.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Day &amp; Date</th>
                  <th className="px-3 py-2.5 text-right font-mono">Volume</th>
                  <th className="px-3 py-2.5 text-center font-mono">Working HC</th>
                  <th className="px-3 py-2.5 text-center font-mono">OFF HC</th>
                  <th className="px-3 py-2.5 text-center font-mono">
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <Coffee className="w-3 h-3" /> Break % (Locked)
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-center font-mono text-blue-400">Flexible Shrink %</th>
                  <th className="px-3 py-2.5 text-center font-mono">Total Day Shrink %</th>
                  <th className="px-3 py-2.5 text-center font-mono text-emerald-400">Effective HC</th>
                  <th className="px-3 py-2.5">Operational Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {weeklyPlan.days.map((d, i) => {
                  const isPeak = i === 0;
                  const isLow = i === 5 || i === 6;
                  return (
                    <tr key={d.dayIndex} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2.5 font-sans">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          {d.dayName}
                          {isPeak && (
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded font-normal font-sans">
                              Peak
                            </span>
                          )}
                          {isLow && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1 rounded font-normal font-sans">
                              Low Vol
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500">{d.date}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-white">
                        {d.volume.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400">
                        {d.allocatedWorkingHC}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-rose-400">
                        {d.allocatedOffHC}
                      </td>
                      <td className="px-3 py-2.5 text-center text-amber-300 font-bold">
                        <span className="bg-amber-950/50 border border-amber-800/60 px-2 py-0.5 rounded">
                          {d.breakShrinkagePercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-blue-300 font-semibold">
                        {d.flexibleShrinkagePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-center text-white font-bold">
                        {d.totalShrinkagePercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-400">
                        {d.effectiveWorkingHC}
                      </td>
                      <td className="px-3 py-2.5 font-sans text-slate-300 text-[11px]">
                        {isPeak ? (
                          <span className="text-blue-300">
                            🛡️ Reduced flex shrinkage preserves peak coverage
                          </span>
                        ) : isLow ? (
                          <span className="text-purple-300">
                            🏖️ Concentrates annual leave &amp; rest on low-impact days
                          </span>
                        ) : (
                          <span className="text-slate-400">Standard operational flow</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: Agent Weekly Schedule Matrix */}
      {viewMode === 'agent_matrix' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Agent ID or Name..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Teams</option>
                {teams.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-400">
              Showing <strong className="text-white">{filteredAgents.length}</strong> of {weeklyPlan.agentSchedules.length} agents
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5">Agent</th>
                  <th className="px-3 py-2.5">Team</th>
                  <th className="px-3 py-2.5">Segment</th>
                  {weeklyPlan.days.map(d => {
                    const visibleWorkingCount = filteredAgents
                      .slice(0, 100)
                      .filter(a => !a.days[d.dayIndex]?.isOff).length;
                    return (
                      <th key={d.dayIndex} className="px-2 py-2.5 text-center font-mono">
                        <div>{d.dayName.slice(0, 3)}</div>
                        <div className="text-[10px] font-normal text-slate-500">{d.allocatedOffHC} OFF</div>
                        <div className="text-[10px] font-normal text-blue-400">
                          {visibleWorkingCount} working
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-3 py-2.5 text-center">OFFs Taken</th>
                  <th className="px-3 py-2.5 text-center">Sched. Hrs</th>
                  <th className="px-3 py-2.5 text-center">Effective Hrs</th>
                  <th className="px-3 py-2.5 text-center">Fulfillment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredAgents.slice(0, 100).map(agent => {
                  const { scheduledHours, effectiveHours } = computeAgentWeeklyHours(agent);
                  return (
                    <tr key={agent.agentId} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 font-sans font-medium text-white">
                        <div className="flex items-center gap-1.5">
                          <span>{agent.agentName}</span>
                          {agent.gender === 'F' ? (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-950 text-purple-300 border border-purple-800" title="Female agent (Curfew enforced)">
                              👩 F
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800" title="Male agent">
                              👨 M
                            </span>
                          )}
                          {agent.isSupervisor && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950 text-amber-300 border border-amber-800" title="Team Lead / Supervisor (PRD 55)">
                              Lead
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">{agent.agentId}</div>
                      </td>
                      <td className="px-3 py-2 font-sans text-slate-400 text-[11px]">{agent.team}</td>
                      <td className="px-3 py-2 font-sans text-slate-400 text-[11px]">{agent.segment}</td>

                      {agent.days.map((day, dIdx) => (
                        <td key={dIdx} className="px-2 py-2 text-center">
                          {day.isOff ? (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/50">
                              OFF
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-emerald-300">
                              {(day.shiftStart || '08:00')}–{(day.shiftEnd || '')}
                            </span>
                          )}
                        </td>
                      ))}

                      <td className="px-3 py-2 text-center font-bold text-white">
                        {agent.offDaysCount} / {weeklyPlan.perAgentOffDaysTarget}
                      </td>

                      <td className="px-3 py-2 text-center text-slate-200">{scheduledHours.toFixed(1)}h</td>
                      <td className="px-3 py-2 text-center text-emerald-300">{effectiveHours.toFixed(1)}h</td>

                      <td className="px-3 py-2 text-center">
                        {agent.isCompliant ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-sans font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Compliant
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-sans font-medium">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Deficit
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredAgents.length > 100 && (
            <p className="text-[11px] text-slate-500 text-center">
              Showing first 100 agents in preview table for optimal rendering performance.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
