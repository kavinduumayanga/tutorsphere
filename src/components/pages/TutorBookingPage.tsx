import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Globe,
  CheckCircle,
  Video,
  Star,
  Shield,
  Sunrise,
  Sun,
  Sunset,
  PartyPopper,
  CalendarCheck,
  User as UserIcon,
  Lock,
  Info,
} from "lucide-react";
import { formatLkr } from "../../utils/currency";

interface TutorBookingPageProps {
  tutor: any;
  onBack: () => void;
  onConfirmBooking: (slotId: string) => void;
}

const CONSTANT_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM",
  "03:00 PM", "04:00 PM", "05:00 PM"
];

const SESSION_DURATION_MINUTES = 60;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

type CalendarDayCell = {
  date: Date;
  isCurrentMonth: boolean;
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
};

const isSameDay = (a: Date, b: Date): boolean => (
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()
);

const buildCalendarDays = (month: Date): CalendarDayCell[] => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  // Convert Sunday-first (0..6) into Monday-first (0..6)
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const cells: CalendarDayCell[] = [];

  for (let i = leadingDays; i > 0; i--) {
    cells.push({
      date: new Date(year, monthIndex, 1 - i),
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: new Date(year, monthIndex, day),
      isCurrentMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const lastDate = cells[cells.length - 1].date;
    cells.push({
      date: addDays(lastDate, 1),
      isCurrentMonth: false,
    });
  }

  return cells;
};

const BOOKING_MIN_DATE = startOfDay(new Date());
const BOOKING_MAX_DATE = addDays(BOOKING_MIN_DATE, 59);

/**
 * Parse a 12-hour time string like "09:30 AM" into total minutes since midnight.
 */
const parseTimeToMinutes = (time: string): number => {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "AM" && hours === 12) hours = 0;
  if (period === "PM" && hours !== 12) hours += 12;
  return hours * 60 + minutes;
};

/**
 * Return the set of slot strings that overlap with a 1-hour window starting at `selectedTime`.
 *
 * Two slots conflict if their 1-hour windows overlap:
 *   slotStart < selectedStart + SESSION_DURATION  AND
 *   selectedStart < slotStart + SESSION_DURATION
 *
 * We exclude the selected slot itself from the result.
 */
const getConflictingSlots = (selectedTime: string, allSlots: string[]): Set<string> => {
  const selectedStart = parseTimeToMinutes(selectedTime);
  const selectedEnd = selectedStart + SESSION_DURATION_MINUTES;
  const conflicts = new Set<string>();

  for (const slot of allSlots) {
    if (slot === selectedTime) continue;
    const slotStart = parseTimeToMinutes(slot);
    const slotEnd = slotStart + SESSION_DURATION_MINUTES;
    // Two intervals [a, a+dur) and [b, b+dur) overlap when a < b+dur AND b < a+dur
    if (selectedStart < slotEnd && slotStart < selectedEnd) {
      conflicts.add(slot);
    }
  }

  return conflicts;
};

const groupSlotsByPeriod = (slots: string[]) => {
  const morning: string[] = [];
  const afternoon: string[] = [];
  const evening: string[] = [];

  slots.forEach((slot) => {
    if (slot.includes("AM")) {
      morning.push(slot);
    } else {
      const hour = parseInt(slot.split(":")[0]);
      if (hour < 5 || hour === 12) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    }
  });

  return { morning, afternoon, evening };
};

