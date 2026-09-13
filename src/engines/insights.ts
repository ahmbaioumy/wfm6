/**
 * Simulation Insights and Reverse Mode Optimization Engine
 */

import {
  IntervalResult,
  SimulationInsight,
  WorkforceConfig,
  DemandRow,
} from '../types';
import { generateRoster } from './roster';
import { runSingleSimulation, PRNG } from './des';
import { solveRequiredStaffing } from './erlang';

/**
 * Analyzes interval results and generates actionable WFM recommendations
 */
export function generateInsights(
  results: IntervalResult[],
  config: WorkforceConfig
): SimulationInsight[] {
  const insights: SimulationInsight[] = [];

  // Find intervals with severe SLA failure or high occupancy
  const deficitIntervals = results.filter(r => r.gap < 0 && r.slaPercent < config.slaPercentTarget);
  const surplusIntervals = results.filter(r => r.gap > 2 && r.occupancyPercent < 70);

  if (deficitIntervals.length > 0) {
    // Find peak risk cluster
    let worstInterval = deficitIntervals[0];
    for (const d of deficitIntervals) {
      if (d.slaPercent < worstInterval.slaPercent) {
        worstInterval = d;
      }
    }

    // Check if there is surplus elsewhere that can be moved
    if (surplusIntervals.length >= 2) {
      const surplusTime = surplusIntervals[0].interval;
      const deficitTime = worstInterval.interval;
      const shiftMoveCount = Math.min(5, Math.max(2, Math.abs(worstInterval.gap)));

      insights.push({
        id: 'shift_rebalance',
        type: 'understaffing',
        severity: 'warning',
        title: `Peak Service Risk Identified at ${deficitTime}`,
        description: `Interval ${deficitTime} suffers SLA of ${worstInterval.slaPercent}% (target ${config.slaPercentTarget}%) and occupancy of ${worstInterval.occupancyPercent}% with an effective staffing deficit of ${Math.abs(worstInterval.gap)} agents. Meanwhile, interval ${surplusTime} has surplus staffing with ${surplusIntervals[0].occupancyPercent}% occupancy.`,
        recommendation: `Move ${shiftMoveCount} shift start times from ${surplusTime} to ${deficitTime}.`,
        impact: `Reduces queue spikes at ${deficitTime} and lifts interval SLA by an estimated +12% to +18% with 0 additional headcount.`,
      });
    } else {
      insights.push({
        id: 'understaffing_risk',
        type: 'understaffing',
        severity: 'critical',
        title: `Systemic Headcount Deficit at Peak Hours (${worstInterval.interval})`,
        description: `Effective available staffing (${worstInterval.effectiveHC}) falls significantly below Erlang requirement (${worstInterval.erlangReqHC}). Peak queue reaches ${worstInterval.maxQueue} contacts with max wait of ${worstInterval.maxWaitSeconds}s.`,
        recommendation: `Increase available headcount by ${Math.ceil(Math.abs(worstInterval.gap) / Math.max(0.1, 1 - config.shrinkageTotal))} agents or utilize reverse mode to find optimal rosterable HC.`,
        impact: `Eliminates peak backlog and restores SLA above ${config.slaPercentTarget}%.`,
      });
    }
  } else {
    insights.push({
      id: 'sla_healthy',
      type: 'healthy',
      severity: 'success',
      title: `Roster Meets All Service Level Targets`,
      description: `All scheduled intervals achieve or exceed the ${config.slaPercentTarget}% SLA target under the current arrival model and patience threshold.`,
      recommendation: `Current workforce configuration provides stable coverage. Consider tuning shift start steps or testing higher volume stress scenarios.`,
      impact: `Maintains robust customer experience and controlled agent occupancy.`,
    });
  }

  // Shrinkage & Adherence Insight
  const totalLossPct = Math.round((config.shrinkageTotal + (1 - config.adherence)) * 100);
  if (totalLossPct > 35) {
    insights.push({
      id: 'shrinkage_adherence_leak',
      severity: 'info',
      title: `High Staffing Friction (${totalLossPct}% Non-Productive Time)`,
      description: `Combined shrinkage (${Math.round(config.shrinkageTotal * 100)}%) and non-adherence (${Math.round((1 - config.adherence) * 100)}%) reduce gross scheduled headcount from ${config.totalHC} to an average effective availability of ~${Math.round(config.totalHC * (1 - config.shrinkageTotal) * config.adherence)} agents.`,
      recommendation: `Audit in-office shrinkage activities (meetings, offline coaching) during peak demand hours.`,
      impact: `A 3% improvement in adherence recovers approximately ${Math.round(config.totalHC * 0.03)} agent-equivalents per interval.`,
    });
  }

  // Check customer patience / abandonment
  const highAbandon = results.filter(r => r.abandonPercent > 5);
  if (highAbandon.length > 0) {
    const peakAbn = highAbandon.reduce((max, r) => (r.abandonPercent > max.abandonPercent ? r : max), highAbandon[0]);
    insights.push({
      id: 'customer_abandonment',
      severity: 'warning',
      title: `High Customer Abandonment (${peakAbn.abandonPercent}% at ${peakAbn.interval})`,
      description: `Customers are waiting beyond average patience (${config.defaultPatienceSeconds}s) during congested intervals, resulting in lost contacts.`,
      recommendation: `Review routing priority or evaluate callback mechanisms to mitigate peak abandonment.`,
      impact: `Prevents repeat re-dials and preserves customer satisfaction.`,
    });
  }

  return insights;
}

