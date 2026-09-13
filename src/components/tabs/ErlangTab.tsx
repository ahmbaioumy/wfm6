import React, { useState, useMemo } from 'react';
import {
  DemandRow,
  IntervalStaffing,
  WorkforceConfig,
} from '../../types';
import {
  Calculator,
  Search,
  Filter,
  Info,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  CheckCircle2,
} from 'lucide-react';

interface ErlangTabProps {
  demands: DemandRow[];
  intervalStaffing: IntervalStaffing[];
  config: WorkforceConfig;
  onNavigateToTab?: (tabKey: string) => void;
}

export const ErlangTab: React.FC<ErlangTabProps> = ({
  demands,
  intervalStaffing,
  config,
  onNavigateToTab,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');

  const uniqueDates = useMemo(() => Array.from(new Set(intervalStaffing.map(s => s.date || ''))), [intervalStaffing]);
  const uniqueSegments = useMemo(() => Array.from(new Set(intervalStaffing.map(s => s.segment || ''))), [intervalStaffing]);

  // Combine demands with interval staffing calculations
  const combinedRows = useMemo(() => {
    return intervalStaffing.map((staff, idx) => {
      const dem = demands[idx] || {
        volume: 0,
        ahtSeconds: 0,
        trafficErlangs: 0,
        workloadSeconds: 0,
      };
      const rawHC = dem.trafficErlangs ?? 0;
      const roundedHC = Math.ceil(rawHC);
      const timeStr = staff.time || staff.intervalStart || '';
      return {
        id: staff.id || `${staff.date || ''}_${timeStr}_${idx}`,
        date: staff.date || '',
        time: timeStr,
        intervalStart: timeStr,
        segment: staff.segment || 'General',
        volume: dem.volume ?? 0,
        ahtSeconds: dem.ahtSeconds ?? 0,
        trafficErlangs: dem.trafficErlangs ?? 0,
        rawHC,
        roundedHC,
        requiredHC: staff.requiredHC ?? 0,
        scheduledHC: staff.scheduledHC ?? 0,
        effectiveHC: staff.effectiveHC ?? 0,
      };
    });
  }, [demands, intervalStaffing]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return combinedRows.filter(r => {
      if (selectedDate !== 'all' && r.date !== selectedDate) return false;
      if (selectedSegment !== 'all' && r.segment !== selectedSegment) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          r.date.toLowerCase().includes(term) ||
          r.time.toLowerCase().includes(term) ||
          r.segment.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [combinedRows, selectedDate, selectedSegment, searchTerm]);

  // Erlang model display title
  const modelName = config.erlangModel === 'erlang_a'
    ? 'Erlang A (with Abandonment)'
    : config.erlangModel === 'erlang_b'
    ? 'Erlang B (Blocking Model)'
    : 'Erlang C (Queueing Benchmark)';

  const avgTraffic = combinedRows.length > 0
    ? combinedRows.reduce((sum, r) => sum + r.trafficErlangs, 0) / combinedRows.length
    : 0;
  const peakTraffic = Math.max(...combinedRows.map(r => r.trafficErlangs), 0);
  const avgRequired = combinedRows.length > 0
    ? combinedRows.reduce((sum, r) => sum + r.requiredHC, 0) / combinedRows.length
    : 0;
  const peakRequired = Math.max(...combinedRows.map(r => r.requiredHC), 0);

  return (
    <div className="space-y-4 pb-8">
      {/* Prominent Educational Callout Banner */}
      <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-600/50 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-900/60 border border-blue-500/40 text-blue-400 shrink-0 mt-0.5">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">THEORETICAL STAFFING BENCHMARK</span>
              <span className="px-2 py-0.5 rounded bg-blue-900/80 text-blue-300 font-mono text-[10px] font-semibold border border-blue-700">
                {modelName}
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed max-w-4xl">
              <strong>Erlang is a theoretical queueing benchmark</strong> that mathematically assumes infinite customer patience, perfect steady-state Poisson arrivals, and instantaneous agent replenishment.
              In operational reality, <strong>Discrete-Event Simulation (DES)</strong> is the authoritative engine that accounts for finite agent availability, real rosters, breaks, shrinkage, adherence, and customer abandonment curves.
            </p>
          </div>
        </div>

        {onNavigateToTab && (
          <button
            type="button"
            onClick={() => onNavigateToTab('coverage')}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium flex items-center gap-1.5 shrink-0 transition cursor-pointer"
          >
            <span>Compare with Real Coverage</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans">Avg Traffic Intensity</div>
          <div className="text-xl font-bold text-amber-400">{avgTraffic.toFixed(2)} Erlangs</div>
          <div className="text-[10px] text-slate-500">Peak: {peakTraffic.toFixed(2)} Erlangs</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans">Avg Erlang Required HC</div>
          <div className="text-xl font-bold text-white">{avgRequired.toFixed(1)} HC</div>
          <div className="text-[10px] text-slate-500">Peak Required: {peakRequired.toFixed(1)} HC</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans">Target SLA Benchmark</div>
          <div className="text-xl font-bold text-emerald-400">{config.slaPercentTarget}% in {config.slaThresholdSeconds}s</div>
          <div className="text-[10px] text-slate-500">Solved per interval</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-[11px] text-slate-400 font-sans">Max Occupancy Ceiling</div>
          <div className="text-xl font-bold text-purple-400">{config.maxOccupancyThreshold}%</div>
          <div className="text-[10px] text-slate-500">Burnout threshold cap</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
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

      {/* Erlang Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-xs text-left font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Interval</th>
                <th className="px-4 py-2.5">Segment</th>
                <th className="px-4 py-2.5 text-right">Volume</th>
                <th className="px-4 py-2.5 text-right">AHT (s)</th>
                <th className="px-4 py-2.5 text-right">Traffic (Erlangs)</th>
                <th className="px-4 py-2.5 text-right">Raw Erlang HC</th>
                <th className="px-4 py-2.5 text-right">Rounded HC</th>
                <th className="px-4 py-2.5 text-right font-bold text-amber-400">Required HC</th>
                <th className="px-4 py-2.5 text-right">Target SLA %</th>
                <th className="px-4 py-2.5 text-right">Max Occ %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredRows.slice(0, 500).map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-2 text-white font-medium">{row.date}</td>
                  <td className="px-4 py-2 text-blue-400 font-semibold">{row.time || row.intervalStart}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                      {row.segment}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-white">{row.volume}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{row.ahtSeconds}s</td>
                  <td className="px-4 py-2 text-right text-amber-400">{row.trafficErlangs.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{row.rawHC.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{row.roundedHC}</td>
                  <td className="px-4 py-2 text-right font-bold text-amber-300 bg-amber-950/20">{row.requiredHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-emerald-400">{config.slaPercentTarget}%</td>
                  <td className="px-4 py-2 text-right text-purple-300">{config.maxOccupancyThreshold}%</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No intervals match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 500 && (
          <div className="px-4 py-2 bg-slate-950 text-slate-500 text-[11px] border-t border-slate-800 font-sans">
            Showing first 500 intervals of {filteredRows.length}.
          </div>
        )}
      </div>
    </div>
  );
};
