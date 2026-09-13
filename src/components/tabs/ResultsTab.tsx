import React, { useState, useMemo } from 'react';
import {
  IntervalResult,
  DemandRow,
  IntervalStaffing,
  WorkforceConfig,
} from '../../types';
import {
  Table,
  Search,
  Filter,
  Download,
  Calendar,
  Layers,
  Clock,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Play,
} from 'lucide-react';

interface ResultsTabProps {
  simulationResults: IntervalResult[] | null;
  demands: DemandRow[];
  intervalStaffing: IntervalStaffing[];
  config: WorkforceConfig;
  onRunSimulation: () => void;
}

export const ResultsTab: React.FC<ResultsTabProps> = ({
  simulationResults,
  demands,
  intervalStaffing,
  config,
  onRunSimulation,
}) => {
  const [subTab, setSubTab] = useState<'interval' | 'daily' | 'weekly' | 'monthly' | 'segment' | 'pool'>('interval');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');

  const hasResults = simulationResults && simulationResults.length > 0;

  // Build combined interval row data
  const intervalRows = useMemo(() => {
    if (!hasResults || !simulationResults) return [];

    return simulationResults.map((res, idx) => {
      const dem = demands[idx] || { volume: 0, ahtSeconds: 0, segment: res.segment, date: res.date };
      const staff = intervalStaffing[idx] || {
        requiredHC: 0,
        scheduledHC: 0,
        effectiveHC: 0,
      };
      const gap = (staff.effectiveHC ?? 0) - (staff.requiredHC ?? 0);
      const timeStr = res.interval || res.intervalStart || '';

      return {
        id: res.id || `${res.date}_${timeStr}_${idx}`,
        date: res.date || '',
        intervalStart: timeStr,
        segment: res.segment || 'General',
        offered: dem.volume ?? res.offered ?? 0,
        ahtSeconds: dem.ahtSeconds ?? res.aht ?? 0,
        requiredHC: staff.requiredHC ?? res.erlangReqHC ?? 0,
        scheduledHC: staff.scheduledHC ?? res.scheduledHC ?? 0,
        effectiveHC: staff.effectiveHC ?? res.effectiveHC ?? 0,
        gap,
        answered: res.answered ?? 0,
        abandoned: res.abandoned ?? 0,
        slaPercent: res.slaPercent ?? 0,
        asaSeconds: res.asaSeconds ?? 0,
        answerPercent: res.answerPercent ?? 0,
        abandonPercent: res.abandonPercent ?? 0,
        occupancyPercent: res.occupancyPercent ?? 0,
        avgQueue: res.avgQueue ?? 0,
        maxQueue: res.maxQueue ?? 0,
        maxWaitSeconds: res.maxWaitSeconds ?? 0,
        // Raw seconds for mathematical aggregation
        answeredWithinSla: res.answeredWithinSla ?? 0,
        shortAbandons: res.shortAbandoned ?? 0,
        totalWaitSecondsAnswered: (res.asaSeconds ?? 0) * (res.answered ?? 0),
        busySeconds: res.busySeconds ?? 0,
        availableSeconds: res.availableSeconds ?? 0,
      };
    });
  }, [simulationResults, demands, intervalStaffing, hasResults]);

  const uniqueDates = useMemo(() => Array.from(new Set(intervalRows.map(r => r.date))), [intervalRows]);
  const uniqueSegments = useMemo(() => Array.from(new Set(intervalRows.map(r => r.segment))), [intervalRows]);

  // Filtered interval rows
  const filteredIntervalRows = useMemo(() => {
    return intervalRows.filter(r => {
      if (selectedDate !== 'all' && r.date !== selectedDate) return false;
      if (selectedSegment !== 'all' && r.segment !== selectedSegment) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.date.toLowerCase().includes(term) ||
          r.intervalStart.toLowerCase().includes(term) ||
          r.segment.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [intervalRows, selectedDate, selectedSegment, searchTerm]);

  // Aggregation Helper: Mathematical reconstruction from raw counts / seconds (NEVER average percentages)
  const aggregateBuckets = (groupByKey: (row: typeof intervalRows[0]) => string, labelHeader: string) => {
    const buckets = new Map<string, {
      key: string;
      intervalCount: number;
      offered: number;
      totalWorkloadSeconds: number;
      sumRequiredHC: number;
      sumScheduledHC: number;
      sumEffectiveHC: number;
      answered: number;
      abandoned: number;
      answeredWithinSla: number;
      shortAbandons: number;
      totalWaitSecondsAnswered: number;
      busySeconds: number;
      availableSeconds: number;
      maxQueue: number;
      maxWaitSeconds: number;
    }>();

    for (const row of intervalRows) {
      const key = groupByKey(row);
      if (!buckets.has(key)) {
        buckets.set(key, {
          key,
          intervalCount: 0,
          offered: 0,
          totalWorkloadSeconds: 0,
          sumRequiredHC: 0,
          sumScheduledHC: 0,
          sumEffectiveHC: 0,
          answered: 0,
          abandoned: 0,
          answeredWithinSla: 0,
          shortAbandons: 0,
          totalWaitSecondsAnswered: 0,
          busySeconds: 0,
          availableSeconds: 0,
          maxQueue: 0,
          maxWaitSeconds: 0,
        });
      }
      const b = buckets.get(key)!;
      b.intervalCount += 1;
      b.offered += row.offered;
      b.totalWorkloadSeconds += row.offered * row.ahtSeconds;
      b.sumRequiredHC += row.requiredHC;
      b.sumScheduledHC += row.scheduledHC;
      b.sumEffectiveHC += row.effectiveHC;
      b.answered += row.answered;
      b.abandoned += row.abandoned;
      b.answeredWithinSla += row.answeredWithinSla;
      b.shortAbandons += row.shortAbandons;
      b.totalWaitSecondsAnswered += row.totalWaitSecondsAnswered;
      b.busySeconds += row.busySeconds;
      b.availableSeconds += row.availableSeconds;
      b.maxQueue = Math.max(b.maxQueue, row.maxQueue);
      b.maxWaitSeconds = Math.max(b.maxWaitSeconds, row.maxWaitSeconds);
    }

    return Array.from(buckets.values()).map(b => {
      const avgAht = b.offered > 0 ? Math.round(b.totalWorkloadSeconds / b.offered) : 0;
      const avgReqHC = b.intervalCount > 0 ? b.sumRequiredHC / b.intervalCount : 0;
      const avgSchHC = b.intervalCount > 0 ? b.sumScheduledHC / b.intervalCount : 0;
      const avgEffHC = b.intervalCount > 0 ? b.sumEffectiveHC / b.intervalCount : 0;

      const denomSla = config.excludeShortAbandons ?? true
        ? Math.max(1, b.answered + b.abandoned - b.shortAbandons)
        : Math.max(1, b.answered + b.abandoned);

      const slaPercent = Math.min(100, Math.max(0, (b.answeredWithinSla / denomSla) * 100));
      const asaSeconds = b.answered > 0 ? b.totalWaitSecondsAnswered / b.answered : 0;
      const totalContacts = b.answered + b.abandoned;
      const answerPercent = totalContacts > 0 ? (b.answered / totalContacts) * 100 : 0;
      const abandonPercent = totalContacts > 0 ? (b.abandoned / totalContacts) * 100 : 0;

      const totalAgentSecs = b.busySeconds + b.availableSeconds;
      const occupancyPercent = totalAgentSecs > 0 ? Math.min(100, (b.busySeconds / totalAgentSecs) * 100) : 0;

      return {
        label: b.key,
        intervalCount: b.intervalCount,
        offered: b.offered,
        avgAht,
        avgReqHC: Math.round(avgReqHC * 10) / 10,
        avgSchHC: Math.round(avgSchHC * 10) / 10,
        avgEffHC: Math.round(avgEffHC * 10) / 10,
        gap: Math.round((avgEffHC - avgReqHC) * 10) / 10,
        answered: b.answered,
        abandoned: b.abandoned,
        slaPercent: Math.round(slaPercent * 10) / 10,
        asaSeconds: Math.round(asaSeconds * 10) / 10,
        answerPercent: Math.round(answerPercent * 10) / 10,
        abandonPercent: Math.round(abandonPercent * 10) / 10,
        occupancyPercent: Math.round(occupancyPercent * 10) / 10,
        maxQueue: b.maxQueue,
        maxWaitSeconds: b.maxWaitSeconds,
      };
    });
  };

  const dailyRows = useMemo(() => aggregateBuckets(r => r.date, 'Date'), [intervalRows, config.excludeShortAbandons]);
  const weeklyRows = useMemo(() => aggregateBuckets(r => {
    // Group roughly by week if multiple days
    const d = r.date;
    return `Week starting ${d}`;
  }, 'Week'), [intervalRows, config.excludeShortAbandons]);
  const monthlyRows = useMemo(() => aggregateBuckets(r => {
    const parts = r.date.split(/[-/.]/);
    return parts.length >= 2 ? `${parts[1]}/${parts[2] || parts[0]}` : r.date;
  }, 'Month'), [intervalRows, config.excludeShortAbandons]);
  const segmentRows = useMemo(() => aggregateBuckets(r => r.segment, 'Segment'), [intervalRows, config.excludeShortAbandons]);
  const poolRows = useMemo(() => aggregateBuckets(r => {
    const segConfig = config.segmentConfigs?.[r.segment];
    return segConfig?.poolId || (segConfig?.allocationType === 'shared' ? 'Shared Pool' : `${r.segment} Dedicated`);
  }, 'Pool'), [intervalRows, config.segmentConfigs, config.excludeShortAbandons]);

  // Export CSV Function
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasResults) {
    return (
      <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-2xl mx-auto my-8">
        <Clock className="w-12 h-12 text-blue-400 mx-auto" />
        <h3 className="text-lg font-bold text-white">No Simulation Results Generated Yet</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          The Discrete Event Simulation (DES) engine has not yet run on the active demand and headcount configuration.
          Click below to run the simulation and generate full interval KPIs, SLA, ASA, and queue analytics.
        </p>
        <button
          type="button"
          onClick={onRunSimulation}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 mx-auto shadow-lg transition cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Run Simulation Now</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Sub-tab Navigation and Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { key: 'interval', label: 'Interval Results' },
            { key: 'daily', label: 'Daily' },
            { key: 'weekly', label: 'Weekly' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'segment', label: 'By Segment' },
            { key: 'pool', label: 'By Pool' },
          ].map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSubTab(item.key as any)}
              className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                subTab === item.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            const dataToExport = subTab === 'interval' ? filteredIntervalRows :
              subTab === 'daily' ? dailyRows :
              subTab === 'weekly' ? weeklyRows :
              subTab === 'monthly' ? monthlyRows :
              subTab === 'segment' ? segmentRows : poolRows;
            exportCSV(dataToExport, `WFM_Results_${subTab}`);
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-blue-400" />
          <span>Export {subTab.toUpperCase()} CSV</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB: INTERVAL RESULTS */}
      {/* ========================================================================= */}
      {subTab === 'interval' && (
        <div className="space-y-3">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search interval, date, segment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
              />
            </div>

            <div className="flex items-center gap-2">
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

              {uniqueSegments.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Segment:</span>
                  <select
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value="all">All Segments ({uniqueSegments.length})</option>
                    {uniqueSegments.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-xs text-left font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Date</th>
                    <th className="px-3 py-2.5">Interval</th>
                    <th className="px-3 py-2.5">Segment</th>
                    <th className="px-3 py-2.5 text-right">Offered</th>
                    <th className="px-3 py-2.5 text-right">AHT</th>
                    <th className="px-3 py-2.5 text-right text-amber-400">Req HC</th>
                    <th className="px-3 py-2.5 text-right text-indigo-300">Sch HC</th>
                    <th className="px-3 py-2.5 text-right font-bold text-cyan-400">Eff HC</th>
                    <th className="px-3 py-2.5 text-right">Answered</th>
                    <th className="px-3 py-2.5 text-right font-bold text-emerald-400">SLA %</th>
                    <th className="px-3 py-2.5 text-right">ASA (s)</th>
                    <th className="px-3 py-2.5 text-right">Answer %</th>
                    <th className="px-3 py-2.5 text-right">Aband %</th>
                    <th className="px-3 py-2.5 text-right font-bold text-amber-300">Occ %</th>
                    <th className="px-3 py-2.5 text-right">Avg Q</th>
                    <th className="px-3 py-2.5 text-right">Max Q</th>
                    <th className="px-3 py-2.5 text-right">Max Wait</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredIntervalRows.slice(0, 500).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-3 py-2 text-white font-medium">{row.date}</td>
                      <td className="px-3 py-2 text-blue-400 font-semibold">{row.intervalStart}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                          {row.segment}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-white">{row.offered}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.ahtSeconds}s</td>
                      <td className="px-3 py-2 text-right text-amber-400">{row.requiredHC.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-indigo-300">{row.scheduledHC.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-cyan-300 font-bold bg-cyan-950/20">{row.effectiveHC.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-white">{row.answered}</td>
                      <td className={`px-3 py-2 text-right font-bold ${row.slaPercent >= config.slaPercentTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {row.slaPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.asaSeconds.toFixed(1)}s</td>
                      <td className="px-3 py-2 text-right text-emerald-400">{row.answerPercent.toFixed(1)}%</td>
                      <td className={`px-3 py-2 text-right ${row.abandonPercent > 5 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                        {row.abandonPercent.toFixed(1)}%
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${row.occupancyPercent > config.maxOccupancyThreshold ? 'text-rose-400' : 'text-amber-300'}`}>
                        {row.occupancyPercent.toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.avgQueue.toFixed(1)}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{row.maxQueue}</td>
                      <td className="px-3 py-2 text-right text-slate-400">{Math.round(row.maxWaitSeconds)}s</td>
                    </tr>
                  ))}
                  {filteredIntervalRows.length === 0 && (
                    <tr>
                      <td colSpan={17} className="px-4 py-8 text-center text-slate-500 font-sans">
                        No interval records match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TABS: AGGREGATED TABLES (DAILY, WEEKLY, MONTHLY, SEGMENT, POOL) */}
      {/* ========================================================================= */}
      {subTab !== 'interval' && (
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">
                    {subTab === 'daily' ? 'Date' :
                     subTab === 'weekly' ? 'Week Horizon' :
                     subTab === 'monthly' ? 'Month' :
                     subTab === 'segment' ? 'Segment / Queue' : 'Resource Pool'}
                  </th>
                  <th className="px-4 py-2.5 text-right">Intervals</th>
                  <th className="px-4 py-2.5 text-right">Total Offered</th>
                  <th className="px-4 py-2.5 text-right">Avg AHT</th>
                  <th className="px-4 py-2.5 text-right text-amber-400">Avg Req HC</th>
                  <th className="px-4 py-2.5 text-right text-indigo-300">Avg Sch HC</th>
                  <th className="px-4 py-2.5 text-right font-bold text-cyan-400">Avg Eff HC</th>
                  <th className="px-4 py-2.5 text-right">Answered</th>
                  <th className="px-4 py-2.5 text-right">Abandoned</th>
                  <th className="px-4 py-2.5 text-right font-bold text-emerald-400">SLA %</th>
                  <th className="px-4 py-2.5 text-right">ASA (s)</th>
                  <th className="px-4 py-2.5 text-right">Answer %</th>
                  <th className="px-4 py-2.5 text-right">Aband %</th>
                  <th className="px-4 py-2.5 text-right font-bold text-amber-300">Occupancy %</th>
                  <th className="px-4 py-2.5 text-right">Max Queue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {(subTab === 'daily' ? dailyRows :
                  subTab === 'weekly' ? weeklyRows :
                  subTab === 'monthly' ? monthlyRows :
                  subTab === 'segment' ? segmentRows : poolRows).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-2.5 text-white font-bold">{row.label}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{row.intervalCount}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-white">{row.offered.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{row.avgAht}s</td>
                    <td className="px-4 py-2.5 text-right text-amber-400">{row.avgReqHC.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right text-indigo-300">{row.avgSchHC.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-cyan-300 bg-cyan-950/20">{row.avgEffHC.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right text-white">{row.answered.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{row.abandoned.toLocaleString()}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${row.slaPercent >= config.slaPercentTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.slaPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{row.asaSeconds.toFixed(1)}s</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400">{row.answerPercent.toFixed(1)}%</td>
                    <td className={`px-4 py-2.5 text-right ${row.abandonPercent > 5 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                      {row.abandonPercent.toFixed(1)}%
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold ${row.occupancyPercent > config.maxOccupancyThreshold ? 'text-rose-400' : 'text-amber-300'}`}>
                      {row.occupancyPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{row.maxQueue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
