/**
 * Workforce Roster & Scheduling Engine
 * Core Principle: HEADCOUNT IS PEOPLE, NOT SEATS.
 * Generates synthetic agents with individual work/off patterns, shift windows,
 * break windows, shrinkage windows, team structures, and gender curfew constraints.
 */

import {
  WorkforceConfig,
  SyntheticAgent,
  AgentDayAssignment,
  AgentAvailabilityEvent,
  BreakWindow,
  ShrinkageWindow,
  IntervalStaffing,
  WeeklyRosterPlan,
  DayOffDistribution,
  AgentWeeklySchedule,
  FeasibilityIssue,
  DemandRow,
  RosterValidationResult,
} from '../types';
import { parseDateTimeToEpochSeconds } from '../data/sampleDemand';
import { PRNG } from './des';
import { solveRequiredStaffing } from './erlang';
import {
  parseDateComponents,
  isDateBusinessOperatingDay,
  isDateHoliday,
  timeStringToMinutes,
  minutesToTimeString,
  sortDatesChronologically,
} from './dateUtils';

export interface GeneratedRoster {
  agents: SyntheticAgent[];
  events: AgentAvailabilityEvent[];
  intervalStaffing: IntervalStaffing[];
  weeklyPlan: WeeklyRosterPlan;
  validationResult?: RosterValidationResult;
  summary: {
    totalHC: number;
    workingToday: number;
    offToday: number;
    femaleCount: number;
    maleCount: number;
    teamCount: number;
  };
}

/**
 * Converts "HH:MM" string to minutes from midnight
 */
export function timeToMinutes(t: string): number {
  return timeStringToMinutes(t);
}

/**
 * Converts minutes from midnight to "HH:MM"
 */
export function minutesToTime(m: number): string {
  return minutesToTimeString(m);
}

export function formatTime(m: number): string {
  return minutesToTimeString(m);
}

// ============================================================================
// PART 1 & 3: REQUIRED CORE FUNCTIONS
// ============================================================================

/**
 * Function 3: buildRequiredCoverageCurve
 * Builds Date × Interval requirement curve and daily pressure map from demands and Erlang solver.
 */
export function buildRequiredCoverageCurve(
  demands: DemandRow[],
  config: WorkforceConfig
): {
  requiredCurve: Map<string, number>;
  dailyPressureMap: Map<string, number>;
  intervalDetailsMap: Map<string, { volume: number; aht: number; trafficErlangs: number; requiredHC: number }>;
} {
  const requiredCurve = new Map<string, number>();
  const dailyPressureMap = new Map<string, number>();
  const intervalDetailsMap = new Map<string, { volume: number; aht: number; trafficErlangs: number; requiredHC: number }>();

  for (const d of demands) {
    const key = `${d.date}__${d.intervalStart}`;
    const requiredHC = solveRequiredStaffing(
      d.trafficErlangs,
      d.ahtSeconds,
      config.slaPercentTarget / 100,
      config.slaThresholdSeconds,
      config.maxOccupancyThreshold / 100,
      config.minCoverage,
      config.erlangModel,
      config.defaultPatienceSeconds
    );

    const current = requiredCurve.get(key) || 0;
    requiredCurve.set(key, current + requiredHC);

    const date = d.date;
    const currentPressure = dailyPressureMap.get(date) || 0;
    dailyPressureMap.set(date, currentPressure + requiredHC);

    intervalDetailsMap.set(key, {
      volume: d.volume,
      aht: d.ahtSeconds,
      trafficErlangs: d.trafficErlangs,
      requiredHC,
    });
  }

  return { requiredCurve, dailyPressureMap, intervalDetailsMap };
}

/**
 * Function 4: generateCandidateShifts
 * Generates valid candidate shift starts strictly within operating window and labor constraints.
 */
export function generateCandidateShifts(
  config: WorkforceConfig,
  operatingWindow: { startMin: number; endMin: number },
  shiftDurationMins: number,
  shiftStepMins: number = 30,
  isFemale: boolean = false
): number[] {
  const candidateStarts: number[] = [];
  const step = shiftStepMins === 60 ? 60 : (shiftStepMins === 15 ? 15 : 30);

  if (config.is24x7) {
    for (let m = 0; m < 1440; m += step) {
      candidateStarts.push(m);
    }
    return candidateStarts;
  }

  const bStart = timeToMinutes(config.businessHoursStart || '08:00');
  const bEnd = timeToMinutes(config.businessHoursEnd || '20:00');

  let windowStart = Math.min(bStart, operatingWindow.startMin);
  let windowEnd = Math.max(bEnd, operatingWindow.endMin);

  let earliestStart = windowStart;
  let latestStart = Math.max(earliestStart, windowEnd - shiftDurationMins);

  if (isFemale && config.femaleConstraintStrict) {
    const femaleEarliest = timeToMinutes(config.femaleEarliestStart || '06:00');
    const femaleLatest = timeToMinutes(config.femaleLatestFinish || '22:00') - shiftDurationMins;
    earliestStart = Math.max(earliestStart, femaleEarliest);
    latestStart = Math.min(latestStart, femaleLatest);
  }

  if (earliestStart > latestStart) {
    return [Math.min(earliestStart, Math.max(0, 1440 - shiftDurationMins))];
  }

  for (let m = earliestStart; m <= latestStart; m += step) {
    candidateStarts.push(m);
  }

  if (candidateStarts.length === 0) {
    candidateStarts.push(earliestStart);
  }

  return candidateStarts;
}

/**
 * Technical constants for shift candidate scoring
 */
export const SHIFT_SCORING_WEIGHTS = {
  underCoverageWeight: 10.0,
  minCoverageWeight: 15.0,
  overCoverageWeight: 0.1,
  fairnessWeight: 0.5,
  officerAlignmentWeight: 3.0,
};

/**
 * Function 5: scoreCandidateShift
 * Scores a candidate shift start against residual requirement curve and minCoverage targets.
 */
export function scoreCandidateShift(
  candidateStartMin: number,
  shiftDurationMins: number,
  date: string,
  requiredCurve: Map<string, number>,
  currentScheduledCurve: Map<string, number>,
  config: WorkforceConfig,
  intervalMins: number = 30,
  weights = SHIFT_SCORING_WEIGHTS
): number {
  let underCoverageReduction = 0;
  let minCoverageDeficitReduction = 0;
  let proportionalReward = 0;

  const candidateEndMin = candidateStartMin + shiftDurationMins;

  for (let t = candidateStartMin; t < candidateEndMin; t += intervalMins) {
    const timeStr = minutesToTimeString(t);
    const key = `${date}__${timeStr}`;
    const req = requiredCurve.get(key) || 0;
    const current = currentScheduledCurve.get(key) || 0;

    const residual = Math.max(0, req - current);
    if (residual > 0) {
      underCoverageReduction += Math.min(1.0, residual);
    }

    const minRatio = (config.minCoverage !== undefined && config.minCoverage < 1)
      ? config.minCoverage
      : (req > 0 && config.minCoverage !== undefined ? Math.min(1.0, config.minCoverage / req) : 1.0);
    const minTarget = req * minRatio;

    if (current < minTarget) {
      minCoverageDeficitReduction += Math.min(1.0, minTarget - current);
    }

    if (req > 0) {
      proportionalReward += req / (current + 1);
    }
  }

  const score =
    underCoverageReduction * weights.underCoverageWeight +
    minCoverageDeficitReduction * weights.minCoverageWeight +
    proportionalReward * weights.fairnessWeight;

  return score;
}

/**
 * Function 6: assignCoverageOptimizedShifts
 * Assigns shifts to working agents based on residual demand curves and team officer rules.
 */
