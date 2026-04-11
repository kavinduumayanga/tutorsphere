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
  Lock,
  CreditCard,
  AlertTriangle,
  Sunrise,
  Sun,
  Sunset,
  PartyPopper,
  CalendarCheck,
  User as UserIcon,
  Download,
} from "lucide-react";
import { formatLkr } from "../../utils/currency";

type BookingCheckoutPayload = {
  slotId: string;
  sessionDate: string;
  sessionTime: string;
  sessionDurationHours: number;
  sessionAmount: number;
  paymentStatus: 'paid' | 'failed';
  paymentReference?: string;
  paymentFailureReason?: string;
};

type BookingCheckoutResponse = {
  ok: boolean;
  error?: string;
};

interface TutorBookingPageProps {
  tutor: any;
  onBack: () => void;
  onBackToDashboard: () => void;
  onConfirmBooking: (payload: BookingCheckoutPayload) => Promise<BookingCheckoutResponse>;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CalendarDayCell = {
  date: Date;
  isCurrentMonth: boolean;
};

type TutorAvailabilitySlot = {
  id?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  isBooked?: boolean;
};

type BookingSlotOption = {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
};

type PaymentFieldKey = 'cardholderName' | 'cardNumber' | 'expiry' | 'cvv';

type PaymentFieldErrors = Record<PaymentFieldKey, string>;

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

const normalizeDayKey = (value: string | undefined): string | null => {
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

const parseTimeToMinutes = (value: string | undefined): number | null => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
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

const formatTimeLabel = (value: string | undefined): string => {
  const minutes = parseTimeToMinutes(value);
  if (minutes === null) {
    return String(value || '').trim();
  }

  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
};

const getDayKeyForDate = (date: Date): string => DAY_KEYS[date.getDay()];

const buildAvailabilityForDate = (availability: TutorAvailabilitySlot[], date: Date): BookingSlotOption[] => {
  const targetDayKey = getDayKeyForDate(date);

  return availability
    .filter((slot) => {
      const dayKey = normalizeDayKey(slot.day);
      return Boolean(dayKey) && dayKey === targetDayKey && !slot.isBooked;
    })
    .map((slot, index) => ({
      id: slot.id || `${targetDayKey}-${slot.startTime || 'start'}-${slot.endTime || 'end'}-${index}`,
      startTime: String(slot.startTime || ''),
      endTime: String(slot.endTime || ''),
      label: `${formatTimeLabel(slot.startTime)} - ${formatTimeLabel(slot.endTime)}`,
    }))
    .filter((slot) => {
      const start = parseTimeToMinutes(slot.startTime);
      const end = parseTimeToMinutes(slot.endTime);
      return start !== null && end !== null && start < end;
    })
    .sort((a, b) => {
      const aStart = parseTimeToMinutes(a.startTime) || 0;
      const bStart = parseTimeToMinutes(b.startTime) || 0;
      return aStart - bStart;
    });
};

const groupSlotsByPeriod = (slots: BookingSlotOption[]) => {
  const morning: BookingSlotOption[] = [];
  const afternoon: BookingSlotOption[] = [];
  const evening: BookingSlotOption[] = [];

  slots.forEach((slot) => {
    const startMinutes = parseTimeToMinutes(slot.startTime);
    const hour = startMinutes === null ? 0 : Math.floor(startMinutes / 60);

    if (hour < 12) {
      morning.push(slot);
    } else if (hour < 17) {
      afternoon.push(slot);
    } else {
      evening.push(slot);
    }
  });

  return { morning, afternoon, evening };
};

const getDigitsOnly = (value: string): string => value.replace(/\D/g, '');

const formatCardNumberInput = (value: string): string => {
  return getDigitsOnly(value)
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
};

const formatExpiryInput = (value: string): string => {
  const digits = getDigitsOnly(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const isValidExpiry = (value: string): boolean => {
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return false;
  }

  const month = Number(match[1]);
  const yearSuffix = Number(match[2]);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const currentYearSuffix = now.getFullYear() % 100;
  const currentMonth = now.getMonth() + 1;

  if (yearSuffix < currentYearSuffix) {
    return false;
  }

  if (yearSuffix === currentYearSuffix && month < currentMonth) {
    return false;
  }

  return true;
};

const calculateSlotDurationHours = (slot: BookingSlotOption | null): number => {
  if (!slot) {
    return 1;
  }

  const start = parseTimeToMinutes(slot.startTime);
  const end = parseTimeToMinutes(slot.endTime);
  if (start === null || end === null || end <= start) {
    return 1;
  }

  const duration = (end - start) / 60;
  return duration > 0 ? duration : 1;
};

const getPaymentFieldErrors = (input: {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}): PaymentFieldErrors => {
  const cleanedCardholder = input.cardholderName.trim();
  const cleanedCardNumber = getDigitsOnly(input.cardNumber);
  const cleanedCvv = getDigitsOnly(input.cvv).slice(0, 3);

  return {
    cardholderName:
      cleanedCardholder.length < 2
        ? 'Enter the cardholder name as shown on your card.'
        : '',
    cardNumber:
      cleanedCardNumber.length !== 16
        ? 'Card number must be exactly 16 digits.'
        : '',
    expiry:
      !isValidExpiry(input.expiry)
        ? 'Enter a valid expiry date in MM/YY format.'
        : '',
    cvv:
      cleanedCvv.length !== 3
        ? 'CVV must be exactly 3 digits.'
        : '',
  };
};

const createPaymentReference = (): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const nonce = Math.floor(Math.random() * 900 + 100);
  return `PAY-${stamp}-${nonce}`;
};

export function TutorBookingPage({ tutor, onBack, onBackToDashboard, onConfirmBooking }: TutorBookingPageProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => BOOKING_MIN_DATE);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(BOOKING_MIN_DATE));
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [bookingStep, setBookingStep] = useState<'schedule' | 'checkout'>('schedule');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [touchedPaymentFields, setTouchedPaymentFields] = useState<Record<PaymentFieldKey, boolean>>({
    cardholderName: false,
    cardNumber: false,
    expiry: false,
    cvv: false,
  });
  const [bookingResult, setBookingResult] = useState<{
    status: 'success' | 'failure';
    title: string;
    message: string;
    paymentReference?: string;
  } | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [lastSuccessfulReceipt, setLastSuccessfulReceipt] = useState<{
    tutorName: string;
    dateLabel: string;
    timeLabel: string;
    durationHours: number;
    totalAmount: number;
    paymentReference: string;
    issuedAtIso: string;
  } | null>(null);

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
  const tutorAvailability = Array.isArray(tutor.availability) ? tutor.availability : [];

