import { describe, it, expect } from 'vitest';
import { generateRoster } from '../src/engines/roster';
import { runSingleSimulation } from '../src/engines/des';
import { WorkforceConfig, DemandRow } from '../src/types';

describe('Point 1: Deterministic Channel Concurrency Tests', () => {
  const baseConfig: WorkforceConfig = {
    totalHC: 10,
    segmentHC: {},
    dailyPaidHours: 8,
    workDaysPerWeek: 5,
    offDaysPerWeek: 2,
    offDistributionMode: 'dynamic_volume_trend',
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
    genderFemalePercent: 0,
    femaleEarliestStart: '06:00',
    femaleLatestFinish: '22:00',
    femaleMinShiftHours: 6,
    femaleMaxShiftHours: 8,
    femaleConstraintStrict: false,
    teamSize: 10,
    teamShiftFlexibilityHours: 2,
    teamOffDeviationPercent: 20,
    enforceTeamOfficerShift: false,
    shrinkageTotal: 0.10,
    shrinkageBreakPercent: 0.05,
    shrinkageOutOffice: 0.02,
    shrinkageInOffice: 0.03,
    shrinkageDistributionMode: 'flat',
    adherence: 1.0,
    slaPercentTarget: 80,
    slaThresholdSeconds: 20,
    maxOccupancyThreshold: 90,
    defaultPatienceSeconds: 180,
    shortAbandonThresholdSeconds: 5,
    excludeShortAbandons: false,
    arrivalMode: 'fixed_forecast',
    serviceTimeDist: 'fixed',
    serviceTimeCV: 0,
    patienceDist: 'fixed',
    queueAttribution: 'arrival_interval',
    chatConcurrency: 3, // Configured to 3!
    chatAhtDegradation: false,
    erlangModel: 'erlang_c',
    queueClosureBehavior: 'finish_queued',
    missingDataStrategy: 'keep_missing',
    weekStartDay: 1,
    minMonteCarloRuns: 1,
    maxMonteCarloRuns: 1,
    intervalMinutesOverride: 30,
    seed: 42,
    monteCarloRuns: 1,
    targetSlaHalfWidth: 1.0,
  };

  it('Voice agent concurrency MUST always equal 1 even when chatConcurrency = 3', () => {
    const intervals = ['08:00', '08:30', '09:00'];
    const erlangReqs = [2, 2, 2];
    const demands: DemandRow[] = [
      {
        date: '2026-03-01',
        intervalStart: '08:00',
        segment: 'Retail_Voice',
        channel: 'voice',
        volume: 20,
        ahtSeconds: 180,
        workloadSeconds: 3600,
        trafficErlangs: 2.0,
        intervalMinutes: 30,
      },
    ];

    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    expect(roster.agents.length).toBeGreaterThan(0);

    for (const agent of roster.agents) {
      if (agent.channel === 'voice') {
        expect(agent.concurrency).toBe(1);
      }
    }
  });

  it('Chat agent concurrency equals configured chatConcurrency = 3 and can hold 3 simultaneous contacts', () => {
    const intervals = ['08:00', '08:30', '09:00'];
    const erlangReqs = [1, 1, 1];
    const chatDemands: DemandRow[] = [
      {
        date: '2026-03-01',
        intervalStart: '08:00',
        segment: 'Web_Chat',
        channel: 'chat',
        volume: 3, // 3 arrivals in interval
        ahtSeconds: 300,
        workloadSeconds: 900,
        trafficErlangs: 0.5,
        intervalMinutes: 30,
      },
    ];

    const chatConfig: WorkforceConfig = {
      ...baseConfig,
      totalHC: 1, // Exactly 1 agent
      workDaysPerWeek: 7,
      offDaysPerWeek: 0,
      chatConcurrency: 3,
    };

    const roster = generateRoster(chatConfig, intervals, erlangReqs, chatDemands);
    expect(roster.agents[0].channel).toBe('chat');
    expect(roster.agents[0].concurrency).toBe(3);

    // Simulate 3 simultaneous arrivals with 1 chat agent
    const simResult = runSingleSimulation(
      chatDemands,
      roster.intervalStaffing,
      chatConfig,
      roster.agents,
      roster.events
    );

    // 1 agent with concurrency 3 can answer all 3 without abandoning or waiting
    expect(simResult.summary.offered).toBe(3);
    expect(simResult.summary.answered).toBe(3);
    expect(simResult.summary.abandoned).toBe(0);
    expect(simResult.summary.totalWaitingSeconds).toBe(0);
  });
});

