import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  X,
  User,
  Video,
  Star,
  MessageSquare,
  Link as LinkIcon,
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
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } }
};

const ratingCopy: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

const getMeetingLinkMeta = (booking: any, paymentStatus: string, hasValidMeetingLink: boolean) => {
  if (booking.status === 'cancelled') {
    return {
      label: 'Cancelled',
      badgeClassName: 'bg-rose-50 text-rose-700 border-rose-100',
      valueClassName: 'text-rose-700',
    };
  }

  if (hasValidMeetingLink) {
    return {
      label: 'Ready',
      badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      valueClassName: 'text-emerald-700',
    };
  }

  if (paymentStatus !== 'paid') {
    return {
      label: 'Awaiting Payment',
      badgeClassName: 'bg-slate-100 text-slate-600 border-slate-200',
      valueClassName: 'text-slate-600',
    };
  }

  if (booking.status === 'completed') {
    return {
      label: 'Closed',
      badgeClassName: 'bg-slate-100 text-slate-600 border-slate-200',
      valueClassName: 'text-slate-600',
    };
  }

  return {
    label: 'Pending Tutor Link',
    badgeClassName: 'bg-amber-50 text-amber-700 border-amber-100',
    valueClassName: 'text-amber-700',
  };
};

const formatStatusLabel = (status: string) =>
  status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getPaymentBadgeClassName = (paymentStatus: string, fallbackClassName: string) => {
  if (paymentStatus === 'paid') {
    return 'bg-gradient-to-r from-amber-50 to-yellow-100 text-amber-800 border-amber-200';
  }

  return fallbackClassName;
};

type InfoTileProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  valueClassName?: string;
};

