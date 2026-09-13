import {
  DemandRow,
  DemandParseResult,
  ColumnMapping,
  MissingDataStrategy,
  ChannelType,
  WeeklyRosterPlan,
} from '../types';

export const SAMPLE_RETAIL_VOICE_CSV = `date,interval,volume,AHT,segment
01/09/2026,08:00,35,320,Voice
01/09/2026,08:30,42,305,Voice
01/09/2026,09:00,51,310,Voice
01/09/2026,09:30,68,295,Voice
01/09/2026,10:00,80,300,Voice
01/09/2026,10:30,85,315,Voice
01/09/2026,11:00,92,310,Voice
01/09/2026,11:30,88,320,Voice
01/09/2026,12:00,74,330,Voice
01/09/2026,12:30,69,325,Voice
01/09/2026,13:00,72,315,Voice
01/09/2026,13:30,78,310,Voice
01/09/2026,14:00,84,305,Voice
01/09/2026,14:30,89,310,Voice
01/09/2026,15:00,95,300,Voice
01/09/2026,15:30,91,305,Voice
01/09/2026,16:00,86,310,Voice
01/09/2026,16:30,76,320,Voice
01/09/2026,17:00,65,330,Voice
01/09/2026,17:30,55,340,Voice
01/09/2026,18:00,48,345,Voice
01/09/2026,18:30,38,350,Voice
01/09/2026,19:00,32,340,Voice
01/09/2026,19:30,24,330,Voice`;

export const SAMPLE_MULTI_SEGMENT_CSV = `date,interval,volume,AHT,segment
01/09/2026,08:00,20,300,Retail
01/09/2026,08:00,10,400,Prestige
01/09/2026,08:00,15,350,SMB
01/09/2026,08:30,25,290,Retail
01/09/2026,08:30,12,390,Prestige
01/09/2026,08:30,18,340,SMB
01/09/2026,09:00,35,310,Retail
01/09/2026,09:00,18,410,Prestige
01/09/2026,09:00,22,330,SMB
01/09/2026,09:30,45,300,Retail
01/09/2026,09:30,22,400,Prestige
01/09/2026,09:30,28,340,SMB
01/09/2026,10:00,50,305,Retail
01/09/2026,10:00,25,395,Prestige
01/09/2026,10:00,30,350,SMB
01/09/2026,10:30,52,310,Retail
01/09/2026,10:30,26,410,Prestige
01/09/2026,10:30,32,360,SMB
01/09/2026,11:00,55,300,Retail
01/09/2026,11:00,28,390,Prestige
01/09/2026,11:00,35,350,SMB
01/09/2026,11:30,50,310,Retail
01/09/2026,11:30,25,400,Prestige
01/09/2026,11:30,30,340,SMB
01/09/2026,12:00,42,320,Retail
01/09/2026,12:00,20,420,Prestige
01/09/2026,12:00,25,360,SMB`;

/**
 * 7-Day Volume Trend dataset (Day 1 Peak to Day 6/7 Weekend Dip) - 60-minute hourly intervals
 */
