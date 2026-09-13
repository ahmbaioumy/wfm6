import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  WorkforceConfig,
  IntervalResult,
  AggregationSummary,
  MonteCarloStats,
  SimulationInsight,
  DemandRow,
  WeeklyRosterPlan,
} from './types';
import {
  SAMPLE_RETAIL_VOICE_CSV,
  SAMPLE_MULTI_SEGMENT_CSV,
  SAMPLE_WEEKLY_TREND_CSV,
  SAMPLE_HOURLY_CSV,
  parseDemandCSVAdvanced,
  exportResultsToCSV,
  exportRosterToCSV,
} from './data/sampleDemand';
import { generateRoster } from './engines/roster';
import { executeSimulationAsync } from './engines/workerClient';
import { generateInsights } from './engines/insights';
import { solveRequiredStaffing } from './engines/erlang';

// Modular Layout Components
import { TopHeader } from './components/layout/TopHeader';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { BottomStatusBar } from './components/layout/BottomStatusBar';

// Modals
import { StandaloneModal } from './components/StandaloneModal';
import { ProjectConfigModal } from './components/ProjectConfigModal';
import { ScheduleConstraintsModal } from './components/ScheduleConstraintsModal';

import { ErrorBoundary } from './components/common/ErrorBoundary';

// 8 Primary Workspace Tabs
import { OverviewTab } from './components/tabs/OverviewTab';
import { DemandTab } from './components/tabs/DemandTab';
import { ErlangTab } from './components/tabs/ErlangTab';
import { RosterTab } from './components/tabs/RosterTab';
import { CoverageTab } from './components/tabs/CoverageTab';
import { SimulationTab } from './components/tabs/SimulationTab';
import { ResultsTab } from './components/tabs/ResultsTab';
import { InsightsTab } from './components/tabs/InsightsTab';

import {
  LayoutDashboard,
  Database,
  Calculator,
  Users,
  ShieldCheck,
  Cpu,
  Table as TableIcon,
  Lightbulb,
} from 'lucide-react';

export type MainTabKey =
  | 'overview'
  | 'demand'
  | 'erlang'
  | 'roster'
  | 'coverage'
  | 'simulation'
  | 'results'
  | 'insights';

const DEFAULT_CONFIG: WorkforceConfig = {
  totalHC: 150,
  segmentHC: {},
  dailyPaidHours: 8,
  workDaysPerWeek: 6,
  offDaysPerWeek: 1,
  offDistributionMode: 'dynamic_volume_trend',
  shiftStartStepMinutes: 30,
  minCoverage: 2,
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
  is24x7: false,
  operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  holidayDates: [],

  // Shift length bounds & rest rules (PRD 46-48)
  minShiftHours: 6,
  maxShiftHours: 10,
  minRestHoursBetweenShifts: 12,
  minConsecutiveWorkDays: 2,
  maxConsecutiveWorkDays: 6,
  requireConsecutiveOff: true,

  // Gender mix & female labor constraints (PRD 50, 51)
  genderFemalePercent: 40,
  femaleEarliestStart: '06:00',
  femaleLatestFinish: '22:00',
  femaleMinShiftHours: 6,
  femaleMaxShiftHours: 8,
  femaleConstraintStrict: true,

  // Team-based scheduling (PRD 52-55)
  teamSize: 10,
  teamShiftFlexibilityHours: 2,
  teamOffDeviationPercent: 20,
  enforceTeamOfficerShift: true,

  shrinkageTotal: 0.25,
  shrinkageBreakPercent: 0.07, // 7% breaks floor - non-reducible
  shrinkageOutOffice: 0.12,
  shrinkageInOffice: 0.13,
  shrinkageDistributionMode: 'dynamic_volume_trend',
  adherence: 0.90,

  slaPercentTarget: 90,
  slaThresholdSeconds: 20,
  maxOccupancyThreshold: 85,
  defaultPatienceSeconds: 120,
  shortAbandonThresholdSeconds: 5,
  excludeShortAbandons: true,

  arrivalMode: 'fixed_forecast',
  serviceTimeDist: 'fixed',
  serviceTimeCV: 0.50,
  patienceDist: 'fixed',
  queueAttribution: 'arrival_interval',

  chatConcurrency: 1,
  chatAhtDegradation: false,

  erlangModel: 'erlang_c',
  queueClosureBehavior: 'finish_queued',
  missingDataStrategy: 'keep_missing',
  weekStartDay: 1,
  minMonteCarloRuns: 10,
  maxMonteCarloRuns: 200,
  intervalMinutesOverride: 0,

  seed: 42,
  monteCarloRuns: 25,
  targetSlaHalfWidth: 1.0,
};