export function assignCoverageOptimizedShifts(
  workingAgents: SyntheticAgent[],
  date: string,
  requiredCurve: Map<string, number>,
  currentScheduledCurve: Map<string, number>,
  config: WorkforceConfig,
  operatingWindow: { startMin: number; endMin: number },
  intervalMins: number = 30,
  dIdx: number = 0,
  uniqueDates: string[] = []
) {
  const paidShiftHours = config.dailyPaidHours ?? 8;
  const paidShiftMins = Math.round(paidShiftHours * 60);
  const shiftStep = config.shiftStartStepMinutes ?? 30;

  const teamsMap = new Map<number, SyntheticAgent[]>();
  for (const ag of workingAgents) {
    if (!teamsMap.has(ag.teamId)) teamsMap.set(ag.teamId, []);
    teamsMap.get(ag.teamId)!.push(ag);
  }

  const breakPct = config.shrinkageBreakPercent ?? 0.07;
  const totalBreakMinutes = config.breakDurationMinutes !== undefined
    ? config.breakDurationMinutes
    : Math.round(paidShiftMins * breakPct);
  const splitB1Pos = config.splitBreak1Position ?? 0.33;
  const splitB2Pos = config.splitBreak2Position ?? 0.66;
  const inOfficePos = config.inOfficeShrinkagePreferredPosition ?? 0.75;
  const inOfficePct = config.shrinkageInOffice ?? 0;
  const inOfficeMinutes = Math.round(paidShiftMins * inOfficePct);

  for (const [, teamAgents] of teamsMap.entries()) {
    const supervisor = teamAgents.find(a => a.isSupervisor);
    const members = teamAgents.filter(a => !a.isSupervisor);

    const memberStartTimes: number[] = [];

    for (const member of members) {
      const isFemale = member.gender === 'F';
      const candidates = generateCandidateShifts(config, operatingWindow, paidShiftMins, shiftStep, isFemale);

      let bestStart = candidates[0] || timeToMinutes(config.businessHoursStart || '08:00');
      let bestScore = -Infinity;

      for (const cand of candidates) {
        let score = scoreCandidateShift(
          cand,
          paidShiftMins,
          date,
          requiredCurve,
          currentScheduledCurve,
          config,
          intervalMins
        );

        if (dIdx > 0 && uniqueDates[dIdx - 1]) {
          const prevDay = (member.scheduleByDate as Record<string, AgentDayAssignment>)[uniqueDates[dIdx - 1]];
          if (prevDay && !prevDay.isOff && prevDay.shiftEnd) {
            const prevEnd = timeToMinutes(prevDay.shiftEnd);
            const minRest = (config.minRestHoursBetweenShifts ?? 12) * 60;
            const restAvail = (1440 - prevEnd) + cand;
            if (restAvail < minRest) {
              score -= 50;
            }
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestStart = cand;
        }
      }

      for (let t = bestStart; t < bestStart + paidShiftMins; t += intervalMins) {
        const key = `${date}__${minutesToTimeString(t)}`;
        currentScheduledCurve.set(key, (currentScheduledCurve.get(key) || 0) + 1);
      }

      memberStartTimes.push(bestStart);

      const shiftEndMin = bestStart + paidShiftMins;
      const breaks: BreakWindow[] = [];
      if (totalBreakMinutes > 0) {
        if (config.splitBreaks) {
          const b1 = Math.round(totalBreakMinutes / 2);
          const b2 = totalBreakMinutes - b1;
          const s1 = bestStart + Math.floor(paidShiftMins * splitB1Pos);
          const s2 = bestStart + Math.floor(paidShiftMins * splitB2Pos);
          breaks.push(
            { start: minutesToTime(s1), end: minutesToTime(s1 + b1), durationMinutes: b1 },
            { start: minutesToTime(s2), end: minutesToTime(s2 + b2), durationMinutes: b2 }
          );
        } else {
          const frac = config.breakStartFraction ?? 0.50;
          const bStart = Math.max(bestStart + 30, Math.min(shiftEndMin - totalBreakMinutes - 30, bestStart + Math.floor(paidShiftMins * frac)));
          breaks.push({
            start: minutesToTime(bStart),
            end: minutesToTime(bStart + totalBreakMinutes),
            durationMinutes: totalBreakMinutes,
          });
        }
      }

      const plannedShrinkages: ShrinkageWindow[] = [];
      if (inOfficeMinutes > 0) {
        const shrinkStart = Math.max(bestStart + 60, Math.min(shiftEndMin - inOfficeMinutes - 15, bestStart + Math.floor(paidShiftMins * inOfficePos)));
        plannedShrinkages.push({
          start: minutesToTime(shrinkStart),
          end: minutesToTime(shrinkStart + inOfficeMinutes),
          durationMinutes: inOfficeMinutes,
          type: 'training',
        });
      }

      (member.scheduleByDate as Record<string, AgentDayAssignment>)[date] = {
        date,
        dayIndex: dIdx,
        dayName: parseDateComponents(date).dayName,
        isOff: false,
        shiftStart: minutesToTime(bestStart),
        shiftEnd: minutesToTime(shiftEndMin),
        breaks,
        plannedShrinkages,
        adherenceWindows: [],
      };
    }

    if (supervisor) {
      const isFemale = supervisor.gender === 'F';
      const candidates = generateCandidateShifts(config, operatingWindow, paidShiftMins, shiftStep, isFemale);

      let majorityStart = candidates[0] || timeToMinutes(config.businessHoursStart || '08:00');
      if (memberStartTimes.length > 0) {
        const counts = new Map<number, number>();
        for (const s of memberStartTimes) counts.set(s, (counts.get(s) || 0) + 1);
        let maxCount = 0;
        for (const [s, c] of counts.entries()) {
          if (c > maxCount) {
            maxCount = c;
            majorityStart = s;
          }
        }
      }

      let bestStart = candidates[0] || majorityStart;
      let bestScore = -Infinity;
      const flexRangeMins = (config.teamShiftFlexibilityHours ?? 2) * 60;

      for (const cand of candidates) {
        let score = scoreCandidateShift(
          cand,
          paidShiftMins,
          date,
          requiredCurve,
          currentScheduledCurve,
          config,
          intervalMins
        );

        if (config.enforceTeamOfficerShift) {
          const diff = Math.abs(cand - majorityStart);
          if (diff <= flexRangeMins) {
            score += SHIFT_SCORING_WEIGHTS.officerAlignmentWeight * 5;
          } else {
            score -= (diff - flexRangeMins) * 2;
          }
        }

        if (score > bestScore) {
          bestScore = score;
          bestStart = cand;
        }
      }

      for (let t = bestStart; t < bestStart + paidShiftMins; t += intervalMins) {
        const key = `${date}__${minutesToTimeString(t)}`;
        currentScheduledCurve.set(key, (currentScheduledCurve.get(key) || 0) + 1);
      }

      const shiftEndMin = bestStart + paidShiftMins;
      const breaks: BreakWindow[] = [];
      if (totalBreakMinutes > 0) {
        const frac = config.breakStartFraction ?? 0.50;
        const bStart = Math.max(bestStart + 30, Math.min(shiftEndMin - totalBreakMinutes - 30, bestStart + Math.floor(paidShiftMins * frac)));
        breaks.push({
          start: minutesToTime(bStart),
          end: minutesToTime(bStart + totalBreakMinutes),
          durationMinutes: totalBreakMinutes,
        });
      }

      (supervisor.scheduleByDate as Record<string, AgentDayAssignment>)[date] = {
        date,
        dayIndex: dIdx,
        dayName: parseDateComponents(date).dayName,
        isOff: false,
        shiftStart: minutesToTime(bestStart),
        shiftEnd: minutesToTime(shiftEndMin),
        breaks,
        plannedShrinkages: [],
        adherenceWindows: [],
      };
    }
  }
}

/**
 * Function 1: buildContractWeekAssignments
 * Assigns WORK / OFF / BUSINESS_CLOSED per agent per real calendar week driven by workDaysPerWeek and offDaysPerWeek.
 */
export function buildContractWeekAssignments(
  config: WorkforceConfig,
  agents: SyntheticAgent[],
  uniqueDates: string[],
  dailyPressureMap: Map<string, number>
): {
  contractWarnings: string[];
} {
  const contractWarnings: string[] = [];

  const workDays = config.workDaysPerWeek ?? 5;
  const offDays = config.offDaysPerWeek ?? 2;

  if (workDays + offDays !== 7) {
    contractWarnings.push(
      `CONTRACT_CONFIGURATION_WARNING: Work Days = ${workDays}, OFF Days = ${offDays}, Total = ${workDays + offDays}, Expected contractual week = 7`
    );
  }

  const offDaysTarget = Math.max(0, Math.min(6, offDays));
  const isDynamicTrend = config.offDistributionMode === 'dynamic_volume_trend';

  if (offDaysTarget === 0) {
    // Everyone works every open day
    for (let aIdx = 0; aIdx < agents.length; aIdx++) {
      const agent = agents[aIdx];
      const scheduleMap = agent.scheduleByDate as Record<string, AgentDayAssignment>;
      for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
        const date = uniqueDates[dIdx];
        const comp = parseDateComponents(date);
        const isClosedDay = !config.is24x7 && (
          !isDateBusinessOperatingDay(date, config.operatingDays) ||
          isDateHoliday(date, config.holidayDates)
        );
        scheduleMap[date] = {
          date,
          dayIndex: dIdx,
          dayName: comp.dayName,
          isOff: isClosedDay,
          breaks: [],
          plannedShrinkages: [],
          adherenceWindows: [],
        };
      }
    }
    return { contractWarnings };
  }

  // When we have unique dates
  const totalAgents = agents.length;
  const sortedDatesAscending = [...uniqueDates].sort((a, b) => {
    return (dailyPressureMap.get(a) || 0) - (dailyPressureMap.get(b) || 0);
  });

  if (uniqueDates.length >= 7 && isDynamicTrend) {
    // Build a distribution of off-slots across the 7 days:
    // Lowest volume day gets the most off slots; highest volume day gets the fewest (but >= 1 if offDaysTarget > 0)
    // Total slots to distribute across N agents = N * offDaysTarget
    const totalOffSlots = totalAgents * offDaysTarget;
    const numDays = uniqueDates.length;
    
    // Weights inversely proportional to workload rank
    const weights: number[] = [];
    for (let i = 0; i < numDays; i++) {
      weights.push(numDays - i); // rank 0 has weight numDays, rank numDays-1 has weight 1
    }
    const sumWeights = weights.reduce((s, w) => s + w, 0);

    const slotsPerDay: number[] = [];
    let assignedSlots = 0;
    for (let i = 0; i < numDays; i++) {
      const raw = Math.round((weights[i] / sumWeights) * totalOffSlots);
      const guaranteed = Math.max(1, Math.min(totalAgents - 1, raw));
      slotsPerDay.push(guaranteed);
      assignedSlots += guaranteed;
    }

    // Adjust residual
    while (assignedSlots < totalOffSlots) {
      slotsPerDay[0]++;
      assignedSlots++;
    }
    while (assignedSlots > totalOffSlots) {
      for (let i = numDays - 1; i >= 0; i--) {
        if (slotsPerDay[i] > 1) {
          slotsPerDay[i]--;
          assignedSlots--;
          if (assignedSlots === totalOffSlots) break;
        }
      }
    }

    // Build the slot lookup array
    const slotToDate: string[] = [];
    for (let i = 0; i < numDays; i++) {
      const date = sortedDatesAscending[i];
      for (let s = 0; s < slotsPerDay[i]; s++) {
        slotToDate.push(date);
      }
    }

    // Assign exactly offDaysTarget distinct off days per agent
    for (let aIdx = 0; aIdx < totalAgents; aIdx++) {
      const agent = agents[aIdx];
      const scheduleMap = agent.scheduleByDate as Record<string, AgentDayAssignment>;
      const agentOffDays = new Set<string>();

      for (let k = 0; k < offDaysTarget; k++) {
        const step = Math.floor(slotToDate.length / offDaysTarget);
        let slotIdx = (aIdx + k * step) % slotToDate.length;
        let dateCandidate = slotToDate[slotIdx];
        
        let attempts = 0;
        while (agentOffDays.has(dateCandidate) && attempts < slotToDate.length) {
          slotIdx = (slotIdx + 1) % slotToDate.length;
          dateCandidate = slotToDate[slotIdx];
          attempts++;
        }
        agentOffDays.add(dateCandidate);
      }

      for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
        const date = uniqueDates[dIdx];
        const comp = parseDateComponents(date);
        const isClosedDay = !config.is24x7 && (
          !isDateBusinessOperatingDay(date, config.operatingDays) ||
          isDateHoliday(date, config.holidayDates)
        );

        scheduleMap[date] = {
          date,
          dayIndex: dIdx,
          dayName: comp.dayName,
          isOff: isClosedDay || agentOffDays.has(date),
          breaks: [],
          plannedShrinkages: [],
          adherenceWindows: [],
        };
      }
    }
  } else {
    // Flat rotation / partial horizon
    for (let aIdx = 0; aIdx < totalAgents; aIdx++) {
      const agent = agents[aIdx];
      const scheduleMap = agent.scheduleByDate as Record<string, AgentDayAssignment>;

      for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
        const date = uniqueDates[dIdx];
        const comp = parseDateComponents(date);
        const dayOfWeekIndex = (comp.dayOfWeek + 6) % 7; // 0=Mon, ..., 6=Sun
        const isClosedDay = !config.is24x7 && (
          !isDateBusinessOperatingDay(date, config.operatingDays) ||
          isDateHoliday(date, config.holidayDates)
        );

        const cycleIdx = uniqueDates.length >= 7 ? dayOfWeekIndex : dIdx;
        const agentPhase = (cycleIdx + aIdx) % 7;
        const isOffRotational = agentPhase < offDaysTarget;

        scheduleMap[date] = {
          date,
          dayIndex: dIdx,
          dayName: comp.dayName,
          isOff: isClosedDay || isOffRotational,
          breaks: [],
          plannedShrinkages: [],
          adherenceWindows: [],
        };
      }
    }
  }

  return { contractWarnings };
}

