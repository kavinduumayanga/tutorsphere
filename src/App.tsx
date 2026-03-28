/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  BookOpen, 
  Search, 
  Calendar, 
  MessageSquare, 
  Lock, 
  Mail,
  User, 
  GraduationCap, 
  CheckCircle, 
  X, 
  Menu,
  Video,
  Star,
  Clock,
  ArrowRight,
  Send,
  Bot,
  Award,
  BookMarked,
  Edit,
  Volume2,
  Check,
  Trophy,
  Brain,
  Camera,
  Lightbulb,
  Atom,
  Dna,
  Binary,
  Calculator
} from 'lucide-react';
import Markdown from 'react-markdown';
import CountUp from 'react-countup';
import { localService } from './services/localService';
import { apiService } from './services/apiService';
import { Tutor, User as AppUser, Question, Booking, Course, Resource, SkillLevel, StudyPlan, Review, Quiz } from './types';

const STEM_SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'ICT', 'Computer Science', 'Software Engineering'];

type Tab = 'home' | 'tutors' | 'questions' | 'courses' | 'resources' | 'quizzes' | 'register' | 'dashboard' | 'settings';

const NAV_LABELS: Record<Tab, string> = {
  home: 'Home',
  tutors: 'Find Tutors',
  questions: 'Q&A',
  courses: 'Courses',
  resources: 'Resources',
  quizzes: 'Quizzes',
  register: 'Profile',
  dashboard: 'Dashboard',
  settings: 'Settings'
};

const getAllowedTabs = (user: AppUser | null): Tab[] => {
  if (!user) {
    return ['home', 'tutors', 'courses', 'resources', 'register'];
  }

  if (user.role === 'student') {
    return ['home', 'tutors', 'questions', 'courses', 'resources', 'dashboard', 'settings'];
  }

  if (user.role === 'tutor') {
    return ['home', 'dashboard', 'register', 'courses', 'resources', 'settings'];
  }

  return ['home'];
};

const canAccessTab = (tab: Tab, user: AppUser | null) => getAllowedTabs(user).includes(tab);

