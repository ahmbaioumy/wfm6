import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Sliders,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Target,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  Download,
  RotateCcw,
  BarChart3,
  Table,
  Lightbulb,
  FileCode,
  Settings,
  Cpu,
  ArrowRight,
} from 'lucide-react';
import {
  WorkforceConfig,
  DemandRow,
  DemandParseResult,
  AggregationSummary,
  MonteCarloStats,
} from '../types';
import { ConfigCategory } from './CategorizedConfigPanel';

export type WorkflowView = 'upload' | 'config' | 'results';
export type FlowStep = 'upload' | 'config' | 'result';
export type MainPanelTab = 'kpis' | 'roster' | 'comparison' | 'charts' | 'insights' | 'calendar' | 'all';

interface LeftPanelFlowProps {
  // Step 1: Upload File & Demand
  csvText: string;
  onCsvChange: (text: string) => void;
  demands: DemandRow[];
  parseMetadata?: Partial<DemandParseResult>;
  intervalOverride: number;
  onIntervalOverrideChange: (val: number) => void;
  onLoadRetail: () => void;
  onLoadMultiSegment: () => void;
  onLoadWeeklyTrend: () => void;
  onLoadHourly: () => void;

  // Step 2: Config & Params
  config: WorkforceConfig;
  onChange: (updated: Partial<WorkforceConfig>) => void;
  offCount: number;
  workingCount: number;
  onOpenConstraintsModal: () => void;
  onOpenConfigModal: () => void;

  // Step 3: Result
  isRunning: boolean;
  simulationProgress: number | null;
  onRunSimulation: () => void;
  isStale: boolean;
  lastRunInputs: {
    totalHC: number;
    shrinkage: number;
    chatConcurrency: number;
    demandRows: number;
  } | null;
  summary: AggregationSummary | null;
  mcStats: MonteCarloStats | null;
  resultsCount: number;

  // Navigation with Main Panel
  activeWorkflowView: WorkflowView;
  onSelectWorkflowView: (view: WorkflowView) => void;
  activeMainTab: MainPanelTab;
  onSelectMainTab: (tab: MainPanelTab) => void;
  activeConfigCategory?: ConfigCategory;
  onSelectConfigCategory?: (cat: ConfigCategory) => void;
  onExportCSV: () => void;
  onExportRosterCSV: () => void;
  onOpenStandaloneModal: () => void;

  // Panel state
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  designMode?: 'studio' | 'cockpit' | 'minimal';
}

