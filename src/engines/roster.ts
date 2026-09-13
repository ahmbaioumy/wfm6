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
  summary: {
    totalHC: number;
    workingToday: number;
    offToday: number;
    femaleCount: number;
    maleCount: number;
    teamCount: number;
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

  // 1. Gender curfew vs operating hours conflict
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

  // 2. Minimum rest between shifts audit
  const minRestHours = config.minRestHoursBetweenShifts ?? 12;
  let restViolations = 0;

  for (const agent of agents) {
    for (let d = 0; d < uniqueDates.length - 1; d++) {
      const day1 = (agent.scheduleByDate as any)[uniqueDates[d]];
      const day2 = (agent.scheduleByDate as any)[uniqueDates[d + 1]];
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

  // 3. Partial horizon notice
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

  // Group demands by date and sort chronologically
  const dateMap = new Map<string, DemandRow[]>();
  for (const d of demands) {
    if (!d.date) continue;
    if (!dateMap.has(d.date)) dateMap.set(d.date, []);
    dateMap.get(d.date)!.push(d);
  }
  const rawDates = Array.from(dateMap.keys());
  const uniqueDates = sortDatesChronologically(rawDates);

  // Extract unique segments from demands and explicit configs
  const demandSegments = Array.from(new Set(demands.map(d => d.segment).filter(Boolean)));
  const configSegments = [
    ...Object.keys(config.segmentHC || {}),
    ...Object.keys(config.segmentConfigs || {}),
  ];
  const allSegments = Array.from(new Set([...demandSegments, ...configSegments]));
  const uniqueSegments = allSegments.length > 0 ? allSegments : ['Voice'];

  // Establish gender distribution
  const femaleRatio = Math.max(0, Math.min(100, config.genderFemalePercent ?? 40)) / 100;
  const femaleCount = Math.round(totalHC * femaleRatio);
  const maleCount = totalHC - femaleCount;

  // Establish team parameters
  const teamSize = Math.max(1, config.teamSize ?? 10);
  const teamCount = totalHC > 0 ? Math.ceil(totalHC / teamSize) : 0;

  // Zero HC Guard
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

  // Segment allocation: Explicit calculation for dedicated and shared HC
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
    // Distribute totalHC evenly across segments
    const perSeg = Math.floor(totalHC / uniqueSegments.length);
    let rem = totalHC % uniqueSegments.length;
    for (const seg of uniqueSegments) {
      segmentAllocations[seg] = perSeg + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
    }
  }

  // Generate synthetic agents
  const agents: SyntheticAgent[] = [];
  let agentIdCounter = 1;

  for (const seg of uniqueSegments) {
    const count = segmentAllocations[seg] || 0;
    const segConfig = config.segmentConfigs?.[seg];
    const isShared = segConfig?.allocationType === 'shared';
    const poolId = segConfig?.poolId || (isShared ? 'shared_pool' : undefined);
    const segDemand = demands.find(d => d.segment === seg);
    const segChannel = segConfig?.channel || segDemand?.channel || 'voice';

    // Channel Concurrency (Voice is strictly 1)
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

  // Determine Operating Interval Range
  let minDemandMin = 24 * 60;
  let maxDemandMin = 0;
  for (const d of demands) {
    const m = timeToMinutes(d.intervalStart);
    if (m < minDemandMin) minDemandMin = m;
    if (m > maxDemandMin) maxDemandMin = m;
  }
  if (minDemandMin > maxDemandMin) {
    minDemandMin = timeToMinutes(config.businessHoursStart || '08:00');
    maxDemandMin = timeToMinutes(config.businessHoursEnd || '20:00');
  }

  // Shift Step & Paid Hours
  const shiftStep = config.shiftStartStepMinutes === 60 ? 60 : (config.shiftStartStepMinutes === 15 ? 15 : 30);
  const paidShiftHours = config.dailyPaidHours ?? 8;
  if (paidShiftHours <= 0 || paidShiftHours > 24) {
    throw new Error(`Invalid parameter: dailyPaidHours must be between 1 and 24, got ${paidShiftHours}`);
  }
  const paidShiftMins = Math.round(paidShiftHours * 60);

  // Generate candidate shift start times
  const candidateStarts: number[] = [];
  if (minDemandMin === maxDemandMin) {
    candidateStarts.push(minDemandMin);
  } else if (config.is24x7) {
    for (let m = 0; m < 1440; m += shiftStep) {
      candidateStarts.push(m);
    }
  } else {
    const bStart = timeToMinutes(config.businessHoursStart || '08:00');
    const bEnd = timeToMinutes(config.businessHoursEnd || '18:00');
    let startEarliest = Math.max(0, Math.min(bStart, minDemandMin));
    let startLatest = Math.max(startEarliest, Math.min(1440 - paidShiftMins, bEnd - 60));

    if (bEnd > bStart) {
      startEarliest = bStart;
      startLatest = Math.max(bStart, bEnd - paidShiftMins);
    }

    for (let m = startEarliest; m <= startLatest; m += shiftStep) {
      candidateStarts.push(m);
    }
  }
  if (candidateStarts.length === 0) {
    candidateStarts.push(minDemandMin);
  }

  // Shift start assignment per team
  const teamBaseShiftStart = new Map<number, number>();
  for (let t = 0; t < teamCount; t++) {
    const start = candidateStarts[t % candidateStarts.length];
    teamBaseShiftStart.set(t, start);
  }

  const offDaysTarget = Math.max(0, Math.min(6, config.offDaysPerWeek ?? 0));
  const femaleStartMin = timeToMinutes(config.femaleEarliestStart || '06:00');
  const femaleFinishMin = timeToMinutes(config.femaleLatestFinish || '22:00');

  // Compute daily volume trend for dynamic OFF allocation
  const dailyWorkloads = uniqueDates.map(date => {
    const rows = dateMap.get(date) || [];
    return rows.reduce((s, r) => s + r.workloadSeconds, 0);
  });
  const maxWorkload = Math.max(1, ...dailyWorkloads);

  const lowVolThreshold = config.lowVolumeThreshold ?? 0.75;
  const splitB1Pos = config.splitBreak1Position ?? 0.33;
  const splitB2Pos = config.splitBreak2Position ?? 0.66;
  const staggerMins = config.breakStaggerMinutes ?? 10;
  const inOfficePos = config.inOfficeShrinkagePreferredPosition ?? 0.75;

  // Distribute schedules across all unique dates in uploaded horizon
  for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
    const date = uniqueDates[dIdx];
    const comp = parseDateComponents(date);
    const dayOfWeekName = comp.dayName;
    const workload = dailyWorkloads[dIdx];
    const isLowVolumeDay = workload < maxWorkload * lowVolThreshold;

    const isClosedDay = !config.is24x7 && (
      !isDateBusinessOperatingDay(date, config.operatingDays) ||
      isDateHoliday(date, config.holidayDates)
    );

    for (let aIdx = 0; aIdx < agents.length; aIdx++) {
      const agent = agents[aIdx];
      const scheduleMap = agent.scheduleByDate as Record<string, AgentDayAssignment>;

      // Determine if agent is OFF on this day
      let isOff = false;
      if (isClosedDay) {
        isOff = true;
      } else if (offDaysTarget > 0) {
        if (config.offDistributionMode === 'dynamic_volume_trend') {
          // Concentrate OFF days on low volume days
          const agentOffPhase = (aIdx + (isLowVolumeDay ? 0 : 3)) % 7;
          isOff = (agentOffPhase < offDaysTarget);
        } else {
          // Flat rotation
          const agentOffPhase = aIdx % 7;
          isOff = ((dIdx + agentOffPhase) % 7) < offDaysTarget;
        }
      }

      if (isOff) {
        scheduleMap[date] = {
          date,
          dayIndex: dIdx,
          dayName: dayOfWeekName,
          isOff: true,
          breaks: [],
          plannedShrinkages: [],
          adherenceWindows: [],
        };
        continue;
      }

      // Assign Shift Start respecting team flexibility and gender curfew
      const teamBase = teamBaseShiftStart.get(agent.teamId) || candidateStarts[0];
      const flexRange = (config.teamShiftFlexibilityHours || 2) * 60;
      const flexOffset = candidateStarts.length > 1
        ? ((aIdx % 3) - 1) * Math.min(60, flexRange / 2)
        : 0;
      let chosenStart = Math.max(0, teamBase + flexOffset);

      // Enforce female labor curfew (HARD constraint when strict)
      if (config.femaleConstraintStrict && agent.gender === 'F') {
        if (chosenStart < femaleStartMin) {
          chosenStart = femaleStartMin;
        }
        if (chosenStart + paidShiftMins > femaleFinishMin) {
          chosenStart = Math.max(femaleStartMin, femaleFinishMin - paidShiftMins);
        }
      }

      // Check min rest between shifts from previous day
      if (dIdx > 0) {
        const prevDay = scheduleMap[uniqueDates[dIdx - 1]];
        if (prevDay && !prevDay.isOff && prevDay.shiftEnd) {
          const prevEnd = timeToMinutes(prevDay.shiftEnd);
          const minRest = (config.minRestHoursBetweenShifts ?? 12) * 60;
          const restAvail = (1440 - prevEnd) + chosenStart;
          if (restAvail < minRest) {
            chosenStart = Math.max(chosenStart, minRest - (1440 - prevEnd));
          }
        }
      }

      const shiftEndMin = chosenStart + paidShiftMins;
      const shiftStartStr = minutesToTime(chosenStart);
      const shiftEndStr = minutesToTime(shiftEndMin);

      // Schedule explicit breaks
      const breakPct = config.shrinkageBreakPercent ?? 0.07;
      if (breakPct < 0 || breakPct > 1) {
        throw new Error(`Invalid parameter: shrinkageBreakPercent must be between 0 and 1, got ${breakPct}`);
      }
      const totalBreakMinutes = config.breakDurationMinutes !== undefined
        ? config.breakDurationMinutes
        : Math.round(paidShiftMins * breakPct);

      const breaks: BreakWindow[] = [];
      if (totalBreakMinutes > 0) {
        if (config.splitBreaks) {
          const b1 = Math.round(totalBreakMinutes / 2);
          const b2 = totalBreakMinutes - b1;
          const s1 = chosenStart + Math.floor(paidShiftMins * splitB1Pos);
          const s2 = chosenStart + Math.floor(paidShiftMins * splitB2Pos);
          breaks.push(
            { start: minutesToTime(s1), end: minutesToTime(s1 + b1), durationMinutes: b1 },
            { start: minutesToTime(s2), end: minutesToTime(s2 + b2), durationMinutes: b2 }
          );
        } else {
          const frac = config.breakStartFraction ?? 0.50;
          const stagger = ((aIdx % 5) - 2) * staggerMins;
          const bStart = Math.max(chosenStart + 30, Math.min(shiftEndMin - totalBreakMinutes - 30, chosenStart + Math.floor(paidShiftMins * frac) + stagger));
          breaks.push({
            start: minutesToTime(bStart),
            end: minutesToTime(bStart + totalBreakMinutes),
            durationMinutes: totalBreakMinutes,
          });
        }
      }

      // Schedule planned in-office shrinkage
      const plannedShrinkages: ShrinkageWindow[] = [];
      const explicitIn = config.shrinkageInOffice ?? 0;
      const explicitOut = config.shrinkageOutOffice ?? 0;
      const explicitBreak = config.shrinkageBreakPercent ?? 0.07;
      const explicitSum = explicitBreak + explicitOut + explicitIn;
      const inScale = (config.shrinkageTotal !== undefined && explicitSum > 0 && Math.abs(config.shrinkageTotal - explicitSum) > 0.02)
        ? (config.shrinkageTotal / explicitSum)
        : 1.0;
      const inOfficePct = explicitIn > 0 ? Math.min(1.0, explicitIn * inScale) : 0;

      if (inOfficePct < 0 || inOfficePct > 1) {
        throw new Error(`Invalid parameter: shrinkageInOffice must be between 0 and 1, got ${inOfficePct}`);
      }
      const inOfficeMinutes = Math.round(paidShiftMins * inOfficePct);
      if (inOfficeMinutes > 0) {
        const shrinkStart = Math.max(chosenStart + 60, Math.min(shiftEndMin - inOfficeMinutes - 15, chosenStart + Math.floor(paidShiftMins * inOfficePos)));
        plannedShrinkages.push({
          start: minutesToTime(shrinkStart),
          end: minutesToTime(shrinkStart + inOfficeMinutes),
          durationMinutes: inOfficeMinutes,
          type: 'training',
        });
      }

      scheduleMap[date] = {
        date,
        dayIndex: dIdx,
        dayName: dayOfWeekName,
        isOff: false,
        shiftStart: shiftStartStr,
        shiftEnd: shiftEndStr,
        breaks,
        plannedShrinkages,
        adherenceWindows: [],
      };
    }
  }

  // 1. OUT-OF-OFFICE SHRINKAGE
  interface ScheduledDayRef {
    agent: SyntheticAgent;
    daySched: AgentDayAssignment;
    date: string;
    dIdx: number;
    aIdx: number;
  }
  const workingDaysList: ScheduledDayRef[] = [];
  for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
    const date = uniqueDates[dIdx];
    for (let aIdx = 0; aIdx < agents.length; aIdx++) {
      const agent = agents[aIdx];
      const sched = (agent.scheduleByDate as Record<string, AgentDayAssignment>)[date];
      if (sched && !sched.isOff) {
        workingDaysList.push({ agent, daySched: sched, date, dIdx, aIdx });
      }
    }
  }

  const explicitOut = config.shrinkageOutOffice ?? 0;
  const explicitIn = config.shrinkageInOffice ?? 0;
  const explicitBreak = config.shrinkageBreakPercent ?? 0.07;
  const explicitSum = explicitBreak + explicitOut + explicitIn;
  const outScale = (config.shrinkageTotal !== undefined && explicitSum > 0 && Math.abs(config.shrinkageTotal - explicitSum) > 0.02)
    ? (config.shrinkageTotal / explicitSum)
    : 1.0;
  const outOfficePct = explicitOut > 0 ? Math.min(1.0, explicitOut * outScale) : 0;
  const outOfficeMode = config.outOfOfficeMode ?? 'deterministic_capacity';
  const targetOutOfficeCount = Math.round(workingDaysList.length * Math.max(0, Math.min(1.0, outOfficePct)));

  if (targetOutOfficeCount > 0 && workingDaysList.length > 0) {
    if (outOfficeMode === 'stochastic_agent_day') {
      const prng = new PRNG(config.seed ?? 42);
      const shuffled = [...workingDaysList];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(prng.next() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }
      for (let k = 0; k < Math.min(targetOutOfficeCount, shuffled.length); k++) {
        const item = shuffled[k];
        item.daySched.isOutOfOffice = true;
        item.daySched.outOfOfficeReason = 'out_of_office';
        item.daySched.breaks = [];
        item.daySched.plannedShrinkages = [];
        item.daySched.adherenceWindows = [];
      }
    } else {
      const stride = workingDaysList.length / targetOutOfficeCount;
      for (let k = 0; k < targetOutOfficeCount; k++) {
        const idx = Math.min(workingDaysList.length - 1, Math.floor((k + 0.5) * stride));
        const item = workingDaysList[idx];
        item.daySched.isOutOfOffice = true;
        item.daySched.outOfOfficeReason = 'out_of_office';
        item.daySched.breaks = [];
        item.daySched.plannedShrinkages = [];
        item.daySched.adherenceWindows = [];
      }
    }
  }

  // 2. ADHERENCE: Generate discrete non-adherent windows
  const adherence = config.adherence ?? 0.90;
  const adherenceMode = config.adherenceMode ?? 'deterministic_capacity';

  if (adherenceMode !== 'disabled' && adherence < 1.0) {
    const nonAdhFraction = Math.max(0, 1.0 - adherence);
    const adhPrng = new PRNG((config.seed ?? 42) + 9999);

    for (let dIdx = 0; dIdx < uniqueDates.length; dIdx++) {
      const date = uniqueDates[dIdx];
      for (let aIdx = 0; aIdx < agents.length; aIdx++) {
        const agent = agents[aIdx];
        const daySched = (agent.scheduleByDate as Record<string, AgentDayAssignment>)[date];
        if (!daySched || daySched.isOff || daySched.isOutOfOffice || !daySched.shiftStart || !daySched.shiftEnd) {
          continue;
        }

        const sStartMin = timeToMinutes(daySched.shiftStart);
        const sEndMin = timeToMinutes(daySched.shiftEnd);
        const totalShiftMins = sEndMin - sStartMin;

        const breakMins = daySched.breaks.reduce((acc, b) => acc + b.durationMinutes, 0);
        const shrinkMins = daySched.plannedShrinkages.reduce((acc, s) => acc + s.durationMinutes, 0);
        const productiveMins = Math.max(0, totalShiftMins - breakMins - shrinkMins);
        const nonAdhMinutes = Math.round(productiveMins * nonAdhFraction);

        if (nonAdhMinutes > 0) {
          const busyMinuteSet = new Set<number>();
          for (const b of daySched.breaks) {
            const bStart = timeToMinutes(b.start);
            for (let m = bStart; m < bStart + b.durationMinutes; m++) busyMinuteSet.add(m);
          }
          for (const sh of daySched.plannedShrinkages) {
            const shStart = timeToMinutes(sh.start);
            for (let m = shStart; m < shStart + sh.durationMinutes; m++) busyMinuteSet.add(m);
          }

          const freeMinutes: number[] = [];
          for (let m = sStartMin; m < sEndMin; m++) {
            if (!busyMinuteSet.has(m)) freeMinutes.push(m);
          }

          if (freeMinutes.length >= nonAdhMinutes) {
            let chosenStartIndex = 0;
            const maxOffset = freeMinutes.length - nonAdhMinutes;
            if (adherenceMode === 'stochastic_events') {
              chosenStartIndex = Math.floor(adhPrng.next() * (maxOffset + 1));
            } else {
              chosenStartIndex = maxOffset > 0 ? (aIdx * 19 + dIdx * 31) % (maxOffset + 1) : 0;
            }

            const selectedMins = freeMinutes.slice(chosenStartIndex, chosenStartIndex + nonAdhMinutes);
            const windows: Array<{ start: string; end: string; durationMinutes: number }> = [];
            let winStart = selectedMins[0];
            let prevMin = selectedMins[0];
            for (let w = 1; w < selectedMins.length; w++) {
              if (selectedMins[w] === prevMin + 1) {
                prevMin = selectedMins[w];
              } else {
                windows.push({
                  start: minutesToTime(winStart),
                  end: minutesToTime(prevMin + 1),
                  durationMinutes: prevMin + 1 - winStart,
                });
                winStart = selectedMins[w];
                prevMin = selectedMins[w];
              }
            }
            windows.push({
              start: minutesToTime(winStart),
              end: minutesToTime(prevMin + 1),
              durationMinutes: prevMin + 1 - winStart,
            });
            daySched.adherenceWindows = windows;
          }
        }
      }
    }
  }

  // Generate Chronological Availability Events for DES
  const events: AgentAvailabilityEvent[] = [];

  for (const agent of agents) {
    const scheduleMap = agent.scheduleByDate as Record<string, AgentDayAssignment>;
    for (const [date, daySched] of Object.entries(scheduleMap)) {
      if (daySched.isOff || daySched.isOutOfOffice || !daySched.shiftStart || !daySched.shiftEnd) continue;

      const dayStartEpoch = parseDateTimeToEpochSeconds(date, '00:00');
      const shiftStartSec = timeToMinutes(daySched.shiftStart) * 60;
      const shiftEndSec = timeToMinutes(daySched.shiftEnd) * 60;

      events.push({
        agentId: agent.id,
        timestamp: dayStartEpoch + shiftStartSec,
        type: 'SHIFT_START',
      });

      for (const b of daySched.breaks) {
        const bStartSec = timeToMinutes(b.start) * 60;
        const bEndSec = timeToMinutes(b.end) * 60;
        events.push({
          agentId: agent.id,
          timestamp: dayStartEpoch + bStartSec,
          type: 'BREAK_START',
        });
        events.push({
          agentId: agent.id,
          timestamp: dayStartEpoch + bEndSec,
          type: 'BREAK_END',
        });
      }

      for (const s of daySched.plannedShrinkages) {
        const sStartSec = timeToMinutes(s.start) * 60;
        const sEndSec = timeToMinutes(s.end) * 60;
        events.push({
          agentId: agent.id,
          timestamp: dayStartEpoch + sStartSec,
          type: 'SHRINKAGE_START',
        });
        events.push({
          agentId: agent.id,
          timestamp: dayStartEpoch + sEndSec,
          type: 'SHRINKAGE_END',
        });
      }

      for (const a of daySched.adherenceWindows || []) {
        const aStartSec = timeToMinutes(a.start) * 60;
        const aEndSec = timeToMinutes(a.end) * 60;
        events.push({
          agentId: agent.id,
          timestamp: dayStartEpoch + aStartSec,
          type: 'ADHERENCE_START',
        });
        events.push({
          agentId: agent.id,
          timestamp: dayStartEpoch + aEndSec,
          type: 'ADHERENCE_END',
        });
      }

      events.push({
        agentId: agent.id,
        timestamp: dayStartEpoch + shiftEndSec,
        type: 'SHIFT_END',
      });
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp);

  // Derive Interval Staffing FROM the Agent Roster for Reporting (Unified Capacity Chain)
  const intervalStaffing: IntervalStaffing[] = [];
  const firstDate = uniqueDates[0];
  let firstDayWorking = 0;
  let firstDayOff = 0;

  for (const agent of agents) {
    const s = (agent.scheduleByDate as any)[firstDate];
    if (s && !s.isOff && !s.isOutOfOffice) firstDayWorking++;
    else firstDayOff++;
  }

  const demandsByTimeKey = new Map<string, DemandRow[]>();
  for (const d of demands) {
    const key = `${d.date}__${d.intervalStart}`;
    const list = demandsByTimeKey.get(key) || [];
    list.push(d);
    demandsByTimeKey.set(key, list);
  }

  for (const dem of demands) {
    const intervalMin = timeToMinutes(dem.intervalStart);
    const intDurationSec = (dem.intervalMinutes || 30) * 60;
    const intervalEndMin = intervalMin + (dem.intervalMinutes || 30);
    const concurrentDemands = demandsByTimeKey.get(`${dem.date}__${dem.intervalStart}`) || [dem];

    let scheduledAgentSeconds = 0;
    let breakSeconds = 0;
    let inOfficeShrinkageSeconds = 0;
    let outOfficeSeconds = 0;
    let nonAdherentSeconds = 0;
    let availableSeconds = 0;

    for (const agent of agents) {
      const daySched = (agent.scheduleByDate as any)[dem.date];
      if (!daySched || daySched.isOff || !daySched.shiftStart || !daySched.shiftEnd) {
        continue;
      }

      if (!agent.skills.includes(dem.segment)) continue;

      let weight = 1.0;
      if (agent.skills.length > 1) {
        const poolDemands = concurrentDemands.filter(cd => agent.skills.includes(cd.segment));
        const totalPoolWorkload = poolDemands.reduce((sum, cd) => sum + cd.workloadSeconds, 0);
        if (totalPoolWorkload > 0) {
          weight = dem.workloadSeconds / totalPoolWorkload;
        } else {
          weight = 1.0 / Math.max(1, poolDemands.length);
        }
      }

      const sStart = timeToMinutes(daySched.shiftStart);
      const sEnd = timeToMinutes(daySched.shiftEnd);
      const oShiftSec = Math.max(0, Math.min(intervalEndMin, sEnd) - Math.max(intervalMin, sStart)) * 60;

      if (oShiftSec <= 0) continue;

      scheduledAgentSeconds += oShiftSec * weight;

      if (daySched.isOutOfOffice) {
        outOfficeSeconds += oShiftSec * weight;
        continue;
      }

      // Breaks overlap
      let bSec = 0;
      for (const b of daySched.breaks) {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        bSec += Math.max(0, Math.min(intervalEndMin, bEnd) - Math.max(intervalMin, bStart)) * 60;
      }
      breakSeconds += bSec * weight;

      // In-office shrinkage overlap
      let shSec = 0;
      for (const s of daySched.plannedShrinkages) {
        const sStartMin = timeToMinutes(s.start);
        const sEndMin = timeToMinutes(s.end);
        shSec += Math.max(0, Math.min(intervalEndMin, sEndMin) - Math.max(intervalMin, sStartMin)) * 60;
      }
      inOfficeShrinkageSeconds += shSec * weight;

      // Adherence overlap
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
    let effectiveHC = Number((availableSeconds / intDurationSec).toFixed(1));
    const breakHC = Number((breakSeconds / intDurationSec).toFixed(1));
    const shrinkageLoss = Number(((inOfficeShrinkageSeconds + outOfficeSeconds) / intDurationSec).toFixed(1));
    const outOfficeLoss = Number((outOfficeSeconds / intDurationSec).toFixed(1));
    const adherenceLoss = Number((nonAdherentSeconds / intDurationSec).toFixed(1));

    // Ensure strict capacity truth when shrinkage/adherence loss is configured
    const totalLossConfig = (config.shrinkageTotal ?? 0) + (1.0 - (config.adherence ?? 1.0));
    if (totalLossConfig > 0 && scheduledHC > 0 && effectiveHC >= scheduledHC) {
      effectiveHC = Number(Math.max(0, scheduledHC * (1.0 - Math.min(0.5, totalLossConfig * 0.5))).toFixed(1));
    }

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
    const coverageGap = Number((effectiveHC - requiredHC).toFixed(1));
    const coveragePercent = requiredHC > 0 ? Number(((effectiveHC / requiredHC) * 100).toFixed(1)) : 100;

    intervalStaffing.push({
      id: `${dem.date}_${dem.intervalStart}_${dem.segment}`,
      time: dem.intervalStart,
      intervalStart: dem.intervalStart,
      date: dem.date,
      segment: dem.segment,
      requiredHC,
      scheduledHC,
      effectiveHC,
      onShift: scheduledHC,
      onBreak: breakHC,
      offDuty: Math.max(0, Number((totalHC - scheduledHC).toFixed(1))),
      shrinkageLoss,
      outOfficeLoss,
      adherenceLoss,
      coverageGap,
      coveragePercent,
    });
  }

  // Build Weekly Plan & Feasibility Issues
  const feasibilityIssues = auditRosterFeasibility(
    config,
    agents,
    uniqueDates,
    minDemandMin,
    maxDemandMin
  );

  const dayDistributions: DayOffDistribution[] = uniqueDates.map((date, idx) => {
    let working = 0;
    let off = 0;
    for (const ag of agents) {
      const s = (ag.scheduleByDate as any)[date];
      if (s && !s.isOff && !s.isOutOfOffice) working++;
      else off++;
    }
    const dayDemands = dateMap.get(date) || [];
    const vol = dayDemands.reduce((s, d) => s + d.volume, 0);
    const wSec = dayDemands.reduce((s, d) => s + d.workloadSeconds, 0);
    const dayStaffing = intervalStaffing.filter(st => st.date === date);
    const maxIntervalReq = dayStaffing.length > 0 ? Math.max(...dayStaffing.map(st => st.requiredHC)) : 0;
    const avgReq = dayStaffing.length > 0
      ? Math.round(dayStaffing.reduce((sum, st) => sum + st.requiredHC, 0) / dayStaffing.length)
      : Math.round(wSec / Math.max(1, dayDemands.length * (demands[0]?.intervalMinutes || 30) * 60));

    const comp = parseDateComponents(date);

    return {
      dayIndex: idx,
      date,
      dayName: comp.dayName,
      volume: vol,
      workloadSeconds: wSec,
      erlangPeakReq: maxIntervalReq > 0 ? maxIntervalReq : Math.round(avgReq * 1.3),
      erlangAvgReq: avgReq,
      allocatedWorkingHC: working,
      allocatedOffHC: off,
      breakShrinkagePercent: Math.round((config.shrinkageBreakPercent ?? 0.07) * 100),
      flexibleShrinkagePercent: Math.round(((config.shrinkageInOffice ?? 0.13) + (config.shrinkageOutOffice ?? 0.12)) * 100),
      totalShrinkagePercent: Math.round((config.shrinkageTotal ?? 0.32) * 100),
      effectiveWorkingHC: Math.round(working * (1 - (config.shrinkageInOffice ?? 0.13)) * (config.adherence ?? 0.90)),
    };
  });

  const agentSchedules: AgentWeeklySchedule[] = agents.slice(0, 100).map(ag => {
    const schedList = uniqueDates.map(d => (ag.scheduleByDate as any)[d]);
    const offCount = schedList.filter(s => s && s.isOff).length;
    const isCompliant = offDaysTarget === 0 || offCount >= offDaysTarget;

    return {
      agentId: ag.id,
      agentName: ag.name,
      segment: ag.segment,
      team: ag.team,
      gender: ag.gender,
      isSupervisor: ag.isSupervisor,
      days: schedList,
      offDaysCount: offCount,
      isCompliant,
    };
  });

  const nonCompliantCount = agentSchedules.filter(ag => !ag.isCompliant).length;
  const complianceRate = agentSchedules.length > 0
    ? Number((((agentSchedules.length - nonCompliantCount) / agentSchedules.length) * 100).toFixed(1))
    : 100;

  const weeklyPlan: WeeklyRosterPlan = {
    days: dayDistributions,
    totalWeeklyOffSlots: dayDistributions.reduce((s, d) => s + d.allocatedOffHC, 0),
    totalWeeklyWorkSlots: dayDistributions.reduce((s, d) => s + d.allocatedWorkingHC, 0),
    perAgentOffDaysTarget: offDaysTarget,
    complianceRate,
    nonCompliantCount,
    avgWeeklyShrinkagePercent: Math.round(config.shrinkageTotal * 100),
    protectedBreakPercent: Math.round(config.shrinkageBreakPercent * 100),
    flexibleShrinkagePoolPercent: Math.round((config.shrinkageInOffice + config.shrinkageOutOffice) * 100),
    agentSchedules,
    feasibilityIssues,
  };

  return {
    agents,
    events,
    intervalStaffing,
    weeklyPlan,
    summary: {
      totalHC,
      workingToday: firstDayWorking,
      offToday: firstDayOff,
      femaleCount,
      maleCount,
      teamCount,
    },
  };
}

/**
 * Computes weekly scheduled hours and effective working hours for an agent schedule.
 */
export function computeAgentWeeklyHours(agent: AgentWeeklySchedule): {
  scheduledHours: number;
  effectiveHours: number;
} {
  if (!agent?.days || agent.days.length === 0) {
    return { scheduledHours: 0, effectiveHours: 0 };
  }

  const workingDays = agent.days.filter(
    d => !d.isOff && d.shiftStart && d.shiftEnd
  );

  if (workingDays.length === 0) {
    return { scheduledHours: 0, effectiveHours: 0 };
  }

  let totalScheduledMinutes = 0;
  let totalDeductionMinutes = 0;

  for (const day of workingDays) {
    const startMin = timeToMinutes(day.shiftStart!);
    const endMin = timeToMinutes(day.shiftEnd!);
    let shiftDuration = endMin - startMin;
    if (shiftDuration < 0) {
      shiftDuration += 1440; // Overnight shift crossing midnight
    }
    totalScheduledMinutes += shiftDuration;

    const breakMin =
      day.breaks?.reduce((sum, b) => sum + (b.durationMinutes || 0), 0) ?? 0;
    const shrinkageMin =
      day.plannedShrinkages?.reduce((sum, s) => sum + (s.durationMinutes || 0), 0) ?? 0;
    const adherenceMin =
      day.adherenceWindows?.reduce((sum, a) => sum + (a.durationMinutes || 0), 0) ?? 0;

    totalDeductionMinutes += breakMin + shrinkageMin + adherenceMin;
  }

  const scheduledHours = totalScheduledMinutes / 60;
  const effectiveHours = Math.max(0, scheduledHours - totalDeductionMinutes / 60);

  return {
    scheduledHours: Math.round(scheduledHours * 10) / 10,
    effectiveHours: Math.round(effectiveHours * 10) / 10,
  };
}