type SubjectMotionTheme = 'math' | 'coding' | 'chemistry' | 'science';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authData, setAuthData] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'student' as 'student' | 'tutor' });

  // Profile Update State
  const [profileData, setProfileData] = useState({ firstName: '', lastName: '', phone: '' });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Image Upload Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  // Load user and activeTab from localStorage on app start
  useEffect(() => {
    const storedSession = localStorage.getItem('session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        setCurrentUser(session.user);
        setActiveTab(session.activeTab || 'home');
      } catch {
        localStorage.removeItem('session');
      }
    }
  }, []);

  // Persist session when user or activeTab changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('session', JSON.stringify({ user: currentUser, activeTab }));
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    if (canAccessTab(activeTab, currentUser)) {
      return;
    }
    setActiveTab(currentUser ? 'dashboard' : 'home');
  }, [activeTab, currentUser]);

  // Registration State
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    education: '',
    subjects: [] as string[],
    teachingLevel: 'School' as 'School' | 'University' | 'Both',
    bio: ''
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{isValid: boolean, reason: string} | null>(null);

  // Question State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState({ text: '', subject: 'Mathematics' });
  const [isAsking, setIsAsking] = useState(false);

  // Booking State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [hoveredTutorId, setHoveredTutorId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userCourses, setUserCourses] = useState<string[]>([]);

  // API Data State
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoadingTutors, setIsLoadingTutors] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);

  // Skill & Study Plan State
  const [skills, setSkills] = useState<SkillLevel[]>([
    { subject: 'Mathematics', level: 'Intermediate', progress: 65 },
    { subject: 'Physics', level: 'Beginner', progress: 45 },
    { subject: 'ICT', level: 'Beginner', progress: 30 }
  ]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);

  // Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'bot', text: string, audio?: string}[]>([
    { role: 'bot', text: 'Hello! I am your TutorSphere assistant. How can I help you today? You can ask me to find a tutor, suggest a course, or even start a quiz!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  const isStudent = currentUser?.role === 'student';
  const isTutor = currentUser?.role === 'tutor';
  const availableTabs = getAllowedTabs(currentUser);
  const canUseChatbot = !currentUser || isStudent;

  // Fetch data from API on component mount
  useEffect(() => {
    const fetchTutors = async () => {
      setIsLoadingTutors(true);
      try {
        const tutorsData = await apiService.getTutors();
        setTutors(tutorsData);
      } catch (error) {
        console.error('Failed to fetch tutors:', error);
      } finally {
        setIsLoadingTutors(false);
      }
    };

    const fetchCourses = async () => {
      setIsLoadingCourses(true);
      try {
        const coursesData = await apiService.getCourses();
        setCourses(coursesData);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    const fetchResources = async () => {
      setIsLoadingResources(true);
      try {
        const resourcesData = await apiService.getResources();
        setResources(resourcesData);
      } catch (error) {
        console.error('Failed to fetch resources:', error);
      } finally {
        setIsLoadingResources(false);
      }
    };

    fetchTutors();
    fetchCourses();
    fetchResources();
  }, []);

  // Fetch user-specific data when user logs in
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) return;

      try {
        // Fetch user's bookings (student booking history vs tutor booking management)
        const userBookings = await apiService.getBookings();
        setBookings(
          currentUser.role === 'tutor'
            ? userBookings.filter(b => b.tutorId === currentUser.id)
            : userBookings.filter(b => b.studentId === currentUser.id)
        );

        // Fetch user's reviews
        const userReviews = await apiService.getReviews();
        setReviews(
          currentUser.role === 'tutor'
            ? userReviews.filter(r => r.tutorId === currentUser.id)
            : userReviews.filter(r => r.studentId === currentUser.id)
        );

        // Fetch student's questions only
        if (currentUser.role === 'student') {
          const allQuestions = await apiService.getQuestions();
          setQuestions(allQuestions.filter(q => q.studentId === currentUser.id));
        } else {
          setQuestions([]);
        }

        // Fetch user's study plan
        try {
          const userStudyPlan = await apiService.getStudyPlan(currentUser.id);
          setStudyPlan(userStudyPlan);
        } catch (error) {
          // Study plan doesn't exist yet, that's okay
        }

        // Fetch user's skill levels
        try {
          const userSkills = await apiService.getSkillLevels(currentUser.id);
          if (userSkills.length > 0) {
            setSkills(userSkills.map(s => ({
              subject: s.subject,
              level: s.level as any,
              progress: s.progress
            })));
          }
        } catch (error) {
          // Skill levels don't exist yet, that's okay
        }

      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, [currentUser]);

  // Sync profile data with current user
  useEffect(() => {
    if (currentUser) {
      setProfileData({
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        phone: currentUser.phone || ''
      });
    }
  }, [currentUser]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isUserMenuOpen && !(event.target as Element).closest('.user-menu')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let user;
      if (authMode === 'login') {
        user = await apiService.login(authData.email, authData.password);
        setCurrentUser(user);
        setActiveTab('dashboard');
        localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
        setShowAuthModal(false);
        setAuthData({ email: '', password: '', firstName: '', lastName: '', role: 'student' });
      } else {
        if (!authData.firstName.trim() || !authData.lastName.trim()) {
          alert('First name and last name are required.');
          return;
        }
        user = await apiService.signup(authData.firstName, authData.lastName, authData.email, authData.password, authData.role);
        // Show success message and switch to login mode
        alert('Account created successfully! Please sign in with your credentials.');
        setAuthMode('login');
        setAuthData({ email: authData.email, password: '', firstName: '', lastName: '', role: 'student' });
      }
    } catch (error: any) {
      alert(error.message || 'Authentication failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsValidating(true);
    const result = await localService.validateTutor(regData);
    setValidationResult(result);
    setIsValidating(false);
    if (result.isValid) {
      const newUser: AppUser = {
        id: Math.random().toString(36).substr(2, 9),
        firstName: regData.firstName,
        lastName: regData.lastName,
        email: regData.email,
        role: 'tutor'
      };
      setCurrentUser(newUser);
      setTimeout(() => setActiveTab('dashboard'), 2000);
    }
  };

  const handleAskQuestion = async () => {
    if (!newQuestion.text) return;
    setIsAsking(true);
    try {
      const answer = await localService.askQuestion(newQuestion.text, newQuestion.subject);
      const question = await apiService.createQuestion({
        studentId: currentUser?.id || 'guest',
        text: newQuestion.text,
        subject: newQuestion.subject,
        answer
      });
      setQuestions([question, ...questions]);
      setNewQuestion({ ...newQuestion, text: '' });
    } catch (error) {
      console.error('Failed to ask question:', error);
      alert('Failed to submit question. Please try again.');
    } finally {
      setIsAsking(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    
    // Check for quiz trigger in user message
    if (userMsg.toLowerCase().includes('quiz') || userMsg.toLowerCase().includes('test')) {
      const subject = STEM_SUBJECTS.find(s => userMsg.toLowerCase().includes(s.toLowerCase())) || 'Mathematics';
      setChatMessages(prev => [...prev, { role: 'bot', text: `Sure! I can help you start a ${subject} quiz. Let me generate it for you...` }]);
      handleStartQuiz(subject);
      return;
    }

    const botResponse = await localService.getChatbotResponse(userMsg, `User is currently on ${activeTab} tab. User name: ${currentUser?.firstName + ' ' + currentUser?.lastName || 'Guest'}`);
    setChatMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
  };

  const handleSpeak = async (text: string, index: number) => {
    if (isSpeaking) return;
    setIsSpeaking(index.toString());
    const audioUrl = await localService.generateSpeech(text);
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsSpeaking(null);
      audio.play();
    } else {
      setIsSpeaking(null);
    }
  };

  const handleStartQuiz = async (subject: string) => {
    setIsQuizLoading(true);
    setActiveTab('quizzes');
    try {
      const quizData = await localService.generateQuiz(subject, 'Intermediate');
      if (quizData) {
        const quiz = await apiService.createQuiz({
          subject,
          questions: quizData.questions
        });
        setActiveQuiz(quiz);
        setQuizScore(null);
      }
    } catch (error) {
      console.error('Failed to start quiz:', error);
      alert('Failed to start quiz. Please try again.');
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleGenerateStudyPlan = async () => {
    try {
      const plan = await localService.generateStudyPlan(skills);
      if (plan) {
        const studyPlan = await apiService.createStudyPlan({
          studentId: currentUser?.id || 'guest',
          weeklyGoalHours: plan.weeklyGoalHours,
          completedHours: 0,
          recommendations: plan.recommendations,
          schedule: plan.schedule
        });
        setStudyPlan(studyPlan);
      }
    } catch (error) {
      console.error('Failed to generate study plan:', error);
      alert('Failed to generate study plan. Please try again.');
    }
  };

  const handleBookSession = async (tutor: Tutor, slotId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
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
      setBookings([booking, ...bookings]);
      alert('Session booked successfully!');
    } catch (error) {
      console.error('Failed to book session:', error);
      alert('Failed to book session. Please try again.');
    }
  };

  const handleEnrollCourse = async (courseId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    if (currentUser.role !== 'student') {
      alert('Only student accounts can enroll in courses.');
      return;
    }
    if (userCourses.includes(courseId)) {
      alert('You are already enrolled in this course!');
      return;
    }
    try {
      await apiService.enrollInCourse(courseId, currentUser.id);
      setUserCourses([...userCourses, courseId]);
      alert('Successfully enrolled in course!');
    } catch (error) {
      console.error('Failed to enroll in course:', error);
      alert('Failed to enroll in course. Please try again.');
    }
  };

  const handleAddReview = async (tutorId: string, rating: number, comment: string) => {
    if (!currentUser) return;
    if (currentUser.role !== 'student') {
      alert('Only student accounts can submit tutor reviews.');
      return;
    }
    try {
      const review = await apiService.createReview({
        tutorId,
        studentId: currentUser.id,
        studentName: currentUser.firstName + ' ' + currentUser.lastName,
        rating,
        comment,
        date: new Date().toISOString().split('T')[0]
      });
      setReviews([review, ...reviews]);
      alert('Review submitted successfully!');
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('Failed to submit review. Please try again.');
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('session');
    setCurrentUser(null);
    setIsUserMenuOpen(false);
    setAuthMode('login');
    setShowAuthModal(true);
    setActiveTab('home');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert('Only PNG and JPEG files are allowed.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Profile picture must be less than 5MB.');
        return;
      }
      cropImageRef.current = null;
      setSelectedImage(URL.createObjectURL(file));
    }
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    const renderedWidth = image.width || image.naturalWidth;
    const renderedHeight = image.height || image.naturalHeight;
    const scaleX = image.naturalWidth / renderedWidth;
    const scaleY = image.naturalHeight / renderedHeight;

    // Set canvas to 1500x1500 for high resolution output
    const outputSize = 1500;
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Draw the cropped area scaled to 1500x1500
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      outputSize,
      outputSize
    );

    return new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.95);
    });
  };

  const handleSaveImage = async () => {
    if (!completedCrop || !currentUser || !cropImageRef.current) return;

    const croppedBlob = await getCroppedImg(cropImageRef.current, completedCrop);
    if (croppedBlob) {
      const formData = new FormData();
      formData.append('avatar', croppedBlob, 'profile.jpg');

      try {
        const updatedUser = await apiService.updateUser(currentUser.id, formData);
        console.log('Updated user response:', updatedUser);
        setCurrentUser(updatedUser);
        setShowImageModal(false);
        setSelectedImage(null);
        setCompletedCrop(null);
        cropImageRef.current = null;
        alert('Profile picture updated successfully!');
      } catch (error) {
        console.error('Failed to update profile picture:', error);
        const message = error instanceof Error ? error.message : 'Failed to update profile picture.';
        alert(message);
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      alert('First name and last name are required.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const formData = new FormData();
      formData.append('firstName', profileData.firstName.trim());
      formData.append('lastName', profileData.lastName.trim());
      if (profileData.phone) formData.append('phone', profileData.phone.trim());

      const updatedUser = await apiService.updateUser(currentUser.id, formData);
      setCurrentUser(updatedUser);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('home')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-indigo-900">TutorSphere</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              {availableTabs.filter(tab => tab !== 'dashboard' && tab !== 'settings' && tab !== 'register').map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-sm font-semibold ${activeTab === tab ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                >
                  {NAV_LABELS[tab]}
                </button>
              ))}
              {!currentUser ? (
                <button 
                  onClick={() => {setAuthMode('login'); setShowAuthModal(true)}} 
                  className="bg-indigo-600 text-white px-5 py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Login
                </button>
              ) : (
                <div className="relative user-menu">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors"
                  >
                    <User className="w-4 h-4" /> {currentUser.firstName} {currentUser.lastName}
                  </button>
                  
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                      <button 
                        onClick={() => {setActiveTab('dashboard'); setIsUserMenuOpen(false)}}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        Dashboard
                      </button>
                      <button 
                        onClick={() => {setActiveTab('settings'); setIsUserMenuOpen(false)}}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      <button 
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-4"
          >
            {availableTabs.filter(tab => tab !== 'dashboard' && tab !== 'settings' && tab !== 'register').map(tab => (
              <button
                key={tab}
                onClick={() => {setActiveTab(tab); setIsMenuOpen(false)}}
                className="block w-full text-left text-slate-600 font-medium"
              >
                {NAV_LABELS[tab]}
              </button>
            ))}
            {!currentUser ? (
              <button 
                onClick={() => {setAuthMode('login'); setShowAuthModal(true); setIsMenuOpen(false)}} 
                className="w-full bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-bold"
              >
                Login
              </button>
            ) : (
              <div className="space-y-2">
                <button onClick={() => {setActiveTab('dashboard'); setIsMenuOpen(false)}} className="w-full bg-indigo-50 text-indigo-700 px-5 py-3 rounded-xl text-sm font-bold">
                  Dashboard
                </button>
                <button onClick={() => {setActiveTab('settings'); setIsMenuOpen(false)}} className="w-full bg-slate-50 text-slate-700 px-5 py-3 rounded-xl text-sm font-bold">
                  Settings
                </button>
                <button 
                  onClick={() => {handleSignOut(); setIsMenuOpen(false)}}
                  className="w-full bg-red-50 text-red-600 px-5 py-3 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'home' && (
          <div className="space-y-24">
            {/* Hero Section */}
            <section className="grid lg:grid-cols-2 gap-12 items-center min-h-[70vh] py-12">
              <motion.div 
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
              >
                <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">The Future of STEM Learning</span>
                </div>
                <h1 className="text-6xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                  Master STEM with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Expert Tutors</span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                  Connect with top-tier educators in Mathematics, Physics, and ICT. Personalized learning paths powered by AI.
                </p>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => setActiveTab('tutors')}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 group"
                  >
                    Find Your Tutor <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button 
                    onClick={() => setActiveTab('register')}
                    className="bg-white text-indigo-600 border border-indigo-200 px-8 py-4 rounded-2xl font-bold hover:bg-indigo-50 transition-all"
                  >
                    Join as Tutor
                  </button>
                </div>
                <div className="flex items-center gap-6 pt-4">
                  <div className="flex -space-x-3">
                    {tutors.slice(0, 4).map(t => (
                      <img key={t.id} src={t.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-contain object-center bg-white" referrerPolicy="no-referrer" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Joined by <span className="text-slate-900 font-bold">2,000+</span> students this month</p>
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
              >
                <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 blur-3xl rounded-full" />
                <div className="relative bg-white p-4 rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=1200&h=900" 
                    alt="Learning" 
                    className="rounded-[2rem] w-full object-cover aspect-[4/3]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-12 left-12 right-12 bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/50 shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="bg-indigo-600 p-3 rounded-2xl">
                        <GraduationCap className="text-white w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-1">Live Session</p>
                        <h4 className="font-bold text-slate-900">Advanced Quantum Physics</h4>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Floating Stats */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -top-6 -right-6 bg-white p-6 rounded-3xl shadow-xl border border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl">
                      <CheckCircle className="text-emerald-600 w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">98%</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Success Rate</p>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </section>

            {/* Stats Section - Overlapping Hero */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative -mt-16 z-10 max-w-5xl mx-auto px-6"
            >
              <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-6 md:p-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {/* Active Tutors */}
                  <div className="text-center space-y-1">
                    <div className="text-3xl md:text-4xl font-extrabold text-violet-600">
                      <CountUp end={tutors.length} duration={2.5} />
                    </div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Active Tutors
                    </div>
                  </div>

                  {/* Students */}
                  <div className="text-center space-y-1">
                    <div className="text-3xl md:text-4xl font-extrabold text-violet-600">
                      <CountUp end={2000} duration={2.5} suffix="+" />
                    </div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Students
                    </div>
                  </div>

                  {/* STEM/ICT Subjects */}
                  <div className="text-center space-y-1">
                    <div className="text-3xl md:text-4xl font-extrabold text-violet-600">
                      <CountUp end={15} duration={2.5} suffix="+" />
                    </div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      STEM/ICT Subjects
                    </div>
                  </div>

                  {/* Average Rating */}
                  <div className="text-center space-y-1">
                    <div className="text-3xl md:text-4xl font-extrabold text-violet-600">
                      <CountUp end={4.9} duration={2.5} decimals={1} />
                    </div>
                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Average Rating
                    </div>
                  </div>
                </div>

                {/* Subtle dividers */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mt-4">
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                </div>
              </div>
            </motion.div>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-8">
              {[
                { icon: <CheckCircle className="text-emerald-500" />, title: 'Verified Tutors', desc: 'Automated qualification validation ensures only the best teach you.' },
                { icon: <Calendar className="text-indigo-500" />, title: 'Easy Booking', desc: 'Seamless time-slot management and session scheduling.' },
                { icon: <Bot className="text-purple-500" />, title: 'AI Support', desc: 'Get instant answers to your STEM questions with our AI tutor.' }
              ].map((f, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
                    {f.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-600">{f.desc}</p>
                </div>
              ))}
            </section>
            {/* Featured Tutors Section */}
            <section className="space-y-12">
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-bold text-slate-900">Meet Our Top Rated Tutors</h2>
                <p className="text-slate-600 max-w-2xl mx-auto">Learn from the best minds in the country. Our tutors are verified experts with proven track records.</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {tutors.map(tutor => (
                  <motion.div 
                    whileHover={{ y: -10 }}
                    key={tutor.id}
                    className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group cursor-pointer"
                    onClick={() => setActiveTab('tutors')}
                  >
                    <div className="relative h-64 overflow-hidden">
                      <img src={tutor.avatar} alt={tutor.firstName + ' ' + tutor.lastName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        <span className="text-xs font-bold">{tutor.rating}</span>
                      </div>
                    </div>
                    <div className="p-6 space-y-2">
                      <h3 className="font-bold text-lg text-slate-900">{tutor.firstName} {tutor.lastName}</h3>
                      <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">{tutor.subjects[0]}</p>
                      <p className="text-sm text-slate-500 line-clamp-1">{tutor.qualifications}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="text-center">
                <button 
                  onClick={() => setActiveTab('tutors')}
                  className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:gap-3 transition-all"
                >
                  View All Tutors <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'tutors' && (
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
                {tutors.map(tutor => (
                (() => {
                  const isTutorPreviewOpen = hoveredTutorId === tutor.id || selectedTutor?.id === tutor.id;

                  return (
                <motion.div 
                  layout
                  whileHover={{ y: -10 }}
                  key={tutor.id}
                  onMouseEnter={() => setHoveredTutorId(tutor.id)}
                  onMouseLeave={() => setHoveredTutorId((currentId) => (currentId === tutor.id ? null : currentId))}
                  className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group relative"
                >
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-10" />
                  <div className="p-8 relative z-10">
                    <div className="flex items-start gap-5">
                      <div className="relative">
                        <img 
                          src={tutor.avatar} 
                          alt={tutor.firstName + ' ' + tutor.lastName} 
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
                        <h3 className="font-black text-xl text-slate-900 leading-tight mb-1">{tutor.firstName} {tutor.lastName}</h3>
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
                      {tutor.subjects.map(s => (
                        <span key={s} className="px-3 py-1.5 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-slate-100">
                          {s}
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
                            {tutor.availability.map(slot => (
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
                })()
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <BookMarked className="w-3 h-3 fill-blue-700" />
                  <span>Curated Learning</span>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Professional STEM Courses</h2>
                <p className="text-slate-600">Structured learning paths designed by industry experts to master complex topics.</p>
              </div>
              <div className="flex gap-3 w-full md:w-auto">
                <select 
                  onChange={(e) => alert(`Filtering by ${e.target.value}...`)}
                  className="px-6 py-4 rounded-2xl border border-slate-200 bg-white font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer"
                >
                  <option>All Subjects</option>
                  {STEM_SUBJECTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {isLoadingCourses ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
                {courses.map(course => (
                <motion.div 
                  whileHover={{ y: -10 }}
                  key={course.id}
                  className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group flex flex-col"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img 
                      src={course.thumbnail} 
                      alt={course.title} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute top-6 left-6 flex flex-col gap-2">
                      <div className="bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-xl text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-white/50 shadow-xl">
                        {course.subject}
                      </div>
                    </div>
                    <div className="absolute bottom-6 left-6 right-6 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="flex items-center gap-2 text-white text-xs font-bold">
                        <Clock className="w-4 h-4" />
                        <span>12+ Hours of Content</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-10 flex-1 flex flex-col">
                    <div className="flex-1 space-y-4">
                      <h3 className="text-2xl font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed font-medium">
                        {course.description}
                      </p>
                    </div>
                    
                    <div className="mt-10 pt-8 border-t border-slate-50 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrollment Fee</span>
                        <p className="text-3xl font-black text-slate-900">LKR {course.price}</p>
                      </div>
                      <button 
                        onClick={() => {
                          if (isTutor) {
                            alert(`Manage course: ${course.title}`);
                            return;
                          }
                          handleEnrollCourse(course.id);
                        }}
                        className={`px-8 py-4 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                          isTutor
                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                            : userCourses.includes(course.id) 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700'
                        }`}
                      >
                        {isTutor ? 'Manage Course' : userCourses.includes(course.id) ? (
                          <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Enrolled</span>
                        ) : 'Enroll Now'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold">Free Resource Library</h2>
              <p className="text-slate-600">Access papers, notes, and articles for your studies.</p>
            </div>
            {isLoadingResources ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {resources.map(res => (
                <div key={res.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-2xl">
                      <BookOpen className="text-indigo-600 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">{res.title}</h3>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{res.subject} • {res.type}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => alert(isTutor ? `Manage resource: ${res.title}` : `Downloading ${res.title}...`)}
                    className="text-indigo-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    {isTutor ? 'Manage' : 'Download'} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === 'quizzes' && (!currentUser || isStudent) && (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-bold">
                <Trophy className="w-4 h-4" />
                <span>Skill Evaluation</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Challenge Your Knowledge</h2>
              <p className="text-slate-600 max-w-xl mx-auto">Select a subject to start a personalized assessment and earn your skill badges.</p>
            </div>

            {isQuizLoading ? (
              <div className="flex flex-col items-center justify-center py-24 space-y-6 bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-50">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
                  <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <Brain className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-indigo-600" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-900">Curating Questions...</p>
                  <p className="text-slate-500">Our AI is analyzing your skill matrix to challenge you.</p>
                </div>
              </div>
            ) : !activeQuiz ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: 'Mathematics', icon: Calculator, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
                  { name: 'Physics', icon: Atom, color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600' },
                  { name: 'Chemistry', icon: Dna, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
                  { name: 'Biology', icon: Brain, color: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600' },
                  { name: 'ICT', icon: Binary, color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
                  { name: 'Combined Maths', icon: Lightbulb, color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' }
                ].map((s, idx) => (
                  <motion.button 
                    whileHover={{ y: -8, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    key={idx}
                    onClick={() => { setSelectedAnswers({}); handleStartQuiz(s.name); }}
                    className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all text-left group relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 w-32 h-32 ${s.light} rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150`} />
                    <div className={`${s.color} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-${s.color.split('-')[1]}-200 relative z-10`}>
                      <s.icon className="text-white w-7 h-7" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-xl font-black text-slate-900 mb-2">{s.name}</h3>
                      <p className="text-slate-500 text-sm leading-relaxed mb-4">Master the fundamentals of {s.name.toLowerCase()} with AI-generated challenges.</p>
                      <div className={`flex items-center gap-2 font-bold text-sm ${s.text}`}>
                        Start Quiz <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl overflow-hidden"
              >
                {/* Quiz Header */}
                <div className="bg-slate-900 p-8 md:p-10 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-32 -mt-32" />
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest text-indigo-300 border border-white/10">
                          {activeQuiz.subject} Assessment
                        </span>
                      </div>
                      <h3 className="text-3xl font-black mb-2">Knowledge Check</h3>
                      <p className="text-slate-400 font-medium">Question {Object.keys(selectedAnswers).length} of {activeQuiz.questions.length} completed</p>
                    </div>
                    <button 
                      onClick={() => setActiveQuiz(null)} 
                      className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors border border-white/10"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-8 h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${(Object.keys(selectedAnswers).length / activeQuiz.questions.length) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="p-8 md:p-12 space-y-12">
                  {activeQuiz.questions.map((q, idx) => (
                    <div key={idx} className="space-y-6">
                      <div className="flex items-start gap-5">
                        <div className="bg-indigo-50 text-indigo-600 w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shrink-0">
                          {idx + 1}
                        </div>
                        <p className="font-bold text-xl text-slate-800 leading-snug pt-1">{q.question}</p>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 pl-0 md:pl-14">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = selectedAnswers[idx] === opt;
                          return (
                            <button 
                              key={oIdx} 
                              onClick={() => setSelectedAnswers({...selectedAnswers, [idx]: opt})}
                              className={`w-full text-left p-5 rounded-[1.5rem] border-2 transition-all font-bold relative group ${
                                isSelected 
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-lg shadow-indigo-100' 
                                : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{opt}</span>
                                {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-8 border-t border-slate-100">
                    <button 
                      disabled={Object.keys(selectedAnswers).length < activeQuiz.questions.length}
                      onClick={() => {
                        const score = Math.floor(Math.random() * 40) + 60; // Mock score
                        setQuizScore(score);
                        setActiveQuiz(null);
                      }}
                      className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                      Complete Assessment <Check className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {quizScore !== null && !activeQuiz && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-2xl text-center space-y-8 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
                <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy className="w-12 h-12 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-slate-900 mb-2">Assessment Complete!</h3>
                  <p className="text-slate-500 font-medium">Great job! You've successfully completed the evaluation.</p>
                </div>
                
                <div className="flex justify-center items-center gap-8">
                  <div className="text-center">
                    <div className="text-5xl font-black text-indigo-600 mb-1">{quizScore}%</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Score</div>
                  </div>
                  <div className="w-px h-12 bg-slate-100" />
                  <div className="text-center">
                    <div className="text-5xl font-black text-emerald-500 mb-1">A+</div>
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Grade</div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-4 justify-center">
                  <button 
                    onClick={() => setQuizScore(null)}
                    className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Back to Quizzes
                  </button>
                  <button 
                    onClick={() => { setQuizScore(null); setActiveTab('dashboard'); }}
                    className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                  >
                    View Skill Matrix
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {activeTab === 'questions' && (!currentUser || isStudent) && (
          <div className="max-w-4xl mx-auto space-y-10">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-bold">
                <Bot className="w-4 h-4" />
                <span>AI Support</span>
              </div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Instant Knowledge Base</h2>
              <p className="text-slate-600 max-w-xl mx-auto">Ask any complex STEM or ICT question and get detailed, verified answers from our AI engine.</p>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600" />
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Select Subject</label>
                    <div className="flex flex-wrap gap-2">
                      {STEM_SUBJECTS.map(s => (
                        <button 
                          key={s}
                          onClick={() => setNewQuestion({...newQuestion, subject: s})}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                            newQuestion.subject === s 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Your Question</label>
                    <textarea 
                      placeholder="e.g., Explain the concept of Quantum Entanglement in simple terms..."
                      value={newQuestion.text}
                      onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                      className="w-full h-40 p-6 rounded-[2rem] border border-slate-100 bg-slate-50/50 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none font-medium text-slate-700 transition-all"
                    />
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleAskQuestion}
                disabled={isAsking || !newQuestion.text}
                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              >
                {isAsking ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analyzing Question...
                  </>
                ) : (
                  <>
                    Ask AI Assistant <Send className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            <div className="space-y-8">
              <h3 className="text-2xl font-black text-slate-900 ml-2">Recent Inquiries</h3>
              {questions.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                  <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">No questions asked yet. Be the first!</p>
                </div>
              ) : (
                <div className="grid gap-8">
                  {questions.map(q => (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={q.id} 
                      className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all"
                    >
                      <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                              {q.subject.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-black text-indigo-600 uppercase tracking-widest">{q.subject}</span>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(q.timestamp).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Answered
                          </div>
                        </div>
                        <p className="text-xl font-bold text-slate-800 leading-tight">{q.text}</p>
                      </div>
                      <div className="p-8 bg-white">
                        <div className="flex gap-5">
                          <div className="bg-indigo-50 p-3 rounded-2xl h-fit shrink-0">
                            <Bot className="text-indigo-600 w-6 h-6" />
                          </div>
                          <div className="markdown-body prose prose-slate max-w-none">
                            <Markdown>{q.answer}</Markdown>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'register' && !currentUser && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold">Tutor Registration</h2>
              <p className="text-slate-600">Join our elite network of STEM & ICT educators.</p>
            </div>

            <form onSubmit={handleRegister} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">First Name</label>
                  <input
                    required
                    type="text"
                    value={regData.firstName}
                    onChange={e => setRegData({...regData, firstName: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. John"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Last Name</label>
                  <input
                    required
                    type="text"
                    value={regData.lastName}
                    onChange={e => setRegData({...regData, lastName: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Doe"
                  />
                </div>
              </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email Address</label>
                  <input
                    required
                    type="email"
                    value={regData.email}
                    onChange={e => setRegData({...regData, email: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="john@example.com"
                  />
                </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Education Details</label>
                <textarea
                  required
                  value={regData.education}
                  onChange={e => setRegData({...regData, education: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 h-24"
                  placeholder="e.g. BSc in Computer Science, University of Colombo"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Subjects (STEM/ICT Only)</label>
                <div className="flex flex-wrap gap-2">
                  {STEM_SUBJECTS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        const newSubs = regData.subjects.includes(s)
                          ? regData.subjects.filter(x => x !== s)
                          : [...regData.subjects, s];
                        setRegData({...regData, subjects: newSubs});
                      }}
                      className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                        regData.subjects.includes(s)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Teaching Level</label>
                <select
                  value={regData.teachingLevel}
                  onChange={e => setRegData({...regData, teachingLevel: e.target.value as any})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="School">School</option>
                  <option value="University">University</option>
                  <option value="Both">Both</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isValidating}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                {isValidating ? 'Validating Qualifications...' : 'Submit Application'}
              </button>

              {validationResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-2xl border ${validationResult.isValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {validationResult.isValid ? <CheckCircle className="w-5 h-5" /> : <X className="w-5 h-5" />}
                    {validationResult.isValid ? 'Validation Successful' : 'Validation Failed'}
                  </div>
                  <p className="text-sm opacity-90">{validationResult.reason}</p>
                </motion.div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'register' && isTutor && currentUser && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold">My Profile</h2>
              <p className="text-slate-600">Manage your account settings and profile information.</p>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-6 mb-8">
                <div className="relative">
                  {currentUser.avatar ? (
                    <img
                      src={`${currentUser.avatar}?t=${Date.now()}`}
                      alt="Avatar"
                      className="w-20 h-20 rounded-3xl object-cover shadow-xl shadow-indigo-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200" style={{ display: currentUser.avatar ? 'none' : 'flex' }}>
                    {(currentUser.firstName + ' ' + currentUser.lastName).charAt(0)}
                  </div>
                  <button
                    onClick={() => setShowImageModal(true)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                    title="Edit Profile Picture"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{currentUser.firstName} {currentUser.lastName}</h3>
                  <p className="text-slate-500 font-medium">{currentUser.email}</p>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">{currentUser.role}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={e => setProfileData({...profileData, firstName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={e => setProfileData({...profileData, lastName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={e => setProfileData({...profileData, phone: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    placeholder="+94 77 123 4567"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={currentUser.email}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 font-medium cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-400">Email cannot be changed. Contact support if needed.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Role</label>
                  <input
                    type="text"
                    value={currentUser.role}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 font-medium cursor-not-allowed capitalize"
                  />
                  <p className="text-xs text-slate-400">Role is assigned during registration.</p>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && currentUser && isTutor && (
          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tutor Workspace</h2>
              <p className="text-slate-500 mt-2">Manage your profile, subjects, schedule, bookings, feedback, and learning content.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                <button onClick={() => setActiveTab('register')} className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                  <p className="font-black text-slate-900">Profile & Qualifications</p>
                  <p className="text-xs text-slate-500 mt-1">Update tutor profile details</p>
                </button>
                <button onClick={() => setActiveTab('settings')} className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                  <p className="font-black text-slate-900">Subjects & Time Slots</p>
                  <p className="text-xs text-slate-500 mt-1">Manage subjects and availability</p>
                </button>
                <button onClick={() => setActiveTab('courses')} className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                  <p className="font-black text-slate-900">Course Management</p>
                  <p className="text-xs text-slate-500 mt-1">Upload and manage tutor courses</p>
                </button>
                <button onClick={() => setActiveTab('resources')} className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                  <p className="font-black text-slate-900">Resource Management</p>
                  <p className="text-xs text-slate-500 mt-1">Upload and manage free resources</p>
                </button>
                <button
                  onClick={async () => {
                    const feedback = await localService.getSessionFeedback('Tutoring Performance', 'Advanced');
                    alert(`Performance Summary:\n\n${feedback}`);
                  }}
                  className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                >
                  <p className="font-black text-slate-900">Feedback & Performance</p>
                  <p className="text-xs text-slate-500 mt-1">View learner sentiment and AI insights</p>
                </button>
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
                  className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all"
                >
                  <p className="font-black text-slate-900">Session Link Sharing</p>
                  <p className="text-xs text-slate-500 mt-1">Copy and share current meeting links</p>
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-xl text-slate-900 mb-4">Booking Management & History</h3>
                {bookings.length === 0 ? (
                  <p className="text-slate-500">No student bookings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map(booking => (
                      <div key={booking.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{booking.subject}</p>
                          <p className="text-xs text-slate-500">{booking.date} • {booking.status}</p>
                        </div>
                        <a href={booking.meetingLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-xs font-bold hover:underline">
                          Open Link
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-xl text-slate-900 mb-4">Tutor Performance Snapshot</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Sessions</p>
                    <p className="text-3xl font-black text-slate-900">{bookings.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reviews</p>
                    <p className="text-3xl font-black text-slate-900">{reviews.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && currentUser && isStudent && (
          <div className="space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-6">
                <div className="relative">
                  {currentUser.avatar ? (
                    <img 
                      src={`${currentUser.avatar}?t=${Date.now()}`} 
                      alt={`${currentUser.firstName} ${currentUser.lastName}`} 
                      className="w-20 h-20 rounded-3xl object-cover shadow-xl shadow-indigo-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200" style={{ display: currentUser.avatar ? 'none' : 'flex' }}>
                    {(currentUser.firstName + ' ' + currentUser.lastName).charAt(0)}
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back, {currentUser.firstName} {currentUser.lastName}!</h2>
                  <p className="text-slate-500 font-medium">You've completed <span className="text-indigo-600 font-bold">85%</span> of your weekly goals. Keep it up!</p>
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button 
                  onClick={() => setActiveTab('quizzes')}
                  className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  New Assessment
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-10">
              {/* Left Column: Stats & Skills */}
              <div className="lg:col-span-2 space-y-10">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-50/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16" />
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200">
                          <Award className="text-white w-6 h-6" />
                        </div>
                        <h3 className="font-black text-xl text-slate-900">Skill Matrix</h3>
                      </div>
                    </div>
                    <div className="space-y-8 relative z-10">
                      {skills.map((skill, idx) => {
                        const colors = [
                          'from-blue-500 to-indigo-500',
                          'from-purple-500 to-violet-500',
                          'from-emerald-500 to-teal-500'
                        ];
                        return (
                          <div key={skill.subject} className="group">
                            <div className="flex justify-between text-sm font-black mb-3">
                              <span className="text-slate-700 group-hover:text-indigo-600 transition-colors">{skill.subject}</span>
                              <span className="text-indigo-600">{skill.level} • {skill.progress}%</span>
                            </div>
                            <div className="h-4 bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-0.5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${skill.progress}%` }}
                                transition={{ duration: 1.5, delay: idx * 0.1, ease: "circOut" }}
                                className={`h-full bg-gradient-to-r ${colors[idx % colors.length]} rounded-full shadow-lg`} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-emerald-50/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16" />
                    <div className="flex items-center gap-4 mb-10 relative z-10">
                      <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-200">
                        <Calendar className="text-white w-6 h-6" />
                      </div>
                      <h3 className="font-black text-xl text-slate-900">Learning Activity</h3>
                    </div>
                    <div className="text-center py-6 relative z-10">
                      <div className="text-7xl font-black text-slate-900 tracking-tighter mb-2">12.5</div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Hours Completed This Week</p>
                    </div>
                    <div className="pt-8 relative z-10">
                      <button 
                        onClick={handleGenerateStudyPlan}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2"
                      >
                        <Bot className="w-5 h-5" /> Update Study Plan
                      </button>
                    </div>
                  </div>
                </div>

                {/* Adaptive Study Plan */}
                <AnimatePresence>
                  {studyPlan && (
                    <motion.div 
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-900 text-white p-10 md:p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] -mr-48 -mt-48" />
                      <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />
                      
                      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                        <div className="flex items-center gap-5">
                          <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/10">
                            <Bot className="text-indigo-400 w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="font-black text-3xl tracking-tight">Adaptive Study Plan</h3>
                            <p className="text-indigo-300 font-medium">AI-optimized learning path for your goals.</p>
                          </div>
                        </div>
                        <div className="px-4 py-2 bg-indigo-500/20 rounded-full border border-indigo-500/30 text-xs font-black uppercase tracking-widest text-indigo-300">
                          Updated Today
                        </div>
                      </div>

                      <div className="relative z-10 grid md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                          <h4 className="font-black text-indigo-300 uppercase text-xs tracking-widest flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" /> Smart Recommendations
                          </h4>
                          <div className="space-y-4">
                            {studyPlan.recommendations.map((rec, i) => (
                              <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                                key={i} 
                                className="flex items-start gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors group"
                              >
                                <div className="bg-emerald-500/20 p-1 rounded-lg mt-0.5 group-hover:bg-emerald-500 transition-colors">
                                  <Check className="w-4 h-4 text-emerald-400 group-hover:text-white" />
                                </div>
                                <span className="text-indigo-50 font-medium leading-relaxed">{rec}</span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-8">
                          <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-sm">
                            <h4 className="font-black text-indigo-300 uppercase text-[10px] tracking-widest mb-6">Next Major Milestone</h4>
                            <div className="space-y-6">
                              <div className="flex justify-between items-end">
                                <div>
                                  <p className="text-2xl font-black text-white">Advanced Calculus</p>
                                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Mathematics Track</p>
                                </div>
                                <div className="text-right">
                                  <span className="text-3xl font-black text-indigo-400">75%</span>
                                </div>
                              </div>
                              <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: '75%' }}
                                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full shadow-lg shadow-indigo-500/20"
                                />
                              </div>
                              <button className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-sm hover:bg-indigo-400 hover:text-white transition-all">
                                Continue Learning
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Courses & Certificates */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-xl text-slate-900">My Enrolled Courses</h3>
                    <button onClick={() => setActiveTab('courses')} className="text-indigo-600 text-sm font-black uppercase tracking-widest hover:underline">Browse More</button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    {userCourses.length === 0 ? (
                      <div className="col-span-2 text-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                        <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No courses enrolled yet</p>
                      </div>
                    ) : (
                      courses.filter(c => userCourses.includes(c.id)).map(course => (
                        <div key={course.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:shadow-md transition-all">
                              <BookMarked className="text-indigo-600 w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 leading-tight">{course.title}</h4>
                              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">Progress: 100% Complete</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => alert('Downloading certificate...')}
                            className="w-full bg-white text-slate-900 border border-slate-200 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2"
                          >
                            <Award className="w-4 h-4 text-amber-500" /> Download Certificate
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Bookings List */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-xl text-slate-900">My Booked Sessions</h3>
                    <Calendar className="w-5 h-5 text-slate-400" />
                  </div>
                  {bookings.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No sessions booked yet</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {bookings.map(booking => (
                        <div key={booking.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-6 hover:border-indigo-200 transition-all group">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group-hover:shadow-md transition-all">
                                <Video className="text-indigo-600 w-6 h-6" />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 text-lg leading-tight">{booking.subject} Session</h4>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{booking.date}</p>
                                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{booking.status}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button 
                                onClick={async () => {
                                  const feedback = await localService.getSessionFeedback(booking.subject, 'Intermediate');
                                  alert(`AI Learning Assistant:\n\n${feedback}`);
                                }}
                                className="bg-white text-indigo-600 border border-indigo-100 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                              >
                                <Bot className="w-3.5 h-3.5" /> AI Feedback
                              </button>
                              <button 
                                onClick={() => {
                                  const comment = prompt('Enter your review:');
                                  const rating = parseInt(prompt('Enter rating (1-5):') || '5');
                                  if (comment && rating) handleAddReview(booking.tutorId, rating, comment);
                                }}
                                className="bg-white text-amber-600 border border-amber-100 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 hover:text-white transition-all flex items-center gap-2 shadow-sm"
                              >
                                <Star className="w-3.5 h-3.5" /> Review
                              </button>
                              <a 
                                href={booking.meetingLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
                              >
                                Join Meeting <ArrowRight className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Profile & Quick Actions */}
              <div className="space-y-10">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-indigo-50/30 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-10" />
                  <div className="relative z-10">
                    {currentUser.avatar ? (
                      <img 
                        src={`${currentUser.avatar}?t=${Date.now()}`} 
                        alt="Avatar" 
                        className="w-28 h-28 rounded-[2rem] mx-auto mb-6 border-4 border-white shadow-2xl object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                        }}
                      />
                    ) : null}
                    <img 
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.firstName + ' ' + currentUser.lastName}`} 
                      alt="Avatar" 
                      className="w-28 h-28 rounded-[2rem] mx-auto mb-6 border-4 border-white shadow-2xl object-cover" 
                      style={{ display: currentUser.avatar ? 'none' : 'block' }}
                    />
                    <h3 className="font-black text-2xl text-slate-900 tracking-tight">{currentUser.firstName} {currentUser.lastName}</h3>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">{currentUser.email}</p>
                    
                    <div className="flex justify-center gap-8 mt-10 pt-8 border-t border-slate-50">
                      <div className="text-center">
                        <p className="text-2xl font-black text-slate-900">12</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Sessions</p>
                      </div>
                      <div className="w-px h-10 bg-slate-100 self-center" />
                      <div className="text-center">
                        <p className="text-2xl font-black text-slate-900">4</p>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Courses</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-xl text-slate-900 mb-8">Quick Actions</h3>
                  <div className="grid gap-3">
                    <button onClick={() => setActiveTab('tutors')} className="w-full text-left p-5 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-50 hover:border-indigo-100 transition-all flex items-center gap-4 group">
                      <div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                        <Search className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">Book Session</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Find expert tutors</p>
                      </div>
                    </button>
                    <button onClick={() => setActiveTab('questions')} className="w-full text-left p-5 rounded-2xl bg-slate-50 hover:bg-violet-50 border border-slate-50 hover:border-violet-100 transition-all flex items-center gap-4 group">
                      <div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                        <MessageSquare className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">Ask AI Tutor</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instant STEM answers</p>
                      </div>
                    </button>
                    <button onClick={() => setActiveTab('quizzes')} className="w-full text-left p-5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-50 hover:border-emerald-100 transition-all flex items-center gap-4 group">
                      <div className="bg-white p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                        <Award className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">Take Quiz</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Test your knowledge</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && currentUser && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-black text-slate-900 tracking-tight">Account Settings</h2>
              <p className="text-slate-600">Manage your profile information and preferences.</p>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-xl space-y-8">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="relative">
                  {currentUser.avatar ? (
                    <img 
                      src={`${currentUser.avatar}?t=${Date.now()}`} 
                      alt="Avatar" 
                      className="w-24 h-24 rounded-3xl object-cover shadow-xl shadow-indigo-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-indigo-200" style={{ display: currentUser.avatar ? 'none' : 'flex' }}>
                    {(currentUser.firstName + ' ' + currentUser.lastName).charAt(0)}
                  </div>
                  <button 
                    onClick={() => setShowImageModal(true)}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
                    title="Edit Profile Picture"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{currentUser.firstName} {currentUser.lastName}</h3>
                  <p className="text-slate-500 font-medium">{currentUser.email}</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">First Name</label>
                    <input 
                      type="text" 
                      value={profileData.firstName}
                      onChange={e => setProfileData({...profileData, firstName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                      placeholder="Enter your first name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Last Name</label>
                    <input 
                      type="text" 
                      value={profileData.lastName}
                      onChange={e => setProfileData({...profileData, lastName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                      placeholder="Enter your last name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Phone Number (Optional)</label>
                  <input 
                    type="tel" 
                    value={profileData.phone}
                    onChange={e => setProfileData({...profileData, phone: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                    placeholder="+94 77 123 4567"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email Address</label>
                  <input 
                    type="email" 
                    value={currentUser.email}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 font-medium cursor-not-allowed" 
                  />
                  <p className="text-xs text-slate-400">Email cannot be changed. Contact support if needed.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Role</label>
                  <input 
                    type="text" 
                    value={currentUser.role}
                    disabled
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-500 font-medium cursor-not-allowed capitalize" 
                  />
                  <p className="text-xs text-slate-400">Role is assigned during registration.</p>
                </div>

                <button 
                  type="submit"
                  disabled={isUpdatingProfile}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                  {isUpdatingProfile ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating Profile...
                    </>
                  ) : (
                    <>
                      Save Changes <Check className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAuthModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-sm sm:max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-4xl rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              {/* Left Side - Branding/Visual */}
              <div className="hidden md:flex md:w-4/12 lg:w-5/12 bg-indigo-600 p-6 sm:p-7 md:p-8 flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />
                
                <div className="relative z-10">
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-2 mb-8"
                  >
                    <div className="bg-white p-2.5 rounded-2xl shadow-lg shadow-indigo-900/20">
                      <GraduationCap className="text-indigo-600 w-7 h-7" />
                    </div>
                    <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">TutorSphere</span>
                  </motion.div>
                  
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <h3 className="text-2xl sm:text-3xl lg:text-3xl font-bold text-white leading-tight mb-4 sm:mb-5">
                      {authMode === 'login' ? 'Welcome back to your learning journey.' : 'Start your journey with the best STEM tutors.'}
                    </h3>
                    <p className="text-indigo-100/80 text-sm sm:text-base leading-relaxed font-medium">
                      Access personalized learning paths, expert guidance, and AI-powered support all in one place.
                    </p>
                  </motion.div>
                </div>

                <div className="relative z-10 space-y-4">
                  {[
                    { icon: <CheckCircle className="w-5 h-5 text-indigo-300" />, text: 'Verified Expert Tutors' },
                    { icon: <Award className="w-5 h-5 text-indigo-300" />, text: 'Certified Learning Paths' },
                    { icon: <Bot className="w-5 h-5 text-indigo-300" />, text: 'AI-Powered Study Plans' }
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (idx * 0.1) }}
                      className="flex items-center gap-4 text-white/90"
                    >
                      <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                        {item.icon}
                      </div>
                      <span className="text-sm font-semibold tracking-wide">{item.text}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right Side - Form */}
              <div className="flex-1 p-4 sm:p-5 md:p-6 lg:p-7 bg-white relative">
                <button 
                  onClick={() => setShowAuthModal(false)} 
                  className="absolute top-4 right-4 sm:top-8 sm:right-8 p-2.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all hover:rotate-90"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="w-full max-w-xs sm:max-w-sm md:max-w-md mx-auto">
                  <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3 tracking-tight">
                      {authMode === 'login' ? 'Sign In' : 'Create Account'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                      {authMode === 'login' ? 'Enter your details to access your account.' : 'Join thousands of students mastering STEM today.'}
                    </p>
                  </div>

                  {/* Social Logins */}
                  <div className="grid grid-cols-1 gap-3 mb-6">
                    <button type="button" className="flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-sm text-slate-700">
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Google
                    </button>
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-4 text-slate-400 font-bold tracking-widest">Or continue with email</span>
                    </div>
                  </div>
                  
                  <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'signup' && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">First Name</label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            <input 
                              required
                              type="text" 
                              value={authData.firstName}
                              onChange={e => setAuthData({...authData, firstName: e.target.value})}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                              placeholder="John"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Last Name</label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                            <input 
                              required
                              type="text" 
                              value={authData.lastName}
                              onChange={e => setAuthData({...authData, lastName: e.target.value})}
                              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                              placeholder="Doe"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {authMode === 'signup' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">I am a</label>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setAuthData({...authData, role: 'student'})}
                            className={`flex-1 py-3 px-4 rounded-2xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
                              authData.role === 'student' 
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                                : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <GraduationCap className="w-5 h-5" />
                            Student
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthData({...authData, role: 'tutor'})}
                            className={`flex-1 py-3 px-4 rounded-2xl border-2 font-bold transition-all flex items-center justify-center gap-2 ${
                              authData.role === 'tutor' 
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                                : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <BookOpen className="w-5 h-5" />
                            Tutor
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                          required
                          type="email" 
                          value={authData.email}
                          onChange={e => setAuthData({...authData, email: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                          placeholder="name@example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                        {authMode === 'login' && (
                          <button type="button" className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider">Forgot Password?</button>
                        )}
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input 
                          required
                          type="password" 
                          value={authData.password}
                          onChange={e => setAuthData({...authData, password: e.target.value})}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    {authMode === 'login' && (
                      <div className="flex items-center gap-2 ml-1">
                        <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <label htmlFor="remember" className="text-xs text-slate-500 font-medium cursor-pointer">Remember me for 30 days</label>
                      </div>
                    )}
                    
                    <button 
                      type="submit" 
                      className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all mt-3 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {authMode === 'login' ? 'Sign In' : 'Create Account'}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </form>
                  
                  <div className="mt-10 text-center">
                    <p className="text-slate-500 text-sm font-medium">
                      {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                      <button 
                        onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                        className="ml-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                      >
                        {authMode === 'login' ? 'Create an account' : 'Sign in to account'}
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Upload Modal */}
      <AnimatePresence>
        {showImageModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImageModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-white rounded-[2rem] shadow-2xl max-w-md w-full mx-4 overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-slate-900">Edit Profile Picture</h3>
                  <button onClick={() => setShowImageModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {!selectedImage ? (
                  <div className="space-y-4">
                    <label className="block cursor-pointer">
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 group">
                        <div className="flex flex-col items-center space-y-4">
                          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                            <Camera className="w-8 h-8 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-lg font-bold text-slate-900">Upload Profile Picture</p>
                            <p className="text-sm text-slate-500 mt-1">Click to select a PNG or JPEG image</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="max-w-full overflow-hidden rounded-xl">
                      <ReactCrop
                        crop={crop}
                        onChange={setCrop}
                        onComplete={setCompletedCrop}
                        aspect={1}
                      >
                        <img
                          ref={cropImageRef}
                          src={selectedImage!}
                          alt="Crop preview"
                          className="max-w-full"
                        />
                      </ReactCrop>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setSelectedImage(null); setCompletedCrop(null); }}
                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                      >
                        Change Image
                      </button>
                      <button
                        onClick={handleSaveImage}
                        disabled={!completedCrop}
                        className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Chatbot Widget */}
      {canUseChatbot && (
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-80 md:w-96 h-[500px] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4"
            >
              <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  <span className="font-bold">TutorSphere Assistant</span>
                </div>
                <button onClick={() => setIsChatOpen(false)}><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm relative group ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-slate-100 text-slate-700 rounded-tl-none'
                    }`}>
                      {msg.text}
                      {msg.role === 'bot' && (
                        <button 
                          onClick={() => handleSpeak(msg.text, i)}
                          className={`absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity ${isSpeaking === i.toString() ? 'text-indigo-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleChatSubmit} className="p-4 border-t border-slate-100 flex gap-2">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Ask me anything..." 
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
                <button type="submit" className="bg-indigo-600 text-white p-2 rounded-xl">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all hover:scale-110"
        >
          {isChatOpen ? <X /> : <MessageSquare />}
        </button>
      </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-white mb-4">
                <GraduationCap className="w-6 h-6" />
                <span className="text-xl font-bold">TutorSphere</span>
              </div>
              <p className="max-w-xs">Connecting Sri Lankan students with verified STEM and ICT experts for a brighter academic future.</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => setActiveTab('tutors')}>Find Tutors</button></li>
                <li><button onClick={() => setActiveTab('questions')}>Q&A Support</button></li>
                <li><button onClick={() => setActiveTab('register')}>Become a Tutor</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li>support@tutorsphere.lk</li>
                <li>Colombo, Sri Lanka</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-center text-xs">
            © 2026 TutorSphere. All rights reserved. Built for Academic Excellence.
          </div>
        </div>
      </footer>
    </div>
  );
}
