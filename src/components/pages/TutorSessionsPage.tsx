import React from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Clock,
  X,
  User,
  Video,
  Link as LinkIcon,
  CheckCircle,
} from 'lucide-react';

export interface TutorSessionsPageProps {
  filteredTutorBookings: any[];
  tutorBookingStatusFilter: string;
  setTutorBookingStatusFilter: (val: any) => void;
  tutorSessionTimelineFilter: string;
  setTutorSessionTimelineFilter: (val: any) => void;
  activeBookingActionId: string | null;

  getBookingPaymentStatus: (booking: any) => string;
  getBookingStudentName: (booking: any) => string;
  getBookingPaymentPillClassName: (status: string) => string;
  getBookingStatusPillClassName: (status: string) => string;
  isValidMeetingLink: (link: string | undefined) => boolean;
  canStudentManageBeforeStart: (booking: any) => boolean;

  handleHideBookingForCurrentUser: (booking: any) => void;
  handleTutorMeetingLinkUpdate: (booking: any) => void;
  handleTutorBookingStatusChange: (booking: any, newStatus: string) => void;
  handleTutorRescheduleBooking: (booking: any) => void;
}

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export const TutorSessionsPage: React.FC<TutorSessionsPageProps> = ({
  filteredTutorBookings,
  tutorBookingStatusFilter,
  setTutorBookingStatusFilter,
  tutorSessionTimelineFilter,
  setTutorSessionTimelineFilter,
  activeBookingActionId,
  getBookingPaymentStatus,
  getBookingStudentName,
  getBookingPaymentPillClassName,
  getBookingStatusPillClassName,
  isValidMeetingLink,
  canStudentManageBeforeStart,
  handleHideBookingForCurrentUser,
  handleTutorMeetingLinkUpdate,
  handleTutorBookingStatusChange,
  handleTutorRescheduleBooking
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
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Session Management</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base mt-1">Manage links, scheduling, and statuses for your students.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
           <select
             value={tutorBookingStatusFilter}
             onChange={(e) => setTutorBookingStatusFilter(e.target.value)}
             className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm"
           >
             <option value="all">All Statuses</option>
             <option value="pending">Pending</option>
             <option value="confirmed">Confirmed</option>
             <option value="completed">Completed</option>
             <option value="cancelled">Cancelled</option>
           </select>
           <select
             value={tutorSessionTimelineFilter}
             onChange={(e) => setTutorSessionTimelineFilter(e.target.value)}
             className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 shadow-sm"
           >
             <option value="all">Any Time</option>
             <option value="upcoming">Upcoming</option>
             <option value="past">Past</option>
           </select>
        </div>
      </motion.div>

      {filteredTutorBookings.length === 0 ? (
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="text-center py-24 bg-white rounded-2xl border border-dashed border-slate-200">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-600 mb-2">No Sessions Found</p>
          <p className="text-sm font-medium text-slate-500">There are no bookings matching your current filters.</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                         <User className="w-4 h-4 text-slate-400" /> Student
                       </span>
                       <span className="font-bold text-indigo-600 line-clamp-1 max-w-[120px] text-right">{getBookingStudentName(booking)}</span>
                     </div>
                  </div>

                  {paymentStatus === 'failed' && (
                    <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                      <p className="text-xs font-semibold text-rose-700 leading-snug">
                         {booking.paymentFailureReason || 'Payment failed for this booking. Ask student to retry.'}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-2 mt-4">
                     <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                       Link Status
                       <span className={`font-bold ${isValidMeetingLink(booking.meetingLink) ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {isValidMeetingLink(booking.meetingLink) ? 'Ready' : 'Needs Setup'}
                       </span>
                     </div>
                     <p className="text-[10px] font-bold text-slate-300">ID: {booking.id}</p>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-100 flex flex-col gap-2 mt-auto">
                  <div className="flex gap-2">
                    {canStartMeeting ? (
                      <a
                        href={booking.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex flex-1 justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Video className="w-4 h-4" /> Start
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex flex-1 justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-slate-100 text-slate-400 cursor-not-allowed"
                      >
                        <Video className="w-4 h-4" /> Start
                      </button>
                    )}

                    <button
                       type="button"
                       disabled={isLoading || !canSubmitMeetingLink}
                       onClick={() => handleTutorMeetingLinkUpdate(booking)}
                       className="inline-flex flex-1 justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                    >
                       <LinkIcon className="w-4 h-4" /> Setup
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {canComplete && (
                       <button
                         type="button"
                         disabled={isLoading}
                         onClick={() => handleTutorBookingStatusChange(booking, 'completed')}
                         className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                       >
                         <CheckCircle className="w-3.5 h-3.5" /> Done
                       </button>
                    )}
                    {canReschedule && (
                       <button
                         type="button"
                         disabled={isLoading}
                         onClick={() => handleTutorRescheduleBooking(booking)}
                         className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors shadow-sm"
                       >
                         <Calendar className="w-3.5 h-3.5" /> Resched
                       </button>
                    )}
                    {canCancel && (
                       <button
                         type="button"
                         disabled={isLoading}
                         onClick={() => handleTutorBookingStatusChange(booking, 'cancelled')}
                         className="inline-flex flex-1 justify-center items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50 transition-colors shadow-sm"
                       >
                         <X className="w-3.5 h-3.5" /> Cancel
                       </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