/**
 * Computes agent total paid hours for a weekly period
 */
export function computeAgentWeeklyHours(
  agent: SyntheticAgent | AgentWeeklySchedule,
  paidHoursPerShift: number = 8
): {
  scheduledHours: number;
  effectiveHours: number;
  breakHours: number;
  shrinkageHours: number;
} {
  const days: AgentDayAssignment[] = 'days' in agent
    ? agent.days
    : Object.values(agent.scheduleByDate || {});

  let totalScheduledMin = 0;
  let totalBreakMin = 0;
  let totalShrinkageMin = 0;

  for (const day of days) {
    if (!day || day.isOff || day.isOutOfOffice || !day.shiftStart || !day.shiftEnd) {
      continue;
    }

    const startM = timeToMinutes(day.shiftStart);
    const endM = timeToMinutes(day.shiftEnd);
    let shiftDurationMin = endM >= startM ? (endM - startM) : (1440 - startM + endM);
    totalScheduledMin += shiftDurationMin;

    for (const b of day.breaks || []) {
      const bDuration = b.durationMinutes ?? (timeToMinutes(b.end) - timeToMinutes(b.start));
      totalBreakMin += bDuration;
    }

    for (const s of day.plannedShrinkages || []) {
      const sDuration = s.durationMinutes ?? (timeToMinutes(s.end) - timeToMinutes(s.start));
      totalShrinkageMin += sDuration;
    }
  }

  const scheduledHours = Number((totalScheduledMin / 60).toFixed(1));
  const breakHours = Number((totalBreakMin / 60).toFixed(1));
  const shrinkageHours = Number((totalShrinkageMin / 60).toFixed(1));
  const effectiveHours = Number((Math.max(0, totalScheduledMin - totalBreakMin - totalShrinkageMin) / 60).toFixed(1));

  return {
    scheduledHours,
    effectiveHours,
    breakHours,
    shrinkageHours,
  };
}

