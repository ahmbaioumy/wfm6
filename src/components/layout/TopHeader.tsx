import React from 'react';
import {
  FileText,
  Calendar,
  Clock,
  Layers,
  Users,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  FileCode2,
  Settings,
} from 'lucide-react';

export interface TopHeaderProps {
  datasetName: string;
  dateRange: string;
  intervalMinutes: number;
  segments?: string[];
  segmentCount?: number;
  totalHC: number;
  onOpenStandaloneModal?: () => void;
  onOpenConfigModal?: () => void;
  onResetParameters?: () => void;
  onHardClear?: () => void;
  onImportConfig?: () => void;
  onExportConfig?: () => void;
  onReset?: () => void;
  onDownloadStandalone?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  datasetName,
  dateRange,
  intervalMinutes,
  segments = [],
  segmentCount,
  totalHC,
  onOpenStandaloneModal,
  onOpenConfigModal,
  onResetParameters,
  onHardClear,
  onImportConfig,
  onExportConfig,
  onReset,
  onDownloadStandalone,
}) => {
  const displaySegmentCount = segmentCount ?? (Array.isArray(segments) && segments.length > 0 ? segments.length : 1);

  const handleStandalone = onOpenStandaloneModal || onDownloadStandalone;
  const handleConfig = onOpenConfigModal || onImportConfig || onExportConfig;
  const handleReset = onResetParameters || onReset;

  return (
    <header className="h-[64px] bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 select-none shadow-sm">
      {/* LEFT: Branding & Subtitle */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold shadow-inner">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            Contact Center Workforce Simulation
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300 font-mono font-medium border border-blue-700/50">
              Desktop WFM
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-medium">
            Demand <span className="text-blue-400">→</span> Roster <span className="text-blue-400">→</span> DES <span className="text-blue-400">→</span> KPI
          </div>
        </div>
      </div>

      {/* RIGHT: Dataset Badges & Actions */}
      <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-1">
        {/* Metric Badges */}
        <div className="hidden xl:flex items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300" title="Active Dataset">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Dataset:</span>
            <span className="font-semibold text-white">{datasetName}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300" title="Horizon Date Range">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Horizon:</span>
            <span className="font-semibold text-white">{dateRange || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300" title="Interval Length">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Interval:</span>
            <span className="font-semibold text-white">{intervalMinutes}m</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300" title="Queues / Segments">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Segments:</span>
            <span className="font-semibold text-white">{displaySegmentCount}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-slate-800 text-slate-300" title="Total Headcount">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Total HC:</span>
            <span className="font-semibold text-white">{totalHC}</span>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleStandalone}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition cursor-pointer"
            title="Download 100% self-contained standalone single HTML file"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Single HTML File</span>
          </button>

          <button
            type="button"
            onClick={handleConfig}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            title="Project Configuration & JSON Import / Export"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Config / JSON</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            title="Reset parameters to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Reset</span>
          </button>

          <button
            type="button"
            onClick={onHardClear}
            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/80 text-slate-400 hover:text-red-300 text-xs font-medium flex items-center gap-1 transition cursor-pointer"
            title="Clear all stored data and reload baseline"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Hard Clear</span>
          </button>
        </div>
      </div>
    </header>
  );
};
