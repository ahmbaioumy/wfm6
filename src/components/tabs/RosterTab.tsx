import React, { useState, useMemo } from 'react';
import {
  SyntheticAgent,
  WeeklyRosterPlan,
  WorkforceConfig,
} from '../../types';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  UserCheck,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { BarChartSvg } from '../common/SimpleSvgCharts';

interface RosterTabProps {
  rosterPlan: WeeklyRosterPlan;
  config: WorkforceConfig;
}

export const RosterTab: React.FC<RosterTabProps> = ({
  rosterPlan,
  config,
}) => {
  const [subTab, setSubTab] = useState<'agents' | 'shifts' | 'teams' | 'validation'>('agents');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const agentSchedules = rosterPlan.agentSchedules || [];
  const days = rosterPlan.days || [];
  const uniqueDates = useMemo(() => days.map(d => d.date), [days]);
  const uniqueTeams = useMemo(() => Array.from(new Set(agentSchedules.map(a => a.team))), [agentSchedules]);

  // Flatten agent schedules by date for table viewing
  const flatSchedules = useMemo(() => {
    const list: Array<{
      agentId: string;
      agentName: string;
      date: string;
      team: string;
      gender: 'M' | 'F';
      segment: string;
      isOff: boolean;
      shiftStart: string;
      shiftEnd: string;
      breakStart: string;
      breakEnd: string;
      paidHours: number;
    }> = [];

    for (const a of agentSchedules) {
      for (const d of a.days || []) {
        const firstBreak = d.breaks?.[0];
        list.push({
          agentId: a.agentId,
          agentName: a.agentName,
          date: d.date,
          team: a.team,
          gender: a.gender,
          segment: a.segment,
          isOff: d.isOff ?? false,
          shiftStart: d.shiftStart ?? '--',
          shiftEnd: d.shiftEnd ?? '--',
          breakStart: firstBreak?.start ?? '--',
          breakEnd: firstBreak?.end ?? '--',
          paidHours: d.isOff ? 0 : config.dailyPaidHours,
        });
      }
    }
    return list;
  }, [agentSchedules, config.dailyPaidHours]);

  // Filtered agent schedules
  const filteredSchedules = useMemo(() => {
    return flatSchedules.filter(item => {
      if (selectedDate !== 'all' && item.date !== selectedDate) return false;
      if (selectedTeam !== 'all' && item.team !== selectedTeam) return false;
      if (selectedGender !== 'all' && item.gender !== selectedGender) return false;
      if (selectedStatus === 'working' && item.isOff) return false;
      if (selectedStatus === 'off' && !item.isOff) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.agentId.toLowerCase().includes(term) ||
          item.agentName.toLowerCase().includes(term) ||
          item.team.toLowerCase().includes(term) ||
          item.segment.toLowerCase().includes(term) ||
          item.shiftStart.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [flatSchedules, selectedDate, selectedTeam, selectedGender, selectedStatus, searchTerm]);

  // Shift start distribution chart data
  const shiftDistributionData = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const item of flatSchedules) {
      if (!item.isOff && item.shiftStart !== '--') {
        countMap.set(item.shiftStart, (countMap.get(item.shiftStart) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([start, count]) => ({
        label: start,
        value: count,
        color: '#6366f1',
      }));
  }, [flatSchedules]);

  // Team summary data
  const teamSummaries = useMemo(() => {
    const map = new Map<string, { team: string; totalAgents: number; femaleCount: number; maleCount: number }>();
    for (const a of agentSchedules) {
      if (!map.has(a.team)) {
        map.set(a.team, { team: a.team, totalAgents: 0, femaleCount: 0, maleCount: 0 });
      }
      const entry = map.get(a.team)!;
      entry.totalAgents += 1;
      if (a.gender === 'F') entry.femaleCount += 1;
      else entry.maleCount += 1;
    }
    return Array.from(map.values());
  }, [agentSchedules]);

  // Feasibility Audit Violations
  const violations = rosterPlan.feasibilityIssues || [];

  return (
    <div className="space-y-4 pb-8">
      {/* Sub-tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setSubTab('agents')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              subTab === 'agents' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Agent Roster ({agentSchedules.length} Agents)
          </button>
          <button
            type="button"
            onClick={() => setSubTab('shifts')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              subTab === 'shifts' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Shift Distribution
          </button>
          <button
            type="button"
            onClick={() => setSubTab('teams')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              subTab === 'teams' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Teams ({teamSummaries.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('validation')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
              subTab === 'validation' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Roster Validation</span>
            {violations.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500/30 text-amber-300 text-[10px] font-mono">
                {violations.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono hidden md:block">
          {agentSchedules.length} synthetic agents · {config.dailyPaidHours}h shifts · {config.workDaysPerWeek} work days
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: AGENT ROSTER TABLE */}
      {/* ========================================================================= */}
      {subTab === 'agents' && (
        <div className="space-y-3">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search agent ID, team, segment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Date:</span>
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="all">All Dates ({uniqueDates.length})</option>
                  {uniqueDates.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Team:</span>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="all">All Teams</option>
                  {uniqueTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Gender:</span>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="all">All</option>
                  <option value="F">Female (F)</option>
                  <option value="M">Male (M)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                >
                  <option value="all">All</option>
                  <option value="working">Working Shifts</option>
                  <option value="off">OFF Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Roster Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-xs text-left font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Agent ID</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Team</th>
                    <th className="px-4 py-2.5">Gender</th>
                    <th className="px-4 py-2.5">Queue Skill</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Shift Window</th>
                    <th className="px-4 py-2.5">Protected Break</th>
                    <th className="px-4 py-2.5 text-right">Paid Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredSchedules.slice(0, 500).map((row, idx) => (
                    <tr key={`${row.agentId}_${row.date}_${idx}`} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-2 text-white font-bold">{row.agentId}</td>
                      <td className="px-4 py-2 text-slate-300">{row.date}</td>
                      <td className="px-4 py-2 text-slate-400">{row.team}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${row.gender === 'F' ? 'bg-pink-950 text-pink-300 border border-pink-800' : 'bg-blue-950 text-blue-300 border border-blue-800'}`}>
                          {row.gender}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                          {row.segment}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {row.isOff ? (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            OFF
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            WORKING
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-blue-400 font-semibold">
                        {row.isOff ? '--' : `${row.shiftStart} – ${row.shiftEnd}`}
                      </td>
                      <td className="px-4 py-2 text-purple-300">
                        {row.isOff || row.breakStart === '--' ? '--' : `${row.breakStart} – ${row.breakEnd}`}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-white">{row.paidHours}h</td>
                    </tr>
                  ))}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500 font-sans">
                        No agent records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredSchedules.length > 500 && (
              <div className="px-4 py-2 bg-slate-950 text-slate-500 text-[11px] border-t border-slate-800 font-sans">
                Showing first 500 roster rows of {filteredSchedules.length}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: SHIFT DISTRIBUTION */}
      {/* ========================================================================= */}
      {subTab === 'shifts' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">Shift Start Time Distribution</h3>
              <p className="text-xs text-slate-400">Number of agent shifts staggered across operating hours</p>
            </div>
            <BarChartSvg
              data={shiftDistributionData}
              height={260}
              positiveColor="#6366f1"
              valueFormatter={(v) => `${v} Agents`}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: TEAMS */}
      {/* ========================================================================= */}
      {subTab === 'teams' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {teamSummaries.map(t => (
            <div key={t.team} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-white">{t.team}</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs">
                  {t.totalAgents} Agents
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Female Agents:</span>
                  <span className="text-pink-300 font-bold">{t.femaleCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Male Agents:</span>
                  <span className="text-blue-300 font-bold">{t.maleCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: ROSTER VALIDATION */}
      {/* ========================================================================= */}
      {subTab === 'validation' && (
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Labor Law &amp; Operational Feasibility Audit</span>
            </h3>
            <p className="text-xs text-slate-400">
              Auditing minimum rest hours ({config.minRestHoursBetweenShifts ?? 12}h), max consecutive work days ({config.maxConsecutiveWorkDays ?? 6}), and female curfew rules.
            </p>
          </div>

          {violations.length > 0 ? (
            <div className="space-y-2">
              {violations.map((v, i) => (
                <div key={i} className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-200 text-xs flex items-start gap-2.5">
                  <span className="font-mono text-amber-400 shrink-0">#{i + 1}</span>
                  <div>
                    <div className="font-semibold text-white">{v.title}</div>
                    <div className="text-[11px] text-slate-300 mt-0.5">{v.description}</div>
                    {v.remedies && v.remedies.length > 0 && (
                      <div className="text-[10px] text-amber-300/80 mt-1">
                        💡 Remedy: {v.remedies.join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/50 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Zero policy violations! Roster satisfies all rest periods, team alignment, and labor constraints.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
