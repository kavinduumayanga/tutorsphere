import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Atom, Binary, Brain, Calculator, Calendar, CheckCircle, Search, Star } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { Booking, Tutor, User as AppUser } from '../../types';

type SubjectMotionTheme = 'math' | 'coding' | 'chemistry' | 'science';

interface TutorsPageProps {
  currentUser: AppUser | null;
  isStudent: boolean;
  tutors: Tutor[];
  isLoadingTutors: boolean;
  onRequireAuth: () => void;
  onBookingCreated: (booking: Booking) => void;
}

const getTutorDisplayName = (tutor: Tutor & { name?: string }) => {
  const firstName = tutor.firstName?.trim();
  const lastName = tutor.lastName?.trim();

  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }

  return tutor.name?.trim() || 'Tutor';
};

const getSubjectMotionTheme = (subjects: string[]): SubjectMotionTheme => {
  const normalizedSubjects = subjects.map((subject) => subject.toLowerCase());

  if (normalizedSubjects.some((subject) => /ict|computer|software|coding|program/.test(subject))) {
    return 'coding';
  }

  if (normalizedSubjects.some((subject) => /math|physics|calculus|algebra|geometry|statistics/.test(subject))) {
    return 'math';
  }

  if (normalizedSubjects.some((subject) => /chem|biology|bio|molecular|organic/.test(subject))) {
    return 'chemistry';
  }

  return 'science';
};

const getSubjectMotionCopy = (theme: SubjectMotionTheme, subjects: string[]) => {
  const leadSubject = subjects[0] || 'STEM';

  switch (theme) {
    case 'coding':
      return {
        title: 'Code Studio Motion',
        description: `A clean terminal-style loop that frames this ${leadSubject} session like a live build workspace.`,
      };
    case 'math':
      return {
        title: 'Concept Orbit Motion',
        description: `Rotating geometry, wave motion, and measured pulses set the tone for ${leadSubject} problem-solving.`,
      };
    case 'chemistry':
      return {
        title: 'Lab Reaction Motion',
        description: `Molecule links and bubbling motion create a subtle science lab feel for this ${leadSubject} session.`,
      };
    default:
      return {
        title: 'STEM Focus Motion',
        description: `Abstract scientific motion gives this ${leadSubject} booking area a focused, premium study atmosphere.`,
      };
  }
};

