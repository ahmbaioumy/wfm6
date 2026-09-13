/**
 * Erlang Benchmark Calculations
 * Standards-compliant Erlang B, Erlang C, and Erlang A models.
 * Pure benchmark; discrete event simulation remains the final operational authority.
 */

import { ErlangModelType } from '../types';

export interface ErlangMetrics {
  sla: number; // 0.0 to 1.0 (e.g. 0.90 = 90%)
  asa: number; // in seconds
  occupancy: number; // 0.0 to 1.0 (e.g. 0.85 = 85%)
  abandonProb: number; // 0.0 to 1.0 (for Erlang A / B)
  probWait: number; // Probability of delay P(W > 0)
}

/**
 * Erlang B Model (M/M/c/c Loss System)
 * Computes blocking probability when no queueing is permitted.
 */
export function calculateErlangB(servers: number, traffic: number): number {
  if (traffic <= 0) return 0.0;
  if (servers <= 0) return 1.0;

  // Stable iterative calculation: B(c, A) = (A * B(c-1, A)) / (c + A * B(c-1, A))
  let b = 1.0;
  for (let c = 1; c <= servers; c++) {
    b = (traffic * b) / (c + traffic * b);
  }
  return Math.max(0.0, Math.min(1.0, b));
}

/**
 * Erlang C Model (M/M/c Infinite Queue System)
 * Standard contact center benchmark for SLA, ASA, and Occupancy.
 */
export function calculateErlangC(
  servers: number,
  traffic: number,
  ahtSeconds: number,
  targetSlaSeconds: number = 20
): ErlangMetrics {
  if (traffic <= 0) {
    return { sla: 1.0, asa: 0.0, occupancy: 0.0, abandonProb: 0.0, probWait: 0.0 };
  }

  const c = Math.max(1, Math.floor(servers));
  const occupancy = traffic / c;

  // If traffic >= servers, queue is unstable in infinite queue model
  if (occupancy >= 1.0) {
    return {
      sla: 0.0,
      asa: 9999.0,
      occupancy: 1.0,
      abandonProb: 0.0,
      probWait: 1.0,
    };
  }

  // Stable calculation of P(Wait > 0) = Erlang C formula
  // C(c, A) = (A^c / c!) * (c / (c - A)) / [ Sum_{k=0}^{c-1} A^k / k! + (A^c / c!) * (c / (c - A)) ]
  // We compute using ratio term-by-term to prevent floating point overflow:
  let sumTerm = 1.0;
  let currentTerm = 1.0;
  for (let k = 1; k < c; k++) {
    currentTerm = (currentTerm * traffic) / k;
    sumTerm += currentTerm;
  }
  const lastTerm = (currentTerm * traffic) / c;
  const queueMultiplier = c / (c - traffic);
  const pwNumerator = lastTerm * queueMultiplier;
  const pwDenominator = sumTerm + pwNumerator;
  const probWait = pwDenominator > 0 ? Math.min(1.0, Math.max(0.0, pwNumerator / pwDenominator)) : 0.0;

  // ASA = P(W > 0) * (AHT / (c - A))
  const asa = (probWait * ahtSeconds) / (c - traffic);

  // SLA: P(W <= t) = 1 - P(W > 0) * exp(-(c - A) * (t / AHT))
  const exponent = -((c - traffic) * (targetSlaSeconds / ahtSeconds));
  const sla = Math.max(0.0, Math.min(1.0, 1.0 - probWait * Math.exp(exponent)));

  return {
    sla,
    asa,
    occupancy,
    abandonProb: 0.0,
    probWait,
  };
}

/**
 * Erlang A Model (Palm M/M/c + M Queue with Customer Impatience / Reneging)
 * Mathematically derived from Palm (1943) birth-death balance equations without heuristic fudge factors.
 * Note: Erlang C is standard theoretical benchmark; DES is authoritative expected KPI engine.
 */