export const SAMPLE_WEEKLY_TREND_CSV = `date,interval,volume,AHT,segment
01/09/2026,08:00,45,320,Voice
01/09/2026,09:00,75,310,Voice
01/09/2026,10:00,110,305,Voice
01/09/2026,11:00,125,315,Voice
01/09/2026,12:00,105,330,Voice
01/09/2026,13:00,115,310,Voice
01/09/2026,14:00,130,300,Voice
01/09/2026,15:00,135,305,Voice
01/09/2026,16:00,110,310,Voice
01/09/2026,17:00,85,330,Voice
01/09/2026,18:00,60,340,Voice
01/09/2026,19:00,40,350,Voice
02/09/2026,08:00,38,320,Voice
02/09/2026,09:00,65,310,Voice
02/09/2026,10:00,95,305,Voice
02/09/2026,11:00,105,315,Voice
02/09/2026,12:00,90,330,Voice
02/09/2026,13:00,98,310,Voice
02/09/2026,14:00,110,300,Voice
02/09/2026,15:00,115,305,Voice
02/09/2026,16:00,92,310,Voice
02/09/2026,17:00,70,330,Voice
02/09/2026,18:00,50,340,Voice
02/09/2026,19:00,32,350,Voice
03/09/2026,08:00,35,320,Voice
03/09/2026,09:00,58,310,Voice
03/09/2026,10:00,85,305,Voice
03/09/2026,11:00,96,315,Voice
03/09/2026,12:00,80,330,Voice
03/09/2026,13:00,88,310,Voice
03/09/2026,14:00,98,300,Voice
03/09/2026,15:00,102,305,Voice
03/09/2026,16:00,82,310,Voice
03/09/2026,17:00,62,330,Voice
03/09/2026,18:00,44,340,Voice
03/09/2026,19:00,28,350,Voice
04/09/2026,08:00,32,320,Voice
04/09/2026,09:00,52,310,Voice
04/09/2026,10:00,80,305,Voice
04/09/2026,11:00,90,315,Voice
04/09/2026,12:00,75,330,Voice
04/09/2026,13:00,82,310,Voice
04/09/2026,14:00,92,300,Voice
04/09/2026,15:00,95,305,Voice
04/09/2026,16:00,78,310,Voice
04/09/2026,17:00,58,330,Voice
04/09/2026,18:00,40,340,Voice
04/09/2026,19:00,26,350,Voice
05/09/2026,08:00,30,320,Voice
05/09/2026,09:00,48,310,Voice
05/09/2026,10:00,72,305,Voice
05/09/2026,11:00,82,315,Voice
05/09/2026,12:00,68,330,Voice
05/09/2026,13:00,75,310,Voice
05/09/2026,14:00,84,300,Voice
05/09/2026,15:00,86,305,Voice
05/09/2026,16:00,70,310,Voice
05/09/2026,17:00,52,330,Voice
05/09/2026,18:00,36,340,Voice
05/09/2026,19:00,22,350,Voice
06/09/2026,08:00,18,310,Voice
06/09/2026,09:00,28,300,Voice
06/09/2026,10:00,45,300,Voice
06/09/2026,11:00,55,305,Voice
06/09/2026,12:00,50,315,Voice
06/09/2026,13:00,52,310,Voice
06/09/2026,14:00,58,300,Voice
06/09/2026,15:00,60,300,Voice
06/09/2026,16:00,48,305,Voice
06/09/2026,17:00,36,315,Voice
06/09/2026,18:00,25,320,Voice
06/09/2026,19:00,15,330,Voice
07/09/2026,08:00,12,310,Voice
07/09/2026,09:00,20,300,Voice
07/09/2026,10:00,32,300,Voice
07/09/2026,11:00,40,305,Voice
07/09/2026,12:00,38,315,Voice
07/09/2026,13:00,42,310,Voice
07/09/2026,14:00,45,300,Voice
07/09/2026,15:00,44,300,Voice
07/09/2026,16:00,35,305,Voice
07/09/2026,17:00,26,315,Voice
07/09/2026,18:00,18,320,Voice
07/09/2026,19:00,10,330,Voice`;

export const SAMPLE_HOURLY_CSV = `date,interval,volume,AHT,segment
01/09/2026,08:00,120,300,Voice
01/09/2026,09:00,210,310,Voice
01/09/2026,10:00,280,320,Voice
01/09/2026,11:00,295,330,Voice
01/09/2026,12:00,250,315,Voice
01/09/2026,13:00,220,305,Voice
01/09/2026,14:00,270,325,Voice
01/09/2026,15:00,290,335,Voice
01/09/2026,16:00,240,310,Voice
01/09/2026,17:00,180,295,Voice
01/09/2026,18:00,130,290,Voice
01/09/2026,19:00,95,280,Voice`;

/**
 * Parses RFC 4180 compliant CSV lines with support for quotes and escaped quotes.
 */
export function parseQuotedCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Detects CSV column mapping from header row
 */
