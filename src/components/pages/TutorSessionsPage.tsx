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
  Star,
  Upload,
  Trash2,
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
  isSessionJoinEnabled: (booking: any) => boolean;
  activeResourceUploadBookingId: string | null;
  activeResourceDeleteKey: string | null;
  activeResourceDownloadKey: string | null;

  handleHideBookingForCurrentUser: (booking: any) => void;
  handleTutorMeetingLinkUpdate: (booking: any) => void;
  handleTutorBookingStatusChange: (booking: any, newStatus: string) => void;
  handleTutorRescheduleBooking: (booking: any) => void;
  handleTutorUploadSessionResource: (booking: any, file: File) => void | Promise<void>;
  handleTutorRemoveSessionResource: (booking: any, resource: any) => void | Promise<void>;
  handleDownloadSessionResource: (booking: any, resource: any) => void | Promise<void>;
}

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const getMeetingLinkMeta = (
  booking: any,
  paymentStatus: string,
  hasValidMeetingLink: boolean,
  isSessionJoinEnabled: boolean
) => {
  if (booking.status === 'cancelled') {
    return {
      label: 'Cancelled',
      badgeClassName: 'bg-rose-50 text-rose-700 border-rose-100',
      valueClassName: 'text-rose-700',
    };
  }

  if (booking.status === 'completed') {
    return {
      label: 'Session Closed',
      badgeClassName: 'bg-slate-100 text-slate-600 border-slate-200',
      valueClassName: 'text-slate-600',
    };
  }

  if (paymentStatus !== 'paid') {
    return {
      label: 'Awaiting Payment',
      badgeClassName: 'bg-slate-100 text-slate-600 border-slate-200',
      valueClassName: 'text-slate-600',
    };
  }

  if (hasValidMeetingLink) {
    if (!isSessionJoinEnabled) {
      return {
        label: 'Session Ended',
        badgeClassName: 'bg-slate-100 text-slate-600 border-slate-200',
        valueClassName: 'text-slate-600',
      };
    }

    return {
      label: 'Ready',
      badgeClassName: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      valueClassName: 'text-emerald-700',
    };
  }

  return {
    label: 'Needs Setup',
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

const resolveSessionResourceRef = (resource: any): string => {
  return String(resource?.id || resource?.blobName || resource?.url || '').trim();
};

const buildSessionResourceDownloadHref = (booking: any, resource: any): string => {
  const bookingId = String(booking?.id || '').trim();
  const resourceRef = resolveSessionResourceRef(resource);
  if (!bookingId || !resourceRef) {
    return String(resource?.url || '#').trim() || '#';
  }

  return `/api/bookings/${encodeURIComponent(bookingId)}/resources/${encodeURIComponent(resourceRef)}/download`;
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
  isSessionJoinEnabled,
  activeResourceUploadBookingId,
  activeResourceDeleteKey,
  activeResourceDownloadKey,
  handleHideBookingForCurrentUser,
  handleTutorMeetingLinkUpdate,
  handleTutorBookingStatusChange,
  handleTutorRescheduleBooking,
  handleTutorUploadSessionResource,
  handleTutorRemoveSessionResource,
  handleDownloadSessionResource,
}) => {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
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
        <div className="flex flex-col gap-5">
          {filteredTutorBookings.map((booking, idx) => {
            const isLoading = activeBookingActionId === booking.id;
            const paymentStatus = getBookingPaymentStatus(booking);
            const paymentStatusLabel = formatStatusLabel(paymentStatus);
            const paymentBadgeClassName = getPaymentBadgeClassName(paymentStatus, getBookingPaymentPillClassName(paymentStatus));
            const isPaidBooking = paymentStatus === 'paid';
            const canComplete = booking.status === 'confirmed' && isPaidBooking;
            const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed';
            const hasPendingRescheduleRequest = String(booking?.rescheduleRequest?.status || '').trim().toLowerCase() === 'pending';
            const canReschedule = booking.status !== 'cancelled' && booking.status !== 'completed' && !hasPendingRescheduleRequest && isPaidBooking && canStudentManageBeforeStart(booking);
            const canSubmitMeetingLink = isPaidBooking && booking.status !== 'cancelled' && booking.status !== 'completed';
            const hasValidMeetingLink = isValidMeetingLink(booking.meetingLink);
            const canStartMeeting = booking.status === 'confirmed' && isPaidBooking && hasValidMeetingLink && isSessionJoinEnabled(booking);
            const meetingLinkMeta = getMeetingLinkMeta(booking, paymentStatus, hasValidMeetingLink, isSessionJoinEnabled(booking));
            const sessionTitle = `${booking.subject || 'Tutoring'} Session`;
            const sessionResources = Array.isArray(booking.sessionResources) ? booking.sessionResources : [];
            const isUploadingResource = activeResourceUploadBookingId === booking.id;
            const canUploadResource = booking.status !== 'cancelled';
            const resourceInputId = `session-resource-${booking.id}`;

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

                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)] lg:items-stretch">
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
                      {hasPendingRescheduleRequest && (
                        <span className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
                          Reschedule Pending
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{sessionTitle}</h3>
                    <p className="mt-1 text-sm font-medium text-slate-500">Student: <span className="text-slate-700 font-semibold">{getBookingStudentName(booking)}</span></p>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      <InfoTile icon={Calendar} label="Date" value={booking.date || 'Not set'} />
                      <InfoTile icon={Clock} label="Time Slot" value={booking.timeSlot || 'Any Time'} />
                      <InfoTile icon={User} label="Student" value={getBookingStudentName(booking)} valueClassName="text-indigo-700" />
                      <InfoTile
                        icon={Star}
                        label="Payment"
                        value={paymentStatusLabel}
                        valueClassName={paymentStatus === 'paid' ? 'text-amber-700' : 'text-slate-800'}
                      />
                      <InfoTile icon={Calendar} label="Session Status" value={booking.status} />
                      <InfoTile icon={LinkIcon} label="Meeting Link" value={meetingLinkMeta.label} valueClassName={meetingLinkMeta.valueClassName} />
                    </div>

                    {paymentStatus === 'failed' && (
                      <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                        {booking.paymentFailureReason || 'Payment failed for this booking. Ask student to retry payment before session confirmation.'}
                      </div>
                    )}

                    {!canStudentManageBeforeStart(booking) && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                      <div className="mt-4">
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 inline-block">
                          Session is active or already started
                        </span>
                      </div>
                    )}

                    {hasPendingRescheduleRequest && booking.rescheduleRequest && (
                      <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm">
                        <p className="text-xs font-black uppercase tracking-wider text-indigo-600">Awaiting Student Approval</p>
                        <p className="mt-1 font-semibold text-indigo-900">
                          Requested: {booking.rescheduleRequest.requestedDate} at {booking.rescheduleRequest.requestedTimeSlot}
                        </p>
                        {booking.rescheduleRequest.note && (
                          <p className="mt-1 text-xs font-medium text-indigo-700">Note: {booking.rescheduleRequest.note}</p>
                        )}
                      </div>
                    )}

                    {sessionResources.length > 0 && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Shared Resources</p>
                        <div className="space-y-2">
                          {sessionResources.map((resource: any) => {
                            const resourceRef = resolveSessionResourceRef(resource);
                            const actionKey = `${booking.id}:${resourceRef}`;
                            const isRemovingResource = activeResourceDeleteKey === actionKey;
                            const isDownloadingResource = activeResourceDownloadKey === actionKey;

                            return (
                              <div
                                key={resource.id || `${booking.id}-${resource.url}`}
                                className="flex items-center justify-between gap-3 rounded-lg bg-white border border-slate-200 px-3 py-2"
                              >
                                <p className="text-xs font-semibold text-slate-700 truncate">{resource.name || 'Session Resource'}</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!resourceRef || isDownloadingResource || isRemovingResource}
                                    onClick={() => {
                                      void Promise.resolve(handleDownloadSessionResource(booking, resource));
                                    }}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:text-slate-400"
                                    title={buildSessionResourceDownloadHref(booking, resource)}
                                  >
                                    {isDownloadingResource ? 'Downloading...' : 'Download'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!resourceRef || isRemovingResource || isDownloadingResource}
                                    onClick={() => {
                                      void Promise.resolve(handleTutorRemoveSessionResource(booking, resource));
                                    }}
                                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 disabled:text-slate-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {isRemovingResource ? 'Removing...' : 'Remove'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400 tracking-wider">
                      <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 uppercase">Booking ID: {booking.id}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 md:p-5 flex flex-col gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Tutor Actions</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {canStartMeeting ? (
                        <a
                          href={booking.meetingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <Video className="w-4 h-4" /> Start Meeting
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-slate-200 text-slate-500 cursor-not-allowed"
                        >
                          <Video className="w-4 h-4" /> {hasValidMeetingLink && !isSessionJoinEnabled(booking) ? 'Session Ended' : 'Start Meeting'}
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isLoading || !canSubmitMeetingLink}
                        onClick={() => handleTutorMeetingLinkUpdate(booking)}
                        className="inline-flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <LinkIcon className="w-4 h-4" /> {hasValidMeetingLink ? 'Update Link' : 'Add Link'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {canComplete ? (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleTutorBookingStatusChange(booking, 'completed')}
                          className="inline-flex justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Complete
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Complete
                        </button>
                      )}

                      {canReschedule ? (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleTutorRescheduleBooking(booking)}
                          className="inline-flex justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition-colors shadow-sm"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Reschedule
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                        >
                          <Calendar className="w-3.5 h-3.5" /> Reschedule
                        </button>
                      )}

                      {canCancel ? (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleTutorBookingStatusChange(booking, 'cancelled')}
                          className="inline-flex justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 disabled:opacity-50 transition-colors shadow-sm"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed"
                        >
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                      )}
                    </div>

                    <input
                      id={resourceInputId}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt,.csv,.ppt,.pptx,.xls,.xlsx,.zip,.rar"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void Promise.resolve(handleTutorUploadSessionResource(booking, file));
                        }
                        event.currentTarget.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={isLoading || isUploadingResource || !canUploadResource}
                      onClick={() => {
                        const input = document.getElementById(resourceInputId) as HTMLInputElement | null;
                        input?.click();
                      }}
                      className="inline-flex w-full justify-center items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5" /> {isUploadingResource ? 'Uploading Resource...' : 'Upload Resource'}
                    </button>

                    {canComplete && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700">
                        Mark as completed once the session is fully delivered.
                      </div>
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
