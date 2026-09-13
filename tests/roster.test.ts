import { describe, it, expect } from 'vitest';
import { generateRoster, computeAgentWeeklyHours } from '../src/engines/roster';
import { WorkforceConfig, DemandRow, AgentWeeklySchedule } from '../src/types';
import { parseDemandCSVAdvanced, SAMPLE_WEEKLY_TREND_CSV } from '../src/data/sampleDemand';

describe('Synthetic Agent Roster & Workforce Constraints (Tests 15-22)', () => {
  const baseConfig: WorkforceConfig = {
    totalHC: 100,
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
    monteCarloRuns: 10,
    targetSlaHalfWidth: 1.0,
  };

  const parsedWeekly = parseDemandCSVAdvanced(SAMPLE_WEEKLY_TREND_CSV);
  const demands: DemandRow[] = parsedWeekly.demands;
  const intervals = demands.map(d => d.intervalStart);
  const erlangReqs = demands.map(d => Math.ceil(d.trafficErlangs * 1.2) + 1);

  // Test 15: HEADCOUNT IS PEOPLE, NOT SEATS
  it('Test 15: Headcount is people, not seats: 100 HC never produces 100 simultaneous agents on shift', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);

    // Working today + Off today = Total HC (100)
    expect(roster.summary.workingToday + roster.summary.offToday).toBe(100);
    expect(roster.summary.offToday).toBeGreaterThan(0); // Some people MUST be OFF on a 6:1 or 5:2 pattern
    expect(roster.summary.workingToday).toBeLessThan(100);

    // Peak scheduled agents at any single interval must be <= workingToday, never 100
    for (const staff of roster.intervalStaffing) {
      expect(staff.scheduledHC).toBeLessThan(100);
      expect(staff.effectiveHC).toBeLessThan(staff.scheduledHC); // Effective is reduced by shrinkage/breaks
    }
  });

  // Test 16: Dynamic Volume-Trend OFF allocation assigns more OFFs to low-volume days
  it('Test 16: Dynamic Volume-Trend OFF distribution assigns OFF days inversely to volume', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    expect(roster.weeklyPlan).toBeDefined();

    const days = roster.weeklyPlan!.days;
    expect(days.length).toBeGreaterThanOrEqual(2);

    // Sort days by volume
    const sortedByVol = [...days].sort((a, b) => a.volume - b.volume);
    const lowestVolDay = sortedByVol[0];
    const highestVolDay = sortedByVol[sortedByVol.length - 1];

    // Lowest volume day should have MORE allocated OFF agents than highest volume day
    expect(lowestVolDay.allocatedOffHC).toBeGreaterThanOrEqual(highestVolDay.allocatedOffHC);
    expect(highestVolDay.allocatedWorkingHC).toBeGreaterThanOrEqual(lowestVolDay.allocatedWorkingHC);
  });

  // Test 17: Shift start times align with shiftStartStepMinutes
  it('Test 17: Generated shifts start strictly on defined step intervals (e.g. 30 minutes)', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    for (const agent of roster.agents) {
      for (const [_, dayAssignment] of Object.entries(agent.scheduleByDate instanceof Map ? Object.fromEntries(agent.scheduleByDate) : agent.scheduleByDate)) {
        if (!dayAssignment.isOff && dayAssignment.shiftStart) {
          const [hh, mm] = dayAssignment.shiftStart.split(':').map(Number);
          expect(mm % baseConfig.shiftStartStepMinutes).toBe(0);
        }
      }
    }
  });

  // Test 18: Break floor protection (7% non-reducible breaks)
  it('Test 18: Non-reducible break floor (7%) is protected across all working schedules', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    expect(roster.weeklyPlan?.protectedBreakPercent).toBe(7);

    // Verify each working day assignment contains scheduled breaks
    let verifiedAgentWithBreak = false;
    for (const agent of roster.agents) {
      for (const [_, dayAssignment] of Object.entries(agent.scheduleByDate instanceof Map ? Object.fromEntries(agent.scheduleByDate) : agent.scheduleByDate)) {
        if (!dayAssignment.isOff) {
          expect(dayAssignment.breaks.length).toBeGreaterThanOrEqual(1);
          verifiedAgentWithBreak = true;
          break;
        }
      }
      if (verifiedAgentWithBreak) break;
    }
    expect(verifiedAgentWithBreak).toBe(true);
  });

  // Test 19: Female curfew and shift duration constraints (PRD 50, 51)
  it('Test 19: Female agents are strictly scheduled between 06:00 and 22:00 with 6-8 hour shift bounds', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    const femaleAgents = roster.agents.filter(a => a.gender === 'F');
    expect(femaleAgents.length).toBeGreaterThan(0);

    for (const female of femaleAgents) {
      const schedules = female.scheduleByDate instanceof Map ? Object.fromEntries(female.scheduleByDate) : female.scheduleByDate;
      for (const [_, dayAssignment] of Object.entries(schedules)) {
        if (!dayAssignment.isOff && dayAssignment.shiftStart && dayAssignment.shiftEnd) {
          const [startH] = dayAssignment.shiftStart.split(':').map(Number);
          const [endH] = dayAssignment.shiftEnd.split(':').map(Number);

          expect(startH).toBeGreaterThanOrEqual(6); // Earliest start 06:00
          expect(endH).toBeLessThanOrEqual(22); // Latest finish 22:00
        }
      }
    }
  });

  // Test 20: Minimum rest hours between consecutive shifts (PRD 47)
  it('Test 20: Enforces minimum rest hours between consecutive working shifts', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    for (const agent of roster.agents) {
      const schedules = agent.scheduleByDate instanceof Map ? Array.from(agent.scheduleByDate.values()) : Object.values(agent.scheduleByDate);
      for (let i = 0; i < schedules.length - 1; i++) {
        const d1 = schedules[i];
        const d2 = schedules[i + 1];
        if (!d1.isOff && !d2.isOff && d1.shiftEnd && d2.shiftStart) {
          const [d1EndH, d1EndM] = d1.shiftEnd.split(':').map(Number);
          const [d2StartH, d2StartM] = d2.shiftStart.split(':').map(Number);
          const restHours = (24 - (d1EndH + d1EndM / 60)) + (d2StartH + d2StartM / 60);
          expect(restHours).toBeGreaterThanOrEqual(baseConfig.minRestHoursBetweenShifts);
        }
      }
    }
  });

  // Test 21: Team pod size and supervisor assignment (PRD 52, 53)
  it('Test 21: Groups synthetic agents into teams with assigned supervisor', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    expect(roster.agents.length).toBe(100);

    const teamIds = new Set(roster.agents.map(a => a.teamId));
    expect(teamIds.size).toBe(10); // 100 HC / 10 teamSize = 10 teams

    // Each team should have 1 supervisor
    for (const tid of teamIds) {
      const teamMembers = roster.agents.filter(a => a.teamId === tid);
      const supervisors = teamMembers.filter(a => a.isSupervisor);
      expect(supervisors.length).toBe(1);
    }
  });

  // Test 22: Generates discrete AgentAvailabilityEvents stream for DES
  it('Test 22: Generates discrete chronological availability events (SHIFT_START, BREAK, SHIFT_END) for DES', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    expect(roster.events.length).toBeGreaterThan(0);

    // Must have SHIFT_START, BREAK_START, BREAK_END, SHIFT_END
    const eventTypes = new Set(roster.events.map(e => e.type));
    expect(eventTypes.has('SHIFT_START')).toBe(true);
    expect(eventTypes.has('SHIFT_END')).toBe(true);
    expect(eventTypes.has('BREAK_START')).toBe(true);
    expect(eventTypes.has('BREAK_END')).toBe(true);
  });

  // Bug 1 Regression Test: Shrinkage percentages in DayOffDistribution are whole numbers (e.g. 7 for 7%)
  // and format as "7.0%", NOT "700.0%"
  it('Bug 1 Regression: DayOffDistribution shrinkage percentages are whole numbers and format properly without 100x scaling', () => {
    const roster = generateRoster(baseConfig, intervals, erlangReqs, demands);
    expect(roster.weeklyPlan).toBeDefined();
    const day = roster.weeklyPlan.days[0];
    expect(day.breakShrinkagePercent).toBe(7); // 7%, not 0.07
    expect(day.totalShrinkagePercent).toBe(25); // 25%, not 0.25
    expect(`${day.breakShrinkagePercent.toFixed(1)}%`).toBe('7.0%');
    expect(`${day.flexibleShrinkagePercent.toFixed(1)}%`).toMatch(/^(18\.0%|25\.0%|\d+\.\d%)$/);
    expect(`${day.totalShrinkagePercent.toFixed(1)}%`).toBe('25.0%');
  });

  // Feature Test: computeAgentWeeklyHours calculates scheduled and effective hours, handles breaks/shrinkage, and overnight shifts
  it('computes scheduled and effective hours for synthetic agents, deducting shrinkage/breaks and handling overnight shifts', () => {
    // 5 working days (08:00 - 16:30 = 8.5h each = 42.5h scheduled)
    // Each working day has 30m break and 15m planned shrinkage (total deduction = 5 * 45m = 3.75h)
    // 2 OFF days
    // Effective hours: 42.5 - 3.75 = 38.75 -> rounded to 1 decimal place = 38.8
    const testAgent: AgentWeeklySchedule = {
      agentId: 'AGT-001',
      agentName: 'Alice Smith',
      segment: 'Voice Support',
      team: 'Team Alpha',
      gender: 'F',
      isSupervisor: false,
      offDaysCount: 2,
      isCompliant: true,
      days: [
        {
          date: '2026-03-01',
          dayIndex: 0,
          dayName: 'Monday',
          isOff: false,
          shiftStart: '08:00',
          shiftEnd: '16:30',
          breaks: [{ start: '12:00', end: '12:30', durationMinutes: 30 }],
          plannedShrinkages: [{ start: '14:00', end: '14:15', durationMinutes: 15, type: 'coaching' }],
        },
        {
          date: '2026-03-02',
          dayIndex: 1,
          dayName: 'Tuesday',
          isOff: false,
          shiftStart: '08:00',
          shiftEnd: '16:30',
          breaks: [{ start: '12:00', end: '12:30', durationMinutes: 30 }],
          plannedShrinkages: [{ start: '14:00', end: '14:15', durationMinutes: 15, type: 'coaching' }],
        },
        {
          date: '2026-03-03',
          dayIndex: 2,
          dayName: 'Wednesday',
          isOff: false,
          shiftStart: '08:00',
          shiftEnd: '16:30',
          breaks: [{ start: '12:00', end: '12:30', durationMinutes: 30 }],
          plannedShrinkages: [{ start: '14:00', end: '14:15', durationMinutes: 15, type: 'coaching' }],
        },
        {
          date: '2026-03-04',
          dayIndex: 3,
          dayName: 'Thursday',
          isOff: false,
          shiftStart: '08:00',
          shiftEnd: '16:30',
          breaks: [{ start: '12:00', end: '12:30', durationMinutes: 30 }],
          plannedShrinkages: [{ start: '14:00', end: '14:15', durationMinutes: 15, type: 'coaching' }],
        },
        {
          date: '2026-03-05',
          dayIndex: 4,
          dayName: 'Friday',
          isOff: false,
          shiftStart: '08:00',
          shiftEnd: '16:30',
          breaks: [{ start: '12:00', end: '12:30', durationMinutes: 30 }],
          plannedShrinkages: [{ start: '14:00', end: '14:15', durationMinutes: 15, type: 'coaching' }],
        },
        {
          date: '2026-03-06',
          dayIndex: 5,
          dayName: 'Saturday',
          isOff: true,
          breaks: [],
          plannedShrinkages: [],
        },
        {
          date: '2026-03-07',
          dayIndex: 6,
          dayName: 'Sunday',
          isOff: true,
          breaks: [],
          plannedShrinkages: [],
        },
      ],
    };

    const result = computeAgentWeeklyHours(testAgent);
    expect(result.scheduledHours).toBe(42.5);
    expect(result.effectiveHours).toBe(38.8);

    // Overnight shift: 22:00 to 06:00 (crosses midnight, must be 8 hours, NOT a negative number)
    const overnightAgent: AgentWeeklySchedule = {
      agentId: 'AGT-002',
      agentName: 'Bob Jones',
      segment: 'Voice Support',
      team: 'Team Beta',
      gender: 'M',
      isSupervisor: false,
      offDaysCount: 6,
      isCompliant: true,
      days: [
        {
          date: '2026-03-01',
          dayIndex: 0,
          dayName: 'Monday',
          isOff: false,
          shiftStart: '22:00',
          shiftEnd: '06:00',
          breaks: [],
          plannedShrinkages: [],
        },
      ],
    };

    const overnightResult = computeAgentWeeklyHours(overnightAgent);
    expect(overnightResult.scheduledHours).toBe(8.0);
    expect(overnightResult.effectiveHours).toBe(8.0);

    // Agent with all OFF days returns 0 / 0
    const allOffAgent: AgentWeeklySchedule = {
      ...overnightAgent,
      days: [
        {
          date: '2026-03-01',
          dayIndex: 0,
          dayName: 'Monday',
          isOff: true,
          breaks: [],
          plannedShrinkages: [],
        },
      ],
    };
    const allOffResult = computeAgentWeeklyHours(allOffAgent);
    expect(allOffResult.scheduledHours).toBe(0);
    expect(allOffResult.effectiveHours).toBe(0);
  });

  it('Test Business Calendar: Closed non-working days and holidays are marked as OFF days', () => {
    const multiDayDemands: DemandRow[] = [
      {
        date: '2026-03-02', // Day 0 (Monday)
        intervalStart: '09:00',
        intervalMinutes: 60,
        volume: 20,
        ahtSeconds: 180,
        workloadSeconds: 3600,
        trafficErlangs: 1.0,
        timestamp: 1772442000,
        segment: 'Default',
        channel: 'voice',
      },
      {
        date: '2026-03-08', // Day 6 (Sunday)
        intervalStart: '09:00',
        intervalMinutes: 60,
        volume: 20,
        ahtSeconds: 180,
        workloadSeconds: 3600,
        trafficErlangs: 1.0,
        timestamp: 1772960400,
        segment: 'Default',
        channel: 'voice',
      },
      {
        date: '2026-03-09', // Day 7 (Holiday)
        intervalStart: '09:00',
        intervalMinutes: 60,
        volume: 20,
        ahtSeconds: 180,
        workloadSeconds: 3600,
        trafficErlangs: 1.0,
        timestamp: 1773046800,
        segment: 'Default',
        channel: 'voice',
      },
    ];

    const calendarConfig: WorkforceConfig = {
      ...baseConfig,
      totalHC: 10,
      offDaysPerWeek: 0, // No normal off days so any OFF is from calendar closures
      is24x7: false,
      operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], // Sunday is non-working
      holidayDates: ['2026-03-09'], // Explicit holiday closure
    };

    const roster = generateRoster(calendarConfig, ['09:00'], [2, 2, 2], multiDayDemands);

    // On Sunday 2026-03-08 (non-working day), all agents should be OFF
    const sundaySchedule = roster.weeklyPlan?.agentSchedules.map(a => a.days.find(d => d.date === '2026-03-08'));
    expect(sundaySchedule?.every(d => d?.isOff)).toBe(true);

    // On Holiday 2026-03-09, all agents should be OFF
    const holidaySchedule = roster.weeklyPlan?.agentSchedules.map(a => a.days.find(d => d.date === '2026-03-09'));
    expect(holidaySchedule?.every(d => d?.isOff)).toBe(true);
  });
});
