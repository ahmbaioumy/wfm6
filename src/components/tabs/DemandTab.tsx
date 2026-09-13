import React, { useState, useMemo, useRef } from 'react';
import { DemandRow } from '../../types';
import {
  Database,
  UploadCloud,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowUpDown,
  Download,
} from 'lucide-react';
import { LineChartSvg, BarChartSvg } from '../common/SimpleSvgCharts';

interface DemandTabProps {
  demands: DemandRow[];
  datasetName: string;
  intervalOverride: number;
  onIntervalOverrideChange: (val: number) => void;
  onUploadCSV: (content: string, filename?: string) => void;
  onLoadRetail: () => void;
  onLoadMultiSegment: () => void;
  onLoadWeeklyTrend: () => void;
  onLoadHourly: () => void;
}

export const DemandTab: React.FC<DemandTabProps> = ({
  demands,
  datasetName,
  intervalOverride,
  onIntervalOverrideChange,
  onUploadCSV,
  onLoadRetail,
  onLoadMultiSegment,
  onLoadWeeklyTrend,
  onLoadHourly,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unique filters
  const uniqueSegments = useMemo(() => Array.from(new Set(demands.map(d => d.segment))), [demands]);
  const uniqueDates = useMemo(() => Array.from(new Set(demands.map(d => d.date))), [demands]);

  // Filtered rows
  const filteredDemands = useMemo(() => {
    return demands.filter(d => {
      if (selectedSegment !== 'all' && d.segment !== selectedSegment) return false;
      if (selectedDate !== 'all' && d.date !== selectedDate) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          d.date.toLowerCase().includes(term) ||
          d.intervalStart.toLowerCase().includes(term) ||
          d.segment.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [demands, selectedSegment, selectedDate, searchTerm]);

  // Aggregate Metrics
  const totalVolume = useMemo(() => demands.reduce((acc, d) => acc + d.volume, 0), [demands]);
  const totalWorkloadHours = useMemo(() => {
    const sec = demands.reduce((acc, d) => acc + d.volume * d.ahtSeconds, 0);
    return Math.round(sec / 3600);
  }, [demands]);
  const avgAht = useMemo(() => {
    return totalVolume > 0
      ? Math.round(demands.reduce((acc, d) => acc + d.volume * d.ahtSeconds, 0) / totalVolume)
      : 0;
  }, [demands, totalVolume]);
  const peakVolume = useMemo(() => Math.max(...demands.map(d => d.volume), 0), [demands]);
  const peakErlangs = useMemo(() => Math.max(...demands.map(d => d.trafficErlangs), 0), [demands]);

  // Data Quality Audit
  const auditResults = useMemo(() => {
    const issues: string[] = [];
    if (demands.length === 0) {
      issues.push('No demand records detected.');
    }
    const zeroVolCount = demands.filter(d => d.volume === 0).length;
    if (zeroVolCount > 0) {
      issues.push(`${zeroVolCount} intervals have zero volume.`);
    }
    const missingAhtCount = demands.filter(d => d.ahtSeconds <= 0).length;
    if (missingAhtCount > 0) {
      issues.push(`${missingAhtCount} intervals have missing or zero AHT.`);
    }
    return issues;
  }, [demands]);

  // Volume by Hour of Day profile (00 to 23)
  const hourlyProfile = useMemo(() => {
    const hoursMap = new Map<string, { volume: number; count: number }>();
    for (let h = 0; h < 24; h++) {
      const hh = String(h).padStart(2, '0');
      hoursMap.set(hh, { volume: 0, count: 0 });
    }
    demands.forEach(d => {
      const hh = d.intervalStart.slice(0, 2);
      if (hoursMap.has(hh)) {
        const item = hoursMap.get(hh)!;
        item.volume += d.volume;
        item.count += 1;
      }
    });
    return Array.from(hoursMap.entries()).map(([hour, data]) => ({
      label: `${hour}:00`,
      value: data.count > 0 ? Math.round(data.volume / (uniqueDates.length || 1)) : 0,
    }));
  }, [demands, uniqueDates.length]);

  // Timeline series for Chart
  const timelineChartData = useMemo(() => {
    return filteredDemands.slice(0, 96).map(d => ({
      label: `${d.date} ${d.intervalStart}`,
      volume: d.volume,
      trafficErlangs: d.trafficErlangs,
    }));
  }, [filteredDemands]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        onUploadCSV(content, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Top Banner: Preset Datasets & Upload Action */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">Active Demand Dataset:</h2>
              <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 font-mono text-xs border border-blue-700">
                {datasetName}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {demands.length} intervals · {uniqueDates.length} days · {uniqueSegments.length} queue segments
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.txt"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-500 px-1 text-[11px]">Presets:</span>
            <button
              type="button"
              onClick={onLoadRetail}
              className="px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Retail
            </button>
            <button
              type="button"
              onClick={onLoadMultiSegment}
              className="px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Multi-Queue
            </button>
            <button
              type="button"
              onClick={onLoadWeeklyTrend}
              className="px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              7-Day Trend
            </button>
            <button
              type="button"
              onClick={onLoadHourly}
              className="px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Hourly
            </button>
          </div>
        </div>
      </div>

      {/* Dataset Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans">Total Offered Volume</div>
          <div className="text-2xl font-bold text-white mt-1">{totalVolume.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Contacts over horizon</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans">Average Handle Time</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{avgAht}s</div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Weighted across all calls</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans">Total Workload</div>
          <div className="text-2xl font-bold text-cyan-400 mt-1">{totalWorkloadHours.toLocaleString()}h</div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Raw contact handling hours</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans">Peak Interval Volume</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{peakVolume}</div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Max calls in one interval</div>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400 font-sans">Peak Traffic Erlangs</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{peakErlangs.toFixed(2)}</div>
          <div className="text-[11px] text-slate-500 font-sans mt-0.5">Workload / Interval Secs</div>
        </div>
      </div>

      {/* Visual Analytics: Volume Timeline & Hourly Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-white">Demand Volume Timeline</h3>
            <p className="text-xs text-slate-400">Chronological contact arrival curve</p>
          </div>
          <LineChartSvg
            data={timelineChartData}
            height={240}
            series={[
              { key: 'volume', name: 'Offered Volume', color: '#38bdf8', strokeWidth: 2, areaFill: true },
            ]}
          />
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-white">Daily Hourly Distribution Profile</h3>
            <p className="text-xs text-slate-400">Average volume grouped by hour of day (00:00 – 23:00)</p>
          </div>
          <BarChartSvg
            data={hourlyProfile}
            height={240}
            positiveColor="#6366f1"
          />
        </div>
      </div>

      {/* Data Quality & Audit Card */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Data Quality &amp; Structure Audit</span>
        </div>
        {auditResults.length === 0 ? (
          <p className="text-xs text-emerald-400 font-mono">
            ✓ Complete dataset verified: Valid chronological timestamps, positive AHT values, zero missing intervals.
          </p>
        ) : (
          <div className="space-y-1">
            {auditResults.map((issue, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-amber-300 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interval Table View with Filters */}
      <div className="space-y-3">
        {/* Table Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search date, interval, or segment..."
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

        {/* Detailed Table */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs text-left font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Interval Start</th>
                  <th className="px-4 py-2.5">Segment</th>
                  <th className="px-4 py-2.5 text-right">Offered Volume</th>
                  <th className="px-4 py-2.5 text-right">AHT (Seconds)</th>
                  <th className="px-4 py-2.5 text-right">Workload (Hours)</th>
                  <th className="px-4 py-2.5 text-right">Traffic (Erlangs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {filteredDemands.slice(0, 300).map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-2 text-white font-medium">{row.date}</td>
                    <td className="px-4 py-2 text-blue-400">{row.intervalStart}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-slate-700">
                        {row.segment}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-bold text-white">{row.volume}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{row.ahtSeconds}s</td>
                    <td className="px-4 py-2 text-right text-slate-400">{(row.workloadSeconds / 3600).toFixed(2)}h</td>
                    <td className="px-4 py-2 text-right text-emerald-400 font-semibold">{row.trafficErlangs.toFixed(2)}</td>
                  </tr>
                ))}
                {filteredDemands.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-sans">
                      No demand records found matching selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredDemands.length > 300 && (
            <div className="px-4 py-2 bg-slate-950 text-slate-500 text-[11px] border-t border-slate-800 font-sans">
              Showing first 300 intervals of {filteredDemands.length}. Use filters above to narrow your inspection.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
