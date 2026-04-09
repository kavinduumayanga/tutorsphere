import React from 'react';
import { motion } from 'motion/react';
import {
  BookOpen,
  Calendar,
  ArrowRight,
  Video,
  Library,
  BookMarked,
  TrendingUp,
  Settings,
  Search,
} from 'lucide-react';

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
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' as const },
  }),
};

export const StudentDashboardPage: React.FC<StudentDashboardPageProps> = (props) => {
  const {
    currentUser,
    studentDashboardBookings,
    studentEnrolledCourses,
    handleOpenCourseLearning,
    handleShowCertificateModal,
    setActiveTab,
    isValidMeetingLink,
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

  const featuredCourseCount = 2;
  const displayCourses = studentEnrolledCourses.slice(0, featuredCourseCount);
  const hasMoreCourses = studentEnrolledCourses.length > featuredCourseCount;

  /* ─── Navigation Action Cards ─── */
  const navItems = [
    { key: 'tutors', label: 'Find Tutors', icon: Search, onClick: () => setActiveTab('tutors'), desc: 'Discover and book tutors' },
    { key: 'sessions', label: 'My Sessions', icon: Calendar, badge: totalSessions, onClick: () => setActiveTab('studentSessions'), desc: 'Track bookings and meetings' },
    { key: 'courses', label: 'Learning', icon: BookOpen, badge: studentEnrolledCourses.length, onClick: () => setActiveTab('courses'), desc: 'Continue enrolled courses' },
    { key: 'resources', label: 'Resources', icon: Library, onClick: () => setActiveTab('resources'), desc: 'Open study resources' },
    { key: 'settings', label: 'Settings', icon: Settings, onClick: () => setActiveTab('settings'), desc: 'Profile and preferences' },
  ];

  /* ─── Summary Cards Config ─── */
  const summaryCards = [
    { label: 'Booked Sessions', value: totalSessions, color: 'text-indigo-700', iconBg: 'bg-indigo-50/80', accent: 'border-t-indigo-400', icon: Calendar },
    { label: 'Ready to Join', value: readyToJoin, color: 'text-emerald-700', iconBg: 'bg-emerald-50/80', accent: 'border-t-emerald-400', icon: Video },
    { label: 'Enrolled Courses', value: enrolledCount, color: 'text-cyan-700', iconBg: 'bg-cyan-50/80', accent: 'border-t-cyan-400', icon: BookOpen },
    { label: 'Avg Progress', value: `${avgProgress}%`, color: 'text-sky-700', iconBg: 'bg-sky-50/80', accent: 'border-t-sky-400', icon: TrendingUp },
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
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-indigo-500">Workspace Overview</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Student Workspace</h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Manage sessions, track learning progress, and quickly jump to your key study areas.</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">Sessions</span>
              <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">Learning</span>
              <span className="px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">Resources</span>
            </div>
          </div>
        </div>

      </motion.div>

      {/* ──── Navigation Cards (Top Section) ──── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
               className="flex flex-col items-start text-left gap-4 p-5 md:p-6 min-h-[138px] rounded-2xl bg-white border border-slate-200/80 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md transition-all group relative overflow-hidden shadow-sm"
             >
               {item.badge !== undefined && item.badge > 0 && (
                 <span className="absolute top-3 right-3 bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm z-10">
                   {item.badge}
                 </span>
               )}
               <div className="w-12 h-12 shrink-0 rounded-xl bg-indigo-50/80 border border-indigo-100/50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors relative z-10">
                 <Icon className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform duration-300" />
               </div>
               <div className="flex flex-col flex-1 relative z-10 w-full">
                 <span className="text-base font-extrabold text-slate-800 group-hover:text-indigo-700 transition-colors">{item.label}</span>
                 <span className="text-xs md:text-sm text-slate-500 font-medium mt-1 line-clamp-2">{item.desc}</span>
               </div>
               <div className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 relative z-10">
                 Open
                 <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
               </div>
               <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300" />
             </motion.button>
           );
         })}
      </div>

      {/* ──── Summary Cards Grid ──── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
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
        
        {/* ──── Main Section: Sessions ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="md:col-span-2 xl:col-span-2 rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden flex flex-col justify-center items-center text-center p-8 h-full min-h-[300px]"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center mb-5 shadow-inner">
             <Calendar className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">My Sessions</h2>
          <p className="text-base text-slate-500 font-medium max-w-sm mx-auto mb-8">
            Access your upcoming scheduled sessions, launch meetings, and leave feedback for past ones.
          </p>
          <button
            onClick={() => setActiveTab('studentSessions')}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold tracking-wide hover:bg-indigo-700 hover:shadow-md transition-all active:scale-[0.98]"
          >
            Manage My Sessions
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </motion.div>

        {/* ──── Secondary Section: Course Progress ──── */}
        <motion.div
           initial={{ opacity: 0, y: 12 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.3, duration: 0.4 }}
           className="md:col-span-1 xl:col-span-1 bg-white rounded-xl border border-slate-200/70 overflow-hidden flex flex-col h-max shadow-sm"
        >
          <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-cyan-100/50 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-cyan-600" />
             </div>
             <h2 className="text-xl font-bold text-slate-900">Learning Progress</h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('courses')}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 rounded-lg bg-indigo-50 px-2.5 py-1.5"
            >
              See all
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="p-5 bg-slate-50/30">
            {displayCourses.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-200">
                <BookMarked className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">No active courses.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('courses')}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 text-indigo-600 hover:bg-indigo-50"
                >
                  Browse Courses
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
               <div className="space-y-4">
                {displayCourses.map(({ course, enrollment }) => {
                  const isCompleted = enrollment.progress >= 100;

                  return (
                    <div key={course.id} className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm group hover:shadow-md hover:border-indigo-100 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{course.title}</h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{course.subject}</p>
                        </div>
                        <span className={`text-lg font-black shrink-0 ${isCompleted ? 'text-emerald-600' : 'text-indigo-600'}`}>
                          {enrollment.progress}%
                        </span>
                      </div>

                      <div className="mt-3 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>

                      <div className="mt-3 flex gap-2">
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
                  );
                })}

                {hasMoreCourses && <p className="text-[11px] font-semibold text-slate-500">Showing {featuredCourseCount} of {studentEnrolledCourses.length} enrolled courses.</p>}

                <button
                  type="button"
                  onClick={() => setActiveTab('courses')}
                  className="w-full py-3 rounded-xl border border-slate-200 bg-white text-sm font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm flex items-center justify-center gap-2 group"
                >
                  See all courses
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
