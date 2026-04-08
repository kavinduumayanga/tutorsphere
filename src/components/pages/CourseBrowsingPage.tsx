import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Play,
  Users,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Star,
  BookOpen,
  SlidersHorizontal,
  X,
  GraduationCap,
  Sparkles,
  TrendingUp,
  Clock,
  Filter,
  LayoutGrid,
  Eye,
  Award,
  CheckCircle,
  Layers,
  ArrowUpDown,
  TicketPercent,
  CreditCard,
  Loader2,
  Shield,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Course, CourseEnrollment, Tutor } from '../../types';
import { formatLkr } from '../../utils/currency';

type CourseCheckoutSubmission = {
  paymentReference: string;
  couponCode?: string;
};

type CouponValidationResult = {
  valid: boolean;
  couponCode: string;
  discountPercentage: number;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CourseBrowsingPageProps {
  courses: Course[];
  tutors: Tutor[];
  isStudent: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  studentEnrollmentByCourseId: Map<string, CourseEnrollment>;
  enrollmentCountByCourseId: Map<string, number>;
  courseSearchQuery: string;
  courseCategoryFilter: string;
  onSetCourseSearchQuery: (q: string) => void;
  onSetCourseCategoryFilter: (cat: string) => void;
  onEnrollCourse: (
    courseId: string,
    checkout?: CourseCheckoutSubmission
  ) => Promise<{ ok: boolean; error?: string }>;
  onValidateCourseCoupon: (courseId: string, couponCode: string) => Promise<CouponValidationResult>;
  onOpenCourseLearning: (courseId: string) => void;
  onViewCertificate: (enrollment: CourseEnrollment, courseTitle: string) => void;
  stemSubjects: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 9;

type SortOption = 'popular' | 'newest' | 'price-low' | 'price-high' | 'rating';

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ElementType }[] = [
  { value: 'popular', label: 'Most Popular', icon: TrendingUp },
  { value: 'newest', label: 'Newest', icon: Clock },
  { value: 'price-low', label: 'Price: Low → High', icon: ArrowUpDown },
  { value: 'price-high', label: 'Price: High → Low', icon: ArrowUpDown },
  { value: 'rating', label: 'Top Rated', icon: Star },
];

const LEVEL_COLORS: Record<string, string> = {
  Beginner: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Intermediate: 'bg-amber-100 text-amber-700 border-amber-200',
  Advanced: 'bg-rose-100 text-rose-700 border-rose-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic level based on module count */
const getCourseLevel = (moduleCount: number): string => {
  if (moduleCount <= 3) return 'Beginner';
  if (moduleCount <= 6) return 'Intermediate';
  return 'Advanced';
};

const getTutorDisplayName = (tutor: Tutor & { name?: string }) => {
  const firstName = tutor.firstName?.trim();
  const lastName = tutor.lastName?.trim();
  if (firstName || lastName) return `${firstName || ''} ${lastName || ''}`.trim();
  return (tutor as any).name?.trim() || 'Tutor';
};

/** Mock a rating from course data — deterministic per course id */
const getCourseRating = (courseId: string, enrolledCount: number): number => {
  if (enrolledCount === 0) return 0;
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) hash = ((hash << 5) - hash + courseId.charCodeAt(i)) | 0;
  const base = 3.5 + (Math.abs(hash) % 15) / 10; // 3.5 - 5.0
  return Math.round(base * 10) / 10;
};

const getEntityTimestamp = (item: { id: string }): number => {
  const createdAt = Date.parse(String((item as any).createdAt || ''));
  if (!Number.isNaN(createdAt)) {
    return createdAt;
  }

  const updatedAt = Date.parse(String((item as any).updatedAt || ''));
  if (!Number.isNaN(updatedAt)) {
    return updatedAt;
  }

  return 0;
};

const getDigitsOnly = (value: string): string => value.replace(/\D/g, '');

const formatCardNumberInput = (value: string): string => {
  const digits = getDigitsOnly(value).slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
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

const createCoursePaymentReference = (): string => {
  const stamp = Date.now().toString(36).toUpperCase();
  const nonce = Math.floor(Math.random() * 900 + 100);
  return `CRS-${stamp}-${nonce}`;
};

// ─── Skeleton Components ──────────────────────────────────────────────────────

const CardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden animate-pulse">
    <div className="aspect-[16/10] bg-slate-200" />
    <div className="p-5 space-y-4">
      <div className="space-y-2">
        <div className="h-5 w-3/4 bg-slate-200 rounded-lg" />
        <div className="h-4 w-full bg-slate-100 rounded-lg" />
        <div className="h-4 w-2/3 bg-slate-100 rounded-lg" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-slate-200" />
        <div className="h-3 w-24 bg-slate-200 rounded" />
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-slate-100">
        <div className="h-5 w-16 bg-slate-200 rounded" />
        <div className="h-9 w-28 bg-slate-200 rounded-xl" />
      </div>
    </div>
  </div>
);

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {[...Array(6)].map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

// ─── Star Rating Component ────────────────────────────────────────────────────

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        style={{ width: size, height: size }}
        className={`${
          star <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'
        }`}
      />
    ))}
  </div>
);

