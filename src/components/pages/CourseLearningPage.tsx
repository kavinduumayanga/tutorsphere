import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  Video,
  Award,
  Link as LinkIcon,
  MessageCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  BookOpen,
  Download,
  FileText,
  Clock,
  CheckCircle,
  Check,
  Bookmark,
  Gauge,
  PenLine,
  Menu,
  Star,
  Users,
  Sparkles,
} from 'lucide-react';
import { Course, CourseEnrollment, Tutor, CourseModule } from '../../types';
import { DEFAULT_AVATAR_PLACEHOLDER } from '../../utils/defaultAvatar';

// --- Helpers (copied inline so the component is self-contained) ---

const getTutorDisplayName = (tutor: Tutor & { name?: string }) => {
  const firstName = tutor.firstName?.trim();
  const lastName = tutor.lastName?.trim();
  if (firstName || lastName) return `${firstName || ''} ${lastName || ''}`.trim();
  return (tutor as any).name?.trim() || 'Tutor';
};

const getEmbeddableVideoUrl = (url: string): string | null => {
  const trimmed = url?.trim();
  if (!trimmed || trimmed === '#') return null;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (host === 'youtu.be') {
      const videoId = parsed.pathname.replace('/', '').trim();
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (host === 'vimeo.com') {
      const videoId = parsed.pathname.replace('/', '').trim();
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
    if (host === 'player.vimeo.com') return trimmed;
    return null;
  } catch {
    return null;
  }
};

const isDirectVideoFile = (url: string): boolean => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url.trim());

// --- Types ---

export interface CourseLearningPageProps {
  course: Course | null;
  enrollment: CourseEnrollment | null;
  completedSet: Set<string>;
  progress: number;
  isComplete: boolean;
  isStudent: boolean;
  tutors: Tutor[];
  activeVideoModuleId: string | null;
  learningContentTab: 'overview' | 'notes' | 'resources' | 'qa';
  bookmarkedModules: Set<string>;
  playbackSpeed: string;
  studentNotes: Record<string, string>;
  onSetActiveVideoModuleId: (id: string | null) => void;
  onSetLearningContentTab: (tab: 'overview' | 'notes' | 'resources' | 'qa') => void;
  onSetBookmarkedModules: (set: Set<string>) => void;
  onSetPlaybackSpeed: (speed: string) => void;
  onSetStudentNotes: (notes: Record<string, string>) => void;
  onToggleModuleProgress: (course: Course, moduleId: string, isCompleted: boolean) => void;
  onDownloadCertificate: (enrollment: CourseEnrollment, courseTitle: string) => void;
  onUnenrollCourse: (courseId: string) => void;
  onBack: () => void;
  onViewTutorProfile: (tutorId: string) => void;
}

// --- Skeleton Components ---

const VideoSkeleton = () => (
  <div className="relative bg-slate-900 aspect-video flex items-center justify-center animate-pulse rounded-b-none">
    <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950" />
    <div className="relative flex flex-col items-center gap-3">
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
        <Play className="w-7 h-7 text-white/30" />
      </div>
      <div className="h-3 w-32 bg-white/10 rounded-full" />
    </div>
  </div>
);

const SidebarSkeleton = () => (
  <div className="p-5 space-y-3">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white animate-pulse border border-slate-100">
        <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-16 bg-slate-200 rounded" />
          <div className="h-3.5 w-full bg-slate-200 rounded" />
        </div>
      </div>
    ))}
  </div>
);

// --- Circular Progress Ring ---

const ProgressRing = ({ progress, size = 44, strokeWidth = 4 }: { progress: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" className="text-slate-200" strokeWidth={strokeWidth} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-extrabold text-indigo-600">{progress}%</span>
      </div>
    </div>
  );
};

// --- Main Component ---

