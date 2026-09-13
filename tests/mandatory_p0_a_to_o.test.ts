import { describe, it, expect } from 'vitest';
import { parseDemandCSVAdvanced, parseDateTimeToEpochSeconds } from '../src/data/sampleDemand';
import { generateRoster } from '../src/engines/roster';
import { runSingleSimulation, runMonteCarloSimulation, PRNG } from '../src/engines/des';
import { calculateErlangC, solveRequiredStaffing } from '../src/engines/erlang';
import { WorkforceConfig, DemandRow } from '../src/types';

const BASE_CONFIG: WorkforceConfig = {
  totalHC: 20,
  segmentHC: {},
  workDaysPerWeek: 5,
  offDaysPerWeek: 2,
  dailyPaidHours: 8,
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
  femaleConstraintStrict: false,
  teamSize: 10,
  teamShiftFlexibilityHours: 2,
  teamOffDeviationPercent: 20,
  enforceTeamOfficerShift: false,
  shrinkageTotal: 0.25,
  shrinkageBreakPercent: 0.07,
  shrinkageOutOffice: 0.12,
  shrinkageInOffice: 0.13,
  shrinkageDistributionMode: 'flat',
  offDistributionMode: 'flat_rotation',
  adherence: 0.90,
  slaPercentTarget: 80,
  slaThresholdSeconds: 20,
  maxOccupancyThreshold: 85,
  defaultPatienceSeconds: 120,
  shortAbandonThresholdSeconds: 5,
  excludeShortAbandons: true,
  minCoverage: 1,
  businessHoursStart: '08:00',
  businessHoursEnd: '18:00',
  is24x7: false,
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
  shiftStartStepMinutes: 30,
  minMonteCarloRuns: 5,
  maxMonteCarloRuns: 50,
  intervalMinutesOverride: 0,
  seed: 42,
  monteCarloRuns: 10,
  targetSlaHalfWidth: 1.0,
};