/**
 * Reverse Mode: Finds the minimum real rosterable Headcount (HC) required
 * to achieve the target SLA across the horizon using DES simulation.
 */
export function solveReverseModeHC(
  demands: DemandRow[],
  baseConfig: WorkforceConfig,
  targetSlaPct: number,
  onStep?: (testHC: number, achievedSla: number) => void
): {
  requiredHC: number;
  achievedSla: number;
  feasible: boolean;
  iterations: Array<{ hc: number; sla: number }>;
} {
  const intervals = demands.map(d => d.intervalStart);
  const targetSla = (baseConfig.slaPercentTarget || targetSlaPct || 80) / 100;
  const erlangReqs = demands.map(d =>
    solveRequiredStaffing(
      d.trafficErlangs,
      d.ahtSeconds,
      targetSla,
      baseConfig.slaThresholdSeconds || 20,
      (baseConfig.maxOccupancyThreshold || 85) / 100,
      baseConfig.minCoverage || 1
    )
  );

  const workDaysRatio = (baseConfig.workDaysPerWeek ?? 6) / 7;
  const dailyPaid = baseConfig.dailyPaidHours || 8;
  const peakErlang = Math.max(...erlangReqs, 5);
  const sumErlang = erlangReqs.reduce((a, b) => a + b, 0);

  let intHours = (demands[0]?.intervalMinutes || 30) / 60;
  const totalWorkloadHours = sumErlang * intHours;
  const theoreticalMinHC = Math.ceil(totalWorkloadHours / Math.max(1, dailyPaid * workDaysRatio));

  let lowHC = Math.max(5, Math.round(theoreticalMinHC * 0.7));
  let highHC = Math.min(300, Math.max(lowHC + 30, Math.round(Math.max(theoreticalMinHC * 2.2, peakErlang * 3))));
  const hardCapHC = 350;

  const iterations: Array<{ hc: number; sla: number }> = [];

  const evaluateHC = (hc: number): number => {
    const testConfig: WorkforceConfig = {
      ...baseConfig,
      totalHC: hc,
    };
    const roster = generateRoster(testConfig, intervals, erlangReqs, demands);
    const prng = new PRNG(baseConfig.seed || 42);
    const sim = runSingleSimulation(demands, roster.intervalStaffing, testConfig, prng, roster.agents, roster.events);
    const sla = sim.summary.slaPercent;
    iterations.push({ hc, sla });
    if (onStep) onStep(hc, sla);
    return sla;
  };

  // 1. Pre-search verification: confirm highHC can reach targetSlaPct, widen if not
  let highSla = evaluateHC(highHC);
  let widenAttempts = 0;
  while (highSla < targetSlaPct && widenAttempts < 3 && highHC < hardCapHC) {
    widenAttempts++;
    highHC = Math.min(hardCapHC, Math.round(highHC * 1.5));
    highSla = evaluateHC(highHC);
  }

  if (highSla < targetSlaPct) {
    return {
      requiredHC: highHC,
      achievedSla: highSla,
      feasible: false,
      iterations,
    };
  }

  let bestHC = highHC;
  let bestAchievedSla = highSla;

  // 2. Binary search
  for (let iter = 0; iter < 10; iter++) {
    const midHC = Math.round((lowHC + highHC) / 2);
    const sla = evaluateHC(midHC);

    if (sla >= targetSlaPct) {
      bestHC = midHC;
      bestAchievedSla = sla;
      highHC = midHC - 1; // Try lower
    } else {
      lowHC = midHC + 1; // Need more
    }

    if (lowHC > highHC) break;
  }

  // 3. Local verification pass: check bestHC - 1 to handle non-monotonicity noise
  const lowestSaneBound = Math.max(1, Math.round(theoreticalMinHC * 0.5));
  let localChecks = 0;
  while (bestHC - 1 >= lowestSaneBound && localChecks < 5) {
    localChecks++;
    const testCandidate = bestHC - 1;
    const testSla = evaluateHC(testCandidate);
    if (testSla >= targetSlaPct) {
      bestHC = testCandidate;
      bestAchievedSla = testSla;
    } else {
      break;
    }
  }

  return {
    requiredHC: bestHC,
    achievedSla: bestAchievedSla,
    feasible: true,
    iterations,
  };
}

/**
 * Convenience wrapper returning required headcount directly
 */
export function solveHeadcountForTargetSla(
  intervalResults: IntervalResult[],
  baseConfig: WorkforceConfig,
  demands: DemandRow[],
  targetSlaPct: number
): { requiredHC: number; feasible: boolean } {
  const res = solveReverseModeHC(demands, baseConfig, targetSlaPct);
  return { requiredHC: res.requiredHC, feasible: res.feasible };
}