export function TutorBookingPage({ tutor, onBack, onConfirmBooking }: TutorBookingPageProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => BOOKING_MIN_DATE);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(BOOKING_MIN_DATE));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  if (!tutor) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center bg-white p-10 rounded-3xl shadow-sm border border-slate-100 max-w-sm w-full">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Tutor Not Found</h3>
          <p className="text-slate-500 mb-6 font-medium text-sm">The tutor you're looking for is unavailable.</p>
          <button onClick={onBack} className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold transition-colors w-full">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = tutor.user?.name || tutor.name || `${tutor.firstName || ''} ${tutor.lastName || ''}`.trim() || "Tutor";
  const formattedHourlyRate = formatLkr(tutor.pricePerHour);

  // Deterministic available slots per date
  const availableSlots = CONSTANT_SLOTS.filter((_, i) => (selectedDate.getDate() + i) % 3 !== 0);
  const grouped = useMemo(() => groupSlotsByPeriod(availableSlots), [availableSlots]);

  // Conflicting slots — recalculated whenever selection changes
  const conflictingSlots = useMemo(
    () => (selectedSlot ? getConflictingSlots(selectedSlot, availableSlots) : new Set<string>()),
    [selectedSlot, availableSlots]
  );

  // Slot count per date for badge
  const getSlotCount = (date: Date) => CONSTANT_SLOTS.filter((_, i) => (date.getDate() + i) % 3 !== 0).length;

  const calendarDays = useMemo(() => buildCalendarDays(calendarMonth), [calendarMonth]);
  const minMonth = useMemo(() => startOfMonth(BOOKING_MIN_DATE), []);
  const maxMonth = useMemo(() => startOfMonth(BOOKING_MAX_DATE), []);

  const canGoPrevMonth = calendarMonth.getTime() > minMonth.getTime();
  const canGoNextMonth = calendarMonth.getTime() < maxMonth.getTime();

  const isDateInBookingRange = useCallback((date: Date) => {
    const day = startOfDay(date);
    return day.getTime() >= BOOKING_MIN_DATE.getTime() && day.getTime() <= BOOKING_MAX_DATE.getTime();
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    if (!isDateInBookingRange(date)) {
      return;
    }

    setSelectedDate(startOfDay(date));
    setCalendarMonth(startOfMonth(date));
    setSelectedSlot(null);
  }, [isDateInBookingRange]);

  const handleSlotClick = useCallback(
    (time: string) => {
      // If already selected, deselect
      if (selectedSlot === time) {
        setSelectedSlot(null);
        return;
      }
      // Don't allow selecting a conflicting (locked) slot
      if (conflictingSlots.has(time)) return;
      setSelectedSlot(time);
    },
    [selectedSlot, conflictingSlots]
  );

  const handleConfirm = async () => {
    if (selectedSlot) {
      setIsConfirming(true);
      await new Promise((r) => setTimeout(r, 1200));
      setIsConfirming(false);
      setBookingSuccess(true);
      onConfirmBooking(`${selectedDate.toISOString().split('T')[0]}-${selectedSlot}`);
    }
  };

  // ─── Booking Success State ───
  // Renders inline within the page layout (no min-h-screen overlay)
  if (bookingSuccess) {
    return (
      <div className="pb-20">
        {/* Header — consistent with booking page */}
        <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-40 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
              <span className="font-bold text-sm">Booking Confirmed</span>
            </div>
            <div className="w-10" /> {/* Spacer for center alignment */}
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 mt-12 sm:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-50 border border-slate-200/60 overflow-hidden"
          >
            {/* Success banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-8 sm:p-10 text-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="success-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                      <circle cx="12" cy="12" r="1.5" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#success-dots)" />
                </svg>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4"
              >
                <PartyPopper className="w-8 h-8 text-white" />
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                Booking Confirmed!
              </h2>
              <p className="text-emerald-50 font-medium text-sm">
                Your session has been scheduled successfully
              </p>
            </div>

            {/* Booking Details */}
            <div className="p-6 sm:p-10">
              {/* Tutor Info */}
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center overflow-hidden border border-indigo-200 shrink-0">
                  {tutor.avatar ? (
                    <img src={tutor.avatar} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-bold text-indigo-600 text-xl">{displayName.charAt(0)}</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{displayName}</p>
                  <p className="text-sm text-slate-500 font-medium">1-on-1 Video Session</p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date</div>
                    <div className="font-bold text-slate-900 text-sm">
                      {selectedDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100">
                    <Clock className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Time</div>
                    <div className="font-bold text-slate-900 text-sm">{selectedSlot} — 1 Hour Session</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                    <Video className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total</div>
                    <div className="font-bold text-slate-900 text-sm">{formattedHourlyRate} — Video Call</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={onBack}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                >
                  <CalendarCheck className="w-5 h-5" />
                  Go to Dashboard
                </button>
                <button
                  onClick={onBack}
                  className="w-full py-3.5 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors border border-slate-200"
                >
                  Back to Tutor Profile
                </button>
              </div>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ─── Slot rendering with conflict awareness ───
  const renderTimeSection = (
    title: string,
    icon: React.ReactNode,
    slots: string[],
    bgColor: string,
    _iconColor: string
  ) => {
    if (slots.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${bgColor} flex items-center justify-center`}>
            {icon}
          </div>
          <span className="text-sm font-bold text-slate-700">{title}</span>
          <span className="text-xs font-bold text-slate-400">({slots.length} slots)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {slots.map((time) => {
            const isSelected = selectedSlot === time;
            const isLocked = conflictingSlots.has(time);

            return (
              <motion.button
                key={time}
                whileHover={!isLocked ? { y: -2 } : {}}
                whileTap={!isLocked ? { scale: 0.95 } : {}}
                onClick={() => handleSlotClick(time)}
                disabled={isLocked}
                className={`py-3 px-3 rounded-xl border-2 font-bold transition-all text-sm flex items-center justify-center gap-2 relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : isLocked
                      ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through"
                      : "border-slate-100 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 shadow-sm"
                }`}
                title={isLocked ? `Overlaps with ${selectedSlot} booking window` : ""}
              >
                {isSelected && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                {isLocked && <Lock className="w-3 h-3 shrink-0 text-slate-300" />}
                {time}
              </motion.button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="hidden sm:inline">Back to Profile</span>
          </button>

          {/* Step Indicator */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</div>
              <span className="text-xs font-bold text-indigo-600">Select Time</span>
            </div>
            <div className="w-8 h-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${selectedSlot ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>2</div>
              <span className={`text-xs font-bold ${selectedSlot ? 'text-indigo-600' : 'text-slate-400'}`}>Confirm</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg border border-indigo-200 overflow-hidden">
              {tutor.avatar ? (
                <img src={tutor.avatar} alt={displayName} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              ) : (
                displayName.charAt(0)
              )}
            </div>
            <div className="hidden sm:block text-right">
              <div className="font-bold text-slate-900 text-sm">{displayName}</div>
              <div className="text-xs text-slate-500 font-medium flex items-center justify-end gap-1">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {tutor.rating || '4.8'} • {formattedHourlyRate}/hour
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        <div className="grid lg:grid-cols-12 gap-8 items-start">

          {/* LEFT COL: Scheduler */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
              <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Select a Date & Time</h1>
                <div className="flex items-center gap-2 text-slate-500 mt-2 font-medium text-sm">
                  <Globe className="w-4 h-4" /> Timezone: <span className="text-slate-700 font-bold">Your Local Time</span>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {/* Date Selector */}
                <div className="mb-10">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-500" />
                    Which day works best?
                  </h3>

                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-4 sm:p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4 gap-3">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">Pick Your Session Date</p>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Book up to 60 days in advance</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => canGoPrevMonth && setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                          disabled={!canGoPrevMonth}
                          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="min-w-[140px] text-center text-sm font-black text-slate-800 px-2">
                          {MONTH_LABEL_FORMATTER.format(calendarMonth)}
                        </div>
                        <button
                          onClick={() => canGoNextMonth && setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                          disabled={!canGoNextMonth}
                          className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                          aria-label="Next month"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                      {WEEKDAY_LABELS.map((day) => (
                        <div key={day} className="text-center text-[11px] font-black uppercase tracking-wider text-slate-400 py-1">
                          {day}
                        </div>
                      ))}
                    </div>

                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={calendarMonth.toISOString()}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="grid grid-cols-7 gap-1.5"
                      >
                        {calendarDays.map(({ date, isCurrentMonth }) => {
                          const disabled = !isDateInBookingRange(date);
                          const isSelected = isSameDay(date, selectedDate);
                          const isToday = isSameDay(date, BOOKING_MIN_DATE);
                          const slotCount = disabled ? 0 : getSlotCount(date);

                          return (
                            <motion.button
                              key={date.toISOString()}
                              whileHover={!disabled ? { y: -1.5 } : {}}
                              whileTap={!disabled ? { scale: 0.96 } : {}}
                              onClick={() => handleSelectDate(date)}
                              disabled={disabled}
                              className={`h-14 sm:h-16 rounded-xl border text-sm font-bold relative transition-all ${
                                isSelected
                                  ? "border-indigo-600 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200"
                                  : !isCurrentMonth
                                    ? "border-transparent bg-slate-50 text-slate-400"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:shadow-sm"
                              } ${disabled ? "opacity-35 cursor-not-allowed" : ""}`}
                            >
                              <span className="relative z-10">{date.getDate()}</span>

                              {isToday && !isSelected && !disabled && (
                                <span className="absolute inset-1 rounded-lg border border-indigo-200 pointer-events-none" />
                              )}

                              {!disabled && slotCount > 0 && (
                                <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                                  isSelected ? "bg-white" : "bg-emerald-500"
                                }`} />
                              )}
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>

                    <div className="mt-4 p-3 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Selected Date</p>
                        <p className="text-sm font-bold text-indigo-900">
                          {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <span className="inline-flex items-center self-start sm:self-center text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white text-indigo-700 border border-indigo-100">
                        {getSlotCount(selectedDate)} slot{getSlotCount(selectedDate) !== 1 ? "s" : ""} available
                      </span>
                    </div>
                  </div>
                </div>

                {/* Time Slots — Grouped with conflict awareness */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-indigo-500" />
                      Available Times
                    </h3>
                    {selectedSlot && conflictingSlots.size > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
                        <Info className="w-3.5 h-3.5" />
                        {conflictingSlots.size} overlapping slot{conflictingSlots.size !== 1 ? 's' : ''} locked
                      </div>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedDate.toDateString()}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {availableSlots.length > 0 ? (
                        <>
                          {renderTimeSection("Morning", <Sunrise className="w-4 h-4 text-amber-600" />, grouped.morning, "bg-amber-50", "text-amber-600")}
                          {renderTimeSection("Afternoon", <Sun className="w-4 h-4 text-orange-500" />, grouped.afternoon, "bg-orange-50", "text-orange-500")}
                          {renderTimeSection("Evening", <Sunset className="w-4 h-4 text-violet-500" />, grouped.evening, "bg-violet-50", "text-violet-500")}
                        </>
                      ) : (
                        <div className="py-16 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                            <Clock className="w-7 h-7 text-slate-400" />
                          </div>
                          <p className="text-slate-600 font-bold text-lg">No slots available</p>
                          <p className="text-sm text-slate-500 mt-1 font-medium">Please select another day.</p>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100 text-xs font-bold text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded border-2 border-slate-100 bg-white" />
                      Available
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-indigo-600 border-2 border-indigo-600" />
                      Selected
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-slate-50 border-2 border-slate-100 flex items-center justify-center">
                        <Lock className="w-2.5 h-2.5 text-slate-300" />
                      </div>
                      Locked (overlapping)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COL: Summary */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-50 border border-slate-200/60 p-6 sm:p-8 lg:sticky lg:top-28">
              <h3 className="text-xl font-black text-slate-900 mb-6">Booking Summary</h3>

              <div className="space-y-5 mb-8">
                {/* Tutor Mini Card */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden border border-indigo-200">
                    {tutor.avatar ? (
                      <img src={tutor.avatar} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="font-bold text-indigo-600">{displayName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{displayName}</p>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span className="text-xs font-bold text-slate-500">{tutor.rating || '4.8'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Date</div>
                    <div className="font-bold text-slate-900 leading-tight text-sm">
                      {selectedDate.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors border ${selectedSlot ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-slate-50 text-slate-400 border-slate-100"}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Time</div>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedSlot || 'empty'}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className={`font-bold leading-tight text-sm ${selectedSlot ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        {selectedSlot ? `${selectedSlot} — 1 Hour` : "Select a time slot"}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0 border border-purple-100">
                    <Video className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Session Type</div>
                    <div className="font-bold text-slate-900 leading-tight text-sm">1-on-1 Video Call</div>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div className="border-t border-slate-100 pt-6 mb-8">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="font-bold text-slate-500 text-sm">Rate per hour</span>
                  <span className="font-bold text-slate-900">{formattedHourlyRate}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-500 text-sm">Service Fee</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md text-xs uppercase tracking-wider">Free</span>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-lg">Total</span>
                  <span className="font-black text-slate-900 text-3xl tracking-tight">{formattedHourlyRate}</span>
                </div>
              </div>

              {/* Confirm Button */}
              <motion.button
                whileHover={{ scale: selectedSlot && !isConfirming ? 1.02 : 1 }}
                whileTap={{ scale: selectedSlot && !isConfirming ? 0.98 : 1 }}
                onClick={handleConfirm}
                disabled={!selectedSlot || isConfirming}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                  selectedSlot && !isConfirming
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200"
                    : isConfirming
                      ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isConfirming ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Confirming...
                  </>
                ) : selectedSlot ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Confirm Booking
                  </>
                ) : (
                  "Pick a Time"
                )}
              </motion.button>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 py-2.5 rounded-xl">
                <Shield className="w-4 h-4 text-emerald-400" /> No payment required yet
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
