import React, { useRef, useState } from 'react';
import { UploadCloud, Calendar, Layers, Clock, Settings2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DemandRow, DemandParseResult, ColumnMapping } from '../types';

interface DemandStepProps {
  csvText: string;
  onCsvChange: (text: string) => void;
  demands: DemandRow[];
  parseMetadata?: Partial<DemandParseResult>;
  intervalOverride: number; // 0 = Auto Detect, 15, 30, 60
  onIntervalOverrideChange: (val: number) => void;
}

export const DemandStep: React.FC<DemandStepProps> = ({
  csvText,
  onCsvChange,
  demands,
  parseMetadata,
  intervalOverride,
  onIntervalOverrideChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMapping, setShowMapping] = useState(false);

  const totalVolume = demands.reduce((acc, d) => acc + d.volume, 0);
  const totalWorkloadSec = demands.reduce((acc, d) => acc + d.workloadSeconds, 0);
  const avgAht = totalVolume > 0 ? Math.round(totalWorkloadSec / totalVolume) : 0;
  const peakErlangs = demands.length > 0 ? Math.max(...demands.map(d => d.trafficErlangs)) : 0;

  const detectedInterval = parseMetadata?.detectedIntervalMinutes || (demands[0]?.intervalMinutes ?? 30);
  const uniqueDates = parseMetadata?.uniqueDates || Array.from(new Set(demands.map(d => d.date)));
  const uniqueSegments = parseMetadata?.uniqueSegments || Array.from(new Set(demands.map(d => d.segment)));
  const duplicateCount = parseMetadata?.duplicateCount ?? 0;
  const conflictingCount = parseMetadata?.conflictingDuplicateCount ?? 0;
  const warnings = parseMetadata?.warnings ?? [];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      if (typeof evt.target?.result === 'string') {
        onCsvChange(evt.target.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-sm">
      <div>
        {/* Step Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h2 className="text-sm font-semibold text-white">Demand Forecast Data</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {demands.length} Rows &bull; {detectedInterval}m
            </span>
          </div>
        </div>

        {/* Interval Resolution Selector (PRD 4) */}
        <div className="flex items-center justify-between bg-slate-950/80 p-2 rounded-lg border border-slate-800 mb-2 text-xs">
          <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-400" /> Interval Duration:
          </span>
          <select
            value={intervalOverride}
            onChange={e => onIntervalOverrideChange(parseInt(e.target.value, 10))}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 focus:outline-none"
          >
            <option value={0}>Auto Detect ({detectedInterval} min detected)</option>
            <option value={15}>15 Minutes</option>
            <option value={30}>30 Minutes</option>
            <option value={60}>60 Minutes (Hourly)</option>
          </select>
        </div>

        {/* CSV Text Input Area */}
        <textarea
          value={csvText}
          onChange={e => onCsvChange(e.target.value)}
          rows={6}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:border-blue-500 focus:outline-none resize-none"
          placeholder="date,interval,volume,AHT,segment&#10;01/09/2026,08:00,35,320,Voice"
        />

        {/* Upload & Options Row */}
        <div className="flex items-center gap-2 mt-2">
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
            className="flex-1 py-1.5 px-3 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center justify-center gap-1.5 transition"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Upload CSV File
          </button>
          <button
            type="button"
            onClick={() => setShowMapping(!showMapping)}
            className="py-1.5 px-2.5 text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded border border-slate-800 flex items-center gap-1 transition"
            title="Inspect Column Mapping & Data Health"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {showMapping ? 'Hide Info' : 'Mapping'}
          </button>
        </div>

        {/* Diagnostics & Column Mapping Drawer */}
        {showMapping && (
          <div className="mt-2 p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] space-y-1.5 animate-in fade-in">
            <div className="font-semibold text-slate-300 flex items-center justify-between">
              <span>Detected Columns &amp; Health</span>
              <span className="text-[10px] text-slate-400">{uniqueDates.length} Days &bull; {uniqueSegments.length} Segments</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-400 font-mono text-[10px]">
              <div>Date: <strong className="text-blue-400">{parseMetadata?.detectedMapping?.dateCol || 'date'}</strong></div>
              <div>Interval: <strong className="text-blue-400">{parseMetadata?.detectedMapping?.intervalCol || 'interval'}</strong></div>
              <div>Volume: <strong className="text-blue-400">{parseMetadata?.detectedMapping?.volumeCol || 'volume'}</strong></div>
              <div>AHT: <strong className="text-blue-400">{parseMetadata?.detectedMapping?.ahtCol || 'AHT'}</strong></div>
            </div>
            {duplicateCount > 0 && (
              <div className="text-amber-400 text-[10px] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {duplicateCount} duplicate row(s) safely deduplicated.
              </div>
            )}
            {conflictingCount > 0 && (
              <div className="text-rose-400 text-[10px] flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {conflictingCount} conflicting duplicate row(s) detected.
              </div>
            )}
          </div>
        )}

        {/* Warnings Banner */}
        {warnings.length > 0 && (
          <div className="mt-2 p-2 rounded bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {warnings.slice(0, 2).map((w, idx) => (
                <div key={idx}>{w}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <span className="text-slate-400 block flex items-center gap-1">
            <Layers className="w-3 h-3 text-slate-500" /> Total Volume
          </span>
          <span className="text-white font-semibold text-sm">{totalVolume.toLocaleString()} calls</span>
        </div>
        <div className="bg-slate-950/60 p-2 rounded border border-slate-800/50">
          <span className="text-slate-400 block flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" /> Mean AHT / Peak
          </span>
          <span className="text-white font-semibold text-sm">{avgAht}s / {peakErlangs.toFixed(1)} Erl</span>
        </div>
      </div>
    </div>
  );
};
