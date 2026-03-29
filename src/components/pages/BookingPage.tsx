import React, { useEffect, useState } from 'react';
import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  compareAsc,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import {
  Atom,
  Binary,
  Brain,
  Calculator,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Star,
  X,
} from 'lucide-react';
import { apiService } from '../../services/apiService';
import { Booking, Tutor, User as AppUser } from '../../types';

type SubjectMotionTheme = 'math' | 'coding' | 'chemistry' | 'science';
type DurationOption = 30 | 60 | 90;
type SlotPeriod = 'Morning' | 'Afternoon' | 'Evening';

interface BookingPageProps {
  currentUser: AppUser | null;
  isStudent: boolean;
  tutors: Tutor[];
  isLoadingTutors: boolean;
  onRequireAuth: () => void;
  onBookingCreated: (booking: Booking) => void;
}

interface MockBookedSlot {
  tutorId: string;
  weekday: string;
  startTime: string;
  durationMinutes: DurationOption;
}

interface BookedSlotEntry {
  tutorId: string;
  dateKey: string;
  startTime: string;
  durationMinutes: number;
}

interface ComputedSlot {
  id: string;
  sourceSlotId: string;
  startTime: string;
  endTime: string;
  label: string;
  period: SlotPeriod;
  startsAt: Date;
  endsAt: Date;
}

const DURATION_OPTIONS: DurationOption[] = [30, 60, 90];
const TIMEZONE_LABEL = 'All times are shown in Asia/Colombo (GMT+5:30)';
const WEEKDAY_INDEX: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const MOCK_BOOKED_SLOTS: MockBookedSlot[] = [
  { tutorId: 't1', weekday: 'Monday', startTime: '10:30', durationMinutes: 30 },
  { tutorId: 't2', weekday: 'Tuesday', startTime: '16:00', durationMinutes: 60 },
  { tutorId: 't3', weekday: 'Friday', startTime: '17:00', durationMinutes: 60 },
  { tutorId: 't4', weekday: 'Saturday', startTime: '09:00', durationMinutes: 30 },
];

const getTutorDisplayName = (tutor: Tutor & { name?: string }) => {
  const firstName = tutor.firstName?.trim();
  const lastName = tutor.lastName?.trim();

  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }

  return tutor.name?.trim() || 'Tutor';
};

const getSubjectMotionTheme = (subjects: string[]): SubjectMotionTheme => {
  const normalizedSubjects = subjects.map((subject) => subject.toLowerCase());

  if (normalizedSubjects.some((subject) => /ict|computer|software|coding|program/.test(subject))) {
    return 'coding';
  }

  if (normalizedSubjects.some((subject) => /math|physics|calculus|algebra|geometry|statistics/.test(subject))) {
    return 'math';
  }

  if (normalizedSubjects.some((subject) => /chem|biology|bio|molecular|organic/.test(subject))) {
    return 'chemistry';
  }

  return 'science';
};

const getSubjectMotionCopy = (theme: SubjectMotionTheme, subjects: string[]) => {
  const leadSubject = subjects[0] || 'STEM';

  switch (theme) {
    case 'coding':
      return {
        title: 'Code Studio Motion',
        description: `A clean terminal-style loop that frames this ${leadSubject} session like a live build workspace.`,
      };
    case 'math':
      return {
        title: 'Concept Orbit Motion',
        description: `Rotating geometry, wave motion, and measured pulses set the tone for ${leadSubject} problem-solving.`,
      };
    case 'chemistry':
      return {
        title: 'Lab Reaction Motion',
        description: `Molecule links and bubbling motion create a subtle science lab feel for this ${leadSubject} session.`,
      };
    default:
      return {
        title: 'STEM Focus Motion',
        description: `Abstract scientific motion gives this ${leadSubject} booking area a focused, premium study atmosphere.`,
      };
  }
};

const getNextWeekdayDate = (weekday: string, weekOffset = 0) => {
  const targetIndex = WEEKDAY_INDEX[weekday];
  let candidate = startOfDay(new Date());

  while (candidate.getDay() !== targetIndex) {
    candidate = addDays(candidate, 1);
  }

  return addDays(candidate, weekOffset * 7);
};