export const LeftPanelFlow: React.FC<LeftPanelFlowProps> = ({
  csvText,
  onCsvChange,
  demands,
  parseMetadata,
  intervalOverride,
  onIntervalOverrideChange,
  onLoadRetail,
  onLoadMultiSegment,
  onLoadWeeklyTrend,
  onLoadHourly,
  config,
  onChange,
  offCount,
  workingCount,
  onOpenConstraintsModal,
  onOpenConfigModal,
  isRunning,
  simulationProgress,
  onRunSimulation,
  isStale,
  lastRunInputs,
  summary,
  mcStats,
  resultsCount,
  activeWorkflowView,
  onSelectWorkflowView,
  activeMainTab,
  onSelectMainTab,
  activeConfigCategory = 'calendar',
  onSelectConfigCategory,
  onExportCSV,
  onExportRosterCSV,
  onOpenStandaloneModal,
  isCollapsed = false,
  onToggleCollapse,
  designMode = 'studio',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Demand metrics
  const totalVolume = demands.reduce((acc, d) => acc + d.volume, 0);
  const totalWorkloadSec = demands.reduce((acc, d) => acc + d.workloadSeconds, 0);
  const avgAht = totalVolume > 0 ? Math.round(totalWorkloadSec / totalVolume) : 0;
  const detectedInterval = parseMetadata?.detectedIntervalMinutes || (demands[0]?.intervalMinutes ?? 30);
  const peakErlangs = demands.length > 0 ? Math.max(...demands.map(d => d.trafficErlangs)) : 0;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      if (typeof evt.target?.result === 'string') {
        onCsvChange(evt.target.result);
        onSelectWorkflowView('upload');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = evt => {
        if (typeof evt.target?.result === 'string') {
          onCsvChange(evt.target.result);
          onSelectWorkflowView('upload');
        }
      };
      reader.readAsText(file);
    }
  };

  // If collapsed on desktop
  if (isCollapsed) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex flex-col items-center gap-4 w-16 shrink-0 shadow-lg">
        <button
          id="btnExpandLeftPanel"
          type="button"
          onClick={onToggleCollapse}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          title="Expand Workflow Panel"
        >
          <Sliders className="w-5 h-5" />
        </button>

        <div className="w-full h-px bg-slate-800 my-1" />

        <button
          onClick={() => onSelectWorkflowView('upload')}
          className={`p-2.5 rounded-xl transition ${
            activeWorkflowView === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="1. Upload CSV & Demand"
        >
          <UploadCloud className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectWorkflowView('config')}
          className={`p-2.5 rounded-xl transition ${
            activeWorkflowView === 'config' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="2. Config & Parameters"
        >
          <Sliders className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectWorkflowView('results')}
          className={`p-2.5 rounded-xl transition relative ${
            activeWorkflowView === 'results' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'
          }`}
          title="3. Simulation Results"
        >
          <BarChart3 className="w-5 h-5" />
          {isStale && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
        </button>
      </div>
    );
  }

  const panelWidth =
    designMode === 'cockpit'
      ? 'w-full lg:w-[350px] xl:w-[370px]'
      : designMode === 'minimal'
      ? 'w-full lg:w-[360px] xl:w-[380px]'
      : 'w-full lg:w-[380px] xl:w-[410px]';

  return (
    <div className={`${panelWidth} shrink-0 flex flex-col gap-3.5 transition-all duration-200`}>
      {/* Top Header / Workflow Step Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Workflow Steps</span>
          <span className="text-[10px] text-slate-500 font-mono">3 Stages</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400">
            Current: <strong className="text-white capitalize">{activeWorkflowView}</strong>
          </span>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="text-slate-400 hover:text-white p-1 rounded transition ml-1 text-xs"
              title="Collapse Panel"
            >
              &larr;
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: UPLOAD CSV (WITH CURRENT SAMPLE LOAD) */}
      {/* ========================================================================= */}
      <div
        id="panelStepUpload"
        className={`border rounded-2xl p-4 transition-all duration-200 shadow-md ${
          activeWorkflowView === 'upload'
            ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/40'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Step 1 Header & Selector Button */}
        <div
          onClick={() => onSelectWorkflowView('upload')}
          className="flex items-center justify-between cursor-pointer pb-3 border-b border-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition ${
                activeWorkflowView === 'upload'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              1
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Upload CSV
                {demands.length > 0 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </h3>
              <div className="text-[11px] text-slate-400">
                Demand forecast &amp; call arrivals
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectWorkflowView('upload');
            }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition ${
              activeWorkflowView === 'upload'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {activeWorkflowView === 'upload' ? 'Active View' : 'Open Explorer →'}
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {/* File Upload Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-xl p-3 text-center transition ${
              isDragOver
                ? 'border-blue-400 bg-blue-950/30'
                : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 text-xs text-slate-300 mb-1.5">
              <UploadCloud className="w-4 h-4 text-blue-400" />
              <span className="font-medium">Drop CSV file here or</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:text-blue-300 font-bold underline cursor-pointer"
              >
                Browse
              </button>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              RFC-4180 auto-detects date, interval, volume, AHT
            </div>
          </div>

          {/* Current Sample Load Buttons */}
          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Current Sample Load:</span>
              <span className="text-[10px] text-slate-500 font-mono">Pre-built datasets</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                id="btnLoadWeeklyTrend"
                onClick={() => {
                  onLoadWeeklyTrend();
                  onSelectWorkflowView('upload');
                }}
                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-600 rounded-lg text-left transition cursor-pointer"
              >
                <div className="text-[11px] font-bold text-blue-300 truncate">7-Day Trend</div>
                <div className="text-[9px] text-slate-500">84 Int &bull; Peak to dip</div>
              </button>

              <button
                type="button"
                id="btnLoadRetail"
                onClick={() => {
                  onLoadRetail();
                  onSelectWorkflowView('upload');
                }}
                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-600 rounded-lg text-left transition cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-200 truncate">Retail Voice</div>
                <div className="text-[9px] text-slate-500">30m Int &bull; Standard day</div>
              </button>

              <button
                type="button"
                id="btnLoadMultiSegment"
                onClick={() => {
                  onLoadMultiSegment();
                  onSelectWorkflowView('upload');
                }}
                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-600 rounded-lg text-left transition cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-200 truncate">Multi-Segment</div>
                <div className="text-[9px] text-slate-500">30m Int &bull; 2 Queues</div>
              </button>

              <button
                type="button"
                id="btnLoadHourly"
                onClick={() => {
                  onLoadHourly();
                  onSelectWorkflowView('upload');
                }}
                className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-600 rounded-lg text-left transition cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-200 truncate">Hourly Demand</div>
                <div className="text-[9px] text-slate-500">60m Int &bull; 24h cycle</div>
              </button>
            </div>
          </div>

          {/* Interval Resolution Override */}
          <div className="flex items-center justify-between bg-slate-950/90 p-2 rounded-xl border border-slate-800 text-xs">
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-blue-400" /> Resolution:
            </span>
            <select
              value={intervalOverride}
              onChange={e => onIntervalOverrideChange(parseInt(e.target.value, 10))}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-0.5 focus:outline-none"
            >
              <option value={0}>Auto ({detectedInterval}m)</option>
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={60}>60 min (1 hr)</option>
            </select>
          </div>

          {/* Active Demand Status Pill */}
          <div className="bg-slate-950/80 rounded-xl p-2.5 border border-slate-800/80 text-[11px] space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Loaded Intervals:</span>
              <strong className="text-white font-mono">{demands.length} rows</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Total Workload:</span>
              <strong className="text-emerald-400 font-mono">{totalVolume.toLocaleString()} calls</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mean AHT / Peak:</span>
              <strong className="text-amber-300 font-mono">{avgAht}s / {peakErlangs.toFixed(1)} Erl</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 2: CONFIG & PARAMS (WITH PARAM DETAILS IN TAB VIEW ON MAIN AREA) */}
      {/* ========================================================================= */}
      <div
        id="panelStepConfig"
        className={`border rounded-2xl p-4 transition-all duration-200 shadow-md ${
          activeWorkflowView === 'config'
            ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/40'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Step 2 Header & Selector Button */}
        <div
          onClick={() => onSelectWorkflowView('config')}
          className="flex items-center justify-between cursor-pointer pb-3 border-b border-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition ${
                activeWorkflowView === 'config'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              2
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Config &amp; Params
              </h3>
              <div className="text-[11px] text-slate-400">
                Staffing, shrinkage, SLA &amp; shifts
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectWorkflowView('config');
            }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition ${
              activeWorkflowView === 'config'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {activeWorkflowView === 'config' ? 'Active View' : 'Edit in Main Area →'}
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {/* Quick Config Live Metric Tags */}
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[10px] block font-sans">Headcount</span>
              <strong className="text-white text-xs">{config.totalHC} Gross</strong>
              <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                {workingCount} Active / {offCount} OFF
              </span>
            </div>

            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[10px] block font-sans">SLA Target</span>
              <strong className="text-blue-400 text-xs">{config.slaPercentTarget}%</strong>
              <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                in {config.slaThresholdSeconds}s threshold
              </span>
            </div>

            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[10px] block font-sans">Shrinkage Floor</span>
              <strong className="text-amber-300 text-xs">
                {Math.round((config.shrinkageTotal ?? 0.25) * 100)}% Total
              </strong>
              <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                7% Paid + {Math.round(((config.shrinkageTotal ?? 0.25) - 0.07) * 100)}% Flex
              </span>
            </div>

            <div className="p-2 bg-slate-950 rounded-xl border border-slate-800/80">
              <span className="text-slate-500 text-[10px] block font-sans">Erlang Model</span>
              <strong className="text-purple-300 text-xs truncate block">
                {config.erlangModel === 'erlang_a' ? 'Erlang A' : 'Erlang C'}
              </strong>
              <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                Max {config.maxOccupancyThreshold}% Occ
              </span>
            </div>
          </div>

          {/* Quick Tab Jump Chips on Main Area */}
          <div>
            <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
              Parameter Details in Tab View:
            </div>
            <div className="grid grid-cols-2 gap-1 text-[11px]">
              {[
                { id: 'calendar', label: '1. Calendar & Hours', icon: Calendar },
                { id: 'workforce', label: '2. Workforce & HC', icon: Users },
                { id: 'shifts', label: '3. Shifts & Rules', icon: ShieldCheck },
                { id: 'shrinkage', label: '4. Shrinkage', icon: Clock },
                { id: 'sla_queue', label: '5. SLA & Queue', icon: Target },
                { id: 'simulation', label: '6. Engine & Seed', icon: Cpu },
              ].map(cat => {
                const Icon = cat.icon;
                const isSelected = activeWorkflowView === 'config' && activeConfigCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkflowView('config');
                      if (onSelectConfigCategory) onSelectConfigCategory(cat.id as ConfigCategory);
                    }}
                    className={`p-1.5 rounded-lg border text-left flex items-center gap-1.5 transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                        : 'bg-slate-950/80 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-3 h-3 text-blue-400 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              type="button"
              onClick={onOpenConstraintsModal}
              className="flex-1 py-1.5 text-xs text-purple-300 bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 rounded-xl transition cursor-pointer"
            >
              🛡️ Labor Rules
            </button>
            <button
              type="button"
              onClick={onOpenConfigModal}
              className="flex-1 py-1.5 text-xs text-slate-300 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
            >
              ⚙️ Project Config
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 3: RESULTS (MAIN SIMULATION EXECUTION & OUTCOMES) */}
      {/* ========================================================================= */}
      <div
        id="panelStepResult"
        className={`border rounded-2xl p-4 transition-all duration-200 shadow-md ${
          activeWorkflowView === 'results'
            ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500/40'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Step 3 Header & Selector Button */}
        <div
          onClick={() => onSelectWorkflowView('results')}
          className="flex items-center justify-between cursor-pointer pb-3 border-b border-slate-800"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs transition ${
                activeWorkflowView === 'results'
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              3
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                Results
                {summary && !isStale && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                {isStale && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              </h3>
              <div className="text-[11px] text-slate-400">
                Discrete event &amp; Erlang metrics
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectWorkflowView('results');
            }}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition ${
              activeWorkflowView === 'results'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {activeWorkflowView === 'results' ? 'Active View' : 'View Details →'}
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {/* Standout Primary "Run Simulation" Button */}
          <button
            type="button"
            id="btnLeftRunSim"
            onClick={() => {
              onRunSimulation();
              onSelectWorkflowView('results');
            }}
            disabled={isRunning || demands.length === 0}
            className={`w-full py-3 px-4 rounded-xl font-bold text-xs text-white shadow-lg transition flex items-center justify-center gap-2 cursor-pointer ${
              isRunning
                ? 'bg-blue-800 cursor-wait'
                : isStale
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
            }`}
          >
            <Play className={`w-4 h-4 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span>
              {isRunning
                ? `Simulating... ${simulationProgress ?? 0}%`
                : isStale
                ? 'Run Simulation (Inputs Changed)'
                : 'Run Simulation'}
            </span>
          </button>

          {/* Stale Warning Chip */}
          {isStale && (
            <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Inputs changed. Click Run to refresh results.</span>
            </div>
          )}

          {/* KPI Outcome Badges */}
          {summary ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Overall SLA</span>
                  <span
                    className={`text-base font-extrabold ${
                      summary.slaPercent >= config.slaPercentTarget
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {summary.slaPercent.toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                    Target: {config.slaPercentTarget}%
                  </span>
                </div>

                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Speed of Answer</span>
                  <span className="text-base font-extrabold text-white">
                    {summary.asaSeconds.toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                    ASA Queue Wait
                  </span>
                </div>

                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Abandon Rate</span>
                  <span className="text-base font-extrabold text-amber-300">
                    {(summary.abandonPercent ?? 0).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                    Patience expired
                  </span>
                </div>

                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 font-sans block">Avg Occupancy</span>
                  <span className="text-base font-extrabold text-purple-300">
                    {(summary.occupancyPercent ?? 0).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-slate-400 block font-sans mt-0.5">
                    Floor {config.maxOccupancyThreshold}%
                  </span>
                </div>
              </div>

              {/* Main Area Sub-Tab Shortcuts for Results */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold text-slate-300 mb-1.5">
                  Explore Results Views:
                </div>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'kpis', label: 'KPIs', icon: BarChart3 },
                    { id: 'roster', label: 'Roster', icon: Calendar },
                    { id: 'comparison', label: 'Intervals', icon: Table },
                    { id: 'charts', label: 'Charts', icon: BarChart3 },
                    { id: 'insights', label: 'Solver', icon: Lightbulb },
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isTabActive = activeWorkflowView === 'results' && activeMainTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          onSelectWorkflowView('results');
                          onSelectMainTab(tab.id as MainPanelTab);
                        }}
                        className={`px-2 py-1 rounded-lg text-[10px] font-semibold border flex items-center gap-1 transition cursor-pointer ${
                          isTabActive
                            ? 'bg-blue-600 border-blue-500 text-white shadow'
                            : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center text-xs text-slate-400">
              No simulation executed yet. Click &quot;Run Simulation&quot; above to calculate discrete-event metrics.
            </div>
          )}

          {/* Export Action Buttons */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5">
            <button
              type="button"
              onClick={onExportCSV}
              className="flex-1 py-1 px-2 text-[10px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg transition"
              title="Export Interval Simulation Results CSV"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={onExportRosterCSV}
              className="flex-1 py-1 px-2 text-[10px] font-medium bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 rounded-lg transition"
              title="Export Weekly Staffing Roster CSV"
            >
              Roster
            </button>
            <button
              type="button"
              onClick={onOpenStandaloneModal}
              className="flex-1 py-1 px-2 text-[10px] font-medium bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-800 rounded-lg transition"
              title="Copy or Download Single Standalone HTML"
            >
              HTML
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
