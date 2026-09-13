export type ChannelType = 'voice' | 'chat' | 'email';
export type ArrivalMode = 'fixed_forecast' | 'poisson_uncertainty';
export type ServiceTimeDist = 'fixed' | 'lognormal' | 'exponential';
export type PatienceDist = 'fixed' | 'exponential' | 'lognormal' | 'weibull';
export type QueueAttribution = 'arrival_interval' | 'answer_interval';
export type MissingDataStrategy =
  | 'keep_missing'
  | 'zero'
  | 'zero_fill'
  | 'forward_fill'
  | 'backward_fill'
  | 'interpolate'
  | 'linear_interp'
  | 'historical_avg'
  | 'mean'
  | 'median'
  | 'same_dow_mean';
export type QueueClosureBehavior = 'finish_queued' | 'force_close' | 'max_drain' | 'abandon_at_closure' | 'carry_forward' | 'overtime_clearance';
export type ErlangModelType = 'erlang_c' | 'erlang_a' | 'erlang_b';
export type OffDistributionMode = 'dynamic_volume_trend' | 'flat_rotation';
export type WeekStartDay = 0 | 1 | 6; // 0: Sunday, 1: Monday, 6: Saturday

/**
 * Normalized Demand Row representation
 * Every demand record is bound to a chronological timestamp, not CSV row index.
 */
export interface DemandRow {
  id?: string;
  date: string; // e.g. "01/09/2026" or "2026-09-01"
  intervalStart: string; // e.g. "08:00"
  intervalEnd?: string; // Optional e.g. "08:30"
  intervalIndex?: number; // Optional index
  timestamp?: number; // Unix timestamp in seconds (chronological)
  intervalMinutes?: number; // 15, 30, or 60 min
  volume: number; // Offered contacts count
  ahtSeconds: number; // Average handle time in seconds
  segment: string; // e.g. "Retail", "Prestige", "Voice"
  channel: ChannelType; // 'voice', 'chat', 'email'
  workloadSeconds: number; // volume * ahtSeconds
  trafficErlangs: number; // workloadSeconds / (intervalMinutes * 60)
}

// Backward-compatible alias
export type IntervalDemand = DemandRow;

/**
 * Column mapping configuration for CSV import
 */
export interface ColumnMapping {
  dateCol: string;
  intervalCol: string;
  volumeCol: string;
  ahtCol: string;
  segmentCol: string;
  channelCol?: string;
}

/**
 * Segment Configuration & Routing Policy
 */
export interface SegmentConfig {
  name: string;
  channel: ChannelType;
  allocationType: 'dedicated' | 'shared';
  dedicatedHC?: number;
  poolId?: string;
  targetSlaPercent: number;
  slaThresholdSeconds: number;
  defaultPatienceSeconds: number;
  concurrency: number; // 1 for voice, 2-5 for chat
  priority: number; // 1 (highest) to 10
  shrinkageOverride?: number;
}

/**
 * Workforce & Scheduling Configuration
 */
export interface WorkforceConfig {
  // Headcount
  totalHC: number;
  segmentHC: Record<string, number>;
  segmentConfigs?: Record<string, SegmentConfig>;
  poolConfigs?: Record<string, { headcount: number; sharedSegments: string[] }>;
  headcountAllocationMode?: 'common' | 'dedicated' | 'shared' | 'blended';

  // Shifts and schedules
  dailyPaidHours: number; // e.g. 8
  workDaysPerWeek: number; // e.g. 6 (or 5)
  offDaysPerWeek: number; // e.g. 1 (or 2, or 0)
  contractType?: string; // e.g. "5/2", "6/1", "7/0"
  shiftStartStepMinutes: number; // 15, 30, or 60
  minCoverage: number; // e.g. 1 or 2
  maxCoverage?: number;
  businessHoursStart: string; // e.g. "08:00"
  businessHoursEnd: string; // e.g. "20:00"
  is24x7: boolean;
  operatingDays?: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  holidayDates?: string[]; // e.g. ['2026-01-01', '2026-12-25']

  // Shift length bounds & rest rules
  minShiftHours?: number; // e.g. 6
  maxShiftHours?: number; // e.g. 10
  allowSplitShifts?: boolean;
  allowOvernightShifts?: boolean;
  minRestHoursBetweenShifts: number; // e.g. 12 (Hard constraint)
  minConsecutiveWorkDays: number; // e.g. 2
  maxConsecutiveWorkDays: number; // e.g. 6
  requireConsecutiveOff: boolean; // default true