const buildInitialBookedSlots = (): BookedSlotEntry[] => {
  return MOCK_BOOKED_SLOTS.flatMap((slot) => {
    return [0, 1].map((weekOffset) => {
      const date = getNextWeekdayDate(slot.weekday, weekOffset);

      return {
        tutorId: slot.tutorId,
        dateKey: format(date, 'yyyy-MM-dd'),
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
      };
    });
  });
};

const parseTimeForDate = (date: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(':').map(Number);
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const getSlotPeriod = (date: Date): SlotPeriod => {
  const hour = date.getHours();

  if (hour < 12) {
    return 'Morning';
  }

  if (hour < 17) {
    return 'Afternoon';
  }

  return 'Evening';
};

const intervalsOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) => {
  return startA < endB && startB < endA;
};

const getComputedSlotsForDate = (
  tutor: Tutor,
  date: Date,
  durationMinutes: DurationOption,
  bookedSlots: BookedSlotEntry[]
): ComputedSlot[] => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const currentDayName = format(date, 'EEEE');
  const nowWithBuffer = addHours(new Date(), 2);

  return tutor.availability
    .filter((slot) => slot.day === currentDayName && !slot.isBooked)
    .flatMap((slot) => {
      const availabilityStart = parseTimeForDate(date, slot.startTime);
      const availabilityEnd = parseTimeForDate(date, slot.endTime);
      const latestCandidateStart = addMinutes(availabilityEnd, -durationMinutes);

      if (isBefore(latestCandidateStart, availabilityStart)) {
        return [];
      }

      const slotCandidates: ComputedSlot[] = [];
      let candidateStart = availabilityStart;

      while (compareAsc(candidateStart, latestCandidateStart) <= 0) {
        const candidateEnd = addMinutes(candidateStart, durationMinutes);
        const overlapsBookedSlot = bookedSlots.some((bookedSlot) => {
          if (bookedSlot.tutorId !== tutor.id || bookedSlot.dateKey !== dateKey) {
            return false;
          }

          const bookedStart = parseTimeForDate(date, bookedSlot.startTime);
          const bookedEnd = addMinutes(bookedStart, bookedSlot.durationMinutes);
          return intervalsOverlap(candidateStart, candidateEnd, bookedStart, bookedEnd);
        });

        const isInsideBuffer = isBefore(candidateStart, nowWithBuffer);

        if (!overlapsBookedSlot && !isInsideBuffer) {
          slotCandidates.push({
            id: `${slot.id}-${format(candidateStart, 'HHmm')}-${durationMinutes}`,
            sourceSlotId: slot.id,
            startTime: format(candidateStart, 'HH:mm'),
            endTime: format(candidateEnd, 'HH:mm'),
            label: format(candidateStart, 'hh:mm a'),
            period: getSlotPeriod(candidateStart),
            startsAt: candidateStart,
            endsAt: candidateEnd,
          });
        }

        candidateStart = addMinutes(candidateStart, 30);
      }

      return slotCandidates;
    })
    .sort((leftSlot, rightSlot) => compareAsc(leftSlot.startsAt, rightSlot.startsAt));
};

const findFirstAvailableDate = (
  tutor: Tutor,
  durationMinutes: DurationOption,
  bookedSlots: BookedSlotEntry[]
) => {
  const today = startOfDay(new Date());

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const candidateDate = addDays(today, dayOffset);
    if (getComputedSlotsForDate(tutor, candidateDate, durationMinutes, bookedSlots).length > 0) {
      return candidateDate;
    }
  }

  return null;
};