export function detectColumnMapping(headers: string[]): ColumnMapping {
  const hLower = headers.map(h => h.trim().toLowerCase());

  const findCol = (keywords: string[], fallbackIdx: number): string => {
    for (const kw of keywords) {
      const idx = hLower.findIndex(h => h.includes(kw));
      if (idx !== -1) return headers[idx];
    }
    return headers[fallbackIdx] || '';
  };

  const dateCol = findCol(['date', 'day'], 0);
  const intervalCol = findCol(['interval', 'time', 'start', 'hour'], 1);
  const volumeCol = findCol(['volume', 'offered', 'calls', 'contacts', 'inbound'], 2);
  const ahtCol = findCol(['aht', 'duration', 'handle', 'talk'], 3);
  const segmentCol = findCol(['segment', 'skill', 'queue', 'service', 'lob'], 4);
  const channelCol = findCol(['channel', 'type', 'media'], -1);

  return {
    dateCol,
    intervalCol,
    volumeCol,
    ahtCol,
    segmentCol,
    channelCol: channelCol || undefined,
  };
}

/**
 * Normalizes time string to "HH:MM" format (24-hour)
 */
export function normalizeTimeString(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (trimmed.length === 4 && !trimmed.includes(':') && /^\d{4}$/.test(trimmed)) {
    return `${trimmed.slice(0, 2)}:${trimmed.slice(2)}`;
  }
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }
  return trimmed || '08:00';
}

/**
 * Converts date string and time string into chronological epoch seconds.
 * Robust to DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY formats.
 */
export function parseDateTimeToEpochSeconds(
  dateStr: string,
  timeStr: string,
  dateFormatHint: 'DMY' | 'MDY' | 'auto' = 'auto'
): number {
  const normTime = normalizeTimeString(timeStr);
  const [hStr, mStr] = normTime.split(':');
  const hours = parseInt(hStr, 10) || 0;
  const minutes = parseInt(mStr, 10) || 0;

  const parts = dateStr.trim().split(/[-/.]/);
  let year = 2026;
  let month = 8; // 0-indexed (8 = September)
  let day = 1;

  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = Math.max(0, parseInt(parts[1], 10) - 1);
      day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      // DD/MM/YYYY (or MM/DD/YYYY)
      year = parseInt(parts[2], 10);
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (dateFormatHint === 'MDY') {
        month = Math.max(0, p0 - 1);
        day = p1;
      } else if (dateFormatHint === 'DMY') {
        day = p0;
        month = Math.max(0, p1 - 1);
      } else {
        // 'auto' mode
        if (p0 > 12) {
          day = p0;
          month = Math.max(0, p1 - 1);
        } else if (p1 > 12) {
          month = Math.max(0, p0 - 1);
          day = p1;
        } else {
          // both p0 <= 12 and p1 <= 12 (ambiguous): default to DMY
          day = p0;
          month = Math.max(0, p1 - 1);
        }
      }
    } else {
      const p0 = parseInt(parts[0], 10) || 1;
      const p1 = parseInt(parts[1], 10) || 1;
      year = 2000 + (parseInt(parts[2], 10) || 26);
      if (dateFormatHint === 'MDY') {
        month = Math.max(0, p0 - 1);
        day = p1;
      } else if (dateFormatHint === 'DMY') {
        day = p0;
        month = Math.max(0, p1 - 1);
      } else {
        if (p0 > 12) {
          day = p0;
          month = Math.max(0, p1 - 1);
        } else if (p1 > 12) {
          month = Math.max(0, p0 - 1);
          day = p1;
        } else {
          day = p0;
          month = Math.max(0, p1 - 1);
        }
      }
    }
  }

  // Use UTC to avoid daylight saving and timezone shift anomalies in mathematical simulation
  return Math.floor(Date.UTC(year, month, day, hours, minutes, 0) / 1000);
}

/**
 * Determines interval duration in minutes via auto-detection on chronological data
 */