const InfoTile: React.FC<InfoTileProps> = ({ icon: Icon, label, value, valueClassName = 'text-slate-800' }) => (
  <div className="rounded-xl border border-slate-200/80 bg-white px-3.5 py-3">
    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <div className="mt-1.5 flex items-center gap-2">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <p className={`text-sm font-semibold truncate ${valueClassName}`}>{value}</p>
    </div>
  </div>
);

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
  const [reviewModalBooking, setReviewModalBooking] = useState<any>(null);

  const handleCloseModal = () => {
    setReviewModalBooking(null);
  };

  const submitReview = async () => {
    if (reviewModalBooking) {
      await handleSubmitSessionRating(reviewModalBooking);
      handleCloseModal();
    }
  };

  const activeReviewDraft = reviewModalBooking
    ? (sessionRatingDrafts[reviewModalBooking.id] || { rating: 0, feedback: '' })
    : { rating: 0, feedback: '' };

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
        <div className="flex flex-col gap-5">
          {filteredStudentBookings.map((booking, idx) => {
            const isLoading = activeBookingActionId === booking.id;
            const paymentStatus = getBookingPaymentStatus(booking);
            const paymentStatusLabel = formatStatusLabel(paymentStatus);
            const paymentBadgeClassName = getPaymentBadgeClassName(paymentStatus, getBookingPaymentPillClassName(paymentStatus));
            const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed' && canStudentManageBeforeStart(booking);
            const hasValidMeetingLink = isValidMeetingLink(booking.meetingLink);
            const canJoinMeeting = hasValidMeetingLink && booking.status === 'confirmed';
            const existingReview = studentReviewsBySessionId.get(booking.id);
            const meetingLinkMeta = getMeetingLinkMeta(booking, paymentStatus, hasValidMeetingLink);
            const sessionTitle = `${booking.subject || 'Tutoring'} Session`;

            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.3 }}
                className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 md:p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div className="absolute right-4 top-4">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleHideBookingForCurrentUser(booking)}
                    className="h-8 w-8 rounded-full border border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 disabled:opacity-60 flex items-center justify-center transition-colors hover:text-slate-600"
                    title="Hide session"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(270px,1fr)] lg:items-stretch">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2 pr-12">
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${paymentBadgeClassName}`}>
                       {paymentStatusLabel}
                      </span>
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                       {booking.status}
                      </span>
                      <span className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border ${meetingLinkMeta.badgeClassName}`}>
                        Link: {meetingLinkMeta.label}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{sessionTitle}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">Tutor: <span className="text-slate-700 font-semibold">{getBookingTutorName(booking)}</span></p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      <InfoTile icon={Calendar} label="Date" value={booking.date || 'Not set'} />
                      <InfoTile icon={Clock} label="Time Slot" value={booking.timeSlot || 'Any Time'} />
                      <InfoTile icon={User} label="Tutor" value={getBookingTutorName(booking)} valueClassName="text-emerald-700" />
                      <InfoTile
                        icon={Star}
                        label="Payment"
                        value={paymentStatusLabel}
                        valueClassName={paymentStatus === 'paid' ? 'text-amber-700' : 'text-slate-800'}
                      />
                      <InfoTile icon={Calendar} label="Session Status" value={booking.status} />
                      <InfoTile icon={LinkIcon} label="Meeting Link" value={meetingLinkMeta.label} valueClassName={meetingLinkMeta.valueClassName} />
                    </div>

                    {!hasValidMeetingLink && paymentStatus === 'paid' && booking.status === 'confirmed' && (
                      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
                        Waiting for tutor to provide the meeting link.
                      </div>
                    )}

                    {!canStudentManageBeforeStart(booking) && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                      <div className="mt-4">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 inline-block">
                          Session is active or already started
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 md:p-5 flex flex-col gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Actions</p>

                    {canJoinMeeting ? (
                      <a
                        href={booking.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Video className="w-4 h-4" /> Join Meeting
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex w-full justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-slate-200 text-slate-500 cursor-not-allowed"
                      >
                        <Video className="w-4 h-4" /> Join Meeting
                      </button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleStudentCancelBooking(booking)}
                        className="inline-flex w-full justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors shadow-sm"
                      >
                        <X className="w-4 h-4" /> Cancel Session
                      </button>
                    )}

                    {booking.status === 'completed' && (
                      <div className="w-full">
                        {existingReview ? (
                          <div className="bg-white border border-slate-200 p-3 rounded-xl flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black tracking-wider uppercase text-slate-400">Your Review</span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((val) => (
                                  <Star key={val} className={`w-3.5 h-3.5 ${val <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                                ))}
                              </div>
                            </div>
                            {existingReview.comment && <p className="text-xs font-medium text-slate-600 italic line-clamp-2">"{existingReview.comment}"</p>}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReviewModalBooking(booking)}
                            className="w-full inline-flex justify-center items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100"
                          >
                            <Star className="w-4 h-4" /> Give Review
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {reviewModalBooking && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden relative"
            >
              <div className="p-6">
                <button
                  onClick={handleCloseModal}
                  className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="mb-6 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                    <Star className="w-5 h-5 fill-amber-100" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Review This Session</h2>
                    <p className="text-sm font-medium text-slate-500 truncate max-w-[260px]">
                      {reviewModalBooking.subject} with {getBookingTutorName(reviewModalBooking)}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 text-center">How was your session?</label>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSessionRatingDrafts((drafts) => ({
                            ...drafts,
                            [reviewModalBooking.id]: {
                              rating: val,
                              feedback: drafts[reviewModalBooking.id]?.feedback || '',
                            },
                          }))}
                          className="group p-1"
                        >
                          <Star className={`w-8 h-8 transition-all ${val <= activeReviewDraft.rating ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-sm' : 'text-slate-200 group-hover:text-amber-200'}`} />
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-center text-xs font-semibold text-slate-500">
                      {ratingCopy[activeReviewDraft.rating] || 'Select a rating'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Written Feedback (optional)</label>
                    <div className="relative">
                      <MessageSquare className="absolute top-3 left-3 w-5 h-5 text-slate-400" />
                      <textarea
                        value={activeReviewDraft.feedback}
                        onChange={(e) => setSessionRatingDrafts((drafts) => ({
                          ...drafts,
                          [reviewModalBooking.id]: {
                            rating: drafts[reviewModalBooking.id]?.rating || 0,
                            feedback: e.target.value,
                          },
                        }))}
                        placeholder="Share what went well and what could be improved."
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-3 text-sm text-slate-700 bg-slate-50 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50/80 p-5 flex items-center justify-end gap-3 border-t border-slate-100">
                 <button
                   type="button"
                   onClick={handleCloseModal}
                   className="px-4 py-2.5 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                 >
                    Cancel
                 </button>
                 <button
                   type="button"
                   disabled={activeRatingActionBookingId === reviewModalBooking.id || activeReviewDraft.rating < 1}
                   onClick={submitReview}
                   className="px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
                 >
                    {activeRatingActionBookingId === reviewModalBooking.id ? 'Submitting...' : 'Submit Review'}
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