  const availableSlots = useMemo(
    () => buildAvailabilityForDate(tutorAvailability, selectedDate),
    [tutorAvailability, selectedDate]
  );
  const grouped = useMemo(() => groupSlotsByPeriod(availableSlots), [availableSlots]);

  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.id === selectedSlotId) || null,
    [availableSlots, selectedSlotId]
  );
  const selectedSessionDurationHours = useMemo(
    () => calculateSlotDurationHours(selectedSlot),
    [selectedSlot]
  );
  const sessionTotalAmount = useMemo(() => {
    const hourlyRate = Number(tutor.pricePerHour) || 0;
    return Math.max(0, Math.round(hourlyRate * selectedSessionDurationHours * 100) / 100);
  }, [tutor.pricePerHour, selectedSessionDurationHours]);
  const formattedSessionTotal = useMemo(() => formatLkr(sessionTotalAmount), [sessionTotalAmount]);
  const paymentFieldErrors = useMemo(
    () => getPaymentFieldErrors({ cardholderName, cardNumber, expiry, cvv }),
    [cardholderName, cardNumber, expiry, cvv]
  );
  const hasPaymentFieldErrors = useMemo(
    () => Object.values(paymentFieldErrors).some((error) => Boolean(error)),
    [paymentFieldErrors]
  );

  // Slot count per date for badge
  const getSlotCount = useCallback((date: Date) => buildAvailabilityForDate(tutorAvailability, date).length, [tutorAvailability]);

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
    setSelectedSlotId(null);
  }, [isDateInBookingRange]);

  const handleSlotClick = useCallback(
    (slotId: string) => {
      // If already selected, deselect
      if (selectedSlotId === slotId) {
        setSelectedSlotId(null);
        return;
      }
      setSelectedSlotId(slotId);
    },
    [selectedSlotId]
  );

  const sessionDateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const selectedSlotLabel = selectedSlot?.label || 'Selected session time';

  const markPaymentFieldTouched = (field: PaymentFieldKey) => {
    setTouchedPaymentFields((prev) => ({ ...prev, [field]: true }));
  };

  const downloadReceipt = (receipt: NonNullable<typeof lastSuccessfulReceipt>) => {
    const issuedDate = new Date(receipt.issuedAtIso);
    const issuedAt = Number.isNaN(issuedDate.getTime())
      ? receipt.issuedAtIso
      : issuedDate.toLocaleString('en-US');

    const content = [
      'TutorSphere Payment Receipt',
      '---------------------------',
      `Tutor: ${receipt.tutorName}`,
      `Session Date: ${receipt.dateLabel}`,
      `Session Time: ${receipt.timeLabel}`,
      `Duration: ${receipt.durationHours.toFixed(2)} hour(s)`,
      `Total Paid: ${formatLkr(receipt.totalAmount)}`,
      `Payment Reference: ${receipt.paymentReference}`,
      `Issued At: ${issuedAt}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tutorsphere-receipt-${receipt.paymentReference}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleContinueToCheckout = () => {
    if (!selectedSlot) {
      return;
    }

    setCheckoutError(null);
    setTouchedPaymentFields({
      cardholderName: false,
      cardNumber: false,
      expiry: false,
      cvv: false,
    });
    setBookingStep('checkout');
  };

  const handleSubmitPayment = async () => {
    if (!selectedSlot) {
      setCheckoutError('Please select a time slot before continuing to payment.');
      setBookingStep('schedule');
      return;
    }

    const cleanedCardNumber = getDigitsOnly(cardNumber);
    const cleanedCvv = getDigitsOnly(cvv).slice(0, 3);

    setTouchedPaymentFields({
      cardholderName: true,
      cardNumber: true,
      expiry: true,
      cvv: true,
    });

    if (hasPaymentFieldErrors) {
      setCheckoutError('Please correct the highlighted payment fields before continuing.');
      return;
    }

    setIsProcessingPayment(true);
    setCheckoutError(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const paymentReference = createPaymentReference();
      const shouldFailPayment = cleanedCardNumber.endsWith('0000') || cleanedCvv === '000';

      if (shouldFailPayment) {
        const failureReason = 'Payment authorization was declined by the payment gateway.';
        const response = await onConfirmBooking({
          slotId: selectedSlot.id,
          sessionDate: sessionDateLabel,
          sessionTime: selectedSlot.label,
          sessionDurationHours: selectedSessionDurationHours,
          sessionAmount: sessionTotalAmount,
          paymentStatus: 'failed',
          paymentReference,
          paymentFailureReason: failureReason,
        });

        if (!response?.ok) {
          setCheckoutError(response?.error || 'Payment failed and booking state could not be saved.');
          return;
        }

        setBookingResult({
          status: 'failure',
          title: 'Payment Failed',
          message: 'The payment was declined. The failed payment state has been saved in booking history for traceability.',
          paymentReference,
        });
        return;
      }

      const response = await onConfirmBooking({
        slotId: selectedSlot.id,
        sessionDate: sessionDateLabel,
        sessionTime: selectedSlot.label,
        sessionDurationHours: selectedSessionDurationHours,
        sessionAmount: sessionTotalAmount,
        paymentStatus: 'paid',
        paymentReference,
      });

      if (!response?.ok) {
        setCheckoutError(response?.error || 'Payment succeeded but booking confirmation failed.');
        return;
      }

      setBookingResult({
        status: 'success',
        title: 'Booking Confirmed!',
        message: 'Payment was successful and your session is now confirmed.',
        paymentReference,
      });
      setLastSuccessfulReceipt({
        tutorName: displayName,
        dateLabel: sessionDateLabel,
        timeLabel: selectedSlot.label,
        durationHours: selectedSessionDurationHours,
        totalAmount: sessionTotalAmount,
        paymentReference,
        issuedAtIso: new Date().toISOString(),
      });
      setReceiptModalOpen(true);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Failed to complete checkout. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (bookingResult) {
    const isSuccess = bookingResult.status === 'success';

    return (
      <div className="pb-20">
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
            <div className={`flex items-center gap-2 ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isSuccess ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span className="font-bold text-sm">{isSuccess ? 'Booking Confirmed' : 'Payment Failed'}</span>
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 mt-12 sm:mt-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-50 border border-slate-200/60 overflow-hidden"
          >
            <div className={`${isSuccess ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-rose-500 to-orange-500'} p-8 sm:p-10 text-center relative overflow-hidden`}>
              <div className="absolute inset-0 opacity-10">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="booking-result-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                      <circle cx="12" cy="12" r="1.5" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#booking-result-dots)" />
                </svg>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 400 }}
                className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center mx-auto mb-4"
              >
                {isSuccess ? <PartyPopper className="w-8 h-8 text-white" /> : <AlertTriangle className="w-8 h-8 text-white" />}
              </motion.div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{bookingResult.title}</h2>
              <p className="text-white/90 font-medium text-sm">{bookingResult.message}</p>
            </div>

            <div className="p-6 sm:p-10">
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

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 border border-indigo-100">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date</div>
                    <div className="font-bold text-slate-900 text-sm">{sessionDateLabel}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 border border-violet-100">
                    <Clock className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Time</div>
                    <div className="font-bold text-slate-900 text-sm">{selectedSlotLabel}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0 border border-emerald-100">
                    <CreditCard className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Charged</div>
                    <div className="font-bold text-slate-900 text-sm">{formattedSessionTotal}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {selectedSessionDurationHours.toFixed(2)} hour(s)
                    </div>
                  </div>
                </div>

                {bookingResult.paymentReference && (
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100">
                      <Lock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Payment Reference</div>
                      <div className="font-bold text-slate-900 text-sm">{bookingResult.paymentReference}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {isSuccess ? (
                  <>
                    <button
                      onClick={() => setReceiptModalOpen(true)}
                      className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      View Receipt
                    </button>
                    <button
                      onClick={onBackToDashboard}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                    >
                      <CalendarCheck className="w-5 h-5" />
                      Go to Dashboard
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setBookingResult(null);
                      setBookingStep('checkout');
                      setCheckoutError(null);
                    }}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    Try Payment Again
                  </button>
                )}

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

        <AnimatePresence>
          {isSuccess && receiptModalOpen && lastSuccessfulReceipt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-6"
              onClick={() => setReceiptModalOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white shadow-2xl overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                  <h3 className="text-xl font-extrabold text-slate-900">Payment Receipt</h3>
                  <p className="mt-1 text-sm font-medium text-slate-600">Your payment was completed successfully.</p>
                </div>

                <div className="p-6 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-500">Tutor</span>
                    <span className="font-bold text-slate-900 text-right">{lastSuccessfulReceipt.tutorName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-500">Date</span>
                    <span className="font-bold text-slate-900 text-right">{lastSuccessfulReceipt.dateLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-500">Time</span>
                    <span className="font-bold text-slate-900 text-right">{lastSuccessfulReceipt.timeLabel}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-500">Duration</span>
                    <span className="font-bold text-slate-900 text-right">{lastSuccessfulReceipt.durationHours.toFixed(2)} hour(s)</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-500">Total Paid</span>
                    <span className="font-black text-emerald-700 text-right">{formatLkr(lastSuccessfulReceipt.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold text-slate-500">Payment Ref</span>
                    <span className="font-bold text-slate-900 text-right break-all">{lastSuccessfulReceipt.paymentReference}</span>
                  </div>
                </div>

                <div className="px-6 pb-6 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => downloadReceipt(lastSuccessfulReceipt)}
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Receipt
                  </button>
                  <button
                    onClick={() => setReceiptModalOpen(false)}
                    className="sm:w-36 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (bookingStep === 'checkout') {
    return (
      <div className="pb-20">
        <header className="bg-white/80 backdrop-blur-lg border-b border-slate-200/60 sticky top-0 z-40 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
            <button
              onClick={() => {
                setBookingStep('schedule');
                setCheckoutError(null);
              }}
              className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 font-bold transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </div>
              <span className="hidden sm:inline">Back to Schedule</span>
            </button>

            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</div>
                <span className="text-xs font-bold text-indigo-600">Select Time</span>
              </div>
              <div className="w-8 h-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</div>
                <span className="text-xs font-bold text-indigo-600">Checkout</span>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 mt-8">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Secure Checkout</h1>
                  <p className="text-slate-500 mt-2 font-medium text-sm">Complete payment to confirm your booking instantly.</p>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Cardholder Name</label>
                    <input
                      value={cardholderName}
                      onChange={(event) => {
                        setCardholderName(event.target.value);
                        markPaymentFieldTouched('cardholderName');
                        setCheckoutError(null);
                      }}
                      onBlur={() => markPaymentFieldTouched('cardholderName')}
                      placeholder="Name on card"
                      className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 ${
                        touchedPaymentFields.cardholderName && paymentFieldErrors.cardholderName
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                          : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                      }`}
                    />
                    {touchedPaymentFields.cardholderName && paymentFieldErrors.cardholderName && (
                      <p className="mt-1.5 text-xs font-semibold text-rose-600">{paymentFieldErrors.cardholderName}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Card Number</label>
                    <input
                      value={cardNumber}
                      onChange={(event) => {
                        setCardNumber(formatCardNumberInput(event.target.value));
                        markPaymentFieldTouched('cardNumber');
                        setCheckoutError(null);
                      }}
                      onBlur={() => markPaymentFieldTouched('cardNumber')}
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium tracking-[0.2em] text-slate-900 outline-none focus:ring-2 ${
                        touchedPaymentFields.cardNumber && paymentFieldErrors.cardNumber
                          ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                          : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                      }`}
                    />
                    {touchedPaymentFields.cardNumber && paymentFieldErrors.cardNumber && (
                      <p className="mt-1.5 text-xs font-semibold text-rose-600">{paymentFieldErrors.cardNumber}</p>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-500">Expiry</label>
                      <input
                        value={expiry}
                        onChange={(event) => {
                          setExpiry(formatExpiryInput(event.target.value));
                          markPaymentFieldTouched('expiry');
                          setCheckoutError(null);
                        }}
                        onBlur={() => markPaymentFieldTouched('expiry')}
                        inputMode="numeric"
                        placeholder="MM/YY"
                        className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 ${
                          touchedPaymentFields.expiry && paymentFieldErrors.expiry
                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                            : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                        }`}
                      />
                      {touchedPaymentFields.expiry && paymentFieldErrors.expiry && (
                        <p className="mt-1.5 text-xs font-semibold text-rose-600">{paymentFieldErrors.expiry}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-500">CVV</label>
                      <input
                        value={cvv}
                        onChange={(event) => {
                          setCvv(getDigitsOnly(event.target.value).slice(0, 3));
                          markPaymentFieldTouched('cvv');
                          setCheckoutError(null);
                        }}
                        onBlur={() => markPaymentFieldTouched('cvv')}
                        inputMode="numeric"
                        placeholder="123"
                        className={`mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:ring-2 ${
                          touchedPaymentFields.cvv && paymentFieldErrors.cvv
                            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                            : 'border-slate-200 focus:border-indigo-400 focus:ring-indigo-100'
                        }`}
                      />
                      {touchedPaymentFields.cvv && paymentFieldErrors.cvv && (
                        <p className="mt-1.5 text-xs font-semibold text-rose-600">{paymentFieldErrors.cvv}</p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500">
                    Test mode: use a card ending with <span className="font-black text-slate-700">0000</span> (or CVV <span className="font-black text-slate-700">000</span>) to simulate a failed payment.
                  </div>

                  {checkoutError && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={isProcessingPayment || hasPaymentFieldErrors}
                      onClick={handleSubmitPayment}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isProcessingPayment ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          Pay & Confirm Booking
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingPayment}
                      onClick={() => {
                        setBookingStep('schedule');
                        setCheckoutError(null);
                      }}
                      className="sm:w-52 py-4 bg-slate-50 text-slate-700 rounded-2xl font-bold hover:bg-slate-100 transition-colors border border-slate-200 disabled:opacity-60"
                    >
                      Back to Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-50 border border-slate-200/60 p-6 sm:p-8 lg:sticky lg:top-28">
                <h3 className="text-xl font-black text-slate-900 mb-6">Order Summary</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden border border-indigo-200">
                      {tutor.avatar ? (
                        <img src={tutor.avatar} alt={displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="font-bold text-indigo-600">{displayName.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{displayName}</p>
                      <p className="text-xs font-medium text-slate-500">1-on-1 Video Session</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Date</p>
                      <p className="text-sm font-bold text-slate-900">{sessionDateLabel}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Time</p>
                      <p className="text-sm font-bold text-slate-900">{selectedSlotLabel}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 mb-5">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="font-bold text-slate-500 text-sm">Rate per hour</span>
                    <span className="font-bold text-slate-900">{formattedHourlyRate}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="font-bold text-slate-500 text-sm">Session Duration</span>
                    <span className="font-bold text-slate-900">{selectedSessionDurationHours.toFixed(2)} h</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-500 text-sm">Service Fee</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md text-xs uppercase tracking-wider">Free</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                    <span className="font-black text-slate-900 text-lg">Total</span>
                    <span className="font-black text-slate-900 text-3xl tracking-tight">{formattedSessionTotal}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 py-2.5 rounded-xl border border-slate-200">
                  <Shield className="w-4 h-4 text-emerald-500" /> Secure encrypted checkout
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ─── Slot rendering by tutor-defined availability ───
  const renderTimeSection = (
    title: string,
    icon: React.ReactNode,
    slots: BookingSlotOption[],
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
          {slots.map((slot) => {
            const isSelected = selectedSlotId === slot.id;

            return (
              <motion.button
                key={slot.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSlotClick(slot.id)}
                className={`py-3 px-3 rounded-xl border-2 font-bold transition-all text-sm flex items-center justify-center gap-2 relative ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "border-slate-100 bg-white text-slate-700 hover:border-indigo-300 hover:text-indigo-700 shadow-sm"
                }`}
                title={slot.label}
              >
                {isSelected && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                {slot.label}
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
              <span className={`text-xs font-bold ${selectedSlot ? 'text-indigo-600' : 'text-slate-400'}`}>Checkout</span>
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
                          <p className="text-sm text-slate-500 mt-1 font-medium">This tutor has not opened slots for this date yet.</p>
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
                        key={selectedSlot?.id || 'empty'}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className={`font-bold leading-tight text-sm ${selectedSlot ? "text-indigo-600" : "text-slate-400"}`}
                      >
                        {selectedSlot ? selectedSlot.label : "Select a time slot"}
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
                <div className="flex justify-between items-center mb-2.5">
                  <span className="font-bold text-slate-500 text-sm">Session Duration</span>
                  <span className="font-bold text-slate-900">{selectedSessionDurationHours.toFixed(2)} h</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-500 text-sm">Service Fee</span>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md text-xs uppercase tracking-wider">Free</span>
                </div>
                <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-lg">Total</span>
                  <span className="font-black text-slate-900 text-3xl tracking-tight">{formattedSessionTotal}</span>
                </div>
              </div>

              {/* Confirm Button */}
              <motion.button
                whileHover={{ scale: selectedSlot ? 1.02 : 1 }}
                whileTap={{ scale: selectedSlot ? 0.98 : 1 }}
                onClick={handleContinueToCheckout}
                disabled={!selectedSlotId}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                  selectedSlotId
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-200"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {selectedSlotId ? (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Continue to Checkout
                  </>
                ) : (
                  "Pick a Time"
                )}
              </motion.button>

              <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 bg-slate-50 py-2.5 rounded-xl">
                <Shield className="w-4 h-4 text-emerald-400" /> Secure payment is required before booking confirmation
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