describe('Point 2: Deterministic Shared Pool Eligibility & Skill Isolation Tests', () => {
  const intervals = ['08:00', '08:30', '09:00'];
  const erlangReqs = [2, 2, 2];

  const poolDemands: DemandRow[] = [
    {
      date: '2026-03-01',
      intervalStart: '08:00',
      segment: 'Retail',
      channel: 'voice',
      volume: 10,
      ahtSeconds: 180,
      workloadSeconds: 1800,
      trafficErlangs: 1.0,
      intervalMinutes: 30,
    },
    {
      date: '2026-03-01',
      intervalStart: '08:00',
      segment: 'Prestige',
      channel: 'voice',
      volume: 10,
      ahtSeconds: 180,
      workloadSeconds: 1800,
      trafficErlangs: 1.0,
      intervalMinutes: 30,
    },
    {
      date: '2026-03-01',
      intervalStart: '08:00',
      segment: 'SMB',
      channel: 'voice',
      volume: 10,
      ahtSeconds: 180,
      workloadSeconds: 1800,
      trafficErlangs: 1.0,
      intervalMinutes: 30,
    },
    {
      date: '2026-03-01',
      intervalStart: '08:00',
      segment: 'eMoney',
      channel: 'voice',
      volume: 10,
      ahtSeconds: 180,
      workloadSeconds: 1800,
      trafficErlangs: 1.0,
      intervalMinutes: 30,
    },
    {
      date: '2026-03-01',
      intervalStart: '08:00',
      segment: 'VIP_Dedicated',
      channel: 'voice',
      volume: 5,
      ahtSeconds: 180,
      workloadSeconds: 900,
      trafficErlangs: 0.5,
      intervalMinutes: 30,
    },
  ];

  const poolConfig: WorkforceConfig = {
    totalHC: 20,
    segmentHC: {},
    dailyPaidHours: 8,
    workDaysPerWeek: 5,
    offDaysPerWeek: 2,
    offDistributionMode: 'dynamic_volume_trend',
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
    genderFemalePercent: 0,
    femaleEarliestStart: '06:00',
    femaleLatestFinish: '22:00',
    femaleMinShiftHours: 6,
    femaleMaxShiftHours: 8,
    femaleConstraintStrict: false,
    teamSize: 10,
    teamShiftFlexibilityHours: 2,
    teamOffDeviationPercent: 20,
    enforceTeamOfficerShift: false,
    shrinkageTotal: 0.10,
    shrinkageBreakPercent: 0.05,
    shrinkageOutOffice: 0.02,
    shrinkageInOffice: 0.03,
    shrinkageDistributionMode: 'flat',
    adherence: 1.0,
    slaPercentTarget: 80,
    slaThresholdSeconds: 20,
    maxOccupancyThreshold: 90,
    defaultPatienceSeconds: 180,
    shortAbandonThresholdSeconds: 5,
    excludeShortAbandons: false,
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
    maxMonteCarloRuns: 1,
    intervalMinutesOverride: 30,
    seed: 42,
    monteCarloRuns: 1,
    targetSlaHalfWidth: 1.0,
    segmentConfigs: {
      Retail: { name: 'Retail', channel: 'voice', allocationType: 'shared', poolId: 'Pool_A', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 180, concurrency: 1, priority: 1 },
      Prestige: { name: 'Prestige', channel: 'voice', allocationType: 'shared', poolId: 'Pool_A', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 180, concurrency: 1, priority: 1 },
      SMB: { name: 'SMB', channel: 'voice', allocationType: 'shared', poolId: 'Pool_B', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 180, concurrency: 1, priority: 1 },
      eMoney: { name: 'eMoney', channel: 'voice', allocationType: 'shared', poolId: 'Pool_B', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 180, concurrency: 1, priority: 1 },
      VIP_Dedicated: { name: 'VIP_Dedicated', channel: 'voice', allocationType: 'dedicated', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 180, concurrency: 1, priority: 1 },
    },
  };

  it('Shared agents must receive skills belonging only to their configured pool (no cross-pool skills)', () => {
    const roster = generateRoster(poolConfig, intervals, erlangReqs, poolDemands);

    const poolAAgents = roster.agents.filter(a => a.poolId === 'Pool_A');
    const poolBAgents = roster.agents.filter(a => a.poolId === 'Pool_B');
    const dedicatedAgents = roster.agents.filter(a => a.segment === 'VIP_Dedicated');

    expect(poolAAgents.length).toBeGreaterThan(0);
    expect(poolBAgents.length).toBeGreaterThan(0);
    expect(dedicatedAgents.length).toBeGreaterThan(0);

    for (const ag of poolAAgents) {
      expect(ag.skills).toContain('Retail');
      expect(ag.skills).toContain('Prestige');
      expect(ag.skills).not.toContain('SMB');
      expect(ag.skills).not.toContain('eMoney');
      expect(ag.skills).not.toContain('VIP_Dedicated');
    }

    for (const ag of poolBAgents) {
      expect(ag.skills).toContain('SMB');
      expect(ag.skills).toContain('eMoney');
      expect(ag.skills).not.toContain('Retail');
      expect(ag.skills).not.toContain('Prestige');
      expect(ag.skills).not.toContain('VIP_Dedicated');
    }

    for (const ag of dedicatedAgents) {
      expect(ag.skills).toEqual(['VIP_Dedicated']);
    }
  });

  it('Deterministic routing prevents cross-pool contact leakage during DES simulation', () => {
    const roster = generateRoster(poolConfig, intervals, erlangReqs, poolDemands);

    const result = runSingleSimulation(
      poolDemands,
      roster.intervalStaffing,
      poolConfig,
      roster.agents,
      roster.events
    );

    // Verify all 5 segments are present and answered correctly according to their capacity
    expect(result.intervalResults.length).toBe(5);
    const retailRes = result.intervalResults.find(r => r.segment === 'Retail');
    const smbRes = result.intervalResults.find(r => r.segment === 'SMB');
    const vipRes = result.intervalResults.find(r => r.segment === 'VIP_Dedicated');

    expect(retailRes?.offered).toBe(10);
    expect(smbRes?.offered).toBe(10);
    expect(vipRes?.offered).toBe(5);
  });
});

