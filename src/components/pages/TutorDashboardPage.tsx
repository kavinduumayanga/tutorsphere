/**
 * TutorDashboardPage – Modern SaaS-style Tutor Dashboard
 * Pure UI component. No backend logic changes.
 */
import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Calendar,
  Clock,
  Star,
  Users,
  ArrowRight,
  Award,
  Edit,
  X,
  CheckCircle,
  Link as LinkIcon,
  Wallet,
  BarChart3,
  Layers,
  Settings,
  User,
  TrendingUp,
  FileText,
  ExternalLink,
  ChevronRight,
  Copy,
  Video,
  CircleDollarSign,
  ShieldCheck,
  Activity,
} from 'lucide-react';

/* ─── Fade-up animation variant ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: 'easeOut' as const },
  }),
};

/* ─── Sidebar nav item type ─── */
interface SidebarItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  onClick?: () => void;
  external?: boolean;
}

/* ─── Props — mirrors every piece of data the old inline JSX referenced ─── */
export interface TutorDashboardPageProps {
  /* current user */
  currentUser: any;
  profileData: any;

  /* navigation callbacks */
  setActiveTab: (tab: string) => void;

  /* bookings */
  tutorDashboardBookings: any[];
  filteredTutorBookings: any[];
  tutorBookingStatusFilter: string;
  setTutorBookingStatusFilter: (v: any) => void;
  tutorSessionTimelineFilter: string;
  setTutorSessionTimelineFilter: (v: any) => void;
  activeBookingActionId: string | null;
  handleTutorBookingStatusChange: (booking: any, status: string) => void;
  handleTutorRescheduleBooking: (booking: any) => void;
  handleTutorMeetingLinkUpdate: (booking: any) => void;
  handleHideBookingForCurrentUser: (booking: any) => void;
  getBookingPaymentStatus: (booking: any) => string;
  getBookingStatusPillClassName: (status: string) => string;
  getBookingPaymentPillClassName: (status: string) => string;
  getBookingStudentName: (booking: any) => string;
  isValidMeetingLink: (link: string | undefined) => boolean;
  isPastSession: (booking: any) => boolean;
  canStudentManageBeforeStart: (booking: any) => boolean;

  /* courses & resources */
  myTutorCourses: any[];
  myTutorResources: any[];

  /* performance */
  tutorAverageRatingFromReviews: number;
  tutorCompletedPaidBookings: any[];
  tutorPerformanceFeedback: any[];

  /* bookings list (for meeting link copy) */
  bookings: any[];
}

