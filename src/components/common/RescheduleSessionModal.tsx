import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Clock, MessageSquare, X } from 'lucide-react';
import { Booking } from '../../types';

export type RescheduleSessionPayload = {
  dateInput: string;
  timeInput: string;
  note?: string;
};

interface RescheduleSessionModalProps {
  isOpen: boolean;
  booking: Booking | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: RescheduleSessionPayload) => Promise<void> | void;
}

const getDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeTokenTo24Hour = (value: string): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const twelveHourMatch = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHourMatch) {
    let hours = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const meridiem = twelveHourMatch[3].toUpperCase();

    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    if (hours === 12) {
      hours = meridiem === 'AM' ? 0 : 12;
    } else if (meridiem === 'PM') {
      hours += 12;
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const twentyFourHourMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFourHourMatch) {
    return null;
  }

  const hours = Number(twentyFourHourMatch[1]);
  const minutes = Number(twentyFourHourMatch[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const resolveModalDefaults = (booking: Booking | null): { dateInput: string; timeInput: string } => {
  const fallbackDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  fallbackDate.setHours(9, 0, 0, 0);

  if (!booking) {
    return {
      dateInput: getDateInputValue(fallbackDate),
      timeInput: '09:00',
    };
  }

  const parsedDate = new Date(String(booking.date || '').trim());
  const baseDate = Number.isNaN(parsedDate.getTime()) ? fallbackDate : parsedDate;

  const rawStartToken = String(booking.timeSlot || '').split('-')[0]?.trim() || '';
  const resolvedTime = parseTimeTokenTo24Hour(rawStartToken) || '09:00';

  return {
    dateInput: getDateInputValue(baseDate),
    timeInput: resolvedTime,
  };
};

export const RescheduleSessionModal: React.FC<RescheduleSessionModalProps> = ({
  isOpen,
  booking,
  isSubmitting = false,
  onCancel,
  onSubmit,
}) => {
  const defaults = useMemo(() => resolveModalDefaults(booking), [booking]);
  const [dateInput, setDateInput] = useState(defaults.dateInput);
  const [timeInput, setTimeInput] = useState(defaults.timeInput);
  const [noteInput, setNoteInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setDateInput(defaults.dateInput);
    setTimeInput(defaults.timeInput);
    setNoteInput('');
    setValidationError(null);
  }, [isOpen, defaults]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedDate = String(dateInput || '').trim();
    const normalizedTime = String(timeInput || '').trim();

    if (!normalizedDate) {
      setValidationError('Please select a valid date for the new session.');
      return;
    }

    if (!normalizedTime) {
      setValidationError('Please select a valid start time for the new session.');
      return;
    }

    const nextSessionStart = new Date(`${normalizedDate}T${normalizedTime}:00`);
    if (Number.isNaN(nextSessionStart.getTime())) {
      setValidationError('Selected date or time is invalid.');
      return;
    }

    if (nextSessionStart.getTime() <= Date.now()) {
      setValidationError('Rescheduled session must be set in the future.');
      return;
    }

    setValidationError(null);

    try {
      await onSubmit({
        dateInput: normalizedDate,
        timeInput: normalizedTime,
        note: String(noteInput || '').trim() || undefined,
      });
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Failed to send reschedule request. Please try again.');
    }
  };

  const sessionTitle = `${String(booking?.subject || 'Tutoring').trim() || 'Tutoring'} Session`;
  const currentDate = String(booking?.date || 'Not available').trim() || 'Not available';
  const currentTime = String(booking?.timeSlot || 'Not available').trim() || 'Not available';
  const minimumDate = getDateInputValue(new Date());

  return (
    <AnimatePresence>
      {isOpen && booking && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[360] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!isSubmitting) {
              onCancel();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="w-full max-w-2xl rounded-3xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-100/50 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <form onSubmit={handleSubmit}>
              <div className="p-6 md:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Reschedule Session</h3>
                    <p className="text-sm text-slate-500 mt-1">Propose a new session time for student approval.</p>
                  </div>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={onCancel}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-60"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Session Summary</p>
                  <p className="mt-2 text-base font-bold text-slate-900">{sessionTitle}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                      Current Date: <span className="text-slate-800">{currentDate}</span>
                    </p>
                    <p className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Current Time: <span className="text-slate-800">{currentTime}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">New Date</span>
                    <input
                      type="date"
                      min={minimumDate}
                      value={dateInput}
                      onChange={(event) => setDateInput(event.target.value)}
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">New Start Time</span>
                    <input
                      type="time"
                      value={timeInput}
                      onChange={(event) => setTimeInput(event.target.value)}
                      className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </label>
                </div>

                <label className="block mt-4">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500">Message To Student (Optional)</span>
                  <div className="mt-2 relative">
                    <MessageSquare className="absolute top-3 left-3 w-4 h-4 text-slate-400" />
                    <textarea
                      value={noteInput}
                      onChange={(event) => setNoteInput(event.target.value)}
                      placeholder="Add a short note explaining the proposed change."
                      maxLength={220}
                      rows={3}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                    />
                  </div>
                </label>

                {validationError && (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-sm font-bold text-rose-700">{validationError}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest transition-colors ${
                      isSubmitting
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Request'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