function FacelessVideo({ tutor, compact = false }: { tutor: Tutor; compact?: boolean }) {
  const theme = getSubjectMotionTheme(tutor.subjects);
  const copy = getSubjectMotionCopy(theme, tutor.subjects);

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 ${compact ? 'p-4' : 'p-6'} shadow-lg shadow-indigo-950/10`}>
      <motion.div
        className="absolute -top-16 right-0 h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-20 left-0 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl"
        animate={{ scale: [1.1, 0.95, 1.1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/75">Session Visual</p>
          <h4 className="mt-2 text-lg font-black tracking-tight text-white">{copy.title}</h4>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-indigo-100/75">{copy.description}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md">
          {theme === 'coding' && <Binary className="h-5 w-5 text-cyan-200" />}
          {theme === 'math' && <Calculator className="h-5 w-5 text-cyan-200" />}
          {theme === 'chemistry' && <Atom className="h-5 w-5 text-cyan-200" />}
          {theme === 'science' && <Brain className="h-5 w-5 text-cyan-200" />}
        </div>
      </div>

      <div className={`relative z-10 mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/35 ${compact ? 'p-3' : 'p-4'} backdrop-blur-sm`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />

        {theme === 'coding' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/70 px-4 py-3 font-mono">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">live session.tsx</span>
            </div>

            <div className="space-y-2.5">
              {[
                { color: 'bg-cyan-300/85', width: '72%', delay: 0 },
                { color: 'bg-violet-300/85', width: '48%', delay: 0.25 },
                { color: 'bg-emerald-300/85', width: '64%', delay: 0.5 },
                { color: 'bg-amber-200/80', width: '56%', delay: 0.75 },
                { color: 'bg-slate-200/70', width: '68%', delay: 1 },
              ].map((line, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0.35, x: -10 }}
                  animate={{ opacity: [0.35, 0.95, 0.35], x: [-10, 0, -10] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: line.delay }}
                >
                  <span className="w-6 text-[10px] text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                  <div className={`h-2 rounded-full ${line.color}`} style={{ width: line.width }} />
                </motion.div>
              ))}
            </div>

            <motion.div
              className="absolute bottom-4 right-5 h-4 w-1.5 rounded-full bg-cyan-200"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-cyan-300/8 to-transparent"
              animate={{ x: ['-30%', '150%'] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {theme === 'math' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/65">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px] opacity-35" />
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/50"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-violet-200/60"
              animate={{ rotate: -360, scale: [1, 1.08, 1] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_30px_rgba(103,232,249,0.65)]"
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="absolute bottom-5 left-4 right-4 flex items-end gap-1.5">
              {[18, 30, 42, 56, 70, 64, 48, 34, 20].map((height, index) => (
                <motion.div
                  key={index}
                  className="flex-1 rounded-t-full bg-gradient-to-t from-cyan-300/40 to-violet-300/75"
                  style={{ height }}
                  animate={{ height: [height, height + 18, height] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.12 }}
                />
              ))}
            </div>
          </div>
        )}

        {theme === 'chemistry' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/65">
            <motion.div
              className="absolute left-[18%] top-[52%] h-5 w-5 rounded-full bg-cyan-200 shadow-[0_0_20px_rgba(103,232,249,0.6)]"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-[46%] top-[34%] h-7 w-7 rounded-full bg-violet-300/90 shadow-[0_0_24px_rgba(196,181,253,0.5)]"
              animate={{ x: [0, 8, 0], y: [0, -4, 0] }}
              transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-[70%] top-[54%] h-4 w-4 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.5)]"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
            />

            <div className="absolute left-[20%] top-[56%] h-px w-[28%] origin-left rotate-[-18deg] bg-gradient-to-r from-cyan-200/80 to-violet-200/80" />
            <div className="absolute left-[49%] top-[48%] h-px w-[20%] origin-left rotate-[24deg] bg-gradient-to-r from-violet-200/80 to-emerald-200/80" />

            {[0, 1, 2, 3, 4].map((bubble) => (
              <motion.div
                key={bubble}
                className="absolute bottom-4 rounded-full bg-white/40"
                style={{ left: `${18 + bubble * 12}%`, width: 6 + bubble, height: 6 + bubble }}
                animate={{ y: [0, -80], opacity: [0, 0.85, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeOut', delay: bubble * 0.45 }}
              />
            ))}

            <motion.div
              className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-cyan-300/25 via-violet-300/18 to-transparent"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {theme === 'science' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/65">
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/45"
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200/40"
              style={{ transform: 'translate(-50%, -50%) rotate(55deg)' }}
              animate={{ rotate: [55, 415] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/35"
              style={{ transform: 'translate(-50%, -50%) rotate(-55deg)' }}
              animate={{ rotate: [-55, -415] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100 shadow-[0_0_26px_rgba(224,242,254,0.65)]" />
          </div>
        )}
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        {tutor.subjects.slice(0, 3).map((subject) => (
          <span key={subject} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-50/85 backdrop-blur-md">
            {subject}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BookingPage({
  currentUser,
  isStudent,
  tutors,
  isLoadingTutors,
  onRequireAuth,
  onBookingCreated,
}: BookingPageProps) {
  const [bookingTutor, setBookingTutor] = useState<Tutor | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(60);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(new Date()));
  const [totalPrice, setTotalPrice] = useState(0);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<BookedSlotEntry[]>(() => buildInitialBookedSlots());

  useEffect(() => {
    if (!bookingTutor) {
      return;
    }

    setTotalPrice(Math.round((bookingTutor.pricePerHour / 60) * selectedDuration));
  }, [bookingTutor, selectedDuration]);

  const openBookingPlanner = (tutor: Tutor) => {
    const initialDuration: DurationOption = 60;
    const initialDate = findFirstAvailableDate(tutor, initialDuration, bookedSlots);

    setBookingTutor(tutor);
    setSelectedDuration(initialDuration);
    setSelectedDate(initialDate);
    setSelectedSlotId(null);
    setVisibleMonth(startOfMonth(initialDate || new Date()));
    setTotalPrice(tutor.pricePerHour);
  };

  const closeBookingPlanner = () => {
    setBookingTutor(null);
    setSelectedDate(null);
    setSelectedSlotId(null);
    setIsSubmittingBooking(false);
  };

  const handlePrimaryAction = (tutor: Tutor) => {
    if (currentUser && !isStudent) {
      alert('Only student accounts can book sessions.');
      return;
    }

    openBookingPlanner(tutor);
  };

  const handleDurationChange = (duration: DurationOption) => {
    setSelectedDuration(duration);
    setSelectedSlotId(null);

    if (!bookingTutor) {
      return;
    }

    setTotalPrice(Math.round((bookingTutor.pricePerHour / 60) * duration));

    if (selectedDate) {
      const nextSlots = getComputedSlotsForDate(bookingTutor, selectedDate, duration, bookedSlots);
      if (nextSlots.length === 0) {
        const nextAvailableDate = findFirstAvailableDate(bookingTutor, duration, bookedSlots);
        setSelectedDate(nextAvailableDate);
        if (nextAvailableDate) {
          setVisibleMonth(startOfMonth(nextAvailableDate));
        }
      }
    }
  };

  const isDateSelectable = (date: Date) => {
    if (!bookingTutor || isBefore(date, startOfDay(new Date()))) {
      return false;
    }

    return getComputedSlotsForDate(bookingTutor, date, selectedDuration, bookedSlots).length > 0;
  };

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(visibleMonth)),
    end: endOfWeek(endOfMonth(visibleMonth)),
  });

  const availableSlots = bookingTutor && selectedDate
    ? getComputedSlotsForDate(bookingTutor, selectedDate, selectedDuration, bookedSlots)
    : [];

  const groupedSlots: Record<SlotPeriod, ComputedSlot[]> = {
    Morning: availableSlots.filter((slot) => slot.period === 'Morning'),
    Afternoon: availableSlots.filter((slot) => slot.period === 'Afternoon'),
    Evening: availableSlots.filter((slot) => slot.period === 'Evening'),
  };

  const selectedSlot = availableSlots.find((slot) => slot.id === selectedSlotId) || null;

  const handleConfirmBooking = async () => {
    if (!bookingTutor || !selectedDate || !selectedSlot || isSubmittingBooking) {
      return;
    }

    if (!currentUser) {
      onRequireAuth();
      return;
    }

    if (currentUser.role !== 'student') {
      alert('Only student accounts can book sessions.');
      return;
    }

    setIsSubmittingBooking(true);

    try {
      const booking = await apiService.createBooking({
        studentId: currentUser.id,
        tutorId: bookingTutor.id,
        slotId: `${selectedSlot.sourceSlotId}-${format(selectedDate, 'yyyyMMdd')}-${selectedDuration}`,
        status: 'confirmed',
        subject: bookingTutor.subjects[0],
        date: `${format(selectedDate, 'PPP')} • ${selectedSlot.label}`,
        meetingLink: 'https://meet.google.com/abc-defg-hij'
      });

      setBookedSlots((currentBookedSlots) => [
        ...currentBookedSlots,
        {
          tutorId: bookingTutor.id,
          dateKey: format(selectedDate, 'yyyy-MM-dd'),
          startTime: selectedSlot.startTime,
          durationMinutes: selectedDuration,
        },
      ]);
      onBookingCreated(booking);
      closeBookingPlanner();
      alert('Session booked successfully!');
    } catch (error) {
      console.error('Failed to book session:', error);
      alert('Failed to book session. Please try again.');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <>
      <div className="space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
              <Star className="w-3 h-3 fill-emerald-700" />
              <span>Top Rated Experts</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Find Your Perfect Tutor</h2>
            <p className="text-slate-600">Browse verified experts in STEM and ICT subjects ready to guide you.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by subject or name..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
              />
            </div>
            <button
              onClick={() => alert('Searching for tutors...')}
              className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
            >
              <Search className="w-6 h-6" />
            </button>
          </div>
        </div>

        {isLoadingTutors ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tutors.map((tutor) => {
              return (
                <motion.div
                  layout
                  whileHover={{ y: -10 }}
                  key={tutor.id}
                  className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group relative"
                >
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-10" />
                  <div className="p-8 relative z-10">
                    <div className="flex items-start gap-5">
                      <div className="relative">
                        <img
                          src={tutor.avatar}
                          alt={getTutorDisplayName(tutor)}
                          className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-xl"
                          referrerPolicy="no-referrer"
                        />
                        {tutor.isVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-indigo-600 p-1 rounded-lg border-2 border-white">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <h3 className="font-black text-xl text-slate-900 leading-tight mb-1">{getTutorDisplayName(tutor)}</h3>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{tutor.qualifications}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            <span className="text-xs font-black text-amber-700">{tutor.rating}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">({tutor.reviewCount} reviews)</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-2">
                      {tutor.subjects.map((subject) => (
                        <span key={subject} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-100">
                          {subject}
                        </span>
                      ))}
                    </div>

                    <p className="mt-5 text-sm text-slate-500 leading-relaxed line-clamp-2 font-medium italic">"{tutor.bio}"</p>

                    <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hourly Rate</span>
                        <p className="text-2xl font-black text-slate-900">LKR {tutor.pricePerHour}</p>
                      </div>
                      <button
                        onClick={() => handlePrimaryAction(tutor)}
                        className="px-6 py-3 rounded-2xl font-black text-sm transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                      >
                        {isStudent || !currentUser ? 'Book Session' : 'View Profile'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {bookingTutor && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeBookingPlanner}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 18 }}
              className="relative z-10 w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl"
            >
              <button
                onClick={closeBookingPlanner}
                className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 shadow-sm backdrop-blur transition-colors hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="grid xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)]">
                <div className="bg-slate-950 p-5 md:p-7 xl:p-8">
                  <FacelessVideo tutor={bookingTutor} />

                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/6 p-5 text-indigo-50 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-indigo-200/70">Tutor Snapshot</p>
                    <h3 className="mt-3 text-2xl font-black text-white">{getTutorDisplayName(bookingTutor)}</h3>
                    <p className="mt-1 text-sm font-bold uppercase tracking-[0.18em] text-indigo-200/75">{bookingTutor.qualifications}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {bookingTutor.subjects.map((subject) => (
                        <span key={subject} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-white/80">
                          {subject}
                        </span>
                      ))}
                    </div>
                    <p className="mt-5 text-sm leading-relaxed text-indigo-100/75">Choose a duration, pick a date with active availability, and then confirm a start time from the matching sidebar.</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-5 md:p-7 xl:p-8">
                  <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-indigo-600">Booking Session</p>
                      <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Pick your date and time</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">Select a session length, choose an available date, then confirm a time that fits the tutor's live availability window.</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-indigo-100 bg-white px-4 py-3 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estimated Total</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">LKR {totalPrice}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                      {DURATION_OPTIONS.map((duration) => (
                        <button
                          key={duration}
                          onClick={() => handleDurationChange(duration)}
                          className={`rounded-xl px-4 py-2 text-sm font-black transition-all ${
                            selectedDuration === duration
                              ? 'bg-slate-900 text-white shadow-lg'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          {duration}m
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-xs font-medium text-slate-500">{TIMEZONE_LABEL}</p>
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setVisibleMonth((currentMonth) => subMonths(currentMonth, 1))}
                          disabled={compareAsc(startOfMonth(visibleMonth), startOfMonth(new Date())) <= 0}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Availability Calendar</p>
                          <h4 className="mt-1 text-xl font-black text-slate-900">{format(visibleMonth, 'MMMM yyyy')}</h4>
                        </div>
                        <button
                          onClick={() => setVisibleMonth((currentMonth) => addMonths(currentMonth, 1))}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mt-5 grid grid-cols-7 gap-2 text-center text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel) => (
                          <span key={dayLabel}>{dayLabel}</span>
                        ))}
                      </div>

                      <div className="mt-4 grid grid-cols-7 gap-2">
                        {calendarDays.map((day) => {
                          const isSelectable = isDateSelectable(day);
                          const isChosen = !!selectedDate && isSameDay(day, selectedDate);

                          return (
                            <button
                              key={day.toISOString()}
                              onClick={() => {
                                if (!isSelectable) {
                                  return;
                                }

                                setSelectedDate(day);
                                setSelectedSlotId(null);
                              }}
                              disabled={!isSelectable}
                              className={`aspect-square rounded-2xl border text-sm font-bold transition-all ${
                                isChosen
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                  : isSelectable
                                    ? 'border-slate-200 bg-white text-slate-800 hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 hover:shadow-md'
                                    : 'border-slate-100 bg-slate-100 text-slate-300'
                              } ${!isSameMonth(day, visibleMonth) ? 'opacity-40' : ''}`}
                            >
                              <span className="block text-base leading-none">{format(day, 'd')}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-5 rounded-[1.25rem] border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        Dates are enabled only when the tutor has bookable slots for the selected duration and the start time is at least 2 hours from now.
                      </div>
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Time Slots</p>
                          <h4 className="mt-1 text-xl font-black text-slate-900">
                            {selectedDate ? format(selectedDate, 'EEE, MMM d') : 'Choose a date'}
                          </h4>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                          <Clock3 className="h-5 w-5" />
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div
                          key={selectedDate ? selectedDate.toISOString() : 'no-date'}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className="mt-5 space-y-5"
                        >
                          {!selectedDate && (
                            <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                              Pick a date from the calendar to load tutor slots that match your selected duration.
                            </div>
                          )}

                          {selectedDate && availableSlots.length === 0 && (
                            <div className="rounded-[1.25rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                              No slots are available on this date for a {selectedDuration}-minute session.
                            </div>
                          )}

                          {selectedDate && availableSlots.length > 0 && (
                            (Object.entries(groupedSlots) as Array<[SlotPeriod, ComputedSlot[]]>).map(([period, slots]) => {
                              if (slots.length === 0) {
                                return null;
                              }

                              return (
                                <div key={period} className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{period}</p>
                                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">{slots.length} slots</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2.5">
                                    {slots.map((slot) => (
                                      <button
                                        key={slot.id}
                                        onClick={() => setSelectedSlotId(slot.id)}
                                        className={`rounded-full border px-3.5 py-2 text-sm font-black transition-all ${
                                          selectedSlotId === slot.id
                                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
                                        }`}
                                      >
                                        {slot.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Booking Summary</p>
                        <h4 className="text-xl font-black text-slate-900">{bookingTutor.subjects[0]} session with {getTutorDisplayName(bookingTutor)}</h4>
                        <p className="text-sm text-slate-500">
                          {selectedDate ? format(selectedDate, 'PPP') : 'Select a date'}
                          {' · '}
                          {selectedSlot ? `${selectedSlot.label} - ${format(selectedSlot.endsAt, 'hh:mm a')}` : 'Select a time'}
                        </p>
                      </div>

                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <div className="rounded-[1.25rem] bg-slate-100 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Total Price</p>
                          <p className="mt-1 text-2xl font-black text-slate-900">LKR {totalPrice}</p>
                        </div>
                        <button
                          onClick={handleConfirmBooking}
                          disabled={!selectedDate || !selectedSlot || isSubmittingBooking}
                          className="rounded-[1.25rem] bg-indigo-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                          {isSubmittingBooking ? 'Confirming...' : 'Confirm Booking'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
