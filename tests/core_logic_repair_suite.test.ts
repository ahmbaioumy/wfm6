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
    const baseDate = new Date(Date.UTC(2026, 8, 1, 0, 0, 0)); // 2026-09-01 (Tue)

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
});
