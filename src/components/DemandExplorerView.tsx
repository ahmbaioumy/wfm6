import React, { useState } from 'react';
import {
  UploadCloud,
  FileText,
  Clock,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Table,
  Search,
  ChevronLeft,
  ChevronRight,
  Settings2,
  RefreshCw,
  Sliders,
  Play,
} from 'lucide-react';
import { DemandRow, DemandParseResult, WorkforceConfig } from '../types';

interface DemandExplorerViewProps {
  csvText: string;
  onCsvChange: (text: string) => void;
  demands: DemandRow[];
  parseMetadata?: Partial<DemandParseResult>;
  intervalOverride: number;
  onIntervalOverrideChange: (val: number) => void;
  onLoadWeeklyTrend: () => void;
  onLoadRetail: () => void;
  onLoadMultiSegment: () => void;
  onLoadHourly: () => void;
  config: WorkforceConfig;
  onConfigChange: (updated: Partial<WorkforceConfig>) => void;
  onProceedToConfig: () => void;
  onRunSimulation: () => void;
  isRunning: boolean;
}

export const DemandExplorerView: React.FC<DemandExplorerViewProps> = ({
  csvText,
  onCsvChange,
  demands,
  parseMetadata,
  intervalOverride,
  onIntervalOverrideChange,
  onLoadWeeklyTrend,
  onLoadRetail,
  onLoadMultiSegment,
  onLoadHourly,
  config,
  onConfigChange,
  onProceedToConfig,
  onRunSimulation,
  isRunning,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showRawCsv, setShowRawCsv] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'health' | 'raw'>('preview');
  const pageSize = 20;

  // Demand metrics
  const totalVolume = demands.reduce((acc, d) => acc + d.volume, 0);
  const totalWorkloadSec = demands.reduce((acc, d) => acc + d.workloadSeconds, 0);
  const avgAht = totalVolume > 0 ? Math.round(totalWorkloadSec / totalVolume) : 0;
  const peakErlangs = demands.length > 0 ? Math.max(...demands.map(d => d.trafficErlangs)) : 0;
  const peakRow = demands.find(d => d.trafficErlangs === peakErlangs);
  const detectedInterval = parseMetadata?.detectedIntervalMinutes || (demands[0]?.intervalMinutes ?? 30);
  const uniqueDates = parseMetadata?.uniqueDates || Array.from(new Set(demands.map(d => d.date)));
  const uniqueSegments = parseMetadata?.uniqueSegments || Array.from(new Set(demands.map(d => d.segment)));
  const duplicateCount = parseMetadata?.duplicateCount ?? 0;
  const conflictingCount = parseMetadata?.conflictingDuplicateCount ?? 0;
  const warnings = parseMetadata?.warnings ?? [];

  // Filtered rows for table preview
  const filteredDemands = demands.filter(d => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      d.date.toLowerCase().includes(term) ||
      d.intervalStart.toLowerCase().includes(term) ||
      d.intervalEnd.toLowerCase().includes(term) ||
      (d.segment && d.segment.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredDemands.length / pageSize) || 1;
  const pagedRows = filteredDemands.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {/* Demand Explorer Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Demand Forecast &amp; Call Arrival Explorer
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                {demands.length} Intervals Loaded
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Examine imported interval data, check data quality, adjust resolution override, or load sample industry workloads.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-stretch sm:self-auto">
            <button
              type="button"
              onClick={onProceedToConfig}
              className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Configure Params &rarr;</span>
            </button>
            <button
              type="button"
              onClick={onRunSimulation}
              disabled={isRunning || demands.length === 0}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Simulation</span>
            </button>
          </div>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              Total Call Volume
            </div>
            <div className="text-lg font-extrabold text-white font-mono mt-1">
              {totalVolume.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Across {uniqueDates.length} distinct day(s)
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Weighted Mean AHT
            </div>
            <div className="text-lg font-extrabold text-emerald-400 font-mono mt-1">
              {avgAht}s
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {(totalWorkloadSec / 3600).toFixed(1)} total workload hours
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              Peak Traffic Load
            </div>
            <div className="text-lg font-extrabold text-amber-300 font-mono mt-1">
              {peakErlangs.toFixed(1)} <span className="text-xs font-normal text-slate-400">Erlangs</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">
              {peakRow ? `${peakRow.date} @ ${peakRow.intervalStart} (${peakRow.volume} calls)` : 'N/A'}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-purple-400" />
              Cadence &amp; Segments
            </div>
            <div className="text-lg font-extrabold text-purple-300 font-mono mt-1">
              {detectedInterval}m
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {uniqueSegments.length} queue segment(s) detected
            </div>
          </div>
        </div>

        {/* Quick Sample Load Buttons Strip */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">Quick Scenario Loaders:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onLoadWeeklyTrend}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-900/40 rounded-lg transition cursor-pointer"
            >
              7-Day Weekly Trend (84 Int)
            </button>
            <button
              type="button"
              onClick={onLoadRetail}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition cursor-pointer"
            >
              Retail Voice (30m)
            </button>
            <button
              type="button"
              onClick={onLoadMultiSegment}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition cursor-pointer"
            >
              Multi-Segment (30m)
            </button>
            <button
              type="button"
              onClick={onLoadHourly}
              className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition cursor-pointer"
            >
              Hourly Demand (60m)
            </button>
          </div>
        </div>
      </div>

      {/* Main Area Tabs: Preview Table | Data Health & Mapping | Raw CSV Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Interval Data Table ({demands.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('health')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'health'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Quality &amp; Mapping</span>
              {warnings.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeTab === 'raw'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw CSV Editor
            </button>
          </div>

          {activeTab === 'preview' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter interval or date..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Preview Table */}
        {activeTab === 'preview' && (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-950 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Interval Window</th>
                    <th className="py-2.5 px-3">Call Volume</th>
                    <th className="py-2.5 px-3">AHT (s)</th>
                    <th className="py-2.5 px-3">Workload (s)</th>
                    <th className="py-2.5 px-3">Traffic Erlangs</th>
                    <th className="py-2.5 px-3">Segment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {pagedRows.map((d, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                    const isPeak = d.trafficErlangs === peakErlangs;
                    return (
                      <tr
                        key={d.id || idx}
                        className={`hover:bg-slate-800/40 transition ${
                          isPeak ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-slate-500 text-[11px]">{globalIdx}</td>
                        <td className="py-2 px-3 text-white font-sans">{d.date}</td>
                        <td className="py-2 px-3 text-blue-300">
                          {d.intervalStart} &ndash; {d.intervalEnd}
                        </td>
                        <td className="py-2 px-3 font-bold text-white">
                          {d.volume}
                          {isPeak && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Peak
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-300">{d.ahtSeconds}s</td>
                        <td className="py-2 px-3 text-slate-400">{d.workloadSeconds.toLocaleString()}</td>
                        <td className="py-2 px-3 text-emerald-400 font-bold">
                          {d.trafficErlangs.toFixed(2)} Erl
                        </td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{d.segment || 'Default'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <div>
                Showing {(currentPage - 1) * pageSize + 1} to{' '}
                {Math.min(currentPage * pageSize, filteredDemands.length)} of{' '}
                {filteredDemands.length} rows
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono px-2">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Quality & Mapping */}
        {activeTab === 'health' && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center justify-between">
                  <span>Detected CSV Columns (RFC-4180 Auto-Mapping)</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    Validated
                  </span>
                </div>
                <div className="space-y-1.5 text-slate-300 font-mono text-[11px] pt-1">
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Date Column:</span>
                    <strong className="text-blue-400">{parseMetadata?.detectedMapping?.dateCol || 'date'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Interval Column:</span>
                    <strong className="text-blue-400">{parseMetadata?.detectedMapping?.intervalCol || 'interval'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800">
                    <span className="text-slate-400 font-sans">Volume Column:</span>
                    <strong className="text-blue-400">{parseMetadata?.detectedMapping?.volumeCol || 'volume'}</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 font-sans">AHT Column:</span>
                    <strong className="text-blue-400">{parseMetadata?.detectedMapping?.ahtCol || 'AHT'}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200">Missing Data Strategy (PRD 5)</div>
                <p className="text-slate-400 text-[11px]">
                  Governs how unrecorded or missing time intervals in historical logs are filled.
                </p>
                <div className="pt-2">
                  <select
                    value={config.missingDataStrategy || 'zero'}
                    onChange={e => onConfigChange({ missingDataStrategy: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 focus:outline-none"
                  >
                    <option value="zero">Zero-Fill (Treat unrecorded intervals as 0 volume)</option>
                    <option value="forward_fill">Forward-Fill (Carry forward previous interval volume)</option>
                    <option value="linear_interpolate">Linear Interpolate (Smoothly interpolate between intervals)</option>
                  </select>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                  <div>Duplicate rows handled: <strong className="text-emerald-400 font-mono">{duplicateCount}</strong></div>
                  <div>Conflicting rows detected: <strong className="text-amber-400 font-mono">{conflictingCount}</strong></div>
                </div>
              </div>
            </div>

            {warnings.length > 0 && (
              <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-amber-200">
                <div className="font-semibold flex items-center gap-1.5 mb-1 text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Data Quality Diagnostic Notices ({warnings.length})</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Raw CSV Editor */}
        {activeTab === 'raw' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                Edit CSV lines directly. The parser dynamically recalculates erlangs and staffing.
              </span>
              <span className="text-slate-500 font-mono text-[11px]">
                {csvText.split('\n').length} lines
              </span>
            </div>
            <textarea
              rows={12}
              value={csvText}
              onChange={e => onCsvChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              placeholder="date,interval,volume,AHT&#10;2026-09-01,08:00,45,300"
            />
          </div>
        )}
      </div>
    </div>
  );
};