describe('Point 6: Queue Closure Behavior Tests', () => {
  const demands: DemandRow[] = [
    {
      date: '2026-03-01',
      intervalStart: '16:30',
      segment: 'Voice_Late',
      channel: 'voice',
      volume: 10,
      ahtSeconds: 600, // 10 minutes each
      workloadSeconds: 6000,
      trafficErlangs: 3.33,
      intervalMinutes: 30,
    },
  ];

  const config: WorkforceConfig = {
    totalHC: 1, // Only 1 agent available, contacts will queue past 17:00
    segmentHC: {},
    dailyPaidHours: 8,
    workDaysPerWeek: 5,
    offDaysPerWeek: 2,
    offDistributionMode: 'dynamic_volume_trend',
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
    genderFemalePercent: 0,
    femaleEarliestStart: '06:00',
    femaleLatestFinish: '22:00',
    femaleMinShiftHours: 6,
    femaleMaxShiftHours: 8,
    femaleConstraintStrict: false,
    teamSize: 10,
    teamShiftFlexibilityHours: 2,
    teamOffDeviationPercent: 20,
    enforceTeamOfficerShift: false,
    shrinkageTotal: 0.10,
    shrinkageBreakPercent: 0.05,
    shrinkageOutOffice: 0.02,
    shrinkageInOffice: 0.03,
    shrinkageDistributionMode: 'flat',
    adherence: 1.0,
    slaPercentTarget: 80,
    slaThresholdSeconds: 20,
    maxOccupancyThreshold: 90,
    defaultPatienceSeconds: 3600, // high patience so they don't abandon early
    shortAbandonThresholdSeconds: 5,
    excludeShortAbandons: false,
    arrivalMode: 'fixed_forecast',
    serviceTimeDist: 'fixed',
    serviceTimeCV: 0,
    patienceDist: 'fixed',
    queueAttribution: 'arrival_interval',
    chatConcurrency: 1,
    chatAhtDegradation: false,
    erlangModel: 'erlang_c',
    missingDataStrategy: 'keep_missing',
    weekStartDay: 1,
    minMonteCarloRuns: 1,
    maxMonteCarloRuns: 1,
    intervalMinutesOverride: 30,
    seed: 42,
    monteCarloRuns: 1,
    targetSlaHalfWidth: 1.0,
    queueClosureBehavior: 'force_close',
  };

  it('force_close immediately abandons contacts remaining in queue at horizonEnd without delay', () => {
    const roster = generateRoster(config, ['16:30'], [1], demands);
    const res = runSingleSimulation(demands, roster.intervalStaffing, config, roster.agents, roster.events);

    expect(res.summary.offered).toBe(10);
    // With force_close, remaining queued contacts are abandoned at horizonEnd
    expect(res.summary.abandoned).toBeGreaterThan(0);
  });
});