function SubjectMotionGraphic({ tutor }: { tutor: Tutor }) {
  const theme = getSubjectMotionTheme(tutor.subjects);
  const copy = getSubjectMotionCopy(theme, tutor.subjects);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-5 shadow-lg shadow-indigo-950/10">
      <motion.div
        className="absolute -top-16 right-0 h-36 w-36 rounded-full bg-cyan-300/20 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.6, 0.35] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-20 left-0 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl"
        animate={{ scale: [1.1, 0.95, 1.1], opacity: [0.3, 0.55, 0.3] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/75">Session Visual</p>
          <h4 className="mt-2 text-lg font-black tracking-tight text-white">{copy.title}</h4>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-indigo-100/75">{copy.description}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md">
          {theme === 'coding' && <Binary className="h-5 w-5 text-cyan-200" />}
          {theme === 'math' && <Calculator className="h-5 w-5 text-cyan-200" />}
          {theme === 'chemistry' && <Atom className="h-5 w-5 text-cyan-200" />}
          {theme === 'science' && <Brain className="h-5 w-5 text-cyan-200" />}
        </div>
      </div>

      <div className="relative z-10 mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 backdrop-blur-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent)]" />

        {theme === 'coding' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/70 px-4 py-3 font-mono">
            <div className="mb-3 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300/80" />
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">live session.tsx</span>
            </div>

            <div className="space-y-2.5">
              {[
                { color: 'bg-cyan-300/85', width: '72%', delay: 0 },
                { color: 'bg-violet-300/85', width: '48%', delay: 0.25 },
                { color: 'bg-emerald-300/85', width: '64%', delay: 0.5 },
                { color: 'bg-amber-200/80', width: '56%', delay: 0.75 },
                { color: 'bg-slate-200/70', width: '68%', delay: 1 },
              ].map((line, index) => (
                <motion.div
                  key={index}
                  className="flex items-center gap-2"
                  initial={{ opacity: 0.35, x: -10 }}
                  animate={{ opacity: [0.35, 0.95, 0.35], x: [-10, 0, -10] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: line.delay }}
                >
                  <span className="w-6 text-[10px] text-slate-500">{String(index + 1).padStart(2, '0')}</span>
                  <div className={`h-2 rounded-full ${line.color}`} style={{ width: line.width }} />
                </motion.div>
              ))}
            </div>

            <motion.div
              className="absolute bottom-4 right-5 h-4 w-1.5 rounded-full bg-cyan-200"
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-cyan-300/8 to-transparent"
              animate={{ x: ['-30%', '150%'] }}
              transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}

        {theme === 'math' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/65">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:28px_28px] opacity-35" />
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/50"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-[4.5rem] w-[4.5rem] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-violet-200/60"
              animate={{ rotate: -360, scale: [1, 1.08, 1] }}
              transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-200 shadow-[0_0_30px_rgba(103,232,249,0.65)]"
              animate={{ scale: [1, 1.35, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="absolute bottom-5 left-4 right-4 flex items-end gap-1.5">
              {[18, 30, 42, 56, 70, 64, 48, 34, 20].map((height, index) => (
                <motion.div
                  key={index}
                  className="flex-1 rounded-t-full bg-gradient-to-t from-cyan-300/40 to-violet-300/75"
                  style={{ height }}
                  animate={{ height: [height, height + 18, height] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: index * 0.12 }}
                />
              ))}
            </div>
          </div>
        )}

        {theme === 'chemistry' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/65">
            <motion.div
              className="absolute left-[18%] top-[52%] h-5 w-5 rounded-full bg-cyan-200 shadow-[0_0_20px_rgba(103,232,249,0.6)]"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-[46%] top-[34%] h-7 w-7 rounded-full bg-violet-300/90 shadow-[0_0_24px_rgba(196,181,253,0.5)]"
              animate={{ x: [0, 8, 0], y: [0, -4, 0] }}
              transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-[70%] top-[54%] h-4 w-4 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.5)]"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.35 }}
            />

            <div className="absolute left-[20%] top-[56%] h-px w-[28%] origin-left rotate-[-18deg] bg-gradient-to-r from-cyan-200/80 to-violet-200/80" />
            <div className="absolute left-[49%] top-[48%] h-px w-[20%] origin-left rotate-[24deg] bg-gradient-to-r from-violet-200/80 to-emerald-200/80" />

            {[0, 1, 2, 3, 4].map((bubble) => (
              <motion.div
                key={bubble}
                className="absolute bottom-4 rounded-full bg-white/40"
                style={{ left: `${18 + bubble * 12}%`, width: 6 + bubble, height: 6 + bubble }}
                animate={{ y: [0, -80], opacity: [0, 0.85, 0] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'easeOut', delay: bubble * 0.45 }}
              />
            ))}

            <motion.div
              className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-cyan-300/25 via-violet-300/18 to-transparent"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        )}

        {theme === 'science' && (
          <div className="relative h-40 overflow-hidden rounded-[1.25rem] border border-white/8 bg-slate-950/65">
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-200/45"
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-200/40"
              style={{ transform: 'translate(-50%, -50%) rotate(55deg)' }}
              animate={{ rotate: [55, 415] }}
              transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/35"
              style={{ transform: 'translate(-50%, -50%) rotate(-55deg)' }}
              animate={{ rotate: [-55, -415] }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-100 shadow-[0_0_26px_rgba(224,242,254,0.65)]" />
          </div>
        )}
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        {tutor.subjects.slice(0, 3).map((subject) => (
          <span key={subject} className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-50/85 backdrop-blur-md">
            {subject}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TutorsPage({
  currentUser,
  isStudent,
  tutors,
  isLoadingTutors,
  onRequireAuth,
  onBookingCreated,
}: TutorsPageProps) {
  const [hoveredTutorId, setHoveredTutorId] = useState<string | null>(null);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);

  const handleBookSession = async (tutor: Tutor, slotId: string) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }

    if (currentUser.role !== 'student') {
      alert('Only student accounts can book sessions.');
      return;
    }

    try {
      const booking = await apiService.createBooking({
        studentId: currentUser.id,
        tutorId: tutor.id,
        slotId,
        status: 'confirmed',
        subject: tutor.subjects[0],
        date: new Date().toLocaleDateString(),
        meetingLink: 'https://meet.google.com/abc-defg-hij'
      });
      onBookingCreated(booking);
      alert('Session booked successfully!');
    } catch (error) {
      console.error('Failed to book session:', error);
      alert('Failed to book session. Please try again.');
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">
            <Star className="w-3 h-3 fill-emerald-700" />
            <span>Top Rated Experts</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">Find Your Perfect Tutor</h2>
          <p className="text-slate-600">Browse verified experts in STEM and ICT subjects ready to guide you.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject or name..."
              className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all font-medium"
            />
          </div>
          <button
            onClick={() => alert('Searching for tutors...')}
            className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Search className="w-6 h-6" />
          </button>
        </div>
      </div>

      {isLoadingTutors ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tutors.map((tutor) => {
            const isTutorPreviewOpen = hoveredTutorId === tutor.id || selectedTutor?.id === tutor.id;

            return (
              <motion.div
                layout
                whileHover={{ y: -10 }}
                key={tutor.id}
                onMouseEnter={() => setHoveredTutorId(tutor.id)}
                onMouseLeave={() => setHoveredTutorId(null)}
                className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group relative"
              >
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-10" />
                <div className="p-8 relative z-10">
                  <div className="flex items-start gap-5">
                    <div className="relative">
                      <img
                        src={tutor.avatar}
                        alt={getTutorDisplayName(tutor)}
                        className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-xl"
                        referrerPolicy="no-referrer"
                      />
                      {tutor.isVerified && (
                        <div className="absolute -bottom-1 -right-1 bg-indigo-600 p-1 rounded-lg border-2 border-white">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 pt-1">
                      <h3 className="font-black text-xl text-slate-900 leading-tight mb-1">{getTutorDisplayName(tutor)}</h3>
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">{tutor.qualifications}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-lg">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-black text-amber-700">{tutor.rating}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">({tutor.reviewCount} reviews)</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {tutor.subjects.map((subject) => (
                      <span key={subject} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-100">
                        {subject}
                      </span>
                    ))}
                  </div>

                  <p className="mt-5 text-sm text-slate-500 leading-relaxed line-clamp-2 font-medium italic">"{tutor.bio}"</p>

                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hourly Rate</span>
                      <p className="text-2xl font-black text-slate-900">LKR {tutor.pricePerHour}</p>
                    </div>
                    <button
                      onClick={() => setSelectedTutor(selectedTutor?.id === tutor.id ? null : tutor)}
                      className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${
                        selectedTutor?.id === tutor.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
                      }`}
                    >
                      {selectedTutor?.id === tutor.id ? 'Close' : (isStudent || !currentUser ? 'Book Session' : 'View Profile')}
                    </button>
                  </div>

                  <AnimatePresence>
                    {isTutorPreviewOpen && (isStudent || !currentUser) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 pt-6 border-t border-slate-50 space-y-4 overflow-hidden"
                      >
                        <SubjectMotionGraphic tutor={tutor} />

                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Available Slots</h4>
                          <Calendar className="w-4 h-4 text-slate-400" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {tutor.availability.map((slot) => (
                            <button
                              key={slot.id}
                              onClick={() => handleBookSession(tutor, slot.id)}
                              className="p-3 rounded-2xl border-2 border-slate-50 hover:border-indigo-200 hover:bg-indigo-50 transition-all text-left group"
                            >
                              <p className="font-black text-xs text-slate-700 group-hover:text-indigo-700">{slot.day}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{slot.startTime} - {slot.endTime}</p>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