export default function App() {
  const [csvText, setCsvText] = useState<string>(SAMPLE_RETAIL_VOICE_CSV);
  const [activeDatasetName, setActiveDatasetName] = useState<string>('Retail Voice (Default)');
  const [config, setConfig] = useState<WorkforceConfig>(DEFAULT_CONFIG);
  const [intervalOverride, setIntervalOverride] = useState<number>(0);

  // Active Workspace Navigation
  const [activeTab, setActiveTab] = useState<MainTabKey>('overview');

  // Simulation execution state
  const [simulationStatus, setSimulationStatus] = useState<'not_run' | 'running' | 'complete' | 'stale' | 'failed'>('not_run');
  const [simulationProgress, setSimulationProgress] = useState<number>(0);
  const [simulationDurationMs, setSimulationDurationMs] = useState<number | null>(null);
  const [lastRunTimestamp, setLastRunTimestamp] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState<'single' | 'monte_carlo'>('monte_carlo');

  // Modals state
  const [isStandaloneModalOpen, setIsStandaloneModalOpen] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isConstraintsModalOpen, setIsConstraintsModalOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Simulation Output State
  const [intervalResults, setIntervalResults] = useState<IntervalResult[]>([]);
  const [summary, setSummary] = useState<AggregationSummary | null>(null);
  const [mcStats, setMcStats] = useState<MonteCarloStats | null>(null);
  const [insights, setInsights] = useState<SimulationInsight[]>([]);

  // Parse demands from CSV
  const parseResult = useMemo(() => {
    return parseDemandCSVAdvanced(csvText, {
      intervalMinutesOverride: intervalOverride,
      missingDataStrategy: config.missingDataStrategy,
    });
  }, [csvText, intervalOverride, config.missingDataStrategy]);

  const demands: DemandRow[] = parseResult.demands;

  // Erlang requirements and synthetic roster generation
  const { roster, erlangReqs } = useMemo(() => {
    if (demands.length === 0) {
      return { roster: null, erlangReqs: [] };
    }
    const intervals = demands.map(d => d.intervalStart);
    const reqs = demands.map(d =>
      solveRequiredStaffing(
        d.trafficErlangs,
        d.ahtSeconds,
        config.slaPercentTarget / 100,
        config.slaThresholdSeconds,
        config.maxOccupancyThreshold / 100,
        config.minCoverage,
        config.erlangModel || 'erlang_c',
        config.defaultPatienceSeconds
      )
    );
    const r = generateRoster(config, intervals, reqs, demands);
    return { roster: r, erlangReqs: reqs };
  }, [demands, config]);

  const weeklyPlan: WeeklyRosterPlan = useMemo(() => {
    return (
      roster?.weeklyPlan ?? {
        days: [],
        totalWeeklyOffSlots: 0,
        totalWeeklyWorkSlots: 0,
        perAgentOffDaysTarget: config.offDaysPerWeek ?? 1,
        complianceRate: 100,
        nonCompliantCount: 0,
        avgWeeklyShrinkagePercent: Math.round(config.shrinkageTotal * 100),
        protectedBreakPercent: Math.round(config.shrinkageBreakPercent * 100),
        flexibleShrinkagePoolPercent: Math.round((config.shrinkageInOffice + config.shrinkageOutOffice) * 100),
        agentSchedules: [],
        feasibilityIssues: [],
      }
    );
  }, [roster, config]);

  const intervalStaffing = useMemo(() => {
    return roster?.intervalStaffing ?? [];
  }, [roster]);

  const peakRequiredHC = useMemo(() => {
    if (intervalStaffing.length === 0) return 0;
    return Math.max(...intervalStaffing.map(s => s.requiredHC || 0), 0);
  }, [intervalStaffing]);

  const peakEffectiveHC = useMemo(() => {
    if (intervalStaffing.length === 0) return 0;
    return Math.max(...intervalStaffing.map(s => s.effectiveHC || 0), 0);
  }, [intervalStaffing]);

  // Compute dataset summary metadata for TopHeader
  const datasetInfo = useMemo(() => {
    if (demands.length === 0) {
      return {
        name: activeDatasetName,
        dateRange: 'No Data',
        intervalMinutes: 30,
        segmentCount: 1,
        segments: ['Default'],
      };
    }
    const dates = Array.from(new Set(demands.map(d => d.date)));
    const segments = Array.from(new Set(demands.map(d => d.segment)));
    const dateRange = dates.length > 1
      ? `${dates[0]} to ${dates[dates.length - 1]} (${dates.length}d)`
      : `${dates[0] || 'Day 1'}`;

    return {
      name: activeDatasetName,
      dateRange,
      intervalMinutes: demands[0]?.intervalMinutes || 30,
      segmentCount: segments.length || 1,
      segments,
    };
  }, [demands, activeDatasetName]);

  // Execute DES Simulation
  const executeSimulation = useCallback(async () => {
    if (demands.length === 0 || !roster) return;

    setSimulationStatus('running');
    setSimulationProgress(0);
    const startTime = performance.now();

    try {
      const { baseResult, stats } = await executeSimulationAsync({
        mode: simulationMode,
        demands,
        staffing: roster.intervalStaffing,
        config,
        agents: roster.agents,
        events: roster.events,
        onProgress: (pct) => setSimulationProgress(pct),
      });

      const elapsedMs = Math.round(performance.now() - startTime);
      setSimulationDurationMs(elapsedMs);
      setLastRunTimestamp(new Date().toLocaleTimeString());

      setIntervalResults(baseResult.intervalResults);
      setSummary(baseResult.summary);
      setMcStats(stats);

      const ins = generateInsights(baseResult.intervalResults, config);
      setInsights(ins);

      setSimulationStatus('complete');
    } catch (err) {
      console.error('Simulation execution error:', err);
      setSimulationStatus('failed');
    }
  }, [demands, roster, config, simulationMode]);

  // Mark status as STALE when parameters or data change after a completed run
  useEffect(() => {
    setSimulationStatus(prev => (prev === 'complete' ? 'stale' : prev));
  }, [config, csvText, intervalOverride]);

  // Handlers for Preset Datasets
  const handleLoadRetail = () => {
    setCsvText(SAMPLE_RETAIL_VOICE_CSV);
    setActiveDatasetName('Retail Voice');
    setIntervalOverride(0);
    setConfig(prev => ({ ...prev, totalHC: 150 }));
  };

  const handleLoadMultiSegment = () => {
    setCsvText(SAMPLE_MULTI_SEGMENT_CSV);
    setActiveDatasetName('Multi-Segment Contact');
    setIntervalOverride(0);
    setConfig(prev => ({ ...prev, totalHC: 120 }));
  };

  const handleLoadWeeklyTrend = () => {
    setCsvText(SAMPLE_WEEKLY_TREND_CSV);
    setActiveDatasetName('7-Day Trend');
    setIntervalOverride(0);
    setConfig(prev => ({
      ...prev,
      totalHC: 150,
      workDaysPerWeek: 6,
      offDaysPerWeek: 1,
      offDistributionMode: 'dynamic_volume_trend',
    }));
  };

  const handleLoadHourly = () => {
    setCsvText(SAMPLE_HOURLY_CSV);
    setActiveDatasetName('Hourly Arrivals');
    setIntervalOverride(60);
    setConfig(prev => ({ ...prev, totalHC: 120 }));
  };

  const handleUploadCSV = (content: string, filename?: string) => {
    setCsvText(content);
    setActiveDatasetName(filename || 'Uploaded CSV');
    setIntervalOverride(0);
  };

  const handleApplyConfig = (updated: Partial<WorkforceConfig>) => {
    setConfig(prev => ({ ...prev, ...updated }));
  };

  const handleResetParameters = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const handleHardClear = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Storage clear error', e);
    }
    setCsvText(SAMPLE_RETAIL_VOICE_CSV);
    setActiveDatasetName('Retail Voice (Default)');
    setConfig(DEFAULT_CONFIG);
  };

  // Memoized simulation results
  const simulationResultsList: IntervalResult[] = useMemo(() => {
    return intervalResults.map(r => ({
      ...r,
      slaPercent: r.slaPercent ?? 0,
      asaSeconds: r.asaSeconds ?? 0,
      answerPercent: r.answerPercent ?? 0,
      abandonPercent: r.abandonPercent ?? 0,
      occupancyPercent: r.occupancyPercent ?? 0,
      avgQueue: r.avgQueue ?? 0,
      maxQueue: r.maxQueue ?? 0,
      maxWaitSeconds: r.maxWaitSeconds ?? 0,
      answeredWithinSla: r.answeredWithinSla ?? 0,
      shortAbandoned: r.shortAbandoned ?? 0,
      busySeconds: r.busySeconds ?? 0,
      availableSeconds: r.availableSeconds ?? 0,
    }));
  }, [intervalResults]);

  // Primary Tabs Definition with Badges
  const primaryTabs: Array<{
    id: MainTabKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }> = [
    { id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard },
    { id: 'demand', label: 'DEMAND', icon: Database, badge: `${demands.length} int` },
    { id: 'erlang', label: 'ERLANG', icon: Calculator, badge: 'Benchmark' },
    { id: 'roster', label: 'ROSTER', icon: Users, badge: `${roster?.agents.length ?? config.totalHC} HC` },
    { id: 'coverage', label: 'COVERAGE', icon: ShieldCheck },
    {
      id: 'simulation',
      label: 'SIMULATION',
      icon: Cpu,
      badge: simulationStatus === 'stale' ? 'Stale' : simulationStatus === 'running' ? 'Running' : simulationStatus === 'complete' ? 'Ready' : undefined,
    },
    { id: 'results', label: 'RESULTS', icon: TableIcon, badge: intervalResults.length > 0 ? `${intervalResults.length}` : undefined },
    { id: 'insights', label: 'INSIGHTS', icon: Lightbulb, badge: insights.length > 0 ? `${insights.length}` : undefined },
  ];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
        {/* 1. TOP HEADER */}
        <TopHeader
          datasetName={datasetInfo.name}
          dateRange={datasetInfo.dateRange}
          intervalMinutes={datasetInfo.intervalMinutes}
          segmentCount={datasetInfo.segmentCount}
          segments={datasetInfo.segments}
          totalHC={config.totalHC}
          onOpenStandaloneModal={() => setIsStandaloneModalOpen(true)}
          onOpenConfigModal={() => setIsConfigModalOpen(true)}
          onResetParameters={handleResetParameters}
          onHardClear={handleHardClear}
        />

        {/* 2. MAIN BODY (LEFT SIDEBAR + PRIMARY WORKSPACE) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar Control Panel (Fixed 320px width, independently scrollable) */}
          <LeftSidebar
            config={config}
            onChange={handleApplyConfig}
            onUpdateConfig={handleApplyConfig}
            demands={demands}
            parseResult={parseResult}
            intervalCount={demands.length}
            intervalOverride={intervalOverride}
            onIntervalOverrideChange={setIntervalOverride}
            onUploadCSV={handleUploadCSV}
            onLoadRetail={handleLoadRetail}
            onLoadMultiSegment={handleLoadMultiSegment}
            onLoadWeeklyTrend={handleLoadWeeklyTrend}
            onLoadHourly={handleLoadHourly}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          />

          {/* Main Workspace Area (Independently scrollable) */}
          <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-950 pb-20">
            {/* Primary Tab Bar (Sticky at top of main workspace) */}
            <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-4 sm:px-6 pt-3 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-1.5">
                {primaryTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-3.5 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-slate-900 text-blue-400 border-blue-500 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border-transparent hover:border-slate-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                      {tab.badge && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                          tab.badge === 'Stale'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : tab.badge === 'Running'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800 animate-pulse'
                            : isActive
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Quick action to run when stale */}
              {simulationStatus === 'stale' && (
                <button
                  type="button"
                  onClick={executeSimulation}
                  className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition cursor-pointer mb-2"
                >
                  <span>Inputs Changed · Re-run DES</span>
                </button>
              )}
            </div>

            {/* Primary Tab Content Body */}
            <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
              {activeTab === 'overview' && (
                <OverviewTab
                  summary={summary}
                  mcStats={mcStats}
                  config={config}
                  demands={demands}
                  intervalStaffing={intervalStaffing}
                  simulationResults={simulationResultsList}
                  simulationStatus={simulationStatus}
                  onRunSimulation={executeSimulation}
                  onNavigateToTab={(tabKey) => setActiveTab(tabKey as MainTabKey)}
                />
              )}

              {activeTab === 'demand' && (
                <DemandTab
                  demands={demands}
                  datasetName={activeDatasetName}
                  intervalOverride={intervalOverride}
                  onIntervalOverrideChange={setIntervalOverride}
                  onUploadCSV={handleUploadCSV}
                  onLoadRetail={handleLoadRetail}
                  onLoadMultiSegment={handleLoadMultiSegment}
                  onLoadWeeklyTrend={handleLoadWeeklyTrend}
                  onLoadHourly={handleLoadHourly}
                />
              )}

              {activeTab === 'erlang' && (
                <ErlangTab
                  demands={demands}
                  intervalStaffing={intervalStaffing}
                  config={config}
                  onNavigateToTab={(tabKey) => setActiveTab(tabKey as MainTabKey)}
                />
              )}

              {activeTab === 'roster' && (
                <RosterTab
                  rosterPlan={weeklyPlan}
                  config={config}
                />
              )}

              {activeTab === 'coverage' && (
                <CoverageTab
                  intervalStaffing={intervalStaffing}
                  config={config}
                />
              )}

              {activeTab === 'simulation' && (
                <SimulationTab
                  config={config}
                  simulationStatus={simulationStatus}
                  simulationProgress={simulationProgress}
                  simulationDurationMs={simulationDurationMs}
                  lastRunTimestamp={lastRunTimestamp}
                  simulationMode={simulationMode}
                  onModeChange={setSimulationMode}
                  onRunSimulation={executeSimulation}
                  demands={demands}
                  simulationResults={simulationResultsList}
                  onNavigateToTab={(tabKey) => setActiveTab(tabKey as MainTabKey)}
                />
              )}

              {activeTab === 'results' && (
                <ResultsTab
                  simulationResults={simulationResultsList}
                  demands={demands}
                  intervalStaffing={intervalStaffing}
                  config={config}
                  onRunSimulation={executeSimulation}
                />
              )}

              {activeTab === 'insights' && (
                <InsightsTab
                  simulationResults={simulationResultsList}
                  demands={demands}
                  intervalStaffing={intervalStaffing}
                  config={config}
                  onApplyConfig={handleApplyConfig}
                  onRunSimulation={executeSimulation}
                />
              )}
            </div>
          </main>
        </div>

        {/* 3. BOTTOM STATUS BAR */}
        <BottomStatusBar
          intervalCount={demands.length}
          dateRange={datasetInfo.dateRange}
          totalHC={config.totalHC}
          activeAgentsCount={roster?.summary.workingToday ?? 0}
          offAgentsCount={roster?.summary.offToday ?? 0}
          requiredPeakHC={peakRequiredHC}
          effectivePeakHC={peakEffectiveHC}
          simulationStatus={simulationStatus}
          simulationProgress={simulationProgress}
          onRunSimulation={executeSimulation}
        />

        {/* Modals */}
        <StandaloneModal
          isOpen={isStandaloneModalOpen}
          onClose={() => setIsStandaloneModalOpen(false)}
        />

        <ProjectConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          config={config}
          onApplyConfig={handleApplyConfig}
          onResetParameters={handleResetParameters}
          onResetProject={handleHardClear}
          onHardClear={handleHardClear}
        />

        <ScheduleConstraintsModal
          isOpen={isConstraintsModalOpen}
          onClose={() => setIsConstraintsModalOpen(false)}
          config={config}
          onChange={handleApplyConfig}
          feasibilityIssues={roster?.weeklyPlan?.feasibilityIssues}
          onRerunSimulation={executeSimulation}
        />
      </div>
    </ErrorBoundary>
  );
}
