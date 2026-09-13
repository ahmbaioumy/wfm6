import { describe, it, expect } from 'vitest';
import {
  calculateErlangB,
  calculateErlangC,
  calculateErlangA,
  solveRequiredStaffing,
} from '../src/engines/erlang';

describe('Erlang Benchmark Engine (Tests 1-8)', () => {
  // Test 1: Erlang B blocking probability
  it('Test 1: Erlang B calculates blocking probability accurately', () => {
    // 10 Erlangs of traffic on 10 servers
    const b1 = calculateErlangB(10, 10);
    expect(b1).toBeGreaterThan(0.20);
    expect(b1).toBeLessThan(0.25);

    // More servers than traffic reduces blocking
    const b2 = calculateErlangB(15, 10);
    expect(b2).toBeLessThan(b1);
    expect(b2).toBeGreaterThan(0.02);
    expect(b2).toBeLessThan(0.06);
  });

  // Test 2: Erlang C wait probability and SLA
  it('Test 2: Erlang C computes P(Wait > 0), SLA, ASA, and Occupancy', () => {
    const traffic = 16.67; // 200 calls/hr * 300s AHT / 3600s
    const servers = 20;
    const aht = 300;
    const res = calculateErlangC(servers, traffic, aht, 20);

    expect(res.occupancy).toBeCloseTo(traffic / servers, 3);
    expect(res.probWait).toBeGreaterThan(0);
    expect(res.probWait).toBeLessThan(1);
    expect(res.sla).toBeGreaterThan(0.70);
    expect(res.sla).toBeLessThan(1.0);
    expect(res.asa).toBeGreaterThan(0);
    expect(res.asa).toBeLessThan(40);
  });

  // Test 3: Erlang C unstable condition (traffic >= servers)
  it('Test 3: Erlang C handles overload / unstable condition gracefully', () => {
    const traffic = 25;
    const servers = 20;
    const res = calculateErlangC(servers, traffic, 300, 20);

    expect(res.occupancy).toBe(1.0);
    expect(res.sla).toBe(0.0);
    expect(res.probWait).toBe(1.0);
  });

  // Test 4: Erlang A with customer abandonment
  it('Test 4: Erlang A computes abandonment probability based on customer patience', () => {
    const traffic = 20;
    const servers = 20;
    const aht = 300;
    const patience = 60; // short patience = higher abandonment
    const res = calculateErlangA(servers, traffic, aht, patience, 20);

    expect(res.abandonProb).toBeGreaterThan(0.01);
    expect(res.abandonProb).toBeLessThan(0.50);
    expect(res.occupancy).toBeLessThanOrEqual(1.0);
  });

  // Test 5: Erlang A with infinite patience approaches Erlang C
  it('Test 5: Erlang A with high patience has lower abandonment than short patience', () => {
    const traffic = 18;
    const servers = 20;
    const aht = 300;
    const shortPatience = calculateErlangA(servers, traffic, aht, 30, 20);
    const longPatience = calculateErlangA(servers, traffic, aht, 600, 20);

    expect(shortPatience.abandonProb).toBeGreaterThan(longPatience.abandonProb);
  });

  // Test 6: Zero traffic and zero server edge cases
  it('Test 6: Handles edge cases (zero traffic, zero servers) safely without NaN', () => {
    const zeroTrafficC = calculateErlangC(10, 0, 300, 20);
    expect(zeroTrafficC.sla).toBe(1.0);
    expect(zeroTrafficC.asa).toBe(0.0);
    expect(zeroTrafficC.occupancy).toBe(0.0);

    const zeroTrafficB = calculateErlangB(10, 0);
    expect(zeroTrafficB).toBe(0.0);

    const zeroServersB = calculateErlangB(0, 10);
    expect(zeroServersB).toBe(1.0);
  });

  // Test 7: Required staffing solver for Erlang C
  it('Test 7: solveRequiredStaffing meets SLA target and respects max occupancy', () => {
    const traffic = 15; // 15 Erlangs
    const aht = 300;
    const targetSla = 0.80; // 80%
    const targetSec = 20;
    const maxOcc = 0.85;

    const requiredAgents = solveRequiredStaffing(
      traffic,
      aht,
      targetSla,
      targetSec,
      maxOcc,
      1,
      'erlang_c'
    );

    expect(requiredAgents).toBeGreaterThan(traffic); // Must be greater than Erlangs
    const check = calculateErlangC(requiredAgents, traffic, aht, targetSec);
    expect(check.sla).toBeGreaterThanOrEqual(targetSla);
    expect(check.occupancy).toBeLessThanOrEqual(maxOcc);
  });

  // Test 8: Required staffing solver for Erlang A and Erlang B
  it('Test 8: solveRequiredStaffing supports Erlang A and Erlang B models', () => {
    const traffic = 12;
    const aht = 240;

    const reqA = solveRequiredStaffing(traffic, aht, 0.85, 20, 0.85, 1, 'erlang_a', 90);
    expect(reqA).toBeGreaterThanOrEqual(Math.ceil(traffic));

    const reqB = solveRequiredStaffing(traffic, aht, 0.95, 20, 0.90, 1, 'erlang_b');
    expect(reqB).toBeGreaterThanOrEqual(Math.ceil(traffic));
    const blocking = calculateErlangB(reqB, traffic);
    expect(blocking).toBeLessThanOrEqual(0.05); // 1 - 0.95
  });
});
