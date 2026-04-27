import React, { useEffect, useMemo, useState } from 'react';
import { TimeSlot, Tutor } from '../../types';
import { Plus, Trash2, Calendar, Clock, AlertCircle, Save, ArrowLeft } from 'lucide-react';

type DurationOption = {
  value: number;
  label: string;
};

type TimeOption = {
  value: string;
  label: string;
};

const TIME_STEP_MINUTES = 30;
const DEFAULT_SLOT_DURATION = 60;
const MAX_TIME_MINUTES = (24 * 60) - TIME_STEP_MINUTES;

const DURATION_OPTIONS: DurationOption[] = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1 hour 30 min' },
  { value: 120, label: '2 hours' },
  { value: 150, label: '2 hours 30 min' },
  { value: 180, label: '3 hours' },
];

const minutesToTimeString = (minutes: number): string => {
  const clamped = Math.max(0, Math.min((24 * 60) - 1, minutes));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const timeStringToMinutes = (value: string): number | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
};

const parseSlotTimeRange = (startTime: string, endTime: string): { startMinutes: number; endMinutes: number } | null => {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return null;
  }
  return { startMinutes, endMinutes };
};

const to12HourLabel = (value: string): string => {
  const minutes = timeStringToMinutes(value);
  if (minutes === null) {
    return value;
  }

  const hour24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${period}`;
};

const createTimeOptions = (): TimeOption[] => {
  const options: TimeOption[] = [];
  for (let minutes = 0; minutes <= MAX_TIME_MINUTES; minutes += TIME_STEP_MINUTES) {
    const value = minutesToTimeString(minutes);
    options.push({ value, label: to12HourLabel(value) });
  }
  return options;
};

const TIME_OPTIONS = createTimeOptions();
const START_TIME_OPTIONS = TIME_OPTIONS.slice(0, -1);

const getSlotDurationMinutes = (startTime: string, endTime: string): number | null => {
  const start = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);
  if (start === null || end === null || end <= start) {
    return null;
  }
  return end - start;
};

const getEndTimeForDuration = (startTime: string, durationMinutes: number): string => {
  const start = timeStringToMinutes(startTime);
  if (start === null) {
    return startTime;
  }

  const minEnd = start + TIME_STEP_MINUTES;
  const nextEnd = Math.max(minEnd, Math.min(start + durationMinutes, MAX_TIME_MINUTES));
  return minutesToTimeString(nextEnd);
};

const adjustEndTimeByStep = (startTime: string, endTime: string, deltaMinutes: number): string => {
  const start = timeStringToMinutes(startTime);
  const end = timeStringToMinutes(endTime);
  if (start === null || end === null) {
    return endTime;
  }

  const minEnd = start + TIME_STEP_MINUTES;
  const adjusted = Math.max(minEnd, Math.min(end + deltaMinutes, MAX_TIME_MINUTES));
  return minutesToTimeString(adjusted);
};

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const normalizeDayKey = (value: string | undefined): typeof DAY_ORDER[number] | null => {
  const cleaned = String(value || '').trim().toLowerCase();
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith('mon')) return 'Mon';
  if (cleaned.startsWith('tue')) return 'Tue';
  if (cleaned.startsWith('wed')) return 'Wed';
  if (cleaned.startsWith('thu')) return 'Thu';
  if (cleaned.startsWith('fri')) return 'Fri';
  if (cleaned.startsWith('sat')) return 'Sat';
  if (cleaned.startsWith('sun')) return 'Sun';
  return null;
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string | undefined): Date | null => {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
};

const getWeekStartDate = (anchor: Date): Date => {
  const normalized = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const day = normalized.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + mondayOffset);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

const getDateKeyForDayInWeek = (weekStart: Date, day: typeof DAY_ORDER[number]): string => {
  const dayOffsetByKey: Record<typeof DAY_ORDER[number], number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOffsetByKey[day]);
  date.setHours(0, 0, 0, 0);
  return toDateKey(date);
};

const normalizeSlotsForWeek = (
  slots: TimeSlot[] | undefined,
  weekStartDate: Date,
  weekStartKey: string,
  weekEndKey: string
): TimeSlot[] => {
  if (!Array.isArray(slots)) {
    return [];
  }

  const normalized = slots
    .map((slot, index) => {
      const fallbackDay = normalizeDayKey(slot.day) || 'Mon';
      const parsedDate = parseDateKey(slot.dateKey);
      const dateKey = parsedDate ? toDateKey(parsedDate) : getDateKeyForDayInWeek(weekStartDate, fallbackDay);
      if (dateKey < weekStartKey || dateKey > weekEndKey) {
        return null;
      }

      const parsedSlotDate = parseDateKey(dateKey);
      const slotDay = parsedSlotDate
        ? (normalizeDayKey(parsedSlotDate.toLocaleDateString('en-US', { weekday: 'short' })) || fallbackDay)
        : fallbackDay;

      const startTime = String(slot.startTime || '').trim();
      const endTime = String(slot.endTime || '').trim();
      const parsedRange = parseSlotTimeRange(startTime, endTime);
      if (!parsedRange) {
        return null;
      }

      return {
        ...slot,
        id: String(slot.id || `${slotDay}-${dateKey}-${index}`).trim(),
        day: slotDay,
        dateKey,
        weekStartKey,
        startTime: `${String(Math.floor(parsedRange.startMinutes / 60)).padStart(2, '0')}:${String(parsedRange.startMinutes % 60).padStart(2, '0')}`,
        endTime: `${String(Math.floor(parsedRange.endMinutes / 60)).padStart(2, '0')}:${String(parsedRange.endMinutes % 60).padStart(2, '0')}`,
        isBooked: Boolean(slot.isBooked),
      };
    })
    .filter(Boolean) as TimeSlot[];

  return normalized.sort((a, b) => {
    const daySort = DAY_ORDER.indexOf((normalizeDayKey(a.day) || 'Mon')) - DAY_ORDER.indexOf((normalizeDayKey(b.day) || 'Mon'));
    if (daySort !== 0) {
      return daySort;
    }
    return a.startTime.localeCompare(b.startTime);
  });
};

interface Props {
  tutor?: Tutor;
  onSaveAvailability: (slots: TimeSlot[]) => Promise<void>;
  onBack: () => void;
}

export const TutorAvailabilityManagePage: React.FC<Props> = ({ tutor, onSaveAvailability, onBack }) => {
  const weekStartDate = useMemo(() => getWeekStartDate(new Date()), []);
  const weekStartKey = useMemo(() => toDateKey(weekStartDate), [weekStartDate]);
  const weekEndKey = useMemo(() => {
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);
    end.setHours(0, 0, 0, 0);
    return toDateKey(end);
  }, [weekStartDate]);
  const [slots, setSlots] = useState<TimeSlot[]>(() =>
    normalizeSlotsForWeek(tutor?.availability || [], weekStartDate, weekStartKey, weekEndKey)
  );
  const [saving, setSaving] = useState(false);
  const timeOptionsByValue = useMemo(() => {
    const map = new Map<string, string>();
    TIME_OPTIONS.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, []);

  useEffect(() => {
    setSlots(normalizeSlotsForWeek(tutor?.availability || [], weekStartDate, weekStartKey, weekEndKey));
  }, [tutor, weekStartDate, weekStartKey, weekEndKey]);

  const weekRangeLabel = useMemo(() => {
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    return `${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [weekStartDate]);

  if (!tutor) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
        <h2 className="text-2xl font-black text-slate-900">Tutor profile not found</h2>
        <p className="text-slate-600">We could not load your tutor availability yet. Please return to your dashboard and try again.</p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const days = DAY_ORDER;

  const addSlot = (day: string) => {
    const normalizedDay = normalizeDayKey(day) || 'Mon';
    const newSlot: TimeSlot = {
      id: Math.random().toString(36).substring(7),
      day: normalizedDay,
      dateKey: getDateKeyForDayInWeek(weekStartDate, normalizedDay),
      weekStartKey,
      startTime: '09:00',
      endTime: '10:00',
      isBooked: false,
    };
    setSlots([...slots, newSlot]);
  };

  const removeSlot = (id: string) => {
    setSlots(slots.filter(s => s.id !== id));
  };

  const updateSlot = (id: string, field: keyof TimeSlot, value: string) => {
    setSlots(slots.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const updateSlotStartTime = (id: string, nextStartTime: string) => {
    setSlots((prev) => prev.map((slot) => {
      if (slot.id !== id) {
        return slot;
      }

      const startMinutes = timeStringToMinutes(nextStartTime);
      const endMinutes = timeStringToMinutes(slot.endTime);

      if (startMinutes === null || endMinutes === null || endMinutes > startMinutes) {
        return { ...slot, startTime: nextStartTime };
      }

      return {
        ...slot,
        startTime: nextStartTime,
        endTime: getEndTimeForDuration(nextStartTime, DEFAULT_SLOT_DURATION),
      };
    }));
  };

  const updateSlotDuration = (id: string, durationMinutes: number) => {
    setSlots((prev) => prev.map((slot) => {
      if (slot.id !== id) {
        return slot;
      }

      return {
        ...slot,
        endTime: getEndTimeForDuration(slot.startTime, durationMinutes),
      };
    }));
  };

  const adjustSlotDuration = (id: string, deltaMinutes: number) => {
    setSlots((prev) => prev.map((slot) => {
      if (slot.id !== id) {
        return slot;
      }

      return {
        ...slot,
        endTime: adjustEndTimeByStep(slot.startTime, slot.endTime, deltaMinutes),
      };
    }));
  };

  const validateSlots = (): string | null => {
    for (const slot of slots) {
      if (!slot.startTime || !slot.endTime) {
        return 'All slots must have a start and end time.';
      }
      if (!slot.dateKey) {
        return 'Each slot must belong to a specific day in this week.';
      }
      if (slot.startTime >= slot.endTime) {
        return `Start time must be before end time for ${slot.day} (${slot.dateKey}).`;
      }
    }

    for (const day of days) {
      const dayDateKey = getDateKeyForDayInWeek(weekStartDate, day);
      const daySlots = slots
        .filter((s) => s.day === day && s.dateKey === dayDateKey)
        .slice()
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (let i = 1; i < daySlots.length; i += 1) {
        if (daySlots[i].startTime < daySlots[i - 1].endTime) {
          return `Time slots overlap on ${day}.`;
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    const validationError = validateSlots();
    if (validationError) {
      alert(validationError);
      return;
    }

    setSaving(true);
    try {
      await onSaveAvailability(
        slots.map((slot) => ({
          ...slot,
          dateKey: slot.dateKey || getDateKeyForDayInWeek(weekStartDate, normalizeDayKey(slot.day) || 'Mon'),
          weekStartKey,
        }))
      );
      alert("Availability configured successfully!");
    } catch (e) {
      alert("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            Manage Availability
          </h2>
          <p className="text-slate-500 mt-2 text-lg">Configure your weekly schedule for school-level tutoring</p>
          <p className="text-sm font-semibold text-indigo-700 mt-1">Week: {weekRangeLabel}</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
        <div className="flex items-center gap-3 p-4 bg-indigo-50/50 text-indigo-800 rounded-2xl border border-indigo-100">
          <AlertCircle className="w-5 h-5 text-indigo-600" />
          <p className="text-sm font-medium">These slots apply only to this week. Booked slots are locked and must be recreated next week as a fresh schedule.</p>
        </div>

        <div className="space-y-6">
          {days.map(day => {
            const dayDateKey = getDateKeyForDayInWeek(weekStartDate, day);
            const dayDate = parseDateKey(dayDateKey);
            const dayLabel = dayDate
              ? dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : dayDateKey;
            const daySlots = slots.filter((s) => s.day === day && s.dateKey === dayDateKey);
            return (
              <div key={day} className="p-6 border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-900 text-lg w-24">{day} <span className="text-sm text-slate-500">({dayLabel})</span></h3>
                  <button
                    onClick={() => addSlot(day)}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-100/50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Slot
                  </button>
                </div>

                {daySlots.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium py-3">No availability set for {day}</p>
                ) : (
                  <div className="space-y-3">
                    {daySlots.map(slot => (
                      <div key={slot.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-3">
                        {(() => {
                          const startOptions = START_TIME_OPTIONS.some((option) => option.value === slot.startTime)
                            ? START_TIME_OPTIONS
                            : [{ value: slot.startTime, label: `${to12HourLabel(slot.startTime)} (current)` }, ...START_TIME_OPTIONS];

                          const defaultEndOptions = TIME_OPTIONS.filter((option) => option.value > slot.startTime);
                          const endOptions = defaultEndOptions.some((option) => option.value === slot.endTime)
                            ? defaultEndOptions
                            : [
                              ...defaultEndOptions,
                              ...(slot.endTime > slot.startTime
                                ? [{ value: slot.endTime, label: `${to12HourLabel(slot.endTime)} (current)` }]
                                : []),
                            ];

                          return (
                            <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Time Range</span>
                          </div>
                          {slot.isBooked && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md shrink-0">Booked</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                          <div className="md:col-span-4 space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Start</label>
                            <select
                              value={slot.startTime}
                              onChange={(e) => updateSlotStartTime(slot.id, e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-700 transition-all bg-white"
                              disabled={slot.isBooked}
                            >
                              {startOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="md:col-span-4 space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Duration</label>
                            <select
                              value={(() => {
                                const duration = getSlotDurationMinutes(slot.startTime, slot.endTime);
                                if (duration === null) return 'custom';
                                return DURATION_OPTIONS.some((item) => item.value === duration) ? String(duration) : 'custom';
                              })()}
                              onChange={(e) => {
                                if (e.target.value === 'custom') return;
                                updateSlotDuration(slot.id, Number(e.target.value));
                              }}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-700 transition-all bg-white"
                              disabled={slot.isBooked}
                            >
                              {DURATION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                              <option value="custom">Custom range</option>
                            </select>
                          </div>

                          <div className="md:col-span-4 space-y-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">End</label>
                            <select
                              value={slot.endTime}
                              onChange={(e) => updateSlot(slot.id, 'endTime', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-700 transition-all bg-white"
                              disabled={slot.isBooked}
                            >
                              {endOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => adjustSlotDuration(slot.id, -TIME_STEP_MINUTES)}
                              disabled={slot.isBooked}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${slot.isBooked ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                              -30 min
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustSlotDuration(slot.id, TIME_STEP_MINUTES)}
                              disabled={slot.isBooked}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${slot.isBooked ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                              +30 min
                            </button>
                          </div>

                          <div className="flex items-center gap-3 ml-auto">
                            <span className="text-xs font-semibold text-slate-500">
                              {timeOptionsByValue.get(slot.startTime) || slot.startTime} - {timeOptionsByValue.get(slot.endTime) || slot.endTime}
                            </span>
                            <button
                              onClick={() => !slot.isBooked && removeSlot(slot.id)}
                              disabled={slot.isBooked}
                              className={`p-3 rounded-xl shrink-0 transition-colors flex items-center justify-center
                                ${slot.isBooked 
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                  : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                              title={slot.isBooked ? "Cannot remove booked slot" : "Remove slot"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                            </>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
