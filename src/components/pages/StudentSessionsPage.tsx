import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Clock,
  X,
  User,
  Video,
  Star,
} from 'lucide-react';

interface SessionRatingDraft {
  rating: number;
  feedback: string;
}

export interface StudentSessionsPageProps {
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

  getBookingPaymentStatus: (booking: any) => string;
  getBookingTutorName: (booking: any) => string;
  getBookingPaymentPillClassName: (status: string) => string;
  getBookingStatusPillClassName: (status: string) => string;
  isValidMeetingLink: (link: string | undefined) => boolean;
  canStudentManageBeforeStart: (booking: any) => boolean;

  handleHideBookingForCurrentUser: (booking: any) => void;
  handleStudentCancelBooking: (booking: any) => void;
  handleSubmitSessionRating: (booking: any) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export const StudentSessionsPage: React.FC<StudentSessionsPageProps> = ({
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
  getBookingPaymentStatus,
  getBookingTutorName,
  getBookingPaymentPillClassName,
  getBookingStatusPillClassName,
  isValidMeetingLink,
  canStudentManageBeforeStart,
  handleHideBookingForCurrentUser,
  handleStudentCancelBooking,
  handleSubmitSessionRating
}) => {

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
      {/* Header Banner */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="relative bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5 overflow-hidden mb-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 opacity-40 blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Calendar className="w-7 h-7 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">My Sessions</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base mt-1">Manage your tutoring schedules and past sessions.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
           <select
             value={studentBookingStatusFilter}
             onChange={(e) => setStudentBookingStatusFilter(e.target.value)}
             className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm"
           >
             <option value="all">All Statuses</option>
             <option value="pending">Pending</option>
             <option value="confirmed">Confirmed</option>
             <option value="completed">Completed</option>
             <option value="cancelled">Cancelled</option>
           </select>
           <select
             value={studentSessionTimelineFilter}
             onChange={(e) => setStudentSessionTimelineFilter(e.target.value)}
             className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm"
           >
             <option value="all">Any Time</option>
             <option value="upcoming">Upcoming</option>
             <option value="past">Past</option>
           </select>
        </div>
      </motion.div>

      {filteredStudentBookings.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-600 mb-2">No Sessions Found</p>
          <p className="text-sm font-medium text-slate-500">There are no bookings matching your current filters.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                className="relative bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full"
              >
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleHideBookingForCurrentUser(booking)}
                  className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-60 flex items-center justify-center transition-colors hover:text-slate-600"
                  title="Hide session"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex-1 mb-5">
                  <div className="flex flex-wrap gap-2 mb-4 pr-10">
                     <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingPaymentPillClassName(paymentStatus)}`}>
                       {paymentStatus}
                     </span>
                     <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                       {booking.status}
                     </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-slate-900 mb-4 line-clamp-2">{booking.subject} Session</h3>
                  
                  <div className="space-y-3 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-500 font-semibold flex items-center gap-2">
                         <Calendar className="w-4 h-4 text-slate-400" /> Date
                       </span>
                       <span className="font-bold text-slate-900">{booking.date}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-500 font-semibold flex items-center gap-2">
                         <Clock className="w-4 h-4 text-slate-400" /> Time
                       </span>
                       <span className="font-bold text-slate-900">{booking.timeSlot || 'Any Time'}</span>
                     </div>
                     <div className="flex justify-between items-center text-sm">
                       <span className="text-slate-500 font-semibold flex items-center gap-2">
                         <User className="w-4 h-4 text-slate-400" /> Tutor
                       </span>
                       <span className="font-bold text-emerald-600 line-clamp-1 max-w-[120px] text-right">{getBookingTutorName(booking)}</span>
                     </div>
                  </div>

                  {!hasValidMeetingLink && paymentStatus === 'paid' && booking.status === 'confirmed' && (
                    <div className="mt-4 bg-amber-50/80 border border-amber-100 rounded-lg px-3 py-2.5">
                      <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                         <Clock className="w-4 h-4" /> Waiting for tutor link
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

                <div className="pt-5 border-t border-slate-100 flex flex-col gap-3 mt-auto">
                  <div className="flex flex-wrap items-center gap-2">
                    {canJoinMeeting ? (
                      <a
                        href={booking.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Video className="w-4 h-4" /> Join
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex flex-1 justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        <Video className="w-4 h-4" /> Join
                      </button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleStudentCancelBooking(booking)}
                        className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    )}
                  </div>

                  {booking.status === 'completed' && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Rate This Session</p>

                      {existingReview ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <Star key={val} className={`w-4 h-4 ${val <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                          {existingReview.comment && <p className="text-sm font-medium text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-100 line-clamp-2">{existingReview.comment}</p>}
                        </div>
                      ) : (
                        <div className="space-y-3">
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
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-shadow bg-white"
                          />
                          <button
                            type="button"
                            disabled={isSubmittingRating || ratingDraft.rating < 1}
                            onClick={() => handleSubmitSessionRating(booking)}
                            className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                          >
                            {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