  // Gender Mix & Female Labor Constraints
  genderFemalePercent: number; // 0 - 100
  femaleEarliestStart: string; // e.g. "06:00"
  femaleLatestFinish: string; // e.g. "22:00"
  femaleMinShiftHours?: number;
  femaleMaxShiftHours?: number;
  femaleConstraintStrict: boolean; // Hard constraint

  // Team-based Scheduling
  teamSize: number; // e.g. 10 agents per team
  teamShiftFlexibilityHours: number; // e.g. 2 hours
  teamOffDeviationPercent: number; // e.g. 20%
  enforceTeamOfficerShift: boolean; // Supervisor follows largest shift

  // Shrinkage & Adherence
  shrinkageTotal: number; // 0.0 - 1.0 (e.g. 0.25)
  shrinkageBreakPercent: number; // 0.0 - 1.0 (e.g. 0.07 = 7% breaks floor)
  shrinkageOutOffice: number; // e.g. 0.12 (leave, sick, absence)
  shrinkageInOffice: number; // e.g. 0.13 (coaching, training, prayer, aux)
  shrinkageDistributionMode: 'dynamic_volume_trend' | 'flat';
  adherence: number; // 0.0 - 1.0 (e.g. 0.90)

  // Out-of-Office & Adherence Simulation Modes (P0-Capacity Truth)
  outOfOfficeMode?: 'deterministic_capacity' | 'stochastic_agent_day'; // default 'deterministic_capacity'
  adherenceMode?: 'deterministic_capacity' | 'stochastic_events' | 'disabled'; // default 'deterministic_capacity'

  // Operational assumptions (exposed, no hidden hardcodes)
  lowVolumeThreshold?: number; // default 0.75 (fraction of peak workload for low volume day)
  splitBreak1Position?: number; // default 0.33 (fraction into shift for split break 1)
  splitBreak2Position?: number; // default 0.66 (fraction into shift for split break 2)
  breakStaggerMinutes?: number; // default 10 (stagger offset between agents in minutes)
  inOfficeShrinkagePreferredPosition?: number; // default 0.75 (fraction into shift for in-office shrinkage)

  // Targets & Operational Rules
  slaPercentTarget: number; // e.g. 80% or 90%
  slaThresholdSeconds: number; // e.g. 20s
  maxOccupancyThreshold: number; // e.g. 85%
  defaultPatienceSeconds: number; // e.g. 120s
  shortAbandonThresholdSeconds: number; // e.g. 5s
  excludeShortAbandons: boolean; // default true

  // Modeling modes
  erlangModel: ErlangModelType; // default 'erlang_c'
  arrivalMode: ArrivalMode;
  serviceTimeDist: ServiceTimeDist;
  serviceTimeCV: number; // e.g. 0.50
  patienceDist: PatienceDist;
  queueAttribution: QueueAttribution;
  queueClosureBehavior: QueueClosureBehavior;
  maxDrainMinutes?: number; // Configurable queue drain limit for max_drain mode (default: 30)
  missingDataStrategy: MissingDataStrategy;
  intervalMinutesOverride?: number; // 0: Auto Detect, 15, 30, 60
  weekStartDay: WeekStartDay; // 1: Monday, 0: Sunday, 6: Saturday
  weekStartsOn?: number; // 0..6 alias for weekStartDay

  // Break & Shift configurations (explicit parameters, no hidden assumptions)
  breakDurationMinutes?: number; // Explicit break minutes (overrides percentage if set)
  breakStartFraction?: number; // Position of break in shift (0.0 - 1.0, default 0.50)
  splitBreaks?: boolean; // Whether to split breaks into rest and meal windows

  // Weekly OFF Strategy
  offDistributionMode: OffDistributionMode;

  // Multi-skill / chat concurrency
  chatConcurrency: number; // 1 to 5 (default 1 for voice)
  chatAhtDegradation: boolean;

  // Overtime
  allowOvertime?: boolean;
  maxOvertimeHoursPerWeek?: number;

  // Simulation Parameters & Monte Carlo
  seed: number;
  monteCarloRuns: number; // default 50
  minMonteCarloRuns: number; // default 5
  maxMonteCarloRuns: number; // default 200
  targetSlaHalfWidth: number; // e.g. 1.0%
}

/**
 * Break Window on an Agent's Shift
 */
export interface BreakWindow {
  start: string; // "12:00"
  end: string; // "12:30"
  durationMinutes: number;
}

/**
 * Planned Shrinkage Window on an Agent's Shift
 */
export interface ShrinkageWindow {
  start: string;
  end: string;
  durationMinutes: number;
  type: string; // 'training' | 'coaching' | 'prayer' | 'meeting'
}