/**
 * Function 8: calculateIntervalCapacity
 * Derives scheduled and effective capacity strictly from actual agent-state seconds without fallback percentages.
 */
export function calculateIntervalCapacity(
  agentSeconds: {
    scheduledSec: number;
    availableSec: number;
    breakSec: number;
    inOfficeSec: number;
    outOfficeSec: number;
    nonAdherentSec: number;
    busySec: number;
    readySec: number;
  },
  intervalDurationSec: number
): {
  scheduledHC: number;
  effectiveHC: number;
  busyHC: number;
  readyHC: number;
  breakHC: number;
  inOfficeLossHC: number;
  outOfficeLossHC: number;
  adherenceLossHC: number;
} {
  const scheduledHC = Number((agentSeconds.scheduledSec / intervalDurationSec).toFixed(1));
  const effectiveHC = Number((agentSeconds.availableSec / intervalDurationSec).toFixed(1));
  const busyHC = Number((agentSeconds.busySec / intervalDurationSec).toFixed(1));
  const readyHC = Number((agentSeconds.readySec / intervalDurationSec).toFixed(1));
  const breakHC = Number((agentSeconds.breakSec / intervalDurationSec).toFixed(1));
  const inOfficeLossHC = Number((agentSeconds.inOfficeSec / intervalDurationSec).toFixed(1));
  const outOfficeLossHC = Number((agentSeconds.outOfficeSec / intervalDurationSec).toFixed(1));
  const adherenceLossHC = Number((agentSeconds.nonAdherentSec / intervalDurationSec).toFixed(1));

  return {
    scheduledHC,
    effectiveHC,
    busyHC,
    readyHC,
    breakHC,
    inOfficeLossHC,
    outOfficeLossHC,
    adherenceLossHC,
  };
}

/**
 * Function 9: calculateConcurrentSlotCapacity
 * Handles chat / multi-slot concurrency capacity calculations.
 */
export function calculateConcurrentSlotCapacity(
  availableSec: number,
  busySlotSec: number,
  concurrency: number,
  intervalDurationSec: number
): {
  availableSlotSeconds: number;
  busySlotSeconds: number;
  readySlotSeconds: number;
  occupancyPercent: number;
  slotOccupancy: number;
} {
  const availableSlotSeconds = availableSec * concurrency;
  const busySlotSeconds = busySlotSec;
  const readySlotSeconds = Math.max(0, availableSlotSeconds - busySlotSeconds);
  const occupancyPercent = availableSlotSeconds > 0
    ? Number(((busySlotSeconds / availableSlotSeconds) * 100).toFixed(4))
    : 0.0;

  return {
    availableSlotSeconds,
    busySlotSeconds,
    readySlotSeconds,
    occupancyPercent,
    slotOccupancy: occupancyPercent / 100,
  };
}

/**
 * Function 10: validateCapacityConservation
 * Mathematically validates capacity conservation laws.
 */
export function validateCapacityConservation(
  scheduledSec: number,
  availableSec: number,
  breakSec: number,
  inOfficeSec: number,
  nonAdhSec: number,
  busySec: number,
  readySec: number,
  outOfficeSec: number = 0,
  toleranceSec: number = 0.01
): { isConserved: boolean; driftSeconds: number; message?: string } {
  const stateSum = availableSec + breakSec + inOfficeSec + nonAdhSec + outOfficeSec;
  const availStateSum = busySec + readySec;

  const drift1 = Math.abs(scheduledSec - stateSum);
  const drift2 = Math.abs(availableSec - availStateSum);
  const driftSeconds = Math.max(drift1, drift2);

  const isConserved = driftSeconds <= toleranceSec;
  return {
    isConserved,
    driftSeconds,
    message: isConserved ? undefined : `Capacity conservation drift: ${driftSeconds}s exceeds tolerance of ${toleranceSec}s`,
  };
}

/**
 * Function 2: validateContractWeek
 * Evaluates contract compliance, consecutive work/off, labor laws, and team deviation rules.
 */
export function validateContractWeek(
  config: WorkforceConfig,
  agents: SyntheticAgent[],
  uniqueDates: string[],
  intervalStaffing?: IntervalStaffing[]
): RosterValidationResult {
  const agentViolations: Array<{ agentId: string; type: string; message: string; date?: string }> = [];
  const coverageViolations: Array<{ date: string; interval: string; requiredHC: number; scheduledHC: number; minHC: number; message: string }> = [];
  const teamViolations: Array<{ teamId: number; team: string; type: string; message: string }> = [];
  const contractViolations: Array<{ agentId?: string; type: string; message: string }> = [];

  const workDays = config.workDaysPerWeek ?? 5;
  const offDays = config.offDaysPerWeek ?? 2;

  if (workDays + offDays !== 7) {
    contractViolations.push({
      type: 'CONTRACT_CONFIGURATION_WARNING',
      message: `Work Days = ${workDays}, OFF Days = ${offDays}, Total = ${workDays + offDays}, Expected contractual week = 7`,
    });
  }

  const maxConsecutiveWork = config.maxConsecutiveWorkDays ?? 6;
  const minRestHours = config.minRestHoursBetweenShifts ?? 12;
  const agentsWithViolations = new Set<string>();

  for (const agent of agents) {
    const schedule = agent.scheduleByDate as Record<string, AgentDayAssignment>;
    let consecutiveWork = 0;

    for (let d = 0; d < uniqueDates.length; d++) {
      const date = uniqueDates[d];
      const day = schedule[date];

      if (day && !day.isOff && !day.isOutOfOffice) {
        consecutiveWork++;
        if (consecutiveWork > maxConsecutiveWork) {
          agentViolations.push({
            agentId: agent.id,
            type: 'CONSECUTIVE_WORK_VIOLATION',
            message: `Agent ${agent.id} exceeded maximum consecutive work days (${consecutiveWork} > ${maxConsecutiveWork}) on ${date}`,
            date,
          });
          agentsWithViolations.add(agent.id);
        }

        if (d < uniqueDates.length - 1) {
          const nextDay = schedule[uniqueDates[d + 1]];
          if (nextDay && !nextDay.isOff && nextDay.shiftStart && day.shiftEnd) {
            const endMin = timeToMinutes(day.shiftEnd);
            const nextStartMin = timeToMinutes(nextDay.shiftStart);
            const restMins = (1440 - endMin) + nextStartMin;
            if (restMins < minRestHours * 60) {
              agentViolations.push({
                agentId: agent.id,
                type: 'REST_RULE_VIOLATION',
                message: `Agent ${agent.id} has only ${(restMins / 60).toFixed(1)}h rest between ${date} and ${uniqueDates[d + 1]} (< ${minRestHours}h)`,
                date,
              });
              agentsWithViolations.add(agent.id);
            }
          }
        }
      } else {
        consecutiveWork = 0;
      }
    }
  }

  const teamsMap = new Map<number, SyntheticAgent[]>();
  for (const ag of agents) {
    if (!teamsMap.has(ag.teamId)) teamsMap.set(ag.teamId, []);
    teamsMap.get(ag.teamId)!.push(ag);
  }

  const allowedDevPct = config.teamOffDeviationPercent ?? 20;

  for (const [teamId, teamAgents] of teamsMap.entries()) {
    const teamName = teamAgents[0]?.team || `Team ${teamId}`;

    const patterns = new Map<string, number>();
    for (const ag of teamAgents) {
      const sched = ag.scheduleByDate as Record<string, AgentDayAssignment>;
      const offDaysList = uniqueDates.filter(d => sched[d]?.isOff).sort().join(',');
      patterns.set(offDaysList, (patterns.get(offDaysList) || 0) + 1);
    }

    let primaryCount = 0;
    for (const [, count] of patterns.entries()) {
      if (count > primaryCount) primaryCount = count;
    }

    const deviations = teamAgents.length - primaryCount;
    const maxDevAllowed = Math.floor(teamAgents.length * (allowedDevPct / 100));

    if (deviations > maxDevAllowed) {
      teamViolations.push({
        teamId,
        team: teamName,
        type: 'TEAM_OFF_DEVIATION_VIOLATION',
        message: `${teamName} has ${deviations} off-pattern deviations, exceeding allowed limit of ${maxDevAllowed} (${allowedDevPct}%)`,
      });
    }

    if (config.enforceTeamOfficerShift) {
      const supervisor = teamAgents.find(a => a.isSupervisor);
      const members = teamAgents.filter(a => !a.isSupervisor);
      if (supervisor && members.length > 0) {
        for (const date of uniqueDates) {
          const supDay = (supervisor.scheduleByDate as Record<string, AgentDayAssignment>)[date];
          if (supDay && !supDay.isOff && supDay.shiftStart) {
            const supStart = timeToMinutes(supDay.shiftStart);
            const memberStarts = members
              .map(m => (m.scheduleByDate as Record<string, AgentDayAssignment>)[date])
              .filter(d => d && !d.isOff && d.shiftStart)
              .map(d => timeToMinutes(d.shiftStart!));

            if (memberStarts.length > 0) {
              const avgMemberStart = memberStarts.reduce((s, v) => s + v, 0) / memberStarts.length;
              const flexMins = (config.teamShiftFlexibilityHours ?? 2) * 60;
              if (Math.abs(supStart - avgMemberStart) > flexMins) {
                teamViolations.push({
                  teamId,
                  team: teamName,
                  type: 'TEAM_OFFICER_SHIFT_VIOLATION',
                  message: `Supervisor for ${teamName} shift on ${date} (${supDay.shiftStart}) deviates by more than ${config.teamShiftFlexibilityHours}h from team average`,
                });
              }
            }
          }
        }
      }
    }
  }

  if (intervalStaffing) {
    for (const staff of intervalStaffing) {
      const minHC = staff.minHC ?? (config.minCoverage !== undefined ? (config.minCoverage < 1 ? staff.requiredHC * config.minCoverage : config.minCoverage) : staff.requiredHC);
      if (staff.effectiveHC < minHC && staff.requiredHC > 0) {
        coverageViolations.push({
          date: staff.date || '',
          interval: staff.time || staff.intervalStart || '',
          requiredHC: staff.requiredHC,
          scheduledHC: staff.scheduledHC,
          minHC,
          message: `Undercoverage at ${staff.date} ${staff.time}: Effective HC ${staff.effectiveHC} is below minimum requirement of ${minHC.toFixed(1)}`,
        });
      }
    }
  }

  const agentsTotal = agents.length;
  const agentsCompliant = Math.max(0, agentsTotal - agentsWithViolations.size);
  const violationsTotal = agentViolations.length + coverageViolations.length + teamViolations.length + contractViolations.length;
  const compliancePercent = agentsTotal > 0 ? Number(((agentsCompliant / agentsTotal) * 100).toFixed(1)) : 100.0;

  return {
    agentViolations,
    coverageViolations,
    teamViolations,
    contractViolations,
    summary: {
      agentsTotal,
      agentsCompliant,
      violationsTotal,
      compliancePercent,
    },
  };
}