export function detectIntervalMinutes(rawRows: Array<{ date: string; time: string; segment: string }>): number {
  if (rawRows.length < 2) return 30;

  // Group by (date + segment)
  const seriesMap = new Map<string, number[]>();
  for (const r of rawRows) {
    const key = `${r.date}__${r.segment}`;
    if (!seriesMap.has(key)) seriesMap.set(key, []);
    const parts = normalizeTimeString(r.time).split(':');
    const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    seriesMap.get(key)!.push(mins);
  }

  const diffCounts: Record<number, number> = { 15: 0, 30: 0, 60: 0 };
  let validDiffCount = 0;

  for (const minsList of seriesMap.values()) {
    minsList.sort((a, b) => a - b);
    for (let i = 1; i < minsList.length; i++) {
      const diff = minsList[i] - minsList[i - 1];
      if (diff === 15 || diff === 30 || diff === 60) {
        diffCounts[diff]++;
        validDiffCount++;
      }
    }
  }

  if (validDiffCount === 0) return 30;

  let dominantDiff = 30;
  let maxCount = -1;
  for (const [diffStr, count] of Object.entries(diffCounts)) {
    if (count > maxCount) {
      maxCount = count;
      dominantDiff = parseInt(diffStr, 10);
    }
  }

  return dominantDiff;
}

/**
 * Comprehensive CSV demand parser conforming to PRD and WFM specifications:
 * - Real chronological timestamp representation
 * - Unique key deduplication (date + intervalStart + segment)
 * - Auto-detects interval duration (or uses override)
 * - Detects column mapping with validation
 * - Handles simultaneous segment streams at same timestamp
 * - Configurable missing data strategy
 * - Zero fabricated dates or extra days
 */