export const TutorDashboardPage: React.FC<TutorDashboardPageProps> = (props) => {
  const {
    currentUser,
    profileData,
    setActiveTab,
    tutorDashboardBookings,
    filteredTutorBookings,
    tutorBookingStatusFilter,
    setTutorBookingStatusFilter,
    tutorSessionTimelineFilter,
    setTutorSessionTimelineFilter,
    activeBookingActionId,
    handleTutorBookingStatusChange,
    handleTutorRescheduleBooking,
    handleTutorMeetingLinkUpdate,
    handleHideBookingForCurrentUser,
    getBookingPaymentStatus,
    getBookingStatusPillClassName,
    getBookingPaymentPillClassName,
    getBookingStudentName,
    isValidMeetingLink,
    isPastSession,
    canStudentManageBeforeStart,
    myTutorCourses,
    myTutorResources,
    tutorAverageRatingFromReviews,
    tutorCompletedPaidBookings,
    tutorPerformanceFeedback,
    bookings,
  } = props;

  /* ─── Sidebar collapse state (mobile) ─── */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ─── Stat derivations (same logic, reused) ─── */
  const totalSessions = tutorDashboardBookings.length;
  const upcomingSessions = tutorDashboardBookings.filter(
    (b) => b.status !== 'cancelled' && !isPastSession(b)
  ).length;
  const pendingActions = tutorDashboardBookings.filter((b) => b.status === 'pending').length;
  const activeCourses = myTutorCourses.length;
  const resourcesCount = myTutorResources.length;
  const avgRating = tutorAverageRatingFromReviews.toFixed(1);

  /* ─── Sidebar items ─── */
  const sidebarItems: SidebarItem[] = [
    { key: 'profile', label: 'Profile & Quals', icon: User, onClick: () => setActiveTab('register') },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setActiveTab('settings') },
    ...(profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University'
      ? [{ key: 'availability', label: 'Availability', icon: Calendar, onClick: () => setActiveTab('manageAvailability') }]
      : []),
    { key: 'courses', label: 'Courses', icon: BookOpen, badge: activeCourses, onClick: () => setActiveTab('courses') },
    { key: 'resources', label: 'Resources', icon: Layers, badge: resourcesCount, onClick: () => setActiveTab('resources') },
    { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, onClick: () => setActiveTab('earnings') },
  ];

  /* ─── Summary cards config ─── */
  const summaryCards = [
    { label: 'Total Sessions', value: totalSessions, color: 'text-slate-900', bg: 'bg-gradient-to-br from-slate-50 to-slate-100/70', iconBg: 'bg-slate-200/60', icon: Calendar, border: 'border-slate-200/80' },
    { label: 'Upcoming', value: upcomingSessions, color: 'text-indigo-700', bg: 'bg-gradient-to-br from-indigo-50/80 to-indigo-100/40', iconBg: 'bg-indigo-100', icon: TrendingUp, border: 'border-indigo-200/60' },
    { label: 'Pending', value: pendingActions, color: 'text-amber-700', bg: 'bg-gradient-to-br from-amber-50/80 to-amber-100/40', iconBg: 'bg-amber-100', icon: Clock, border: 'border-amber-200/60' },
    { label: 'Courses', value: activeCourses, color: 'text-cyan-700', bg: 'bg-gradient-to-br from-cyan-50/80 to-cyan-100/40', iconBg: 'bg-cyan-100', icon: BookOpen, border: 'border-cyan-200/60' },
    { label: 'Resources', value: resourcesCount, color: 'text-emerald-700', bg: 'bg-gradient-to-br from-emerald-50/80 to-emerald-100/40', iconBg: 'bg-emerald-100', icon: FileText, border: 'border-emerald-200/60' },
    { label: 'Avg Rating', value: avgRating, color: 'text-violet-700', bg: 'bg-gradient-to-br from-violet-50/80 to-violet-100/40', iconBg: 'bg-violet-100', icon: Star, border: 'border-violet-200/60' },
  ];

  return (
    <div className="flex min-h-[calc(100vh-80px)] gap-0 lg:gap-8">

      {/* ════════ MOBILE SIDEBAR OVERLAY ════════ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ════════ SIDEBAR ════════ */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-[280px] lg:w-[260px] shrink-0
          bg-white border-r border-slate-100
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:rounded-[1.75rem] lg:border lg:border-slate-100 lg:shadow-[0_1px_4px_rgba(0,0,0,0.03)]
          overflow-y-auto
        `}
      >
        {/* Sidebar header */}
        <div className="p-6 pb-4 border-b border-slate-100/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-extrabold text-base shadow-md shadow-indigo-200/60">
              {(currentUser.firstName || 'T').charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {currentUser.firstName} {currentUser.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-5 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats (mini) */}
        <div className="px-5 py-4 grid grid-cols-2 gap-2.5">
          <div className="bg-indigo-50/60 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-indigo-700">{upcomingSessions}</p>
            <p className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-wider mt-0.5">Upcoming</p>
          </div>
          <div className="bg-amber-50/60 rounded-xl p-3 text-center">
            <p className="text-lg font-extrabold text-amber-700">{pendingActions}</p>
            <p className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider mt-0.5">Pending</p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-4 py-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-3 mb-2">Workspace</p>
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => {
                  item.onClick?.();
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-700 transition-all duration-200 group"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100/80 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                  <Icon className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] font-bold bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                    {item.badge}
                  </span>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors" />
              </button>
            );
          })}
        </nav>

        {/* session link copy */}
        <div className="p-4 mx-4 mb-4 rounded-xl bg-slate-50 border border-slate-100">
          <button
            onClick={() => {
              const latestLink = bookings[0]?.meetingLink;
              if (!latestLink) {
                alert('No session link available yet.');
                return;
              }
              navigator.clipboard.writeText(latestLink);
              alert('Latest session link copied to clipboard.');
            }}
            className="w-full flex items-center gap-3 text-left text-sm font-semibold text-slate-700 hover:text-indigo-700 transition-colors group"
          >
            <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
              <Copy className="w-4 h-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            </span>
            <span>Copy Session Link</span>
          </button>
        </div>
      </aside>

      {/* ════════ MAIN CONTENT ════════ */}
      <main className="flex-1 min-w-0 space-y-6">

        {/* Mobile menu toggle */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 shadow-sm hover:shadow transition-all"
        >
          <Layers className="w-4 h-4" />
          Menu
        </button>

        {/* ──── Header Banner ──── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/70 shadow-sm p-6 md:p-8"
        >
          {/* Decorative gradient orbs */}
          <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 opacity-50 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-12 w-40 h-40 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 opacity-40 blur-3xl" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                Tutor Workspace
              </h1>
              <p className="text-slate-500 mt-1.5 text-sm md:text-base max-w-xl">
                Manage your sessions, profile, content, and performance from one clean dashboard.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('earnings')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200/50 active:scale-[0.97]"
            >
              <BarChart3 className="w-4 h-4" />
              Revenue Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* ──── Summary Cards ──── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          {summaryCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                custom={i}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                className={`relative overflow-hidden rounded-2xl border ${card.border} ${card.bg} p-4 md:p-5 transition-shadow duration-300 hover:shadow-md group`}
              >
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center mb-3 transition-transform duration-300 group-hover:scale-110`}>
                  <Icon className={`w-4.5 h-4.5 ${card.color} opacity-80`} />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">{card.label}</p>
                <p className={`text-2xl font-extrabold ${card.color}`}>{card.value}</p>
              </motion.div>
            );
          })}
        </div>

        {/* ──── Revenue CTA Card ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white p-6 md:p-7 shadow-sm hover:shadow-md transition-shadow duration-300"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center shadow-sm">
                <Wallet className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tutor Revenue Dashboard</h3>
                <p className="text-slate-500 text-sm mt-0.5">
                  Earnings, payment history, source breakdown, and revenue charts.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('earnings')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 font-bold text-sm hover:bg-indigo-100 transition-colors active:scale-[0.97]"
            >
              Go to Revenue Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* ──── Session Management ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          {/* Section header */}
          <div className="p-6 md:p-7 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Session Management</h3>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 inline-block mt-1">
                    {filteredTutorBookings.length} sessions shown
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
                  <select
                    value={tutorBookingStatusFilter}
                    onChange={(e) => setTutorBookingStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Time</span>
                  <select
                    value={tutorSessionTimelineFilter}
                    onChange={(e) => setTutorSessionTimelineFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all outline-none"
                  >
                    <option value="all">Any Time</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="past">Past</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Session cards */}
          <div className="p-5 md:p-6">
            {filteredTutorBookings.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-slate-50/80 border border-dashed border-slate-200">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-semibold text-slate-500">No sessions match your filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTutorBookings.map((booking, idx) => {
                  const isLoading = activeBookingActionId === booking.id;
                  const paymentStatus = getBookingPaymentStatus(booking);
                  const isPaidBooking = paymentStatus === 'paid';
                  const canComplete = booking.status === 'confirmed' && isPaidBooking;
                  const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed';
                  const canReschedule = booking.status !== 'cancelled' && booking.status !== 'completed' && canStudentManageBeforeStart(booking);
                  const canSubmitMeetingLink = isPaidBooking && booking.status !== 'cancelled' && booking.status !== 'completed';
                  const canStartMeeting = booking.status === 'confirmed' && isPaidBooking && isValidMeetingLink(booking.meetingLink);

                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.35 }}
                      className="relative rounded-2xl border border-slate-200/70 bg-white p-5 pr-14 space-y-4 shadow-sm hover:shadow-md transition-shadow duration-300"
                    >
                      {/* Hide button */}
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleHideBookingForCurrentUser(booking)}
                        className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60 flex items-center justify-center transition-colors"
                        aria-label="Hide session card"
                        title="Hide session card"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      {/* Title row */}
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div>
                          <p className="text-base font-bold text-slate-900">{booking.subject} Session</p>
                          <p className="text-xs font-medium text-slate-400 mt-0.5">ID: {booking.id}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingPaymentPillClassName(paymentStatus)}`}>
                            payment {paymentStatus}
                          </span>
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
                        {[
                          { label: 'Date', value: booking.date },
                          { label: 'Time Slot', value: booking.timeSlot || 'Not specified' },
                          { label: 'Student', value: getBookingStudentName(booking), span: 'xl:col-span-2' },
                          {
                            label: 'Meeting Link',
                            value: isValidMeetingLink(booking.meetingLink) ? 'Ready' : 'Not submitted',
                            valueClass: isValidMeetingLink(booking.meetingLink) ? 'text-emerald-600' : 'text-amber-600',
                          },
                        ].map((detail) => (
                          <div key={detail.label} className={`bg-slate-50/80 rounded-xl border border-slate-100 p-3 ${(detail as any).span || ''}`}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{detail.label}</p>
                            <p className={`font-semibold mt-1 ${(detail as any).valueClass || 'text-slate-800'}`}>{detail.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Payment failure message */}
                      {paymentStatus === 'failed' && (
                        <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                          {booking.paymentFailureReason || 'Payment failed for this booking. Ask the student to retry checkout.'}
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isLoading || !canComplete}
                          onClick={() => handleTutorBookingStatusChange(booking, 'completed')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors active:scale-[0.97]"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark Completed
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || !canCancel}
                          onClick={() => handleTutorBookingStatusChange(booking, 'cancelled')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors active:scale-[0.97]"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || !canReschedule}
                          onClick={() => handleTutorRescheduleBooking(booking)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors active:scale-[0.97]"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Reschedule
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || !canSubmitMeetingLink}
                          onClick={() => handleTutorMeetingLinkUpdate(booking)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors active:scale-[0.97]"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Meeting Link
                        </button>
                        {canStartMeeting ? (
                          <a
                            href={booking.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 transition-colors active:scale-[0.97]"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Start Meeting
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-200 text-slate-500 cursor-not-allowed"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Start Meeting
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ──── Performance Panel ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="rounded-2xl border border-slate-200/70 bg-white shadow-sm overflow-hidden"
        >
          <div className="p-6 md:p-7 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Activity className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Performance</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('earnings')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 transition-colors"
            >
              Revenue Details
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 md:p-6 space-y-6">
            {/* Performance stats */}
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: 'Sessions Completed', value: tutorCompletedPaidBookings.length, color: 'text-emerald-600', bg: 'bg-emerald-50/60', icon: ShieldCheck },
                { label: 'Average Rating', value: tutorAverageRatingFromReviews.toFixed(1), color: 'text-indigo-600', bg: 'bg-indigo-50/60', icon: Star },
                { label: 'Written Feedback', value: tutorPerformanceFeedback.length, color: 'text-slate-800', bg: 'bg-slate-50/60', icon: FileText },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className={`rounded-2xl border border-slate-200/70 ${stat.bg} p-5 group hover:shadow-sm transition-shadow`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={`w-4 h-4 ${stat.color}`} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
                    </div>
                    <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Recent feedback */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <MessageSquareIcon className="w-3.5 h-3.5" />
                Recent Feedback
              </h4>
              {tutorPerformanceFeedback.length === 0 ? (
                <p className="text-sm font-medium text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3">
                  No written feedback yet.
                </p>
              ) : (
                tutorPerformanceFeedback.map((review: any) => (
                  <div key={review.id} className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-900">{review.studentName}</p>
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {review.rating.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

/* Small helper icon — lucide doesn't export MessageSquare with proper name so alias */
const MessageSquareIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);
