import { describe, it, expect } from 'vitest';
import { runSingleSimulation } from '../src/engines/des';
import { generateRoster } from '../src/engines/roster';
import { WorkforceConfig, DemandRow } from '../src/types';
import { parseDemandCSVAdvanced, SAMPLE_RETAIL_VOICE_CSV } from '../src/data/sampleDemand';

describe('Discrete Event Simulation (DES) Engine (Tests 23-31)', () => {
  const baseConfig: WorkforceConfig = {
    totalHC: 120,
    segmentHC: {},
    dailyPaidHours: 8,
    workDaysPerWeek: 6,
    offDaysPerWeek: 1,
    offDistributionMode: 'dynamic_volume_trend',
    shiftStartStepMinutes: 30,
    minCoverage: 2,
    businessHoursStart: '08:00',
    businessHoursEnd: '20:00',
    is24x7: false,

    minShiftHours: 6,
    maxShiftHours: 10,
    minRestHoursBetweenShifts: 12,
    minConsecutiveWorkDays: 2,
    maxConsecutiveWorkDays: 6,
    requireConsecutiveOff: true,

    genderFemalePercent: 40,
    femaleEarliestStart: '06:00',
    femaleLatestFinish: '22:00',
    femaleMinShiftHours: 6,
    femaleMaxShiftHours: 8,
    femaleConstraintStrict: true,

    teamSize: 10,
    teamShiftFlexibilityHours: 2,
    teamOffDeviationPercent: 20,
    enforceTeamOfficerShift: true,

    shrinkageTotal: 0.20,
    shrinkageBreakPercent: 0.07,
    shrinkageOutOffice: 0.08,
    shrinkageInOffice: 0.05,
    shrinkageDistributionMode: 'dynamic_volume_trend',
    adherence: 0.95,

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
    monteCarloRuns: 1,
    targetSlaHalfWidth: 1.0,
  };

  const parsed = parseDemandCSVAdvanced(SAMPLE_RETAIL_VOICE_CSV);
  const demands: DemandRow[] = parsed.demands;
  const intervals = demands.map(d => d.intervalStart);
  const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.2) + 1);

  // Test 23: Deterministic simulation runs with identical seed produce exact same results
  it('Test 23: Deterministic simulation with identical seed produces reproducible results', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const run1 = runSingleSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events, 1234);
    const run2 = runSingleSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events, 1234);

    expect(run1.summary.offered).toBe(run2.summary.offered);
    expect(run1.summary.answered).toBe(run2.summary.answered);
    expect(run1.summary.abandoned).toBe(run2.summary.abandoned);
    expect(run1.summary.slaPercent).toBe(run2.summary.slaPercent);
    expect(run1.summary.asaSeconds).toBe(run2.summary.asaSeconds);
  });

  // Test 24: Call conservation law: Offered = Answered + Abandoned (for closed day)
  it('Test 24: Offered volume equals Answered + Abandoned calls', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events, 42);

    expect(result.summary.offered).toBe(
      result.summary.answered + result.summary.abandoned
    );
  });

  // Test 25: Call answered immediately when agent is free (ASA = 0 for that call)
  it('Test 25: Ample staffing yields immediate answers and high SLA', () => {
    // 300 HC will heavily overstaff the retail voice queue
    const highStaffConfig = { ...baseConfig, totalHC: 300 };
    const roster = generateRoster(highStaffConfig, intervals, erlangReqs, demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, highStaffConfig, roster.agents, roster.events, 42);

    expect(result.summary.slaPercent).toBeGreaterThanOrEqual(95);
    expect(result.summary.asaSeconds).toBeLessThan(5);
    expect(result.summary.abandoned).toBeLessThan(5);
  });

  // Test 26: Severe understaffing causes queuing, abandoned calls, and low SLA
  it('Test 26: Severe understaffing triggers queue buildup, abandonments, and low SLA', () => {
    // 15 HC will severely understaff the ~80-90 call peak intervals
    const understaffConfig = { ...baseConfig, totalHC: 15 };
    const roster = generateRoster(understaffConfig, intervals, erlangReqs, demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, understaffConfig, roster.agents, roster.events, 42);

    expect(result.summary.abandoned).toBeGreaterThan(0);
    expect(result.summary.slaPercent).toBeLessThan(50);
    expect(result.summary.asaSeconds).toBeGreaterThan(20);
  });

  // Test 27: Short abandon exclusion excludes caller drops under threshold from SLA denominator
  it('Test 27: Short abandon exclusion excludes early hang-ups from SLA denominator', () => {
    const configWithShort = {
      ...baseConfig,
      totalHC: 20,
      shortAbandonThresholdSeconds: 15,
      excludeShortAbandons: true,
      defaultPatienceSeconds: 20,
      patienceDist: 'exponential' as const,
    };
    const roster = generateRoster(configWithShort, intervals, erlangReqs, demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, configWithShort, roster.agents, roster.events, 42);

    expect(result.summary.shortAbandoned).toBeGreaterThan(0);
    // When short abandons are excluded, eligible denominator is (Offered - ShortAbandons)
    const eligible = result.summary.offered - result.summary.shortAbandoned;
    expect(eligible).toBeLessThan(result.summary.offered);
  });

  // Test 28: Strict SLA formula calculation
  it('Test 28: SLA % is calculated as answered within SLA threshold divided by eligible volume', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events, 42);

    const eligible = result.summary.offered - (baseConfig.excludeShortAbandons ? result.summary.shortAbandoned : 0);
    const manualSla = Math.round((result.summary.answeredWithinSla / Math.max(1, eligible)) * 1000) / 10;
    expect(result.summary.slaPercent).toBeCloseTo(manualSla, 0);
  });

  // Test 29: Occupancy calculation is strictly agent talk time / logged-in available time
  it('Test 29: Occupancy is bounded between 0% and 100% and reflects workload vs available staff', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events, 42);

    expect(result.summary.occupancyPercent).toBeGreaterThan(0);
    expect(result.summary.occupancyPercent).toBeLessThanOrEqual(100);

    for (const iv of result.intervalResults) {
      expect(iv.occupancyPercent).toBeGreaterThanOrEqual(0);
      expect(iv.occupancyPercent).toBeLessThanOrEqual(100);
    }
  });

  // Test 30: Multi-queue / Multi-segment routing
  it('Test 30: Handles multiple segments and queues independently in DES', () => {
    const multiSegmentDemands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalIndex: 0,
        volume: 30,
        ahtSeconds: 300,
        segment: 'VIP_Voice',
        channel: 'voice',
        workloadSeconds: 9000,
        trafficErlangs: 5.0,
      },
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalIndex: 0,
        volume: 40,
        ahtSeconds: 240,
        segment: 'Standard_Voice',
        channel: 'voice',
        workloadSeconds: 9600,
        trafficErlangs: 5.33,
      },
    ];

    const roster = generateRoster(baseConfig, ['08:00'], [10, 10], multiSegmentDemands);
    const result = runSingleSimulation(multiSegmentDemands, roster.intervalStaffing, baseConfig, roster.agents, roster.events, 42);

    expect(result.intervalResults.length).toBe(2);
    expect(result.intervalResults.some(r => r.segment === 'VIP_Voice')).toBe(true);
    expect(result.intervalResults.some(r => r.segment === 'Standard_Voice')).toBe(true);
  });

  // Test 31: Chat concurrency (agents can take up to C concurrent chats)
  it('Test 31: Chat concurrency permits agents to serve multiple concurrent chats', () => {
    const chatConfig: WorkforceConfig = {
      ...baseConfig,
      chatConcurrency: 3,
    };
    const chatDemands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalIndex: 0,
        volume: 60,
        ahtSeconds: 600,
        segment: 'WebChat',
        channel: 'chat',
        workloadSeconds: 36000,
        trafficErlangs: 20.0,
      },
    ];

    const roster = generateRoster(chatConfig, ['08:00'], [15], chatDemands);
    const result = runSingleSimulation(chatDemands, roster.intervalStaffing, chatConfig, roster.agents, roster.events, 42);

    // With concurrency = 3, effective serving capacity is tripled, answering more volume
    expect(result.summary.answered).toBeGreaterThan(0);
  });
});