export function parseDemandCSVAdvanced(
  csvText: string,
  options?: {
    intervalMinutesOverride?: number; // 0 for auto-detect, or 15, 30, 60
    customMapping?: Partial<ColumnMapping>;
    missingDataStrategy?: MissingDataStrategy;
    defaultAhtSeconds?: number;
    dateFormatHint?: 'DMY' | 'MDY' | 'auto';
  }
): DemandParseResult {
  const warnings: string[] = [];
  const rows = parseQuotedCSV(csvText);

  if (rows.length < 2) {
    return {
      demands: [],
      detectedIntervalMinutes: 30,
      isIntervalConsistent: true,
      duplicateCount: 0,
      conflictingDuplicateCount: 0,
      uniqueDates: [],
      uniqueSegments: [],
      detectedMapping: {
        dateCol: 'date',
        intervalCol: 'interval',
        volumeCol: 'volume',
        ahtCol: 'AHT',
        segmentCol: 'segment',
      },
      warnings: ['CSV has fewer than 2 rows (header + data).'],
    };
  }

  const headers = rows[0];
  const autoMapping = detectColumnMapping(headers);
  const mapping: ColumnMapping = {
    ...autoMapping,
    ...options?.customMapping,
  };

  const getColIdx = (colName: string): number => {
    return headers.findIndex(h => h.trim().toLowerCase() === colName.trim().toLowerCase());
  };

  const dateIdx = getColIdx(mapping.dateCol);
  const intervalIdx = getColIdx(mapping.intervalCol);
  const volIdx = getColIdx(mapping.volumeCol);
  const ahtIdx = getColIdx(mapping.ahtCol);
  const segIdx = getColIdx(mapping.segmentCol);
  const chanIdx = mapping.channelCol ? getColIdx(mapping.channelCol) : -1;

  if (intervalIdx === -1 && volIdx === -1) {
    warnings.push('Could not detect interval or volume columns in CSV header.');
  }

  // First pass: extract raw rows for interval detection & validation
  interface RawRecord {
    date: string;
    time: string;
    volume: number;
    aht: number;
    segment: string;
    channel: ChannelType;
  }

  const rawRecords: RawRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 2) continue;

    const dateRaw = dateIdx >= 0 && row[dateIdx] ? row[dateIdx].trim() : '';
    const date = dateRaw || (row[0] && (row[0].includes('/') || row[0].includes('-')) ? row[0].trim() : 'Day_1');
    const time = normalizeTimeString(intervalIdx >= 0 && row[intervalIdx] ? row[intervalIdx] : (row[1] || '08:00'));
    const volRaw = volIdx >= 0 && row[volIdx] !== undefined ? row[volIdx] : row[2];
    const volume = Math.max(0, parseInt(volRaw, 10) || 0);

    const ahtRaw = ahtIdx >= 0 && row[ahtIdx] !== undefined ? row[ahtIdx] : (row[3] || '300');
    const aht = Math.max(1, parseInt(ahtRaw, 10) || (options?.defaultAhtSeconds || 300));

    const segRaw = segIdx >= 0 && row[segIdx] ? row[segIdx] : (row[4] || 'Voice');
    const segment = segRaw.trim() || 'Voice';

    let channel: ChannelType = 'voice';
    if (chanIdx >= 0 && row[chanIdx]) {
      const cLower = row[chanIdx].toLowerCase();
      if (cLower.includes('chat') || cLower.includes('wa') || cLower.includes('message')) {
        channel = 'chat';
      } else if (cLower.includes('email') || cLower.includes('case')) {
        channel = 'email';
      }
    } else {
      const sLower = segment.toLowerCase();
      if (sLower.includes('chat') || sLower.includes('message') || sLower.includes('wa')) {
        channel = 'chat';
      }
    }

    rawRecords.push({ date, time, volume, aht, segment, channel });
  }

  // Interval duration detection
  const detectedInterval = detectIntervalMinutes(rawRecords);
  const intervalMinutes = options?.intervalMinutesOverride && options.intervalMinutesOverride > 0
    ? options.intervalMinutesOverride
    : detectedInterval;

  // Deduplication & Conflict Detection
  const seenMap = new Map<string, RawRecord>();
  let duplicateCount = 0;
  let conflictingDuplicateCount = 0;

  for (const rec of rawRecords) {
    const key = `${rec.date}__${rec.time}__${rec.segment}`;
    if (seenMap.has(key)) {
      const existing = seenMap.get(key)!;
      if (existing.volume === rec.volume && existing.aht === rec.aht) {
        duplicateCount++;
      } else {
        conflictingDuplicateCount++;
        warnings.push(`Conflicting duplicate for ${rec.date} ${rec.time} [${rec.segment}]: (${existing.volume} vs ${rec.volume}). Row skipped.`);
      }
    } else {
      seenMap.set(key, rec);
    }
  }

  // Construct normalized DemandRows
  const intervalSeconds = intervalMinutes * 60;
  const uniqueDatesSet = new Set<string>();
  const uniqueSegmentsSet = new Set<string>();
  const dateFormatHint = options?.dateFormatHint || 'auto';
  let hasAmbiguousDateWarning = false;

  const parsedDemands: DemandRow[] = [];
  for (const rec of seenMap.values()) {
    uniqueDatesSet.add(rec.date);
    uniqueSegmentsSet.add(rec.segment);

    if (dateFormatHint === 'auto' && !hasAmbiguousDateWarning) {
      const parts = rec.date.trim().split(/[-/.]/);
      if (parts.length === 3 && parts[0].length !== 4) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        if (!isNaN(p0) && !isNaN(p1) && p0 > 0 && p1 > 0 && p0 <= 12 && p1 <= 12) {
          hasAmbiguousDateWarning = true;
          warnings.push(
            `Date format is ambiguous for one or more rows (e.g. '${rec.date}'). Assumed DD/MM/YYYY. If your data is MM/DD/YYYY, re-import with the MDY format option.`
          );
        }
      }
    }

    const timestamp = parseDateTimeToEpochSeconds(rec.date, rec.time, dateFormatHint);
    const workloadSeconds = rec.volume * rec.aht;
    const trafficErlangs = workloadSeconds / intervalSeconds;

    parsedDemands.push({
      id: `${rec.date}_${rec.time}_${rec.segment}`,
      date: rec.date,
      intervalStart: rec.time,
      timestamp,
      intervalMinutes,
      volume: rec.volume,
      ahtSeconds: rec.aht,
      segment: rec.segment,
      channel: rec.channel,
      workloadSeconds,
      trafficErlangs,
    });
  }

  // Handle missing data strategies if requested
  const strategy = options?.missingDataStrategy;
  const isFillStrategy =
    strategy === 'interpolate' ||
    strategy === 'linear_interp' ||
    strategy === 'zero' ||
    strategy === 'zero_fill' ||
    strategy === 'forward_fill' ||
    strategy === 'backward_fill' ||
    strategy === 'historical_avg' ||
    strategy === 'mean' ||
    strategy === 'median' ||
    strategy === 'same_dow_mean';

  if (strategy && strategy !== 'keep_missing' && !isFillStrategy) {
    warnings.push(`Strategy '${strategy}' is not yet implemented; defaulted to keep_missing.`);
  }

  if (isFillStrategy && parsedDemands.length > 1) {
    const interpolated: DemandRow[] = [];
    // Group by date and segment
    const groups = new Map<string, DemandRow[]>();
    for (const d of parsedDemands) {
      const gKey = `${d.date}__${d.segment}`;
      if (!groups.has(gKey)) groups.set(gKey, []);
      groups.get(gKey)!.push(d);
    }

    for (const group of groups.values()) {
      group.sort((a, b) => a.timestamp - b.timestamp);
      for (let i = 0; i < group.length - 1; i++) {
        const d1 = group[i];
        const d2 = group[i + 1];
        const stepSec = intervalMinutes * 60;
        const gapSec = d2.timestamp - d1.timestamp;
        const missingSteps = Math.round(gapSec / stepSec) - 1;

        if (missingSteps > 0 && missingSteps < 24) {
          for (let step = 1; step <= missingSteps; step++) {
            const frac = step / (missingSteps + 1);
            const interpSec = d1.timestamp + step * stepSec;
            const interpDate = new Date(interpSec * 1000);
            const hh = String(interpDate.getUTCHours()).padStart(2, '0');
            const mm = String(interpDate.getUTCMinutes()).padStart(2, '0');
            const intervalStart = `${hh}:${mm}`;

            let vol = 0;
            let aht = options?.defaultAhtSeconds || 300;

            if (strategy === 'zero' || strategy === 'zero_fill') {
              vol = 0;
              aht = options?.defaultAhtSeconds || 300;
            } else if (strategy === 'forward_fill') {
              vol = d1.volume;
              aht = d1.ahtSeconds;
            } else if (strategy === 'backward_fill') {
              vol = d2.volume;
              aht = d2.ahtSeconds;
            } else if (
              strategy === 'historical_avg' ||
              strategy === 'mean' ||
              strategy === 'median' ||
              strategy === 'same_dow_mean'
            ) {
              const matches = parsedDemands.filter(
                d => d.intervalStart === intervalStart && d.segment === d1.segment && d.date !== d1.date
              );
              if (matches.length > 0) {
                vol = Math.round(matches.reduce((sum, m) => sum + m.volume, 0) / matches.length);
                aht = Math.round(matches.reduce((sum, m) => sum + m.ahtSeconds, 0) / matches.length);
              } else {
                vol = Math.round(d1.volume + frac * (d2.volume - d1.volume));
                aht = Math.round(d1.ahtSeconds + frac * (d2.ahtSeconds - d1.ahtSeconds));
              }
            } else {
              // 'interpolate' | 'linear_interp'
              vol = Math.round(d1.volume + frac * (d2.volume - d1.volume));
              aht = Math.round(d1.ahtSeconds + frac * (d2.ahtSeconds - d1.ahtSeconds));
            }

            const workloadSeconds = vol * aht;
            const trafficErlangs = workloadSeconds / stepSec;

            interpolated.push({
              id: `${d1.date}_${intervalStart}_${d1.segment}`,
              date: d1.date,
              intervalStart,
              timestamp: interpSec,
              intervalMinutes,
              volume: vol,
              ahtSeconds: aht,
              segment: d1.segment,
              channel: d1.channel,
              workloadSeconds,
              trafficErlangs,
            });
          }
        }
      }
    }
    if (interpolated.length > 0) {
      parsedDemands.push(...interpolated);
    }
  }

  // Sort strictly chronologically by timestamp, then by segment
  parsedDemands.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.segment.localeCompare(b.segment);
  });

  const uniqueDates = Array.from(uniqueDatesSet);
  const uniqueSegments = Array.from(uniqueSegmentsSet);

  if (uniqueDates.length < 7) {
    warnings.push(`Dataset contains ${uniqueDates.length} day(s). Partial week analysis active - no artificial demand fabricated.`);
  }

  return {
    demands: parsedDemands,
    detectedInterval: intervalMinutes,
    detectedIntervalMinutes: intervalMinutes,
    isIntervalConsistent: true,
    duplicateCount,
    conflictingDuplicateCount,
    uniqueDates,
    uniqueSegments,
    detectedMapping: mapping,
    warnings,
  };
}