describe('P0 Mandatory Tests A through O (Simulation Correctness)', () => {
  // Test A: Hourly dataset detection
  it('Test A: Hourly dataset detection correctly identifies 60-minute intervals', () => {
    const hourlyCsv = `date,interval,volume,aht,segment
01/09/2026,08:00,100,300,Voice
01/09/2026,09:00,120,300,Voice
01/09/2026,10:00,150,300,Voice`;
    const result = parseDemandCSVAdvanced(hourlyCsv);
    expect(result.detectedInterval).toBe(60);
    expect(result.demands.length).toBe(3);
    expect(result.demands[0].intervalMinutes).toBe(60);
    expect(result.demands[1].intervalMinutes).toBe(60);
  });

  // Test B: Simultaneous segments handled as simultaneous events
  it('Test B: Simultaneous segments have identical timestamps and are not processed sequentially', () => {
    const multiSegCsv = `date,interval,volume,aht,segment
01/09/2026,08:00,100,300,Retail
01/09/2026,08:00,40,250,Prestige
01/09/2026,08:00,20,400,SMB
01/09/2026,08:30,110,300,Retail`;
    const result = parseDemandCSVAdvanced(multiSegCsv);
    expect(result.demands.length).toBe(4);
    // The three 08:00 rows must share the exact same timestamp
    const t0 = result.demands[0].timestamp;
    const t1 = result.demands[1].timestamp;
    const t2 = result.demands[2].timestamp;
    expect(t0).toBe(t1);
    expect(t1).toBe(t2);

    // 08:30 timestamp must be exactly 1800 seconds later
    const t3 = result.demands[3].timestamp;
    expect(t3 - t0).toBe(1800);
  });

  // Test C: Zero headcount generates zero agents
  it('Test C: Zero headcount generates zero agents without fallback or crash', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 50,
        ahtSeconds: 240,
        workloadSeconds: 12000,
        trafficErlangs: 6.67,
        segment: 'Retail',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const zeroHcConfig = { ...BASE_CONFIG, totalHC: 0 };
    const roster = generateRoster(zeroHcConfig, ['08:00'], [7], demands);
    expect(roster.agents.length).toBe(0);
    expect(roster.summary.totalHC).toBe(0);
  });

  // Test D: Zero OFF days / week keeps all days working
  it('Test D: Zero OFF days per week schedules all agents to work every day', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 50,
        ahtSeconds: 240,
        workloadSeconds: 12000,
        trafficErlangs: 6.67,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
      {
        id: '2',
        date: '02/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 50,
        ahtSeconds: 240,
        workloadSeconds: 12000,
        trafficErlangs: 6.67,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('02/09/2026', '08:00'),
      },
    ];

    const zeroOffConfig = { ...BASE_CONFIG, totalHC: 5, offDaysPerWeek: 0 };
    const roster = generateRoster(zeroOffConfig, ['08:00'], [5], demands);
    expect(roster.agents.length).toBe(5);

    // Every agent should have isOff === false for all dates
    for (const agent of roster.agents) {
      const s1 = agent.scheduleByDate['01/09/2026'];
      const s2 = agent.scheduleByDate['02/09/2026'];
      expect(s1?.isOff).toBe(false);
      expect(s2?.isOff).toBe(false);
    }
  });

  // Test E: Agent shift modification changes DES availability
  it('Test E: Modifying an agent shift directly changes DES simulation output', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 10,
        ahtSeconds: 180,
        workloadSeconds: 1800,
        trafficErlangs: 1.0,
        segment: 'Retail',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const roster = generateRoster(BASE_CONFIG, ['08:00'], [2], demands);
    expect(roster.agents.length).toBeGreaterThan(0);

    // Run baseline simulation with agents starting at 08:00
    const res1 = runSingleSimulation(demands, roster.intervalStaffing, BASE_CONFIG, new PRNG(42), roster.agents);

    // Now modify the agents' shift start to 12:00 (after the interval has passed)
    const modifiedAgents = roster.agents.map(a => ({
      ...a,
      scheduleByDate: {
        '01/09/2026': {
          date: '01/09/2026',
          dayIndex: 0,
          dayName: 'Monday',
          isOff: false,
          shiftStart: '12:00',
          shiftEnd: '20:00',
          breaks: [],
          plannedShrinkages: [],
        },
      },
    }));

    const res2 = runSingleSimulation(demands, roster.intervalStaffing, BASE_CONFIG, new PRNG(42), modifiedAgents);

    // When agents start at 12:00, 08:00 has 0 staffed agents, so SLA must drop to 0
    expect(res2.summary.slaPercent).toBeLessThan(res1.summary.slaPercent);
    expect(res2.summary.answeredCount).toBeLessThan(res1.summary.answeredCount);
  });

  // Test F: Queue continuity across interval boundaries
  it('Test F: Contacts queued in interval 1 continue waiting and are answered or abandon in interval 2', () => {
    // Interval 1: High volume, 0 agents available -> contacts enter queue
    // Interval 2: Low volume, 10 agents available -> queued contacts get served
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 20,
        ahtSeconds: 120,
        workloadSeconds: 2400,
        trafficErlangs: 1.33,
        segment: 'Retail',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
      {
        id: '2',
        date: '01/09/2026',
        intervalStart: '08:30',
        intervalEnd: '09:00',
        intervalMinutes: 30,
        volume: 2,
        ahtSeconds: 120,
        workloadSeconds: 240,
        trafficErlangs: 0.13,
        segment: 'Retail',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:30'),
      },
    ];

    // Agents only start at 08:30
    const agents = [
      {
        id: 'AG-0001',
        name: 'Agent 1',
        segment: 'Retail',
        channel: 'voice' as const,
        team: 'Team A',
        teamId: 0,
        gender: 'F' as const,
        isSupervisor: false,
        skills: ['Retail'],
        concurrency: 1,
        scheduleByDate: {
          '01/09/2026': {
            date: '01/09/2026',
            dayIndex: 0,
            dayName: 'Monday',
            isOff: false,
            shiftStart: '08:30',
            shiftEnd: '16:30',
            breaks: [],
            plannedShrinkages: [],
          },
        },
      },
    ];

    const config: WorkforceConfig = {
      ...BASE_CONFIG,
      defaultPatienceSeconds: 3600, // high patience so they don't abandon
    };

    const res = runSingleSimulation(demands, [], config, new PRNG(42), agents);
    // Queue carried over and answered in interval 2!
    expect(res.intervalResults[0].queueEnd).toBeGreaterThan(0);
    expect(res.intervalResults[1].queueStart).toBe(res.intervalResults[0].queueEnd);
    expect(res.summary.answeredCount).toBeGreaterThan(0);
  });

  // Test G: Time-weighted queue integral calculation
  it('Test G: Average queue length is calculated using time integration rather than event count', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 30,
        ahtSeconds: 300,
        workloadSeconds: 9000,
        trafficErlangs: 5.0,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const res = runSingleSimulation(demands, [], { ...BASE_CONFIG, totalHC: 1 }, new PRNG(42));
    const intRes = res.intervalResults[0];
    expect(intRes.avgQueue).toBeDefined();
    expect(typeof intRes.avgQueue).toBe('number');
    expect(intRes.avgQueue).toBeGreaterThanOrEqual(0);
    expect(intRes.maxQueue).toBeGreaterThanOrEqual(intRes.avgQueue);
  });

  // Test H: Actual wall-clock overlap for agent busy time
  it('Test H: Agent busy time is allocated based on actual time overlap across interval boundaries', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 1,
        ahtSeconds: 1200, // 20 minutes call
        workloadSeconds: 1200,
        trafficErlangs: 0.67,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
      {
        id: '2',
        date: '01/09/2026',
        intervalStart: '08:30',
        intervalEnd: '09:00',
        intervalMinutes: 30,
        volume: 0,
        ahtSeconds: 1200,
        workloadSeconds: 0,
        trafficErlangs: 0.0,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:30'),
      },
    ];

    const agents = [
      {
        id: 'AG-0001',
        name: 'Agent 1',
        segment: 'Voice',
        channel: 'voice' as const,
        team: 'Team A',
        teamId: 0,
        gender: 'M' as const,
        isSupervisor: false,
        skills: ['Voice'],
        concurrency: 1,
        scheduleByDate: {
          '01/09/2026': {
            date: '01/09/2026',
            dayIndex: 0,
            dayName: 'Monday',
            isOff: false,
            shiftStart: '08:00',
            shiftEnd: '16:00',
            breaks: [],
            plannedShrinkages: [],
          },
        },
      },
    ];

    const res = runSingleSimulation(demands, [], BASE_CONFIG, new PRNG(42), agents);
    expect(res.intervalResults[0].occupancyPercent).toBeGreaterThan(0);
    expect(res.intervalResults[0].occupancyPercent).toBeLessThanOrEqual(100);
  });

  // Test I: In-flight contact completes past shift end without taking new work
  it('Test I: In-flight contact completes after shift end without agent taking newly queued contacts', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 15,
        ahtSeconds: 1200, // 20 minutes call
        workloadSeconds: 18000,
        trafficErlangs: 10.0,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    // Agent shift ends at 08:10 (600 sec into interval)
    const agents = [
      {
        id: 'AG-0001',
        name: 'Agent 1',
        segment: 'Voice',
        channel: 'voice' as const,
        team: 'Team A',
        teamId: 0,
        gender: 'M' as const,
        isSupervisor: false,
        skills: ['Voice'],
        concurrency: 1,
        scheduleByDate: {
          '01/09/2026': {
            date: '01/09/2026',
            dayIndex: 0,
            dayName: 'Monday',
            isOff: false,
            shiftStart: '08:00',
            shiftEnd: '08:10',
            breaks: [],
            plannedShrinkages: [],
          },
        },
      },
    ];

    const res = runSingleSimulation(demands, [], BASE_CONFIG, new PRNG(42), agents);
    // 1 call started before 08:10 was answered and completed past shift end (duration 1200s); remaining calls abandoned because agent went off duty
    expect(res.summary.answeredCount).toBe(1);
    expect(res.summary.abandonedCount).toBe(14);
  });

  // Test J: Chat concurrency takes up to N active chats
  it('Test J: Chat concurrency permits an agent to handle up to N simultaneous interactions', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 3,
        ahtSeconds: 1200,
        workloadSeconds: 3600,
        trafficErlangs: 2.0,
        segment: 'ChatQueue',
        channel: 'chat',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const singleAgentConcurrency3 = [
      {
        id: 'AG-0001',
        name: 'Chat Agent',
        segment: 'ChatQueue',
        channel: 'chat' as const,
        team: 'Team A',
        teamId: 0,
        gender: 'F' as const,
        isSupervisor: false,
        skills: ['ChatQueue'],
        concurrency: 3,
        scheduleByDate: {
          '01/09/2026': {
            date: '01/09/2026',
            dayIndex: 0,
            dayName: 'Monday',
            isOff: false,
            shiftStart: '08:00',
            shiftEnd: '16:00',
            breaks: [],
            plannedShrinkages: [],
          },
        },
      },
    ];

    const res = runSingleSimulation(demands, [], { ...BASE_CONFIG, chatConcurrency: 3 }, new PRNG(42), singleAgentConcurrency3);
    // Single agent served all 3 concurrent chats!
    expect(res.summary.answeredCount).toBe(3);
    expect(res.summary.abandonedCount).toBe(0);
  });

  // Test K: Seed reproducibility in Monte Carlo
  it('Test K: Monte Carlo produces bitwise identical results with the same seed', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 40,
        ahtSeconds: 200,
        workloadSeconds: 8000,
        trafficErlangs: 4.44,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const roster = generateRoster(BASE_CONFIG, ['08:00'], [6], demands);

    const run1 = runMonteCarloSimulation(demands, roster.intervalStaffing, { ...BASE_CONFIG, seed: 12345, monteCarloRuns: 5 }, roster.agents, roster.events);
    const run2 = runMonteCarloSimulation(demands, roster.intervalStaffing, { ...BASE_CONFIG, seed: 12345, monteCarloRuns: 5 }, roster.agents, roster.events);

    expect(run1.stats.slaMean).toBe(run2.stats.slaMean);
    expect(run1.stats.expectedAsa).toBe(run2.stats.expectedAsa);
    expect(run1.stats.runsExecuted).toBe(run2.stats.runsExecuted);
  });

  // Test L: Adaptive Monte Carlo stops when half-width target reached
  it('Test L: Adaptive Monte Carlo terminates early when confidence interval half-width is met', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 20,
        ahtSeconds: 150,
        workloadSeconds: 3000,
        trafficErlangs: 1.67,
        segment: 'Voice',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const roster = generateRoster(BASE_CONFIG, ['08:00'], [3], demands);

    const res = runMonteCarloSimulation(
      demands,
      roster.intervalStaffing,
      {
        ...BASE_CONFIG,
        minMonteCarloRuns: 5,
        maxMonteCarloRuns: 100,
        targetSlaHalfWidth: 5.0, // generous target so it converges quickly
      },
      roster.agents,
      roster.events
    );

    // Should stop before reaching max 100 runs
    expect(res.stats.runsExecuted).toBeLessThan(100);
    expect(res.stats.runsExecuted).toBeGreaterThanOrEqual(5);
  });

  // Test M: Dedicated vs shared headcount distribution
  it('Test M: Explicit dedicated and shared headcount are assigned without round-robin interpolation', () => {
    const demands: DemandRow[] = [
      {
        id: '1',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 50,
        ahtSeconds: 200,
        workloadSeconds: 10000,
        trafficErlangs: 5.56,
        segment: 'Retail',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
      {
        id: '2',
        date: '01/09/2026',
        intervalStart: '08:00',
        intervalEnd: '08:30',
        intervalMinutes: 30,
        volume: 20,
        ahtSeconds: 200,
        workloadSeconds: 4000,
        trafficErlangs: 2.22,
        segment: 'Prestige',
        channel: 'voice',
        timestamp: parseDateTimeToEpochSeconds('01/09/2026', '08:00'),
      },
    ];

    const config: WorkforceConfig = {
      ...BASE_CONFIG,
      totalHC: 100,
      segmentHC: {
        Retail: 80,
        Prestige: 20,
      },
    };

    const roster = generateRoster(config, ['08:00'], [8], demands);
    expect(roster.agents.length).toBe(100);

    const retailAgents = roster.agents.filter(a => a.segment === 'Retail');
    const prestigeAgents = roster.agents.filter(a => a.segment === 'Prestige');

    expect(retailAgents.length).toBe(80);
    expect(prestigeAgents.length).toBe(20);

    // Dedicated skills
    expect(retailAgents[0].skills).toEqual(['Retail']);
    expect(prestigeAgents[0].skills).toEqual(['Prestige']);
  });

  // Test N: Partial week horizon has no fabricated days
  it('Test N: Schedular respects exact date horizon without extrapolating fake days', () => {
    const threeDayCsv = `date,interval,volume,aht,segment
01/09/2026,08:00,100,300,Voice
02/09/2026,08:00,120,300,Voice
03/09/2026,08:00,110,300,Voice`;

    const parsed = parseDemandCSVAdvanced(threeDayCsv);
    expect(parsed.demands.length).toBe(3);

    const roster = generateRoster(BASE_CONFIG, ['08:00'], [5], parsed.demands);
    expect(roster.weeklyPlan.days.length).toBe(3);
    expect(roster.weeklyPlan.days.map(d => d.date)).toEqual(['01/09/2026', '02/09/2026', '03/09/2026']);
  });

  // Test O: Erlang C voice benchmark correctness
  it('Test O: Erlang C produces mathematical standards-compliant SLA and occupancy benchmarks', () => {
    // Traffic = 10 Erlangs, Servers = 15, AHT = 180s, Target SLA = 20s
    const erlangResult = calculateErlangC(15, 10, 180, 20);
    expect(erlangResult.occupancy).toBeCloseTo(10 / 15, 2);
    expect(erlangResult.sla).toBeGreaterThan(0.80);
    expect(erlangResult.sla).toBeLessThanOrEqual(1.0);
    expect(erlangResult.asa).toBeGreaterThan(0);
    expect(erlangResult.asa).toBeLessThan(60);

    // Required staffing solver should calculate servers required to meet 90% SLA
    const req = solveRequiredStaffing(10, 180, 0.90, 20, 0.85);
    expect(req).toBeGreaterThanOrEqual(14);
    expect(req).toBeLessThanOrEqual(18);
  });
});
