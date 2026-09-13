import {
  WorkforceConfig,
  DemandRow,
  IntervalStaffing,
  SyntheticAgent,
  AgentAvailabilityEvent,
  MonteCarloStats,
} from '../types';
import { runSingleSimulation, runMonteCarloSimulation, PRNG, SimulationRunResult } from './des';
import SimulationWorker from '../workers/simulation.worker?worker&inline';

export interface RunSimulationOptions {
  mode: 'single' | 'monte_carlo';
  demands: DemandRow[];
  staffing: IntervalStaffing[];
  config: WorkforceConfig;
  agents?: SyntheticAgent[];
  events?: AgentAvailabilityEvent[];
  onProgress?: (pct: number) => void;
}

export interface SimulationExecutionOutput {
  baseResult: SimulationRunResult;
  stats: MonteCarloStats | null;
}

let activeWorker: Worker | null = null;
let activeJobId = '';

export function abortActiveSimulation() {
  if (activeWorker) {
    activeWorker.terminate();
    activeWorker = null;
    activeJobId = '';
  }
}

export async function executeSimulationAsync(options: RunSimulationOptions): Promise<SimulationExecutionOutput> {
  abortActiveSimulation();

  const jobId = Math.random().toString(36).substring(2);
  activeJobId = jobId;

  // Attempt Web Worker execution if available
  if (typeof Worker !== 'undefined') {
    try {
      const worker = new SimulationWorker();
      activeWorker = worker;

      return await new Promise<SimulationExecutionOutput>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent) => {
          if (e.data?.jobId !== jobId) return;
          if (e.data.type === 'PROGRESS') {
            options.onProgress?.(e.data.progress);
            return;
          }
          if (e.data.type === 'DONE') {
            worker.terminate();
            if (activeWorker === worker) activeWorker = null;
            resolve({
              baseResult: e.data.baseResult,
              stats: e.data.stats,
            });
          } else if (e.data.type === 'ERROR') {
            worker.terminate();
            if (activeWorker === worker) activeWorker = null;
            reject(new Error(e.data.error));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          if (activeWorker === worker) activeWorker = null;
          console.warn('Worker error, falling back to main thread:', err);
          // Main thread fallback on error
          try {
            if (options.mode === 'single') {
              const prng = new PRNG(options.config.seed ?? 42);
              const baseResult = runSingleSimulation(
                options.demands,
                options.staffing,
                options.config,
                prng,
                options.agents,
                options.events
              );
              resolve({ baseResult, stats: null });
            } else {
              const { baseResult, stats } = runMonteCarloSimulation(
                options.demands,
                options.staffing,
                options.config,
                options.agents,
                options.events,
                options.onProgress
              );
              resolve({ baseResult, stats });
            }
          } catch (fallbackErr) {
            reject(fallbackErr);
          }
        };

        worker.postMessage({
          type: options.mode === 'single' ? 'RUN_SINGLE' : 'RUN_MONTE_CARLO',
          jobId,
          demands: options.demands,
          staffing: options.staffing,
          config: options.config,
          agents: options.agents,
          events: options.events,
        });
      });
    } catch (workerErr) {
      console.warn('Web worker instantiation failed, falling back to main thread:', workerErr);
    }
  }

  // Graceful main-thread fallback
  if (options.mode === 'single') {
    const prng = new PRNG(options.config.seed ?? 42);
    const baseResult = runSingleSimulation(
      options.demands,
      options.staffing,
      options.config,
      prng,
      options.agents,
      options.events
    );
    return { baseResult, stats: null };
  } else {
    const { baseResult, stats } = runMonteCarloSimulation(
      options.demands,
      options.staffing,
      options.config,
      options.agents,
      options.events,
      options.onProgress
    );
    return { baseResult, stats };
  }
}
