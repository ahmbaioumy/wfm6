import { runSingleSimulation, runMonteCarloSimulation, PRNG } from '../engines/des';
import { WorkforceConfig, DemandRow, IntervalStaffing, SyntheticAgent, AgentAvailabilityEvent } from '../types';

export interface SimulationWorkerPayload {
  type: 'RUN_SINGLE' | 'RUN_MONTE_CARLO';
  jobId: string;
  demands: DemandRow[];
  staffing: IntervalStaffing[];
  config: WorkforceConfig;
  agents?: SyntheticAgent[];
  events?: AgentAvailabilityEvent[];
}

self.addEventListener('message', (e: MessageEvent<SimulationWorkerPayload>) => {
  const { type, jobId, demands, staffing, config, agents, events } = e.data || {};
  if (!type || !jobId) return;

  try {
    if (type === 'RUN_SINGLE') {
      const prng = new PRNG(config.seed ?? 42);
      const baseResult = runSingleSimulation(demands, staffing, config, prng, agents, events);
      self.postMessage({
        jobId,
        type: 'DONE',
        baseResult,
        stats: null,
      });
    } else if (type === 'RUN_MONTE_CARLO') {
      const { baseResult, stats } = runMonteCarloSimulation(
        demands,
        staffing,
        config,
        agents,
        events,
        (pct: number) => {
          self.postMessage({
            jobId,
            type: 'PROGRESS',
            progress: pct,
          });
        }
      );
      self.postMessage({
        jobId,
        type: 'DONE',
        baseResult,
        stats,
      });
    }
  } catch (error: any) {
    self.postMessage({
      jobId,
      type: 'ERROR',
      error: error?.message || String(error),
    });
  }
});

