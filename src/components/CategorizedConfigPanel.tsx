import React, { useState } from 'react';
import {
  Calendar,
  Users,
  ShieldCheck,
  Clock,
  Target,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import {
  WorkforceConfig,
  ErlangModelType,
  ArrivalMode,
  ServiceTimeDist,
  PatienceDist,
  QueueAttribution,
  QueueClosureBehavior,
  MissingDataStrategy,
  OffDistributionMode,
} from '../types';
import { BusinessCalendarCard } from './BusinessCalendarCard';

export type ConfigCategory =
  | 'calendar'
  | 'workforce'
  | 'shifts'
  | 'shrinkage'
  | 'sla_queue'
  | 'simulation';

interface CategorizedConfigPanelProps {
  config: WorkforceConfig;
  onChange: (updated: Partial<WorkforceConfig>) => void;
  offCount: number;
  workingCount: number;
  onOpenConstraintsModal?: () => void;
  activeCategory?: ConfigCategory;
  onSelectCategory?: (category: ConfigCategory) => void;
  onRunSimulation?: () => void;
  isRunning?: boolean;
}

export const CategorizedConfigPanel: React.FC<CategorizedConfigPanelProps> = ({
  config,
  onChange,
  offCount,
  workingCount,
  onOpenConstraintsModal,
  activeCategory,
  onSelectCategory,
  onRunSimulation,
  isRunning,
}) => {
  const [internalTab, setInternalTab] = useState<ConfigCategory>('calendar');
  const activeTab = activeCategory || internalTab;
  const setActiveTab = (tab: ConfigCategory) => {
    setInternalTab(tab);
    if (onSelectCategory) onSelectCategory(tab);
  };
  const [viewMode, setViewMode] = useState<'tabs' | 'all'>('tabs');

  const categories: { id: ConfigCategory; label: string; icon: React.FC<{ className?: string }>; badge: string }[] = [
    {
      id: 'calendar',
      label: 'Calendar & Operating Windows',
      icon: Calendar,
      badge: config.is24x7 ? '24/7' : `${config.businessHoursStart}–${config.businessHoursEnd}`,
    },
    {
      id: 'workforce',
      label: 'Workforce & Headcount',
      icon: Users,
      badge: `${config.totalHC} HC`,
    },
    {
      id: 'shifts',
      label: 'Shifts & Labor Rules',
      icon: ShieldCheck,
      badge: `${config.genderFemalePercent}% 👩 / ${100 - (config.genderFemalePercent ?? 40)}% 👨`,
    },
    {
      id: 'shrinkage',
      label: 'Shrinkage & Adherence',
      icon: Clock,
      badge: `${Math.round((config.shrinkageTotal ?? 0.25) * 100)}% Total`,
    },
    {
      id: 'sla_queue',
      label: 'SLA Targets & Queue Modeling',
      icon: Target,
      badge: `${config.slaPercentTarget}% in ${config.slaThresholdSeconds}s`,
    },
    {
      id: 'simulation',
      label: 'Simulation & Monte Carlo',
      icon: Cpu,
      badge: `${config.monteCarloRuns} runs / Seed ${config.seed}`,
    },
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-md space-y-5 text-slate-100 mb-6">
      {/* Panel Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Simulator Parameters &amp; Assumptions
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                Organized by Category
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure operating calendar, labor rules, workforce sizing, shrinkage breakdown, and queueing models.
            </p>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('tabs')}
              className={`px-3 py-1 rounded font-medium transition cursor-pointer ${
                viewMode === 'tabs'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Category Tabs
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 rounded font-medium transition cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-blue-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Categories
            </button>
          </div>
        </div>
      </div>

      {/* Category Navigation Pills (When in Tab mode) */}
      {viewMode === 'tabs' && (
        <div className="flex flex-wrap gap-2 pt-1 border-b border-slate-800/60 pb-3">
          {categories.map(cat => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  isActive
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/30'
                    : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {cat.badge}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category Content Sections */}
      <div className="space-y-6">
        {/* Category 1: Business Calendar & Working Windows */}
        {(viewMode === 'all' || activeTab === 'calendar') && (
          <div className="space-y-3">
            {viewMode === 'all' && (
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Calendar className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Category 1: Business Calendar &amp; Operating Windows
                </h3>
              </div>
            )}
            <BusinessCalendarCard config={config} onChange={onChange} />
          </div>
        )}

        {/* Category 2: Workforce & Capacity */}
        {(viewMode === 'all' || activeTab === 'workforce') && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {viewMode === 'all' ? 'Category 2: ' : ''}Workforce Capacity &amp; Headcount
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded border border-emerald-800">
                {config.totalHC} HC ({workingCount} Active / {offCount} OFF)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Available Total Headcount (HC)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={config.totalHC ?? 150}
                  onChange={e => onChange({ totalHC: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Gross agents simulated across weekly schedules
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Daily Paid Hours / Shift
                </label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={config.dailyPaidHours ?? 8}
                  onChange={e => onChange({ dailyPaidHours: Math.max(1, Math.min(24, parseFloat(e.target.value) || 8)) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Standard shift paid duration (1 to 24 hours)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  OFF Days Target (Per Agent / Wk)
                </label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={config.offDaysPerWeek ?? 1}
                  onChange={e => {
                    const off = Math.max(0, Math.min(6, parseInt(e.target.value, 10) || 0));
                    onChange({
                      offDaysPerWeek: off,
                      workDaysPerWeek: 7 - off,
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Work days/wk: {config.workDaysPerWeek ?? 6} days
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  OFF Distribution Mode
                </label>
                <select
                  value={config.offDistributionMode || 'dynamic_volume_trend'}
                  onChange={e => onChange({ offDistributionMode: e.target.value as OffDistributionMode })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="dynamic_volume_trend">Dynamic Volume Trend (Low volume days get more OFFs)</option>
                  <option value="flat">Flat Weekly Rotation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Chat / Digital Concurrency (1–5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={config.chatConcurrency ?? 1}
                  onChange={e => onChange({ chatConcurrency: Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 1)) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Voice = 1; Chat/Messaging = 2–5 concurrent sessions
                </p>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={!!config.chatAhtDegradation}
                    onChange={e => onChange({ chatAhtDegradation: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Enable Multi-chat AHT Degradation (+15%/concurrency)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Category 3: Shifts & Labor Rules */}
        {(viewMode === 'all' || activeTab === 'shifts') && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {viewMode === 'all' ? 'Category 3: ' : ''}Shifts &amp; Labor Policy Rules
                </h3>
              </div>
              {onOpenConstraintsModal && (
                <button
                  type="button"
                  onClick={onOpenConstraintsModal}
                  className="text-xs text-purple-300 hover:text-white underline font-medium cursor-pointer"
                >
                  Open Full Policy Dialog
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Female Ratio (% HC)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.genderFemalePercent ?? 40}
                  onChange={e => onChange({ genderFemalePercent: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {Math.round(config.totalHC * ((config.genderFemalePercent ?? 40) / 100))} 👩 / {config.totalHC - Math.round(config.totalHC * ((config.genderFemalePercent ?? 40) / 100))} 👨
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Female Curfew Bounds
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={config.femaleEarliestStart || '06:00'}
                    onChange={e => onChange({ femaleEarliestStart: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="time"
                    value={config.femaleLatestFinish || '22:00'}
                    onChange={e => onChange({ femaleLatestFinish: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Curfew window (Hard constraint)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Min Rest Between Shifts (hrs)
                </label>
                <input
                  type="number"
                  min={8}
                  max={24}
                  value={config.minRestHoursBetweenShifts ?? 12}
                  onChange={e => onChange({ minRestHoursBetweenShifts: Math.max(8, parseInt(e.target.value, 10) || 12) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Default 12 hours minimum rest
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Pod Size (Agents)
                </label>
                <input
                  type="number"
                  min={4}
                  max={50}
                  value={config.teamSize ?? 10}
                  onChange={e => onChange({ teamSize: Math.max(4, parseInt(e.target.value, 10) || 10) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {Math.ceil(config.totalHC / (config.teamSize || 10))} Pods with 1 Supervisor each
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Category 4: Shrinkage & Adherence */}
        {(viewMode === 'all' || activeTab === 'shrinkage') && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {viewMode === 'all' ? 'Category 4: ' : ''}Shrinkage Breakdown &amp; Schedule Adherence
                </h3>
              </div>
              <span className="text-xs font-mono text-amber-300 bg-amber-950 px-2.5 py-0.5 rounded border border-amber-800">
                Total Shrinkage: {Math.round((config.shrinkageTotal ?? 0.25) * 100)}% | Adherence: {Math.round((config.adherence ?? 0.90) * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Breaks Floor (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={Math.round((config.shrinkageBreakPercent ?? 0.07) * 100)}
                  onChange={e => {
                    const brk = (parseFloat(e.target.value) || 0) / 100;
                    const ooo = config.shrinkageOutOffice ?? 0.12;
                    const inOff = config.shrinkageInOffice ?? 0.13;
                    onChange({
                      shrinkageBreakPercent: brk,
                      shrinkageTotal: brk + ooo + inOff,
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Non-reducible scheduled breaks (e.g. 7%)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Out-of-Office (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={Math.round((config.shrinkageOutOffice ?? 0.12) * 100)}
                  onChange={e => {
                    const ooo = (parseFloat(e.target.value) || 0) / 100;
                    const brk = config.shrinkageBreakPercent ?? 0.07;
                    const inOff = config.shrinkageInOffice ?? 0.13;
                    onChange({
                      shrinkageOutOffice: ooo,
                      shrinkageTotal: brk + ooo + inOff,
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Leaves, sick, unplanned absences (e.g. 12%)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  In-Office (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={Math.round((config.shrinkageInOffice ?? 0.13) * 100)}
                  onChange={e => {
                    const inOff = (parseFloat(e.target.value) || 0) / 100;
                    const brk = config.shrinkageBreakPercent ?? 0.07;
                    const ooo = config.shrinkageOutOffice ?? 0.12;
                    onChange({
                      shrinkageInOffice: inOff,
                      shrinkageTotal: brk + ooo + inOff,
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Coaching, 1-on-1s, aux &amp; prayer (e.g. 13%)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Schedule Adherence (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={Math.round((config.adherence ?? 0.90) * 100)}
                  onChange={e => onChange({ adherence: (parseFloat(e.target.value) || 90) / 100 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Punctuality factor on active hours (e.g. 90%)</p>
              </div>
            </div>
          </div>
        )}

        {/* Category 5: SLA Targets & Queue Modeling */}
        {(viewMode === 'all' || activeTab === 'sla_queue') && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {viewMode === 'all' ? 'Category 5: ' : ''}Service Level Targets &amp; Queue Rules
                </h3>
              </div>
              <span className="text-xs font-mono text-rose-300 bg-rose-950 px-2.5 py-0.5 rounded border border-rose-800">
                SLA Goal: {config.slaPercentTarget}% &le; {config.slaThresholdSeconds}s
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target SLA (% / Seconds)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.slaPercentTarget ?? 90}
                    onChange={e => onChange({ slaPercentTarget: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 90)) })}
                    className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-slate-400 text-xs">% in</span>
                  <input
                    type="number"
                    min={1}
                    max={300}
                    value={config.slaThresholdSeconds ?? 20}
                    onChange={e => onChange({ slaThresholdSeconds: Math.max(1, parseInt(e.target.value, 10) || 20) })}
                    className="w-1/2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-slate-400 text-xs">s</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Customer Patience (Seconds)
                </label>
                <input
                  type="number"
                  min={10}
                  max={1800}
                  value={config.defaultPatienceSeconds ?? 120}
                  onChange={e => onChange({ defaultPatienceSeconds: Math.max(10, parseInt(e.target.value, 10) || 120) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Mean time before callers abandon queue</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Erlang Benchmark Model
                </label>
                <select
                  value={config.erlangModel || 'erlang_c'}
                  onChange={e => onChange({ erlangModel: e.target.value as ErlangModelType })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="erlang_c">Erlang C (Infinite Queue)</option>
                  <option value="erlang_a">Erlang A (With Reneging)</option>
                  <option value="erlang_b">Erlang B (Blocking Loss)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Queue Closure Behavior
                </label>
                <select
                  value={config.queueClosureBehavior || 'finish_queued'}
                  onChange={e => onChange({ queueClosureBehavior: e.target.value as QueueClosureBehavior })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="finish_queued">Finish Queued Calls (Default)</option>
                  <option value="abandon_at_closure">Abandon at Closure</option>
                  <option value="carry_forward">Carry Forward to Next Day</option>
                  <option value="overtime_clearance">Overtime Clearance</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Category 6: Simulation Engine & Monte Carlo */}
        {(viewMode === 'all' || activeTab === 'simulation') && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {viewMode === 'all' ? 'Category 6: ' : ''}Simulation Engine &amp; Monte Carlo Parameters
                </h3>
              </div>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950 px-2.5 py-0.5 rounded border border-cyan-800">
                Engine: Discrete-Event Event-Driven (DES)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Monte Carlo Iterations
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={config.monteCarloRuns ?? 50}
                  onChange={e => onChange({ monteCarloRuns: Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 50)) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Replications for confidence intervals (5–200)</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Deterministic Random Seed
                </label>
                <input
                  type="number"
                  value={config.seed ?? 42}
                  onChange={e => onChange({ seed: parseInt(e.target.value, 10) || 42 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">Identical seed guarantees exact reproducibility</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Interval Granularity Override
                </label>
                <select
                  value={config.intervalMinutesOverride ?? 0}
                  onChange={e => onChange({ intervalMinutesOverride: parseInt(e.target.value, 10) })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value={0}>Auto Detect from CSV</option>
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (Hourly)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Missing Data Strategy
                </label>
                <select
                  value={config.missingDataStrategy || 'keep_missing'}
                  onChange={e => onChange({ missingDataStrategy: e.target.value as MissingDataStrategy })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="keep_missing">Keep Missing (Exclude from Stats)</option>
                  <option value="fill_zeros">Fill with 0 Volume &amp; 0 AHT</option>
                  <option value="interpolate">Interpolate Adjacent Intervals</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action Strip */}
      {onRunSimulation && (
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Configured: <strong className="text-white">{config.totalHC} Gross HC</strong></span>
            <span>&bull;</span>
            <span>Target: <strong className="text-blue-400">{config.slaPercentTarget}% in {config.slaThresholdSeconds}s</strong></span>
            <span>&bull;</span>
            <span>Shrinkage: <strong className="text-amber-400">{Math.round((config.shrinkageTotal ?? 0.25) * 100)}%</strong></span>
          </div>

          <button
            type="button"
            onClick={onRunSimulation}
            disabled={isRunning}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isRunning ? 'Simulating...' : 'Apply & Run Simulation →'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