// ─── Quick Preview Modal ──────────────────────────────────────────────────────

interface QuickPreviewProps {
  course: Course;
  tutor: Tutor | undefined;
  enrollment: CourseEnrollment | undefined;
  enrolledCount: number;
  isStudent: boolean;
  isLoggedIn: boolean;
  onClose: () => void;
  onPrimaryAction: (course: Course) => void;
  onContinue: (courseId: string) => void;
  onViewCertificate: (enrollment: CourseEnrollment, courseTitle: string) => void;
}

const QuickPreviewModal: React.FC<QuickPreviewProps> = ({
  course,
  tutor,
  enrollment,
  enrolledCount,
  isStudent,
  isLoggedIn,
  onClose,
  onPrimaryAction,
  onContinue,
  onViewCertificate,
}) => {
  const isEnrolled = Boolean(enrollment);
  const progress = enrollment?.progress || 0;
  const isFreeCourse = course.isFree || course.price <= 0;
  const level = getCourseLevel(course.modules.length);
  const rating = getCourseRating(course.id, enrolledCount);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thumbnail */}
        <div className="relative aspect-[21/9] overflow-hidden bg-slate-100 flex-shrink-0">
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Overlay badges */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <span className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-slate-800">
              {course.subject}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${LEVEL_COLORS[level]}`}>
              {level}
            </span>
          </div>
          <div className="absolute bottom-4 right-4">
            <span className={`px-3 py-1.5 rounded-full text-sm font-extrabold ${isFreeCourse ? 'bg-emerald-500 text-white' : 'bg-white/95 text-slate-900 backdrop-blur-sm'}`}>
              {isFreeCourse ? 'Free' : formatLkr(course.price)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{course.title}</h2>
            <p className="text-slate-500 mt-2 text-sm leading-relaxed">{course.description}</p>
          </div>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <StarRating rating={rating} size={14} />
              <span className="font-bold text-slate-700">{rating > 0 ? rating : '—'}</span>
              <span className="text-slate-400">({enrolledCount})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Play className="w-3.5 h-3.5" />
              <span className="font-semibold">{course.modules.length} Modules</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users className="w-3.5 h-3.5" />
              <span className="font-semibold">{enrolledCount} Students</span>
            </div>
          </div>

          {/* Instructor */}
          {tutor && (
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <img
                src={tutor.avatar || 'https://via.placeholder.com/40'}
                alt=""
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
                referrerPolicy="no-referrer"
              />
              <div>
                <p className="text-sm font-bold text-slate-900">{getTutorDisplayName(tutor)}</p>
                <p className="text-xs text-slate-500">
                  {tutor.teachingLevel} Tutor
                  {tutor.rating > 0 && ` · ★ ${tutor.rating}`}
                </p>
              </div>
            </div>
          )}

          {/* Module List Preview */}
          {course.modules.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Course Content</h4>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {course.modules.map((mod, idx) => {
                  const isModCompleted = enrollment?.completedModuleIds?.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        isModCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {isModCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className="text-sm text-slate-700 font-medium truncate">{mod.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progress for enrolled */}
          {isEnrolled && (
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Your Progress</span>
                <span className="text-sm font-extrabold text-indigo-700">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-indigo-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              {progress === 100 && enrollment && (
                <button
                  onClick={() => {
                    onViewCertificate(enrollment, course.title);
                    onClose();
                  }}
                  className="w-full mt-3 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" /> View Certificate
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <button
            onClick={() => {
              if (isStudent && isEnrolled) onContinue(course.id);
              else onPrimaryAction(course);
              onClose();
            }}
            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              isStudent && isEnrolled
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                : isFreeCourse
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-300'
            }`}
          >
            {isStudent && isEnrolled ? (
              <><Play className="w-4 h-4" /> Continue Learning</>
            ) : isFreeCourse ? (
              <><Sparkles className="w-4 h-4" /> Enroll for Free</>
            ) : (
              <><GraduationCap className="w-4 h-4" /> Buy Link — {formatLkr(course.price)}</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

interface CheckoutModalProps {
  course: Course;
  couponInput: string;
  appliedCoupon: CouponValidationResult | null;
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  isApplyingCoupon: boolean;
  isSubmitting: boolean;
  errorMessage: string | null;
  couponMessage: string | null;
  onCouponInputChange: (value: string) => void;
  onApplyCoupon: () => Promise<void>;
  onClearCoupon: () => void;
  onCardholderNameChange: (value: string) => void;
  onCardNumberChange: (value: string) => void;
  onExpiryChange: (value: string) => void;
  onCvvChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  onClose: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  course,
  couponInput,
  appliedCoupon,
  cardholderName,
  cardNumber,
  expiry,
  cvv,
  isApplyingCoupon,
  isSubmitting,
  errorMessage,
  couponMessage,
  onCouponInputChange,
  onApplyCoupon,
  onClearCoupon,
  onCardholderNameChange,
  onCardNumberChange,
  onExpiryChange,
  onCvvChange,
  onSubmit,
  onClose,
}) => {
  const originalPrice = appliedCoupon?.originalPrice ?? Math.max(0, Number(course.price) || 0);
  const discountAmount = appliedCoupon?.discountAmount ?? 0;
  const finalPrice = appliedCoupon?.finalPrice ?? originalPrice;
  const hasAppliedCoupon = Boolean(appliedCoupon);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        className="w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">
                <CreditCard className="h-3.5 w-3.5" />
                Secure Checkout
              </p>
              <h3 className="mt-2 text-lg font-extrabold text-slate-900">Course Payment Portal</h3>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[82vh] overflow-y-auto p-6 sm:p-8">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200/60 overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Secure Checkout</h1>
                  <p className="text-slate-500 mt-2 font-medium text-sm">Complete payment to confirm your course enrollment instantly.</p>
                </div>

                <div className="p-6 sm:p-8 space-y-6">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Cardholder Name</label>
                    <input
                      value={cardholderName}
                      onChange={(event) => onCardholderNameChange(event.target.value)}
                      placeholder="Name on card"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-slate-500">Card Number</label>
                    <input
                      value={cardNumber}
                      onChange={(event) => onCardNumberChange(event.target.value)}
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium tracking-[0.2em] text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-500">Expiry</label>
                      <input
                        value={expiry}
                        onChange={(event) => onExpiryChange(event.target.value)}
                        inputMode="numeric"
                        placeholder="MM/YY"
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-slate-500">CVV</label>
                      <input
                        value={cvv}
                        onChange={(event) => onCvvChange(event.target.value)}
                        inputMode="numeric"
                        placeholder="123"
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-500">
                    Test mode: use a card ending with <span className="font-black text-slate-700">0000</span> (or CVV <span className="font-black text-slate-700">000</span>) to simulate a failed payment.
                  </div>

                  {errorMessage && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        void onSubmit();
                      }}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          Pay & Enroll Course
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={onClose}
                      className="sm:w-52 py-4 bg-slate-50 text-slate-700 rounded-2xl font-bold hover:bg-slate-100 transition-colors border border-slate-200 disabled:opacity-60"
                    >
                      Back to Courses
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-50 border border-slate-200/60 p-6 sm:p-8 lg:sticky lg:top-6">
                <h3 className="text-xl font-black text-slate-900 mb-6">Order Summary</h3>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 overflow-hidden border border-indigo-200">
                      {course.thumbnail ? (
                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <GraduationCap className="w-5 h-5 text-indigo-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm line-clamp-1">{course.title}</p>
                      <p className="text-xs font-medium text-slate-500">Course Purchase</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Coupon Code</p>
                      {appliedCoupon && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                          Applied {appliedCoupon.discountPercentage}%
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="relative">
                        <TicketPercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={couponInput}
                          onChange={(event) => onCouponInputChange(event.target.value.toUpperCase())}
                          placeholder="Enter coupon code"
                          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold uppercase tracking-wide text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            void onApplyCoupon();
                          }}
                          disabled={isApplyingCoupon || !couponInput.trim()}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Apply
                        </button>
                        {appliedCoupon && (
                          <button
                            onClick={onClearCoupon}
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {couponMessage && (
                      <p className="text-xs font-semibold text-emerald-600">{couponMessage}</p>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Coupon</p>
                      <p className="text-sm font-bold text-slate-900">
                        {hasAppliedCoupon ? `${appliedCoupon?.couponCode} (${appliedCoupon?.discountPercentage}% off)` : 'Not applied'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Access</p>
                      <p className="text-sm font-bold text-slate-900">Instant after payment</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 mb-5">
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="font-bold text-slate-500 text-sm">Course Price</span>
                    <span className="font-bold text-slate-900">{formatLkr(originalPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-500 text-sm">Discount</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md text-xs uppercase tracking-wider">
                      -{formatLkr(discountAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                    <span className="font-black text-slate-900 text-lg">Total</span>
                    <span className="font-black text-slate-900 text-3xl tracking-tight">{formatLkr(finalPrice)}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 py-2.5 rounded-xl border border-slate-200">
                  <Shield className="w-4 h-4 text-emerald-500" /> Secure encrypted checkout
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const CourseBrowsingPage: React.FC<CourseBrowsingPageProps> = ({
  courses,
  tutors,
  isStudent,
  isLoggedIn,
  isLoading,
  studentEnrollmentByCourseId,
  enrollmentCountByCourseId,
  courseSearchQuery,
  courseCategoryFilter,
  onSetCourseSearchQuery,
  onSetCourseCategoryFilter,
  onEnrollCourse,
  onValidateCourseCoupon,
  onOpenCourseLearning,
  onViewCertificate,
  stemSubjects,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [currentPage, setCurrentPage] = useState(1);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [checkoutCourse, setCheckoutCourse] = useState<Course | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);

  const categories = useMemo(() => ['All', ...stemSubjects], [stemSubjects]);

  // ── Filtering ──

  const filteredCourses = useMemo(() => {
    let result = courses.filter((course) => {
      const matchesSearch =
        courseSearchQuery === '' ||
        course.title.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(courseSearchQuery.toLowerCase());
      const matchesCategory =
        courseCategoryFilter === 'All Categories' ||
        courseCategoryFilter === 'All' ||
        course.subject === courseCategoryFilter;
      return matchesSearch && matchesCategory;
    });

    // Sort
    switch (sortBy) {
      case 'popular':
        result.sort((a, b) => {
          const ac = enrollmentCountByCourseId.get(a.id) ?? a.enrolledStudents.length;
          const bc = enrollmentCountByCourseId.get(b.id) ?? b.enrolledStudents.length;
          return bc - ac;
        });
        break;
      case 'newest':
        result.sort((a, b) => {
          const timeDelta = getEntityTimestamp(b) - getEntityTimestamp(a);
          if (timeDelta !== 0) {
            return timeDelta;
          }
          return b.id.localeCompare(a.id);
        });
        break;
      case 'price-low':
        result.sort((a, b) => {
          const ap = a.isFree || a.price <= 0 ? 0 : a.price;
          const bp = b.isFree || b.price <= 0 ? 0 : b.price;
          return ap - bp;
        });
        break;
      case 'price-high':
        result.sort((a, b) => {
          const ap = a.isFree || a.price <= 0 ? 0 : a.price;
          const bp = b.isFree || b.price <= 0 ? 0 : b.price;
          return bp - ap;
        });
        break;
      case 'rating':
        result.sort((a, b) => {
          const ac = enrollmentCountByCourseId.get(a.id) ?? a.enrolledStudents.length;
          const bc = enrollmentCountByCourseId.get(b.id) ?? b.enrolledStudents.length;
          return getCourseRating(b.id, bc) - getCourseRating(a.id, ac);
        });
        break;
    }

    return result;
  }, [courses, courseSearchQuery, courseCategoryFilter, sortBy, enrollmentCountByCourseId]);

  // ── Pagination ──

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / ITEMS_PER_PAGE));
  const paginatedCourses = useMemo(
    () => filteredCourses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredCourses, currentPage]
  );

  // reset page on filter change
  const handleCategoryChange = useCallback(
    (cat: string) => {
      onSetCourseCategoryFilter(cat === 'All' ? 'All Categories' : cat);
      setCurrentPage(1);
    },
    [onSetCourseCategoryFilter]
  );

  const handleSearchChange = useCallback(
    (q: string) => {
      onSetCourseSearchQuery(q);
      setCurrentPage(1);
    },
    [onSetCourseSearchQuery]
  );

  const handleSortChange = useCallback((opt: SortOption) => {
    setSortBy(opt);
    setCurrentPage(1);
    setShowSortDropdown(false);
  }, []);

  const toggleWishlist = useCallback((courseId: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }, []);

  const resetCheckoutState = () => {
    setCouponInput('');
    setAppliedCoupon(null);
    setCardholderName('');
    setCardNumber('');
    setExpiry('');
    setCvv('');
    setCheckoutError(null);
    setCouponMessage(null);
    setIsApplyingCoupon(false);
    setIsSubmittingCheckout(false);
  };

  const closeCheckoutModal = () => {
    setCheckoutCourse(null);
    resetCheckoutState();
  };

  const handlePrimaryCourseAction = useCallback(async (course: Course) => {
    setActionError(null);

    const enrollment = studentEnrollmentByCourseId.get(course.id);
    if (isStudent && enrollment) {
      onOpenCourseLearning(course.id);
      return;
    }

    if (!isStudent || !isLoggedIn) {
      const result = await onEnrollCourse(course.id);
      if (!result.ok && result.error) {
        setActionError(result.error);
      }
      return;
    }

    const isFreeCourse = course.isFree || course.price <= 0;
    if (isFreeCourse) {
      const result = await onEnrollCourse(course.id);
      if (!result.ok && result.error) {
        setActionError(result.error);
      }
      return;
    }

    resetCheckoutState();
    setCheckoutCourse(course);
  }, [
    isLoggedIn,
    isStudent,
    onEnrollCourse,
    onOpenCourseLearning,
    studentEnrollmentByCourseId,
  ]);

  const handleApplyCoupon = async () => {
    if (!checkoutCourse) {
      return;
    }

    const code = couponInput.trim();
    if (!code) {
      setCheckoutError('Enter a coupon code before applying.');
      return;
    }

    setCheckoutError(null);
    setCouponMessage(null);
    setIsApplyingCoupon(true);

    try {
      const validation = await onValidateCourseCoupon(checkoutCourse.id, code);
      setAppliedCoupon(validation);
      setCouponInput(validation.couponCode);
      setCouponMessage(`${validation.couponCode} applied successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply coupon.';
      setAppliedCoupon(null);
      setCouponMessage(null);
      setCheckoutError(message);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCouponInputChange = (value: string) => {
    const normalizedValue = value.toUpperCase();
    setCouponInput(normalizedValue);
    setCheckoutError(null);
    setCouponMessage(null);

    if (appliedCoupon && normalizedValue.trim() !== appliedCoupon.couponCode) {
      setAppliedCoupon(null);
    }
  };

  const handleCheckoutSubmit = async () => {
    if (!checkoutCourse) {
      return;
    }

    const cleanedCardholder = cardholderName.trim();
    const cleanedCardNumber = getDigitsOnly(cardNumber);
    const cleanedCvv = getDigitsOnly(cvv).slice(0, 4);

    if (cleanedCardholder.length < 2) {
      setCheckoutError('Cardholder name is required.');
      return;
    }

    if (cleanedCardNumber.length !== 16) {
      setCheckoutError('Enter a valid 16-digit card number.');
      return;
    }

    if (!isValidExpiry(expiry)) {
      setCheckoutError('Enter a valid expiry date in MM/YY format.');
      return;
    }

    if (cleanedCvv.length < 3) {
      setCheckoutError('Enter a valid CVV (3 or 4 digits).');
      return;
    }

    setCheckoutError(null);
    setIsSubmittingCheckout(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 900));

      const paymentReference = createCoursePaymentReference();
      const shouldFailPayment = cleanedCardNumber.endsWith('0000') || cleanedCvv === '000';

      if (shouldFailPayment) {
        setCheckoutError('Payment authorization was declined by the payment gateway. Please try a different card.');
        return;
      }

      const result = await onEnrollCourse(checkoutCourse.id, {
        paymentReference,
        couponCode: appliedCoupon?.couponCode,
      });

      if (!result.ok) {
        setCheckoutError(result.error || 'Failed to enroll in course.');
        return;
      }

      closeCheckoutModal();
    } finally {
      setIsSubmittingCheckout(false);
    }
  };

  const activeCategory = courseCategoryFilter === 'All Categories' ? 'All' : courseCategoryFilter;
  const activeSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || 'Sort';
  const hasActiveFilters = courseSearchQuery !== '' || activeCategory !== 'All';

  const clearAllFilters = () => {
    onSetCourseSearchQuery('');
    onSetCourseCategoryFilter('All Categories');
    setCurrentPage(1);
  };

  // ── Render ──

  return (
    <div className="space-y-8">
      {/* ═══════ PAGE HEADER ═══════ */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-extrabold uppercase tracking-widest">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Course Catalog</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Browse Courses
          </h2>
          <p className="text-slate-500 text-sm sm:text-base max-w-lg leading-relaxed">
            Explore curated STEM courses taught by professional tutors. Learn at your own pace.
          </p>
        </div>

        {/* Search + Sort */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search courses…"
              value={courseSearchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all placeholder:text-slate-400"
            />
            {courseSearchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-slate-300 transition-all whitespace-nowrap"
            >
              <ArrowUpDown className="w-4 h-4" />
              <span className="hidden sm:inline">{activeSortLabel}</span>
            </button>
            <AnimatePresence>
              {showSortDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSortDropdown(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleSortChange(opt.value)}
                          className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors ${
                            sortBy === opt.value
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {opt.label}
                          {sortBy === opt.value && <CheckCircle className="w-3.5 h-3.5 ml-auto text-indigo-500" />}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {actionError}
        </div>
      )}

      {/* ═══════ CATEGORY PILLS ═══════ */}
      <div className="flex items-center gap-2 flex-wrap">
        {categories.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50/50'
              }`}
            >
              {cat}
            </button>
          );
        })}
        {/* Results count + clear */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">
            {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ═══════ COURSE GRID ═══════ */}
      {isLoading ? (
        <SkeletonGrid />
      ) : filteredCourses.length === 0 ? (
        /* ── Empty State ── */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-indigo-50 flex items-center justify-center mb-6">
            <BookOpen className="w-9 h-9 text-slate-400" />
          </div>
          <h3 className="text-xl font-extrabold text-slate-900">No courses found</h3>
          <p className="text-slate-500 mt-2 max-w-xs text-sm leading-relaxed">
            We couldn't find any courses matching your filters. Try adjusting your search or browse all categories.
          </p>
          <button
            onClick={clearAllFilters}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
          >
            <LayoutGrid className="w-4 h-4" /> Show All Courses
          </button>
        </motion.div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {paginatedCourses.map((course) => {
              const enrollment = studentEnrollmentByCourseId.get(course.id);
              const isEnrolled = Boolean(enrollment);
              const progress = enrollment?.progress || 0;
              const isFreeCourse = course.isFree || course.price <= 0;
              const tutorObj = tutors.find((t) => t.id === course.tutorId);
              const authorName = tutorObj ? getTutorDisplayName(tutorObj) : 'Unknown Instructor';
              const enrolledCount = enrollmentCountByCourseId.get(course.id) ?? course.enrolledStudents.length;
              const level = getCourseLevel(course.modules.length);
              const rating = getCourseRating(course.id, enrolledCount);
              const isWishlisted = wishlist.has(course.id);

              return (
                <motion.div
                  key={course.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ y: -6 }}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col"
                >
                  {/* ── Thumbnail ── */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                    />
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Category badge */}
                    <div className="absolute top-3 left-3">
                      <span className="bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-slate-800 uppercase tracking-widest shadow-sm">
                        {course.subject}
                      </span>
                    </div>

                    {/* Level tag */}
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border ${LEVEL_COLORS[level]}`}>
                        {level}
                      </span>
                    </div>

                    {/* Wishlist heart */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(course.id);
                      }}
                      className={`absolute bottom-3 right-3 p-2 rounded-xl transition-all duration-200 ${
                        isWishlisted
                          ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                          : 'bg-white/80 backdrop-blur-sm text-slate-500 opacity-0 group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-500'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                    </button>

                    {/* Quick preview button on hover */}
                    <button
                      onClick={() => setPreviewCourse(course)}
                      className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>

                    {/* Enrolled indicator */}
                    {isEnrolled && (
                      <div className="absolute top-3 left-3 mt-7">
                        <span className="inline-flex items-center gap-1 bg-emerald-500 text-white px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow-sm">
                          <CheckCircle className="w-2.5 h-2.5" /> Enrolled
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ── Card Body ── */}
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    {/* Title + Description */}
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {course.title}
                      </h3>
                      <p className="mt-1.5 text-slate-500 text-[13px] leading-relaxed line-clamp-2">
                        {course.description}
                      </p>
                    </div>

                    {/* Instructor */}
                    <div className="flex items-center gap-2">
                      {tutorObj?.avatar && (
                        <img
                          src={tutorObj.avatar}
                          alt=""
                          className="w-5 h-5 rounded-full object-cover border border-white shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <span className="text-xs font-medium text-slate-500">
                        {authorName}
                      </span>
                    </div>

                    {/* Meta Row */}
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>{course.modules.length} Modules</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{enrolledCount}</span>
                      </div>
                      {rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-bold text-slate-700">{rating}</span>
                        </div>
                      )}
                    </div>

                    {/* Progress (enrolled courses) */}
                    {isStudent && isEnrolled && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Progress</span>
                          <span className="text-[11px] font-extrabold text-indigo-600">{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer: Price + CTA */}
                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        {isFreeCourse ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold text-base">
                            <Sparkles className="w-4 h-4" /> Free
                          </span>
                        ) : (
                          <span className="text-slate-900 font-extrabold text-base">
                            {formatLkr(course.price)}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          void handlePrimaryCourseAction(course);
                        }}
                        className={`px-4 py-2 rounded-xl flex items-center gap-1.5 text-[13px] font-bold transition-all duration-200 ${
                          isStudent && isEnrolled
                            ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md hover:-translate-y-0.5'
                        }`}
                      >
                        {isStudent && isEnrolled ? (
                          <>Continue <ArrowRight className="w-3.5 h-3.5" /></>
                        ) : isFreeCourse ? (
                          <>Enroll <ArrowRight className="w-3.5 h-3.5" /></>
                        ) : (
                          <>Buy Link <ArrowRight className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ═══════ PAGINATION ═══════ */}
      {totalPages > 1 && filteredCourses.length > 0 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                page === currentPage
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ═══════ QUICK PREVIEW MODAL ═══════ */}
      <AnimatePresence>
        {previewCourse && (
          <QuickPreviewModal
            course={previewCourse}
            tutor={tutors.find((t) => t.id === previewCourse.tutorId)}
            enrollment={studentEnrollmentByCourseId.get(previewCourse.id)}
            enrolledCount={enrollmentCountByCourseId.get(previewCourse.id) ?? previewCourse.enrolledStudents.length}
            isStudent={isStudent}
            isLoggedIn={isLoggedIn}
            onClose={() => setPreviewCourse(null)}
            onPrimaryAction={(course) => {
              void handlePrimaryCourseAction(course);
            }}
            onContinue={onOpenCourseLearning}
            onViewCertificate={onViewCertificate}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {checkoutCourse && (
          <CheckoutModal
            course={checkoutCourse}
            couponInput={couponInput}
            appliedCoupon={appliedCoupon}
            cardholderName={cardholderName}
            cardNumber={cardNumber}
            expiry={expiry}
            cvv={cvv}
            isApplyingCoupon={isApplyingCoupon}
            isSubmitting={isSubmittingCheckout}
            errorMessage={checkoutError}
            couponMessage={couponMessage}
            onCouponInputChange={handleCouponInputChange}
            onApplyCoupon={handleApplyCoupon}
            onClearCoupon={() => {
              setAppliedCoupon(null);
              setCouponInput('');
              setCouponMessage(null);
              setCheckoutError(null);
            }}
            onCardholderNameChange={(value) => setCardholderName(value)}
            onCardNumberChange={(value) => setCardNumber(formatCardNumberInput(value))}
            onExpiryChange={(value) => setExpiry(formatExpiryInput(value))}
            onCvvChange={(value) => setCvv(getDigitsOnly(value).slice(0, 4))}
            onSubmit={handleCheckoutSubmit}
            onClose={closeCheckoutModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