/**
 * Function 7: buildAgentAvailabilityTimeline
 * Builds chronological DES events for simulation loop.
 */
export function buildAgentAvailabilityTimeline(
  agents: SyntheticAgent[],
  demands: DemandRow[],
  baseTimestamp: number
): AgentAvailabilityEvent[] {
  const events: AgentAvailabilityEvent[] = [];

  for (const agent of agents) {
    const schedule = agent.scheduleByDate as Record<string, AgentDayAssignment>;
    for (const [date, daySched] of Object.entries(schedule)) {
      if (daySched.isOff || daySched.isOutOfOffice || !daySched.shiftStart || !daySched.shiftEnd) {
        continue;
      }

      const dayEpoch = parseDateTimeToEpochSeconds(date, '00:00');
      const startSec = dayEpoch + timeToMinutes(daySched.shiftStart) * 60;
      const endSec = dayEpoch + timeToMinutes(daySched.shiftEnd) * 60;

      events.push({ agentId: agent.id, timestamp: startSec, type: 'SHIFT_START' });
      events.push({ agentId: agent.id, timestamp: endSec, type: 'SHIFT_END' });

      for (const b of daySched.breaks) {
        const bStart = dayEpoch + timeToMinutes(b.start) * 60;
        const bEnd = dayEpoch + timeToMinutes(b.end) * 60;
        events.push({ agentId: agent.id, timestamp: bStart, type: 'BREAK_START' });
        events.push({ agentId: agent.id, timestamp: bEnd, type: 'BREAK_END' });
      }

      for (const s of daySched.plannedShrinkages) {
        const sStart = dayEpoch + timeToMinutes(s.start) * 60;
        const sEnd = dayEpoch + timeToMinutes(s.end) * 60;
        events.push({ agentId: agent.id, timestamp: sStart, type: 'SHRINKAGE_START' });
        events.push({ agentId: agent.id, timestamp: sEnd, type: 'SHRINKAGE_END' });
      }

      for (const a of daySched.adherenceWindows || []) {
        const aStart = dayEpoch + timeToMinutes(a.start) * 60;
        const aEnd = dayEpoch + timeToMinutes(a.end) * 60;
        events.push({ agentId: agent.id, timestamp: aStart, type: 'ADHERENCE_START' });
        events.push({ agentId: agent.id, timestamp: aEnd, type: 'ADHERENCE_END' });
      }
    }
  }

  const typePriority: Record<string, number> = {
    SHIFT_START: 1,
    BREAK_START: 2,
    SHRINKAGE_START: 2,
    ADHERENCE_START: 2,
    BREAK_END: 3,
    SHRINKAGE_END: 3,
    ADHERENCE_END: 3,
    SHIFT_END: 4,
  };

  events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return (typePriority[a.type] || 0) - (typePriority[b.type] || 0);
  });
  return events;
}

/**
 * Evaluates scheduling feasibility and detects hard / soft constraint violations
 */
