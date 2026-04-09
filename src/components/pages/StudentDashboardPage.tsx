import React from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Calendar,
  Clock,
  Star,
  Users,
  User,
  ArrowRight,
  Award,
  Video,
  X,
  BookMarked,
  Layers,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { Booking, CourseEnrollment, Course } from '../../types';

interface SessionRatingDraft {
  rating: number;
  feedback: string;
}

export interface StudentDashboardPageProps {
  currentUser: any;
  studentDashboardBookings: any[];
  studentEnrolledCourses: Array<{ course: any; enrollment: any }>;
  filteredStudentBookings: any[];

  studentBookingStatusFilter: string;
  setStudentBookingStatusFilter: (val: any) => void;
  studentSessionTimelineFilter: string;
  setStudentSessionTimelineFilter: (val: any) => void;

  activeBookingActionId: string | null;
  studentReviewsBySessionId: Map<string, any>;
  sessionRatingDrafts: Record<string, SessionRatingDraft>;
  setSessionRatingDrafts: React.Dispatch<React.SetStateAction<Record<string, SessionRatingDraft>>>;
  activeRatingActionBookingId: string | null;

  handleHideBookingForCurrentUser: (booking: any) => void;
  getBookingPaymentStatus: (booking: any) => string;
  getBookingStatusPillClassName: (status: string) => string;
  getBookingPaymentPillClassName: (status: string) => string;
  canStudentManageBeforeStart: (booking: any) => boolean;
  isValidMeetingLink: (link: string | undefined) => boolean;
  handleStudentCancelBooking: (booking: any) => void;
  handleSubmitSessionRating: (booking: any) => void;
  handleOpenCourseLearning: (id: string) => void;
  handleShowCertificateModal: (enrollment: any, courseTitle: string) => void;
  getBookingTutorName: (booking: any) => string;
  setActiveTab: (tab: string) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' },
  }),
};

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = (props) => {
  const {
    currentUser,
    studentDashboardBookings,
    studentEnrolledCourses,
    filteredStudentBookings,
    studentBookingStatusFilter,
    setStudentBookingStatusFilter,
    studentSessionTimelineFilter,
    setStudentSessionTimelineFilter,
    activeBookingActionId,
    studentReviewsBySessionId,
    sessionRatingDrafts,
    setSessionRatingDrafts,
    activeRatingActionBookingId,
    handleHideBookingForCurrentUser,
    getBookingPaymentStatus,
    getBookingStatusPillClassName,
    getBookingPaymentPillClassName,
    canStudentManageBeforeStart,
    isValidMeetingLink,
    handleStudentCancelBooking,
    handleSubmitSessionRating,
    handleOpenCourseLearning,
    handleShowCertificateModal,
    getBookingTutorName,
    setActiveTab,
  } = props;

  const totalSessions = studentDashboardBookings.length;
  const readyToJoin = studentDashboardBookings.filter((b) => isValidMeetingLink(b.meetingLink)).length;
  const enrolledCount = studentEnrolledCourses.length;
  const avgProgress =
    studentEnrolledCourses.length > 0
      ? Math.round(
          studentEnrolledCourses.reduce((sum, entry) => sum + entry.enrollment.progress, 0) /
            studentEnrolledCourses.length
        )
      : 0;

  const summaryCards = [
    { label: 'Booked Sessions', value: totalSessions, color: 'text-indigo-700', iconBg: 'bg-indigo-50/80', accent: 'border-t-indigo-400', icon: Calendar },
    { label: 'Ready to Join', value: readyToJoin, color: 'text-emerald-700', iconBg: 'bg-emerald-50/80', accent: 'border-t-emerald-400', icon: Video },
    { label: 'Enrolled Courses', value: enrolledCount, color: 'text-cyan-700', iconBg: 'bg-cyan-50/80', accent: 'border-t-cyan-400', icon: BookOpen },
    { label: 'Avg Progress', value: `${avgProgress}%`, color: 'text-purple-700', iconBg: 'bg-purple-50/80', accent: 'border-t-purple-400', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* ──── Header Banner ──── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 overflow-hidden"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 opacity-40 blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {currentUser?.firstName?.charAt(0) || 'S'}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Student Workspace</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base mt-0.5">Manage your tutoring sessions and track learning progress.</p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('courses')}
          className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm tracking-wide hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.98]"
        >
          <BookOpen className="w-4 h-4" />
          Browse Catalog
        </button>
      </motion.div>

      {/* ──── Summary Cards Grid ──── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className={`relative overflow-hidden rounded-xl border border-slate-200/70 ${card.accent} border-t-4 p-4 md:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 group bg-white flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4`}
            >
              <div className={`w-10 h-10 rounded-xl shrink-0 ${card.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
                <Icon className={`w-5 h-5 ${card.color} opacity-90`} />
              </div>
              <div className="flex flex-col">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{card.label}</p>
                <p className={`text-2xl md:text-3xl font-extrabold ${card.color}`}>{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* ──── Main Section: Sessions ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="md:col-span-2 xl:col-span-2 rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden flex flex-col"
        >
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-lg bg-indigo-100/50 flex items-center justify-center">
                 <Calendar className="w-5 h-5 text-indigo-600" />
               </div>
               <div>
                  <h2 className="text-xl font-bold text-slate-900">My Sessions</h2>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">{filteredStudentBookings.length} results</p>
               </div>
             </div>
             
             <div className="flex flex-wrap gap-2">
                <select
                  value={studentBookingStatusFilter}
                  onChange={(event) => setStudentBookingStatusFilter(event.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-shadow"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <select
                  value={studentSessionTimelineFilter}
                  onChange={(event) => setStudentSessionTimelineFilter(event.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition-shadow"
                >
                  <option value="all">Any Time</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="past">Past</option>
                </select>
             </div>
          </div>

          <div className="p-5 bg-slate-50/30 flex-1">
            {filteredStudentBookings.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-white border border-dashed border-slate-200">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">No sessions match your filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredStudentBookings.map((booking, idx) => {
                  const isLoading = activeBookingActionId === booking.id;
                  const isSubmittingRating = activeRatingActionBookingId === booking.id;
                  const paymentStatus = getBookingPaymentStatus(booking);
                  const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed' && canStudentManageBeforeStart(booking);
                  const hasValidMeetingLink = isValidMeetingLink(booking.meetingLink);
                  const canJoinMeeting = hasValidMeetingLink && booking.status !== 'cancelled';
                  const existingReview = studentReviewsBySessionId.get(booking.id);
                  const ratingDraft = sessionRatingDrafts[booking.id] || { rating: 0, feedback: '' };

                  return (
                    <motion.div
                      key={booking.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className="relative bg-white rounded-xl border border-slate-200/70 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
                    >
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleHideBookingForCurrentUser(booking)}
                        className="absolute right-3 top-3 h-7 w-7 rounded-full border border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-60 flex items-center justify-center transition-colors"
                        title="Hide session"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex-1 mb-4">
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingPaymentPillClassName(paymentStatus)}`}>
                            {paymentStatus}
                          </span>
                          <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                            {booking.status}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1 line-clamp-1 pr-6">{booking.subject} Session</h3>
                        
                        <div className="space-y-2 mt-3">
                           <div className="flex items-center gap-2 text-sm text-slate-600">
                             <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                             <span className="font-medium">{booking.date} {booking.timeSlot ? `• ${booking.timeSlot}` : ''}</span>
                           </div>
                           <div className="flex items-center gap-2 text-sm text-slate-600">
                             <User className="w-4 h-4 text-slate-400 shrink-0" />
                             <span className="font-medium text-emerald-600">{getBookingTutorName(booking)}</span>
                           </div>
                        </div>

                        {!hasValidMeetingLink && paymentStatus === 'paid' && booking.status === 'confirmed' && (
                          <div className="mt-4 bg-amber-50/80 border border-amber-100 rounded-lg px-3 py-2">
                            <p className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
                               <Clock className="w-3.5 h-3.5" /> Waiting for tutor to submit link
                            </p>
                          </div>
                        )}

                        {!canStudentManageBeforeStart(booking) && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                           <div className="mt-4">
                             <p className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 inline-block">
                               Active/Past Session
                             </p>
                           </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 mt-auto">
                        {canJoinMeeting ? (
                          <a
                            href={booking.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                            <Video className="w-4 h-4" /> Join
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed"
                          >
                            <Video className="w-4 h-4" /> Join
                          </button>
                        )}

                        {canCancel && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleStudentCancelBooking(booking)}
                            className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
                          >
                            <X className="w-4 h-4" /> Cancel
                          </button>
                        )}
                      </div>

                      {/* Rating Component for Completed Sessions */}
                      {booking.status === 'completed' && (
                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rate This Session</p>

                          {existingReview ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <Star key={val} className={`w-4 h-4 ${val <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                ))}
                              </div>
                              {existingReview.comment && <p className="text-sm font-medium text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">{existingReview.comment}</p>}
                            </div>
                          ) : (
                            <div className="space-y-3 max-w-sm">
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => setSessionRatingDrafts(p => ({ ...p, [booking.id]: { rating: val, feedback: p[booking.id]?.feedback || '' } }))}
                                  >
                                    <Star className={`w-5 h-5 ${val <= ratingDraft.rating ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-200 hover:text-amber-200'} transition-all`} />
                                  </button>
                                ))}
                              </div>
                              <textarea
                                value={ratingDraft.feedback}
                                onChange={(e) => setSessionRatingDrafts(p => ({ ...p, [booking.id]: { rating: p[booking.id]?.rating || 0, feedback: e.target.value } }))}
                                placeholder="Optional feedback..."
                                rows={2}
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-shadow bg-slate-50 focus:bg-white"
                              />
                              <button
                                type="button"
                                disabled={isSubmittingRating || ratingDraft.rating < 1}
                                onClick={() => handleSubmitSessionRating(booking)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                              >
                                {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ──── Secondary Section: Course Progress ──── */}
        <motion.div
           initial={{ opacity: 0, y: 12 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3, duration: 0.4 }}
           className="md:col-span-1 xl:col-span-1 bg-white rounded-xl border border-slate-200/70 overflow-hidden flex flex-col h-max shadow-sm"
        >
          <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
             <div className="w-10 h-10 rounded-lg bg-cyan-100/50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-cyan-600" />
             </div>
             <h2 className="text-xl font-bold text-slate-900">Learning Progress</h2>
          </div>
          
          <div className="p-5 bg-slate-50/30">
            {studentEnrolledCourses.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                <BookMarked className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">No active courses.</p>
              </div>
            ) : (
               <div className="space-y-4">
                {studentEnrolledCourses.map(({ course, enrollment }) => {
                  const isCompleted = enrollment.progress >= 100;

                  return (
                    <div key={course.id} className="bg-white rounded-xl border border-slate-200/70 p-5 shadow-sm group hover:shadow-md hover:border-indigo-100 transition-all flex flex-col relative overflow-hidden">
                       <div className="flex items-start justify-between gap-3 mb-4">
                         <div className="w-10 h-10 rounded-lg bg-indigo-50/80 flex items-center justify-center shrink-0">
                           <BookOpen className="w-5 h-5 text-indigo-600" />
                         </div>
                         <div className="text-right">
                           <span className={`text-xl font-black ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>{enrollment.progress}%</span>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Done</p>
                         </div>
                       </div>
                       
                       <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{course.title}</h3>
                       <p className="text-xs font-medium text-slate-500 mt-0.5 mb-4">{course.subject}</p>

                       <div className="mt-auto">
                         <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                              style={{ width: `${enrollment.progress}%` }}
                            />
                         </div>

                         <div className="flex gap-2">
                           <button
                             type="button"
                             onClick={() => handleOpenCourseLearning(course.id)}
                             className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-indigo-700 hover:bg-slate-50 hover:text-indigo-800 transition-colors shadow-sm"
                           >
                             {isCompleted ? 'Review' : 'Continue'}
                           </button>
                           {isCompleted && (
                             <button
                               type="button"
                               onClick={() => handleShowCertificateModal(enrollment, course.title)}
                               className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 transition-colors shadow-sm"
                             >
                               Certificate
                             </button>
                           )}
                         </div>
                       </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