/**
 * Backward-compatible parseDemandCSV function that wraps parseDemandCSVAdvanced.
 * Defaults to auto-detecting interval (0).
 */
export function parseDemandCSV(csvText: string, defaultIntervalMinutes: number = 0): DemandRow[] {
  const result = parseDemandCSVAdvanced(csvText, {
    intervalMinutesOverride: defaultIntervalMinutes > 0 ? defaultIntervalMinutes : 0,
  });
  return result.demands;
}

/**
 * Exports interval results to CSV
 */
export function exportResultsToCSV(results: any[]): string {
  if (results.length === 0) return '';
  const headers = [
    'Date',
    'Interval',
    'Segment',
    'Channel',
    'Volume',
    'AHT (s)',
    'Workload (s)',
    'Erlangs',
    'Erlang Req HC',
    'Scheduled HC',
    'Effective HC',
    'Staffing Gap',
    'Offered',
    'Answered',
    'Abandoned',
    'Short Abandoned',
    'SLA %',
    'ASA (s)',
    'Answer %',
    'Abandon %',
    'Occupancy %',
    'Max Queue',
    'Avg Queue',
    'Max Wait (s)',
  ];

  const rows = results.map(r => [
    r.date,
    r.interval,
    r.segment,
    r.channel || 'voice',
    r.volume,
    r.aht,
    r.workloadSeconds,
    r.trafficErlangs?.toFixed(2) ?? '',
    r.erlangReqHC,
    r.scheduledHC,
    r.effectiveHC,
    r.gap,
    r.offered,
    r.answered,
    r.abandoned,
    r.shortAbandoned,
    `${r.slaPercent}%`,
    `${r.asaSeconds}s`,
    `${r.answerPercent}%`,
    `${r.abandonPercent}%`,
    `${r.occupancyPercent}%`,
    r.maxQueue,
    r.avgQueue,
    r.maxWaitSeconds,
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

/**
 * Exports generated synthetic agent weekly schedule to CSV
 */
export function exportRosterToCSV(weeklyPlan: WeeklyRosterPlan): string {
  const headers = [
    'Agent ID',
    'Agent Name',
    'Gender',
    'Team',
    'Primary Segment',
    'Role',
    ...weeklyPlan.days.map(d => `"${d.dayName} (${d.date})"`),
    'Working Days Count',
    'Off Days Count',
    'Compliant',
  ];

  const rows = weeklyPlan.agentSchedules.map(ag => {
    const dayCells = weeklyPlan.days.map(d => {
      const sch = ag.days.find(day => day.date === d.date);
      if (!sch || sch.isOff) return 'OFF';
      return `${sch.shiftStart || ''}-${sch.shiftEnd || ''}`;
    });

    const workingDays = ag.days.filter(s => !s.isOff).length;
    const offDays = ag.days.filter(s => s.isOff).length;

    return [
      ag.agentId,
      `"${ag.agentName}"`,
      ag.gender,
      ag.team,
      ag.segment,
      ag.isSupervisor ? 'Supervisor' : 'Agent',
      ...dayCells,
      workingDays,
      offDays,
      ag.isCompliant ? 'YES' : 'NO',
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