export function calculateErlangA(
  servers: number,
  traffic: number,
  ahtSeconds: number,
  patienceSeconds: number = 120,
  targetSlaSeconds: number = 20
): ErlangMetrics {
  if (traffic <= 0) {
    return { sla: 1.0, asa: 0.0, occupancy: 0.0, abandonProb: 0.0, probWait: 0.0 };
  }

  const c = Math.max(1, Math.floor(servers));
  const mu = 1.0 / Math.max(1, ahtSeconds);
  const lambda = traffic * mu;
  const theta = 1.0 / Math.max(1, patienceSeconds);

  // Numerical truncation for birth-death Markov chain
  const maxQueue = 150;
  const p = new Float64Array(c + maxQueue + 1);
  p[0] = 1.0;

  // States 1..c: p_k = p_{k-1} * lambda / (k * mu)
  for (let k = 1; k <= c; k++) {
    p[k] = p[k - 1] * (lambda / (k * mu));
  }

  // States c+1..c+maxQueue: p_{c+j} = p_{c+j-1} * lambda / (c * mu + j * theta)
  for (let j = 1; j <= maxQueue; j++) {
    p[c + j] = p[c + j - 1] * (lambda / (c * mu + j * theta));
  }

  // Normalize state probabilities
  let totalSum = 0;
  for (let i = 0; i < p.length; i++) totalSum += p[i];
  if (totalSum > 0) {
    for (let i = 0; i < p.length; i++) p[i] /= totalSum;
  }

  // Abandonment rate = Sum_{j=1}^{maxQueue} (j * theta * p_{c+j}) / lambda
  let abandonRate = 0;
  let probWait = 0;
  for (let j = 1; j <= maxQueue; j++) {
    const prob = p[c + j];
    abandonRate += (j * theta * prob) / Math.max(0.0001, lambda);
    probWait += prob;
  }

  // Probability of immediate answer (no wait)
  let probNoWait = 0;
  for (let k = 0; k < c; k++) probNoWait += p[k];

  // Palm formula for answered calls within targetSlaSeconds:
  let probAnsweredWithinTarget = probNoWait;
  let totalAnsweredProb = probNoWait;
  let waitingTimeSum = 0;

  for (let j = 0; j < maxQueue; j++) {
    const pState = p[c + j];
    const totalExitRate = c * mu + (j + 1) * theta;
    const probServeBeforeAbandon = (c * mu) / totalExitRate;
    const condAnswered = pState * probServeBeforeAbandon;
    totalAnsweredProb += condAnswered;

    // Time to transition to service: Exponential with rate totalExitRate
    const probTimeWithinTarget = 1.0 - Math.exp(-totalExitRate * targetSlaSeconds);
    probAnsweredWithinTarget += condAnswered * probTimeWithinTarget;

    // Mean wait for those answered: 1 / totalExitRate
    waitingTimeSum += condAnswered * (1.0 / totalExitRate);
  }

  const finalSla = totalAnsweredProb > 0
    ? Math.min(1.0, probAnsweredWithinTarget / totalAnsweredProb)
    : 1.0;
  const finalAsa = totalAnsweredProb > 0
    ? waitingTimeSum / totalAnsweredProb
    : 0.0;
  const occupancy = Math.min(1.0, (lambda * Math.max(0, 1 - abandonRate)) / (c * mu));

  return {
    sla: finalSla,
    asa: finalAsa,
    occupancy,
    abandonProb: Math.max(0.0, Math.min(1.0, abandonRate)),
    probWait,
  };
}

/**
 * Solves for the required agents needed to meet target SLA and max occupancy benchmark.
 */
export function solveRequiredStaffing(
  traffic: number,
  ahtSeconds: number,
  targetSla: number = 0.90,
  targetSlaSeconds: number = 20,
  maxOccupancy: number = 0.85,
  minCoverage: number = 1,
  model: ErlangModelType = 'erlang_c',
  patienceSeconds: number = 120
): number {
  if (traffic <= 0) return Math.max(0, minCoverage);

  if (model === 'erlang_b') {
    // For Erlang B, blocking prob must be <= (1 - targetSla)
    const targetBlocking = Math.max(0.001, 1 - targetSla);
    let c = Math.max(minCoverage, Math.ceil(traffic));
    for (let iter = 0; iter < 500; iter++) {
      const b = calculateErlangB(c, traffic);
      if (b <= targetBlocking) return c;
      c++;
    }
    return c;
  }

  // Theoretical lower bound for queueing systems
  let c = Math.max(minCoverage, Math.ceil(traffic / maxOccupancy), Math.ceil(traffic) + 1);

  for (let iter = 0; iter < 500; iter++) {
    const metrics = model === 'erlang_a'
      ? calculateErlangA(c, traffic, ahtSeconds, patienceSeconds, targetSlaSeconds)
      : calculateErlangC(c, traffic, ahtSeconds, targetSlaSeconds);

    if (metrics.sla >= targetSla && metrics.occupancy <= maxOccupancy) {
      return c;
    }
    c++;
  }

  return c;
}