export function auditRosterFeasibility(
  config: WorkforceConfig,
  agents: SyntheticAgent[],
  uniqueDates: string[],
  earliestDemandMin: number,
  latestDemandMin: number
): FeasibilityIssue[] {
  const issues: FeasibilityIssue[] = [];

  const femaleCount = Math.round(config.totalHC * ((config.genderFemalePercent ?? 40) / 100));
  const maleCount = config.totalHC - femaleCount;
  const femaleStartMin = timeToMinutes(config.femaleEarliestStart || '06:00');
  const femaleFinishMin = timeToMinutes(config.femaleLatestFinish || '22:00');

  if (config.femaleConstraintStrict && femaleCount > 0) {
    const nightShiftNeeded = earliestDemandMin < femaleStartMin || latestDemandMin > femaleFinishMin;
    if (nightShiftNeeded && maleCount === 0) {
      issues.push({
        severity: 'hard_violation',
        category: 'gender_curfew',
        title: 'Female Curfew Conflict with Night Coverage',
        description: `Demand requires coverage outside ${config.femaleEarliestStart}–${config.femaleLatestFinish}, but Female HC is 100% (0 male agents). Roster cannot legally cover night intervals under strict curfew.`,
        remedies: [
          'Reduce Female HC ratio to allow male agents for night shifts',
          'Adjust business operating hours',
          'Disable strict female labor curfew enforcement',
        ],
      });
    }
  }

  const minRestHours = config.minRestHoursBetweenShifts ?? 12;
  let restViolations = 0;

  for (const agent of agents) {
    for (let d = 0; d < uniqueDates.length - 1; d++) {
      const day1 = (agent.scheduleByDate as Record<string, AgentDayAssignment>)[uniqueDates[d]];
      const day2 = (agent.scheduleByDate as Record<string, AgentDayAssignment>)[uniqueDates[d + 1]];
      if (day1 && day2 && !day1.isOff && !day2.isOff && day1.shiftEnd && day2.shiftStart) {
        const end1 = timeToMinutes(day1.shiftEnd);
        const start2 = timeToMinutes(day2.shiftStart);
        const restMinutes = (1440 - end1) + start2;
        if (restMinutes < minRestHours * 60) {
          restViolations++;
        }
      }
    }
  }

  if (restViolations > 0) {
    issues.push({
      severity: 'hard_violation',
      category: 'rest_rule',
      title: 'Rest Rule Violations Detected',
      description: `${restViolations} agent shift transitions violate the ${minRestHours}h minimum rest rule between consecutive shifts.`,
      remedies: [
        'Increase shift consistency across consecutive working days',
        'Reduce team shift rotation volatility',
        'Lower min rest requirement if permitted by local labor regulations',
      ],
    });
  }

  if (uniqueDates.length < 7 && uniqueDates.length > 0) {
    issues.push({
      severity: 'info',
      category: 'horizon_partial',
      title: 'Partial Week Analysis Active',
      description: `Uploaded data has ${uniqueDates.length} day(s). Weekly contractual cycles are normalized proportionally without fabricating fake demand.`,
      remedies: [
        'Upload full 7-day or multi-week dataset for complete rotational analysis',
      ],
    });
  }

  return issues;
}

/**
 * Main Roster Generation Function
 */
