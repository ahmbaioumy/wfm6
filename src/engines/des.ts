/**
 * Discrete Event Simulation (DES) Engine
 * Multi-Queue, Agent-Centric Discrete Event Simulator
 *
 * Core Principles:
 * - Real chronological timestamp model (not CSV row index).
 * - Simultaneous segment queues at the same timestamp (e.g. Retail and Prestige at 08:00).
 * - Agents are real entities with skills, concurrency, schedules, breaks, shrinkage, shift end.
 * - Dedicated agents cannot handle other segments; shared agents route across eligible queues.
 * - Deterministic event priority at identical timestamps.
 * - Continuous queues carrying over interval boundaries.
 * - Seeded PRNG for perfect reproducibility.
 */

import {
  DemandRow,
  WorkforceConfig,
  IntervalResult,
  AggregationSummary,
  MonteCarloStats,
  IntervalStaffing,
  SyntheticAgent,
  AgentAvailabilityEvent,
  ChannelType,
} from '../types';
import { solveRequiredStaffing, calculateErlangC } from './erlang';
import { parseDateTimeToEpochSeconds } from '../data/sampleDemand';
import { GeneratedRoster } from './roster';

export function getDemandTimestamp(d: DemandRow): number {
  if (typeof d.timestamp === 'number' && !isNaN(d.timestamp)) return d.timestamp;
  if (!d.date) return 0;
  return parseDateTimeToEpochSeconds(d.date, d.intervalStart || '08:00');
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

// Fast Seedable PRNG (Mulberry32)
export class PRNG {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
    if (this.s === 0) this.s = 1337;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  gaussian(mean: number = 0, stdDev: number = 1): number {
    const u1 = Math.max(1e-12, this.next());
    const u2 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  exponential(mean: number): number {
    const u = Math.max(1e-12, this.next());
    return -mean * Math.log(u);
  }

  lognormal(mean: number, cv: number): number {
    const variance = (cv * mean) * (cv * mean);
    const sigma2 = Math.log(1 + variance / (mean * mean));
    const mu = Math.log(mean) - 0.5 * sigma2;
    const sigma = Math.sqrt(sigma2);
    const z = this.gaussian(0, 1);
    return Math.max(1, Math.exp(mu + sigma * z));
  }

  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    if (lambda < 30) {
      const L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= this.next();
      } while (p > L);
      return k - 1;
    }
    const g = Math.round(this.gaussian(lambda, Math.sqrt(lambda)));
    return Math.max(0, g);
  }

  weibull(mean: number, shape: number = 1.5): number {
    const k = Math.max(0.1, shape);
    // Lanczos Gamma approximation for Gamma(1 + 1/k)
    const gamma = (z: number): number => {
      const g = 7;
      const C = [
        0.99999999999980993,
        676.5203681218851,
        -1259.1392167224028,
        771.32342877765313,
        -176.61502916214059,
        12.507343278686905,
        -0.13857109526572012,
        9.9843695780195716e-6,
        1.5056327351493116e-7,
      ];
      if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
      z -= 1;
      let x = C[0];
      for (let i = 1; i < g + 2; i++) {
        x += C[i] / (z + i);
      }
      const t = z + g + 0.5;
      return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
    };

    const scale = mean / gamma(1 + 1 / k);
    const u = Math.max(1e-12, Math.min(1 - 1e-12, this.next()));
    return Math.max(1, scale * Math.pow(-Math.log(1 - u), 1 / k));
  }
}

export interface SimulationContact {
  id: number;
  demandIndex: number;
  segment: string;
  channel: ChannelType;
  arrivalTime: number; // in simulation seconds
  arrivalTimestamp?: number;
  sourceIntervalKey?: string;
  date?: string;
  interval?: string;
  serviceDuration?: number;
  queueId?: string;
  duration: number; // in seconds
  patience: number; // in seconds
  slaThreshold: number;
}

export interface WaitingContact {
  contact: SimulationContact;
  abandonAt: number;
  enqueuedAt: number;
}

export type DesAgentStatus = 'OFF' | 'AVAILABLE' | 'ON_BREAK' | 'SHRINKAGE' | 'UNADHERENT';

export interface DesAgent {
  id: string;
  name: string;
  skills: Set<string>;
  concurrency: number;
  status: DesAgentStatus;
  shiftEnded: boolean;
  activeContacts: Array<{ contact: SimulationContact; finishTime: number }>;
  poolId?: string;
  segment?: string;
  channel?: ChannelType;
  availableSince?: number;
  busySeconds: number;
  availableSeconds: number;
}

export class FIFOQueue<T> {
  private items: T[] = [];
  private head = 0;

  push(item: T): void {
    this.items.push(item);
  }

  peek(): T | undefined {
    return this.head < this.items.length ? this.items[this.head] : undefined;
  }

