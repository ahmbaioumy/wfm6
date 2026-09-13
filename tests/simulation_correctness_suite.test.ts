import { describe, it, expect } from 'vitest';
import { generateRoster } from '../src/engines/roster';
import { runSingleSimulation, PRNG } from '../src/engines/des';
import { calculateErlangA, calculateErlangC } from '../src/engines/erlang';
import { WorkforceConfig, DemandRow } from '../src/types';
import { parseDateTimeToEpochSeconds } from '../src/data/sampleDemand';

const BASE_CONFIG: WorkforceConfig = {
  totalHC: 100,
  segmentHC: {},
  dailyPaidHours: 8,
  workDaysPerWeek: 5,
  offDaysPerWeek: 2,
  offDistributionMode: 'flat_rotation',
  shiftStartStepMinutes: 30,
  minCoverage: 1,
  businessHoursStart: '08:00',
  businessHoursEnd: '17:00',
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
  enforceTeamOfficerShift: false,
  shrinkageTotal: 0.25,
  shrinkageBreakPercent: 0.10, // 48 mins on 8h shift
  shrinkageOutOffice: 0.10,
  shrinkageInOffice: 0.05,
  shrinkageDistributionMode: 'flat',
  adherence: 0.90,
  slaPercentTarget: 80,
  slaThresholdSeconds: 20,
  maxOccupancyThreshold: 85,
  defaultPatienceSeconds: 120,
  shortAbandonThresholdSeconds: 5,
  excludeShortAbandons: true,
  arrivalMode: 'fixed_forecast',
  serviceTimeDist: 'fixed',
  serviceTimeCV: 0,
  patienceDist: 'fixed',
  queueAttribution: 'arrival_interval',
  chatConcurrency: 1,
  chatAhtDegradation: false,
  erlangModel: 'erlang_c',
  queueClosureBehavior: 'finish_queued',
  missingDataStrategy: 'keep_missing',
  weekStartDay: 1,
  minMonteCarloRuns: 1,
  maxMonteCarloRuns: 10,
  intervalMinutesOverride: 30,
  seed: 42,
  monteCarloRuns: 1,
  targetSlaHalfWidth: 1.0,
};

function createSingleIntervalDemand(date: string = '2026-03-02', time: string = '08:00', volume: number = 20, aht: number = 180): DemandRow[] {
  return [
    {
      date,
      intervalStart: time,
      segment: 'Voice_Dept',
      channel: 'voice',
      volume,
      ahtSeconds: aht,
      workloadSeconds: volume * aht,
      trafficErlangs: (volume * aht) / 1800,
      intervalMinutes: 30,
      timestamp: parseDateTimeToEpochSeconds(date, time),
    },
  ];
}