export const CourseLearningPage: React.FC<CourseLearningPageProps> = ({
  course,
  enrollment,
  completedSet,
  progress,
  isComplete,
  isStudent,
  tutors,
  activeVideoModuleId,
  learningContentTab,
  bookmarkedModules,
  playbackSpeed,
  studentNotes,
  onSetActiveVideoModuleId,
  onSetLearningContentTab,
  onSetBookmarkedModules,
  onSetPlaybackSpeed,
  onSetStudentNotes,
  onToggleModuleProgress,
  onDownloadCertificate,
  onUnenrollCourse,
  onBack,
  onViewTutorProfile,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showAutoSave, setShowAutoSave] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeModuleRef = useRef<HTMLButtonElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- No course selected state ---
  if (!course) {
    return (
      <div className="min-h-[80vh] w-full flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5 p-10 max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 mx-auto flex items-center justify-center">
            <BookOpen className="w-9 h-9 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">Loading Course…</h2>
          <p className="text-slate-500 text-sm leading-relaxed">We're fetching your course content. If this takes too long, the course may not exist.</p>
          <button onClick={onBack} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-bold shadow-lg shadow-indigo-200">
            <ChevronLeft className="w-4 h-4" /> Back to Courses
          </button>
        </motion.div>
      </div>
    );
  }

  // --- No modules state ---
  if (!course.modules || course.modules.length === 0) {
    return (
      <div className="min-h-[80vh] w-full flex items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5 p-10 max-w-md">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 mx-auto flex items-center justify-center">
            <Video className="w-9 h-9 text-amber-500" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">No Modules Yet</h2>
          <p className="text-slate-500 text-sm leading-relaxed">This course doesn't have any learning modules yet. Check back later!</p>
          <button onClick={onBack} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-bold shadow-lg shadow-indigo-200">
            <ChevronLeft className="w-4 h-4" /> Back to Courses
          </button>
        </motion.div>
      </div>
    );
  }

  const currentModule = course.modules.find(m => m.id === activeVideoModuleId) || course.modules[0];
  const currentModuleIndex = currentModule ? course.modules.findIndex(m => m.id === currentModule.id) : 0;
  const embedUrl = currentModule ? getEmbeddableVideoUrl(currentModule.videoUrl) : null;
  const directVideoFile = currentModule ? isDirectVideoFile(currentModule.videoUrl) : false;
  const isCurrentModuleCompleted = currentModule ? completedSet.has(currentModule.id) : false;
  const hasNextModule = currentModuleIndex < course.modules.length - 1;
  const hasPrevModule = currentModuleIndex > 0;
  const courseTutor = tutors.find(t => t.id === course.tutorId);

  const [localNote, setLocalNote] = useState<string>('');
  
  // Custom video controls state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0) setIsMuted(false);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  useEffect(() => {
    // Reset play state when module changes
    setIsPlaying(false);
  }, [currentModule?.id]);

  useEffect(() => {
    if (currentModule) {
      setLocalNote(studentNotes[currentModule.id] || '');
    }
  }, [currentModule?.id, studentNotes]);

  const handleNoteChange = (value: string) => {
    setLocalNote(value);
  };

  const handleSaveNote = () => {
    if (currentModule) {
      onSetStudentNotes({ ...studentNotes, [currentModule.id]: localNote });
      setShowAutoSave(true);
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => setShowAutoSave(false), 3000);
    }
  };

  const toggleBookmark = (moduleId: string) => {
    const updated = new Set(bookmarkedModules);
    if (updated.has(moduleId)) updated.delete(moduleId);
    else updated.add(moduleId);
    onSetBookmarkedModules(updated);
  };

  const selectModule = (moduleId: string) => {
    onSetActiveVideoModuleId(moduleId);
    setIsMobileSidebarOpen(false);
  };

  const SPEED_OPTIONS = ['0.5', '0.75', '1', '1.25', '1.5', '2'];

  // --- Content Tabs data ---
  const contentTabs = [
    { key: 'overview' as const, label: 'Overview', icon: BookOpen },
    { key: 'notes' as const, label: 'Notes', icon: PenLine },
    { key: 'resources' as const, label: 'Resources', icon: FileText },
    { key: 'qa' as const, label: 'Q&A', icon: MessageCircle },
  ];

  // Scroll to active module in sidebar
  useEffect(() => {
    if (activeModuleRef.current) {
      activeModuleRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeVideoModuleId]);

  // --- Sidebar Module List (shared between desktop and mobile) ---
  const renderModuleList = () => (
    <div className="space-y-1.5">
      {course.modules.map((module, index) => {
        const isActive = currentModule?.id === module.id;
        const isModCompleted = completedSet.has(module.id);
        const isBookmarked = bookmarkedModules.has(module.id);
        return (
          <button
            key={module.id}
            ref={isActive ? activeModuleRef : undefined}
            onClick={() => selectModule(module.id)}
            className={`w-full text-left p-3.5 rounded-xl flex items-start gap-3 transition-all duration-200 border group ${
              isActive
                ? 'bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-200 shadow-sm ring-1 ring-indigo-100'
                : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 hover:shadow-sm'
            }`}
          >
            {/* Step number / check */}
            <div className="flex-shrink-0 mt-0.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isModCompleted
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                    : isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-slate-200/80 text-slate-500 group-hover:bg-indigo-200 group-hover:text-indigo-700'
                }`}
              >
                {isModCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
            </div>
            {/* Module info */}
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                Lesson {index + 1}
              </p>
              <h4 className={`text-sm font-semibold truncate mt-0.5 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                {module.title}
              </h4>
              {/* Meta row */}
              <div className="flex items-center gap-2 mt-1.5">
                {isBookmarked && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">
                    <Bookmark className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Saved
                  </span>
                )}
              </div>
            </div>
            {/* Playing indicator */}
            {isActive && (
              <div className="flex-shrink-0 flex items-center gap-0.5 mt-1">
                <span className="w-0.5 h-3 bg-indigo-500 rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                <span className="w-0.5 h-2.5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-[#f8f9fc] flex flex-col">
      {/* =========== TOP HEADER =========== */}
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-lg border-b border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex-shrink-0">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex items-center justify-between gap-4">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={onBack}
                className="flex-shrink-0 p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900"
                title="Back to Courses"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold text-slate-900 truncate leading-tight">{course.title}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Module {currentModuleIndex + 1} of {course.modules.length}
                  </span>
                  {courseTutor && (
                    <>
                      <span className="text-slate-300">·</span>
                      <button
                        onClick={() => onViewTutorProfile(courseTutor.id)}
                        className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                      >
                        <img
                          src={courseTutor.avatar || DEFAULT_AVATAR_PLACEHOLDER}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors">
                          {getTutorDisplayName(courseTutor)}
                        </span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Progress Ring */}
            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
              <ProgressRing progress={progress} size={42} strokeWidth={3.5} />
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress</p>
                <p className="text-xs font-extrabold text-slate-700">
                  {completedSet.size}/{course.modules.length} done
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500"
                title="Course content"
              >
                <Menu className="w-5 h-5" />
              </button>
              {isComplete && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> Completed
                </span>
              )}
              {isStudent && (
                <button
                  onClick={() => onUnenrollCourse(course.id)}
                  className="p-2 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Unenroll from course"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========== MAIN CONTENT GRID =========== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Video + Content (3/4 on desktop) */}
        <div className="flex-1 lg:w-3/4 overflow-y-auto">
          {/* --- VIDEO PLAYER --- */}
          <div className="relative bg-black aspect-video flex-col flex items-center justify-center group overflow-hidden">
            {directVideoFile ? (
              <>
                <video
                  src={currentModule.videoUrl}
                  ref={(video) => {
                    //@ts-ignore
                    videoRef.current = video;
                    if (video) video.playbackRate = Number(playbackSpeed);
                  }}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                {!isPlaying && (
                  <button onClick={togglePlay} className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-indigo-600/80 backdrop-blur flex items-center justify-center hover:bg-indigo-500 hover:scale-110 transition-all text-white border border-white/20 shadow-xl z-20">
                    <Play className="w-8 h-8 fill-current translate-x-1" />
                  </button>
                )}
                {/* Custom Video Controls overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30">
                  <div className="flex items-center gap-4 text-white">
                    <button onClick={() => hasPrevModule && selectModule(course.modules[currentModuleIndex - 1].id)} disabled={!hasPrevModule} className="p-1 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-white">
                      <SkipBack className="w-5 h-5 fill-current" />
                    </button>
                    <button onClick={togglePlay} className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-full hover:bg-indigo-500 transition-colors">
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
                    </button>
                    <button onClick={() => hasNextModule && selectModule(course.modules[currentModuleIndex + 1].id)} disabled={!hasNextModule} className="p-1 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-white">
                      <SkipForward className="w-5 h-5 fill-current" />
                    </button>

                    <div className="flex items-center gap-2 group/vol">
                      <button onClick={toggleMute} className="p-1 hover:text-indigo-400">
                        {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                      </button>
                      <input 
                        type="range" 
                        min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 transition-all duration-300 cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : embedUrl ? (
              <>
                <iframe
                  src={embedUrl}
                  title={currentModule.title}
                  className="w-full h-full pb-14" // leave room for custom bottom bar
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div className="absolute bottom-0 left-0 right-0 h-14 bg-slate-900 border-t border-white/10 flex items-center px-4 gap-4 text-white z-10 justify-between">
                  <div className="flex items-center gap-4">
                    <button onClick={() => hasPrevModule && selectModule(course.modules[currentModuleIndex - 1].id)} disabled={!hasPrevModule} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-white/10">
                      <SkipBack className="w-4 h-4" /> Prev Lesson
                    </button>
                    <button onClick={() => hasNextModule && selectModule(course.modules[currentModuleIndex + 1].id)} disabled={!hasNextModule} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-indigo-600">
                      Next Lesson <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center px-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
                <div className="space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-white/5 backdrop-blur flex items-center justify-center mx-auto border border-white/10">
                    <Video className="w-9 h-9 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">External Video Module</p>
                    <p className="text-sm text-slate-400 mt-1">This video is hosted on an external platform.</p>
                  </div>
                  {currentModule.videoUrl && currentModule.videoUrl !== '#' && (
                    <a
                      href={currentModule.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                    >
                      <Play className="w-4 h-4" /> Open Video <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Playback Speed Overlay */}
            {(directVideoFile || embedUrl) && (
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5">
                  <Gauge className="w-3.5 h-3.5 text-white/70" />
                  <select
                    value={playbackSpeed}
                    onChange={(e) => onSetPlaybackSpeed(e.target.value)}
                    className="bg-transparent text-white text-xs font-semibold cursor-pointer outline-none appearance-none pr-3"
                  >
                    {SPEED_OPTIONS.map(s => (
                      <option key={s} value={s} className="bg-slate-900 text-white">
                        {s}x
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* --- CONTENT TABS --- */}
          <div className="bg-white border-b border-slate-100">
            {/* Tab Navigation */}
            <div className="px-4 sm:px-8 border-b border-slate-100">
              <nav className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-hide">
                {contentTabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = learningContentTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => onSetLearningContentTab(tab.key)}
                      className={`flex items-center gap-2 px-4 py-3.5 text-sm font-semibold border-b-2 transition-all whitespace-nowrap ${
                        isActive
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-5 sm:p-8">
              <AnimatePresence mode="wait">
                {/* ===== OVERVIEW TAB ===== */}
                {learningContentTab === 'overview' && (
                  <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-8">
                    {/* Module Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-full">
                          <Play className="w-3 h-3" /> Module {currentModuleIndex + 1}
                        </span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3 leading-tight">{currentModule.title}</h3>
                      </div>
                      <button
                        onClick={() => toggleBookmark(currentModule.id)}
                        className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all duration-200 ${
                          bookmarkedModules.has(currentModule.id)
                            ? 'border-amber-300 bg-amber-50 text-amber-500 shadow-sm shadow-amber-100'
                            : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200 hover:text-amber-400'
                        }`}
                        title="Bookmark this module"
                      >
                        <Bookmark className={`w-5 h-5 ${bookmarkedModules.has(currentModule.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Description */}
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">About this course</h4>
                      <p className="text-slate-600 leading-relaxed text-[15px]">{course.description}</p>
                    </div>

                    {/* Module Resources Grid */}
                    {currentModule.resources.length > 0 && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Module Resources
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentModule.resources.map((resource, idx) => (
                            <button
                              key={`${currentModule.id}-resource-${idx}`}
                              onClick={(e) => {
                                e.preventDefault();
                                onSetLearningContentTab('resources');
                              }}
                              className="p-4 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all duration-200 flex items-center justify-between gap-3 group shadow-sm hover:shadow-md w-full text-left"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors flex-shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">{resource.name || `Resource ${idx + 1}`}</p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {resource.name ? 'Uploaded file' : 'External resource'} - click to view in Resources
                                  </p>
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Instructor Card */}
                    {courseTutor && (
                      <div className="bg-gradient-to-r from-indigo-50/80 to-violet-50/80 rounded-2xl p-6 border border-indigo-100/50">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4" /> Your Instructor
                        </h4>
                        <div className="flex items-start gap-4">
                          <img
                            src={courseTutor.avatar || DEFAULT_AVATAR_PLACEHOLDER}
                            alt={getTutorDisplayName(courseTutor)}
                            className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-md flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0">
                            <h5 className="text-lg font-extrabold text-slate-900">{getTutorDisplayName(courseTutor)}</h5>
                            <p className="text-sm text-indigo-600 font-semibold">
                              {`${courseTutor.teachingLevel} Tutor`}
                            </p>
                            {courseTutor.rating > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                <span className="text-xs font-bold text-slate-600">{courseTutor.rating}</span>
                                <span className="text-xs text-slate-400">({courseTutor.reviewCount} reviews)</span>
                              </div>
                            )}
                            <p className="text-sm text-slate-500 mt-2 line-clamp-2">{courseTutor.bio}</p>
                            <button
                              onClick={() => onViewTutorProfile(courseTutor.id)}
                              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors shadow-sm"
                            >
                              View Profile <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ===== NOTES TAB ===== */}
                {learningContentTab === 'notes' && (
                  <motion.div key="notes" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">Your Notes</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Notes are saved per module automatically</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <AnimatePresence>
                          {showAutoSave && (
                            <motion.span
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" /> Auto-saved
                            </motion.span>
                          )}
                        </AnimatePresence>
                        {localNote && (
                          <button
                            onClick={() => setLocalNote('')}
                            className="text-xs text-slate-400 hover:text-rose-500 font-semibold transition-colors"
                          >
                            Clear
                          </button>
                        )}
                        <button
                          onClick={handleSaveNote}
                          className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={localNote}
                      onChange={(e) => handleNoteChange(e.target.value)}
                      placeholder="Start typing your notes for this module..."
                      rows={12}
                      className="w-full p-5 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 outline-none font-mono text-sm resize-none bg-slate-50/50 transition-all placeholder:text-slate-300"
                    />
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{localNote.split(/\s+/).filter(Boolean).length} words</span>
                      <span>{localNote.length} characters</span>
                    </div>
                  </motion.div>
                )}

                {/* ===== RESOURCES TAB ===== */}
                {learningContentTab === 'resources' && (
                  <motion.div key="resources" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <h3 className="text-lg font-extrabold text-slate-900">Resources & Attachments</h3>
                    {currentModule.resources.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {currentModule.resources.map((resource, idx) => (
                          <a
                            key={`${currentModule.id}-res-${idx}`}
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={resource.name || undefined}
                            className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/40 transition-all duration-200 flex items-center justify-between group shadow-sm hover:shadow-md"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center text-indigo-600">
                                <Download className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 text-sm">{resource.name || `Resource ${idx + 1}`}</p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[240px]">{resource.url}</p>
                              </div>
                            </div>
                            <div className="flex-shrink-0 p-2 rounded-lg bg-slate-50 group-hover:bg-indigo-100 transition-colors">
                              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-300">
                          <FileText className="w-7 h-7" />
                        </div>
                        <p className="text-slate-500 font-semibold">No resources for this module</p>
                        <p className="text-xs text-slate-400 mt-1">Resources will appear here when the instructor adds them.</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ===== Q&A TAB ===== */}
                {learningContentTab === 'qa' && (
                  <motion.div key="qa" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-4">
                    <h3 className="text-lg font-extrabold text-slate-900">Questions & Discussion</h3>
                    <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
                          <MessageCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm text-indigo-900 font-bold">Have questions about this module?</p>
                          <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
                            Connect with your instructor through the course or check the Q&A section. Community discussions help everyone learn!
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <MessageCircle className="w-7 h-7" />
                      </div>
                      <p className="text-slate-500 font-semibold">Discussion feature coming soon</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">You'll be able to ask questions, share insights, and interact with your peers here.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* =========== RIGHT SIDEBAR (Desktop) =========== */}
        <div className="hidden lg:flex lg:w-80 xl:w-96 flex-col border-l border-slate-200/60 bg-[#f8f9fc] overflow-y-auto" ref={sidebarRef}>
          {/* Course content heading */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-lg border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-500" /> Course Content
              </h3>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                {completedSet.size}/{course.modules.length}
              </span>
            </div>
            {/* Mini progress bar */}
            <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Module List */}
          <div className="flex-1 p-4 overflow-y-auto">{renderModuleList()}</div>

          {/* Certificate Card */}
          <div className="border-t border-slate-200/60 p-5 bg-white">
            <div className="flex items-center gap-2.5 mb-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isComplete ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Certificate</h4>
                <p className="text-[10px] text-slate-400 font-medium">
                  {isComplete ? 'Ready to download!' : `Complete all ${course.modules.length} modules`}
                </p>
              </div>
            </div>

            {/* Certificate Status */}
            {isComplete && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 border-amber-200"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                    <Award className="w-6 h-6 text-amber-600" />
                  </div>
                  <p className="text-xs font-extrabold text-amber-800">Certificate Unlocked</p>
                  <p className="text-[10px] text-amber-600">Open the latest certificate preview design</p>
                </div>
              </motion.div>
            )}

            {/* Download Button */}
            {enrollment ? (
              <button
                onClick={() => onDownloadCertificate(enrollment, course.title)}
                disabled={!isComplete}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  isComplete
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-700 hover:to-emerald-600 shadow-lg shadow-emerald-200'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                {isComplete ? (
                  <>
                    <Download className="w-4 h-4" /> View Certificate
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" /> Complete Course First
                  </>
                )}
              </button>
            ) : (
              <p className="text-[10px] text-rose-500 font-bold text-center">Enrollment data not available</p>
            )}
          </div>
        </div>
      </div>

      {/* =========== MOBILE SIDEBAR OVERLAY =========== */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white z-50 shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-900">Course Content</h3>
                <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">{renderModuleList()}</div>

              {/* Mobile Certificate */}
              <div className="border-t border-slate-100 p-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <Award className={`w-5 h-5 ${isComplete ? 'text-emerald-600' : 'text-amber-500'}`} />
                  <span className="text-sm font-bold text-slate-700">{isComplete ? 'Certificate Ready!' : `${progress}% Complete`}</span>
                </div>
                {enrollment && isComplete && (
                  <button
                    onClick={() => onDownloadCertificate(enrollment, course.title)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* =========== STICKY BOTTOM ACTION BAR =========== */}
      <div className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/60 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex items-center justify-between gap-3">
            {/* Left: Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => hasPrevModule && onSetActiveVideoModuleId(course.modules[currentModuleIndex - 1].id)}
                disabled={!hasPrevModule}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  hasPrevModule
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <button
                onClick={() => hasNextModule && onSetActiveVideoModuleId(course.modules[currentModuleIndex + 1].id)}
                disabled={!hasNextModule}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  hasNextModule
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                }`}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Center: Progress (mobile) */}
            <div className="flex sm:hidden items-center gap-2">
              <ProgressRing progress={progress} size={34} strokeWidth={3} />
            </div>

            {/* Right: Mark Complete + Next Lesson */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleModuleProgress(course, currentModule.id, !isCurrentModuleCompleted)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  isCurrentModuleCompleted
                    ? 'bg-emerald-50 border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-indigo-600 border-2 border-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                }`}
              >
                {isCurrentModuleCompleted ? (
                  <>
                    <CheckCircle className="w-4 h-4" /> Completed
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" /> Mark Complete
                  </>
                )}
              </button>
              {hasNextModule && isCurrentModuleCompleted && (
                <button
                  onClick={() => onSetActiveVideoModuleId(course.modules[currentModuleIndex + 1].id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