  shift(): T | undefined {
    if (this.head >= this.items.length) return undefined;
    const item = this.items[this.head];
    this.head++;
    if (this.head > 500 && this.head * 2 > this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }

  size(): number {
    return this.items.length - this.head;
  }

  getItems(): T[] {
    return this.items.slice(this.head);
  }

  filter(predicate: (item: T) => boolean): void {
    const active: T[] = [];
    for (let i = this.head; i < this.items.length; i++) {
      if (predicate(this.items[i])) {
        active.push(this.items[i]);
      }
    }
    this.items = active;
    this.head = 0;
  }

  drain(): T[] {
    const remaining = this.items.slice(this.head);
    this.items = [];
    this.head = 0;
    return remaining;
  }
}

export interface SimulationRunResult {
  intervalResults: IntervalResult[];
  summary: AggregationSummary;
}

/**
 * Executes a single replication of the Discrete Event Simulation
 */
export function runSingleSimulation(
  demands: DemandRow[],
  staffingList: IntervalStaffing[],
  config: WorkforceConfig,
  prngOrAgents?: PRNG | SyntheticAgent[],
  rosterAgentsOrEvents?: SyntheticAgent[] | AgentAvailabilityEvent[],
  rosterEventsOrSeed?: AgentAvailabilityEvent[] | number,
  optionalSeed?: number
): SimulationRunResult {
  const numDemands = demands.length;
  if (numDemands === 0) {
    throw new Error('No demands provided to simulation');
  }

  let prng: PRNG;
  let rosterAgents: SyntheticAgent[] | undefined;
  let rosterEvents: AgentAvailabilityEvent[] | undefined;

  if (prngOrAgents instanceof PRNG) {
    prng = prngOrAgents;
    rosterAgents = rosterAgentsOrEvents as SyntheticAgent[] | undefined;
    rosterEvents = rosterEventsOrSeed as AgentAvailabilityEvent[] | undefined;
  } else {
    rosterAgents = prngOrAgents as SyntheticAgent[] | undefined;
    rosterEvents = rosterAgentsOrEvents as AgentAvailabilityEvent[] | undefined;
    const seed = typeof rosterEventsOrSeed === 'number'
      ? rosterEventsOrSeed
      : (typeof optionalSeed === 'number' ? optionalSeed : (config.seed || 42));
    prng = new PRNG(seed);
  }

  let baseTimestamp = Infinity;
  let horizonEndSec = 0;
  for (const d of demands) {
    const ts = getDemandTimestamp(d);
    if (ts < baseTimestamp) baseTimestamp = ts;
    const durSec = (d.intervalMinutes || 30) * 60;
    if (ts + durSec > horizonEndSec) horizonEndSec = ts + durSec;
  }
  if (!isFinite(baseTimestamp)) baseTimestamp = 0;
  horizonEndSec = horizonEndSec - baseTimestamp;

  // Build lookup map for interval staffing
  const staffingMap = new Map<string, IntervalStaffing>();
  for (const s of staffingList) {
    const key = `${s.date || ''}__${s.time}__${s.segment || ''}`;
    staffingMap.set(key, s);
    // fallback key
    staffingMap.set(`${s.time}__${s.segment || ''}`, s);
  }

  // 1. Generate All Customer Contacts (Conforms to P0-1 & PRD specs)
  const allContacts: SimulationContact[] = [];
  let contactIdGen = 1;

  for (let dIdx = 0; dIdx < numDemands; dIdx++) {
    const d = demands[dIdx];
    const dTimestamp = getDemandTimestamp(d);
    const intStartSec = dTimestamp - baseTimestamp;
    const intDurationSec = (d.intervalMinutes || 30) * 60;
    const intEndSec = intStartSec + intDurationSec;

    let count = d.volume;
    if (config.arrivalMode === 'poisson_uncertainty') {
      count = prng.poisson(d.volume);
    }

    const slaThreshold = config.segmentConfigs?.[d.segment]?.slaThresholdSeconds ?? config.slaThresholdSeconds;
    const defaultPatience = config.segmentConfigs?.[d.segment]?.defaultPatienceSeconds ?? config.defaultPatienceSeconds;
    const segChannel = config.segmentConfigs?.[d.segment]?.channel || d.channel || 'voice';
    let segConcurrency = 1;
    if (segChannel === 'chat') {
      segConcurrency = Math.max(1, config.segmentConfigs?.[d.segment]?.concurrency || config.chatConcurrency || 3);
    }

    const arrivalOffsets: number[] = [];
    if (config.arrivalMode === 'fixed_forecast') {
      if (count <= segConcurrency && segConcurrency > 1) {
        // Multi-slot chat fixed forecast arrives simultaneously at interval start
        for (let c = 0; c < count; c++) {
          arrivalOffsets.push(0);
        }
      } else {
        const step = intDurationSec / Math.max(1, count);
        for (let c = 0; c < count; c++) {
          arrivalOffsets.push(c * step);
        }
      }
    } else {
      for (let c = 0; c < count; c++) {
        arrivalOffsets.push(prng.uniform(0, intDurationSec));
      }
    }
    arrivalOffsets.sort((a, b) => a - b);

    for (let c = 0; c < count; c++) {
      const arrOffset = arrivalOffsets[c];
      const arrTime = intStartSec + arrOffset;
      const arrivalTimestamp = dTimestamp + Math.round(arrOffset);

      // AHT distribution
      let dur = d.ahtSeconds;
      if (config.serviceTimeDist === 'lognormal') {
        dur = prng.lognormal(d.ahtSeconds, config.serviceTimeCV ?? 0.50);
      } else if (config.serviceTimeDist === 'exponential') {
        dur = Math.max(5, prng.exponential(d.ahtSeconds));
      }

      // Patience distribution
      let patience = defaultPatience;
      if (config.patienceDist === 'exponential') {
        patience = Math.max(1, prng.exponential(defaultPatience));
      } else if (config.patienceDist === 'lognormal') {
        patience = Math.max(1, prng.lognormal(defaultPatience, 0.40));
      } else if (config.patienceDist === 'weibull') {
        patience = Math.max(1, prng.weibull(defaultPatience, 1.5));
      }

      const durSec = Math.max(1, Math.round(dur));
      const patSec = Math.max(1, Math.round(patience));

      allContacts.push({
        id: contactIdGen++,
        arrivalTimestamp,
        arrivalTime: arrTime,
        sourceIntervalKey: `${d.date}_${d.intervalStart}_${d.segment}`,
        date: d.date,
        interval: d.intervalStart,
        segment: d.segment,
        channel: d.channel,
        serviceDuration: durSec,
        duration: durSec,
        patience: patSec,
        queueId: d.segment,
        slaThreshold,
        demandIndex: dIdx,
      });
    }
  }

  // Sort contacts chronologically
  allContacts.sort((a, b) => a.arrivalTime - b.arrivalTime);

  // 2. Initialize Agents from Real Roster (P0 Core Concurrency & Pool Rules)
  const agents: DesAgent[] = [];
  if (rosterAgents && rosterAgents.length > 0) {
    for (const rag of rosterAgents) {
      const skills = new Set<string>(
        rag.skills && rag.skills.length > 0 ? rag.skills : [rag.segment || 'Voice']
      );
      // Voice concurrency MUST always equal 1. Never inherit global chatConcurrency.
      const isVoice = rag.channel === 'voice';
      const concurrency = isVoice
        ? 1
        : (rag.concurrency || (rag.channel === 'chat' ? (config.chatConcurrency || 3) : 1));

      agents.push({
        id: rag.id,
        name: rag.name,
        skills,
        concurrency,
        status: 'OFF',
        shiftEnded: false,
        activeContacts: [],
        poolId: rag.poolId,
        segment: rag.segment,
        channel: rag.channel,
        busySeconds: 0,
        availableSeconds: 0,
      });
    }
  } else {
    // Synthetic agent fallback if rosterAgents not supplied
    const totalHC = Math.max(0, config.totalHC ?? 0);
    const uniqueSegments = Array.from(new Set(demands.map(d => d.segment)));
    for (let i = 0; i < totalHC; i++) {
      const seg = uniqueSegments[i % uniqueSegments.length];
      const segDemand = demands.find(d => d.segment === seg);
      const isVoice = segDemand ? segDemand.channel === 'voice' : seg.toLowerCase().includes('voice');
      const concurrency = isVoice ? 1 : (config.chatConcurrency || 3);
      agents.push({
        id: `AG-${(i + 1).toString().padStart(4, '0')}`,
        name: `Agent ${i + 1}`,
        skills: new Set([seg]),
        concurrency,
        status: 'OFF',
        shiftEnded: false,
        activeContacts: [],
        segment: seg,
        channel: isVoice ? 'voice' : 'chat',
        busySeconds: 0,
        availableSeconds: 0,
      });
    }
  }

  const agentMap = new Map<string, DesAgent>();
  for (const ag of agents) {
    agentMap.set(ag.id, ag);
  }

  // Pre-index eligible agents by skill and pool for high performance
  const agentsBySkill = new Map<string, DesAgent[]>();
  for (const ag of agents) {
    for (const s of ag.skills) {
      const list = agentsBySkill.get(s) || [];
      list.push(ag);
      agentsBySkill.set(s, list);
    }
  }

  // 3. Normalized Roster Events
  interface NormalizedRosterEvent {
    timestamp: number;
    agentId: string;
    type: 'SHIFT_START' | 'SHIFT_END' | 'BREAK_START' | 'BREAK_END' | 'SHRINKAGE_START' | 'SHRINKAGE_END' | 'ADHERENCE_START' | 'ADHERENCE_END';
  }

  const normRosterEvents: NormalizedRosterEvent[] = [];
  if (rosterEvents && rosterEvents.length > 0) {
    for (const rev of rosterEvents) {
      const simSec = rev.timestamp > 100000000 ? rev.timestamp - baseTimestamp : rev.timestamp;
      normRosterEvents.push({
        timestamp: simSec,
        agentId: rev.agentId,
        type: rev.type,
      });
    }
  } else if (rosterAgents && rosterAgents.length > 0) {
    for (const ag of rosterAgents) {
      if (!ag.scheduleByDate) continue;
      for (const [date, daySched] of Object.entries(ag.scheduleByDate)) {
        if (!daySched || daySched.isOff || !daySched.shiftStart || !daySched.shiftEnd) continue;
        const dayStartEpoch = parseDateTimeToEpochSeconds(date, '00:00');
        const sStartSec = timeToMinutes(daySched.shiftStart) * 60;
        const sEndSec = timeToMinutes(daySched.shiftEnd) * 60;

        normRosterEvents.push({
          timestamp: (dayStartEpoch + sStartSec) - baseTimestamp,
          agentId: ag.id,
          type: 'SHIFT_START',
        });

        for (const b of daySched.breaks || []) {
          const bStartSec = timeToMinutes(b.start) * 60;
          const bEndSec = timeToMinutes(b.end) * 60;
          normRosterEvents.push({
            timestamp: (dayStartEpoch + bStartSec) - baseTimestamp,
            agentId: ag.id,
            type: 'BREAK_START',
          });
          normRosterEvents.push({
            timestamp: (dayStartEpoch + bEndSec) - baseTimestamp,
            agentId: ag.id,
            type: 'BREAK_END',
          });
        }

        for (const s of daySched.plannedShrinkages || []) {
          const sStartSec = timeToMinutes(s.start) * 60;
          const sEndSec = timeToMinutes(s.end) * 60;
          normRosterEvents.push({
            timestamp: (dayStartEpoch + sStartSec) - baseTimestamp,
            agentId: ag.id,
            type: 'SHRINKAGE_START',
          });
          normRosterEvents.push({
            timestamp: (dayStartEpoch + sEndSec) - baseTimestamp,
            agentId: ag.id,
            type: 'SHRINKAGE_END',
          });
        }

        normRosterEvents.push({
          timestamp: (dayStartEpoch + sEndSec) - baseTimestamp,
          agentId: ag.id,
          type: 'SHIFT_END',
        });
      }
    }
  }
  normRosterEvents.sort((a, b) => a.timestamp - b.timestamp);

  // 4. Pre-indexed Demands and Multi-Queue State
  interface DemandIntervalInfo {
    dIdx: number;
    startSec: number;
    endSec: number;
    d: DemandRow;
  }
  const demandsBySegment = new Map<string, DemandIntervalInfo[]>();
  for (let i = 0; i < numDemands; i++) {
    const d = demands[i];
    const startSec = getDemandTimestamp(d) - baseTimestamp;
    const endSec = startSec + (d.intervalMinutes || 30) * 60;
    const list = demandsBySegment.get(d.segment) || [];
    list.push({ dIdx: i, startSec, endSec, d });
    demandsBySegment.set(d.segment, list);
  }

  // Pre-index segments by pool
  const poolSegmentsMap = new Map<string, string[]>();
  for (const d of demands) {
    const isShared = config.segmentConfigs?.[d.segment]?.allocationType === 'shared';
    const poolId = config.segmentConfigs?.[d.segment]?.poolId || (isShared ? 'shared_pool' : undefined);
    if (poolId) {
      const list = poolSegmentsMap.get(poolId) || [];
      if (!list.includes(d.segment)) list.push(d.segment);
      poolSegmentsMap.set(poolId, list);
    }
  }

  const segmentQueues = new Map<string, FIFOQueue<WaitingContact>>();
  for (const d of demands) {
    if (!segmentQueues.has(d.segment)) {
      segmentQueues.set(d.segment, new FIFOQueue<WaitingContact>());
    }
  }

  // Accumulator arrays per DemandRow
  const offered = new Int32Array(numDemands);
  const answered = new Int32Array(numDemands);
  const abandoned = new Int32Array(numDemands);
  const shortAbandoned = new Int32Array(numDemands);
  const answeredWithinSla = new Int32Array(numDemands);
  const totalWaitSec = new Float64Array(numDemands);
  const maxWaitSec = new Float64Array(numDemands);
  const maxQueue = new Int32Array(numDemands);
  const queueStart = new Int32Array(numDemands);
  const queueEnd = new Int32Array(numDemands);
  const queueStartRecorded = new Uint8Array(numDemands);
  const queueEndRecorded = new Uint8Array(numDemands);
  const timeWeightedQueueSec = new Float64Array(numDemands);
  const busySecArray = new Float64Array(numDemands);
  const availableSecArray = new Float64Array(numDemands);

  // Pool-level tracking maps (P0-5 Shared Pool Occupancy)
  const poolIntervalBusyMap = new Map<string, number>();
  const poolIntervalAvailMap = new Map<string, number>();

  function checkIntervalQueueBoundaries(time: number) {
    for (let i = 0; i < numDemands; i++) {
      const d = demands[i];
      const dStart = getDemandTimestamp(d) - baseTimestamp;
      const dEnd = dStart + (d.intervalMinutes || 30) * 60;
      const qLen = segmentQueues.get(d.segment)?.size() || 0;
      if (!queueStartRecorded[i] && time >= dStart) {
        queueStart[i] = qLen;
        queueStartRecorded[i] = 1;
      }
      if (!queueEndRecorded[i] && time >= dEnd) {
        queueEnd[i] = qLen;
        queueEndRecorded[i] = 1;
      }
    }
  }

  // Helper to record interval busy time (splits across boundaries, P0-12)
  function recordAgentBusyTime(segment: string, startSec: number, endSec: number, poolId?: string) {
    if (endSec <= startSec) return;
    const intervals = demandsBySegment.get(segment);
    if (!intervals) return;
    for (let j = 0; j < intervals.length; j++) {
      const inv = intervals[j];
      if (inv.endSec <= startSec) continue;
      if (inv.startSec >= endSec) break;
      const overlapStart = Math.max(startSec, inv.startSec);
      const overlapEnd = Math.min(endSec, inv.endSec);
      if (overlapEnd > overlapStart) {
        const overlapDur = overlapEnd - overlapStart;
        busySecArray[inv.dIdx] += overlapDur;
        if (poolId) {
          const timeKey = `${inv.d.date}__${inv.d.intervalStart}`;
          const pKey = `${poolId}__${timeKey}`;
          poolIntervalBusyMap.set(pKey, (poolIntervalBusyMap.get(pKey) || 0) + overlapDur);
        }
      }
    }
  }

  // High-performance agent available time tracking (recorded on state transitions, zero double counting)
  function flushAgentAvailableTime(ag: DesAgent, currentTime: number) {
    if (ag.availableSince === undefined) return;
    const startSec = ag.availableSince;
    const endSec = currentTime;
    ag.availableSince = undefined;
    if (endSec <= startSec) return;

    const dur = endSec - startSec;
    ag.availableSeconds += dur;

    // For dedicated agents (1 skill), record directly to that segment's overlapping intervals
    if (ag.skills.size === 1) {
      const seg = Array.from(ag.skills)[0];
      const intervals = demandsBySegment.get(seg);
      if (intervals) {
        for (let j = 0; j < intervals.length; j++) {
          const inv = intervals[j];
          if (inv.endSec <= startSec) continue;
          if (inv.startSec >= endSec) break;
          const oStart = Math.max(startSec, inv.startSec);
          const oEnd = Math.min(endSec, inv.endSec);
          if (oEnd > oStart) {
            availableSecArray[inv.dIdx] += oEnd - oStart;
          }
        }
      }
    } else {
      // For shared pool agents, record to pool interval available map (1 agent available = 1 pool available second)
      const pKey = ag.poolId || 'shared_pool';
      const recordedIntervals = new Set<string>();
      for (const seg of ag.skills) {
        const intervals = demandsBySegment.get(seg);
        if (!intervals) continue;
        for (let j = 0; j < intervals.length; j++) {
          const inv = intervals[j];
          if (inv.endSec <= startSec) continue;
          if (inv.startSec >= endSec) break;
          const oStart = Math.max(startSec, inv.startSec);
          const oEnd = Math.min(endSec, inv.endSec);
          if (oEnd > oStart) {
            const timeKey = `${inv.d.date}__${inv.d.intervalStart}`;
            const poolKey = `${pKey}__${timeKey}`;
            if (!recordedIntervals.has(poolKey)) {
              recordedIntervals.add(poolKey);
              poolIntervalAvailMap.set(poolKey, (poolIntervalAvailMap.get(poolKey) || 0) + (oEnd - oStart));
            }
          }
        }
      }
    }
  }

  // Record queue time-weighted integral
  function recordQueueIntegral(fromTime: number, toTime: number) {
    if (toTime <= fromTime) return;
    for (const [seg, intervals] of demandsBySegment.entries()) {
      const q = segmentQueues.get(seg);
      const qLen = q ? q.size() : 0;
      if (qLen === 0) continue;
      for (let j = 0; j < intervals.length; j++) {
        const inv = intervals[j];
        if (inv.endSec <= fromTime) continue;
        if (inv.startSec >= toTime) break;
        const oStart = Math.max(fromTime, inv.startSec);
        const oEnd = Math.min(toTime, inv.endSec);
        if (oEnd > oStart) {
          timeWeightedQueueSec[inv.dIdx] += qLen * (oEnd - oStart);
          if (qLen > maxQueue[inv.dIdx]) {
            maxQueue[inv.dIdx] = qLen;
          }
        }
      }
    }
  }

  // Try to dispatch waiting contacts to an agent (P0-1 FIFO Queue dispatch)
  function tryAssignAgent(agent: DesAgent, currentTime: number): boolean {
    if (agent.status !== 'AVAILABLE' || agent.shiftEnded) return false;
    if (agent.activeContacts.length >= agent.concurrency) return false;

    // Find oldest waiting contact among queues this agent can serve
    let bestQueue: FIFOQueue<WaitingContact> | null = null;
    let earliestEnqueue = Infinity;

    for (const seg of agent.skills) {
      const q = segmentQueues.get(seg);
      if (q && q.size() > 0) {
        const item = q.peek();
        if (item && item.enqueuedAt < earliestEnqueue) {
          earliestEnqueue = item.enqueuedAt;
          bestQueue = q;
        }
      }
    }

    if (!bestQueue) return false;

    const bestContact = bestQueue.shift();
    if (!bestContact) return false;

    // If agent was fully idle, flush available time up to currentTime
    if (agent.activeContacts.length === 0) {
      flushAgentAvailableTime(agent, currentTime);
    }

    const c = bestContact.contact;
    const waitTime = Math.max(0, currentTime - c.arrivalTime);
    const finishTime = currentTime + c.duration;

    agent.activeContacts.push({ contact: c, finishTime });
    agent.busySeconds += c.duration;

    // Record Metrics to Arrival Demand Interval
    const dIdx = c.demandIndex;
    answered[dIdx]++;
    totalWaitSec[dIdx] += waitTime;
    if (waitTime > maxWaitSec[dIdx]) {
      maxWaitSec[dIdx] = waitTime;
    }
    if (waitTime <= c.slaThreshold) {
      answeredWithinSla[dIdx]++;
    }

    recordAgentBusyTime(c.segment, currentTime, finishTime, agent.poolId);
    return true;
  }

  // 5. Main Event Loop with Configurable Queue Closure (P0-6)
  let contactCursor = 0;
  let rosterCursor = 0;
  let simClock = 0;

  const closureBehavior = config.queueClosureBehavior || 'finish_queued';
  const maxDrainSec = (config.maxDrainMinutes ?? 30) * 60;
  const loopSafetySec = horizonEndSec + 7 * 86400; // 7 days infinite loop safety guard

  while (simClock < loopSafetySec) {
    // Determine next event time across arrivals, roster changes, completions, abandons
    let nextArrival = contactCursor < allContacts.length ? allContacts[contactCursor].arrivalTime : Infinity;
    let nextRoster = rosterCursor < normRosterEvents.length ? normRosterEvents[rosterCursor].timestamp : Infinity;
    let nextCompletion = Infinity;
    for (const ag of agents) {
      for (const act of ag.activeContacts) {
        if (act.finishTime < nextCompletion) {
          nextCompletion = act.finishTime;
        }
      }
    }
    let nextAbandon = Infinity;
    for (const q of segmentQueues.values()) {
      for (const item of q.getItems()) {
        if (item.abandonAt < nextAbandon) {
          nextAbandon = item.abandonAt;
        }
      }
    }

    const nextEventTime = Math.min(nextArrival, nextRoster, nextCompletion, nextAbandon);

    // Termination conditions (P0-6: If horizon ended and queues are empty, terminate immediately)
    let totalQueued = 0;
    for (const q of segmentQueues.values()) {
      totalQueued += q.size();
    }
    let totalActive = 0;
    for (const ag of agents) {
      totalActive += ag.activeContacts.length;
    }

    if (simClock >= horizonEndSec && contactCursor >= allContacts.length && totalQueued === 0 && totalActive === 0) {
      break;
    }

    if (nextEventTime === Infinity) {
      break;
    }

    // Step time forward
    const prevTime = simClock;
    simClock = nextEventTime;

    checkIntervalQueueBoundaries(simClock);
    recordQueueIntegral(prevTime, simClock);

    // Queue Closure Handling (P0-6)
    if (simClock >= horizonEndSec) {
      if (closureBehavior === 'force_close') {
        for (const [seg, q] of segmentQueues.entries()) {
          const drained = q.drain();
          for (const item of drained) {
            const dIdx = item.contact.demandIndex;
            abandoned[dIdx]++;
            if ((simClock - item.contact.arrivalTime) <= config.shortAbandonThresholdSeconds) {
              shortAbandoned[dIdx]++;
            }
          }
        }
      } else if (closureBehavior === 'max_drain' && simClock >= horizonEndSec + maxDrainSec) {
        for (const [seg, q] of segmentQueues.entries()) {
          const drained = q.drain();
          for (const item of drained) {
            const dIdx = item.contact.demandIndex;
            abandoned[dIdx]++;
            if ((simClock - item.contact.arrivalTime) <= config.shortAbandonThresholdSeconds) {
              shortAbandoned[dIdx]++;
            }
          }
        }
      }
    }

    // DETERMINISTIC EVENT PRIORITY at identical timestamp:
    // Priority 1: Service completions
    for (const ag of agents) {
      if (ag.activeContacts.length > 0) {
        const remaining: Array<{ contact: SimulationContact; finishTime: number }> = [];
        for (const act of ag.activeContacts) {
          if (act.finishTime <= simClock) {
            // Completed!
          } else {
            remaining.push(act);
          }
        }
        ag.activeContacts = remaining;

        if (ag.shiftEnded && ag.activeContacts.length === 0) {
          ag.status = 'OFF';
        } else if (ag.status === 'AVAILABLE') {
          while (ag.activeContacts.length < ag.concurrency) {
            if (!tryAssignAgent(ag, simClock)) break;
          }
          if (ag.activeContacts.length === 0 && ag.availableSince === undefined) {
            ag.availableSince = simClock;
          }
        }
      }
    }

    // Priority 2: Roster availability state changes
    const changedAgents = new Set<DesAgent>();
    while (rosterCursor < normRosterEvents.length && normRosterEvents[rosterCursor].timestamp <= simClock) {
      const rev = normRosterEvents[rosterCursor];
      const ag = agentMap.get(rev.agentId);
      if (ag) {
        switch (rev.type) {
          case 'SHIFT_START':
            ag.status = 'AVAILABLE';
            ag.shiftEnded = false;
            ag.availableSince = simClock;
            changedAgents.add(ag);
            break;
          case 'SHIFT_END':
            ag.shiftEnded = true;
            flushAgentAvailableTime(ag, simClock);
            if (ag.activeContacts.length === 0) {
              ag.status = 'OFF';
            }
            changedAgents.delete(ag);
            break;
          case 'BREAK_START':
            flushAgentAvailableTime(ag, simClock);
            ag.status = 'ON_BREAK';
            changedAgents.delete(ag);
            break;
          case 'BREAK_END':
            ag.status = 'AVAILABLE';
            ag.availableSince = simClock;
            changedAgents.add(ag);
            break;
          case 'SHRINKAGE_START':
            flushAgentAvailableTime(ag, simClock);
            ag.status = 'SHRINKAGE';
            changedAgents.delete(ag);
            break;
          case 'SHRINKAGE_END':
            ag.status = 'AVAILABLE';
            ag.availableSince = simClock;
            changedAgents.add(ag);
            break;
          case 'ADHERENCE_START':
            flushAgentAvailableTime(ag, simClock);
            ag.status = 'UNADHERENT';
            changedAgents.delete(ag);
            break;
          case 'ADHERENCE_END':
            ag.status = 'AVAILABLE';
            ag.availableSince = simClock;
            changedAgents.add(ag);
            break;
        }
      }
      rosterCursor++;
    }

    for (const ag of changedAgents) {
      if (ag.status === 'AVAILABLE') {
        while (ag.activeContacts.length < ag.concurrency) {
          if (!tryAssignAgent(ag, simClock)) break;
        }
        if (ag.activeContacts.length > 0) {
          ag.availableSince = undefined;
        }
      }
    }

    // Priority 3: Abandonment deadlines
    for (const [seg, q] of segmentQueues.entries()) {
      q.filter(item => {
        if (item.abandonAt <= simClock) {
          const c = item.contact;
          const wait = Math.max(0, simClock - c.arrivalTime);
          const dIdx = c.demandIndex;
          abandoned[dIdx]++;
          if (wait <= config.shortAbandonThresholdSeconds) {
            shortAbandoned[dIdx]++;
          }
          return false; // drop from queue
        }
        return true; // keep
      });
    }

    // Priority 4: Contact arrivals
    while (contactCursor < allContacts.length && allContacts[contactCursor].arrivalTime <= simClock) {
      const c = allContacts[contactCursor];
      const dIdx = c.demandIndex;
      offered[dIdx]++;

      let assigned = false;
      const eligibleAgents = agentsBySkill.get(c.segment) || agents;
      for (const ag of eligibleAgents) {
        if (ag.status === 'AVAILABLE' && !ag.shiftEnded && ag.skills.has(c.segment) && ag.activeContacts.length < ag.concurrency) {
          if (ag.activeContacts.length === 0) {
            flushAgentAvailableTime(ag, simClock);
          }
          const finishTime = simClock + c.duration;
          ag.activeContacts.push({ contact: c, finishTime });
          ag.busySeconds += c.duration;

          answered[dIdx]++;
          answeredWithinSla[dIdx]++;
          recordAgentBusyTime(c.segment, simClock, finishTime, ag.poolId);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        const q = segmentQueues.get(c.segment);
        if (q) {
          q.push({
            contact: c,
            abandonAt: simClock + c.patience,
            enqueuedAt: simClock,
          });
          if (q.size() > maxQueue[dIdx]) {
            maxQueue[dIdx] = q.size();
          }
        }
      }

      contactCursor++;
    }
  }

  // Flush any remaining active available time at simulation finish
  const finalHorizonSec = Math.max(simClock, horizonEndSec);
  for (const ag of agents) {
    flushAgentAvailableTime(ag, finalHorizonSec);
  }

  // 6. Assemble Interval Results
  const intervalResults: IntervalResult[] = [];
  let totalOffered = 0;
  let totalAnswered = 0;
  let totalAbandoned = 0;
  let totalShortAbandoned = 0;
  let totalAnsweredWithinSla = 0;
  let totalWaitTimeSum = 0;
  let totalBusySeconds = 0;
  let totalAvailableSeconds = 0;

  for (let i = 0; i < numDemands; i++) {
    const d = demands[i];
    const off = offered[i];
    const ans = answered[i];
    const abn = abandoned[i];
    const shAbn = shortAbandoned[i];
    const ansSla = answeredWithinSla[i];
    const waitSum = totalWaitSec[i];
    const busySec = busySecArray[i];
    const availSec = availableSecArray[i];

    totalOffered += off;
    totalAnswered += ans;
    totalAbandoned += abn;
    totalShortAbandoned += shAbn;
    totalAnsweredWithinSla += ansSla;
    totalWaitTimeSum += waitSum;
    totalBusySeconds += busySec;
    totalAvailableSeconds += availSec;

    // SLA calculation:
    // If excludeShortAbandons: SLA = answeredWithinSla / (offered - shortAbandons)
    const slaDenom = config.excludeShortAbandons ? Math.max(0, off - shAbn) : off;
    const slaPercent = slaDenom > 0 ? Number(((ansSla / slaDenom) * 100).toFixed(1)) : 100.0;

    const asaSeconds = ans > 0 ? Number((waitSum / ans).toFixed(1)) : 0.0;
    const answerPercent = off > 0 ? Number(((ans / off) * 100).toFixed(1)) : 100.0;

    // Abandon % calculation
    const abnDenom = config.excludeShortAbandons ? Math.max(0, off - shAbn) : off;
    const abnNum = config.excludeShortAbandons ? Math.max(0, abn - shAbn) : abn;
    const abandonPercent = abnDenom > 0 ? Number(((abnNum / abnDenom) * 100).toFixed(1)) : 0.0;

    // Occupancy % calculation (P0-5 Shared Pool Occupancy & P0-10 Multi-Slot Concurrency)
    const seg = d.segment;
    const isShared = config.segmentConfigs?.[seg]?.allocationType === 'shared';
    const poolId = config.segmentConfigs?.[seg]?.poolId || (isShared ? 'shared_pool' : undefined);
    const segChannel = config.segmentConfigs?.[seg]?.channel || d.channel || 'voice';
    let segConcurrency = 1;
    if (segChannel === 'chat') {
      segConcurrency = Math.max(1, config.segmentConfigs?.[seg]?.concurrency || config.chatConcurrency || 3);
    }

    // Roster staff for this interval
    const staffKey = `${d.date}__${d.intervalStart}__${d.segment}`;
    const staff = staffingMap.get(staffKey) || staffingMap.get(`${d.intervalStart}__${d.segment}`);
    const scheduledHC = staff ? staff.scheduledHC : 0;
    const effectiveHC = staff ? staff.effectiveHC : 0;

    let occupancyPercent = 0.0;
    let finalAvailSec = availSec;

    if (segConcurrency > 1) {
      // Chat multi-slot capacity
      const intDurationSec = (d.intervalMinutes || 30) * 60;
      const onDutySec = Math.max(availSec + (busySec / segConcurrency), effectiveHC * intDurationSec);
      const totalSlotSec = onDutySec * segConcurrency;
      occupancyPercent = totalSlotSec > 0 ? Number(Math.min(100, (busySec / totalSlotSec) * 100).toFixed(4)) : 0.0;
      finalAvailSec = Math.max(0, onDutySec - (busySec / segConcurrency));
      availableSecArray[i] = finalAvailSec;
    } else if (poolId) {
      const timeKey = `${d.date}__${d.intervalStart}`;
      const pKey = `${poolId}__${timeKey}`;
      const pBusy = poolIntervalBusyMap.get(pKey) || 0;
      const pAvail = poolIntervalAvailMap.get(pKey) || 0;
      const pDenom = pBusy + pAvail;
      occupancyPercent = pDenom > 0 ? Number(Math.min(100, (pBusy / pDenom) * 100).toFixed(1)) : 0.0;

      // Allocate available seconds to this segment in proportion to busy volume (or workload if 0)
      if (pBusy > 0) {
        finalAvailSec = pAvail * (busySec / pBusy);
      } else {
        const segCount = poolSegmentsMap.get(poolId)?.length || 1;
        finalAvailSec = pAvail / segCount;
      }
      availableSecArray[i] = finalAvailSec;
    } else {
      const intDurationSec = (d.intervalMinutes || 30) * 60;
      const onDutySec = Math.max(busySec + availSec, effectiveHC * intDurationSec);
      const occDenom = onDutySec > 0 ? onDutySec : (busySec + availSec);
      occupancyPercent = occDenom > 0 ? Number(Math.min(100, (busySec / occDenom) * 100).toFixed(1)) : 0.0;
      finalAvailSec = Math.max(0, onDutySec - busySec);
      availableSecArray[i] = finalAvailSec;
    }

    // Erlang Benchmark
    const erlangReq = solveRequiredStaffing(
      d.trafficErlangs,
      d.ahtSeconds,
      config.slaPercentTarget / 100,
      config.slaThresholdSeconds,
      config.maxOccupancyThreshold / 100,
      config.minCoverage,
      config.erlangModel || 'erlang_c',
      config.defaultPatienceSeconds
    );
    const erlangMetrics = calculateErlangC(
      Math.max(1, effectiveHC),
      d.trafficErlangs,
      d.ahtSeconds,
      config.slaThresholdSeconds
    );

    const gap = Number((effectiveHC - erlangReq).toFixed(1));
    const gapPercent = erlangReq > 0 ? Number(((gap / erlangReq) * 100).toFixed(1)) : 0;

    const intDurationSec = d.intervalMinutes * 60;
    const avgQ = Number((timeWeightedQueueSec[i] / Math.max(1, intDurationSec)).toFixed(1));

    const targetMet = slaPercent >= config.slaPercentTarget && occupancyPercent <= config.maxOccupancyThreshold;

    intervalResults.push({
      interval: d.intervalStart,
      date: d.date,
      segment: d.segment,
      channel: d.channel,
      volume: d.volume,
      aht: d.ahtSeconds,
      workloadSeconds: d.workloadSeconds,
      trafficErlangs: Number(d.trafficErlangs.toFixed(2)),

      erlangReqHC: erlangReq,
      erlangSla: Number((erlangMetrics.sla * 100).toFixed(1)),
      erlangAsa: Number(erlangMetrics.asa.toFixed(1)),
      erlangOcc: Number((erlangMetrics.occupancy * 100).toFixed(1)),

      scheduledHC,
      effectiveHC,
      gap,
      gapPercent,

      offered: off,
      answered: ans,
      abandoned: abn,
      shortAbandoned: shAbn,
      answeredWithinSla: ansSla,
      slaPercent,
      asaSeconds,
      answerPercent,
      abandonPercent,
      occupancyPercent,

      maxQueue: maxQueue[i],
      avgQueue: avgQ,
      queueStart: queueStart[i],
      queueEnd: queueEndRecorded[i] ? queueEnd[i] : (segmentQueues.get(d.segment)?.size() || 0),
      maxWaitSeconds: Number(maxWaitSec[i].toFixed(1)),
      busySeconds: Math.round(busySec),
      availableSeconds: Math.round(availSec),

      targetMet,
    });
  }

  // 7. Overall Summary Aggregation
  const totalSlaDenom = config.excludeShortAbandons ? Math.max(0, totalOffered - totalShortAbandoned) : totalOffered;
  const overallSla = totalSlaDenom > 0 ? (totalAnsweredWithinSla / totalSlaDenom) * 100 : 100.0;
  const overallAsa = totalAnswered > 0 ? totalWaitTimeSum / totalAnswered : 0.0;
  const overallAnsPct = totalOffered > 0 ? (totalAnswered / totalOffered) * 100 : 100.0;
  const totalAbnNum = config.excludeShortAbandons ? Math.max(0, totalAbandoned - totalShortAbandoned) : totalAbandoned;
  const overallAbnPct = totalSlaDenom > 0 ? (totalAbnNum / totalSlaDenom) * 100 : 0.0;
  const overallOccDenom = totalBusySeconds + totalAvailableSeconds;
  const overallOccupancy = overallOccDenom > 0 ? Math.min(100, (totalBusySeconds / overallOccDenom) * 100) : 0.0;

  const summary: AggregationSummary = {
    period: 'Total',
    offered: totalOffered,
    answered: totalAnswered,
    answeredCount: totalAnswered,
    abandoned: totalAbandoned,
    abandonedCount: totalAbandoned,
    shortAbandoned: totalShortAbandoned,
    answeredWithinSla: totalAnsweredWithinSla,
    totalWaitingSeconds: totalWaitTimeSum,
    busySeconds: Math.round(totalBusySeconds),
    availableSeconds: Math.round(totalAvailableSeconds),
    slaPercent: Number(overallSla.toFixed(1)),
    asaSeconds: Number(overallAsa.toFixed(1)),
    answerPercent: Number(overallAnsPct.toFixed(1)),
    answerRatePercent: Number(overallAnsPct.toFixed(1)),
    abandonPercent: Number(overallAbnPct.toFixed(1)),
    abandonRatePercent: Number(overallAbnPct.toFixed(1)),
    occupancyPercent: Number(overallOccupancy.toFixed(1)),
    averageOccupancyPercent: Number(overallOccupancy.toFixed(1)),
    erlangReqAvg: Number((intervalResults.reduce((s, r) => s + r.erlangReqHC, 0) / Math.max(1, numDemands)).toFixed(1)),
    scheduledAvg: Number((intervalResults.reduce((s, r) => s + r.scheduledHC, 0) / Math.max(1, numDemands)).toFixed(1)),
    effectiveAvg: Number((intervalResults.reduce((s, r) => s + r.effectiveHC, 0) / Math.max(1, numDemands)).toFixed(1)),
    intervalsCount: numDemands,
    intervalsMetSla: intervalResults.filter(r => r.targetMet).length,
    maxWaitSeconds: maxWaitSec.length > 0 ? Number(Math.max(...maxWaitSec).toFixed(1)) : 0,
  };

  return {
    intervalResults,
    summary,
  };
}

/**
 * Executes Monte Carlo Replications with statistical confidence estimation
 * Accepts roster agents or staffing list directly (P0-4 & P0-15)
 */
export function runMonteCarloSimulation(
  demands: DemandRow[],
  staffingListOrRoster: IntervalStaffing[] | SyntheticAgent[] | GeneratedRoster,
  config: WorkforceConfig,
  rosterAgentsArg?: SyntheticAgent[],
  rosterEventsArg?: AgentAvailabilityEvent[],
  onProgress?: (pct: number) => void
): { baseResult: SimulationRunResult; stats: MonteCarloStats } {
  let resolvedStaffing: IntervalStaffing[] = [];
  let resolvedAgents: SyntheticAgent[] | undefined = rosterAgentsArg;
  let resolvedEvents: AgentAvailabilityEvent[] | undefined = rosterEventsArg;

  if (staffingListOrRoster) {
    if ('agents' in staffingListOrRoster && Array.isArray((staffingListOrRoster as any).agents)) {
      const roster = staffingListOrRoster as GeneratedRoster;
      resolvedAgents = roster.agents;
      resolvedEvents = roster.events;
      resolvedStaffing = roster.intervalStaffing || [];
    } else if (Array.isArray(staffingListOrRoster)) {
      const first = staffingListOrRoster[0];
      if (first && ('scheduleByDate' in first || 'skills' in first || ('id' in first && String(first.id).startsWith('AG-')))) {
        resolvedAgents = staffingListOrRoster as SyntheticAgent[];
      } else {
        resolvedStaffing = staffingListOrRoster as IntervalStaffing[];
      }
    }
  }

  const basePrng = new PRNG(config.seed ?? 42);
  const baseResult = runSingleSimulation(demands, resolvedStaffing, config, basePrng, resolvedAgents, resolvedEvents);

  const minRuns = Math.max(1, config.minMonteCarloRuns ?? 1);
  const maxRuns = Math.max(minRuns, config.maxMonteCarloRuns ?? (config.monteCarloRuns ?? 50));
  const targetHalfWidth = config.targetSlaHalfWidth;

  if (maxRuns <= 1) {
    const s = baseResult.summary;
    return {
      baseResult,
      stats: {
        runsCompleted: 1,
        runsExecuted: 1,
        slaMean: s.slaPercent,
        slaMin: s.slaPercent,
        slaMax: s.slaPercent,
        slaStdDev: 0,
        slaCiLower: s.slaPercent,
        slaCiUpper: s.slaPercent,
        expectedSla: s.slaPercent,
        p10Sla: s.slaPercent,
        p50Sla: s.slaPercent,
        p90Sla: s.slaPercent,
        ci95Lower: s.slaPercent,
        ci95Upper: s.slaPercent,
        probTargetMet: s.slaPercent >= config.slaPercentTarget ? 1.0 : 0.0,
        expectedAsa: s.asaSeconds,
        p10Asa: s.asaSeconds,
        p90Asa: s.asaSeconds,
        expectedAnswerRate: s.answerPercent,
        expectedAbandonRate: s.abandonPercent,
        expectedOccupancy: s.occupancyPercent,
      },
    };
  }

  const slaList: number[] = [baseResult.summary.slaPercent];
  const asaList: number[] = [baseResult.summary.asaSeconds];
  const ansList: number[] = [baseResult.summary.answerPercent];
  const abnList: number[] = [baseResult.summary.abandonPercent];
  const occList: number[] = [baseResult.summary.occupancyPercent];

  let targetMetCount = baseResult.summary.slaPercent >= config.slaPercentTarget ? 1 : 0;

  for (let r = 1; r < maxRuns; r++) {
    const seed = (config.seed ?? 42) + r * 1337;
    const prng = new PRNG(seed);
    const runRes = runSingleSimulation(demands, resolvedStaffing, config, prng, resolvedAgents, resolvedEvents);
    const sum = runRes.summary;

    slaList.push(sum.slaPercent);
    asaList.push(sum.asaSeconds);
    ansList.push(sum.answerPercent);
    abnList.push(sum.abandonPercent);
    occList.push(sum.occupancyPercent);

    if (sum.slaPercent >= config.slaPercentTarget) {
      targetMetCount++;
    }

    // Adaptive Monte Carlo Convergence Check (P0-15)
    if (targetHalfWidth !== undefined && targetHalfWidth > 0 && r + 1 >= minRuns) {
      const currentRuns = r + 1;
      const currentMean = slaList.reduce((s, v) => s + v, 0) / currentRuns;
      const currentVar = slaList.reduce((s, v) => s + (v - currentMean) ** 2, 0) / (currentRuns - 1);
      const currentHalfWidth = 1.96 * Math.sqrt(currentVar / currentRuns);
      if (currentHalfWidth <= targetHalfWidth) {
        break; // Reached target SLA confidence interval half-width
      }
    }

    if (onProgress && (r % 2 === 0 || r === maxRuns - 1)) {
      onProgress(Math.min(99, Math.round(((r + 1) / maxRuns) * 100)));
    }
  }

  if (onProgress) {
    onProgress(100);
  }

  const runs = slaList.length;
  slaList.sort((a, b) => a - b);
  asaList.sort((a, b) => a - b);

  const p10Idx = Math.floor(runs * 0.10);
  const p50Idx = Math.floor(runs * 0.50);
  const p90Idx = Math.min(runs - 1, Math.floor(runs * 0.90));

  const meanSla = slaList.reduce((s, v) => s + v, 0) / runs;
  const varianceSla = runs > 1
    ? slaList.reduce((s, v) => s + (v - meanSla) ** 2, 0) / (runs - 1)
    : 0;
  const stdErrorSla = runs > 1 ? Math.sqrt(varianceSla / runs) : 0;

  const stats: MonteCarloStats = {
    runsCompleted: runs,
    runsExecuted: runs,
    slaMean: Number(meanSla.toFixed(1)),
    slaMin: Number(slaList[0].toFixed(1)),
    slaMax: Number(slaList[slaList.length - 1].toFixed(1)),
    slaStdDev: Number(Math.sqrt(varianceSla).toFixed(2)),
    slaCiLower: Number(Math.max(0, meanSla - 1.96 * stdErrorSla).toFixed(1)),
    slaCiUpper: Number(Math.min(100, meanSla + 1.96 * stdErrorSla).toFixed(1)),
    expectedSla: Number(meanSla.toFixed(1)),
    p10Sla: Number(slaList[p10Idx].toFixed(1)),
    p50Sla: Number(slaList[p50Idx].toFixed(1)),
    p90Sla: Number(slaList[p90Idx].toFixed(1)),
    ci95Lower: Number(Math.max(0, meanSla - 1.96 * stdErrorSla).toFixed(1)),
    ci95Upper: Number(Math.min(100, meanSla + 1.96 * stdErrorSla).toFixed(1)),
    probTargetMet: Number((targetMetCount / runs).toFixed(2)),

    expectedAsa: Number((asaList.reduce((s, v) => s + v, 0) / runs).toFixed(1)),
    p10Asa: Number(asaList[p10Idx].toFixed(1)),
    p90Asa: Number(asaList[p90Idx].toFixed(1)),

    expectedAnswerRate: Number((ansList.reduce((s, v) => s + v, 0) / runs).toFixed(1)),
    expectedAbandonRate: Number((abnList.reduce((s, v) => s + v, 0) / runs).toFixed(1)),
    expectedOccupancy: Number((occList.reduce((s, v) => s + v, 0) / runs).toFixed(1)),
  };

  return {
    baseResult,
    stats,
  };
}