/**
 * Individual Agent Day Schedule
 */
export interface AgentDayAssignment {
  date: string;
  dayIndex: number;
  dayName: string;
  isOff: boolean;
  isOutOfOffice?: boolean; // Out-of-office shrinkage: leave, sick, absence, training outside operation
  outOfOfficeReason?: string;
  shiftStart?: string; // "08:00"
  shiftEnd?: string; // "16:30"
  breaks: BreakWindow[];
  plannedShrinkages: ShrinkageWindow[];
  adherenceWindows?: Array<{ start: string; end: string; durationMinutes: number }>;
}

/**
 * Individual Synthetic Agent in the Roster
 */
export interface SyntheticAgent {
  id: string;
  name: string;
  segment: string;
  channel: ChannelType;
  team: string;
  teamId: number;
  gender: 'M' | 'F';
  isSupervisor?: boolean;
  supervisorId?: string;
  skills: string[];
  poolId?: string;
  concurrency: number;
  scheduleByDate: Map<string, AgentDayAssignment> | Record<string, AgentDayAssignment>;
  ruleViolations?: string[];
}

/**
 * Chronological Agent Availability Event for DES
 */
export type AgentEventType =
  | 'SHIFT_START'
  | 'SHIFT_END'
  | 'BREAK_START'
  | 'BREAK_END'
  | 'SHRINKAGE_START'
  | 'SHRINKAGE_END'
  | 'ADHERENCE_START'
  | 'ADHERENCE_END';

export interface AgentAvailabilityEvent {
  agentId: string;
  timestamp: number; // In seconds from simulation start
  type: AgentEventType;
}

export interface DayOffDistribution {
  dayIndex: number; // 0 to N-1
  date: string;
  dayName: string; // "Monday", etc.
  volume: number;
  workloadSeconds: number;
  erlangPeakReq: number;
  erlangAvgReq: number;
  allocatedWorkingHC: number;
  allocatedOffHC: number;
  breakShrinkagePercent: number;
  flexibleShrinkagePercent: number;
  totalShrinkagePercent: number;
  effectiveWorkingHC: number;
  simulatedSla?: number;
  targetMet?: boolean;
}

export interface AgentWeeklySchedule {
  agentId: string;
  agentName: string;
  segment: string;
  team: string;
  gender: 'M' | 'F';
  isSupervisor?: boolean;
  days: AgentDayAssignment[];
  offDaysCount: number;
  isCompliant: boolean;
  ruleViolations?: string[];
}

export interface RosterViolation {
  category: 'contract' | 'rest_rule' | 'consecutive_work' | 'consecutive_off' | 'team_deviation' | 'officer_shift' | 'gender_curfew' | 'min_coverage' | 'shift_length';
  severity: 'hard_violation' | 'soft_warning' | 'info';
  agentId?: string;
  teamId?: number;
  team?: string;
  date?: string;
  interval?: string;
  title: string;
  description: string;
  remedies?: string[];
}

export interface RosterValidationResult {
  agentViolations: Array<{ agentId: string; type: string; message: string; date?: string }>;
  coverageViolations: Array<{ date: string; interval: string; requiredHC: number; scheduledHC: number; minHC: number; message: string }>;
  teamViolations: Array<{ teamId: number; team: string; type: string; message: string }>;
  contractViolations: Array<{ agentId?: string; type: string; message: string }>;
  summary: {
    agentsTotal: number;
    agentsCompliant: number;
    violationsTotal: number;
    compliancePercent: number;
  };
}

export interface ContractWeek {
  weekIndex: number;
  startDate: string;
  endDate: string;
  dates: string[];
  isFullWeek: boolean;
  type: 'FULL_WEEK' | 'PARTIAL_WEEK';
}

export interface FeasibilityIssue {
  severity: 'hard_violation' | 'soft_warning' | 'info';
  category: 'gender_curfew' | 'rest_rule' | 'team_deviation' | 'coverage' | 'shift_length' | 'horizon_partial' | 'contract' | 'business_window' | 'consecutive_work' | 'consecutive_off';
  title: string;
  description: string;
  remedies: string[];
}

export interface WeeklyRosterPlan {
  days: DayOffDistribution[];
  totalWeeklyOffSlots: number;
  totalWeeklyWorkSlots: number;
  perAgentOffDaysTarget: number;
  complianceRate: number;
  nonCompliantCount: number;
  avgWeeklyShrinkagePercent: number;
  protectedBreakPercent: number;
  flexibleShrinkagePoolPercent: number;
  agentSchedules: AgentWeeklySchedule[];
  feasibilityIssues?: FeasibilityIssue[];
  validationResult?: RosterValidationResult;
}

