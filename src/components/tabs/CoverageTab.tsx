import React, { useState, useMemo } from 'react';
import {
  IntervalStaffing,
  WorkforceConfig,
} from '../../types';
import {
  ShieldCheck,
  Search,
  Filter,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Layers,
} from 'lucide-react';
import { LineChartSvg, BarChartSvg } from '../common/SimpleSvgCharts';

interface CoverageTabProps {
  intervalStaffing: IntervalStaffing[];
  config: WorkforceConfig;
}

export const CoverageTab: React.FC<CoverageTabProps> = ({
  intervalStaffing,
  config,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');

  const uniqueDates = useMemo(() => Array.from(new Set(intervalStaffing.map(s => s.date || ''))), [intervalStaffing]);
  const uniqueSegments = useMemo(() => Array.from(new Set(intervalStaffing.map(s => s.segment || ''))), [intervalStaffing]);

  // Enriched rows with gap & coverage ratio
  const rows = useMemo(() => {
    return intervalStaffing.map((s, idx) => {
      const requiredHC = s.requiredHC ?? 0;
      const effectiveHC = s.effectiveHC ?? 0;
      const scheduledHC = s.scheduledHC ?? 0;
      const gap = s.coverageGap ?? (effectiveHC - requiredHC);
      const coverageRatio = s.coveragePercent ?? (requiredHC > 0 ? (effectiveHC / requiredHC) * 100 : 100);
      return {
        id: s.id || `${s.date || ''}_${s.time || ''}_${idx}`,
        date: s.date || '',
        time: s.time || s.intervalStart || '',
        intervalStart: s.intervalStart || s.time || '',
        segment: s.segment || 'General',
        requiredHC,
        scheduledHC,
        effectiveHC,
        gap: Math.round(gap * 10) / 10,
        coverageRatio: Math.round(coverageRatio * 10) / 10,
        breakHC: Math.round((s.onBreak ?? 0) * 10) / 10,
        outOfficeHC: Math.round((s.outOfficeLoss ?? 0) * 10) / 10,
        inOfficeHC: Math.round((s.shrinkageLoss ?? 0) * 10) / 10,
        adherenceHC: Math.round((s.adherenceLoss ?? 0) * 10) / 10,
      };
    });
  }, [intervalStaffing]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
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
  }, [rows, selectedDate, selectedSegment, searchTerm]);

  // Top Operational Coverage Metrics
  const totalIntervals = rows.length || 1;
  const understaffedIntervals = rows.filter(r => r.gap < -0.5);
  const overstaffedIntervals = rows.filter(r => r.gap > 2.0);
  const maxDeficit = rows.length > 0 ? Math.min(...rows.map(r => r.gap), 0) : 0;
  const maxSurplus = rows.length > 0 ? Math.max(...rows.map(r => r.gap), 0) : 0;
  const avgCoverageRatio = rows.length > 0 ? rows.reduce((sum, r) => sum + r.coverageRatio, 0) / totalIntervals : 100;

  // Chart data for Timeline Overlay
  const chartTimelineData = useMemo(() => {
    return filteredRows.slice(0, 96).map(r => ({
      label: r.time,
      required: r.requiredHC,
      scheduled: r.scheduledHC,
      effective: r.effectiveHC,
    }));
  }, [filteredRows]);

  // Chart data for Gap Bar Chart
  const chartGapData = useMemo(() => {
    return filteredRows.slice(0, 96).map(r => ({
      label: r.time,
      value: r.gap,
      color: r.gap >= 0 ? '#10b981' : '#f43f5e',
    }));
  }, [filteredRows]);

  return (
    <div className="space-y-6 pb-8">
      {/* Key Operational Authority Callout */}
      <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/50 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-cyan-200">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-900/60 border border-cyan-400/40 text-cyan-300 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-sm text-white flex items-center gap-2">
              REAL ROSTER CAPACITY ENGINE
              <span className="px-2 py-0.5 rounded bg-cyan-900/80 text-cyan-300 font-mono text-[10px] font-semibold border border-cyan-700">
                Single Source of Truth
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed max-w-4xl">
              <strong>Effective Headcount</strong> is directly computed from individual synthetic agent availability seconds over interval seconds:
              <br />
              <code className="bg-slate-900 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[11px]">
                Effective HC = Scheduled HC − Break HC − Out-of-Office Loss − In-Office Loss − Non-Adherent Loss
              </code>
              <br />
              This exact same agent availability timeline is fed into the DES engine so capacity and queue simulation are 100% mathematically synchronized.
            </p>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between mb-1">
            <span>Avg Coverage Ratio</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className={`text-2xl font-bold ${avgCoverageRatio >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {avgCoverageRatio.toFixed(1)}%
          </div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Effective vs Required</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between mb-1">
            <span>Peak Staffing Deficit</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {maxDeficit < 0 ? `${maxDeficit.toFixed(1)} HC` : '0 HC'}
          </div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Worst understaffed interval</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between mb-1">
            <span>Peak Staffing Surplus</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            +{maxSurplus.toFixed(1)} HC
          </div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Highest overstaffed interval</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans flex items-center justify-between mb-1">
            <span>Understaffed Intervals</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className={`text-2xl font-bold ${understaffedIntervals.length > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
            {understaffedIntervals.length}
          </div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Deficit &gt; 0.5 HC</div>
        </div>
      </div>

      {/* Coverage Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Overlay */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-white">Capacity Timeline</h3>
            <p className="text-xs text-slate-400">Required Erlang vs Roster Scheduled vs Net Effective Capacity</p>
          </div>
          <LineChartSvg
            data={chartTimelineData}
            height={260}
            series={[
              { key: 'required', name: 'Required HC', color: '#f59e0b', strokeWidth: 2, strokeDasharray: '4 3' },
              { key: 'scheduled', name: 'Scheduled HC', color: '#6366f1', strokeWidth: 2 },
              { key: 'effective', name: 'Effective HC', color: '#06b6d4', strokeWidth: 2.5, areaFill: true },
            ]}
          />
        </div>

        {/* Coverage Gap Bar Chart */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-white">Staffing Gap (Surplus vs Deficit)</h3>
            <p className="text-xs text-slate-400">Effective HC minus Required HC</p>
          </div>
          <BarChartSvg
            data={chartGapData}
            height={260}
            positiveColor="#10b981"
            negativeColor="#f43f5e"
            valueFormatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} HC`}
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search date, interval, segment..."
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

      {/* Detailed Coverage Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
        <div className="overflow-x-auto max-h-[560px]">
          <table className="w-full text-xs text-left font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Interval</th>
                <th className="px-4 py-2.5">Segment</th>
                <th className="px-4 py-2.5 text-right text-amber-400">Required HC</th>
                <th className="px-4 py-2.5 text-right text-indigo-300">Scheduled HC</th>
                <th className="px-4 py-2.5 text-right text-purple-400">Break HC</th>
                <th className="px-4 py-2.5 text-right text-purple-300">Out-Office</th>
                <th className="px-4 py-2.5 text-right text-purple-300">In-Office</th>
                <th className="px-4 py-2.5 text-right text-purple-300">Non-Adh</th>
                <th className="px-4 py-2.5 text-right font-bold text-cyan-400">Effective HC</th>
                <th className="px-4 py-2.5 text-right">Staffing Gap</th>
                <th className="px-4 py-2.5 text-right">Coverage %</th>
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
                  <td className="px-4 py-2 text-right text-amber-400 font-bold">{row.requiredHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-indigo-300">{row.scheduledHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-purple-400">{row.breakHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{row.outOfficeHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{row.inOfficeHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{row.adherenceHC.toFixed(1)}</td>
                  <td className="px-4 py-2 text-right font-bold text-cyan-300 bg-cyan-950/20">{row.effectiveHC.toFixed(1)}</td>
                  <td className={`px-4 py-2 text-right font-bold ${row.gap >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.gap >= 0 ? `+${row.gap.toFixed(1)}` : row.gap.toFixed(1)}
                  </td>
                  <td className={`px-4 py-2 text-right font-bold ${row.coverageRatio >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {row.coverageRatio.toFixed(1)}%
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No coverage intervals match filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredRows.length > 500 && (
          <div className="px-4 py-2 bg-slate-950 text-slate-500 text-[11px] border-t border-slate-800 font-sans">
            Showing first 500 rows of {filteredRows.length}.
          </div>
        )}
      </div>
    </div>
  );
};
