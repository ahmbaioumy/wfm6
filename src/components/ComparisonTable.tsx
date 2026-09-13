import React, { useState, useMemo } from 'react';
import { IntervalResult, AggregationSummary, WorkforceConfig } from '../types';
import { Filter, ArrowUpDown, CheckCircle2, AlertCircle, Calendar, Layers, Clock, TrendingUp } from 'lucide-react';

interface ComparisonTableProps {
  intervalResults: IntervalResult[];
  summary: AggregationSummary | null;
  config: WorkforceConfig;
}

type ViewMode = 'intervals' | 'daily' | 'weekly' | 'monthly' | 'exceptions';

export const ComparisonTable: React.FC<ComparisonTableProps> = ({
  intervalResults,
  summary,
  config,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('intervals');
  const [segmentFilter, setSegmentFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof IntervalResult>('interval');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Extract unique segments
  const segments = useMemo(() => {
    return Array.from(new Set(intervalResults.map(r => r.segment)));
  }, [intervalResults]);

  // Filtered intervals
  const filteredIntervals = useMemo(() => {
    return intervalResults.filter(r => {
      if (segmentFilter !== 'all' && r.segment !== segmentFilter) return false;
      if (viewMode === 'exceptions') {
        return !r.targetMet || r.gap < 0 || r.occupancyPercent > config.maxOccupancyThreshold;
      }
      return true;
    });
  }, [intervalResults, segmentFilter, viewMode, config.maxOccupancyThreshold]);

  // Grouping helper using sum-of-numerators and sum-of-denominators (PRD 31, 39)
  const computeAggregateGroup = (groupKey: string, rows: IntervalResult[]) => {
    let totOff = 0;
    let totAns = 0;
    let totAbn = 0;
    let totShort = 0;
    let totAnsSla = 0;
    let totWait = 0;
    let totBusy = 0;
    let totAvail = 0;
    let totWorkload = 0;
    let totTraffic = 0;
    let totReq = 0;
    let totSched = 0;
    let totEff = 0;
    let maxQ = 0;
    let maxWait = 0;
    let sumAvgQ = 0;

    for (const r of rows) {
      totOff += r.offered;
      totAns += r.answered;
      totAbn += r.abandoned;
      totShort += r.shortAbandoned;
      totAnsSla += r.answeredWithinSla;
      totWait += r.asaSeconds * r.answered;
      totBusy += r.busySeconds;
      totAvail += r.availableSeconds;
      totWorkload += r.workloadSeconds;
      totTraffic += r.trafficErlangs;
      totReq += r.erlangReqHC;
      totSched += r.scheduledHC;
      totEff += r.effectiveHC;
      if (r.maxQueue > maxQ) maxQ = r.maxQueue;
      if (r.maxWaitSeconds > maxWait) maxWait = r.maxWaitSeconds;
      sumAvgQ += r.avgQueue;
    }

    const n = Math.max(1, rows.length);
    const slaDenom = config.excludeShortAbandons ? Math.max(0, totOff - totShort) : totOff;
    const sla = slaDenom > 0 ? (totAnsSla / slaDenom) * 100 : 100;
    const asa = totAns > 0 ? totWait / totAns : 0;
    const ansPct = totOff > 0 ? (totAns / totOff) * 100 : 100;
    const abnDenom = slaDenom;
    const abnNum = config.excludeShortAbandons ? Math.max(0, totAbn - totShort) : totAbn;
    const abnPct = abnDenom > 0 ? (abnNum / abnDenom) * 100 : 0;
    const occDenom = totBusy + totAvail;
    const occ = occDenom > 0 ? Math.min(100, (totBusy / occDenom) * 100) : 0;
    const avgAht = totOff > 0 ? Math.round(totWorkload / totOff) : (rows[0]?.aht || 300);

    return {
      periodKey: groupKey,
      intervalsCount: rows.length,
      segment: segmentFilter === 'all' ? (segments.length === 1 ? segments[0] : 'All') : segmentFilter,
      offered: totOff,
      answered: totAns,
      abandoned: totAbn,
      shortAbandoned: totShort,
      answeredWithinSla: totAnsSla,
      slaPercent: Number(sla.toFixed(1)),
      asaSeconds: Number(asa.toFixed(1)),
      answerPercent: Number(ansPct.toFixed(1)),
      abandonPercent: Number(abnPct.toFixed(1)),
      occupancyPercent: Number(occ.toFixed(1)),
      avgAht,
      trafficErlangs: Number((totTraffic / n).toFixed(1)),
      erlangReqHC: Number((totReq / n).toFixed(1)),
      scheduledHC: Number((totSched / n).toFixed(1)),
      effectiveHC: Number((totEff / n).toFixed(1)),
      gap: Number(((totEff - totReq) / n).toFixed(1)),
      maxQueue: maxQ,
      avgQueue: Number((sumAvgQ / n).toFixed(1)),
      maxWaitSeconds: maxWait,
      targetMet: sla >= config.slaPercentTarget && occ <= config.maxOccupancyThreshold,
    };
  };

  // Daily Aggregation
  const dailyAggregates = useMemo(() => {
    const daysMap = new Map<string, IntervalResult[]>();
    for (const r of filteredIntervals) {
      if (!daysMap.has(r.date)) daysMap.set(r.date, []);
      daysMap.get(r.date)!.push(r);
    }
    return Array.from(daysMap.entries()).map(([date, rows]) => computeAggregateGroup(date, rows));
  }, [filteredIntervals, config, segments, segmentFilter]);

  // Weekly Aggregation
  const weeklyAggregates = useMemo(() => {
    const weeksMap = new Map<string, IntervalResult[]>();
    for (const r of filteredIntervals) {
      const parts = r.date.split(/[-/.]/);
      let dayNum = 1;
      if (parts.length === 3) dayNum = parseInt(parts[0].length === 4 ? parts[2] : parts[0], 10) || 1;
      const weekIdx = Math.floor((dayNum - 1) / 7) + 1;
      const weekKey = `Week ${weekIdx}`;
      if (!weeksMap.has(weekKey)) weeksMap.set(weekKey, []);
      weeksMap.get(weekKey)!.push(r);
    }
    return Array.from(weeksMap.entries()).map(([week, rows]) => computeAggregateGroup(week, rows));
  }, [filteredIntervals, config, segments, segmentFilter]);

  // Monthly Aggregation
  const monthlyAggregates = useMemo(() => {
    const monthsMap = new Map<string, IntervalResult[]>();
    for (const r of filteredIntervals) {
      const parts = r.date.split(/[-/.]/);
      const mKey = parts.length === 3 ? (parts[0].length === 4 ? `${parts[0]}-${parts[1]}` : `${parts[1]}/${parts[2]}`) : 'Month 1';
      if (!monthsMap.has(mKey)) monthsMap.set(mKey, []);
      monthsMap.get(mKey)!.push(r);
    }
    return Array.from(monthsMap.entries()).map(([month, rows]) => computeAggregateGroup(month, rows));
  }, [filteredIntervals, config, segments, segmentFilter]);

  // Sort interval rows
  const sortedIntervals = useMemo(() => {
    const copy = [...filteredIntervals];
    copy.sort((a, b) => {
      const vA = a[sortField];
      const vB = b[sortField];
      if (typeof vA === 'number' && typeof vB === 'number') {
        return sortAsc ? vA - vB : vB - vA;
      }
      return sortAsc ? String(vA).localeCompare(String(vB)) : String(vB).localeCompare(String(vA));
    });
    return copy;
  }, [filteredIntervals, sortField, sortAsc]);

  const handleSort = (field: keyof IntervalResult) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm mb-6">
      {/* Table Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white">The Main Comparison Screen</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
              PRD Section 39 &bull; Aggregations
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Workload &rarr; Erlang Benchmark &rarr; Synthetic Roster &rarr; DES Performance (Strict Numerator/Denominator Math).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segment Filter */}
          {segments.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={segmentFilter}
                onChange={e => setSegmentFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              >
                <option value="all" className="bg-slate-900">All Segments</option>
                {segments.map(s => (
                  <option key={s} value={s} className="bg-slate-900">{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Aggregation Level Tabs */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setViewMode('intervals')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                viewMode === 'intervals' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Intervals
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                viewMode === 'daily' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                viewMode === 'weekly' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded text-xs font-medium transition ${
                viewMode === 'monthly' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setViewMode('exceptions')}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1 ${
                viewMode === 'exceptions' ? 'bg-rose-600 text-white shadow' : 'text-rose-400 hover:text-rose-300'
              }`}
            >
              Exceptions
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate Views (Daily / Weekly / Monthly) */}
      {viewMode !== 'intervals' && viewMode !== 'exceptions' ? (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Period</th>
                <th className="py-2.5 px-3">Segment</th>
                <th className="py-2.5 px-3 text-right">Offered</th>
                <th className="py-2.5 px-3 text-right">Answered</th>
                <th className="py-2.5 px-3 text-right">Abandon</th>
                <th className="py-2.5 px-3 text-right">Short Abn</th>
                <th className="py-2.5 px-3 text-right font-bold text-blue-400">DES SLA</th>
                <th className="py-2.5 px-3 text-right font-bold text-amber-400">DES ASA</th>
                <th className="py-2.5 px-3 text-right">Answer %</th>
                <th className="py-2.5 px-3 text-right">Occupancy</th>
                <th className="py-2.5 px-3 text-right">Erlang Req</th>
                <th className="py-2.5 px-3 text-right">Effective HC</th>
                <th className="py-2.5 px-3 text-right">Avg Queue</th>
                <th className="py-2.5 px-3 text-right">Max Queue</th>
                <th className="py-2.5 px-3 text-center">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {(viewMode === 'daily'
                ? dailyAggregates
                : viewMode === 'weekly'
                ? weeklyAggregates
                : monthlyAggregates
              ).map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-3 font-semibold text-white">{row.periodKey}</td>
                  <td className="py-2 px-3 text-slate-300">{row.segment}</td>
                  <td className="py-2 px-3 text-right text-slate-200">{row.offered.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-emerald-300">{row.answered.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-rose-300">{row.abandoned.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-slate-400">{row.shortAbandoned}</td>
                  <td className={`py-2 px-3 text-right font-bold ${row.slaPercent >= config.slaPercentTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.slaPercent}%
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-amber-400">{row.asaSeconds}s</td>
                  <td className="py-2 px-3 text-right text-slate-300">{row.answerPercent}%</td>
                  <td className={`py-2 px-3 text-right ${row.occupancyPercent > config.maxOccupancyThreshold ? 'text-amber-400 font-semibold' : 'text-slate-300'}`}>
                    {row.occupancyPercent}%
                  </td>
                  <td className="py-2 px-3 text-right text-purple-300 font-semibold">{row.erlangReqHC}</td>
                  <td className="py-2 px-3 text-right text-blue-300 font-semibold">{row.effectiveHC}</td>
                  <td className="py-2 px-3 text-right text-slate-300">{row.avgQueue}</td>
                  <td className="py-2 px-3 text-right text-slate-400">{row.maxQueue}</td>
                  <td className="py-2 px-3 text-center">
                    {row.targetMet ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                        <CheckCircle2 className="w-3 h-3" /> Met
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                        <AlertCircle className="w-3 h-3" /> Missed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Detailed Interval / Exceptions View */
        <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[580px]">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th onClick={() => handleSort('date')} className="py-2.5 px-2.5 cursor-pointer hover:text-white">
                  Date
                </th>
                <th onClick={() => handleSort('interval')} className="py-2.5 px-2.5 cursor-pointer hover:text-white">
                  Interval
                </th>
                <th onClick={() => handleSort('segment')} className="py-2.5 px-2.5 cursor-pointer hover:text-white">
                  Segment
                </th>
                <th onClick={() => handleSort('offered')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  Offered
                </th>
                <th onClick={() => handleSort('aht')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  AHT
                </th>
                <th onClick={() => handleSort('trafficErlangs')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  Erlangs
                </th>
                <th onClick={() => handleSort('erlangReqHC')} className="py-2.5 px-2 text-right text-purple-400 font-bold cursor-pointer hover:text-white">
                  Erlang Req
                </th>
                <th onClick={() => handleSort('scheduledHC')} className="py-2.5 px-2 text-right text-blue-400 font-bold cursor-pointer hover:text-white">
                  Sched HC
                </th>
                <th onClick={() => handleSort('effectiveHC')} className="py-2.5 px-2 text-right text-emerald-400 font-bold cursor-pointer hover:text-white">
                  Eff HC
                </th>
                <th onClick={() => handleSort('gap')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  Gap
                </th>
                <th onClick={() => handleSort('answered')} className="py-2.5 px-2 text-right text-emerald-300 cursor-pointer hover:text-white">
                  Ans
                </th>
                <th onClick={() => handleSort('abandoned')} className="py-2.5 px-2 text-right text-rose-300 cursor-pointer hover:text-white">
                  Abn
                </th>
                <th onClick={() => handleSort('slaPercent')} className="py-2.5 px-2 text-right font-bold text-blue-300 cursor-pointer hover:text-white">
                  DES SLA
                </th>
                <th onClick={() => handleSort('asaSeconds')} className="py-2.5 px-2 text-right font-bold text-amber-400 cursor-pointer hover:text-white">
                  DES ASA
                </th>
                <th onClick={() => handleSort('occupancyPercent')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  Occ %
                </th>
                <th onClick={() => handleSort('avgQueue')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  Avg Q
                </th>
                <th onClick={() => handleSort('maxQueue')} className="py-2.5 px-2 text-right cursor-pointer hover:text-white">
                  Max Q
                </th>
                <th className="py-2.5 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/50">
              {sortedIntervals.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-8 text-center text-slate-500 font-sans text-xs">
                    No intervals matched current filter criteria.
                  </td>
                </tr>
              ) : (
                sortedIntervals.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-1.5 px-2.5 text-slate-300">{row.date}</td>
                    <td className="py-1.5 px-2.5 font-semibold text-white">{row.interval}</td>
                    <td className="py-1.5 px-2.5 text-slate-300">{row.segment}</td>
                    <td className="py-1.5 px-2 text-right text-slate-200">{row.offered}</td>
                    <td className="py-1.5 px-2 text-right text-slate-400">{row.aht}s</td>
                    <td className="py-1.5 px-2 text-right text-slate-300">{row.trafficErlangs}</td>
                    <td className="py-1.5 px-2 text-right text-purple-300 font-semibold">{row.erlangReqHC}</td>
                    <td className="py-1.5 px-2 text-right text-blue-300 font-semibold">{row.scheduledHC}</td>
                    <td className="py-1.5 px-2 text-right text-emerald-300 font-semibold">{row.effectiveHC}</td>
                    <td className={`py-1.5 px-2 text-right font-semibold ${row.gap >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.gap > 0 ? `+${row.gap}` : row.gap}
                    </td>
                    <td className="py-1.5 px-2 text-right text-emerald-300">{row.answered}</td>
                    <td className="py-1.5 px-2 text-right text-rose-300">{row.abandoned}</td>
                    <td className={`py-1.5 px-2 text-right font-bold ${row.slaPercent >= config.slaPercentTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.slaPercent}%
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold text-amber-400">{row.asaSeconds}s</td>
                    <td className={`py-1.5 px-2 text-right ${row.occupancyPercent > config.maxOccupancyThreshold ? 'text-amber-400 font-semibold' : 'text-slate-300'}`}>
                      {row.occupancyPercent}%
                    </td>
                    <td className="py-1.5 px-2 text-right text-slate-300">{row.avgQueue}</td>
                    <td className="py-1.5 px-2 text-right text-slate-400">{row.maxQueue}</td>
                    <td className="py-1.5 px-2 text-center">
                      {row.targetMet ? (
                        <span className="text-emerald-400 font-bold">&bull;</span>
                      ) : (
                        <span className="text-rose-400 font-bold">&times;</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