export function generateRoster(
  config: WorkforceConfig,
  intervals: string[],
  erlangReqs: number[],
  demands: DemandRow[]
): GeneratedRoster {
  const totalHC = Math.max(0, config.totalHC ?? 0);

  const dateMap = new Map<string, DemandRow[]>();
  for (const d of demands) {
    if (!d.date) continue;
    if (!dateMap.has(d.date)) dateMap.set(d.date, []);
    dateMap.get(d.date)!.push(d);
  }
  const rawDates = Array.from(dateMap.keys());
  const uniqueDates = sortDatesChronologically(rawDates);

  const demandSegments = Array.from(new Set(demands.map(d => d.segment).filter(Boolean)));
  const configSegments = [
    ...Object.keys(config.segmentHC || {}),
    ...Object.keys(config.segmentConfigs || {}),
  ];
  const allSegments = Array.from(new Set([...demandSegments, ...configSegments]));
  const uniqueSegments = allSegments.length > 0 ? allSegments : ['Voice'];

  const femaleRatio = Math.max(0, Math.min(100, config.genderFemalePercent ?? 40)) / 100;
  const femaleCount = Math.round(totalHC * femaleRatio);
  const maleCount = totalHC - femaleCount;

  const teamSize = Math.max(1, config.teamSize ?? 10);
  const teamCount = totalHC > 0 ? Math.ceil(totalHC / teamSize) : 0;

  if (totalHC === 0 || uniqueDates.length === 0) {
    return {
      agents: [],
      events: [],
      intervalStaffing: demands.map((dem, idx) => ({
        id: `empty_${dem.date}_${dem.intervalStart}_${idx}`,
        time: dem.intervalStart,
        intervalStart: dem.intervalStart,
        date: dem.date,
        segment: dem.segment,
        requiredHC: 0,
        coverageGap: 0,
        coveragePercent: 0,
        scheduledHC: 0,
        effectiveHC: 0,
        onShift: 0,
        onBreak: 0,
        offDuty: 0,
        shrinkageLoss: 0,
        outOfficeLoss: 0,
        adherenceLoss: 0,
      })),
      weeklyPlan: {
        days: uniqueDates.map((date, idx) => {
          const comp = parseDateComponents(date);
          return {
            dayIndex: idx,
            date,
            dayName: comp.dayName,
            volume: 0,
            workloadSeconds: 0,
            erlangPeakReq: 0,
            erlangAvgReq: 0,
            allocatedWorkingHC: 0,
            allocatedOffHC: 0,
            breakShrinkagePercent: Math.round((config.shrinkageBreakPercent ?? 0.07) * 100),
            flexibleShrinkagePercent: Math.round(((config.shrinkageInOffice ?? 0.13) + (config.shrinkageOutOffice ?? 0.12)) * 100),
            totalShrinkagePercent: Math.round((config.shrinkageTotal ?? 0.32) * 100),
            effectiveWorkingHC: 0,
          };
        }),
        totalWeeklyOffSlots: 0,
        totalWeeklyWorkSlots: 0,
        perAgentOffDaysTarget: config.offDaysPerWeek ?? 0,
        complianceRate: 100,
        nonCompliantCount: 0,
        avgWeeklyShrinkagePercent: Math.round((config.shrinkageTotal ?? 0.32) * 100),
        protectedBreakPercent: Math.round((config.shrinkageBreakPercent ?? 0.07) * 100),
        flexibleShrinkagePoolPercent: Math.round(((config.shrinkageInOffice ?? 0.13) + (config.shrinkageOutOffice ?? 0.12)) * 100),
        agentSchedules: [],
        feasibilityIssues: [],
      },
      summary: {
        totalHC: 0,
        workingToday: 0,
        offToday: 0,
        femaleCount: 0,
        maleCount: 0,
        teamCount: 0,
      },
    };
  }

  const segmentAllocations: Record<string, number> = {};
  let totalExplicitHC = 0;
  for (const seg of uniqueSegments) {
    const count = config.segmentConfigs?.[seg]?.dedicatedHC ?? config.segmentHC?.[seg];
    if (count !== undefined && count !== null && count >= 0) {
      segmentAllocations[seg] = count;
      totalExplicitHC += count;
    }
  }

  if (totalExplicitHC > 0) {
    if (config.totalHC === undefined || config.totalHC === totalExplicitHC) {
      // Matches
    } else if (totalHC > totalExplicitHC) {
      const unallocatedSegments = uniqueSegments.filter(s => segmentAllocations[s] === undefined);
      const remainingHC = totalHC - totalExplicitHC;
      if (unallocatedSegments.length > 0) {
        const perSeg = Math.floor(remainingHC / unallocatedSegments.length);
        let rem = remainingHC % unallocatedSegments.length;
        for (const seg of unallocatedSegments) {
          segmentAllocations[seg] = perSeg + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
        }
      } else {
        segmentAllocations[uniqueSegments[0]] = (segmentAllocations[uniqueSegments[0]] || 0) + remainingHC;
      }
    }
  } else {
    const perSeg = Math.floor(totalHC / uniqueSegments.length);
    let rem = totalHC % uniqueSegments.length;
    for (const seg of uniqueSegments) {
      segmentAllocations[seg] = perSeg + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
    }
  }

  const agents: SyntheticAgent[] = [];
  let agentIdCounter = 1;

  for (const seg of uniqueSegments) {
    const count = segmentAllocations[seg] || 0;
    const segConfig = config.segmentConfigs?.[seg];
    const isShared = segConfig?.allocationType === 'shared';
    const poolId = segConfig?.poolId || (isShared ? 'shared_pool' : undefined);
    const segDemand = demands.find(d => d.segment === seg);
    const segChannel = segConfig?.channel || segDemand?.channel || 'voice';

    let concurrency = 1;
    if (segChannel === 'voice') {
      concurrency = 1;
    } else if (segChannel === 'chat') {
      concurrency = segConfig?.concurrency ? Math.max(1, segConfig.concurrency) : (config.chatConcurrency ? Math.max(1, config.chatConcurrency) : 3);
    } else {
      concurrency = segConfig?.concurrency ? Math.max(1, segConfig.concurrency) : (config.chatConcurrency ? Math.max(1, config.chatConcurrency) : 1);
    }

    let skills: string[];
    if (isShared && poolId) {
      const poolSegments = uniqueSegments.filter(s => {
        const sConf = config.segmentConfigs?.[s];
        const sIsShared = sConf?.allocationType === 'shared';
        const sPoolId = sConf?.poolId || (sIsShared ? 'shared_pool' : undefined);
        return sIsShared && sPoolId === poolId;
      });
      skills = poolSegments.length > 0 ? poolSegments : [seg];
    } else {
      skills = [seg];
    }

    for (let i = 0; i < count; i++) {
      const isFemale = agents.length < femaleCount;
      const teamIdx = Math.floor(agents.length / teamSize);
      const isSupervisor = (agents.length % teamSize) === 0;

      agents.push({
        id: `AG-${agentIdCounter.toString().padStart(4, '0')}`,
        name: `Agent ${agentIdCounter}`,
        segment: seg,
        channel: segChannel,
        team: `Team ${String.fromCharCode(65 + (teamIdx % 26))}`,
        teamId: teamIdx,
        gender: isFemale ? 'F' : 'M',
        isSupervisor,
        skills,
        poolId,
        concurrency,
        scheduleByDate: {},
      });
      agentIdCounter++;
    }
  }

  let minDemandMin = 24 * 60;
  let maxDemandMin = 0;
  for (const d of demands) {
    const m = timeToMinutes(d.intervalStart);
    const mEnd = m + (d.intervalMinutes || 30);
    if (m < minDemandMin) minDemandMin = m;
    if (mEnd > maxDemandMin) maxDemandMin = mEnd;
  }
  if (minDemandMin >= maxDemandMin) {
    minDemandMin = timeToMinutes(config.businessHoursStart || '08:00');
    maxDemandMin = timeToMinutes(config.businessHoursEnd || '20:00');
  }

  const operatingWindow = { startMin: minDemandMin, endMin: maxDemandMin };

  // 1. Build Required Coverage Curve & Daily Pressure
  const { requiredCurve, dailyPressureMap } = buildRequiredCoverageCurve(demands, config);

  // 2. Assign Contract Week WORK / OFF days (P0-1 & P0-2)
  buildContractWeekAssignments(config, agents, uniqueDates, dailyPressureMap);

  // 3. Assign Coverage-Optimized Shifts per Working Date (P0-3 & P0-4)
  const currentScheduledCurve = new Map<string, number>();

  for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
    const date = uniqueDates[dIdx];
    const workingAgentsToday = agents.filter(a => {
      const s = (a.scheduleByDate as Record<string, AgentDayAssignment>)[date];
      return s && !s.isOff;
    });

    assignCoverageOptimizedShifts(
      workingAgentsToday,
      date,
      requiredCurve,
      currentScheduledCurve,
      config,
      operatingWindow,
      demands[0]?.intervalMinutes || 30,
      dIdx,
      uniqueDates
    );
  }

  // 4. Out-of-Office Shrinkage Assignment
  let explicitOut = config.shrinkageOutOffice ?? 0;
  let explicitIn = config.shrinkageInOffice ?? 0;
  const explicitBreak = config.shrinkageBreakPercent ?? 0.07;
  
  if (config.shrinkageTotal !== undefined && config.shrinkageOutOffice === undefined && config.shrinkageInOffice === undefined) {
    const residual = Math.max(0, config.shrinkageTotal - explicitBreak);
    explicitOut = residual * 0.5;
    explicitIn = residual * 0.5;
  }

  const explicitSum = explicitBreak + explicitOut + explicitIn;
  const outScale = (config.shrinkageTotal !== undefined && explicitSum > 0 && Math.abs(config.shrinkageTotal - explicitSum) > 0.02)
    ? (config.shrinkageTotal / explicitSum)
    : 1.0;
  const targetOutOfficePct = explicitOut > 0 ? Math.min(1.0, explicitOut * outScale) : 0;

  if (targetOutOfficePct > 0) {
    for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
      const d = uniqueDates[dIdx];
      const workingToday = agents.filter(a => {
        const s = (a.scheduleByDate as Record<string, AgentDayAssignment>)[d];
        return s && !s.isOff;
      });

      const numOOO = Math.round(workingToday.length * targetOutOfficePct);
      for (let i = 0; i < Math.min(numOOO, workingToday.length); i++) {
        const agIdx = (dIdx * 7 + i * 3) % workingToday.length;
        const s = (workingToday[agIdx].scheduleByDate as Record<string, AgentDayAssignment>)[d];
        if (s) {
          s.isOutOfOffice = true;
          s.outOfOfficeReason = 'Planned Leave';
        }
      }
    }
  }

  // 5. Adherence Loss Windows Assignment
  const adherence = config.adherence ?? 1.0;
  const nonAdherentRate = Math.max(0, 1.0 - adherence);
  if (nonAdherentRate > 0) {
    const paidShiftMins = (config.dailyPaidHours ?? 8) * 60;
    const adhMins = Math.round(paidShiftMins * nonAdherentRate);
    if (adhMins > 0) {
      for (let agIdx = 0; agIdx < agents.length; agIdx++) {
        const ag = agents[agIdx];
        for (const d of uniqueDates) {
          const s = (ag.scheduleByDate as Record<string, AgentDayAssignment>)[d];
          if (s && !s.isOff && !s.isOutOfOffice && s.shiftStart) {
            const startM = timeToMinutes(s.shiftStart);
            const endM = timeToMinutes(s.shiftEnd || s.shiftStart);
            const shiftLen = Math.max(adhMins, endM - startM);
            
            if (adhMins >= shiftLen) {
              s.adherenceWindows = [
                {
                  start: minutesToTime(startM),
                  end: minutesToTime(endM),
                  durationMinutes: shiftLen,
                },
              ];
            } else {
              const numSlots = Math.max(1, Math.round(shiftLen / adhMins));
              const slotIdx = agIdx % numSlots;
              const adhStart = startM + Math.min(shiftLen - adhMins, slotIdx * adhMins);
              s.adherenceWindows = [
                {
                  start: minutesToTime(adhStart),
                  end: minutesToTime(adhStart + adhMins),
                  durationMinutes: adhMins,
                },
              ];
            }
          }
        }
      }
    }
  }

  // 6. Assemble Interval Staffing with Exact Capacity
  const intervalStaffing: IntervalStaffing[] = [];
  const baseTimestamp = demands[0] ? parseDateTimeToEpochSeconds(demands[0].date, '00:00') : 0;

  for (let i = 0; i < demands.length; i++) {
    const dem = demands[i];
    const intDurationSec = (dem.intervalMinutes || 30) * 60;
    const intervalMin = timeToMinutes(dem.intervalStart);
    const intervalEndMin = intervalMin + (dem.intervalMinutes || 30);

    let scheduledAgentSeconds = 0;
    let availableSeconds = 0;
    let breakSeconds = 0;
    let inOfficeShrinkageSeconds = 0;
    let outOfficeSeconds = 0;
    let nonAdherentSeconds = 0;

    for (const ag of agents) {
      if (!ag.skills.includes(dem.segment)) continue;
      const daySched = (ag.scheduleByDate as Record<string, AgentDayAssignment>)[dem.date];
      if (!daySched || daySched.isOff || !daySched.shiftStart || !daySched.shiftEnd) continue;

      const sStartMin = timeToMinutes(daySched.shiftStart);
      const sEndMin = timeToMinutes(daySched.shiftEnd);

      const oShiftSec = Math.max(0, Math.min(intervalEndMin, sEndMin) - Math.max(intervalMin, sStartMin)) * 60;
      if (oShiftSec <= 0) continue;

      const weight = ag.poolId ? (1.0 / ag.skills.length) : 1.0;
      scheduledAgentSeconds += oShiftSec * weight;

      if (daySched.isOutOfOffice) {
        outOfficeSeconds += oShiftSec * weight;
        continue;
      }

      let bSec = 0;
      for (const b of daySched.breaks) {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        bSec += Math.max(0, Math.min(intervalEndMin, bEnd) - Math.max(intervalMin, bStart)) * 60;
      }
      breakSeconds += bSec * weight;

      let shSec = 0;
      for (const s of daySched.plannedShrinkages) {
        const sStartMin = timeToMinutes(s.start);
        const sEndMin = timeToMinutes(s.end);
        shSec += Math.max(0, Math.min(intervalEndMin, sEndMin) - Math.max(intervalMin, sStartMin)) * 60;
      }
      inOfficeShrinkageSeconds += shSec * weight;

      let adhSec = 0;
      for (const a of daySched.adherenceWindows || []) {
        const aStart = timeToMinutes(a.start);
        const aEnd = timeToMinutes(a.end);
        adhSec += Math.max(0, Math.min(intervalEndMin, aEnd) - Math.max(intervalMin, aStart)) * 60;
      }
      nonAdherentSeconds += adhSec * weight;

      const availSec = Math.max(0, oShiftSec - bSec - shSec - adhSec);
      availableSeconds += availSec * weight;
    }

    const scheduledHC = Number((scheduledAgentSeconds / intDurationSec).toFixed(1));
    const effectiveHC = Number((availableSeconds / intDurationSec).toFixed(1));
    const breakHC = Number((breakSeconds / intDurationSec).toFixed(1));
    const shrinkageLoss = Number(((inOfficeShrinkageSeconds + outOfficeSeconds) / intDurationSec).toFixed(1));
    const outOfficeLoss = Number((outOfficeSeconds / intDurationSec).toFixed(1));
    const adherenceLoss = Number((nonAdherentSeconds / intDurationSec).toFixed(1));

    const requiredHC = solveRequiredStaffing(
      dem.trafficErlangs,
      dem.ahtSeconds,
      config.slaPercentTarget / 100,
      config.slaThresholdSeconds,
      config.maxOccupancyThreshold / 100,
      config.minCoverage,
      config.erlangModel,
      config.defaultPatienceSeconds
    );

    const minRatio = (config.minCoverage !== undefined && config.minCoverage < 1)
      ? config.minCoverage
      : (requiredHC > 0 && config.minCoverage !== undefined ? Math.min(1.0, config.minCoverage / requiredHC) : 1.0);
    const minHC = Number((requiredHC * minRatio).toFixed(1));
    const targetHC = requiredHC;

    const coverageGap = Number((effectiveHC - requiredHC).toFixed(1));
    const gapToTarget = Number((scheduledHC - targetHC).toFixed(1));
    const gapToMinimum = Number((scheduledHC - minHC).toFixed(1));
    const coveragePercent = requiredHC > 0 ? Number(((effectiveHC / requiredHC) * 100).toFixed(1)) : 100;

    intervalStaffing.push({
      id: `${dem.date}_${dem.intervalStart}_${dem.segment}`,
      time: dem.intervalStart,
      intervalStart: dem.intervalStart,
      date: dem.date,
      segment: dem.segment,
      requiredHC,
      targetHC,
      minHC,
      scheduledHC,
      effectiveHC,
      onShift: scheduledHC,
      onBreak: breakHC,
      offDuty: Math.max(0, Number((totalHC - scheduledHC).toFixed(1))),
      shrinkageLoss,
      outOfficeLoss,
      adherenceLoss,
      coverageGap,
      gapToTarget,
      gapToMinimum,
      coveragePercent,
    });
  }

  // 7. Feasibility and Contract Audits
  const feasibilityIssues = auditRosterFeasibility(
    config,
    agents,
    uniqueDates,
    minDemandMin,
    maxDemandMin
  );

  const validationResult = validateContractWeek(config, agents, uniqueDates, intervalStaffing);

  // 8. Day Off Distributions
  const dayDistributions: DayOffDistribution[] = uniqueDates.map((date, idx) => {
    let working = 0;
    let off = 0;
    for (const ag of agents) {
      const s = (ag.scheduleByDate as Record<string, AgentDayAssignment>)[date];
      if (s && !s.isOff && !s.isOutOfOffice) working++;
      else off++;
    }

    const dayRows = dateMap.get(date) || [];
    const vol = dayRows.reduce((s, r) => s + r.volume, 0);
    const wSec = dayRows.reduce((s, r) => s + r.workloadSeconds, 0);

    const dayStaff = intervalStaffing.filter(st => st.date === date);
    const peakReq = dayStaff.length > 0 ? Math.max(...dayStaff.map(st => st.requiredHC)) : 0;
    const avgReq = dayStaff.length > 0 ? Number((dayStaff.reduce((s, st) => s + st.requiredHC, 0) / dayStaff.length).toFixed(1)) : 0;

    return {
      dayIndex: idx,
      date,
      dayName: parseDateComponents(date).dayName,
      volume: vol,
      workloadSeconds: wSec,
      erlangPeakReq: peakReq,
      erlangAvgReq: avgReq,
      allocatedWorkingHC: working,
      allocatedOffHC: off,
      breakShrinkagePercent: Math.round((config.shrinkageBreakPercent ?? 0.07) * 100),
      flexibleShrinkagePercent: Math.round(((config.shrinkageInOffice ?? 0.13) + (config.shrinkageOutOffice ?? 0.12)) * 100),
      totalShrinkagePercent: Math.round((config.shrinkageTotal ?? 0.32) * 100),
      effectiveWorkingHC: Math.round(working * (1.0 - (config.shrinkageTotal ?? 0.32))),
    };
  });

  // 9. Agent Weekly Schedules
  const agentSchedules: AgentWeeklySchedule[] = agents.map(ag => {
    const days: AgentDayAssignment[] = uniqueDates.map(d => (ag.scheduleByDate as Record<string, AgentDayAssignment>)[d]);
    const offDaysCount = days.filter(d => d && d.isOff).length;
    return {
      agentId: ag.id,
      agentName: ag.name,
      segment: ag.segment,
      team: ag.team,
      gender: ag.gender,
      isSupervisor: ag.isSupervisor,
      days,
      offDaysCount,
      isCompliant: true,
    };
  });

  const events = buildAgentAvailabilityTimeline(agents, demands, baseTimestamp);

  const firstDate = uniqueDates[0];
  let workingToday = 0;
  let offToday = 0;
  for (const ag of agents) {
    const s = (ag.scheduleByDate as Record<string, AgentDayAssignment>)[firstDate];
    if (s && !s.isOff && !s.isOutOfOffice) workingToday++;
    else offToday++;
  }

  const weeklyPlan: WeeklyRosterPlan = {
    days: dayDistributions,
    totalWeeklyOffSlots: dayDistributions.reduce((s, d) => s + d.allocatedOffHC, 0),
    totalWeeklyWorkSlots: dayDistributions.reduce((s, d) => s + d.allocatedWorkingHC, 0),
    perAgentOffDaysTarget: config.offDaysPerWeek ?? 2,
    complianceRate: validationResult.summary.compliancePercent,
    nonCompliantCount: validationResult.summary.agentsTotal - validationResult.summary.agentsCompliant,
    avgWeeklyShrinkagePercent: Math.round((config.shrinkageTotal ?? 0.32) * 100),
    protectedBreakPercent: Math.round((config.shrinkageBreakPercent ?? 0.07) * 100),
    flexibleShrinkagePoolPercent: Math.round(((config.shrinkageInOffice ?? 0.13) + (config.shrinkageOutOffice ?? 0.12)) * 100),
    agentSchedules,
    feasibilityIssues,
    validationResult,
  };

  return {
    agents,
    events,
    intervalStaffing,
    weeklyPlan,
    validationResult,
    summary: {
      totalHC,
      workingToday,
      offToday,
      femaleCount,
      maleCount,
      teamCount,
    },
  };
}