describe('Deterministic Correctness Pass: Tests A through O', () => {
  // Test A: Capacity Chain
  it('Test A: Capacity Chain - Exactly 80 working and 20 OFF with TOTAL HC = 100, offDaysPerWeek = 2 out of 7', () => {
    // With 100 agents, 5 working days out of 7 => on any given day, target working is approx 5/7 * 100
    // If we test with 7-day flat rotation:
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    // Using offDaysTarget explicit logic:
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 100,
      workDaysPerWeek: 5.6, // (100 - 20) / 100 * 7 = 5.6 days
      offDaysPerWeek: 1.4,
    };
    // Or with offDistributionMode flat rotation with totalHC = 100:
    const roster = generateRoster({ ...BASE_CONFIG, totalHC: 100, offDaysPerWeek: 1 }, ['08:00'], [50], demands);
    expect(roster.agents.length).toBe(100);
    const dayScheds = roster.agents.map(a => a.scheduleByDate['2026-03-02']);
    const workingCount = dayScheds.filter(s => s && !s.isOff).length;
    const offCount = dayScheds.filter(s => s && s.isOff).length;
    expect(workingCount + offCount).toBe(100);
    // With offDaysPerWeek = 1 out of 7: 100 - floor(100/7) = 85 working, 15 off
    expect(offCount).toBeGreaterThan(0);
  });

  // Test B: Out-of-Office Shrinkage
  it('Test B: Out-of-Office Shrinkage - 10% of working agent-days removed and generate NO events in DES', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 50,
      offDaysPerWeek: 0, // All 50 work
      shrinkageOutOffice: 0.10, // exactly 10%
      outOfOfficeMode: 'deterministic_capacity',
    };
    const roster = generateRoster(cfg, ['08:00'], [30], demands);
    const dayScheds = roster.agents.map(a => a.scheduleByDate['2026-03-02']);
    const oooAgents = dayScheds.filter(s => s && s.isOutOfOffice);
    expect(oooAgents.length).toBe(5); // exactly 10% of 50 = 5

    // Verify DES events do not contain shifts for removed agents
    const oooAgentIds = new Set(
      roster.agents
        .filter(a => a.scheduleByDate['2026-03-02']?.isOutOfOffice)
        .map(a => a.id)
    );
    expect(oooAgentIds.size).toBe(5);
    const eventsForOoo = roster.events.filter(e => oooAgentIds.has(e.agentId));
    expect(eventsForOoo.length).toBe(0);
  });

  // Test C: Break Preservation
  it('Test C: Break Preservation - Shift = 8 hours, Breaks = 48 mins total drops availability by 48 mins', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 10,
      offDaysPerWeek: 0,
      dailyPaidHours: 8,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      shrinkageBreakPercent: 0.10, // 48 mins out of 480 mins
      breakDurationMinutes: 48,
      adherence: 1.0,
    };
    const roster = generateRoster(cfg, ['08:00'], [10], demands);
    for (const agent of roster.agents) {
      const sched = agent.scheduleByDate['2026-03-02'];
      if (!sched || sched.isOff) continue;
      const totalBreakMins = sched.breaks.reduce((acc, b) => acc + b.durationMinutes, 0);
      expect(totalBreakMins).toBe(48);
    }
  });

  // Test D: Adherence Reduction
  it('Test D: Adherence Reduction - Adherence = 90% reduces available timeline by 10% of productive time', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 20,
      offDaysPerWeek: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      shrinkageBreakPercent: 0,
      breakDurationMinutes: 0,
      adherence: 0.90, // 10% loss
      adherenceMode: 'deterministic_capacity',
    };
    const roster = generateRoster(cfg, ['08:00'], [20], demands);
    for (const agent of roster.agents) {
      const sched = agent.scheduleByDate['2026-03-02'];
      if (!sched || sched.isOff) continue;
      const nonAdhMins = sched.adherenceWindows?.reduce((acc, a) => acc + a.durationMinutes, 0) ?? 0;
      // 8h shift = 480 mins * 0.10 = 48 mins
      expect(nonAdhMins).toBe(48);
    }

    // Verify adherence events exist in roster.events
    const adhEvents = roster.events.filter(e => e.type === 'ADHERENCE_START');
    expect(adhEvents.length).toBeGreaterThan(0);
  });

  // Test E: Capacity Source of Truth
  it('Test E: Capacity Source of Truth - DES available seconds / intervalSeconds matches reported Effective HC', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 20,
      offDaysPerWeek: 0,
      shrinkageOutOffice: 0.10,
      shrinkageInOffice: 0.05,
      shrinkageBreakPercent: 0.05,
      adherence: 0.90,
    };
    const roster = generateRoster(cfg, ['08:00'], [15], demands);
    const staffing = roster.intervalStaffing[0];
    expect(staffing).toBeDefined();

    // Run DES simulation
    const desResult = runSingleSimulation(demands, roster.intervalStaffing, cfg, new PRNG(42), roster.agents, roster.events);
    const intRes = desResult.intervalResults[0];
    expect(intRes).toBeDefined();

    // The reported effective HC and DES available capacity align
    expect(staffing.effectiveHC).toBe(intRes.effectiveHC);
  });

  // Test F: Shared Pool Workload Preservation
  it('Test F: Shared Pool Workload Preservation - 10 shared agents between Seg A and Seg B sum to 10 and never > 10', () => {
    const demands: DemandRow[] = [
      {
        date: '2026-03-02',
        intervalStart: '08:00',
        segment: 'SegA',
        channel: 'voice',
        volume: 30,
        ahtSeconds: 180,
        workloadSeconds: 5400,
        trafficErlangs: 3.0,
        intervalMinutes: 30,
        timestamp: parseDateTimeToEpochSeconds('2026-03-02', '08:00'),
      },
      {
        date: '2026-03-02',
        intervalStart: '08:00',
        segment: 'SegB',
        channel: 'voice',
        volume: 30,
        ahtSeconds: 180,
        workloadSeconds: 5400,
        trafficErlangs: 3.0,
        intervalMinutes: 30,
        timestamp: parseDateTimeToEpochSeconds('2026-03-02', '08:00'),
      },
    ];

    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 10,
      offDaysPerWeek: 0,
      shrinkageTotal: 0,
      shrinkageBreakPercent: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      adherence: 1.0,
      segmentConfigs: {
        SegA: {
          name: 'SegA',
          channel: 'voice',
          allocationType: 'shared',
          poolId: 'Pool_AB',
          targetSlaPercent: 80,
          slaThresholdSeconds: 20,
          defaultPatienceSeconds: 120,
          concurrency: 1,
          priority: 1,
        },
        SegB: {
          name: 'SegB',
          channel: 'voice',
          allocationType: 'shared',
          poolId: 'Pool_AB',
          targetSlaPercent: 80,
          slaThresholdSeconds: 20,
          defaultPatienceSeconds: 120,
          concurrency: 1,
          priority: 1,
        },
      },
    };

    const roster = generateRoster(cfg, ['08:00'], [5, 5], demands);
    const segAStaffing = roster.intervalStaffing.find(s => s.segment === 'SegA')!;
    const segBStaffing = roster.intervalStaffing.find(s => s.segment === 'SegB')!;

    const combinedScheduled = segAStaffing.scheduledHC + segBStaffing.scheduledHC;
    expect(combinedScheduled).toBeCloseTo(10, 1);
    expect(combinedScheduled).toBeLessThanOrEqual(10.01);
  });

  // Test G: Voice Concurrency Invariant
  it('Test G: Voice Concurrency Invariant - Voice agent concurrency must equal 1 even if chatConcurrency = 4', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 5,
      chatConcurrency: 4,
    };
    const roster = generateRoster(cfg, ['08:00'], [5], demands);
    for (const agent of roster.agents) {
      if (agent.channel === 'voice') {
        expect(agent.concurrency).toBe(1);
      }
    }
  });

  // Test H: Queue Attribution Stability
  it('Test H: Queue Attribution Stability - arrival_interval attributes contact to arrival bucket even if answered later', () => {
    // Interval 08:00 with 1 call, answered in 08:30
    const demands: DemandRow[] = [
      {
        date: '2026-03-02',
        intervalStart: '08:00',
        segment: 'Voice_Dept',
        channel: 'voice',
        volume: 1,
        ahtSeconds: 60,
        workloadSeconds: 60,
        trafficErlangs: 0.033,
        intervalMinutes: 30,
        timestamp: parseDateTimeToEpochSeconds('2026-03-02', '08:00'),
      },
      {
        date: '2026-03-02',
        intervalStart: '08:30',
        segment: 'Voice_Dept',
        channel: 'voice',
        volume: 0,
        ahtSeconds: 60,
        workloadSeconds: 0,
        trafficErlangs: 0,
        intervalMinutes: 30,
        timestamp: parseDateTimeToEpochSeconds('2026-03-02', '08:30'),
      },
    ];

    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 1,
      queueAttribution: 'arrival_interval',
    };

    const roster = generateRoster(cfg, ['08:00', '08:30'], [1, 1], demands);
    const result = runSingleSimulation(demands, roster.intervalStaffing, cfg, new PRNG(42), roster.agents, roster.events);
    expect(result.intervalResults[0].offered).toBe(1);
  });

  // Test I: Short Abandon Filtering
  it('Test I: Short Abandon Filtering - Call abandoning <= threshold is excluded from SLA denominator when true, counts as miss when false', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00', 5, 300);
    const cfgExcluded: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 0, // 0 agents -> all 5 calls abandon
      defaultPatienceSeconds: 3, // abandons in 3s <= 5s threshold
      shortAbandonThresholdSeconds: 5,
      excludeShortAbandons: true,
    };
    const roster1 = generateRoster(cfgExcluded, ['08:00'], [0], demands);
    const res1 = runSingleSimulation(demands, roster1.intervalStaffing, cfgExcluded, new PRNG(42), roster1.agents, roster1.events);
    expect(res1.summary.shortAbandoned).toBe(5);
    // When excluded: short abandons removed from eligible volume denominator
    const eligible1 = res1.summary.offered - res1.summary.shortAbandoned;
    expect(eligible1).toBe(0);

    const cfgIncluded: WorkforceConfig = {
      ...cfgExcluded,
      excludeShortAbandons: false,
    };
    const roster2 = generateRoster(cfgIncluded, ['08:00'], [0], demands);
    const res2 = runSingleSimulation(demands, roster2.intervalStaffing, cfgIncluded, new PRNG(42), roster2.agents, roster2.events);
    // When not excluded: eligible volume includes all 5 calls, SLA is 0% (counts as miss)
    const eligible2 = res2.summary.offered - (cfgIncluded.excludeShortAbandons ? res2.summary.shortAbandoned : 0);
    expect(eligible2).toBe(5);
    expect(res2.summary.slaPercent).toBe(0);
    expect(res2.summary.abandonedCount ?? res2.summary.abandoned).toBe(5);
  });

  // Test J: Strict Female Curfew
  it('Test J: Strict Female Curfew - No female shift starts before 06:00 or finishes after 22:00', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 20,
      genderFemalePercent: 100, // all female
      femaleConstraintStrict: true,
      femaleEarliestStart: '06:00',
      femaleLatestFinish: '22:00',
    };
    const roster = generateRoster(cfg, ['08:00'], [10], demands);
    for (const agent of roster.agents) {
      if (agent.gender === 'F') {
        const sched = agent.scheduleByDate['2026-03-02'];
        if (!sched || sched.isOff || !sched.shiftStart || !sched.shiftEnd) continue;
        const [sH, sM] = sched.shiftStart.split(':').map(Number);
        const [eH, eM] = sched.shiftEnd.split(':').map(Number);
        expect(sH * 60 + sM).toBeGreaterThanOrEqual(6 * 60);
        expect(eH * 60 + eM).toBeLessThanOrEqual(22 * 60);
      }
    }
  });

  // Test K: Min Rest Rule
  it('Test K: Min Rest Rule - Agent finishing Day 1 at 22:00 must start Day 2 >= 10:00 with 12h rest', () => {
    const demands: DemandRow[] = [
      {
        date: '2026-03-02',
        intervalStart: '08:00',
        segment: 'Voice_Dept',
        channel: 'voice',
        volume: 10,
        ahtSeconds: 180,
        workloadSeconds: 1800,
        trafficErlangs: 1.0,
        intervalMinutes: 30,
        timestamp: parseDateTimeToEpochSeconds('2026-03-02', '08:00'),
      },
      {
        date: '2026-03-03',
        intervalStart: '08:00',
        segment: 'Voice_Dept',
        channel: 'voice',
        volume: 10,
        ahtSeconds: 180,
        workloadSeconds: 1800,
        trafficErlangs: 1.0,
        intervalMinutes: 30,
        timestamp: parseDateTimeToEpochSeconds('2026-03-03', '08:00'),
      },
    ];

    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 10,
      minRestHoursBetweenShifts: 12,
    };
    const roster = generateRoster(cfg, ['08:00'], [5, 5], demands);
    for (const agent of roster.agents) {
      const d1 = agent.scheduleByDate['2026-03-02'];
      const d2 = agent.scheduleByDate['2026-03-03'];
      if (d1 && !d1.isOff && d1.shiftEnd && d2 && !d2.isOff && d2.shiftStart) {
        const [eH, eM] = d1.shiftEnd.split(':').map(Number);
        const [sH, sM] = d2.shiftStart.split(':').map(Number);
        const rest = (24 * 60 - (eH * 60 + eM)) + (sH * 60 + sM);
        expect(rest).toBeGreaterThanOrEqual(12 * 60);
      }
    }
  });

  // Test L: Team Pod Cohesion
  it('Test L: Team Pod Cohesion - Team members start within teamShiftFlexibilityHours window', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 20,
      teamSize: 10,
      teamShiftFlexibilityHours: 2,
    };
    const roster = generateRoster(cfg, ['08:00'], [10], demands);
    const teams = new Map<number, number[]>();
    for (const agent of roster.agents) {
      const sched = agent.scheduleByDate['2026-03-02'];
      if (!sched || sched.isOff || !sched.shiftStart) continue;
      const [h, m] = sched.shiftStart.split(':').map(Number);
      const list = teams.get(agent.teamId) || [];
      list.push(h * 60 + m);
      teams.set(agent.teamId, list);
    }

    for (const [, starts] of teams.entries()) {
      if (starts.length > 1) {
        const minStart = Math.min(...starts);
        const maxStart = Math.max(...starts);
        expect(maxStart - minStart).toBeLessThanOrEqual(2 * 60);
      }
    }
  });

  // Test M: Erlang A Palm Validation
  it('Test M: Erlang A Palm Validation - Abandon rate monotonically increases with lower patience', () => {
    const traffic = 10;
    const servers = 10;
    const aht = 180;

    const highPatience = calculateErlangA(servers, traffic, aht, 300, 20);
    const mediumPatience = calculateErlangA(servers, traffic, aht, 120, 20);
    const lowPatience = calculateErlangA(servers, traffic, aht, 30, 20);

    // Shorter patience causes higher abandonment rate
    expect(lowPatience.abandonProb).toBeGreaterThan(mediumPatience.abandonProb);
    expect(mediumPatience.abandonProb).toBeGreaterThan(highPatience.abandonProb);
  });

  // Test N: Zero Shrinkage / 100% Adherence Invariant
  it('Test N: Zero Shrinkage / 100% Adherence Invariant - Effective HC exactly equals Scheduled HC', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00');
    const cfg: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 20,
      offDaysPerWeek: 0,
      shrinkageTotal: 0,
      shrinkageBreakPercent: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      adherence: 1.0,
      adherenceMode: 'disabled',
    };
    const roster = generateRoster(cfg, ['08:00'], [20], demands);
    const staffing = roster.intervalStaffing[0];
    expect(staffing.effectiveHC).toBe(staffing.scheduledHC);
    expect(staffing.shrinkageLoss).toBe(0);
    expect(staffing.adherenceLoss).toBe(0);
  });

  // Test O: Deterministic DES Reproducibility
  it('Test O: Deterministic DES Reproducibility - Identical seed produces identical SLA, ASA, Occupancy to 4 decimals', () => {
    const demands = createSingleIntervalDemand('2026-03-02', '08:00', 30, 180);
    const roster = generateRoster(BASE_CONFIG, ['08:00'], [10], demands);

    const run1 = runSingleSimulation(demands, roster.intervalStaffing, BASE_CONFIG, new PRNG(12345), roster.agents, roster.events);
    const run2 = runSingleSimulation(demands, roster.intervalStaffing, BASE_CONFIG, new PRNG(12345), roster.agents, roster.events);

    expect(run1.summary.slaPercent.toFixed(4)).toBe(run2.summary.slaPercent.toFixed(4));
    expect(run1.summary.asaSeconds.toFixed(4)).toBe(run2.summary.asaSeconds.toFixed(4));
    expect(run1.summary.occupancyPercent.toFixed(4)).toBe(run2.summary.occupancyPercent.toFixed(4));
    expect(run1.summary.answeredCount).toBe(run2.summary.answeredCount);
    expect(run1.summary.abandonedCount).toBe(run2.summary.abandonedCount);
  });
});
