/**
 * TutorDashboardPage – Modern SaaS-style Tutor Dashboard
 * Pure UI component. No backend logic changes.
 */
import React from 'react';
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
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const },
  }),
};

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

  /* ─── Stat derivations ─── */
  const totalSessions = tutorDashboardBookings.length;
  const upcomingSessions = tutorDashboardBookings.filter(
    (b) => b.status !== 'cancelled' && !isPastSession(b)
  ).length;
  const pendingActions = tutorDashboardBookings.filter((b) => b.status === 'pending').length;
  const activeCourses = myTutorCourses.length;
  const resourcesCount = myTutorResources.length;
  const avgRating = tutorAverageRatingFromReviews.toFixed(1);

  /* ─── Navigation Action Cards ─── */
  const navItems = [
    { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setActiveTab('settings'), desc: 'Preferences' },
    ...(profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University'
      ? [{ key: 'availability', label: 'Availability', icon: Calendar, onClick: () => setActiveTab('manageAvailability'), desc: 'Set schedule' }]
      : []),
    { key: 'courses', label: 'Courses', icon: BookOpen, badge: activeCourses, onClick: () => setActiveTab('courses'), desc: 'Tutor content' },
    { key: 'resources', label: 'Resources', icon: Layers, badge: resourcesCount, onClick: () => setActiveTab('resources'), desc: 'Study materials' },
    { key: 'revenue', label: 'Revenue', icon: CircleDollarSign, onClick: () => setActiveTab('earnings'), desc: 'Payouts & history' },
  ];

  /* ─── Summary cards config ─── */
  const summaryCards = [
    { label: 'Total Sessions', value: totalSessions, color: 'text-indigo-700', iconBg: 'bg-indigo-50/80', accent: 'border-t-indigo-400', icon: Calendar },
    { label: 'Upcoming', value: upcomingSessions, color: 'text-emerald-700', iconBg: 'bg-emerald-50/80', accent: 'border-t-emerald-400', icon: TrendingUp },
    { label: 'Pending', value: pendingActions, color: 'text-amber-600', iconBg: 'bg-amber-50/80', accent: 'border-t-amber-400', icon: Clock },
    { label: 'Courses', value: activeCourses, color: 'text-cyan-700', iconBg: 'bg-cyan-50/80', accent: 'border-t-cyan-400', icon: BookOpen },
    { label: 'Resources', value: resourcesCount, color: 'text-purple-700', iconBg: 'bg-purple-50/80', accent: 'border-t-purple-400', icon: FileText },
    { label: 'Avg Rating', value: avgRating, color: 'text-blue-700', iconBg: 'bg-blue-50/80', accent: 'border-t-blue-400', icon: Star },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">

      {/* ──── Header Banner ──── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative bg-white rounded-2xl border border-slate-200/70 shadow-sm p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 overflow-hidden"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 w-56 h-56 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 opacity-40 blur-3xl" />

        <div className="relative z-10 flex items-center gap-4">
           <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
             {(currentUser.firstName || 'T').charAt(0)}
           </div>
           <div>
             <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
               Tutor Workspace
             </h1>
             <p className="text-slate-500 mt-0.5 text-sm md:text-base font-medium max-w-xl">
               Manage sessions, earnings, and course content from your dashboard.
             </p>
           </div>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-3">
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
               className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200/70 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all active:scale-[0.98] shadow-sm"
             >
               <Copy className="w-4 h-4 text-slate-400" /> Copy Session Link
             </button>
             <button
               onClick={() => setActiveTab('earnings')}
               className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm tracking-wide hover:bg-indigo-700 transition-all shadow-sm active:scale-[0.98]"
             >
               <BarChart3 className="w-4 h-4" /> Revenue Details
             </button>
           </div>
      </motion.div>

      {/* ──── Navigation Cards (Top Section) ──── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
         {navItems.map((item, idx) => {
           const Icon = item.icon;
           return (
             <motion.button
               custom={idx}
               variants={fadeUp}
               initial="hidden"
               animate="show"
               key={item.key}
               onClick={item.onClick}
               className="flex items-center gap-3 text-left p-3.5 rounded-xl bg-white border border-slate-200/70 hover:border-indigo-200 hover:bg-slate-50 transition-all group relative overflow-hidden shadow-sm"
             >
               {item.badge !== undefined && item.badge > 0 && (
                 <span className="absolute top-2.5 right-2.5 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm">
                   {item.badge}
                 </span>
               )}
               <div className="w-10 h-10 shrink-0 rounded-lg bg-indigo-50/50 border border-indigo-100/30 flex items-center justify-center group-hover:bg-indigo-100/50 transition-colors">
                 <Icon className="w-5 h-5 text-indigo-600 transition-colors" />
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{item.label}</span>
                 <span className="text-[11px] text-slate-500 font-medium hidden sm:block truncate pr-3">{item.desc}</span>
               </div>
             </motion.button>
           );
         })}
      </div>

      {/* ──── Summary Cards ──── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {summaryCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="show"
              className={`relative overflow-hidden rounded-xl border border-slate-200/70 ${card.accent} border-t-4 p-4 md:p-5 transition-all hover:shadow-md hover:-translate-y-0.5 group bg-white flex items-center gap-4`}
            >
              <div className={`w-10 h-10 rounded-xl shrink-0 ${card.iconBg} flex items-center justify-center group-hover:scale-105 transition-transform`}>
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
        {/* ──── Main Section: Session Management ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="md:col-span-2 xl:col-span-2 rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden flex flex-col justify-center items-center text-center p-8 h-full min-h-[300px]"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center mb-5 shadow-inner">
             <Calendar className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Session Management</h2>
          <p className="text-base text-slate-500 font-medium max-w-sm mx-auto mb-8">
            View all your past and upcoming bookings, configure meeting links, and manage student schedules.
          </p>
          <button
            onClick={() => setActiveTab('tutorSessions')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold tracking-wide hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98]"
          >
            Manage Sessions
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </motion.div>

        {/* ──── Performance Panel ──── */}
        <motion.div
           initial={{ opacity: 0, y: 12 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3, duration: 0.4 }}
           className="md:col-span-1 xl:col-span-1 bg-white rounded-xl border border-slate-200/70 overflow-hidden flex flex-col h-max shadow-sm"
        >
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100/50 flex items-center justify-center">
                   <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Performance</h2>
             </div>
             <button
               onClick={() => setActiveTab('earnings')}
               className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
             >
               View Stats
             </button>
          </div>
          
          <div className="p-5 bg-slate-50/30">
            <div className="grid grid-cols-2 gap-4 mb-6">
               {[
                 { label: 'Total Sessions', value: totalSessions, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50/80' },
                 { label: 'Completed', value: tutorCompletedPaidBookings.length, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50/80' },
                 { label: 'Avg Rating', value: tutorAverageRatingFromReviews.toFixed(1), icon: Star, color: 'text-amber-500', bg: 'bg-amber-50/80' },
                 { label: 'Feedback', value: tutorPerformanceFeedback.length, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50/80' },
               ].map((stat) => (
                 <div key={stat.label} className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm flex flex-col items-center text-center justify-center hover:border-indigo-100 hover:shadow-md transition-all">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-2.5`}>
                       <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <span className="text-2xl font-black text-slate-900 leading-none mb-1">{stat.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
                 </div>
               ))}
            </div>

            <div className="space-y-3">
               <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Recent Feedback</h4>
               {tutorPerformanceFeedback.length === 0 ? (
                 <p className="text-sm font-medium text-slate-500 bg-white border border-slate-200/70 rounded-lg px-4 py-3">
                   No feedback received yet.
                 </p>
               ) : (
                 <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                   {tutorPerformanceFeedback.map((review: any) => (
                     <div key={review.id} className="bg-white rounded-lg border border-slate-100 p-4 shadow-sm hover:border-slate-200 transition-colors">
                        <div className="flex justify-between items-center mb-1.5">
                           <span className="text-xs font-bold text-slate-900">{review.studentName}</span>
                           <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                             <Star className="w-3.5 h-3.5 fill-amber-400" /> {review.rating.toFixed(1)}
                           </span>
                        </div>
                        <p className="text-xs text-slate-500 italic">"{review.comment}"</p>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
