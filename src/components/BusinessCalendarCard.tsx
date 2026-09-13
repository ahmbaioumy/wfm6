import React, { useState } from 'react';
import { Calendar, Clock, Sparkles, Plus, X, Check } from 'lucide-react';
import { WorkforceConfig, WeekStartDay } from '../types';

interface BusinessCalendarCardProps {
  config: WorkforceConfig;
  onChange: (updated: Partial<WorkforceConfig>) => void;
}

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEK_START_OPTIONS: { label: string; value: WeekStartDay }[] = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 as WeekStartDay },
  { label: 'Wed', value: 3 as WeekStartDay },
  { label: 'Thu', value: 4 as WeekStartDay },
  { label: 'Fri', value: 5 as WeekStartDay },
  { label: 'Sat', value: 6 as WeekStartDay },
];

export const BusinessCalendarCard: React.FC<BusinessCalendarCardProps> = ({
  config,
  onChange,
}) => {
  const is24x7 = !!config.is24x7;
  const operatingDays = config.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const holidayDates = config.holidayDates || [];

  const [newHoliday, setNewHoliday] = useState('');

  // Parse open time HH:MM
  const openParts = (config.businessHoursStart || '08:00').split(':');
  const openHour = parseInt(openParts[0] || '8', 10);
  const openMin = parseInt(openParts[1] || '0', 10);

  // Parse close time HH:MM
  const closeParts = (config.businessHoursEnd || '18:00').split(':');
  const closeHour = config.businessHoursEnd === '24:00' ? 24 : parseInt(closeParts[0] || '18', 10);
  const closeMin = config.businessHoursEnd === '24:00' ? 0 : parseInt(closeParts[1] || '0', 10);

  // Compute total window length
  let totalMinutes = 0;
  if (is24x7) {
    totalMinutes = 24 * 60;
  } else {
    const openTotal = openHour * 60 + openMin;
    const closeTotal = closeHour === 24 ? 24 * 60 : closeHour * 60 + closeMin;
    totalMinutes = closeTotal - openTotal;
    if (totalMinutes <= 0) totalMinutes += 24 * 60;
  }
  const windowHours = Math.floor(totalMinutes / 60);
  const windowRemainderMins = totalMinutes % 60;

  const toggleDay = (day: string) => {
    let nextDays: string[];
    if (operatingDays.includes(day)) {
      if (operatingDays.length <= 1) return; // Must keep at least 1 working day
      nextDays = operatingDays.filter(d => d !== day);
    } else {
      nextDays = [...operatingDays, day];
    }
    onChange({ operatingDays: nextDays });
  };

  const applyPreset = (start: string, end: string, set24 = false) => {
    onChange({
      is24x7: set24,
      businessHoursStart: start,
      businessHoursEnd: end,
    });
  };

  const updateOpenTime = (h: number, m: number) => {
    const clampedH = Math.max(0, Math.min(23, isNaN(h) ? 0 : h));
    const clampedM = Math.max(0, Math.min(59, isNaN(m) ? 0 : m));
    const timeStr = `${String(clampedH).padStart(2, '0')}:${String(clampedM).padStart(2, '0')}`;
    onChange({ businessHoursStart: timeStr });
  };

  const updateCloseTime = (h: number, m: number) => {
    if (h === 24) {
      onChange({ businessHoursEnd: '24:00' });
      return;
    }
    const clampedH = Math.max(0, Math.min(23, isNaN(h) ? 0 : h));
    const clampedM = Math.max(0, Math.min(59, isNaN(m) ? 0 : m));
    const timeStr = `${String(clampedH).padStart(2, '0')}:${String(clampedM).padStart(2, '0')}`;
    onChange({ businessHoursEnd: timeStr });
  };

  const handleAddHoliday = () => {
    if (!newHoliday) return;
    if (!holidayDates.includes(newHoliday)) {
      onChange({ holidayDates: [...holidayDates, newHoliday].sort() });
    }
    setNewHoliday('');
  };

  const handleRemoveHoliday = (dateToRemove: string) => {
    onChange({ holidayDates: holidayDates.filter(d => d !== dateToRemove) });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-md text-slate-100 space-y-5">
      {/* Top Header & 24/7 Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Business Calendar &amp; Working Windows
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Define open business hours, working days of week, or enable 24/7 continuous operations.
            </p>
          </div>
        </div>

        {/* 24/7 Operations Switch */}
        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition select-none self-start sm:self-center">
          <input
            type="checkbox"
            checked={is24x7}
            onChange={e => onChange({ is24x7: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded bg-slate-900 border-slate-700 focus:ring-blue-500 focus:ring-offset-slate-900"
          />
          <div>
            <div className="text-xs font-bold text-blue-400">24/7 Operations</div>
            <div className="text-[10px] text-slate-400">Continuous round-the-clock</div>
          </div>
        </label>
      </div>

      {/* Working Days of the Week + Week Starts */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Working Days of the Week
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map(day => {
              const active = operatingDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              WEEK STARTS
            </span>
          </div>
          <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {WEEK_START_OPTIONS.map(opt => {
              const selected = (config.weekStartDay ?? 1) === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onChange({ weekStartDay: opt.value })}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                    selected
                      ? 'bg-slate-800 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Operating Window Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-300">
            Quick Operating Window Presets
          </label>
          <span className="text-[11px] text-slate-400">
            Click to apply common business schedules
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset('08:00', '17:00')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition"
          >
            08:00 – 17:00 (Standard 8h)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('09:00', '18:00')}
            className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white transition"
          >
            09:00 – 18:00 (Standard 9h)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('09:00', '24:00')}
            className="px-3 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/80 text-xs text-blue-300 transition"
          >
            09:00 – 24:00 (9 AM to Midnight / 23:59:59)
          </button>
          <button
            type="button"
            onClick={() => applyPreset('00:00', '24:00', true)}
            className="px-3 py-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/80 text-xs text-purple-300 transition"
          >
            00:00 – 24:00 (Full 24h Day)
          </button>
        </div>
      </div>

      {/* Daily Open Time and Daily Close Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Daily Open Time */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Daily Open Time (24h format)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              disabled={is24x7}
              value={openHour}
              onChange={e => updateOpenTime(parseInt(e.target.value, 10), openMin)}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <span className="font-bold text-slate-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={15}
              disabled={is24x7}
              value={openMin}
              onChange={e => updateOpenTime(openHour, parseInt(e.target.value, 10))}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <span className="text-xs text-slate-400 font-mono ml-2">
              ({String(openHour).padStart(2, '0')}:{String(openMin).padStart(2, '0')})
            </span>
          </div>
        </div>

        {/* Daily Close Time */}
        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300">
              Daily Close Time (24h format)
            </label>
            <button
              type="button"
              disabled={is24x7}
              onClick={() => updateCloseTime(24, 0)}
              className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium disabled:opacity-40"
            >
              Set to Midnight (24:00)
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={24}
              disabled={is24x7}
              value={closeHour}
              onChange={e => updateCloseTime(parseInt(e.target.value, 10), closeMin)}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <span className="font-bold text-slate-400">:</span>
            <input
              type="number"
              min={0}
              max={59}
              step={15}
              disabled={is24x7 || closeHour === 24}
              value={closeHour === 24 ? 0 : closeMin}
              onChange={e => updateCloseTime(closeHour, parseInt(e.target.value, 10))}
              className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-sm font-mono text-white focus:outline-none focus:border-blue-500 disabled:opacity-40"
            />
            <span className="text-xs text-slate-400 font-mono ml-2">
              ({closeHour === 24 ? '24:00' : `${String(closeHour).padStart(2, '0')}:${String(closeMin).padStart(2, '0')}`})
            </span>
          </div>
        </div>
      </div>

      {/* Daily Business Window Length Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
        <div className="text-xs text-slate-300 font-medium">
          Daily Business Window Length:{' '}
          <strong className="text-white font-bold">{is24x7 ? '24 hours/day (Round the Clock)' : `${windowHours} hours/day`}</strong>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
          {String(windowHours).padStart(2, '0')}h {String(windowRemainderMins).padStart(2, '0')}m
        </div>
      </div>

      {/* Holiday Closures */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">
            Holiday Closures ({holidayDates.length})
          </label>
          <span className="text-[10px] text-slate-400">
            Closed dates automatically convert scheduled shifts to OFF days
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={newHoliday}
            onChange={e => setNewHoliday(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleAddHoliday}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer transition"
          >
            <Plus className="w-3.5 h-3.5 text-blue-400" />
            Add Holiday
          </button>
        </div>

        {holidayDates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {holidayDates.map(date => (
              <span
                key={date}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-mono"
              >
                {date}
                <button
                  type="button"
                  onClick={() => handleRemoveHoliday(date)}
                  className="hover:text-white p-0.5"
                  title="Remove Holiday"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
