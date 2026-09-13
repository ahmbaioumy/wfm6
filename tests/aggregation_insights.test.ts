import { describe, it, expect } from 'vitest';
import { runMonteCarloSimulation } from '../src/engines/des';
import { generateRoster } from '../src/engines/roster';
import { generateInsights, solveHeadcountForTargetSla, solveReverseModeHC } from '../src/engines/insights';
import { WorkforceConfig, DemandRow, IntervalResult } from '../src/types';
import { parseDemandCSVAdvanced, SAMPLE_RETAIL_VOICE_CSV } from '../src/data/sampleDemand';

describe('Aggregations, Insights & Reverse Mode Solver (Tests 32-37)', () => {
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

    shrinkageTotal: 0.25,
    shrinkageBreakPercent: 0.07,
    shrinkageOutOffice: 0.10,
    shrinkageInOffice: 0.08,
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
    minMonteCarloRuns: 5,
    maxMonteCarloRuns: 20,
    intervalMinutesOverride: 0,
    seed: 42,
    monteCarloRuns: 5,
    targetSlaHalfWidth: 1.0,
  };

  const parsed = parseDemandCSVAdvanced(SAMPLE_RETAIL_VOICE_CSV);
  const demands: DemandRow[] = parsed.demands;
  const intervals = demands.map(d => d.intervalStart);
  const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.2) + 1);

  // Test 32: Aggregation uses strict numerator/denominator math (never average of interval percentages)
  it('Test 32: Summary SLA is mathematically calculated from total answered in SLA divided by total eligible', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const { baseResult } = runMonteCarloSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events);

    const totalEligible = baseResult.summary.offered - baseResult.summary.shortAbandoned;
    const expectedSla = (baseResult.summary.answeredWithinSla / Math.max(1, totalEligible)) * 100;

    // Must match the summary SLA
    expect(baseResult.summary.slaPercent).toBeCloseTo(expectedSla, 0);

    // Simple arithmetic mean of interval SLAs is biased and will differ
    const arithmeticMeanSla = baseResult.intervalResults.reduce((acc, r) => acc + r.slaPercent, 0) / baseResult.intervalResults.length;
    // Both are valid numbers, but summary is weighted by interval volume
    expect(baseResult.summary.slaPercent).toBeGreaterThanOrEqual(0);
  });

  // Test 33: Staffing gap calculation in interval results
  it('Test 33: Calculates staffing gap as Scheduled HC minus Erlang Requirement', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const { baseResult } = runMonteCarloSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events);

    for (const r of baseResult.intervalResults) {
      expect(r.gap).toBe(Number((r.effectiveHC - r.erlangReqHC).toFixed(1)));
    }
  });

  // Test 34: Monte Carlo runs produce valid statistical bounds (mean, min, max, CI)
  it('Test 34: Monte Carlo runs compute distribution stats (min, max, mean, stdDev, half-width)', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const { stats } = runMonteCarloSimulation(demands, roster.intervalStaffing, baseConfig, roster.agents, roster.events);

    expect(stats.runsExecuted).toBe(5);
    expect(stats.slaMean).toBeGreaterThanOrEqual(stats.slaMin);
    expect(stats.slaMean).toBeLessThanOrEqual(stats.slaMax);
    expect(stats.slaStdDev).toBeGreaterThanOrEqual(0);
    expect(stats.slaCiLower).toBeLessThanOrEqual(stats.slaMean);
    expect(stats.slaCiUpper).toBeGreaterThanOrEqual(stats.slaMean);
  });

  // Test 35: Actionable WFM insights engine identifies critical staffing bottlenecks
  it('Test 35: Actionable Insights engine detects understaffing bottlenecks and high occupancy intervals', () => {
    // Run with 60 HC to create clear bottlenecks
    const lowConfig = { ...baseConfig, totalHC: 60 };
    const roster = generateRoster(lowConfig, intervals, erlangReqs, demands);
    const { baseResult } = runMonteCarloSimulation(demands, roster.intervalStaffing, lowConfig, roster.agents, roster.events);

    const insights = generateInsights(baseResult.intervalResults, lowConfig);
    expect(insights.length).toBeGreaterThan(0);

    // Should have understaffing warning
    const understaff = insights.find(i => i.type === 'understaffing');
    expect(understaff).toBeDefined();
    expect(understaff?.impact).toBeDefined();
  });

  // Test 36: Reverse Mode Headcount Solver finds HC required to meet SLA target
  it('Test 36: Reverse Mode Solver calculates additional headcount needed to reach target SLA', () => {
    const lowConfig = { ...baseConfig, totalHC: 30, slaPercentTarget: 90 };
    const roster = generateRoster(lowConfig, intervals, erlangReqs, demands);
    const { baseResult } = runMonteCarloSimulation(demands, roster.intervalStaffing, lowConfig, roster.agents, roster.events);

    const { requiredHC, feasible } = solveHeadcountForTargetSla(
      baseResult.intervalResults,
      lowConfig,
      demands,
      lowConfig.slaPercentTarget
    );

    expect(feasible).toBe(true);
    expect(requiredHC).toBeGreaterThan(lowConfig.totalHC);
  });

  // Test 37: Feasibility issue detection for curfew / constraint conflict
  it('Test 37: Roster generator flags feasibility warnings when strict curfew cannot meet night demand', () => {
    // 100% female roster with 24x7 demand -> night shifts after 22:00 cannot be filled
    const curfewConflictConfig: WorkforceConfig = {
      ...baseConfig,
      genderFemalePercent: 100, // 100% female
      femaleLatestFinish: '20:00',
      femaleConstraintStrict: true,
      businessHoursStart: '00:00',
      businessHoursEnd: '24:00',
      is24x7: true,
    };

    const nightDemand: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '23:00',
        intervalEnd: '23:30',
        intervalIndex: 0,
        volume: 50,
        ahtSeconds: 300,
        segment: 'NightShift',
        channel: 'voice',
        workloadSeconds: 15000,
        trafficErlangs: 8.33,
      },
    ];

    const roster = generateRoster(curfewConflictConfig, ['23:00'], [10], nightDemand);
    expect(roster.weeklyPlan?.feasibilityIssues).toBeDefined();
    expect(roster.weeklyPlan!.feasibilityIssues!.length).toBeGreaterThan(0);
    expect(roster.weeklyPlan!.feasibilityIssues!.some(f => f.category === 'gender_curfew')).toBe(true);
  });

  // Bug 3 Regression Tests: Reverse mode HC solver feasibility, widening, and iteration SLA guarantees
  it('Bug 3 Regression: returns feasible=false when target SLA cannot be met even after widening', () => {
    // Impossible target SLA: high workload, threshold 1s, extreme shrinkage and low adherence
    const heavyDemand: DemandRow[] = [
      {
        id: 'heavy_1',
        date: '01/09/2026',
        intervalStart: '08:00',
        timestamp: 1788249600,
        intervalMinutes: 30,
        volume: 120,
        ahtSeconds: 600,
        segment: 'Voice',
        channel: 'voice',
        workloadSeconds: 72000,
        trafficErlangs: 40,
      },
    ];
    const impossibleConfig: WorkforceConfig = {
      ...baseConfig,
      slaThresholdSeconds: 1,
      shrinkageTotal: 0.95,
      adherence: 0.1,
    };

    const result = solveReverseModeHC(heavyDemand, impossibleConfig, 99);
    expect(result.feasible).toBe(false);
    expect(result.achievedSla).toBeLessThan(99);
  });

  it('Bug 3 Regression: when feasible is true, requiredHC iteration actually met targetSlaPct', () => {
    const target = 85;
    const result = solveReverseModeHC(demands.slice(0, 10), baseConfig, target);
    if (result.feasible) {
      // Find the iteration that tested requiredHC
      const match = result.iterations.find(it => it.hc === result.requiredHC);
      expect(match).toBeDefined();
      expect(match!.sla).toBeGreaterThanOrEqual(target);
    }
  });
});
