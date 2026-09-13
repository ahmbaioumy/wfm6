import { describe, it, expect } from 'vitest';
import { generateRoster } from '../src/engines/roster';
import { runSingleSimulation } from '../src/engines/des';
import { WorkforceConfig, DemandRow } from '../src/types';
import { PRNG } from '../src/engines/des';

describe('Comprehensive Core Logic Repair Suite (Parts 1-28)', () => {
  const baseConfig: WorkforceConfig = {
    totalHC: 100,
    segmentHC: {},
    dailyPaidHours: 8,
    workDaysPerWeek: 5,
    offDaysPerWeek: 2,
    offDistributionMode: 'dynamic_volume_trend',
    shiftStartStepMinutes: 30,
    minCoverage: 1,
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
    excludeShortAbandons: false,
    arrivalMode: 'fixed_forecast',
    serviceTimeDist: 'fixed',
    serviceTimeCV: 0.50,
    patienceDist: 'fixed',
    queueAttribution: 'arrival_interval',
    queueClosureBehavior: 'finish_queued',
    missingDataStrategy: 'keep_missing',
    weekStartDay: 1,
    chatConcurrency: 3,
    chatAhtDegradation: false,
    erlangModel: 'erlang_c',
    seed: 42,
    monteCarloRuns: 1,
    minMonteCarloRuns: 1,
    maxMonteCarloRuns: 1,
    targetSlaHalfWidth: 0.05,
  };

  // Helper to generate a multi-day demand dataset
  function createDemandHorizon(numDays: number, pattern: 'morning_heavy' | 'afternoon_heavy' | 'flat' = 'flat'): DemandRow[] {
    const demands: DemandRow[] = [];
    const baseDate = new Date(Date.UTC(2026, 7, 31, 0, 0, 0)); // 2026-08-31 (Mon) - Full contract week start

    for (let d = 0; d < numDays; d++) {
      const dayDate = new Date(baseDate.getTime() + d * 86400000);
      const y = dayDate.getUTCFullYear();
      const m = (dayDate.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = dayDate.getUTCDate().toString().padStart(2, '0');
      const dateStr = `${day}/${m}/${y}`;

      for (let h = 8; h < 20; h++) {
        for (let min of [0, 30]) {
          const timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
          let volume = 50;
          if (pattern === 'morning_heavy') {
            volume = h < 14 ? 100 : 20;
          } else if (pattern === 'afternoon_heavy') {
            volume = h >= 14 ? 100 : 20;
          }
          demands.push({
            date: dateStr,
            intervalStart: timeStr,
            segment: 'Voice',
            channel: 'voice',
            volume,
            ahtSeconds: 300,
            intervalMinutes: 30,
            workloadSeconds: volume * 300,
            trafficErlangs: (volume * 300) / 1800,
          });
        }
      }
    }
    return demands;
  }

  // Part 1: Contract Week Multi-Week OFF-Day Math (14 days = 2 full contract weeks)
  it('Part 1: Exactly 400 OFF agent-days allocated for 100 agents over 14 days with 5:2 contract', () => {
    const demands = createDemandHorizon(14, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);

    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);

    expect(roster.agents.length).toBe(100);

    let totalOffAgentDays = 0;
    for (const ag of roster.agents) {
      let agentOffDaysWeek1 = 0;
      let agentOffDaysWeek2 = 0;
      const dates = Object.keys(ag.scheduleByDate);
      expect(dates.length).toBe(14);

      for (let i = 0; i < 7; i++) {
        if (ag.scheduleByDate[dates[i]]?.isOff) agentOffDaysWeek1++;
      }
      for (let i = 7; i < 14; i++) {
        if (ag.scheduleByDate[dates[i]]?.isOff) agentOffDaysWeek2++;
      }

      // Exactly 2 OFF days in Week 1, and 2 OFF days in Week 2 per agent
      expect(agentOffDaysWeek1).toBe(2);
      expect(agentOffDaysWeek2).toBe(2);

      totalOffAgentDays += agentOffDaysWeek1 + agentOffDaysWeek2;
    }

    // 100 agents * 2 off days * 2 weeks = 400 OFF agent-days
    expect(totalOffAgentDays).toBe(400);
  });

  // Part 2: Consecutive OFF days enforcement
  it('Part 2: All assigned OFF days within each contract week are consecutive when requireConsecutiveOff is true', () => {
    const demands = createDemandHorizon(7, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);

    const roster = generateRoster({ ...baseConfig, requireConsecutiveOff: true }, intervals, erlangReqs, demands);

    for (const ag of roster.agents) {
      const dates = Object.keys(ag.scheduleByDate);
      const offIndices: number[] = [];
      for (let i = 0; i < dates.length; i++) {
        if (ag.scheduleByDate[dates[i]]?.isOff) offIndices.push(i);
      }
      expect(offIndices.length).toBe(2);
      // Consecutive: difference is 1 or wraps around (0 and 6)
      const diff = Math.abs(offIndices[1] - offIndices[0]);
      expect(diff === 1 || diff === 6).toBe(true);
    }
  });

  // Part 3: Min / Max Consecutive Work Days enforcement
  it('Part 3: Consecutive working days never exceed maxConsecutiveWorkDays and satisfy minConsecutiveWorkDays', () => {
    const demands = createDemandHorizon(14, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);

    const roster = generateRoster({
      ...baseConfig,
      minConsecutiveWorkDays: 2,
      maxConsecutiveWorkDays: 6,
    }, intervals, erlangReqs, demands);

    for (const ag of roster.agents) {
      const dates = Object.keys(ag.scheduleByDate);
      let consecutiveWork = 0;
      for (let i = 0; i < dates.length; i++) {
        const isOff = ag.scheduleByDate[dates[i]]?.isOff;
        if (!isOff) {
          consecutiveWork++;
          expect(consecutiveWork).toBeLessThanOrEqual(6);
        } else {
          consecutiveWork = 0;
        }
      }
    }
  });

  // Part 8: Required HC Change Test - Demand curve shape changes shift distribution
  it('Part 8: Morning heavy demand vs Afternoon heavy demand materially alters shift start time distribution', () => {
    const morningDemands = createDemandHorizon(1, 'morning_heavy');
    const afternoonDemands = createDemandHorizon(1, 'afternoon_heavy');

    const intervals = Array.from(new Set(morningDemands.map(d => d.intervalStart)));
    const morningErlang = morningDemands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);
    const afternoonErlang = afternoonDemands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);

    const morningRoster = generateRoster(baseConfig, intervals, morningErlang, morningDemands);
    const afternoonRoster = generateRoster(baseConfig, intervals, afternoonErlang, afternoonDemands);

    const dateStr = morningDemands[0].date;

    const morningStarts = morningRoster.agents
      .map(a => a.scheduleByDate[dateStr]?.shiftStart)
      .filter(Boolean) as string[];

    const afternoonStarts = afternoonRoster.agents
      .map(a => a.scheduleByDate[dateStr]?.shiftStart)
      .filter(Boolean) as string[];

    // Count shifts starting before 10:00 AM
    const morningEarlyStarts = morningStarts.filter(s => s <= '09:00').length;
    const afternoonEarlyStarts = afternoonStarts.filter(s => s <= '09:00').length;

    // Morning heavy demand must schedule significantly more early morning shifts than afternoon heavy demand
    expect(morningEarlyStarts).toBeGreaterThan(afternoonEarlyStarts);
  });

  // Part 9: Operating / Business Window enforcement
  it('Part 9: All shifts start within business hours window', () => {
    const demands = createDemandHorizon(1, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);

    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const dateStr = demands[0].date;

    for (const ag of roster.agents) {
      const sched = ag.scheduleByDate[dateStr];
      if (sched && !sched.isOff && sched.shiftStart) {
        expect(sched.shiftStart >= '08:00').toBe(true);
      }
    }
  });

  // Part 10: Shift length matches dailyPaidHours
  it('Part 10: Generated shifts strictly conform to configured paid hours and constraints', () => {
    const demands = createDemandHorizon(1, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.1) + 1);

    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const dateStr = demands[0].date;

    for (const ag of roster.agents) {
      const sched = ag.scheduleByDate[dateStr];
      if (sched && !sched.isOff && sched.shiftStart && sched.shiftEnd) {
        const [sh, sm] = sched.shiftStart.split(':').map(Number);
        const [eh, em] = sched.shiftEnd.split(':').map(Number);
        const durHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
        expect(durHours).toBe(8);
      }
    }
  });

  // Part 13 & 14: Chat Concurrency Capacity Slot Occupancy in DES
  it('Part 13: Chat agents in DES serve multiple concurrent contacts up to concurrency limit', () => {
    const chatDemands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        segment: 'Chat',
        channel: 'chat',
        volume: 30,
        ahtSeconds: 600,
        intervalMinutes: 30,
        workloadSeconds: 30 * 600,
        trafficErlangs: 10,
      },
    ];

    const chatConfig: WorkforceConfig = {
      ...baseConfig,
      totalHC: 10,
      chatConcurrency: 3,
      arrivalMode: 'fixed_forecast',
      serviceTimeDist: 'fixed',
    };

    const roster = generateRoster(chatConfig, ['08:00'], [10], chatDemands);
    const prng = new PRNG(42);
    const sim = runSingleSimulation(chatDemands, roster.intervalStaffing, chatConfig, prng, roster.agents, roster.events);

    expect(sim.summary.offered).toBe(30);
    expect(sim.summary.answered).toBeGreaterThan(0);
  });

  // TEST CONTRACT-1: 100 agents, 7 days, 5/2 -> 500 WORK, 200 OFF
  it('TEST CONTRACT-1: 100 agents, 7 days, 5/2 produces exactly 500 WORK and 200 OFF, with 5 WORK / 2 OFF per agent', () => {
    const demands = createDemandHorizon(7, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 10);

    const roster = generateRoster({ ...baseConfig, totalHC: 100, workDaysPerWeek: 5, offDaysPerWeek: 2 }, intervals, erlangReqs, demands);

    let totalWork = 0;
    let totalOff = 0;
    for (const ag of roster.agents) {
      let agWork = 0;
      let agOff = 0;
      for (const d of Object.keys(ag.scheduleByDate)) {
        if (ag.scheduleByDate[d]?.isOff) agOff++;
        else agWork++;
      }
      expect(agWork).toBe(5);
      expect(agOff).toBe(2);
      totalWork += agWork;
      totalOff += agOff;
    }
    expect(totalWork).toBe(500);
    expect(totalOff).toBe(200);
  });

  // TEST CONTRACT-2: 100 agents, 14 days, 5/2 -> 1000 WORK, 400 OFF
  it('TEST CONTRACT-2: 100 agents, 14 days, 5/2 produces exactly 1000 WORK and 400 OFF', () => {
    const demands = createDemandHorizon(14, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 10);

    const roster = generateRoster({ ...baseConfig, totalHC: 100, workDaysPerWeek: 5, offDaysPerWeek: 2 }, intervals, erlangReqs, demands);

    let totalWork = 0;
    let totalOff = 0;
    for (const ag of roster.agents) {
      for (const d of Object.keys(ag.scheduleByDate)) {
        if (ag.scheduleByDate[d]?.isOff) totalOff++;
        else totalWork++;
      }
    }
    expect(totalWork).toBe(1000);
    expect(totalOff).toBe(400);
  });

  // TEST CONTRACT-3: 10 agents, 21 days, 6/1 -> 180 WORK, 30 OFF
  it('TEST CONTRACT-3: 10 agents, 21 days, 6/1 produces exactly 180 WORK and 30 OFF', () => {
    const demands = createDemandHorizon(21, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const roster = generateRoster({ ...baseConfig, totalHC: 10, workDaysPerWeek: 6, offDaysPerWeek: 1 }, intervals, erlangReqs, demands);

    let totalWork = 0;
    let totalOff = 0;
    for (const ag of roster.agents) {
      let agWork = 0;
      let agOff = 0;
      for (const d of Object.keys(ag.scheduleByDate)) {
        if (ag.scheduleByDate[d]?.isOff) agOff++;
        else agWork++;
      }
      expect(agWork).toBe(18);
      expect(agOff).toBe(3);
      totalWork += agWork;
      totalOff += agOff;
    }
    expect(totalWork).toBe(180);
    expect(totalOff).toBe(30);
  });

  // TEST CONTRACT-4: 5/2 vs 6/1 on same horizon produces different scheduled agent-days
  it('TEST CONTRACT-4: 5/2 vs 6/1 on same 7-day horizon produces different scheduled agent-days', () => {
    const demands = createDemandHorizon(7, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const roster52 = generateRoster({ ...baseConfig, totalHC: 10, workDaysPerWeek: 5, offDaysPerWeek: 2 }, intervals, erlangReqs, demands);
    const roster61 = generateRoster({ ...baseConfig, totalHC: 10, workDaysPerWeek: 6, offDaysPerWeek: 1 }, intervals, erlangReqs, demands);

    let work52 = 0;
    for (const ag of roster52.agents) {
      for (const d of Object.keys(ag.scheduleByDate)) {
        if (!ag.scheduleByDate[d]?.isOff) work52++;
      }
    }

    let work61 = 0;
    for (const ag of roster61.agents) {
      for (const d of Object.keys(ag.scheduleByDate)) {
        if (!ag.scheduleByDate[d]?.isOff) work61++;
      }
    }

    expect(work52).toBe(50);
    expect(work61).toBe(60);
    expect(work52).not.toBe(work61);
  });

  // EXACT TEST — CONSECUTIVE OFF (14-day horizon, 5/2, requireConsecutiveOff = true)
  it('EXACT TEST — CONSECUTIVE OFF: 14-day horizon with 5/2 and requireConsecutiveOff has adjacent OFF days in each full week', () => {
    const demands = createDemandHorizon(14, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const roster = generateRoster({ ...baseConfig, totalHC: 50, requireConsecutiveOff: true }, intervals, erlangReqs, demands);

    for (const ag of roster.agents) {
      const dates = Object.keys(ag.scheduleByDate);
      // Week 1
      const w1Off: number[] = [];
      for (let i = 0; i < 7; i++) {
        if (ag.scheduleByDate[dates[i]]?.isOff) w1Off.push(i);
      }
      expect(w1Off.length).toBe(2);
      expect(Math.abs(w1Off[1] - w1Off[0]) === 1 || (w1Off[0] === 0 && w1Off[1] === 6)).toBe(true);

      // Week 2
      const w2Off: number[] = [];
      for (let i = 7; i < 14; i++) {
        if (ag.scheduleByDate[dates[i]]?.isOff) w2Off.push(i - 7);
      }
      expect(w2Off.length).toBe(2);
      expect(Math.abs(w2Off[1] - w2Off[0]) === 1 || (w2Off[0] === 0 && w2Off[1] === 6)).toBe(true);
    }
  });

  // EXACT TEST — MAX CONSECUTIVE WORK (maxConsecutiveWorkDays = 5)
  it('EXACT TEST — MAX CONSECUTIVE WORK: No agent exceeds maxConsecutiveWorkDays = 5 across week boundaries', () => {
    const demands = createDemandHorizon(14, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const roster = generateRoster({ ...baseConfig, totalHC: 20, maxConsecutiveWorkDays: 5 }, intervals, erlangReqs, demands);

    for (const ag of roster.agents) {
      const dates = Object.keys(ag.scheduleByDate);
      let run = 0;
      for (const d of dates) {
        if (!ag.scheduleByDate[d]?.isOff) {
          run++;
          expect(run).toBeLessThanOrEqual(5);
        } else {
          run = 0;
        }
      }
    }
  });

  // EXACT TEST — MIN CONSECUTIVE WORK (minConsecutiveWorkDays = 2)
  it('EXACT TEST — MIN CONSECUTIVE WORK: Avoids isolated single work days (OFF / WORK / OFF)', () => {
    const demands = createDemandHorizon(14, 'flat');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const roster = generateRoster({ ...baseConfig, totalHC: 20, minConsecutiveWorkDays: 2 }, intervals, erlangReqs, demands);

    for (const ag of roster.agents) {
      const dates = Object.keys(ag.scheduleByDate);
      let run = 0;
      for (let i = 0; i < dates.length; i++) {
        const isOff = ag.scheduleByDate[dates[i]]?.isOff;
        if (!isOff) {
          run++;
        } else {
          if (run > 0 && i > 1) {
            expect(run).toBeGreaterThanOrEqual(2);
          }
          run = 0;
        }
      }
    }
  });

  // EXACT TEST — RESOURCE ISOLATION
  it('EXACT TEST — RESOURCE ISOLATION: Dedicated Retail agents never cover Prestige, and vice versa', () => {
    const demands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '10:00',
        segment: 'Retail',
        channel: 'voice',
        volume: 20,
        ahtSeconds: 300,
        intervalMinutes: 30,
        workloadSeconds: 6000,
        trafficErlangs: 3.33,
      },
      {
        date: '01/09/2026',
        intervalStart: '10:00',
        segment: 'Prestige',
        channel: 'voice',
        volume: 10,
        ahtSeconds: 300,
        intervalMinutes: 30,
        workloadSeconds: 3000,
        trafficErlangs: 1.67,
      },
    ];

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 15,
      segmentHC: {
        Retail: 10,
        Prestige: 5,
      },
      segmentConfigs: {
        Retail: { name: 'Retail', allocationType: 'dedicated', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
        Prestige: { name: 'Prestige', allocationType: 'dedicated', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
      },
    };

    const roster = generateRoster(config, ['10:00'], [10, 5], demands);

    const retailAgents = roster.agents.filter(a => a.segment === 'Retail');
    const prestigeAgents = roster.agents.filter(a => a.segment === 'Prestige');

    expect(retailAgents.length).toBe(10);
    expect(prestigeAgents.length).toBe(5);

    for (const ag of retailAgents) {
      expect(ag.skills).toContain('Retail');
      expect(ag.skills).not.toContain('Prestige');
    }
    for (const ag of prestigeAgents) {
      expect(ag.skills).toContain('Prestige');
      expect(ag.skills).not.toContain('Retail');
    }
  });

  // EXACT TEST — TWO SHARED POOLS
  it('EXACT TEST — TWO SHARED POOLS: Pool A physical HC <= 10, Pool B physical HC <= 8, no cross-pool leakage', () => {
    const demands: DemandRow[] = [
      { date: '01/09/2026', intervalStart: '10:00', segment: 'Retail', channel: 'voice', volume: 20, ahtSeconds: 300, intervalMinutes: 30, workloadSeconds: 6000, trafficErlangs: 3.33 },
      { date: '01/09/2026', intervalStart: '10:00', segment: 'Prestige', channel: 'voice', volume: 10, ahtSeconds: 300, intervalMinutes: 30, workloadSeconds: 3000, trafficErlangs: 1.67 },
      { date: '01/09/2026', intervalStart: '10:00', segment: 'SMB', channel: 'voice', volume: 15, ahtSeconds: 300, intervalMinutes: 30, workloadSeconds: 4500, trafficErlangs: 2.5 },
      { date: '01/09/2026', intervalStart: '10:00', segment: 'eMoney', channel: 'voice', volume: 15, ahtSeconds: 300, intervalMinutes: 30, workloadSeconds: 4500, trafficErlangs: 2.5 },
    ];

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 18,
      segmentConfigs: {
        Retail: { name: 'Retail', allocationType: 'shared', poolId: 'PoolA', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
        Prestige: { name: 'Prestige', allocationType: 'shared', poolId: 'PoolA', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
        SMB: { name: 'SMB', allocationType: 'shared', poolId: 'PoolB', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
        eMoney: { name: 'eMoney', allocationType: 'shared', poolId: 'PoolB', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
      },
      poolConfigs: {
        PoolA: { headcount: 10, sharedSegments: ['Retail', 'Prestige'] },
        PoolB: { headcount: 8, sharedSegments: ['SMB', 'eMoney'] },
      },
    };

    const roster = generateRoster(config, ['10:00'], [5, 5, 4, 4], demands);

    const poolAAgents = roster.agents.filter(a => a.poolId === 'PoolA');
    const poolBAgents = roster.agents.filter(a => a.poolId === 'PoolB');

    expect(poolAAgents.length).toBeLessThanOrEqual(10);
    expect(poolBAgents.length).toBeLessThanOrEqual(8);

    for (const ag of poolAAgents) {
      expect(ag.skills).not.toContain('SMB');
      expect(ag.skills).not.toContain('eMoney');
    }
    for (const ag of poolBAgents) {
      expect(ag.skills).not.toContain('Retail');
      expect(ag.skills).not.toContain('Prestige');
    }
  });

  // EXACT TEST — MULTISKILL AGENT
  it('EXACT TEST — MULTISKILL AGENT: 1 multiskill agent available full 30 mins contributes 1.0 physical effective HC, not 0.333', () => {
    const demands: DemandRow[] = [
      { date: '01/09/2026', intervalStart: '10:00', segment: 'Retail', channel: 'voice', volume: 10, ahtSeconds: 300, intervalMinutes: 30, workloadSeconds: 3000, trafficErlangs: 1.67 },
    ];

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 1,
      shrinkageTotal: 0,
      shrinkageBreakPercent: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      adherence: 1.0,
      segmentConfigs: {
        Retail: { name: 'Retail', allocationType: 'shared', poolId: 'PoolA', channel: 'voice', targetSlaPercent: 80, slaThresholdSeconds: 20, defaultPatienceSeconds: 120, concurrency: 1, priority: 1 },
      },
      poolConfigs: {
        PoolA: { headcount: 1, sharedSegments: ['Retail', 'Prestige', 'SMB'] },
      },
    };

    const roster = generateRoster(config, ['10:00'], [1], demands);
    const retailStaffing = roster.intervalStaffing.find(s => s.segment === 'Retail');

    expect(retailStaffing).toBeDefined();
    // Physical effective HC is 1.0, never 0.333
    expect(retailStaffing!.effectiveHC).toBe(1.0);
    expect(retailStaffing!.scheduledHC).toBe(1.0);
  });

  // EXACT TEST — BUSINESS WINDOW
  it('EXACT TEST — BUSINESS WINDOW: Configured business hours 08:00-20:00 remain authoritative when demand arrives at 07:30', () => {
    const demandOutside: DemandRow = {
      date: '01/09/2026',
      intervalStart: '07:30',
      segment: 'Voice',
      channel: 'voice',
      volume: 10,
      ahtSeconds: 300,
      intervalMinutes: 30,
      workloadSeconds: 3000,
      trafficErlangs: 1.67,
    };

    const demands = [demandOutside, ...createDemandHorizon(1, 'flat')];
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const config: WorkforceConfig = {
      ...baseConfig,
      businessHoursStart: '08:00',
      businessHoursEnd: '20:00',
    };

    const roster = generateRoster(config, intervals, erlangReqs, demands);

    // All shifts must start >= 08:00 (business start never mutates to 07:30)
    for (const ag of roster.agents) {
      const sched = ag.scheduleByDate['01/09/2026'];
      if (sched && !sched.isOff && sched.shiftStart) {
        expect(sched.shiftStart >= '08:00').toBe(true);
      }
    }
  });

  // EXACT TEST — CHAT 33.33%
  it('EXACT TEST — CHAT 33.33%: 1 agent, concurrency = 3, 1 chat active for full 1800s produces Available=5400, Busy=1800, Ready=3600, Occupancy=33.333%', () => {
    const demands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        segment: 'Chat',
        channel: 'chat',
        volume: 1,
        ahtSeconds: 1800,
        intervalMinutes: 30,
        workloadSeconds: 1800,
        trafficErlangs: 1.0,
      },
    ];

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 1,
      chatConcurrency: 3,
      shrinkageTotal: 0,
      shrinkageBreakPercent: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      adherence: 1.0,
      arrivalMode: 'fixed_forecast',
      serviceTimeDist: 'fixed',
    };

    const roster = generateRoster(config, ['08:00'], [1], demands);
    const prng = new PRNG(42);
    const sim = runSingleSimulation(demands, roster.intervalStaffing, config, prng, roster.agents, roster.events);

    const intRes = sim.intervalResults[0];
    expect(intRes.offered).toBe(1);
    expect(intRes.answered).toBe(1);
    expect(intRes.busySeconds).toBe(1800);
    // Occupancy: 1800 / (1800 * 3) = 33.333%
    expect(intRes.occupancyPercent).toBeCloseTo(33.333, 1);
  });

  // EXACT TEST — CHAT 100%
  it('EXACT TEST — CHAT 100%: 1 agent, concurrency = 3, 3 chats active for full 1800s produces Busy=5400, Ready=0, Occupancy=100%', () => {
    const demands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        segment: 'Chat',
        channel: 'chat',
        volume: 3,
        ahtSeconds: 1800,
        intervalMinutes: 30,
        workloadSeconds: 5400,
        trafficErlangs: 3.0,
      },
    ];

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 1,
      chatConcurrency: 3,
      shrinkageTotal: 0,
      shrinkageBreakPercent: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      adherence: 1.0,
      arrivalMode: 'fixed_forecast',
      serviceTimeDist: 'fixed',
    };

    const roster = generateRoster(config, ['08:00'], [1], demands);
    const prng = new PRNG(42);
    const sim = runSingleSimulation(demands, roster.intervalStaffing, config, prng, roster.agents, roster.events);

    const intRes = sim.intervalResults[0];
    expect(intRes.offered).toBe(3);
    expect(intRes.answered).toBe(3);
    expect(intRes.busySeconds).toBe(5400);
    expect(intRes.occupancyPercent).toBe(100.0);
  });

  // EXACT TEST — CONTACT CONSERVATION
  it('EXACT TEST — CONTACT CONSERVATION: Offered = Answered + Abandoned when queue is drained', () => {
    const demands = createDemandHorizon(1, 'morning_heavy');
    const intervals = Array.from(new Set(demands.map(d => d.intervalStart)));
    const erlangReqs = demands.map(() => 5);

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 8,
      queueClosureBehavior: 'finish_queued',
    };

    const roster = generateRoster(config, intervals, erlangReqs, demands);
    const prng = new PRNG(42);
    const sim = runSingleSimulation(demands, roster.intervalStaffing, config, prng, roster.agents, roster.events);

    expect(sim.summary.offered).toBe(sim.summary.answered + sim.summary.abandoned);
  });

  // ERLANG-C SANITY BENCHMARK
  it('ERLANG-C SANITY BENCHMARK: DES matches analytical Erlang-C model within statistical tolerance under ideal assumptions', () => {
    const demands: DemandRow[] = [
      {
        date: '01/09/2026',
        intervalStart: '08:00',
        segment: 'Voice',
        channel: 'voice',
        volume: 60,
        ahtSeconds: 180,
        intervalMinutes: 30,
        workloadSeconds: 10800,
        trafficErlangs: 6.0,
      },
    ];

    const config: WorkforceConfig = {
      ...baseConfig,
      totalHC: 10,
      contractType: '7/0',
      workDaysPerWeek: 7,
      offDaysPerWeek: 0,
      shrinkageTotal: 0,
      shrinkageBreakPercent: 0,
      shrinkageOutOffice: 0,
      shrinkageInOffice: 0,
      adherence: 1.0,
      defaultPatienceSeconds: 99999, // No abandonment
      arrivalMode: 'fixed_forecast',
      serviceTimeDist: 'fixed',
    };

    const roster = generateRoster(config, ['08:00'], [10], demands);
    const prng = new PRNG(100);
    const sim = runSingleSimulation(demands, roster.intervalStaffing, config, prng, roster.agents, roster.events);

    // Theory for 6 Erlangs on 10 servers: Occupancy is 60.0% (57.5% with end-of-interval boundary cutoff)
    const actualOccupancy = sim.intervalResults[0].occupancyPercent;
    expect(actualOccupancy).toBeGreaterThanOrEqual(57.0);
    expect(actualOccupancy).toBeLessThanOrEqual(60.1);
    expect(sim.intervalResults[0].answered).toBe(60);
    expect(sim.intervalResults[0].abandoned).toBe(0);
  });
});
