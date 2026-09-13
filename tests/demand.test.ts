import { describe, it, expect } from 'vitest';
import {
  parseDemandCSVAdvanced,
  parseQuotedCSV,
  detectIntervalMinutes,
  parseDateTimeToEpochSeconds,
} from '../src/data/sampleDemand';

describe('Demand Parser & Chronological Sequencing (Tests 9-14)', () => {
  // Test 9: RFC 4180 parsing with quotes and commas inside quotes
  it('Test 9: Correctly parses RFC 4180 CSV with quotes and embedded commas', () => {
    const csv = `date,interval,volume,aht,segment\n"01/09/2026","08:00",45,300,"Voice, Inbound Tier 1"\n"01/09/2026","08:30",55,310,"Voice, VIP"`;
    const parsedRows = parseQuotedCSV(csv);
    expect(parsedRows.length).toBe(3); // header + 2 data rows
    expect(parsedRows[1][4]).toBe('Voice, Inbound Tier 1');
    expect(parsedRows[2][4]).toBe('Voice, VIP');
  });

  // Test 10: Chronological timestamp ordering across intervals and days
  it('Test 10: Sorts intervals chronologically regardless of input row order', () => {
    // Unordered CSV with afternoon interval before morning
    const csv = `date,interval,volume,aht,segment
01/09/2026,14:00,50,300,Voice
01/09/2026,08:30,20,300,Voice
01/09/2026,08:00,10,300,Voice
02/09/2026,08:00,15,300,Voice`;

    const result = parseDemandCSVAdvanced(csv);
    expect(result.demands.length).toBe(4);
    expect(result.demands[0].intervalStart).toBe('08:00');
    expect(result.demands[0].date).toBe('01/09/2026');
    expect(result.demands[1].intervalStart).toBe('08:30');
    expect(result.demands[2].intervalStart).toBe('14:00');
    expect(result.demands[3].date).toBe('02/09/2026');
  });

  // Test 11: Automatic interval duration detection (15m, 30m, 60m)
  it('Test 11: Automatically detects 15-minute, 30-minute, and 60-minute intervals', () => {
    const csv30 = `date,interval,volume,aht\n01/09/2026,08:00,10,300\n01/09/2026,08:30,20,300`;
    const res30 = parseDemandCSVAdvanced(csv30);
    expect(res30.detectedIntervalMinutes).toBe(30);

    const csv15 = `date,interval,volume,aht\n01/09/2026,08:00,10,300\n01/09/2026,08:15,20,300\n01/09/2026,08:30,25,300`;
    const res15 = parseDemandCSVAdvanced(csv15);
    expect(res15.detectedIntervalMinutes).toBe(15);

    const csv60 = `date,interval,volume,aht\n01/09/2026,08:00,10,300\n01/09/2026,09:00,20,300\n01/09/2026,10:00,30,300`;
    const res60 = parseDemandCSVAdvanced(csv60);
    expect(res60.detectedIntervalMinutes).toBe(60);
  });

  // Test 12: Deduplication handling (identical vs conflicting)
  it('Test 12: Deduplicates identical rows and issues warning for conflicting duplicates', () => {
    const csv = `date,interval,volume,aht,segment
01/09/2026,08:00,25,300,Voice
01/09/2026,08:00,25,300,Voice
01/09/2026,08:30,30,300,Voice
01/09/2026,08:30,40,300,Voice`;

    const result = parseDemandCSVAdvanced(csv);
    // Should have 2 unique interval keys (08:00 and 08:30)
    expect(result.demands.length).toBe(2);
    expect(result.duplicateCount).toBe(1);
    expect(result.conflictingDuplicateCount).toBe(1);
    expect(result.warnings.some(w => w.includes('Conflicting duplicate'))).toBe(true);
  });

  // Test 13: Multi-segment and multi-channel detection
  it('Test 13: Extracts multiple segments and assigns proper channels (voice/chat/email)', () => {
    const csv = `date,interval,volume,aht,segment,channel
01/09/2026,08:00,30,300,English Voice,voice
01/09/2026,08:00,50,600,Web Chat,chat
01/09/2026,08:00,20,900,Support Email,email`;

    const result = parseDemandCSVAdvanced(csv);
    expect(result.uniqueSegments.length).toBe(3);
    const chatDemand = result.demands.find(d => d.segment === 'Web Chat');
    expect(chatDemand?.channel).toBe('chat');
    const voiceDemand = result.demands.find(d => d.segment === 'English Voice');
    expect(voiceDemand?.channel).toBe('voice');
  });

  // Test 14: Missing data handling (keep_missing vs interpolate)
  it('Test 14: Handles missing data strategies according to configuration', () => {
    const csvWithGap = `date,interval,volume,aht
01/09/2026,08:00,20,300
01/09/2026,09:00,40,300`;

    // Strategy: keep_missing
    const resKeep = parseDemandCSVAdvanced(csvWithGap, {
      intervalMinutesOverride: 30,
      missingDataStrategy: 'keep_missing',
    });
    expect(resKeep.demands.length).toBe(2);

    // Strategy: interpolate
    const resInterp = parseDemandCSVAdvanced(csvWithGap, {
      intervalMinutesOverride: 30,
      missingDataStrategy: 'interpolate',
    });
    expect(resInterp.demands.length).toBe(3); // 08:00, 08:30 (interpolated), 09:00
    const mid = resInterp.demands.find(d => d.intervalStart === '08:30');
    expect(mid).toBeDefined();
    expect(mid?.volume).toBe(30); // Linear midpoint between 20 and 40
  });

  // Bug 2 Regression Tests: Date disambiguation DD/MM vs MM/DD and dateFormatHint
  it('Bug 2 Regression: parseDateTimeToEpochSeconds defaults to DMY for ambiguous dates and respects dateFormatHint', () => {
    // 03/04/2026: ambiguous (both 3 and 4 <= 12)
    const dmyEpoch = parseDateTimeToEpochSeconds('03/04/2026', '08:00'); // auto/default -> DMY: April 3, 2026
    expect(dmyEpoch).toBe(Math.floor(Date.UTC(2026, 3, 3, 8, 0, 0) / 1000));

    // Explicit DMY
    const explicitDMY = parseDateTimeToEpochSeconds('03/04/2026', '08:00', 'DMY');
    expect(explicitDMY).toBe(Math.floor(Date.UTC(2026, 3, 3, 8, 0, 0) / 1000));

    // Explicit MDY -> March 4, 2026
    const explicitMDY = parseDateTimeToEpochSeconds('03/04/2026', '08:00', 'MDY');
    expect(explicitMDY).toBe(Math.floor(Date.UTC(2026, 2, 4, 8, 0, 0) / 1000));
    expect(explicitMDY).not.toBe(dmyEpoch);

    // Unambiguous DMY: 25/03/2026
    expect(parseDateTimeToEpochSeconds('25/03/2026', '08:00')).toBe(
      Math.floor(Date.UTC(2026, 2, 25, 8, 0, 0) / 1000)
    );

    // Unambiguous MDY: 03/25/2026
    expect(parseDateTimeToEpochSeconds('03/25/2026', '08:00')).toBe(
      Math.floor(Date.UTC(2026, 2, 25, 8, 0, 0) / 1000)
    );
  });

  it('Bug 2 Regression: parseDemandCSVAdvanced produces warning in auto mode for ambiguous dates and suppresses it with explicit hint', () => {
    const csvAmbiguous = `date,interval,volume,aht\n03/04/2026,08:00,10,300`;

    // Auto mode produces warning
    const resAuto = parseDemandCSVAdvanced(csvAmbiguous);
    expect(resAuto.warnings.some(w => w.includes('Date format is ambiguous'))).toBe(true);
    expect(resAuto.demands[0].timestamp).toBe(Math.floor(Date.UTC(2026, 3, 3, 8, 0, 0) / 1000));

    // Explicit MDY hint suppresses warning and correctly parses as March 4, 2026
    const resMDY = parseDemandCSVAdvanced(csvAmbiguous, { dateFormatHint: 'MDY' });
    expect(resMDY.warnings.some(w => w.includes('Date format is ambiguous'))).toBe(false);
    expect(resMDY.demands[0].timestamp).toBe(Math.floor(Date.UTC(2026, 2, 4, 8, 0, 0) / 1000));

    // Explicit DMY hint suppresses warning and correctly parses as April 3, 2026
    const resDMY = parseDemandCSVAdvanced(csvAmbiguous, { dateFormatHint: 'DMY' });
    expect(resDMY.warnings.some(w => w.includes('Date format is ambiguous'))).toBe(false);
    expect(resDMY.demands[0].timestamp).toBe(Math.floor(Date.UTC(2026, 3, 3, 8, 0, 0) / 1000));
  });

  // Bug 4 Regression Tests: MissingDataStrategy implementations and warning
  it('Bug 4 Regression: zero_fill fills missing intervals with volume 0', () => {
    const csvWithGap = `date,interval,volume,aht\n01/09/2026,08:00,50,300\n01/09/2026,09:00,80,300`;
    const resZero = parseDemandCSVAdvanced(csvWithGap, {
      intervalMinutesOverride: 30,
      missingDataStrategy: 'zero_fill',
    });
    expect(resZero.demands.length).toBe(3);
    const mid = resZero.demands.find(d => d.intervalStart === '08:30');
    expect(mid).toBeDefined();
    expect(mid?.volume).toBe(0);
  });

  it('Bug 4 Regression: forward_fill fills missing intervals with preceding interval values', () => {
    const csvWithGap = `date,interval,volume,aht\n01/09/2026,08:00,45,240\n01/09/2026,09:00,80,300`;
    const resFwd = parseDemandCSVAdvanced(csvWithGap, {
      intervalMinutesOverride: 30,
      missingDataStrategy: 'forward_fill',
    });
    expect(resFwd.demands.length).toBe(3);
    const mid = resFwd.demands.find(d => d.intervalStart === '08:30');
    expect(mid).toBeDefined();
    expect(mid?.volume).toBe(45);
    expect(mid?.ahtSeconds).toBe(240);
  });

  it('Bug 4 Regression: backward_fill fills missing intervals with succeeding interval values', () => {
    const csvWithGap = `date,interval,volume,aht\n01/09/2026,08:00,45,240\n01/09/2026,09:00,80,320`;
    const resBack = parseDemandCSVAdvanced(csvWithGap, {
      intervalMinutesOverride: 30,
      missingDataStrategy: 'backward_fill',
    });
    expect(resBack.demands.length).toBe(3);
    const mid = resBack.demands.find(d => d.intervalStart === '08:30');
    expect(mid).toBeDefined();
    expect(mid?.volume).toBe(80);
    expect(mid?.ahtSeconds).toBe(320);
  });

  it('Bug 4 Regression: unimplemented strategy emits warning in warnings array', () => {
    const csv = `date,interval,volume,aht\n01/09/2026,08:00,50,300\n01/09/2026,09:00,80,300`;
    const res = parseDemandCSVAdvanced(csv, {
      intervalMinutesOverride: 30,
      missingDataStrategy: 'non_existent_strategy' as any,
    });
    expect(res.warnings.some(w => w.includes('is not yet implemented; defaulted to keep_missing'))).toBe(true);
  });
});