export interface IntervalStaffing {
  time: string; // e.g. "08:00"
  intervalStart?: string; // UI alias
  date?: string;
  segment?: string;
  id?: string;
  requiredHC: number;
  targetHC?: number;
  minHC?: number;
  scheduledHC: number;
  effectiveHC: number;
  onShift: number;
  onBreak: number;
  offDuty: number;
  shrinkageLoss: number;
  outOfficeLoss?: number;
  adherenceLoss: number;
  coverageGap?: number;
  gapToTarget?: number;
  gapToMinimum?: number;
  coveragePercent?: number;
}

/**
 * Output metrics per Demand Interval
 */
export interface IntervalResult {
  id?: string;
  interval: string;
  intervalStart?: string; // UI alias
  date: string;
  segment: string;
  channel: ChannelType;
  volume: number;
  aht: number;
  workloadSeconds: number;
  trafficErlangs: number;

  // Benchmark
  erlangReqHC: number;
  erlangSla: number;
  erlangAsa: number;
  erlangOcc: number;

  // Roster
  scheduledHC: number;
  effectiveHC: number;
  gap: number;
  gapPercent: number;

  // DES Outcomes
  offered: number;
  answered: number;
  abandoned: number;
  shortAbandoned: number;
  answeredWithinSla: number;
  slaPercent: number;
  asaSeconds: number;
  answerPercent: number;
  abandonPercent: number;
  occupancyPercent: number;

  // Dynamics
  maxQueue: number;
  avgQueue: number;
  queueStart?: number;
  queueEnd?: number;
  maxWaitSeconds: number;
  busySeconds: number;
  availableSeconds: number;

  // Target status
  targetMet: boolean;
}

/**
 * Summary KPI aggregation at any level (Interval, Daily, Weekly, Monthly, Total)
 */
export interface AggregationSummary {
  period: string; // "Total" | "Daily 01/09" | "Weekly W36" | etc.
  segment?: string;
  offered: number;
  answered: number;
  answeredCount?: number;
  abandoned: number;
  abandonedCount?: number;
  shortAbandoned: number;
  answeredWithinSla: number;
  totalWaitingSeconds: number;
  busySeconds: number;
  availableSeconds: number;
  slaPercent: number;
  asaSeconds: number;
  answerPercent: number;
  answerRatePercent?: number;
  abandonPercent: number;
  abandonRatePercent?: number;
  occupancyPercent: number;
  averageOccupancyPercent?: number;
  erlangReqAvg: number;
  scheduledAvg: number;
  effectiveAvg: number;
  intervalsCount: number;
  intervalsMetSla: number;
  maxWaitSeconds?: number;
}

export interface MonteCarloStats {
  runsCompleted: number;
  runsExecuted?: number; // Alias for test compatibility
  slaMean?: number;
  slaMin?: number;
  slaMax?: number;
  slaStdDev?: number;
  slaCiLower?: number;
  slaCiUpper?: number;

  expectedSla: number;
  p10Sla: number;
  p50Sla: number;
  p90Sla: number;
  ci95Lower: number;
  ci95Upper: number;
  probTargetMet: number;

  expectedAsa: number;
  p10Asa: number;
  p90Asa: number;

  expectedAnswerRate: number;
  expectedAbandonRate: number;
  expectedOccupancy: number;
}

export interface SimulationInsight {
  id: string;
  type?: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  impact: string;
  recommendation: string;
}

/**
 * Standard Simulation Contact representation
 */
export interface SimulationContact {
  id: string | number;
  arrivalTimestamp: number; // Absolute epoch seconds
  arrivalTime: number; // Simulation relative seconds
  sourceIntervalKey: string; // e.g. "01/09/2026_08:00_Retail"
  date: string;
  interval: string;
  segment: string;
  channel: ChannelType;
  serviceDuration: number;
  duration: number; // Alias for backwards compatibility
  patience: number;
  queueId: string;
  slaThreshold: number;
  demandIndex: number;
}

/**
 * CSV Import Result with diagnostic metadata
 */
export interface DemandParseResult {
  demands: DemandRow[];
  detectedIntervalMinutes: number;
  detectedInterval?: number;
  isIntervalConsistent: boolean;
  duplicateCount: number;
  conflictingDuplicateCount: number;
  uniqueDates: string[];
  uniqueSegments: string[];
  detectedMapping: ColumnMapping;
  warnings: string[];
}
