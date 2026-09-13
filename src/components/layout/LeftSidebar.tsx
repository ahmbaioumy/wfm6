import React, { useState, useRef } from 'react';
import {
  WorkforceConfig,
  DemandRow,
  DemandParseResult,
  ChannelType,
} from '../../types';
import {
  Database,
  Users,
  Radio,
  Clock,
  Percent,
  Calendar,
  UserCheck,
  Cpu,
  Calculator,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Upload,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';

export interface LeftSidebarProps {
  config: WorkforceConfig;
  onChange?: (updated: Partial<WorkforceConfig>) => void;
  onUpdateConfig?: (updated: Partial<WorkforceConfig>) => void;
  demands?: DemandRow[];
  parseResult?: Partial<DemandParseResult> | null;
  intervalCount?: number;
  intervalOverride: number;
  onIntervalOverrideChange: (val: number) => void;
  onUploadCSV: (csvText: string) => void;
  onLoadRetail: () => void;
  onLoadMultiSegment: () => void;
  onLoadWeeklyTrend: () => void;
  onLoadHourly: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  activeGroup?: string;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  config,
  onChange,
  onUpdateConfig,
  demands = [],
  parseResult,
  intervalCount,
  intervalOverride,
  onIntervalOverrideChange,
  onUploadCSV,
  onLoadRetail,
  onLoadMultiSegment,
  onLoadWeeklyTrend,
  onLoadHourly,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const effectiveCollapsed = isCollapsed ?? internalCollapsed;
  const handleToggle = onToggleCollapse || (() => setInternalCollapsed(prev => !prev));

  const handleConfigChange = (updated: Partial<WorkforceConfig>) => {
    if (onChange) onChange(updated);
    if (onUpdateConfig) onUpdateConfig(updated);
  };

  // Accordion open states
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    data: true,
    headcount: true,
    channel: false,
    hours: false,
    capacity: false,
    roster: false,
    teams: false,
    simulation: false,
    erlang: false,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) onUploadCSV(text);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const uniqueDates = parseResult?.uniqueDates || Array.from(new Set((demands || []).map(d => d.date)));
  const uniqueSegments = parseResult?.uniqueSegments || Array.from(new Set((demands || []).map(d => d.segment)));
  const detectedStep = parseResult?.detectedIntervalMinutes ?? (demands?.[0]?.intervalMinutes || 30);
  const totalRows = intervalCount ?? (demands?.length || 0);

  // Collapsed Rail View
  if (effectiveCollapsed) {
    return (
      <aside className="w-[56px] shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-2 sticky top-[64px] h-[calc(100vh-64px)] z-30 select-none">
        <button
          type="button"
          onClick={handleToggle}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer mb-2"
          title="Expand Left Configuration Panel"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-8 h-px bg-slate-800 my-1" />

        {[
          { key: 'data', icon: Database, label: 'Data' },
          { key: 'headcount', icon: Users, label: 'Headcount' },
          { key: 'channel', icon: Radio, label: 'Channel & Queue' },
          { key: 'hours', icon: Clock, label: 'Working Hours' },
          { key: 'capacity', icon: Percent, label: 'Capacity Loss' },
          { key: 'roster', icon: Calendar, label: 'Roster' },
          { key: 'teams', icon: UserCheck, label: 'Teams & People' },
          { key: 'simulation', icon: Cpu, label: 'Simulation' },
          { key: 'erlang', icon: Calculator, label: 'Erlang' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                handleToggle();
                setOpenGroups({ ...openGroups, [item.key]: true });
              }}
              className="p-2.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition cursor-pointer group relative"
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </aside>
    );
  }

  // Expanded Left Panel (300-340px, fixed/sticky, independently scrollable)
  return (
    <aside className="w-[320px] shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col sticky top-[64px] h-[calc(100vh-64px)] z-30 select-none shadow-lg">
      {/* Panel Header */}
      <div className="h-[48px] px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Simulation Parameters
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          title="Collapse Panel (Alt + [)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Accordion Scroll Container */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 text-xs">
        {/* ========================================================================= */}
        {/* GROUP 1: DATA */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('data')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-200">1. Data</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {totalRows} rows · {detectedStep}m
              </span>
              {openGroups.data ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.data && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              {/* File upload actions */}
              <div>
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
                  className="w-full py-2 px-3 rounded-lg bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 text-blue-300 font-semibold flex items-center justify-center gap-2 transition cursor-pointer text-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload / Replace CSV File</span>
                </button>
              </div>

              {/* Sample Presets */}
              <div>
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">Load Benchmark Presets:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={onLoadRetail}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer text-center"
                  >
                    Retail Voice
                  </button>
                  <button
                    type="button"
                    onClick={onLoadMultiSegment}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer text-center"
                  >
                    Multi-Queue
                  </button>
                  <button
                    type="button"
                    onClick={onLoadWeeklyTrend}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer text-center"
                  >
                    Weekly Trend
                  </button>
                  <button
                    type="button"
                    onClick={onLoadHourly}
                    className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition cursor-pointer text-center"
                  >
                    Hourly Voice
                  </button>
                </div>
              </div>

              {/* Interval & Quality Info */}
              <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] space-y-1 font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Horizon:</span>
                  <span className="font-semibold text-white">{uniqueDates.length} Days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Intervals:</span>
                  <span className="font-semibold text-white">{totalRows}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Detected Step:</span>
                  <span className="font-semibold text-emerald-400">{detectedStep} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Segments:</span>
                  <span className="font-semibold text-purple-300">{uniqueSegments.join(', ') || '1'}</span>
                </div>
              </div>

              {/* Interval Override */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Interval Override:</label>
                <select
                  value={intervalOverride}
                  onChange={(e) => onIntervalOverrideChange(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value={0}>Auto Detect ({detectedStep}m)</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (Hourly)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 2: HEADCOUNT */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('headcount')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">2. Headcount</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.totalHC} HC · {config.headcountAllocationMode || 'Common'}
              </span>
              {openGroups.headcount ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.headcount && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-medium text-slate-300">Total Gross HC (People):</label>
                  <span className="text-xs font-mono font-bold text-emerald-400">{config.totalHC}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={500}
                  value={config.totalHC}
                  onChange={(e) => onChange({ totalHC: parseInt(e.target.value, 10) || 1 })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 HC</span>
                  <span>250 HC</span>
                  <span>500 HC</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Allocation Mode:</label>
                <select
                  value={config.headcountAllocationMode || 'common'}
                  onChange={(e) => onChange({ headcountAllocationMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="common">Common (Even distribution)</option>
                  <option value="dedicated">Dedicated (Specific HC per Segment)</option>
                  <option value="shared">Shared Pool</option>
                  <option value="blended">Blended (Cross-skilled)</option>
                </select>
              </div>

              {/* Segment HC breakdown if dedicated or multiple segments */}
              {uniqueSegments.length > 1 && (
                <div className="space-y-1.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Segment HC Allocation:
                  </div>
                  {uniqueSegments.map(seg => (
                    <div key={seg} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300 truncate">{seg}:</span>
                      <input
                        type="number"
                        min={0}
                        max={config.totalHC}
                        value={config.segmentHC?.[seg] ?? Math.floor(config.totalHC / uniqueSegments.length)}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          onChange({
                            segmentHC: {
                              ...config.segmentHC,
                              [seg]: val,
                            },
                          });
                        }}
                        className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-right font-mono text-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 3: CHANNEL & QUEUE */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('channel')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-slate-200">3. Channel &amp; Queue</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.slaPercentTarget}% in {config.slaThresholdSeconds}s
              </span>
              {openGroups.channel ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.channel && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Target SLA %:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={config.slaPercentTarget}
                      onChange={(e) => onChange({ slaPercentTarget: parseInt(e.target.value, 10) || 80 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                    <span className="text-slate-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">SLA Seconds:</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={600}
                      value={config.slaThresholdSeconds}
                      onChange={(e) => onChange({ slaThresholdSeconds: parseInt(e.target.value, 10) || 20 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                    <span className="text-slate-400">s</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Patience (s):</label>
                  <input
                    type="number"
                    min={10}
                    max={1800}
                    value={config.defaultPatienceSeconds ?? 120}
                    onChange={(e) => onChange({ defaultPatienceSeconds: parseInt(e.target.value, 10) || 120 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Short Abandon (s):</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={config.shortAbandonThresholdSeconds ?? 5}
                    onChange={(e) => onChange({ shortAbandonThresholdSeconds: parseInt(e.target.value, 10) || 5 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Chat/Msg Concurrency:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={config.chatConcurrency ?? 1}
                    onChange={(e) => onChange({ chatConcurrency: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <span className="text-[11px] text-slate-400">
                    (Voice is strictly 1 concurrency)
                  </span>
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.excludeShortAbandons ?? true}
                  onChange={(e) => onChange({ excludeShortAbandons: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 accent-blue-600"
                />
                <span>Exclude Short Abandons from SLA denominator</span>
              </label>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 4: WORKING HOURS */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('hours')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-200">4. Working Hours</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.businessHoursStart}–{config.businessHoursEnd} · {config.dailyPaidHours}h
              </span>
              {openGroups.hours ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.hours && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              {/* Business Operating Days Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-medium text-slate-300">
                    Business Operating Days:
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    {config.operatingDays && config.operatingDays.length > 0 ? `${config.operatingDays.length}/7 Days Open` : '7/7 Days Open'}
                  </span>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                    const currentDays = config.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const isSelected = currentDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          let updated: string[];
                          if (isSelected) {
                            // Don't allow deselecting all days
                            if (currentDays.length <= 1) return;
                            updated = currentDays.filter(d => d !== day);
                          } else {
                            updated = [...currentDays, day];
                          }
                          onChange({ operatingDays: updated });
                        }}
                        className={`py-1.5 text-[10px] font-mono font-bold rounded transition text-center ${
                          isSelected
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'bg-slate-950 text-slate-500 border border-slate-800 hover:text-slate-300'
                        }`}
                        title={`${day}: ${isSelected ? 'Business Open' : 'Business Closed'}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Days the center operates. Distinct from agent work days (e.g. 5 work / 2 off).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Operating Start:</label>
                  <input
                    type="time"
                    value={config.businessHoursStart || '08:00'}
                    onChange={(e) => onChange({ businessHoursStart: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Operating End:</label>
                  <input
                    type="time"
                    value={config.businessHoursEnd || '18:00'}
                    onChange={(e) => onChange({ businessHoursEnd: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Paid Hours:</label>
                  <input
                    type="number"
                    min={4}
                    max={12}
                    value={config.dailyPaidHours}
                    onChange={(e) => onChange({ dailyPaidHours: parseInt(e.target.value, 10) || 8 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Work Days:</label>
                  <input
                    type="number"
                    min={4}
                    max={7}
                    value={config.workDaysPerWeek}
                    onChange={(e) => onChange({ workDaysPerWeek: parseInt(e.target.value, 10) || 5 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">OFF Days:</label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={config.offDaysPerWeek}
                    onChange={(e) => onChange({ offDaysPerWeek: parseInt(e.target.value, 10) || 2 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Min Rest Hours:</label>
                  <input
                    type="number"
                    min={8}
                    max={16}
                    value={config.minRestHoursBetweenShifts ?? 12}
                    onChange={(e) => onChange({ minRestHoursBetweenShifts: parseInt(e.target.value, 10) || 12 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Max Consec. Days:</label>
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={config.maxConsecutiveWorkDays ?? 6}
                    onChange={(e) => onChange({ maxConsecutiveWorkDays: parseInt(e.target.value, 10) || 6 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is24x7 ?? false}
                  onChange={(e) => onChange({ is24x7: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600 accent-cyan-600"
                />
                <span>24 / 7 Operations (Continuous Coverage)</span>
              </label>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 5: CAPACITY LOSS */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('capacity')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Percent className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold text-slate-200">5. Capacity Loss</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {Math.round(config.shrinkageTotal * 100)}% Shrink · {Math.round((config.adherence ?? 0.9) * 100)}% Adh
              </span>
              {openGroups.capacity ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.capacity && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-300">Protected Break %:</label>
                  <span className="text-xs font-mono font-semibold text-purple-300">
                    {Math.round((config.shrinkageBreakPercent ?? 0.07) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={Math.round((config.shrinkageBreakPercent ?? 0.07) * 100)}
                  onChange={(e) => onChange({ shrinkageBreakPercent: parseInt(e.target.value, 10) / 100 })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-300">Out-of-Office Shrinkage %:</label>
                  <span className="text-xs font-mono font-semibold text-purple-300">
                    {Math.round((config.shrinkageOutOffice ?? 0.12) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={35}
                  value={Math.round((config.shrinkageOutOffice ?? 0.12) * 100)}
                  onChange={(e) => onChange({ shrinkageOutOffice: parseInt(e.target.value, 10) / 100 })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-300">In-Office Shrinkage %:</label>
                  <span className="text-xs font-mono font-semibold text-purple-300">
                    {Math.round((config.shrinkageInOffice ?? 0.13) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={35}
                  value={Math.round((config.shrinkageInOffice ?? 0.13) * 100)}
                  onChange={(e) => onChange({ shrinkageInOffice: parseInt(e.target.value, 10) / 100 })}
                  className="w-full accent-purple-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] text-slate-300">Schedule Adherence %:</label>
                  <span className="text-xs font-mono font-semibold text-emerald-400">
                    {Math.round((config.adherence ?? 0.90) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={Math.round((config.adherence ?? 0.90) * 100)}
                  onChange={(e) => onChange({ adherence: parseInt(e.target.value, 10) / 100 })}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div className="pt-1 border-t border-slate-800/80">
                <label className="block text-[11px] text-slate-400 mb-1">Shrinkage Distribution Mode:</label>
                <select
                  value={config.shrinkageDistributionMode || 'dynamic_volume_trend'}
                  onChange={(e) => onChange({ shrinkageDistributionMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="dynamic_volume_trend">Dynamic Volume Trend</option>
                  <option value="flat">Flat Distribution</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 6: ROSTER */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('roster')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-slate-200">6. Roster &amp; Shifts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.dailyPaidHours}h · {config.shiftStartStepMinutes ?? 30}m Starts
              </span>
              {openGroups.roster ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.roster && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Min Shift (h):</label>
                  <input
                    type="number"
                    min={4}
                    max={8}
                    value={config.minShiftHours ?? 6}
                    onChange={(e) => onChange({ minShiftHours: parseInt(e.target.value, 10) || 6 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Max Shift (h):</label>
                  <input
                    type="number"
                    min={8}
                    max={12}
                    value={config.maxShiftHours ?? 10}
                    onChange={(e) => onChange({ maxShiftHours: parseInt(e.target.value, 10) || 10 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Shift Start Increment:</label>
                <select
                  value={config.shiftStartStepMinutes ?? 30}
                  onChange={(e) => onChange({ shiftStartStepMinutes: parseInt(e.target.value, 10) as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value={30}>Every 30 Minutes</option>
                  <option value={60}>Every 60 Minutes (Hourly)</option>
                  <option value={15}>Every 15 Minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Minimum Coverage (Floor):</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={config.minCoverage ?? 2}
                  onChange={(e) => onChange({ minCoverage: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.requireConsecutiveOff ?? true}
                    onChange={(e) => onChange({ requireConsecutiveOff: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 accent-indigo-600"
                  />
                  <span>Require Consecutive OFF Days</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.splitBreaks ?? false}
                    onChange={(e) => onChange({ splitBreaks: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 accent-indigo-600"
                  />
                  <span>Split Breaks (2 separate rest sessions)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 7: TEAMS & PEOPLE */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('teams')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-pink-400" />
              <span className="font-semibold text-slate-200">7. Teams &amp; Demographics</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.teamSize ?? 10}/tm · {config.genderFemalePercent ?? 40}% F
              </span>
              {openGroups.teams ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.teams && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Team Size:</label>
                  <input
                    type="number"
                    min={4}
                    max={30}
                    value={config.teamSize ?? 10}
                    onChange={(e) => onChange({ teamSize: parseInt(e.target.value, 10) || 10 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Female HC %:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={config.genderFemalePercent ?? 40}
                    onChange={(e) => onChange({ genderFemalePercent: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Female Earliest:</label>
                  <input
                    type="time"
                    value={config.femaleEarliestStart || '06:00'}
                    onChange={(e) => onChange({ femaleEarliestStart: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Female Latest:</label>
                  <input
                    type="time"
                    value={config.femaleLatestFinish || '22:00'}
                    onChange={(e) => onChange({ femaleLatestFinish: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.femaleConstraintStrict ?? true}
                  onChange={(e) => onChange({ femaleConstraintStrict: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-pink-600 accent-pink-600"
                />
                <span>Strict Female Labor Curfew Enforcement</span>
              </label>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 8: SIMULATION */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('simulation')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">8. Simulation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.arrivalMode === 'fixed_forecast' ? 'Fixed' : 'Poisson'} · Seed {config.seed ?? 42}
              </span>
              {openGroups.simulation ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.simulation && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Arrival Mode:</label>
                <select
                  value={config.arrivalMode || 'fixed_forecast'}
                  onChange={(e) => onChange({ arrivalMode: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="fixed_forecast">Fixed Forecast (Exact CSV Volume)</option>
                  <option value="poisson">Poisson Uncertainty (Stochastic Volume)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">AHT Distribution:</label>
                <select
                  value={config.serviceTimeDist || 'fixed'}
                  onChange={(e) => onChange({ serviceTimeDist: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="fixed">Fixed (Constant AHT)</option>
                  <option value="lognormal">Lognormal (Empirical Call Duration)</option>
                  <option value="exponential">Exponential (Markovian)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Random Seed:</label>
                  <input
                    type="number"
                    value={config.seed ?? 42}
                    onChange={(e) => onChange({ seed: parseInt(e.target.value, 10) || 42 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">MC Replications:</label>
                  <input
                    type="number"
                    min={5}
                    max={100}
                    value={config.monteCarloRuns ?? 25}
                    onChange={(e) => onChange({ monteCarloRuns: parseInt(e.target.value, 10) || 25 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* GROUP 9: ERLANG */}
        {/* ========================================================================= */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <button
            type="button"
            onClick={() => toggleGroup('erlang')}
            className="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-slate-800/50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Calculator className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-slate-200">9. Erlang Benchmark</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                {config.erlangModel === 'erlang_a' ? 'Erlang A' : config.erlangModel === 'erlang_b' ? 'Erlang B' : 'Erlang C'} · {config.maxOccupancyThreshold}% Occ
              </span>
              {openGroups.erlang ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </div>
          </button>

          {openGroups.erlang && (
            <div className="p-3 border-t border-slate-800/80 space-y-3 bg-slate-900/30">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Benchmark Model:</label>
                <select
                  value={config.erlangModel || 'erlang_c'}
                  onChange={(e) => onChange({ erlangModel: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                >
                  <option value="erlang_c">Erlang C (Standard Queueing Benchmark)</option>
                  <option value="erlang_a">Erlang A (With Customer Abandonment)</option>
                  <option value="erlang_b">Erlang B (Blocking / Loss System)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Occupancy Ceiling %:</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={config.maxOccupancyThreshold}
                    onChange={(e) => onChange({ maxOccupancyThreshold: parseInt(e.target.value, 10) || 85 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-slate-400">%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
