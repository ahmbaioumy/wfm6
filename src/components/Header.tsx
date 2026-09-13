import React from 'react';
import {
  Play,
  Download,
  RefreshCw,
  FileCode,
  CheckCircle2,
  ShieldAlert,
  Settings,
  ChevronDown,
  LayoutGrid,
  Sparkles,
  Layers,
  Sliders,
  SlidersHorizontal,
  Workflow,
  Compass,
} from 'lucide-react';

export type LayoutDesignMode = 'studio' | 'cockpit' | 'minimal';

interface HeaderProps {
  onRunSimulation: () => void;
  onLoadRetail: () => void;
  onLoadMultiSegment: () => void;
  onLoadWeeklyTrend: () => void;
  onLoadHourly?: () => void;
  onExportCSV: () => void;
  onExportRosterCSV?: () => void;
  onOpenStandaloneModal: () => void;
  onOpenConstraintsModal?: () => void;
  onOpenConfigModal?: () => void;
  isRunning: boolean;
  isStale?: boolean;
  progress?: number | null;
  activeDesign: LayoutDesignMode;
  onSelectDesign: (design: LayoutDesignMode) => void;
  intervalCount: number;
  totalHC: number;
  slaTarget: number;
}

export const Header: React.FC<HeaderProps> = ({
  onRunSimulation,
  onLoadRetail,
  onLoadMultiSegment,
  onLoadWeeklyTrend,
  onLoadHourly,
  onExportCSV,
  onExportRosterCSV,
  onOpenStandaloneModal,
  onOpenConstraintsModal,
  onOpenConfigModal,
  isRunning,
  isStale,
  progress,
  activeDesign,
  onSelectDesign,
  intervalCount,
  totalHC,
  slaTarget,
}) => {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  return (
    <header className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-3 sm:p-4 shadow-xl shadow-black/25 relative overflow-hidden transition-all">
      {/* Simulation Running Progress Bar */}
      {isRunning && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, progress ?? 12)}%` }}
          />
        </div>
      )}

      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand Identity & Active Metrics Chip */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Contact Center Performance Simulator
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                DES + Erlang
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                <strong className="font-mono text-white">{intervalCount}</strong> intervals
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-300">
                <strong className="font-mono text-white">{totalHC}</strong> HC
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-300">
                Target <strong className="font-mono text-blue-400">{slaTarget}%</strong> SLA
              </span>
            </div>
          </div>
        </div>

        {/* Center: Layout Design Switcher (Requested by User) */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl self-stretch sm:self-auto justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 hidden sm:inline">
            Design:
          </span>
          <button
            type="button"
            onClick={() => onSelectDesign('studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeDesign === 'studio'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Design 1: Refined Step-by-Step Pipeline + Tabbed Studio"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Studio Flow</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDesign('cockpit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeDesign === 'cockpit'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Design 2: High-Density Operations Cockpit with Executive Metric Strip"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Operations Cockpit</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDesign('minimal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              activeDesign === 'minimal'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
            title="Design 3: Clean Linear-Style Cardless View"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Minimalist</span>
          </button>
        </div>

        {/* Right: Scenarios, Actions & Primary Simulation Trigger */}
        <div className="flex flex-wrap items-center gap-2 self-stretch xl:self-auto justify-end">
          {/* Scenario Selector */}
          <div className="relative inline-block text-left">
            <select
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'weekly') onLoadWeeklyTrend();
                else if (val === 'retail') onLoadRetail();
                else if (val === 'multi') onLoadMultiSegment();
                else if (val === 'hourly' && onLoadHourly) onLoadHourly();
              }}
              defaultValue="weekly"
              className="appearance-none bg-slate-950 hover:bg-slate-900 border border-slate-700/80 text-slate-200 text-xs font-medium rounded-xl px-3 py-2 pr-7 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
              title="Select Sample Scenario"
            >
              <option value="weekly">Scenario: 7-Day Trend (84 Int)</option>
              <option value="retail">Scenario: Retail Voice (30m)</option>
              <option value="multi">Scenario: Multi-Segment (30m)</option>
              <option value="hourly">Scenario: Hourly Demand (60m)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          {/* Standalone HTML Button */}
          <button
            type="button"
            onClick={onOpenStandaloneModal}
            className="px-3 py-2 text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            title="Open/Download 0-Dependency Standalone HTML"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Standalone HTML</span>
            <span className="sm:hidden">HTML</span>
          </button>

          {/* More Actions Dropdown (Constraints, Config, CSV Exports) to reduce clutter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="px-2.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition flex items-center gap-1 cursor-pointer"
              title="More Actions & Exports"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5 text-xs text-slate-200">
                  {onOpenConstraintsModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onOpenConstraintsModal();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                      <span>Labor Constraints (PRD 46-55)</span>
                    </button>
                  )}
                  {onOpenConfigModal && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onOpenConfigModal();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Configuration &amp; Reset</span>
                    </button>
                  )}
                  <div className="my-1 border-t border-slate-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      onExportCSV();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-400" />
                    <span>Export Results CSV</span>
                  </button>
                  {onExportRosterCSV && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onExportRosterCSV();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Export Roster CSV</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Primary Simulation Button */}
          <button
            type="button"
            onClick={onRunSimulation}
            disabled={isRunning}
            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer ${
              isStale
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/50 animate-pulse'
                : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isStale ? 'Run Simulation (Stale)' : 'Run Simulation'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
