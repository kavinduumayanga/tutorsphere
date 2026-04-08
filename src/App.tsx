/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  MapPin,
  Phone,
  User,
  GraduationCap,
  CheckCircle,
  X,
  Video,
  Star,
  Clock,
  Play,
  Users,
  ArrowRight,
  Send,
  Download,
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
  Calculator,
  Link as LinkIcon,
  MessageCircle,
  Wallet
} from 'lucide-react';
import Markdown from 'react-markdown';
import CountUp from 'react-countup';
import { localService } from './services/localService';
import { apiService } from './services/apiService';
import { formatLkr } from './utils/currency';

import { Tutor, User as AppUser, Question, Booking, Course, Resource, SkillLevel, StudyPlan, Review, Quiz, TimeSlot, CourseEnrollment, CourseCoupon, WithdrawalRequest, WithdrawalSummary } from './types';
import { TutorProfilePage } from './components/pages/TutorProfilePage';
import { GetStartedSection } from "./components/pages/GetStartedSection";
import { TutorBookingPage } from './components/pages/TutorBookingPage';
import { MOCK_TUTORS, MOCK_COURSES, MOCK_RESOURCES } from './data/mockData';
import { ALLOWED_TUTOR_SUBJECTS } from './data/tutorSubjects';
import { RegistrationSelectionPage } from './components/pages/RegistrationSelectionPage';
import { AboutPage } from './components/pages/AboutPage';
import { TutorAvailabilityManagePage } from './components/pages/TutorAvailabilityManagePage';
import { CourseBrowsingPage } from './components/pages/CourseBrowsingPage';
import { TutorCourseManagePage } from './components/pages/TutorCourseManagePage';
import { TutorResourceManagePage } from './components/pages/TutorResourceManagePage';
import { StudentResourceLibraryPage } from './components/pages/StudentResourceLibraryPage';
import { ToastProvider } from './components/common/Toast';
import { QuizChatbotPage } from './components/pages/QuizChatbotPage';
import { FindTutorsPage } from './components/pages/FindTutorsPage';
import { CertificateModal } from './components/common/CertificateModal';
import { ForgotPasswordPage } from './components/pages/ForgotPasswordPage';

const STEM_SUBJECTS: string[] = [...ALLOWED_TUTOR_SUBJECTS];

type Tab = 'home' | 'tutors' | 'questions' | 'manageAvailability' | 'courses' | 'courseLearning' | 'resources' | 'quizzes' | 'registerSelect' | 'registerStudent' | 'registerTutor' | 'forgotPassword' | 'register' | 'dashboard' | 'earnings' | 'settings' | 'tutorProfile' | 'tutorBooking' | 'about';

const NAV_LABELS: Record<Tab, string> = {
  home: 'Home',
  tutors: 'Find Tutors',
  questions: 'Q&A',
  manageAvailability: 'Manage Availability',
  courses: 'Courses',
  courseLearning: 'Course Learning',
  resources: 'Resources',
  quizzes: 'Quizzes',
  registerSelect: 'Register',
  registerStudent: 'Register',
  registerTutor: 'Register',
  forgotPassword: 'Forgot Password',
  register: 'Profile',
  dashboard: 'Dashboard',
  earnings: 'Earnings',
  settings: 'Settings',
  tutorProfile: 'Tutor Profile',
  tutorBooking: 'Book Session',
  about: 'About Us'
};

const isInternalTab = (tab: Tab) => tab === 'tutorProfile' || tab === 'tutorBooking' || tab === 'courseLearning';

const getAllowedTabs = (user: AppUser | null): Tab[] => {
  if (!user) {
    return [
      'home',
      'tutors',
      'courses',
      'resources',
      'quizzes',
      'registerSelect',
      'registerStudent',
      'registerTutor',
      'forgotPassword',
      'about'
    ];
  }

  if (user.role === 'student') {
    return ['home', 'tutors', 'questions', 'courses', 'resources', 'quizzes', 'dashboard', 'settings', 'about'];
  }

  if (user.role === 'tutor') {
    return ['home', 'dashboard', 'earnings', 'manageAvailability', 'register', 'courses', 'resources', 'quizzes', 'settings', 'about'];
  }

  return ['home', 'about'];
};

const canAccessTab = (tab: Tab, user: AppUser | null) => getAllowedTabs(user).includes(tab);

const getTutorDisplayName = (tutor: Tutor & { name?: string }) => {
  const firstName = tutor.firstName?.trim();
  const lastName = tutor.lastName?.trim();

  if (firstName || lastName) {
    return `${firstName || ''} ${lastName || ''}`.trim();
  }

  return tutor.name?.trim() || 'Tutor';
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const createDraftId = () => Math.random().toString(36).slice(2, 11);

type EditableCourseModuleResource = {
  id: string;
  name: string;
  url: string;
};

const getResourceNameFromUrl = (value: string, fallback = 'Resource'): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const fileName = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
      if (fileName) {
        return fileName;
      }
    }
  } catch {
    // Fallback to path parsing for non-URL values.
  }

  const fileName = decodeURIComponent(trimmed.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '');
  return fileName || fallback;
};

const normalizeEditableModuleResources = (resources: unknown): EditableCourseModuleResource[] => {
  if (!Array.isArray(resources)) {
    return [];
  }

  return resources
    .map((resource: any, index) => {
      if (typeof resource === 'string') {
        const value = resource.trim();
        if (!value) {
          return null;
        }

        return {
          id: createDraftId(),
          name: getResourceNameFromUrl(value, `Resource ${index + 1}`),
          url: value,
        };
      }

      const url = String(resource?.url ?? resource?.path ?? '').trim();
      if (!url) {
        return null;
      }

      return {
        id: createDraftId(),
        name: String(resource?.name ?? '').trim() || getResourceNameFromUrl(url, `Resource ${index + 1}`),
        url,
      };
    })
    .filter((resource): resource is EditableCourseModuleResource => Boolean(resource));
};

type EditableCourseModule = {
  id?: string;
  title: string;
  videoUrl: string;
  resources: EditableCourseModuleResource[];
  resourceNameInput: string;
  resourceUrlInput: string;
};

const createEmptyEditableModule = (): EditableCourseModule => ({
  title: '',
  videoUrl: '',
  resources: [],
  resourceNameInput: '',
  resourceUrlInput: '',
});

const createInitialCourseForm = () => ({
  title: '',
  subject: 'Maths',
  description: '',
  isFree: false,
  price: 0,
  thumbnail: '',
  modules: [createEmptyEditableModule()],
});

const createInitialResourceForm = () => ({
  title: '',
  subject: 'Maths',
  type: 'Paper' as Resource['type'],
  url: '',
  description: '',
});

type ResourceInputMode = 'url' | 'file';
type ResourceUploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';
type SessionPersistenceMode = 'session' | 'remember';
type BookingStatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
type SessionTimelineFilter = 'all' | 'upcoming' | 'past';

type SessionRatingDraft = {
  rating: number;
  feedback: string;
};

type TutorTransactionStatus = 'paid' | 'pending' | 'refunded_or_cancelled';
type TutorTransactionPaymentType = 'session booking' | 'course purchase';
type TutorTransactionFilter = 'all' | 'paid' | 'pending' | 'refunded_or_cancelled';
type TutorTransactionSortOrder = 'newest' | 'oldest';

type TutorTransactionItem = {
  id: string;
  timestamp: number;
  dateLabel: string;
  itemName: string;
  studentName: string;
  paymentType: TutorTransactionPaymentType;
  amount: number;
  platformFee: number;
  netEarning: number;
  status: TutorTransactionStatus;
  paymentReference?: string;
};

type CourseCheckoutSubmission = {
  paymentReference?: string;
  couponCode?: string;
};

const isUploadedResourcePath = (value: string): boolean => value.trim().startsWith('/uploads/');
const SESSION_STORAGE_KEY = 'session';
const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const PLATFORM_FEE_RATE = 0.12;

type PersistedSession = {
  user: AppUser;
  activeTab: Tab;
  expiresAt?: number;
};

const parseStoredSession = (rawValue: string | null): PersistedSession | null => {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== 'object' || !parsed.user) {
      return null;
    }

    return {
      user: parsed.user as AppUser,
      activeTab: (parsed.activeTab as Tab) || 'home',
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : undefined,
    };
  } catch {
    return null;
  }
};

const clearStoredSessions = (): void => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
};

const loadStoredSession = (): { session: PersistedSession; persistence: SessionPersistenceMode } | null => {
  const sessionStorageValue = parseStoredSession(sessionStorage.getItem(SESSION_STORAGE_KEY));
  if (sessionStorageValue) {
    return { session: sessionStorageValue, persistence: 'session' };
  }

  if (sessionStorage.getItem(SESSION_STORAGE_KEY)) {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }

  const rememberedSession = parseStoredSession(localStorage.getItem(SESSION_STORAGE_KEY));
  if (!rememberedSession) {
    if (localStorage.getItem(SESSION_STORAGE_KEY)) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    return null;
  }

  if (typeof rememberedSession.expiresAt === 'number' && rememberedSession.expiresAt <= Date.now()) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }

  return { session: rememberedSession, persistence: 'remember' };
};

const persistSession = (session: PersistedSession, persistence: SessionPersistenceMode): void => {
  if (persistence === 'remember') {
    const nextExpiresAt =
      typeof session.expiresAt === 'number' && session.expiresAt > Date.now()
        ? session.expiresAt
        : Date.now() + REMEMBER_ME_DURATION_MS;

    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        user: session.user,
        activeTab: session.activeTab,
        expiresAt: nextExpiresAt,
      })
    );
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      user: session.user,
      activeTab: session.activeTab,
    })
  );
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

const sanitizePhoneInput = (value: string): string => {
  const compact = value.replace(/[\s()-]/g, '');
  if (!compact) {
    return '';
  }

  const normalizedCharacters = compact.replace(/[^\d+]/g, '');
  if (normalizedCharacters.startsWith('+')) {
    return `+${normalizedCharacters.slice(1).replace(/\+/g, '')}`;
  }

  return normalizedCharacters.replace(/\+/g, '');
};

const normalizeSriLankanPhone = (value: string): string | null => {
  const sanitized = sanitizePhoneInput(value);
  if (!sanitized) {
    return null;
  }

  const digitsOnly = sanitized.replace(/\D/g, '');

  if (digitsOnly.length === 9) {
    return `+94${digitsOnly}`;
  }

  if (digitsOnly.length === 10 && digitsOnly.startsWith('0')) {
    return `+94${digitsOnly.slice(1)}`;
  }

  if (digitsOnly.length === 11 && digitsOnly.startsWith('94')) {
    return `+${digitsOnly}`;
  }

  return null;
};

export default function App() {
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [viewingTutorId, setViewingTutorId] = useState<string | null>(null);
  const [bookingTutorId, setBookingTutorId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authData, setAuthData] = useState({ email: '', password: '', firstName: '', lastName: '', confirmPassword: '', role: 'student' as 'student' | 'tutor' });
  const [rememberMe, setRememberMe] = useState(false);
  const [sessionPersistence, setSessionPersistence] = useState<SessionPersistenceMode>('session');
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const [showChangePasswordPanel, setShowChangePasswordPanel] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Profile Update State
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    education: '',
    subjects: [] as string[],
    teachingLevel: '',
    pricePerHour: 0,
    bio: ''
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [activeBookingActionId, setActiveBookingActionId] = useState<string | null>(null);
  const [tutorBookingStatusFilter, setTutorBookingStatusFilter] = useState<BookingStatusFilter>('all');
  const [studentBookingStatusFilter, setStudentBookingStatusFilter] = useState<BookingStatusFilter>('all');
  const [tutorSessionTimelineFilter, setTutorSessionTimelineFilter] = useState<SessionTimelineFilter>('all');
  const [studentSessionTimelineFilter, setStudentSessionTimelineFilter] = useState<SessionTimelineFilter>('all');
  const [sessionRatingDrafts, setSessionRatingDrafts] = useState<Record<string, SessionRatingDraft>>({});
  const [activeRatingActionBookingId, setActiveRatingActionBookingId] = useState<string | null>(null);
  const [tutorTransactionFilter, setTutorTransactionFilter] = useState<TutorTransactionFilter>('all');
  const [tutorTransactionSortOrder, setTutorTransactionSortOrder] = useState<TutorTransactionSortOrder>('newest');
  const [bookingCancelNotice, setBookingCancelNotice] = useState<string | null>(null);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [withdrawalSummary, setWithdrawalSummary] = useState<WithdrawalSummary>({
    totalEarnings: 0,
    withdrawnAmount: 0,
    pendingWithdrawalAmount: 0,
    availableBalance: 0,
  });
  const [isLoadingWithdrawalData, setIsLoadingWithdrawalData] = useState(false);
  const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
  const [isSubmittingWithdrawal, setIsSubmittingWithdrawal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    payoutMethodType: 'bank_transfer' as WithdrawalRequest['payoutMethodType'],
    bankAccountHolder: '',
    bankName: '',
    bankBranch: '',
    bankAccountNumber: '',
    paypalEmail: '',
  });
  const [withdrawalNotice, setWithdrawalNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [bankTransferEtaNotice, setBankTransferEtaNotice] = useState<string | null>(null);

  // Courses browsing state
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState('All Categories');

  // Subject Cycling State
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);

  // Image Upload Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const cropImageRef = useRef<HTMLImageElement | null>(null);

  const [certificateModalData, setCertificateModalData] = useState<{ enrollment: CourseEnrollment, courseTitle: string } | null>(null);

  // Load user and activeTab from persisted storage on app start
  useEffect(() => {
    const storedSession = loadStoredSession();
    if (storedSession) {
      setCurrentUser(storedSession.session.user);
      const restoredTab: Tab = storedSession.session.activeTab || 'home';
      setActiveTab(isInternalTab(restoredTab) ? 'home' : restoredTab);
      setSessionPersistence(storedSession.persistence);
    }

    setHasLoadedSession(true);
  }, []);

  // Persist session when user, tab, or persistence mode changes
  useEffect(() => {
    if (!hasLoadedSession || !currentUser) {
      return;
    }

    const existingRememberedSession =
      sessionPersistence === 'remember'
        ? parseStoredSession(localStorage.getItem(SESSION_STORAGE_KEY))
        : null;

    persistSession(
      {
        user: currentUser,
        activeTab,
        expiresAt: existingRememberedSession?.expiresAt,
      },
      sessionPersistence
    );
  }, [currentUser, activeTab, sessionPersistence, hasLoadedSession]);

  useEffect(() => {
    if (activeTab === 'tutorProfile' && !viewingTutorId) {
      setActiveTab('tutors');
      return;
    }

    if (activeTab === 'tutorBooking' && !bookingTutorId) {
      setActiveTab('tutors');
      return;
    }

    // Internal detail views are controlled by their ID guards above and
    // intentionally excluded from top-level navigation permissions.
    if (isInternalTab(activeTab)) {
      return;
    }

    if (canAccessTab(activeTab, currentUser)) {
      return;
    }
    setActiveTab(currentUser ? 'dashboard' : 'home');
  }, [activeTab, currentUser, viewingTutorId, bookingTutorId]);

  useEffect(() => {
    if (activeTab === 'registerSelect' || activeTab === 'registerStudent' || activeTab === 'registerTutor' || activeTab === 'forgotPassword') {
      setShowAuthModal(false);
      setAuthMode('login');
    }
  }, [activeTab]);

  useEffect(() => {
    if (!bookingCancelNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setBookingCancelNotice(null);
    }, 6500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bookingCancelNotice]);

  useEffect(() => {
    if (!withdrawalNotice) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setWithdrawalNotice(null);
    }, 5500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [withdrawalNotice]);

  // Cycle through subjects for live session animation
  const DISPLAY_SUBJECTS = ['Science', 'Technology', 'Engineering', 'Mathematics', 'ICT'];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSubjectIndex((prevIndex) => (prevIndex + 1) % DISPLAY_SUBJECTS.length);
    }, 3000); // Change every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Registration State
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    education: '',
    subjects: [] as string[],
    teachingLevel: 'School' as 'School' | 'University' | 'School and University',
    bio: ''
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean, reason: string } | null>(null);

  // Question State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState({ text: '', subject: 'Mathematics' });
  const [isAsking, setIsAsking] = useState(false);

  // Booking State
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [userCourses, setUserCourses] = useState<string[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollment[]>([]);
  const [courseForm, setCourseForm] = useState(createInitialCourseForm);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isUploadingCourseThumbnail, setIsUploadingCourseThumbnail] = useState(false);
  const [uploadingModuleVideoKey, setUploadingModuleVideoKey] = useState<string | null>(null);
  const [uploadingModuleResourcesKey, setUploadingModuleResourcesKey] = useState<string | null>(null);
  const [resourceForm, setResourceForm] = useState(createInitialResourceForm);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [resourceInputMode, setResourceInputMode] = useState<ResourceInputMode>('url');
  const [resourceUploadFile, setResourceUploadFile] = useState<File | null>(null);
  const [isUploadingResourceFile, setIsUploadingResourceFile] = useState(false);
  const [resourceUploadStatus, setResourceUploadStatus] = useState<ResourceUploadStatus>('idle');
  const [resourceUploadProgress, setResourceUploadProgress] = useState(0);
  const [resourceUploadStatusMessage, setResourceUploadStatusMessage] = useState('');
  const [activeLearningCourseId, setActiveLearningCourseId] = useState<string | null>(null);
  const [activeVideoModuleId, setActiveVideoModuleId] = useState<string | null>(null);
  const [learningContentTab, setLearningContentTab] = useState<'overview' | 'notes' | 'resources' | 'qa'>('overview');
  const [bookmarkedModules, setBookmarkedModules] = useState<Set<string>>(new Set());
  const [playbackSpeed, setPlaybackSpeed] = useState<'0.75' | '1' | '1.25' | '1.5'>('1');
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [videoMuted, setVideoMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
  const [notesSaved, setNotesSaved] = useState<Record<string, boolean>>({});
  const [isLoadingUserData, setIsLoadingUserData] = useState(false);

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

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'bot', text: string, audio?: string, meta?: 'typing' | 'error' }[]>([
    { role: 'bot', text: 'Hello! I am your TutorSphere assistant. How can I help you today? You can ask me to find a tutor, suggest a course, or even start a quiz!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'courseLearning') {
      return;
    }

    if (!activeLearningCourseId) {
      setActiveTab('courses');
      return;
    }

    if (!currentUser || currentUser.role !== 'student') {
      setActiveTab(currentUser ? 'dashboard' : 'home');
      return;
    }

    if (isLoadingCourses || isLoadingUserData) {
      // Wait for async data before forcing tab redirects.
      return;
    }

    const hasSelectedCourse =
      courses.some((course) => course.id === activeLearningCourseId) ||
      MOCK_COURSES.some((course) => course.id === activeLearningCourseId);

    if (!hasSelectedCourse) {
      setActiveTab('courses');
      return;
    }

    const hasEnrollment = courseEnrollments.some(
      (enrollment) =>
        enrollment.courseId === activeLearningCourseId && enrollment.studentId === currentUser.id
    );

    const hasEnrollmentFallback =
      userCourses.includes(activeLearningCourseId) ||
      Boolean(
        courses
          .find((course) => course.id === activeLearningCourseId)
          ?.enrolledStudents?.includes(currentUser.id)
      );

    if (!hasEnrollment && !hasEnrollmentFallback) {
      setActiveTab('courses');
    }
  }, [
    activeTab,
    activeLearningCourseId,
    currentUser,
    courses,
    courseEnrollments,
    isLoadingCourses,
    isLoadingUserData,
    userCourses,
  ]);

  const tutorReviewStats = useMemo(() => {
    const aggregates = new Map<string, { sum: number; count: number }>();

    for (const review of allReviews) {
      const current = aggregates.get(review.tutorId) || { sum: 0, count: 0 };
      aggregates.set(review.tutorId, {
        sum: current.sum + review.rating,
        count: current.count + 1,
      });
    }

    const stats = new Map<string, { averageRating: number; reviewCount: number }>();
    aggregates.forEach((value, tutorId) => {
      stats.set(tutorId, {
        averageRating: Number((value.sum / value.count).toFixed(1)),
        reviewCount: value.count,
      });
    });

    return stats;
  }, [allReviews]);

  const tutorsWithLiveStats = useMemo(
    () =>
      tutors.map((tutor) => {
        const stats = tutorReviewStats.get(tutor.id);
        if (!stats) {
          return tutor;
        }
        return {
          ...tutor,
          rating: stats.averageRating,
          reviewCount: stats.reviewCount,
        };
      }),
    [tutors, tutorReviewStats]
  );

  const isStudent = currentUser?.role === 'student';
  const isTutor = currentUser?.role === 'tutor';
  const currentUserAvatarUrl = useMemo(() => {
    if (!currentUser?.avatar) {
      return null;
    }

    const separator = currentUser.avatar.includes('?') ? '&' : '?';
    return `${currentUser.avatar}${separator}t=${Date.now()}`;
  }, [currentUser]);
  const currentTutor = currentUser?.role === 'tutor'
    ? tutorsWithLiveStats.find((t) => t.id === currentUser.id || t.email === currentUser.email)
    : undefined;
  const currentTutorReviewCount = useMemo(() => {
    if (!currentTutor) return 0;
    const stats = tutorReviewStats.get(currentTutor.id);
    return stats?.reviewCount ?? currentTutor.reviewCount ?? 0;
  }, [currentTutor, tutorReviewStats]);
  const myTutorCourses = useMemo(
    () => (currentTutor ? courses.filter((course) => course.tutorId === currentTutor.id) : []),
    [courses, currentTutor]
  );
  const myTutorResources = useMemo(
    () => (currentTutor ? resources.filter((resource) => resource.tutorId === currentTutor.id) : []),
    [resources, currentTutor]
  );
  const studentEnrollmentByCourseId = useMemo(() => {
    if (!currentUser || currentUser.role !== 'student') {
      return new Map<string, CourseEnrollment>();
    }

    const enrollmentMap = new Map<string, CourseEnrollment>();
    for (const enrollment of courseEnrollments) {
      if (enrollment.studentId === currentUser.id) {
        enrollmentMap.set(enrollment.courseId, enrollment);
      }
    }
    return enrollmentMap;
  }, [courseEnrollments, currentUser]);
  const enrollmentCountByCourseId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const enrollment of courseEnrollments) {
      counts.set(enrollment.courseId, (counts.get(enrollment.courseId) || 0) + 1);
    }
    return counts;
  }, [courseEnrollments]);
  const discoverableResources = useMemo(
    () => resources.filter((resource) => resource.isFree),
    [resources]
  );
  const studentEnrolledCourses = useMemo(
    () =>
      courses
        .map((course) => ({ course, enrollment: studentEnrollmentByCourseId.get(course.id) }))
        .filter(
          (entry): entry is { course: Course; enrollment: CourseEnrollment } => Boolean(entry.enrollment)
        ),
    [courses, studentEnrollmentByCourseId]
  );
  const activeLearningCourse = useMemo(() => {
    if (!activeLearningCourseId) {
      return null;
    }

    const course =
      courses.find((course) => course.id === activeLearningCourseId) ||
      MOCK_COURSES.find((course) => course.id === activeLearningCourseId) ||
      null;

    if (!course && isLoadingCourses) {
      // Still loading, return null to show loading state
      return null;
    }
    return course;
  }, [courses, activeLearningCourseId, isLoadingCourses]);
  const activeLearningEnrollment = useMemo(() => {
    if (!activeLearningCourse) {
      return null;
    }
    return studentEnrollmentByCourseId.get(activeLearningCourse.id) || null;
  }, [activeLearningCourse, studentEnrollmentByCourseId]);
  const activeLearningCompletedSet = useMemo(
    () => new Set(activeLearningEnrollment?.completedModuleIds || []),
    [activeLearningEnrollment]
  );
  const activeLearningProgress = activeLearningEnrollment?.progress || 0;
  const isActiveLearningComplete = activeLearningProgress >= 100;
  const availabilityByDay = WEEK_DAYS.map((day) => ({
    day,
    count: currentTutor?.availability?.filter((slot) => slot.day === day).length || 0,
  }));
  const availableTabs = getAllowedTabs(currentUser);
  const primaryNavTabs: Tab[] = ['home', 'tutors', 'courses', 'resources', 'quizzes'];
  const navTabs = currentUser ? availableTabs.filter(tab => primaryNavTabs.includes(tab)) : primaryNavTabs;
  const canUseChatbot = (!currentUser || isStudent) && activeTab === 'home';

  const resetWithdrawalSummaryState = () => {
    setWithdrawalSummary({
      totalEarnings: 0,
      withdrawnAmount: 0,
      pendingWithdrawalAmount: 0,
      availableBalance: 0,
    });
  };

  const loadTutorWithdrawalData = async (tutorId: string) => {
    if (!tutorId) {
      setWithdrawalRequests([]);
      resetWithdrawalSummaryState();
      setIsLoadingWithdrawalData(false);
      return;
    }

    setIsLoadingWithdrawalData(true);
    try {
      const [requests, summary] = await Promise.all([
        apiService.getWithdrawalRequests(tutorId),
        apiService.getWithdrawalSummary(tutorId),
      ]);
      setWithdrawalRequests(requests);
      setWithdrawalSummary(summary);
    } catch (error) {
      console.error('Failed to fetch withdrawal data:', error);
      setWithdrawalRequests([]);
      resetWithdrawalSummaryState();
    } finally {
      setIsLoadingWithdrawalData(false);
    }
  };

  // Fetch data from API on component mount
  useEffect(() => {
    const fetchTutors = async () => {
      setIsLoadingTutors(true);
      try {
        const tutorsData = await apiService.getTutors();
        setTutors(tutorsData);
      } catch (error) {
        console.error('Failed to fetch tutors from API, using mock data:', error);
        setTutors(MOCK_TUTORS);
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
        console.error('Failed to fetch courses from API, using mock data:', error);
        setCourses(MOCK_COURSES);
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
        console.error('Failed to fetch resources from API, using mock data:', error);
        setResources(MOCK_RESOURCES);
      } finally {
        setIsLoadingResources(false);
      }
    };

    const fetchReviews = async () => {
      try {
        const reviewsData = await apiService.getReviews();
        setAllReviews(reviewsData);
      } catch (error) {
        console.error('Failed to fetch reviews from API, using empty fallback:', error);
        setAllReviews([]);
      }
    };

    fetchTutors();
    fetchCourses();
    fetchResources();
    fetchReviews();
  }, []);

  // Fetch specific course if learning page needs it but course isn't loaded
  useEffect(() => {
    if (!activeLearningCourseId || activeLearningCourse) {
      return; // Either no course selected or course is already loaded
    }

    const loadMissingCourse = async () => {
      try {
        const course = await apiService.getCourse(activeLearningCourseId);
        setCourses((prevCourses) => {
          const exists = prevCourses.some(c => c.id === course.id);
          return exists ? prevCourses : [...prevCourses, course];
        });
      } catch (error) {
        console.error('Failed to load course:', error);
        const mockFallback = MOCK_COURSES.find((course) => course.id === activeLearningCourseId);
        if (mockFallback) {
          setCourses((prevCourses) => {
            const exists = prevCourses.some((course) => course.id === mockFallback.id);
            return exists ? prevCourses : [...prevCourses, mockFallback];
          });
        }
      }
    };

    loadMissingCourse();
  }, [activeLearningCourseId, activeLearningCourse]);

  // Fetch user-specific data when user logs in
  useEffect(() => {
    const fetchUserData = async () => {
      if (!currentUser) {
        setBookings([]);
        setReviews([]);
        setQuestions([]);
        setCourseEnrollments([]);
        setUserCourses([]);
        setWithdrawalRequests([]);
        resetWithdrawalSummaryState();
        setIsLoadingWithdrawalData(false);
        setIsLoadingUserData(false);
        return;
      }

      setIsLoadingUserData(true);

      try {
        const tutorIdentityIds =
          currentUser.role === 'tutor'
            ? Array.from(new Set([currentUser.id, currentTutor?.id].filter(Boolean))) as string[]
            : [];

        // Fetch user's bookings (student booking history vs tutor booking management)
        const userBookings = await apiService.getBookings();
        const normalizedBookings = userBookings.map((booking) => ({
          ...booking,
          paymentStatus:
            booking.paymentStatus ||
            (booking.status === 'confirmed' || booking.status === 'completed' ? 'paid' : 'pending'),
          hiddenForTutor: Boolean(booking.hiddenForTutor),
          hiddenForStudent: Boolean(booking.hiddenForStudent),
        }));
        setBookings(
          currentUser.role === 'tutor'
            ? normalizedBookings.filter((b) => tutorIdentityIds.includes(b.tutorId))
            : normalizedBookings.filter((b) => b.studentId === currentUser.id)
        );

        // Fetch user's reviews
        const userReviews = await apiService.getReviews();
        setReviews(
          currentUser.role === 'tutor'
            ? userReviews.filter((r) => tutorIdentityIds.includes(r.tutorId))
            : userReviews.filter(r => r.studentId === currentUser.id)
        );

        // Fetch student's questions only
        if (currentUser.role === 'student') {
          const allQuestions = await apiService.getQuestions();
          setQuestions(allQuestions.filter(q => q.studentId === currentUser.id));

          const enrollments = await apiService.getCourseEnrollments({ studentId: currentUser.id });
          setCourseEnrollments(enrollments);
          setUserCourses(enrollments.map((enrollment) => enrollment.courseId));
          setWithdrawalRequests([]);
          resetWithdrawalSummaryState();
          setIsLoadingWithdrawalData(false);
        } else {
          setQuestions([]);

          const resolvedTutorId = currentTutor?.id || currentUser.id;
          if (resolvedTutorId) {
            const tutorEnrollments = await apiService.getCourseEnrollments({ tutorId: resolvedTutorId });
            setCourseEnrollments(tutorEnrollments);
            await loadTutorWithdrawalData(resolvedTutorId);
          } else {
            setCourseEnrollments([]);
            setWithdrawalRequests([]);
            resetWithdrawalSummaryState();
            setIsLoadingWithdrawalData(false);
          }
          setUserCourses([]);
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
      } finally {
        setIsLoadingUserData(false);
      }
    };

    fetchUserData();
  }, [currentUser, currentTutor?.id]);

  useEffect(() => {
    if (activeTab !== 'courseLearning') {
      return;
    }

    setLearningContentTab('overview');
    setBookmarkedModules(new Set());
  }, [activeTab, activeLearningCourseId]);

  // Sync profile data with current user
  useEffect(() => {
    if (currentUser) {
      const isTutorUser = currentUser.role === 'tutor';
      const tutorDoc = isTutorUser ? currentTutor : null;

      setProfileData({
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        phone: currentUser.phone ? normalizeSriLankanPhone(currentUser.phone) || currentUser.phone : '',
        education: tutorDoc?.qualifications || '',
        subjects: tutorDoc?.subjects || [],
        teachingLevel: tutorDoc?.teachingLevel || '',
        pricePerHour: tutorDoc?.pricePerHour || 0,
        bio: tutorDoc?.bio || ''
      });
    }
  }, [currentUser, currentTutor]);

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

  const handleBookSession = async (
    tutor: Tutor,
    bookingIntent: {
      slotId: string;
      sessionDate: string;
      sessionTime: string;
      paymentStatus: 'paid' | 'failed';
      paymentReference?: string;
      paymentFailureReason?: string;
    }
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) {
      setShowAuthModal(true);
      return { ok: false, error: 'Please sign in to continue.' };
    }

    if (currentUser.role !== 'student') {
      return { ok: false, error: 'Only student accounts can book sessions.' };
    }

    try {
      const isPaid = bookingIntent.paymentStatus === 'paid';
      const booking = await apiService.createBooking({
        studentId: currentUser.id,
        studentName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        tutorId: tutor.id,
        slotId: bookingIntent.slotId,
        status: isPaid ? 'confirmed' : 'pending',
        subject: tutor.subjects?.[0] || 'General',
        date: bookingIntent.sessionDate,
        timeSlot: bookingIntent.sessionTime,
        meetingLink: undefined,
        paymentStatus: bookingIntent.paymentStatus,
        paymentReference: bookingIntent.paymentReference,
        paymentFailureReason: isPaid ? undefined : bookingIntent.paymentFailureReason,
        paidAt: isPaid ? new Date().toISOString() : undefined,
        hiddenForTutor: false,
        hiddenForStudent: false,
      });

      setBookings((prevBookings) => [
        {
          ...booking,
          paymentStatus:
            booking.paymentStatus ||
            (booking.status === 'confirmed' || booking.status === 'completed' ? 'paid' : 'pending'),
          hiddenForTutor: Boolean(booking.hiddenForTutor),
          hiddenForStudent: Boolean(booking.hiddenForStudent),
        },
        ...prevBookings,
      ]);
      return { ok: true };
    } catch (error: any) {
      return { ok: false, error: error?.message || 'Failed to save booking.' };
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let user;
      if (authMode === 'login') {
        user = await apiService.login(authData.email, authData.password, rememberMe);
        const persistenceMode: SessionPersistenceMode = rememberMe ? 'remember' : 'session';
        setSessionPersistence(persistenceMode);
        setCurrentUser(user);
        setActiveTab('dashboard');
        persistSession({ user, activeTab: 'dashboard' }, persistenceMode);
        setShowAuthModal(false);
        setAuthData({ email: '', password: '', firstName: '', lastName: '', confirmPassword: '', role: 'student' });
        setRememberMe(false);
      } else {
        if (!authData.firstName.trim() || !authData.lastName.trim()) {
          alert('First name and last name are required.');
          return;
        }
        if (authData.password !== authData.confirmPassword) {
          alert('Passwords do not match.');
          return;
        }
        user = await apiService.signup(authData.firstName, authData.lastName, authData.email, authData.password, authData.role);
        // Show success message and switch to login mode
        alert('Account created successfully! Please sign in with your credentials.');
        setAuthMode('login');
        setAuthData({ email: authData.email, password: '', firstName: '', lastName: '', confirmPassword: '', role: 'student' });
        setRememberMe(false);
      }
    } catch (error: any) {
      alert(error.message || 'Authentication failed');
    }
  };

  const handleOpenForgotPassword = () => {
    setShowAuthModal(false);
    setAuthMode('login');
    setRememberMe(false);
    setActiveTab('forgotPassword');
  };

  const handleOpenLoginFromForgotPassword = () => {
    setAuthMode('login');
    setShowAuthModal(true);
    setRememberMe(false);
    setActiveTab('home');
    setAuthData((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
    }));
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
    if (!chatInput.trim() || isChatTyping) return;

    const userMsg = chatInput.trim();
    setChatMessages(prev => [
      ...prev,
      { role: 'user', text: userMsg },
      { role: 'bot', text: 'TutorSphere Assistant is typing...', meta: 'typing' },
    ]);
    setChatInput('');
    setIsChatTyping(true);

    try {
      const userName = currentUser
        ? `${currentUser.firstName} ${currentUser.lastName}`.trim() || 'Guest'
        : 'Guest';

      const response = await apiService.sendFaqChatMessage(userMsg, {
        currentTab: activeTab,
        userRole: currentUser?.role || 'guest',
        userName,
      });

      const botReply = String(response?.reply || '').trim() ||
        'I can help with TutorSphere platform features like courses, tutors, bookings, resources, and certificates.';

      setChatMessages((prev) => {
        let typingIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].meta === 'typing') {
            typingIndex = i;
            break;
          }
        }

        if (typingIndex === -1) {
          return [...prev, { role: 'bot', text: botReply }];
        }

        return prev.map((message, index) =>
          index === typingIndex
            ? { role: 'bot', text: botReply }
            : message
        );
      });
    } catch (error) {
      console.error('Failed to fetch TutorSphere Assistant reply:', error);

      setChatMessages((prev) => {
        let typingIndex = -1;
        for (let i = prev.length - 1; i >= 0; i--) {
          if (prev[i].meta === 'typing') {
            typingIndex = i;
            break;
          }
        }

        const fallbackReply = 'I hit a temporary issue. Please try again in a moment.';

        if (typingIndex === -1) {
          return [...prev, { role: 'bot', text: fallbackReply, meta: 'error' }];
        }

        return prev.map((message, index) =>
          index === typingIndex
            ? { role: 'bot', text: fallbackReply, meta: 'error' }
            : message
        );
      });
    } finally {
      setIsChatTyping(false);
    }
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

  const handleOpenCourseLearning = (courseId: string) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (currentUser.role !== 'student') {
      alert('Only student accounts can access course learning pages.');
      return;
    }

    const enrollment = studentEnrollmentByCourseId.get(courseId);
    if (!enrollment) {
      alert('Please enroll in this course first.');
      return;
    }

    setActiveLearningCourseId(courseId);
    setActiveVideoModuleId(null);
    setActiveTab('courseLearning');
  };

  const handleUnenrollCourse = async (courseId: string) => {
    if (!currentUser || currentUser.role !== 'student') return;

    const confirmUnenroll = window.confirm("Are you sure you want to unenroll from this course? You will lose all your progress.");
    if (!confirmUnenroll) return;

    try {
      await apiService.unenrollFromCourse(courseId, currentUser.id);

      setUserCourses(prev => prev.filter(id => id !== courseId));
      setCourseEnrollments(prev => prev.filter(e => e.courseId !== courseId));

      if (activeLearningCourseId === courseId) {
        setActiveLearningCourseId(null);
        setActiveVideoModuleId(null);
        setActiveTab('courses');
      }

      // Update courses list lightly to reflect immediate unenroll state if needed
      setCourses(prev => prev.map(c =>
        c.id === courseId
          ? { ...c, enrolledStudents: c.enrolledStudents.filter(s => s !== currentUser.id) }
          : c
      ));

      alert("You have successfully unenrolled from the course.");
    } catch (error) {
      console.error('Failed to unenroll:', error);
      alert('Failed to unenroll from the course. Please try again.');
    }
  };

  const handleEnrollCourse = async (
    courseId: string,
    checkout?: CourseCheckoutSubmission
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) {
      setShowAuthModal(true);
      return { ok: false, error: 'Please sign in to continue.' };
    }
    if (currentUser.role !== 'student') {
      return { ok: false, error: 'Only student accounts can enroll in courses.' };
    }
    if (userCourses.includes(courseId)) {
      handleOpenCourseLearning(courseId);
      return { ok: true };
    }

    const selectedCourse = courses.find((course) => course.id === courseId);
    if (!selectedCourse) {
      return { ok: false, error: 'Course not found. Please refresh and try again.' };
    }

    const isFreeCourse = selectedCourse.isFree || selectedCourse.price <= 0;
    const paymentReference = checkout?.paymentReference?.trim() || '';
    const couponCode = checkout?.couponCode?.trim() || '';

    if (!isFreeCourse) {
      if (!paymentReference && !couponCode) {
        return { ok: false, error: 'Payment completion is required for paid course enrollment.' };
      }
    }

    try {
      const updatedCourse = await apiService.enrollInCourse(courseId, currentUser.id, {
        paymentConfirmed: true,
        paymentReference,
        couponCode: couponCode || undefined,
      });
      setCourses((prevCourses) =>
        prevCourses.map((course) => (course.id === updatedCourse.id ? updatedCourse : course))
      );

      const enrollments = await apiService.getCourseEnrollments({ studentId: currentUser.id });
      setCourseEnrollments(enrollments);
      setUserCourses(enrollments.map((enrollment) => enrollment.courseId));

      setActiveLearningCourseId(courseId);
      setActiveVideoModuleId(null);
      setActiveTab('courseLearning');
      return { ok: true };
    } catch (error) {
      console.error('Failed to enroll in course:', error);
      const message = error instanceof Error ? error.message : 'Failed to enroll in course. Please try again.';
      return { ok: false, error: message };
    }
  };

  const handleToggleModuleProgress = async (course: Course, moduleId: string, isCompleted: boolean) => {
    if (!currentUser || currentUser.role !== 'student') {
      alert('Only student accounts can track course progress.');
      return;
    }

    const enrollment = studentEnrollmentByCourseId.get(course.id);
    if (!enrollment) {
      alert('Please enroll in this course first.');
      return;
    }

    const completedSet = new Set(enrollment.completedModuleIds);
    if (isCompleted) {
      completedSet.add(moduleId);
    } else {
      completedSet.delete(moduleId);
    }

    try {
      const updatedEnrollment = await apiService.updateCourseProgress(
        enrollment.id,
        currentUser.id,
        Array.from(completedSet)
      );

      setCourseEnrollments((prev) =>
        prev.map((item) => (item.id === updatedEnrollment.id ? updatedEnrollment : item))
      );

      if (updatedEnrollment.progress === 100 && !enrollment.certificateId) {
        setCertificateModalData({ enrollment: updatedEnrollment, courseTitle: course.title });
      }
    } catch (error) {
      console.error('Failed to update course progress:', error);
      alert('Failed to update course progress. Please try again.');
    }
  };

  const handleShowCertificateModal = (enrollment: CourseEnrollment, courseTitle: string) => {
    setCertificateModalData({ enrollment, courseTitle });
  };

  const handleDownloadCertificate = async (enrollment: CourseEnrollment, courseTitle: string) => {
    if (!currentUser || currentUser.role !== 'student') {
      alert('Only student accounts can download course certificates.');
      return;
    }

    try {
      await apiService.downloadCourseCertificate(enrollment.id, currentUser.id, courseTitle);
    } catch (error) {
      console.error('Failed to download certificate:', error);
      const message = error instanceof Error ? error.message : 'Failed to download certificate.';
      alert(message);
    }
  };

  const handleResetCourseForm = () => {
    setCourseForm(createInitialCourseForm());
    setEditingCourseId(null);
    setUploadingModuleVideoKey(null);
    setUploadingModuleResourcesKey(null);
    setIsUploadingCourseThumbnail(false);
  };

  const handleAddCourseModule = () => {
    setCourseForm((prev) => ({
      ...prev,
      modules: [...prev.modules, createEmptyEditableModule()],
    }));
  };

  const getEditableModuleKey = (module: EditableCourseModule, moduleIndex: number): string => {
    return module.id || `draft-${moduleIndex}`;
  };

  const getBaseFileName = (fileName: string): string => {
    return fileName.replace(/\.[^.]+$/, '').trim() || fileName;
  };

  const handleUploadCourseThumbnail = async (file: File) => {
    setIsUploadingCourseThumbnail(true);

    try {
      const uploadedAsset = await apiService.uploadCourseThumbnail(file);
      setCourseForm((prev) => ({ ...prev, thumbnail: uploadedAsset.path }));
    } catch (error) {
      console.error('Failed to upload course thumbnail:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload course thumbnail.';
      alert(message);
    } finally {
      setIsUploadingCourseThumbnail(false);
    }
  };

  const handleUploadModuleVideo = async (moduleIndex: number, file: File) => {
    const module = courseForm.modules[moduleIndex];
    if (!module) {
      return;
    }

    const moduleKey = getEditableModuleKey(module, moduleIndex);
    setUploadingModuleVideoKey(moduleKey);

    try {
      const uploadedAsset = await apiService.uploadCourseModuleVideo(file);
      setCourseForm((prev) => ({
        ...prev,
        modules: prev.modules.map((item, index) =>
          index === moduleIndex ? { ...item, videoUrl: uploadedAsset.path } : item
        ),
      }));
    } catch (error) {
      console.error('Failed to upload module video:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload module video.';
      alert(message);
    } finally {
      setUploadingModuleVideoKey(null);
    }
  };

  const handleUploadModuleResources = async (moduleIndex: number, fileList: FileList) => {
    const module = courseForm.modules[moduleIndex];
    if (!module || fileList.length === 0) {
      return;
    }

    const moduleKey = getEditableModuleKey(module, moduleIndex);
    setUploadingModuleResourcesKey(moduleKey);

    try {
      const uploadedResources: EditableCourseModuleResource[] = [];

      for (const file of Array.from(fileList)) {
        const uploadedAsset = await apiService.uploadCourseModuleResource(file);
        uploadedResources.push({
          id: createDraftId(),
          name: getBaseFileName(uploadedAsset.originalName),
          url: uploadedAsset.path,
        });
      }

      setCourseForm((prev) => ({
        ...prev,
        modules: prev.modules.map((item, index) =>
          index === moduleIndex
            ? { ...item, resources: [...item.resources, ...uploadedResources] }
            : item
        ),
      }));
    } catch (error) {
      console.error('Failed to upload module resources:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload module resources.';
      alert(message);
    } finally {
      setUploadingModuleResourcesKey(null);
    }
  };

  const handleUpdateCourseModule = (
    moduleIndex: number,
    field: 'title' | 'videoUrl' | 'resourceNameInput' | 'resourceUrlInput',
    value: string
  ) => {
    setCourseForm((prev) => ({
      ...prev,
      modules: prev.modules.map((module, index) =>
        index === moduleIndex ? { ...module, [field]: value } : module
      ),
    }));
  };

  const handleUpdateCourseModuleResource = (
    moduleIndex: number,
    resourceIndex: number,
    field: 'name' | 'url',
    value: string
  ) => {
    setCourseForm((prev) => ({
      ...prev,
      modules: prev.modules.map((module, index) => {
        if (index !== moduleIndex) {
          return module;
        }

        return {
          ...module,
          resources: module.resources.map((resource, currentResourceIndex) =>
            currentResourceIndex === resourceIndex ? { ...resource, [field]: value } : resource
          ),
        };
      }),
    }));
  };

  const handleRemoveCourseModuleResource = (moduleIndex: number, resourceIndex: number) => {
    setCourseForm((prev) => ({
      ...prev,
      modules: prev.modules.map((module, index) => {
        if (index !== moduleIndex) {
          return module;
        }

        return {
          ...module,
          resources: module.resources.filter((_, currentResourceIndex) => currentResourceIndex !== resourceIndex),
        };
      }),
    }));
  };

  const handleAddUrlModuleResource = (moduleIndex: number) => {
    const module = courseForm.modules[moduleIndex];
    if (!module) {
      return;
    }

    const resourceUrl = module.resourceUrlInput.trim();
    if (!resourceUrl) {
      alert('Please provide a resource URL before adding it.');
      return;
    }

    const resourceName = module.resourceNameInput.trim() || getResourceNameFromUrl(resourceUrl, 'Resource');

    setCourseForm((prev) => ({
      ...prev,
      modules: prev.modules.map((item, index) => {
        if (index !== moduleIndex) {
          return item;
        }

        return {
          ...item,
          resources: [...item.resources, { id: createDraftId(), name: resourceName, url: resourceUrl }],
          resourceNameInput: '',
          resourceUrlInput: '',
        };
      }),
    }));
  };

  const handleRemoveCourseModule = (moduleIndex: number) => {
    setCourseForm((prev) => {
      if (prev.modules.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        modules: prev.modules.filter((_, index) => index !== moduleIndex),
      };
    });
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setCourseForm({
      title: course.title,
      subject: course.subject,
      description: course.description,
      isFree: course.isFree || course.price <= 0,
      price: course.price,
      thumbnail: course.thumbnail,
      modules: course.modules.map((module) => ({
        id: module.id,
        title: module.title,
        videoUrl: module.videoUrl,
        resources: normalizeEditableModuleResources(module.resources),
        resourceNameInput: '',
        resourceUrlInput: '',
      })),
    });
  };

  const handleSaveCourse = async (event: React.FormEvent): Promise<boolean> => {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can manage courses.');
      return false;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to manage courses.');
      return false;
    }

    const normalizedModules = courseForm.modules
      .map((module) => ({
        id: module.id || createDraftId(),
        title: module.title.trim(),
        videoUrl: module.videoUrl.trim(),
        resources: module.resources
          .map((resource, resourceIndex) => {
            const resourceUrl = resource.url.trim();
            if (!resourceUrl) {
              return null;
            }

            return {
              name: resource.name.trim() || getResourceNameFromUrl(resourceUrl, `Resource ${resourceIndex + 1}`),
              url: resourceUrl,
            };
          })
          .filter(
            (resource): resource is { name: string; url: string } =>
              Boolean(resource)
          ),
      }))
      .filter((module) => module.title && module.videoUrl);

    if (!courseForm.title.trim() || !courseForm.description.trim()) {
      alert('Course title and description are required.');
      return false;
    }

    if (normalizedModules.length === 0) {
      alert('Please add at least one module with a title and a video URL (or uploaded video).');
      return false;
    }

    const normalizedPrice = Number(courseForm.price) || 0;
    if (!courseForm.isFree && normalizedPrice <= 0) {
      alert('Paid courses must have a price greater than zero.');
      return false;
    }

    setIsSavingCourse(true);

    const payload: Omit<Course, 'id'> = {
      tutorId,
      title: courseForm.title.trim(),
      subject: courseForm.subject,
      description: courseForm.description.trim(),
      isFree: courseForm.isFree,
      price: courseForm.isFree ? 0 : normalizedPrice,
      thumbnail:
        courseForm.thumbnail.trim() ||
        `https://picsum.photos/seed/${encodeURIComponent(courseForm.title.trim())}/900/560`,
      modules: normalizedModules,
      enrolledStudents: editingCourseId
        ? courses.find((course) => course.id === editingCourseId)?.enrolledStudents || []
        : [],
    };

    try {
      if (editingCourseId) {
        const updatedCourse = await apiService.updateCourse(editingCourseId, payload, tutorId);
        setCourses((prev) =>
          prev.map((course) => (course.id === editingCourseId ? updatedCourse : course))
        );
        alert('Course updated successfully.');
      } else {
        const createdCourse = await apiService.createCourse(payload);
        setCourses((prev) => [createdCourse, ...prev]);
        alert('Course created successfully.');
      }

      handleResetCourseForm();
      return true;
    } catch (error) {
      console.error('Failed to save course:', error);
      const message = error instanceof Error ? error.message : 'Failed to save course.';
      alert(message);
      return false;
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can delete courses.');
      return false;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to delete courses.');
      return false;
    }

    try {
      await apiService.deleteCourse(courseId, tutorId);
      setCourses((prev) => prev.filter((course) => course.id !== courseId));
      setCourseEnrollments((prev) => prev.filter((enrollment) => enrollment.courseId !== courseId));
      setUserCourses((prev) => prev.filter((enrolledCourseId) => enrolledCourseId !== courseId));

      if (editingCourseId === courseId) {
        handleResetCourseForm();
      }

      alert('Course deleted successfully.');
      return true;
    } catch (error) {
      console.error('Failed to delete course:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete course.';
      alert(message);
      return false;
    }
  };

  const handleGetCourseCoupons = async (courseId: string): Promise<CourseCoupon[]> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      throw new Error('Only tutor accounts can manage coupons.');
    }

    const actorId = currentUser.id;
    return apiService.getCourseCoupons(courseId, actorId);
  };

  const handleCreateCourseCoupon = async (
    courseId: string,
    payload: {
      code: string;
      discountPercentage: number;
      isActive?: boolean;
      expiresAt?: string;
      usageLimit?: number;
    }
  ): Promise<CourseCoupon> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      throw new Error('Only tutor accounts can manage coupons.');
    }

    return apiService.createCourseCoupon(courseId, {
      actorId: currentUser.id,
      ...payload,
    });
  };

  const handleUpdateCourseCoupon = async (
    courseId: string,
    couponId: string,
    payload: {
      code?: string;
      discountPercentage?: number;
      isActive?: boolean;
      expiresAt?: string | null;
      usageLimit?: number | null;
    }
  ): Promise<CourseCoupon> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      throw new Error('Only tutor accounts can manage coupons.');
    }

    return apiService.updateCourseCoupon(courseId, couponId, {
      actorId: currentUser.id,
      ...payload,
    });
  };

  const handleToggleCourseCouponStatus = async (
    courseId: string,
    couponId: string,
    isActive: boolean
  ): Promise<CourseCoupon> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      throw new Error('Only tutor accounts can manage coupons.');
    }

    return apiService.toggleCourseCouponStatus(courseId, couponId, {
      actorId: currentUser.id,
      isActive,
    });
  };

  const handleDeleteCourseCoupon = async (courseId: string, couponId: string): Promise<void> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      throw new Error('Only tutor accounts can manage coupons.');
    }

    return apiService.deleteCourseCoupon(courseId, couponId, currentUser.id);
  };

  const handleValidateCourseCoupon = async (
    courseId: string,
    couponCode: string
  ): Promise<{
    valid: boolean;
    couponCode: string;
    discountPercentage: number;
    originalPrice: number;
    discountAmount: number;
    finalPrice: number;
  }> => {
    if (!currentUser || currentUser.role !== 'student') {
      throw new Error('Only student accounts can apply coupons.');
    }

    return apiService.validateCourseCoupon(courseId, {
      studentId: currentUser.id,
      couponCode,
    });
  };

  const clearResourceUploadFeedback = () => {
    setResourceUploadStatus('idle');
    setResourceUploadProgress(0);
    setResourceUploadStatusMessage('');
  };

  const handleResetResourceForm = () => {
    setResourceForm(createInitialResourceForm());
    setEditingResourceId(null);
    setResourceInputMode('url');
    setResourceUploadFile(null);
    setIsUploadingResourceFile(false);
    clearResourceUploadFeedback();
  };

  const handleEditResource = (resource: Resource) => {
    setEditingResourceId(resource.id);
    setResourceInputMode(isUploadedResourcePath(resource.url) ? 'file' : 'url');
    setResourceUploadFile(null);
    clearResourceUploadFeedback();
    setResourceForm({
      title: resource.title,
      subject: resource.subject,
      type: resource.type,
      url: resource.url,
      description: resource.description || '',
    });
  };

  const handleSaveResource = async (event: React.FormEvent): Promise<boolean> => {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can manage resources.');
      return false;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to manage resources.');
      return false;
    }

    if (!resourceForm.title.trim()) {
      alert('Resource title is required.');
      setResourceUploadStatus('error');
      setResourceUploadStatusMessage('Resource title is required.');
      return false;
    }

    setIsSavingResource(true);
    setResourceUploadStatus('idle');
    setResourceUploadProgress(0);
    setResourceUploadStatusMessage('');

    try {
      let resourceUrl = resourceForm.url.trim();

      if (resourceInputMode === 'file') {
        const canReuseExistingUploadedPath =
          Boolean(editingResourceId) && isUploadedResourcePath(resourceUrl);

        if (resourceUploadFile) {
          setIsUploadingResourceFile(true);
          setResourceUploadStatus('uploading');
          setResourceUploadStatusMessage('Uploading resource file...');
          const uploadedResource = await apiService.uploadTutorResource(resourceUploadFile, (progress) => {
            setResourceUploadProgress(progress);
          });
          resourceUrl = uploadedResource.path;
          setResourceUploadProgress(100);
          setResourceUploadStatusMessage(`Uploaded ${uploadedResource.originalName}. Saving resource details...`);
        } else if (!canReuseExistingUploadedPath) {
          const validationMessage = 'Please choose a file to upload.';
          alert(validationMessage);
          setResourceUploadStatus('error');
          setResourceUploadStatusMessage(validationMessage);
          return false;
        } else {
          setResourceUploadProgress(100);
          setResourceUploadStatusMessage('Using previously uploaded file path.');
        }
      } else if (!resourceUrl) {
        const validationMessage = 'Resource URL is required when using URL mode.';
        alert(validationMessage);
        setResourceUploadStatus('error');
        setResourceUploadStatusMessage(validationMessage);
        return false;
      }

      const payload: Omit<Resource, 'id' | 'downloadCount'> = {
        tutorId,
        title: resourceForm.title.trim(),
        type: resourceForm.type,
        subject: resourceForm.subject,
        url: resourceUrl,
        description: resourceForm.description.trim(),
        isFree: true,
      };

      if (editingResourceId) {
        const updatedResource = await apiService.updateResource(editingResourceId, payload, tutorId);
        setResources((prev) =>
          prev.map((resource) => (resource.id === editingResourceId ? updatedResource : resource))
        );
        alert('Resource updated successfully.');
      } else {
        const createdResource = await apiService.createResource(payload);
        setResources((prev) => [createdResource, ...prev]);
        alert('Resource uploaded successfully.');
      }

      setResourceUploadFile(null);
      setResourceForm((prev) => ({ ...prev, url: resourceUrl }));
      setResourceUploadStatus('uploaded');
      setResourceUploadStatusMessage(
        resourceInputMode === 'file'
          ? 'File uploaded and resource saved successfully.'
          : 'Resource saved successfully.'
      );
      return true;
    } catch (error) {
      console.error('Failed to save resource:', error);
      const message = error instanceof Error ? error.message : 'Failed to save resource.';
      setResourceUploadStatus('error');
      setResourceUploadStatusMessage(message);
      alert(message);
      return false;
    } finally {
      setIsSavingResource(false);
      setIsUploadingResourceFile(false);
    }
  };

  const handleDeleteResource = async (resourceId: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can delete resources.');
      return false;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to delete resources.');
      return false;
    }

    try {
      await apiService.deleteResource(resourceId, tutorId);
      setResources((prev) => prev.filter((resource) => resource.id !== resourceId));

      if (editingResourceId === resourceId) {
        handleResetResourceForm();
      }

      alert('Resource deleted successfully.');
      return true;
    } catch (error) {
      console.error('Failed to delete resource:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete resource.';
      alert(message);
      return false;
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
      setReviews((prev) => [review, ...prev]);
      setAllReviews((prev) => [review, ...prev]);
      alert('Review submitted successfully!');
    } catch (error) {
      console.error('Failed to submit review:', error);
      alert('Failed to submit review. Please try again.');
    }
  };

  const handleSignOut = () => {
    clearStoredSessions();
    setCurrentUser(null);
    setActiveLearningCourseId(null);
    setIsUserMenuOpen(false);
    setSessionPersistence('session');
    setRememberMe(false);
    setAuthMode('login');
    setShowAuthModal(true);
    setActiveTab('home');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) {
      return;
    }

    const confirmed = confirm('Delete your account permanently? This will remove your profile and related data. This action cannot be undone.');
    if (!confirmed) {
      return;
    }

    const confirmationInput = prompt('Type DELETE to confirm account deletion:');
    if (confirmationInput !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    const deletedUser = currentUser;
    setIsDeletingAccount(true);

    try {
      await apiService.deleteUser(deletedUser.id);

      setTutors((prevTutors) => prevTutors.filter((tutor) => tutor.id !== deletedUser.id));

      setCourses((prevCourses) =>
        deletedUser.role === 'tutor'
          ? prevCourses.filter((course) => course.tutorId !== deletedUser.id)
          : prevCourses.map((course) => ({
            ...course,
            enrolledStudents: course.enrolledStudents.filter((studentId) => studentId !== deletedUser.id),
          }))
      );

      if (deletedUser.role === 'tutor') {
        setResources((prevResources) => prevResources.filter((resource) => resource.tutorId !== deletedUser.id));
      }

      setAllReviews((prevReviews) =>
        prevReviews.filter(
          (review) => review.tutorId !== deletedUser.id && review.studentId !== deletedUser.id
        )
      );

      setBookings([]);
      setReviews([]);
      setQuestions([]);
      setCourseEnrollments([]);
      setUserCourses([]);

      clearStoredSessions();
      setCurrentUser(null);
      setActiveLearningCourseId(null);
      setIsUserMenuOpen(false);
      setShowAuthModal(false);
      setAuthMode('login');
      setSessionPersistence('session');
      setRememberMe(false);
      setActiveTab('home');

      alert('Your account was deleted successfully.');
    } catch (error) {
      console.error('Failed to delete account:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete account. Please try again.';
      alert(message);
    } finally {
      setIsDeletingAccount(false);
    }
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

  const formatSriLankanPhoneForInput = (value: string): string => {
    const sanitized = sanitizePhoneInput(value);
    if (!sanitized) {
      return '';
    }

    const digitsOnly = sanitized.replace(/\D/g, '');

    if (sanitized.startsWith('+')) {
      if (digitsOnly.startsWith('94')) {
        return `+${digitsOnly.slice(0, 11)}`;
      }
      return '+94';
    }

    if (digitsOnly.startsWith('0')) {
      return `+94${digitsOnly.slice(1, 10)}`;
    }

    if (digitsOnly.startsWith('94')) {
      return `+94${digitsOnly.slice(2, 11)}`;
    }

    return `+94${digitsOnly.slice(0, 9)}`;
  };

  const handleProfilePhoneChange = (value: string) => {
    const formattedPhone = formatSriLankanPhoneForInput(value);
    setProfileData((prev) => ({ ...prev, phone: formattedPhone }));
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!profileData.firstName.trim() || !profileData.lastName.trim()) {
      alert('First name and last name are required.');
      return;
    }

    const normalizedPhone = profileData.phone ? normalizeSriLankanPhone(profileData.phone) : null;
    if (profileData.phone && !normalizedPhone) {
      alert('Please enter a valid Sri Lankan phone number in +94 format (e.g. +94771234567).');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const formData = new FormData();
      formData.append('firstName', profileData.firstName.trim());
      formData.append('lastName', profileData.lastName.trim());
      formData.append('phone', normalizedPhone ?? '');

      if (currentUser.role === 'tutor') {
        const tutorId = currentTutor?.id || currentUser.id;
        const hasSubjects = profileData.subjects.length > 0;
        const validTeachingLevel =
          profileData.teachingLevel === 'School' ||
          profileData.teachingLevel === 'University' ||
          profileData.teachingLevel === 'School and University';

        if (!hasSubjects || !validTeachingLevel || !profileData.education.trim()) {
          alert('Tutor profiles require Education, Subject(s), and Teaching Level.');
          setIsUpdatingProfile(false);
          return;
        }

        await apiService.updateTutor(tutorId, {
          qualifications: profileData.education,
          subjects: profileData.subjects,
          teachingLevel: profileData.teachingLevel as any,
          pricePerHour: profileData.pricePerHour,
          bio: profileData.bio
        });

        const tutorsData = await apiService.getTutors();
        setTutors(tutorsData);
      }

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

  const handleChangePassword = async () => {
    if (!currentUser) {
      return;
    }

    if (!changePasswordData.currentPassword || !changePasswordData.newPassword || !changePasswordData.confirmPassword) {
      alert('Current password, new password, and confirm password are required.');
      return;
    }

    if (changePasswordData.newPassword !== changePasswordData.confirmPassword) {
      alert('New password and confirm password do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await apiService.changePassword(
        currentUser.id,
        changePasswordData.currentPassword,
        changePasswordData.newPassword,
        changePasswordData.confirmPassword
      );

      alert(response.message || 'Password changed successfully.');
      setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowChangePasswordPanel(false);
    } catch (error) {
      console.error('Failed to change password:', error);
      const message = error instanceof Error ? error.message : 'Failed to change password. Please try again.';
      alert(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveTutorAvailability = async (slots: TimeSlot[]) => {
    if (!currentUser || currentUser.role !== 'tutor') {
      throw new Error('Only tutor accounts can update availability.');
    }

    const tutorId = currentTutor?.id || currentUser.id;
    const updatedTutor = await apiService.updateTutor(tutorId, { availability: slots });

    setTutors((prevTutors) => {
      const hasTutor = prevTutors.some((t) => t.id === updatedTutor.id);
      if (!hasTutor) {
        return [updatedTutor, ...prevTutors];
      }
      return prevTutors.map((t) => (t.id === updatedTutor.id ? updatedTutor : t));
    });
  };

  const updateTutorBooking = async (bookingId: string, updates: Partial<Booking>) => {
    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can update bookings.');
      return;
    }

    setActiveBookingActionId(bookingId);
    try {
      const updatedBooking = await apiService.updateBooking(bookingId, updates);
      setBookings((prevBookings) =>
        prevBookings.map((booking) =>
          booking.id === bookingId
            ? { ...booking, ...updatedBooking }
            : booking
        )
      );
    } catch (error) {
      console.error('Failed to update booking:', error);
      alert('Failed to update booking. Please try again.');
    } finally {
      setActiveBookingActionId(null);
    }
  };

  const isValidMeetingLink = (value?: string): boolean => {
    const trimmed = String(value || '').trim();
    if (!trimmed) {
      return false;
    }

    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getBookingStudentName = (booking: Booking): string => {
    const normalizedName = String(booking.studentName || '').trim();
    if (normalizedName) {
      return normalizedName;
    }

    if (currentUser?.role === 'student' && booking.studentId === currentUser.id) {
      return `${currentUser.firstName} ${currentUser.lastName}`.trim();
    }

    return 'Student';
  };

  const getBookingTutorName = (booking: Booking): string => {
    const matchedTutor = tutors.find((tutor) => tutor.id === booking.tutorId);
    if (matchedTutor) {
      return getTutorDisplayName(matchedTutor);
    }

    return 'Tutor';
  };

  const parseBookingStartDate = (booking: Booking): Date | null => {
    const rawDate = String(booking.date || '').trim();
    if (!rawDate) {
      return null;
    }

    const baseDate = new Date(rawDate);
    if (Number.isNaN(baseDate.getTime())) {
      return null;
    }

    const rawStartToken = String(booking.timeSlot || '')
      .split('-')[0]
      ?.trim();

    if (!rawStartToken) {
      baseDate.setHours(0, 0, 0, 0);
      return baseDate;
    }

    const twelveHourMatch = rawStartToken.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHourMatch) {
      let hours = Number(twelveHourMatch[1]);
      const minutes = Number(twelveHourMatch[2]);
      const meridiem = twelveHourMatch[3].toUpperCase();

      if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return baseDate;
      }

      if (hours === 12) {
        hours = meridiem === 'AM' ? 0 : 12;
      } else if (meridiem === 'PM') {
        hours += 12;
      }

      baseDate.setHours(hours, minutes, 0, 0);
      return baseDate;
    }

    const twentyFourHourMatch = rawStartToken.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFourHourMatch) {
      const hours = Number(twentyFourHourMatch[1]);
      const minutes = Number(twentyFourHourMatch[2]);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        baseDate.setHours(hours, minutes, 0, 0);
      }
      return baseDate;
    }

    baseDate.setHours(0, 0, 0, 0);
    return baseDate;
  };

  const getBookingSortTimestamp = (booking: Booking): number => {
    const sessionDate = parseBookingStartDate(booking);
    if (sessionDate) {
      return sessionDate.getTime();
    }

    const paidTimestamp = Date.parse(String(booking.paidAt || ''));
    if (!Number.isNaN(paidTimestamp)) {
      return paidTimestamp;
    }

    return 0;
  };

  const isPastSession = (booking: Booking): boolean => {
    if (booking.status === 'completed') {
      return true;
    }

    const sessionDate = parseBookingStartDate(booking);
    if (!sessionDate) {
      return false;
    }

    return sessionDate.getTime() < Date.now();
  };

  const canStudentManageBeforeStart = (booking: Booking): boolean => {
    const sessionDate = parseBookingStartDate(booking);
    if (!sessionDate) {
      return false;
    }

    return sessionDate.getTime() > Date.now();
  };

  const formatTimeLabelFrom24Hour = (value: string): string | null => {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }

    const hoursRaw = Number(match[1]);
    const minutesRaw = Number(match[2]);
    if (!Number.isFinite(hoursRaw) || !Number.isFinite(minutesRaw) || hoursRaw < 0 || hoursRaw > 23 || minutesRaw < 0 || minutesRaw > 59) {
      return null;
    }

    const meridiem = hoursRaw >= 12 ? 'PM' : 'AM';
    const hour12 = hoursRaw % 12 || 12;
    return `${hour12}:${String(minutesRaw).padStart(2, '0')} ${meridiem}`;
  };

  const toIsoDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleTutorBookingStatusChange = async (booking: Booking, status: Booking['status']) => {
    if (booking.status === status) {
      return;
    }

    const paymentStatus = booking.paymentStatus || 'pending';
    if ((status === 'confirmed' || status === 'completed') && paymentStatus !== 'paid') {
      alert('Only paid bookings can be confirmed or marked as completed.');
      return;
    }

    if (status === 'confirmed' && !isValidMeetingLink(booking.meetingLink)) {
      const meetingLink = prompt('Add a valid meeting link before confirming this booking (must start with http/https):')?.trim();
      if (!meetingLink || !isValidMeetingLink(meetingLink)) {
        alert('A valid meeting link is required to confirm the booking.');
        return;
      }

      await updateTutorBooking(booking.id, { status, meetingLink: meetingLink.trim() });
      return;
    }

    await updateTutorBooking(booking.id, { status });
  };

  const handleTutorMeetingLinkUpdate = async (booking: Booking) => {
    const paymentStatus = booking.paymentStatus || 'pending';
    if (paymentStatus !== 'paid') {
      alert('Meeting links can be added only after successful payment.');
      return;
    }

    const nextMeetingLink = prompt('Enter meeting link:', booking.meetingLink || '')?.trim();
    if (!nextMeetingLink || nextMeetingLink === booking.meetingLink) {
      return;
    }

    if (!isValidMeetingLink(nextMeetingLink)) {
      alert('Please enter a valid meeting URL that starts with http:// or https://');
      return;
    }

    const nextStatus: Booking['status'] = booking.status === 'pending' ? 'confirmed' : booking.status;
    await updateTutorBooking(booking.id, { meetingLink: nextMeetingLink, status: nextStatus });
  };

  const handleStudentCancelBooking = async (booking: Booking) => {
    if (!currentUser || currentUser.role !== 'student') {
      alert('Only student accounts can cancel booked sessions.');
      return;
    }

    if (booking.studentId !== currentUser.id) {
      alert('You can only cancel your own bookings.');
      return;
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return;
    }

    if (!canStudentManageBeforeStart(booking)) {
      alert('You can only cancel sessions before the session start time.');
      return;
    }

    const shouldCancel = confirm('Are you sure you want to cancel this booking?');
    if (!shouldCancel) {
      return;
    }

    setActiveBookingActionId(booking.id);
    try {
      const updatedBooking = await apiService.updateBooking(booking.id, { status: 'cancelled' });
      setBookings((prevBookings) =>
        prevBookings.map((entry) =>
          entry.id === booking.id
            ? { ...entry, ...updatedBooking }
            : entry
        )
      );

      if ((booking.paymentStatus || 'pending') === 'paid') {
        setBookingCancelNotice('Booking cancelled successfully. Your payment will be returned to your bank account within 3-5 business days.');
      } else {
        setBookingCancelNotice('Booking cancelled successfully.');
      }
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      alert('Failed to cancel booking. Please try again.');
    } finally {
      setActiveBookingActionId(null);
    }
  };

  const handleTutorRescheduleBooking = async (booking: Booking) => {
    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can reschedule sessions.');
      return;
    }

    if (booking.status === 'cancelled' || booking.status === 'completed') {
      alert('Only active sessions can be rescheduled.');
      return;
    }

    if (!canStudentManageBeforeStart(booking)) {
      alert('You can only reschedule sessions before the session start time.');
      return;
    }

    const currentStartDate = parseBookingStartDate(booking) || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateInput = prompt('Enter new session date (YYYY-MM-DD):', toIsoDateString(currentStartDate))?.trim();
    if (!dateInput) {
      return;
    }

    const nextDateCandidate = new Date(`${dateInput}T00:00:00`);
    if (Number.isNaN(nextDateCandidate.getTime())) {
      alert('Invalid date format. Use YYYY-MM-DD.');
      return;
    }

    const defaultTime = String(booking.timeSlot || '').split('-')[0]?.trim();
    const defaultTime24Match = defaultTime?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    let defaultTime24 = '09:00';
    if (defaultTime24Match) {
      let hours = Number(defaultTime24Match[1]);
      const minutes = Number(defaultTime24Match[2]);
      const meridiem = defaultTime24Match[3].toUpperCase();
      if (hours === 12) {
        hours = meridiem === 'AM' ? 0 : 12;
      } else if (meridiem === 'PM') {
        hours += 12;
      }
      defaultTime24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    const timeInput = prompt('Enter new start time (HH:MM in 24-hour format):', defaultTime24)?.trim();
    if (!timeInput) {
      return;
    }

    const startLabel = formatTimeLabelFrom24Hour(timeInput);
    if (!startLabel) {
      alert('Invalid time format. Use HH:MM in 24-hour format.');
      return;
    }

    const [hoursPart, minutesPart] = timeInput.split(':');
    const nextSessionStart = new Date(nextDateCandidate);
    nextSessionStart.setHours(Number(hoursPart), Number(minutesPart), 0, 0);

    if (nextSessionStart.getTime() <= Date.now()) {
      alert('Rescheduled session must be in the future.');
      return;
    }

    const nextSessionEnd = new Date(nextSessionStart.getTime() + 60 * 60 * 1000);
    const nextEndLabel = formatTimeLabelFrom24Hour(`${String(nextSessionEnd.getHours()).padStart(2, '0')}:${String(nextSessionEnd.getMinutes()).padStart(2, '0')}`) || startLabel;
    const formattedDate = nextSessionStart.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    await updateTutorBooking(booking.id, {
      date: formattedDate,
      timeSlot: `${startLabel} - ${nextEndLabel}`,
    });

    alert('Session rescheduled successfully.');
  };

  const handleHideBookingForCurrentUser = async (booking: Booking) => {
    if (!currentUser) {
      return;
    }

    const shouldHide = confirm('Remove this session card from your dashboard view?');
    if (!shouldHide) {
      return;
    }

    const updates: Partial<Booking> =
      currentUser.role === 'tutor'
        ? { hiddenForTutor: true }
        : { hiddenForStudent: true };

    setActiveBookingActionId(booking.id);
    try {
      const updatedBooking = await apiService.updateBooking(booking.id, updates);
      setBookings((prevBookings) =>
        prevBookings.map((entry) =>
          entry.id === booking.id
            ? { ...entry, ...updatedBooking }
            : entry
        )
      );
    } catch (error) {
      console.error('Failed to hide booking from dashboard:', error);
      alert('Failed to update session visibility. Please try again.');
    } finally {
      setActiveBookingActionId(null);
    }
  };

  const handleSubmitSessionRating = async (booking: Booking) => {
    if (!currentUser || currentUser.role !== 'student') {
      return;
    }

    const draft = sessionRatingDrafts[booking.id] || { rating: 0, feedback: '' };
    if (!draft.rating || draft.rating < 1 || draft.rating > 5) {
      alert('Please select a rating between 1 and 5 stars.');
      return;
    }

    setActiveRatingActionBookingId(booking.id);
    try {
      const review = await apiService.createReview({
        tutorId: booking.tutorId,
        studentId: currentUser.id,
        studentName: `${currentUser.firstName} ${currentUser.lastName}`.trim(),
        sessionId: booking.id,
        rating: draft.rating,
        comment: draft.feedback.trim(),
        date: new Date().toISOString().split('T')[0],
      });

      setReviews((prev) => [review, ...prev.filter((entry) => entry.id !== review.id)]);
      setAllReviews((prev) => [review, ...prev.filter((entry) => entry.id !== review.id)]);
      setSessionRatingDrafts((prev) => {
        const next = { ...prev };
        delete next[booking.id];
        return next;
      });
    } catch (error) {
      console.error('Failed to submit session rating:', error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setActiveRatingActionBookingId(null);
    }
  };

  const resetWithdrawalForm = () => {
    setWithdrawalForm({
      amount: '',
      payoutMethodType: 'bank_transfer',
      bankAccountHolder: '',
      bankName: '',
      bankBranch: '',
      bankAccountNumber: '',
      paypalEmail: '',
    });
  };

  const handleOpenWithdrawalModal = () => {
    setWithdrawalNotice(null);
    resetWithdrawalForm();
    setIsWithdrawalModalOpen(true);
  };

  const handleCloseWithdrawalModal = () => {
    if (isSubmittingWithdrawal) {
      return;
    }

    setIsWithdrawalModalOpen(false);
    resetWithdrawalForm();
  };

  const handleSubmitWithdrawalRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'tutor') {
      setWithdrawalNotice({ type: 'error', message: 'Only tutor accounts can request withdrawals.' });
      return;
    }

    const resolvedTutorId = currentTutor?.id || currentUser.id;
    const amount = Number(withdrawalForm.amount);
    const selectedPayoutMethodType = withdrawalForm.payoutMethodType;

    let payoutDetails = '';

    if (selectedPayoutMethodType === 'bank_transfer') {
      const bankAccountHolder = withdrawalForm.bankAccountHolder.trim();
      const bankName = withdrawalForm.bankName.trim();
      const bankBranch = withdrawalForm.bankBranch.trim();
      const bankAccountNumber = withdrawalForm.bankAccountNumber.trim();

      if (!bankAccountHolder || !bankName || !bankBranch || !bankAccountNumber) {
        setWithdrawalNotice({
          type: 'error',
          message: 'Please fill all bank transfer fields before submitting.',
        });
        return;
      }

      payoutDetails = `Account Holder: ${bankAccountHolder}; Bank Name: ${bankName}; Branch: ${bankBranch}; Account Number: ${bankAccountNumber}`;
    } else if (selectedPayoutMethodType === 'paypal') {
      const paypalEmail = withdrawalForm.paypalEmail.trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!paypalEmail || !emailPattern.test(paypalEmail)) {
        setWithdrawalNotice({
          type: 'error',
          message: 'Please provide a valid PayPal email address.',
        });
        return;
      }

      payoutDetails = `PayPal Email: ${paypalEmail}`;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawalNotice({ type: 'error', message: 'Please enter a valid withdrawal amount.' });
      return;
    }

    if (amount > withdrawalAvailableBalance + 0.0001) {
      setWithdrawalNotice({
        type: 'error',
        message: `Withdrawal amount cannot exceed available balance (${formatLkr(withdrawalAvailableBalance)}).`,
      });
      return;
    }

    if (!payoutDetails) {
      setWithdrawalNotice({ type: 'error', message: 'Please provide payout method details.' });
      return;
    }

    setIsSubmittingWithdrawal(true);
    try {
      const createdRequest = await apiService.createWithdrawalRequest({
        tutorId: resolvedTutorId,
        amount,
        payoutMethodType: selectedPayoutMethodType,
        payoutMethodDetails: payoutDetails,
      });

      await loadTutorWithdrawalData(resolvedTutorId);
      setIsWithdrawalModalOpen(false);
      resetWithdrawalForm();

      if (selectedPayoutMethodType === 'bank_transfer') {
        setWithdrawalNotice({
          type: 'success',
          message: 'Bank transfer withdrawal request submitted successfully.',
        });
        setBankTransferEtaNotice('Your bank transfer withdrawal is pending. Money will be sent to your bank account within 24 hours.');
      } else {
        setWithdrawalNotice({
          type: 'success',
          message:
            createdRequest.status === 'approved'
              ? 'PayPal withdrawal approved instantly.'
              : 'PayPal withdrawal submitted successfully.',
        });
      }
    } catch (error) {
      console.error('Failed to create withdrawal request:', error);
      const message = error instanceof Error ? error.message : 'Failed to submit withdrawal request.';
      setWithdrawalNotice({ type: 'error', message });
    } finally {
      setIsSubmittingWithdrawal(false);
    }
  };

  const getBookingStatusPillClassName = (status: Booking['status']) => {
    if (status === 'completed') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'confirmed') return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    if (status === 'pending') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getBookingPaymentStatus = (booking: Booking): 'pending' | 'paid' | 'failed' => {
    return booking.paymentStatus || 'pending';
  };

  const getBookingPaymentPillClassName = (paymentStatus: 'pending' | 'paid' | 'failed') => {
    if (paymentStatus === 'paid') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (paymentStatus === 'failed') return 'text-rose-700 bg-rose-50 border-rose-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const getTransactionStatusPillClassName = (status: TutorTransactionStatus) => {
    if (status === 'paid') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'refunded_or_cancelled') return 'text-rose-700 bg-rose-50 border-rose-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const getTransactionStatusLabel = (status: TutorTransactionStatus) => {
    if (status === 'paid') return 'Paid';
    if (status === 'refunded_or_cancelled') return 'Refunded/Cancelled';
    return 'Pending';
  };

  const getWithdrawalStatusPillClassName = (status: WithdrawalRequest['status']) => {
    if (status === 'paid') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'approved') return 'text-sky-700 bg-sky-50 border-sky-200';
    if (status === 'rejected') return 'text-rose-700 bg-rose-50 border-rose-200';
    return 'text-amber-700 bg-amber-50 border-amber-200';
  };

  const getWithdrawalStatusLabel = (status: WithdrawalRequest['status']) => {
    if (status === 'paid') return 'Paid';
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
  };

  const getWithdrawalPayoutMethodLabel = (method: WithdrawalRequest['payoutMethodType']) => {
    if (method === 'bank_transfer') return 'Bank Transfer';
    return 'PayPal';
  };

  const filterAndSortBookings = (
    source: Booking[],
    statusFilter: BookingStatusFilter,
    timelineFilter: SessionTimelineFilter,
    hiddenFlag: 'hiddenForTutor' | 'hiddenForStudent'
  ): Booking[] => {
    return source
      .filter((booking) => !Boolean((booking as any)[hiddenFlag]))
      .filter((booking) => (statusFilter === 'all' ? true : booking.status === statusFilter))
      .filter((booking) => {
        if (timelineFilter === 'all') {
          return true;
        }

        const past = isPastSession(booking);
        return timelineFilter === 'past' ? past : !past;
      })
      .sort((a, b) => getBookingSortTimestamp(b) - getBookingSortTimestamp(a));
  };

  const tutorDashboardBookings = useMemo(
    () => bookings.filter((booking) => !booking.hiddenForTutor),
    [bookings]
  );

  const studentDashboardBookings = useMemo(
    () => bookings.filter((booking) => !booking.hiddenForStudent),
    [bookings]
  );

  const filteredTutorBookings = useMemo(
    () => filterAndSortBookings(bookings, tutorBookingStatusFilter, tutorSessionTimelineFilter, 'hiddenForTutor'),
    [bookings, tutorBookingStatusFilter, tutorSessionTimelineFilter]
  );

  const filteredStudentBookings = useMemo(
    () => filterAndSortBookings(bookings, studentBookingStatusFilter, studentSessionTimelineFilter, 'hiddenForStudent'),
    [bookings, studentBookingStatusFilter, studentSessionTimelineFilter]
  );

  const studentReviewsBySessionId = useMemo(() => {
    const map = new Map<string, Review>();
    for (const review of reviews) {
      const sessionId = String(review.sessionId || '').trim();
      if (!sessionId) {
        continue;
      }
      map.set(sessionId, review);
    }
    return map;
  }, [reviews]);

  const roundMoney = (value: number): number => Math.round(value * 100) / 100;

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();

    for (const booking of bookings) {
      const studentId = String(booking.studentId || '').trim();
      const studentName = String(booking.studentName || '').trim();
      if (studentId && studentName) {
        map.set(studentId, studentName);
      }
    }

    for (const review of allReviews) {
      const studentId = String(review.studentId || '').trim();
      const studentName = String(review.studentName || '').trim();
      if (studentId && studentName && !map.has(studentId)) {
        map.set(studentId, studentName);
      }
    }

    return map;
  }, [bookings, allReviews]);

  const tutorCourseById = useMemo(
    () => new Map(myTutorCourses.map((course) => [course.id, course])),
    [myTutorCourses]
  );

  const resolveCourseEnrollmentAmount = (enrollment: CourseEnrollment): number => {
    const explicitAmount = Number(enrollment.amountPaid);
    if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
      return explicitAmount;
    }

    const course = tutorCourseById.get(enrollment.courseId);
    if (!course) {
      return 0;
    }

    return course.isFree || course.price <= 0 ? 0 : Number(course.price || 0);
  };

  const resolveCourseEnrollmentStatus = (enrollment: CourseEnrollment): TutorTransactionStatus => {
    const rawStatus = String(enrollment.paymentStatus || '').trim().toLowerCase();
    if (rawStatus === 'refunded' || rawStatus === 'cancelled' || rawStatus === 'failed') {
      return 'refunded_or_cancelled';
    }

    if (rawStatus === 'paid') {
      return 'paid';
    }

    if (rawStatus === 'pending') {
      return 'pending';
    }

    const fallbackAmount = resolveCourseEnrollmentAmount(enrollment);
    return fallbackAmount > 0 ? 'paid' : 'pending';
  };

  const tutorSessionEarningAmount = Number(currentTutor?.pricePerHour || 0);

  const tutorCompletedPaidBookings = useMemo(
    () => bookings.filter((booking) => booking.status === 'completed' && (booking.paymentStatus || 'pending') === 'paid'),
    [bookings]
  );

  const tutorSessionTransactions = useMemo<TutorTransactionItem[]>(() => {
    return bookings.map((booking) => {
      const paymentStatus = getBookingPaymentStatus(booking);
      let status: TutorTransactionStatus;

      if (booking.status === 'cancelled' || paymentStatus === 'failed') {
        status = 'refunded_or_cancelled';
      } else if (paymentStatus === 'paid' && booking.status === 'completed') {
        status = 'paid';
      } else {
        status = 'pending';
      }

      const amount = Math.max(0, tutorSessionEarningAmount);
      const platformFee = status === 'paid' ? roundMoney(amount * PLATFORM_FEE_RATE) : 0;
      const netEarning = status === 'paid' ? roundMoney(amount - platformFee) : 0;

      const paidTimestamp = Date.parse(String(booking.paidAt || ''));
      const timestamp = Number.isNaN(paidTimestamp) ? getBookingSortTimestamp(booking) : paidTimestamp;
      const date = new Date(timestamp);
      const dateLabel = Number.isNaN(date.getTime())
        ? 'N/A'
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      return {
        id: `session-${booking.id}`,
        timestamp,
        dateLabel,
        itemName: `${booking.subject} Session`,
        studentName: getBookingStudentName(booking),
        paymentType: 'session booking',
        amount,
        platformFee,
        netEarning,
        status,
        paymentReference: booking.paymentReference,
      };
    });
  }, [bookings, tutorSessionEarningAmount]);

  const tutorCourseTransactions = useMemo<TutorTransactionItem[]>(() => {
    const enrollmentTransactions: TutorTransactionItem[] = [];

    for (const enrollment of courseEnrollments) {
      const course = tutorCourseById.get(enrollment.courseId);
      if (!course) {
        continue;
      }

      const amount = resolveCourseEnrollmentAmount(enrollment);
      if (amount <= 0) {
        continue;
      }

      const status = resolveCourseEnrollmentStatus(enrollment);
      const platformFee = status === 'paid' ? roundMoney(amount * PLATFORM_FEE_RATE) : 0;
      const netEarning = status === 'paid' ? roundMoney(amount - platformFee) : 0;

      const paidTimestamp = Date.parse(String(enrollment.paidAt || enrollment.enrolledAt || ''));
      const timestamp = Number.isNaN(paidTimestamp) ? Date.now() : paidTimestamp;
      const date = new Date(timestamp);
      const dateLabel = Number.isNaN(date.getTime())
        ? 'N/A'
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const fallbackStudentName = studentNameById.get(enrollment.studentId);
      const studentName = String(enrollment.studentName || '').trim() || fallbackStudentName || 'Student';

      enrollmentTransactions.push({
        id: `course-${enrollment.id}`,
        timestamp,
        dateLabel,
        itemName: String(enrollment.courseTitle || '').trim() || course.title || 'Course Purchase',
        studentName,
        paymentType: 'course purchase',
        amount,
        platformFee,
        netEarning,
        status,
        paymentReference: enrollment.paymentReference,
      });
    }

    return enrollmentTransactions;
  }, [courseEnrollments, tutorCourseById, studentNameById]);

  const tutorTransactions = useMemo<TutorTransactionItem[]>(
    () => [...tutorSessionTransactions, ...tutorCourseTransactions],
    [tutorSessionTransactions, tutorCourseTransactions]
  );

  const filteredTutorTransactions = useMemo(() => {
    const statusFiltered = tutorTransactions.filter((transaction) =>
      tutorTransactionFilter === 'all' ? true : transaction.status === tutorTransactionFilter
    );

    const sorted = [...statusFiltered].sort((a, b) =>
      tutorTransactionSortOrder === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );

    return sorted;
  }, [tutorTransactions, tutorTransactionFilter, tutorTransactionSortOrder]);

  const tutorPaidTransactions = useMemo(
    () => tutorTransactions.filter((transaction) => transaction.status === 'paid'),
    [tutorTransactions]
  );

  const tutorPaidSessionTransactions = useMemo(
    () => tutorPaidTransactions.filter((transaction) => transaction.paymentType === 'session booking'),
    [tutorPaidTransactions]
  );

  const tutorPaidCourseTransactions = useMemo(
    () => tutorPaidTransactions.filter((transaction) => transaction.paymentType === 'course purchase'),
    [tutorPaidTransactions]
  );

  const tutorSessionNetEarnings = useMemo(
    () => roundMoney(tutorPaidSessionTransactions.reduce((sum, transaction) => sum + transaction.netEarning, 0)),
    [tutorPaidSessionTransactions]
  );

  const tutorCourseNetEarnings = useMemo(
    () => roundMoney(tutorPaidCourseTransactions.reduce((sum, transaction) => sum + transaction.netEarning, 0)),
    [tutorPaidCourseTransactions]
  );

  const tutorTotalEarnings = useMemo(
    () => roundMoney(tutorSessionNetEarnings + tutorCourseNetEarnings),
    [tutorSessionNetEarnings, tutorCourseNetEarnings]
  );

  const withdrawalTotalEarnings = useMemo(() => {
    const serverTotal = Number(withdrawalSummary.totalEarnings || 0);
    if (serverTotal > 0 || tutorTotalEarnings <= 0) {
      return roundMoney(serverTotal);
    }
    return roundMoney(tutorTotalEarnings);
  }, [withdrawalSummary.totalEarnings, tutorTotalEarnings]);

  const withdrawalWithdrawnAmount = useMemo(
    () => roundMoney(Math.max(0, Number(withdrawalSummary.withdrawnAmount || 0))),
    [withdrawalSummary.withdrawnAmount]
  );

  const withdrawalPendingAmount = useMemo(
    () => roundMoney(Math.max(0, Number(withdrawalSummary.pendingWithdrawalAmount || 0))),
    [withdrawalSummary.pendingWithdrawalAmount]
  );

  const withdrawalAvailableBalance = useMemo(() => {
    const serverAvailable = Number(withdrawalSummary.availableBalance || 0);
    const hasServerSummary =
      Number(withdrawalSummary.totalEarnings || 0) > 0 ||
      Number(withdrawalSummary.withdrawnAmount || 0) > 0 ||
      Number(withdrawalSummary.pendingWithdrawalAmount || 0) > 0 ||
      withdrawalRequests.length > 0;

    if (hasServerSummary) {
      return roundMoney(Math.max(0, serverAvailable));
    }

    return roundMoney(Math.max(0, withdrawalTotalEarnings - withdrawalWithdrawnAmount - withdrawalPendingAmount));
  }, [
    withdrawalSummary.availableBalance,
    withdrawalSummary.totalEarnings,
    withdrawalSummary.withdrawnAmount,
    withdrawalSummary.pendingWithdrawalAmount,
    withdrawalRequests.length,
    withdrawalTotalEarnings,
    withdrawalWithdrawnAmount,
    withdrawalPendingAmount,
  ]);

  const tutorPaidCourseEnrollmentsCount = tutorPaidCourseTransactions.length;

  const tutorMonthlyEarningsSummary = useMemo(() => {
    const monthMap = new Map<
      string,
      {
        month: string;
        monthKey: string;
        timestamp: number;
        totalNetEarnings: number;
        sessionNetEarnings: number;
        courseNetEarnings: number;
        completedSessions: number;
        paidCourseEnrollments: number;
      }
    >();

    for (const transaction of tutorPaidTransactions) {
      const date = new Date(transaction.timestamp);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const existing =
        monthMap.get(monthKey) ||
        {
          month: monthLabel,
          monthKey,
          timestamp: date.getTime(),
          totalNetEarnings: 0,
          sessionNetEarnings: 0,
          courseNetEarnings: 0,
          completedSessions: 0,
          paidCourseEnrollments: 0,
        };

      existing.totalNetEarnings += transaction.netEarning;
      if (transaction.paymentType === 'session booking') {
        existing.sessionNetEarnings += transaction.netEarning;
        existing.completedSessions += 1;
      } else {
        existing.courseNetEarnings += transaction.netEarning;
        existing.paidCourseEnrollments += 1;
      }

      existing.timestamp = Math.max(existing.timestamp, date.getTime());
      monthMap.set(monthKey, existing);
    }

    return Array.from(monthMap.values())
      .map((entry) => ({
        ...entry,
        totalNetEarnings: roundMoney(entry.totalNetEarnings),
        sessionNetEarnings: roundMoney(entry.sessionNetEarnings),
        courseNetEarnings: roundMoney(entry.courseNetEarnings),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [tutorPaidTransactions]);

  const tutorRecentMonthlyEarnings = useMemo(
    () => tutorMonthlyEarningsSummary.slice(-6),
    [tutorMonthlyEarningsSummary]
  );

  const tutorHasSessionEarningMethod = tutorDashboardBookings.length > 0 || tutorPaidSessionTransactions.length > 0;
  const tutorHasCourseEarningMethod = myTutorCourses.length > 0 || tutorPaidCourseEnrollmentsCount > 0;

  const tutorSessionSharePercent = useMemo(() => {
    if (tutorTotalEarnings <= 0) {
      return tutorHasSessionEarningMethod && !tutorHasCourseEarningMethod ? 100 : 0;
    }
    return Math.round((tutorSessionNetEarnings / tutorTotalEarnings) * 100);
  }, [tutorTotalEarnings, tutorSessionNetEarnings, tutorHasSessionEarningMethod, tutorHasCourseEarningMethod]);

  const tutorCourseSharePercent = useMemo(() => {
    if (tutorTotalEarnings <= 0) {
      return tutorHasCourseEarningMethod && !tutorHasSessionEarningMethod ? 100 : 0;
    }
    return Math.round((tutorCourseNetEarnings / tutorTotalEarnings) * 100);
  }, [tutorTotalEarnings, tutorCourseNetEarnings, tutorHasCourseEarningMethod, tutorHasSessionEarningMethod]);

  const tutorPerformanceFeedback = useMemo(
    () => reviews.filter((review) => String(review.comment || '').trim().length > 0).slice(0, 8),
    [reviews]
  );

  const tutorAverageRatingFromReviews = useMemo(() => {
    if (reviews.length === 0) {
      return currentTutor?.rating || 0;
    }

    return Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1));
  }, [reviews, currentTutor?.rating]);

  const getCourseAccessLabel = (course: Course) =>
    course.isFree || course.price <= 0 ? 'Free' : formatLkr(course.price);

  const getEmbeddableVideoUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed || trimmed === '#') {
      return null;
    }

    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.replace(/^www\./, '');

      if (host === 'youtube.com' || host === 'm.youtube.com') {
        const videoId = parsed.searchParams.get('v');
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

      if (host === 'youtu.be') {
        const videoId = parsed.pathname.replace('/', '').trim();
        if (videoId) {
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }

      if (host === 'vimeo.com') {
        const videoId = parsed.pathname.replace('/', '').trim();
        if (videoId) {
          return `https://player.vimeo.com/video/${videoId}`;
        }
      }

      if (host === 'player.vimeo.com') {
        return trimmed;
      }

      return null;
    } catch {
      return null;
    }
  };

  const isDirectVideoFile = (url: string): boolean => /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url.trim());

  const resolveCourseLearningResourceUrl = (rawUrl: string): string => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (trimmed.startsWith('/uploads/')) {
      if (window.location.port === '3000') {
        return `${window.location.origin}${trimmed}`;
      }
      return `http://localhost:3000${trimmed}`;
    }

    return trimmed;
  };

  return (
    <div className={`${activeTab === 'quizzes' ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'} bg-[#F8FAFC] font-sans text-slate-900`}>
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 flex-nowrap">
            {/* Left: Logo */}
            <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => setActiveTab('home')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <GraduationCap className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-indigo-900 whitespace-nowrap">TutorSphere</span>
            </div>

            {/* Center: Nav Links */}
            <div className="flex items-center justify-center gap-4 flex-1 flex-nowrap">
              {navTabs.map(tab => (
                <div key={tab} className="relative group">
                  <button
                    onClick={() => setActiveTab(tab)}
                    className={`text-base font-semibold whitespace-nowrap px-1 py-2 transition-colors ${activeTab === tab ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-500'}`}
                  >
                    {NAV_LABELS[tab]}
                  </button>
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTabUnderline"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"
                      transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Right: Auth Buttons */}
            <div className="flex items-center gap-3 shrink-0">
              {!currentUser ? (
                <>
                  <button
                    onClick={() => { setAuthMode('login'); setShowAuthModal(true) }}
                    className="w-[100px] border border-indigo-200 text-indigo-600 hover:bg-indigo-50 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap text-center"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setActiveTab('registerSelect')}
                    className="w-[100px] bg-indigo-600 text-white py-2 rounded-full text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 whitespace-nowrap text-center"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <div className="relative user-menu">
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                  >
                    <User className="w-4 h-4" /> {currentUser.firstName} {currentUser.lastName}
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                      <button
                        onClick={() => { setActiveTab('dashboard'); setIsUserMenuOpen(false) }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <User className="w-4 h-4" />
                        Dashboard
                      </button>
                      {isTutor && currentTutor && (
                        <button
                          onClick={() => {
                            setViewingTutorId(currentTutor.id);
                            setActiveTab('tutorProfile');
                            setIsUserMenuOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          My Profile
                        </button>
                      )}
                      <button
                        onClick={() => { setActiveTab('settings'); setIsUserMenuOpen(false) }}
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
          </div>
        </div>
      </nav>

      {/* Course Learning Page - Full Width */}
      {activeTab === 'courseLearning' && (() => {
        // Defensive render - ensure we have required data
        if (!activeLearningCourseId) {
          return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
              <div className="text-center space-y-4 p-8">
                <div className="w-12 h-12 rounded-full bg-red-200 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-900">No Course Selected</h2>
                <p className="text-sm text-slate-600">Please select a course to begin learning.</p>
                <button
                  onClick={() => setActiveTab('courses')}
                  className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Back to Courses
                </button>
              </div>
            </div>
          );
        }

        if (!activeLearningCourse) {
          return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
              <div className="text-center space-y-4 p-8">
                <div className="w-12 h-12 rounded-full bg-slate-200 animate-pulse mx-auto" />
                <h2 className="text-lg font-semibold text-slate-900">Loading Course...</h2>
                <p className="text-sm text-slate-600">Please wait while we load your course content.</p>
                <button
                  onClick={() => {
                    setActiveLearningCourseId(null);
                    setActiveVideoModuleId(null);
                    setActiveTab('courses');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Back to Courses
                </button>
              </div>
            </div>
          );
        }

        // Validate course has required properties
        if (!activeLearningCourse.modules || activeLearningCourse.modules.length === 0) {
          return (
            <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
              <div className="text-center space-y-4 p-8">
                <div className="w-12 h-12 rounded-full bg-amber-200 mx-auto" />
                <h2 className="text-lg font-semibold text-slate-900">No Modules Available</h2>
                <p className="text-sm text-slate-600">This course has no learning modules yet.</p>
                <button
                  onClick={() => {
                    setActiveLearningCourseId(null);
                    setActiveVideoModuleId(null);
                    setActiveTab('courses');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Back to Courses
                </button>
              </div>
            </div>
          );
        }

        const currentModule = activeLearningCourse.modules.find(m => m.id === activeVideoModuleId) || activeLearningCourse.modules[0];
        const currentModuleIndex = currentModule ? activeLearningCourse.modules.findIndex(m => m.id === currentModule.id) : 0;
        const embedUrl = currentModule ? getEmbeddableVideoUrl(currentModule.videoUrl) : null;
        const directVideoFile = currentModule ? isDirectVideoFile(currentModule.videoUrl) : false;
        const isCurrentModuleCompleted = currentModule ? activeLearningCompletedSet.has(currentModule.id) : false;
        const hasNextModule = currentModuleIndex < activeLearningCourse.modules.length - 1;
        const hasPrevModule = currentModuleIndex > 0;
        const courseTutor = tutors.find(t => t.id === activeLearningCourse.tutorId);

        return (
          <div className="w-full min-h-screen bg-white flex flex-col">
            {/* Top Learning Header - Sticky & Clean */}
            <div className="sticky top-0 z-40 bg-gradient-to-b from-white via-white to-white/90 border-b border-slate-200/50 shadow-sm backdrop-blur-sm flex-shrink-0">
              <div className="w-full px-4 sm:px-6 lg:px-8">
                <div className="py-4 space-y-4">
                  {/* Header Top Row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => {
                          setActiveLearningCourseId(null);
                          setActiveVideoModuleId(null);
                          setActiveTab('courses');
                        }}
                        className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
                        title="Back to Courses"
                      >
                        <ArrowRight className="w-5 h-5 rotate-180" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-black text-slate-900 truncate">{activeLearningCourse?.title || 'Course'}</h2>
                        <p className="text-xs text-slate-500 font-semibold">Module {currentModuleIndex + 1} of {activeLearningCourse?.modules?.length || 0}</p>
                      </div>
                    </div>

                    {/* Progress Bar Quick View */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${activeLearningProgress}%` }} />
                          </div>
                          <span className="text-sm font-bold text-indigo-600 w-8 text-right">{activeLearningProgress || 0}%</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">{activeLearningCompletedSet.size}/{activeLearningCourse?.modules?.length || 0}</span>
                      </div>
                    </div>

                    {/* Top Right Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isStudent && (
                        <button
                          onClick={() => handleUnenrollCourse(activeLearningCourse.id)}
                          className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors"
                          title="Unenroll from course"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Learning Content Grid */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-0 overflow-hidden">

              {/* Left: Video Player & Main Content (3 columns) */}
              <div className="lg:col-span-3 bg-white border-r border-slate-200 overflow-y-auto">
                {currentModule ? (
                  <div className="space-y-0">
                    {/* Video Player Container */}
                    <div className="relative bg-black aspect-video flex-col flex items-center justify-center group overflow-hidden">
                      {directVideoFile ? (
                        <>
                          <video
                            src={currentModule.videoUrl}
                            ref={(video) => {
                              videoRef.current = video;
                              if (video) video.playbackRate = Number(playbackSpeed);
                            }}
                            className="w-full h-full object-contain cursor-pointer"
                            onClick={() => {
                              if (videoRef.current) {
                                videoIsPlaying ? videoRef.current.pause() : videoRef.current.play();
                                setVideoIsPlaying(!videoIsPlaying);
                              }
                            }}
                            onPlay={() => setVideoIsPlaying(true)}
                            onPause={() => setVideoIsPlaying(false)}
                          />
                          {!videoIsPlaying && (
                            <button
                              onClick={() => {
                                videoRef.current?.play();
                                setVideoIsPlaying(true);
                              }}
                              className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-indigo-600/80 backdrop-blur flex items-center justify-center hover:bg-indigo-500 hover:scale-110 transition-all text-white border border-white/20 shadow-xl z-20"
                            >
                              <Play className="w-8 h-8 fill-current translate-x-1" />
                            </button>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-300 z-30">
                            <div className="flex flex-col gap-2 w-full">
                              <div className="flex items-center gap-4 text-white">
                                <button
                                  onClick={() => {
                                    const currentIndex = activeLearningCourse.modules.findIndex(m => m.id === currentModule.id);
                                    if (currentIndex > 0) setActiveVideoModuleId(activeLearningCourse.modules[currentIndex - 1].id);
                                  }}
                                  disabled={activeLearningCourse.modules.findIndex(m => m.id === currentModule.id) === 0}
                                  className="p-1 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-white"
                                >
                                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                                </button>
                                <button
                                  onClick={() => {
                                    if (videoRef.current) {
                                      videoIsPlaying ? videoRef.current.pause() : videoRef.current.play();
                                      setVideoIsPlaying(!videoIsPlaying);
                                    }
                                  }}
                                  className="w-10 h-10 flex items-center justify-center bg-indigo-600 rounded-full hover:bg-indigo-500 transition-colors"
                                >
                                  {videoIsPlaying ? (
                                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                  ) : (
                                    <Play className="w-4 h-4 fill-current translate-x-0.5" />
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    const currentIndex = activeLearningCourse.modules.findIndex(m => m.id === currentModule.id);
                                    if (currentIndex < activeLearningCourse.modules.length - 1) setActiveVideoModuleId(activeLearningCourse.modules[currentIndex + 1].id);
                                  }}
                                  disabled={activeLearningCourse.modules.findIndex(m => m.id === currentModule.id) === activeLearningCourse.modules.length - 1}
                                  className="p-1 hover:text-indigo-400 disabled:opacity-30 disabled:hover:text-white"
                                >
                                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                                </button>
                                <div className="flex items-center gap-2 group/vol">
                                  <button
                                    onClick={() => {
                                      setVideoMuted(!videoMuted);
                                      if (videoRef.current) videoRef.current.muted = !videoMuted;
                                    }}
                                    className="p-1 hover:text-indigo-400"
                                  >
                                    {videoMuted || videoVolume === 0 ? (
                                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path fillRule="evenodd" clipRule="evenodd" d="M11 5L6 9H2v6h4l5 4V5zm2 14v-2c2.28 0 4-1.72 4-4s-1.72-4-4-4V7c3.31 0 6 2.69 6 6s-2.69 6-6 6zM13 3v2c4.42 0 8 3.58 8 8s-3.58 8-8 8v2c5.52 0 10-4.48 10-10S18.52 3 13 3z" /></svg>
                                    ) : (
                                      <Volume2 className="w-5 h-5" />
                                    )}
                                  </button>
                                  <input
                                    type="range"
                                    min="0" max="1" step="0.05"
                                    value={videoMuted ? 0 : videoVolume}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setVideoVolume(val);
                                      if (val > 0) setVideoMuted(false);
                                      if (videoRef.current) {
                                        videoRef.current.volume = val;
                                        videoRef.current.muted = val === 0;
                                      }
                                    }}
                                    className="w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 transition-all duration-300 cursor-pointer accent-indigo-500"
                                  />
                                </div>
                                <div className="flex-1"></div>
                                <select
                                  value={playbackSpeed}
                                  onChange={(e) => setPlaybackSpeed(e.target.value as any)}
                                  className="bg-black/60 border border-white/30 text-white text-xs font-semibold rounded px-2 py-1 appearance-none outline-none cursor-pointer backdrop-blur"
                                >
                                  <option value="0.75" className="bg-slate-900 text-white">0.75x</option>
                                  <option value="1" className="bg-slate-900 text-white">1.0x</option>
                                  <option value="1.25" className="bg-slate-900 text-white">1.25x</option>
                                  <option value="1.5" className="bg-slate-900 text-white">1.5x</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : embedUrl ? (
                        <>
                          <iframe
                            src={embedUrl}
                            title={currentModule.title}
                            className="w-full h-full pb-14"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                          <div className="absolute bottom-0 left-0 right-0 h-14 bg-slate-900 border-t border-white/10 flex items-center px-4 gap-4 text-white z-10 justify-between">
                            <div className="flex items-center gap-4">
                              <button
                                onClick={() => {
                                  const currentIndex = activeLearningCourse.modules.findIndex(m => m.id === currentModule.id);
                                  if (currentIndex > 0) setActiveVideoModuleId(activeLearningCourse.modules[currentIndex - 1].id);
                                }}
                                disabled={activeLearningCourse.modules.findIndex(m => m.id === currentModule.id) === 0}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-white/10"
                              >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg> Prev Lesson
                              </button>
                              <button
                                onClick={() => {
                                  const currentIndex = activeLearningCourse.modules.findIndex(m => m.id === currentModule.id);
                                  if (currentIndex < activeLearningCourse.modules.length - 1) setActiveVideoModuleId(activeLearningCourse.modules[currentIndex + 1].id);
                                }}
                                disabled={activeLearningCourse.modules.findIndex(m => m.id === currentModule.id) === activeLearningCourse.modules.length - 1}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-30 disabled:hover:bg-indigo-600"
                              >
                                Next Lesson <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-center px-6">
                          <div className="space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-50/10 flex items-center justify-center mx-auto text-indigo-300">
                              <Video className="w-8 h-8" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">External Video Module</p>
                              <p className="text-sm text-slate-400 mt-1">This module is hosted externally.</p>
                            </div>
                            {currentModule.videoUrl && currentModule.videoUrl !== '#' && (
                              <a
                                href={currentModule.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                              >
                                Open Video <ArrowRight className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Module Content Area with Tabs */}
                    <div className="bg-white">
                      {/* Sticky Tab Navigation */}
                      <div className="sticky top-[72px] z-30 bg-white border-b border-slate-200 px-6 sm:px-8">
                        <div className="flex items-center gap-8 overflow-x-auto">
                          {(['overview', 'notes', 'resources', 'qa'] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setLearningContentTab(tab)}
                              className={`py-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${learningContentTab === tab
                                  ? 'border-indigo-600 text-indigo-600'
                                  : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                              {tab === 'overview' && 'Overview'}
                              {tab === 'notes' && 'Notes'}
                              {tab === 'resources' && 'Resources'}
                              {tab === 'qa' && 'Q&A'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Tab Content */}
                      <div className="p-6 sm:p-8">
                        {/* Overview Tab */}
                        {learningContentTab === 'overview' && (
                          <div className="space-y-8">
                            {/* Module Header */}
                            <div className="space-y-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Module {currentModuleIndex + 1}</span>
                                  <h3 className="text-3xl font-black text-slate-900 mt-2">{currentModule.title}</h3>
                                </div>
                                <button
                                  onClick={() => {
                                    const updated = new Set(bookmarkedModules);
                                    if (updated.has(currentModule.id)) {
                                      updated.delete(currentModule.id);
                                    } else {
                                      updated.add(currentModule.id);
                                    }
                                    setBookmarkedModules(updated);
                                  }}
                                  className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all ${bookmarkedModules.has(currentModule.id)
                                      ? 'border-amber-400 bg-amber-50 text-amber-500'
                                      : 'border-slate-200 bg-white text-slate-400 hover:border-amber-200'
                                    }`}
                                  title="Bookmark this module"
                                >
                                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M5 3v18l7-5 7 5V3H5z" />
                                  </svg>
                                </button>
                              </div>
                            </div>

                            {/* Module Description */}
                            <div className="prose prose-sm max-w-none">
                              <p className="text-slate-600 leading-relaxed">{activeLearningCourse.description}</p>
                            </div>

                            {/* Module Resources Section */}
                            {currentModule.resources.length > 0 && (
                              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                <h4 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">Module Resources</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {currentModule.resources.map((resource, idx) => (
                                    <button
                                      key={`${currentModule.id}-resource-${idx}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setLearningContentTab('resources');
                                      }}
                                      className="w-full text-left p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-between gap-3 group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors flex-shrink-0">
                                          <LinkIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-900 truncate">{resource.name || `Resource ${idx + 1}`}</p>
                                          <p className="text-[10px] text-slate-500 truncate">
                                            {resource.url.startsWith('/uploads/') ? 'Local file' : 'External resource'} - click to view in Resources
                                          </p>
                                        </div>
                                      </div>
                                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Instructor Section */}
                            {courseTutor && (
                              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-6 border border-indigo-100">
                                <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-4">About Your Instructor</h4>
                                <div className="flex items-start gap-4">
                                  <img
                                    src={courseTutor.avatar || 'https://via.placeholder.com/150'}
                                    alt={getTutorDisplayName(courseTutor)}
                                    className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0"
                                  />
                                  <div className="flex-1">
                                    <h5 className="text-lg font-black text-slate-900">{getTutorDisplayName(courseTutor)}</h5>
                                    <p className="text-sm text-indigo-700 font-semibold">{`${courseTutor.teachingLevel} Tutor`}</p>
                                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{courseTutor.bio}</p>
                                    <button
                                      onClick={() => {
                                        setViewingTutorId(courseTutor.id);
                                        setActiveTab('tutorProfile');
                                      }}
                                      className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    >
                                      View Profile <ArrowRight className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Module Actions */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200">
                              <button
                                onClick={() => {
                                  handleToggleModuleProgress(activeLearningCourse, currentModule.id, !isCurrentModuleCompleted);
                                }}
                                className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 font-bold uppercase tracking-widest transition-all ${isCurrentModuleCompleted
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                                  }`}
                              >
                                <svg className={`w-5 h-5 ${isCurrentModuleCompleted ? '' : 'hidden'}`} fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                                {isCurrentModuleCompleted ? 'Completed' : 'Mark as Complete'}
                              </button>

                              {hasNextModule && (
                                <button
                                  onClick={() => setActiveVideoModuleId(activeLearningCourse.modules[currentModuleIndex + 1].id)}
                                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl border border-slate-300 font-bold uppercase tracking-widest transition-all"
                                >
                                  Next Module <ArrowRight className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Notes Tab */}
                        {learningContentTab === 'notes' && (
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-bold text-slate-900">Your Notes</label>
                                <button
                                  onClick={() => {
                                    setNotesSaved({ ...notesSaved, [currentModule.id]: true });
                                    setTimeout(() => setNotesSaved(prev => ({ ...prev, [currentModule.id]: false })), 2000);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-indigo-600/20"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  {notesSaved[currentModule.id] ? 'Saved ✓' : 'Save Notes'}
                                </button>
                              </div>
                              <textarea
                                value={studentNotes[currentModule.id] || ''}
                                onChange={(e) => setStudentNotes({ ...studentNotes, [currentModule.id]: e.target.value })}
                                placeholder="Add your personal notes here..."
                                rows={10}
                                className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-sm resize-none"
                              />
                            </div>
                            <div className="text-xs text-slate-500 text-right">
                              {studentNotes[currentModule.id]?.length || 0} characters
                            </div>
                          </div>
                        )}

                        {/* Resources Tab */}
                        {learningContentTab === 'resources' && (
                          <div className="space-y-4">
                            {currentModule.resources.length > 0 ? (
                              <div className="grid grid-cols-1 gap-3">
                                {currentModule.resources.map((resource, idx) => {
                                  const resolvedResourceUrl = resolveCourseLearningResourceUrl(resource.url);
                                  return (
                                  <a
                                    key={`${currentModule.id}-res-${idx}`}
                                    href={resolvedResourceUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={resource.url.startsWith('/uploads/') ? resource.name : undefined}
                                    onClick={(event) => {
                                      if (!resolvedResourceUrl) {
                                        event.preventDefault();
                                      }
                                    }}
                                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-between group"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                        <LinkIcon className="w-5 h-5" />
                                      </div>
                                      <div>
                                        <p className="font-bold text-slate-900">{resource.name || `Resource ${idx + 1}`}</p>
                                        <p className="text-xs text-slate-500">
                                          {resource.url.startsWith('/uploads/') ? 'Uploaded local file' : 'External resource URL'}
                                        </p>
                                      </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                  </a>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                  <LinkIcon className="w-6 h-6" />
                                </div>
                                <p className="text-slate-500 font-semibold">No resources available for this module</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Q&A Tab */}
                        {learningContentTab === 'qa' && (
                          <div className="space-y-4">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                              <p className="text-sm text-indigo-900 font-semibold">Have questions?</p>
                              <p className="text-sm text-indigo-700 mt-1">Connect with your instructor through the course or check the discussion section.</p>
                            </div>
                            <div className="text-center py-12">
                              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <MessageCircle className="w-6 h-6" />
                              </div>
                              <p className="text-slate-500 font-semibold">Discussion feature coming soon</p>
                              <p className="text-xs text-slate-400 mt-1">You'll be able to ask questions and interact with peers here</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Video className="w-8 h-8" />
                    </div>
                    <p className="text-slate-600 font-semibold">No modules available</p>
                  </div>
                )}
              </div>

              {/* Right Sidebar: Course Content & Certificate (1 column) */}
              <div className="lg:col-span-1 border-l border-slate-200 bg-slate-50 overflow-y-auto">
                {/* Course Contents */}
                <div className="p-4 sm:p-6 space-y-4 border-b border-slate-200 sticky top-[72px] bg-white/70 backdrop-blur-sm z-20 lg:static lg:bg-slate-50 lg:backdrop-blur-none">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Course Content</h3>
                  <div className="space-y-2">
                    {activeLearningCourse.modules.map((module, index) => {
                      const isActive = currentModule?.id === module.id;
                      const isCompleted = activeLearningCompletedSet.has(module.id);
                      const isBookmarked = bookmarkedModules.has(module.id);

                      return (
                        <button
                          key={module.id}
                          onClick={() => setActiveVideoModuleId(module.id)}
                          className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all border ${isActive
                              ? 'bg-indigo-100 border-indigo-300 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                        >
                          <div className="flex-shrink-0 mt-0.5">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCompleted
                                ? 'bg-emerald-500 text-white'
                                : isActive
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-300 text-slate-600'
                              }`}>
                              {isCompleted ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                index + 1
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>
                              Lesson {index + 1}
                            </p>
                            <h4 className={`text-sm font-bold truncate mt-0.5 ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                              {module.title}
                            </h4>
                            {isBookmarked && (
                              <div className="flex items-center gap-1 mt-1">
                                <svg className="w-3 h-3 text-amber-500 fill-current" viewBox="0 0 24 24">
                                  <path d="M5 3v18l7-5 7 5V3H5z" />
                                </svg>
                                <span className="text-[10px] text-amber-600 font-semibold">Bookmarked</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Certificate Card */}
                <div className="p-4 sm:p-6 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                      <Award className="w-4 h-4" />
                    </div>
                    <h4 className="font-black text-slate-900">Certificate</h4>
                  </div>

                  {/* Certificate Status */}
                  <div className={`p-3 rounded-lg text-center ${isActiveLearningComplete ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-100 border border-slate-200'}`}>
                    <p className={`text-xs font-bold uppercase tracking-widest ${isActiveLearningComplete ? 'text-emerald-700' : 'text-slate-600'}`}>
                      {isActiveLearningComplete ? 'Unlocked' : 'In Progress'}
                    </p>
                    <p className={`text-lg font-black mt-1 ${isActiveLearningComplete ? 'text-emerald-900' : 'text-slate-700'}`}>
                      {activeLearningProgress}%
                    </p>
                  </div>

                  {/* Certificate Description */}
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Complete all {activeLearningCourse.modules.length} modules to earn your TutorSphere certificate.
                  </p>

                  {isActiveLearningComplete && (
                    <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      Your certificate now opens in the updated preview modal.
                    </p>
                  )}

                  {/* Download Button */}
                  <div>
                    {activeLearningEnrollment ? (
                      <button
                        onClick={() => handleShowCertificateModal(activeLearningEnrollment, activeLearningCourse.title)}
                        disabled={!isActiveLearningComplete}
                        className={`w-full py-3 rounded-lg border-2 font-bold uppercase tracking-widest text-sm transition-all ${isActiveLearningComplete
                            ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                            : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                      >
                        {isActiveLearningComplete ? 'View Certificate' : 'Complete First'}
                      </button>
                    ) : (
                      <p className="text-[10px] text-rose-600 font-bold text-center">Error loading certificate</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main Content - All other tabs */}
      {activeTab !== 'courseLearning' && (
        <main className={activeTab === 'quizzes'
          ? 'h-[calc(100dvh-4rem)] overflow-hidden'
          : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
          {activeTab === 'tutorProfile' && viewingTutorId && (
            <TutorProfilePage
              tutorId={viewingTutorId}
              initialTutor={tutorsWithLiveStats.find(t => t.id === viewingTutorId)}
              reviews={allReviews}
              courses={courses.filter(c => c.tutorId === viewingTutorId)}
              onBack={() => {
                setViewingTutorId(null);
                setActiveTab('tutors');
              }}
              onBookSession={(id) => {
                setBookingTutorId(id);
                setActiveTab('tutorBooking');
              }}
              isLoggedIn={!!currentUser}
              isStudent={isStudent}
            />
          )}

          {activeTab === 'tutorBooking' && bookingTutorId && (
            <TutorBookingPage
              tutor={tutorsWithLiveStats.find(t => t.id === bookingTutorId) || null}
              onBack={() => {
                setBookingTutorId(null);
                if (viewingTutorId === bookingTutorId) {
                  setActiveTab('tutorProfile');
                } else {
                  setViewingTutorId(bookingTutorId);
                  setActiveTab('tutorProfile');
                }
              }}
              onConfirmBooking={async (bookingIntent) => {
                const tutor = tutors.find(t => t.id === bookingTutorId);
                if (!tutor) {
                  return { ok: false, error: 'Tutor details are unavailable right now.' };
                }

                return handleBookSession(tutor, bookingIntent);
              }}
            />
          )}

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
                    Master STEM & ICT with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Expert Tutors</span>
                  </h1>
                  <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                    Connect with top-tier educators in STEM and ICT. Personalized learning paths powered by AI.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setActiveTab('tutors')}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all flex items-center gap-2 group"
                    >
                      Find Your Tutor <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button
                      onClick={() => setActiveTab('registerSelect')}
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
                          <div className="relative h-6 overflow-hidden min-w-[200px]">
                            <AnimatePresence mode="popLayout">
                              <motion.h4
                                key={currentSubjectIndex}
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="font-bold text-slate-900 absolute left-0"
                              >
                                {DISPLAY_SUBJECTS[currentSubjectIndex]}
                              </motion.h4>
                            </AnimatePresence>
                          </div>
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

              {/* Features Section */}
              <section className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6 lg:pr-12">
                  <div className="inline-flex items-center gap-2 bg-purple-50 px-4 py-2 rounded-full border border-purple-100">
                    <span className="text-xs font-bold text-purple-700 uppercase tracking-widest">Platform Features</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                    Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">succeed</span>
                  </h2>
                  <p className="text-lg text-slate-600 leading-relaxed">
                    Discover a comprehensive suite of powerful tools and features designed to enhance your learning experience, connect you with the best educators, and accelerate your academic progress.
                  </p>
                  <button onClick={() => setActiveTab('tutors')} className="mt-4 bg-purple-50 text-purple-700 font-bold px-6 py-3 rounded-xl hover:bg-purple-100 transition-colors inline-flex items-center gap-2">
                    Explore Tutors <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative h-[500px] overflow-hidden rounded-[2rem] p-2 bg-slate-50/50">
                  <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none" />
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none" />

                  <motion.div
                    animate={{ y: ['0%', '-50%'] }}
                    transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    className="flex flex-col gap-6"
                  >
                    {[
                      { icon: <User className="text-purple-600 w-6 h-6" />, title: 'Find Expert Tutors', desc: 'Connect with verified professionals who match your unique learning style.' },
                      { icon: <Calendar className="text-purple-600 w-6 h-6" />, title: 'Easy Booking', desc: 'Seamlessly schedule time slots that fit perfectly into your busy calendar.' },
                      { icon: <Star className="text-purple-600 w-6 h-6" />, title: 'Ratings & Reviews', desc: 'Make informed decisions with transparent feedback from our community.' },
                      { icon: <GraduationCap className="text-purple-600 w-6 h-6" />, title: 'Structured Courses', desc: 'Follow structured curricula designed for optimal comprehension and retention.' },
                      { icon: <CheckCircle className="text-purple-600 w-6 h-6" />, title: 'Earn Certificates', desc: 'Showcase your achievements with verifiable digital completion certificates.' },
                      { icon: <Bot className="text-purple-600 w-6 h-6" />, title: 'AI Assistant', desc: 'Get instant answers and personalized support powered by advanced AI.' },
                      { icon: <User className="text-purple-600 w-6 h-6" />, title: 'Find Expert Tutors', desc: 'Connect with verified professionals who match your unique learning style.' },
                      { icon: <Calendar className="text-purple-600 w-6 h-6" />, title: 'Easy Booking', desc: 'Seamlessly schedule time slots that fit perfectly into your busy calendar.' },
                      { icon: <Star className="text-purple-600 w-6 h-6" />, title: 'Ratings & Reviews', desc: 'Make informed decisions with transparent feedback from our community.' },
                      { icon: <GraduationCap className="text-purple-600 w-6 h-6" />, title: 'Structured Courses', desc: 'Follow structured curricula designed for optimal comprehension and retention.' },
                      { icon: <CheckCircle className="text-purple-600 w-6 h-6" />, title: 'Earn Certificates', desc: 'Showcase your achievements with verifiable digital completion certificates.' },
                      { icon: <Bot className="text-purple-600 w-6 h-6" />, title: 'AI Assistant', desc: 'Get instant answers and personalized support powered by advanced AI.' }
                    ].map((f, i) => (
                      <div key={i} className="bg-white p-6 rounded-3xl border border-purple-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-purple-500/10 flex items-start gap-5 min-h-[140px] flex-shrink-0">
                        <div className="bg-purple-50 p-4 rounded-2xl flex-shrink-0">
                          {f.icon}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold mb-2 text-slate-900">{f.title}</h3>
                          <p className="text-slate-600 leading-relaxed">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </section>
              {/* Featured Tutors Section */}
              <section className="space-y-12">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 mb-2">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Expert Instructors</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">Meet Our Top Rated Tutors</h2>
                  <p className="text-lg text-slate-600 max-w-2xl mx-auto">Learn from the best minds in the country. Our tutors are verified experts with proven track records in guiding students to success.</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {[...tutorsWithLiveStats].sort((a, b) => b.rating - a.rating).slice(0, 4).map(tutor => (
                    <motion.div
                      whileHover={{ y: -8 }}
                      key={tutor.id}
                      className="relative bg-white rounded-[1.5rem] border border-slate-100 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(79,70,229,0.1)] transition-all duration-300 group cursor-pointer flex flex-col"
                      onClick={() => {
                        setViewingTutorId(tutor.id);
                        setActiveTab('tutorProfile');
                      }}
                    >
                      <div className="relative h-56 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/65 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
                        <img src={tutor.avatar} alt={getTutorDisplayName(tutor)} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />

                        {/* Subject Badge */}
                        <div className="absolute top-4 right-4 z-20">
                          <span className="bg-white/95 backdrop-blur-md text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg border border-indigo-100">
                            {tutor.subjects[0]}
                          </span>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col bg-white">
                        <div className="mb-4 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-lg text-slate-900 block w-full leading-tight whitespace-normal break-words">
                              {getTutorDisplayName(tutor)}
                            </h3>
                            {tutor.isVerified && (
                              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" fill="currentColor" opacity="0.2" />
                            )}
                          </div>
                          <p className="text-sm font-bold text-indigo-600 truncate block w-full">
                            {tutor.qualifications}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 mb-4">
                          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                          <span className="font-bold text-slate-800">{tutor.rating.toFixed(1)}</span>
                          <span className="text-sm font-medium text-slate-500">({tutor.reviewCount} reviews)</span>
                        </div>

                        <p className="text-sm text-slate-600 line-clamp-2 mb-6 flex-1 leading-relaxed">
                          {tutor.bio}
                        </p>

                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-center">
                          <div className="text-indigo-600 font-bold text-sm flex items-center gap-1 group-hover:text-indigo-700 transition-colors">
                            View Profile <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="text-center pt-6">
                  <button
                    onClick={() => setActiveTab('tutors')}
                    className="inline-flex items-center justify-center gap-2 bg-white text-indigo-600 border-2 border-indigo-100 font-bold px-8 py-4 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 hover:gap-3 transition-all shadow-sm group"
                  >
                    View All Educators <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'tutors' && (
            <FindTutorsPage
              tutors={tutorsWithLiveStats}
              isLoading={isLoadingTutors}
              stemSubjects={STEM_SUBJECTS}
              onViewProfile={(tutorId) => {
                setViewingTutorId(tutorId);
                setActiveTab('tutorProfile');
              }}
            />
          )}

          {activeTab === 'courses' && (
            <div className="space-y-12">
              {isLoadingCourses ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
              ) : isTutor ? (
                <TutorCourseManagePage
                  courses={courses}
                  currentTutor={currentTutor}
                  courseEnrollments={courseEnrollments}
                  enrollmentCountByCourseId={enrollmentCountByCourseId}
                  courseForm={courseForm}
                  setCourseForm={setCourseForm}
                  editingCourseId={editingCourseId}
                  isSavingCourse={isSavingCourse}
                  isLoading={isLoadingCourses}
                  isUploadingCourseThumbnail={isUploadingCourseThumbnail}
                  uploadingModuleVideoKey={uploadingModuleVideoKey}
                  uploadingModuleResourcesKey={uploadingModuleResourcesKey}
                  stemSubjects={STEM_SUBJECTS}
                  onSaveCourse={handleSaveCourse}
                  onDeleteCourse={handleDeleteCourse}
                  onEditCourse={handleEditCourse}
                  onResetCourseForm={handleResetCourseForm}
                  onAddCourseModule={handleAddCourseModule}
                  onRemoveCourseModule={handleRemoveCourseModule}
                  onUpdateCourseModule={handleUpdateCourseModule}
                  onUploadCourseThumbnail={handleUploadCourseThumbnail}
                  onUploadModuleVideo={handleUploadModuleVideo}
                  onUploadModuleResources={handleUploadModuleResources}
                  onUpdateCourseModuleResource={handleUpdateCourseModuleResource}
                  onRemoveCourseModuleResource={handleRemoveCourseModuleResource}
                  onAddUrlModuleResource={handleAddUrlModuleResource}
                  getEditableModuleKey={getEditableModuleKey}
                  onGetCourseCoupons={handleGetCourseCoupons}
                  onCreateCourseCoupon={handleCreateCourseCoupon}
                  onUpdateCourseCoupon={handleUpdateCourseCoupon}
                  onToggleCourseCouponStatus={handleToggleCourseCouponStatus}
                  onDeleteCourseCoupon={handleDeleteCourseCoupon}
                />
              ) : (
                <CourseBrowsingPage
                  courses={courses}
                  tutors={tutors}
                  isStudent={isStudent}
                  isLoggedIn={!!currentUser}
                  isLoading={isLoadingCourses}
                  studentEnrollmentByCourseId={studentEnrollmentByCourseId}
                  enrollmentCountByCourseId={enrollmentCountByCourseId}
                  courseSearchQuery={courseSearchQuery}
                  courseCategoryFilter={courseCategoryFilter}
                  onSetCourseSearchQuery={setCourseSearchQuery}
                  onSetCourseCategoryFilter={setCourseCategoryFilter}
                  onEnrollCourse={handleEnrollCourse}
                  onValidateCourseCoupon={handleValidateCourseCoupon}
                  onOpenCourseLearning={handleOpenCourseLearning}
                  onViewCertificate={handleShowCertificateModal}
                  stemSubjects={STEM_SUBJECTS}
                />
              )}
            </div>
          )}

          {activeTab === 'resources' && (
            isTutor ? (
              <TutorResourceManagePage
                resources={resources}
                currentTutorId={currentTutor?.id}
                resourceForm={resourceForm}
                setResourceForm={setResourceForm}
                editingResourceId={editingResourceId}
                isSavingResource={isSavingResource}
                isUploadingResourceFile={isUploadingResourceFile}
                resourceUploadStatus={resourceUploadStatus}
                resourceUploadProgress={resourceUploadProgress}
                resourceUploadStatusMessage={resourceUploadStatusMessage}
                onClearResourceUploadFeedback={clearResourceUploadFeedback}
                resourceInputMode={resourceInputMode}
                setResourceInputMode={setResourceInputMode}
                resourceUploadFile={resourceUploadFile}
                setResourceUploadFile={setResourceUploadFile}
                isLoading={isLoadingResources}
                stemSubjects={STEM_SUBJECTS}
                onSaveResource={handleSaveResource}
                onDeleteResource={handleDeleteResource}
                onEditResource={handleEditResource}
                onResetResourceForm={handleResetResourceForm}
              />
            ) : (
              <StudentResourceLibraryPage
                resources={resources}
                isLoggedIn={!!currentUser}
                isLoading={isLoadingResources}
                stemSubjects={STEM_SUBJECTS}
              />
            )
          )}

          {activeTab === 'quizzes' && (
            <div className="h-full w-full bg-slate-50 overflow-hidden">
              <QuizChatbotPage currentUser={currentUser} />
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
                            onClick={() => setNewQuestion({ ...newQuestion, subject: s })}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${newQuestion.subject === s
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
                        onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
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

          {activeTab === 'forgotPassword' && !currentUser && (
            <ForgotPasswordPage
              onBackToHome={() => setActiveTab('home')}
              onOpenLogin={handleOpenLoginFromForgotPassword}
            />
          )}

          {activeTab === 'registerSelect' && !currentUser && (
            <RegistrationSelectionPage
              onSelectRole={(role) => setActiveTab(role === 'student' ? 'registerStudent' : 'registerTutor')}
            />
          )}

          {activeTab === 'registerStudent' && !currentUser && (
            <GetStartedSection
              initialRole="student"
              showRoleSelector={false}
              onBack={() => setActiveTab('registerSelect')}
              onAccountCreated={(user) => {
                setCurrentUser(user);
                setActiveTab('dashboard');
                setSessionPersistence('session');
                setRememberMe(false);
                persistSession({ user, activeTab: 'dashboard' }, 'session');
              }}
              STEM_SUBJECTS={STEM_SUBJECTS}
            />
          )}

          {activeTab === 'registerTutor' && !currentUser && (
            <GetStartedSection
              initialRole="tutor"
              showRoleSelector={false}
              onBack={() => setActiveTab('registerSelect')}
              onAccountCreated={(user, tutorProfile) => {
                if (tutorProfile) {
                  setTutors((prevTutors) => {
                    const existingIndex = prevTutors.findIndex((tutor) => tutor.id === tutorProfile.id);
                    if (existingIndex === -1) {
                      return [tutorProfile, ...prevTutors];
                    }

                    return prevTutors.map((tutor) => (
                      tutor.id === tutorProfile.id ? tutorProfile : tutor
                    ));
                  });
                }

                setCurrentUser(user);
                setActiveTab('dashboard');
                setSessionPersistence('session');
                setRememberMe(false);
                persistSession({ user, activeTab: 'dashboard' }, 'session');
              }}
              STEM_SUBJECTS={STEM_SUBJECTS}
            />
          )}

          {activeTab === 'register' && isTutor && currentUser && (
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl text-indigo-600 mb-6">
                  <Edit className="w-8 h-8" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Edit Profile</h2>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">Manage your professional identity, qualifications, subjects, and availability to attract the right students.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-8">

                {/* Profile Image Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <Camera className="w-6 h-6 text-indigo-600" />
                    Profile Picture
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <div className="relative group cursor-pointer" onClick={() => setShowImageModal(true)}>
                      {currentUserAvatarUrl ? (
                        <img
                          src={currentUserAvatarUrl}
                          alt="Avatar"
                          className="w-32 h-32 rounded-full object-cover border-4 border-indigo-50 shadow-xl"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-32 h-32 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-xl border-4 border-indigo-50" style={{ display: currentUserAvatarUrl ? 'none' : 'flex' }}>
                        {(currentUser.firstName + ' ' + currentUser.lastName).charAt(0)}
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Avatar</h4>
                      <p className="text-slate-500 text-sm mb-4">Upload a professional headshot to build trust with students. PNG or JPEG, max 5MB.</p>
                      <button
                        type="button"
                        onClick={() => setShowImageModal(true)}
                        className="px-6 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors text-sm"
                      >
                        Change Picture
                      </button>
                    </div>
                  </div>
                </div>

                {/* Profile Info Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <User className="w-6 h-6 text-indigo-600" />
                    Basic Information
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">First Name</label>
                      <input
                        type="text"
                        value={profileData.firstName}
                        onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="Jane"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Last Name</label>
                      <input
                        type="text"
                        value={profileData.lastName}
                        onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="email"
                          value={currentUser.email}
                          disabled
                          className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 font-medium cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Phone Number (Optional)</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={profileData.phone}
                          onChange={e => handleProfilePhoneChange(e.target.value)}
                          className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                          placeholder="+94771234567"
                          inputMode="tel"
                        />
                      </div>
                      <p className="text-xs text-slate-400">Use Sri Lankan format: +94XXXXXXXXX</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Professional Bio</label>
                    <textarea
                      required
                      value={profileData.bio}
                      onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all resize-none min-h-[140px]"
                      placeholder="Tell students about yourself, your teaching experience, methodology, and what makes your classes unique..."
                    />
                  </div>
                </div>

                {/* Education & Qualifications Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                      <Award className="w-6 h-6 text-indigo-600" />
                      Education & Rates
                    </h3>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-3 md:col-span-2">
                      <label className="text-sm font-bold text-slate-700">Highest Qualifications</label>
                      <textarea
                        required
                        value={profileData.education}
                        onChange={e => setProfileData({ ...profileData, education: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all min-h-[100px]"
                        placeholder="e.g. BSc in Computer Science, University of Colombo&#10;MSc in AI, Stanford University"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Hourly Rate (LKR)</label>
                      <div className="relative">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">LKR</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={profileData.pricePerHour}
                          onChange={e => setProfileData({ ...profileData, pricePerHour: parseFloat(e.target.value) || 0 })}
                          className="w-full pl-16 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                          placeholder="2500.00"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Primary Teaching Level</label>
                      <select
                        required
                        value={profileData.teachingLevel}
                        onChange={e => setProfileData({ ...profileData, teachingLevel: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all appearance-none"
                      >
                        <option value="" disabled>Select your primary audience</option>
                        <option value="School">School Level</option>
                        <option value="University">University Level</option>
                        <option value="School and University">School and University</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Subjects Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-3">
                    <BookOpen className="w-6 h-6 text-indigo-600" />
                    Subjects Taught
                  </h3>
                  <p className="text-slate-500 mb-6">Select the STEM/ICT subjects you are qualified to teach.</p>

                  <div className="flex flex-wrap gap-3">
                    {STEM_SUBJECTS.map(s => {
                      const isSelected = profileData.subjects.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            const newSubs = isSelected
                              ? profileData.subjects.filter(x => x !== s)
                              : [...profileData.subjects, s];
                            setProfileData({ ...profileData, subjects: newSubs });
                          }}
                          className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${isSelected
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                            }`}
                        >
                          {isSelected ? <CheckCircle className="w-4 h-4 text-indigo-600" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Availability Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-indigo-600" />
                        Availability
                      </h3>
                      <p className="text-slate-500 mt-2">Manage your regular weekly schedule for tutoring sessions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University') {
                          setActiveTab('manageAvailability');
                        } else {
                          alert('Advanced schedule manager is currently available for School level tutors only.');
                        }
                      }}
                      className="hidden sm:flex items-center gap-2 bg-slate-50 text-indigo-600 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                    >
                      <Edit className="w-4 h-4" /> Manage Slots
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {availabilityByDay.map(({ day, count }, i) => (
                      <div key={day} className={`flex flex-col items-center p-4 rounded-2xl border-2 ${count > 0 ? 'border-indigo-100 bg-indigo-50/30' : i < 5 ? 'border-indigo-100 bg-indigo-50/20' : 'border-slate-100 bg-slate-50'}`}>
                        <span className="text-sm font-bold text-slate-700 mb-2">{day}</span>
                        {count > 0 ? (
                          <span className="text-xs font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">{count} Slot{count > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Off</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University') {
                        setActiveTab('manageAvailability');
                      } else {
                        alert('Advanced schedule manager is currently available for School level tutors only.');
                      }
                    }}
                    className="w-full sm:hidden mt-4 flex items-center justify-center gap-2 bg-slate-50 text-indigo-600 px-5 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                  >
                    <Edit className="w-4 h-4" /> Manage Slots
                  </button>
                </div>

                {/* Submit Actions */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="flex-[2] bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isUpdatingProfile ? (
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving Changes...
                      </span>
                    ) : (
                      <>
                        Save Profile Updates
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Danger Zone */}
                <div className="bg-rose-50/60 border border-rose-200 rounded-[2rem] p-6 md:p-7">
                  <h3 className="text-xl font-black text-rose-700 mb-2">Danger Zone</h3>
                  <p className="text-sm text-rose-700/90 mb-5">
                    Deleting your account is permanent and cannot be undone.
                    {currentUser.role === 'tutor'
                      ? ' Your tutor profile and learning content records will be removed.'
                      : ' Your bookings and learning records will be removed.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || isUpdatingProfile}
                    className="px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'dashboard' && currentUser && isTutor && (
            <div className="space-y-8">
              <div className="rounded-[2.5rem] border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 shadow-xl shadow-slate-900/20">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Tutor Workspace</h2>
                    <p className="text-slate-300 mt-2 max-w-2xl">
                      Manage your sessions, profile, content, and performance from a clean SaaS-style dashboard.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('earnings')}
                    className="px-5 py-3 rounded-2xl bg-white text-slate-900 font-black text-sm uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Open Tutor Revenue Dashboard
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
                  <button onClick={() => setActiveTab('register')} className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <p className="font-black text-white">Profile & Qualifications</p>
                    <p className="text-xs text-slate-300 mt-1">Update professional tutor profile</p>
                  </button>
                  <button onClick={() => setActiveTab('settings')} className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <p className="font-black text-white">Settings</p>
                    <p className="text-xs text-slate-300 mt-1">Account and teaching preferences</p>
                  </button>
                  {(profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University') && (
                    <button onClick={() => setActiveTab('manageAvailability')} className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                      <p className="font-black text-white">Manage Availability</p>
                      <p className="text-xs text-slate-300 mt-1">Control session calendar slots</p>
                    </button>
                  )}
                  <button onClick={() => setActiveTab('courses')} className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <p className="font-black text-white">Course Management</p>
                    <p className="text-xs text-slate-300 mt-1">Publish and manage courses</p>
                  </button>
                  <button onClick={() => setActiveTab('resources')} className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <p className="font-black text-white">Resource Management</p>
                    <p className="text-xs text-slate-300 mt-1">Upload and manage learning assets</p>
                  </button>
                  <button onClick={() => setActiveTab('earnings')} className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <p className="font-black text-white">Tutor Revenue Dashboard</p>
                    <p className="text-xs text-slate-300 mt-1">Open earnings analytics and payment history page</p>
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
                    className="text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <p className="font-black text-white">Session Link Sharing</p>
                    <p className="text-xs text-slate-300 mt-1">Copy and share latest meeting link</p>
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Sessions</p>
                  <p className="text-2xl font-black text-slate-900 mt-2">{tutorDashboardBookings.length}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Upcoming Sessions</p>
                  <p className="text-2xl font-black text-indigo-700 mt-2">
                    {tutorDashboardBookings.filter((booking) => booking.status !== 'cancelled' && !isPastSession(booking)).length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending Actions</p>
                  <p className="text-2xl font-black text-amber-600 mt-2">
                    {tutorDashboardBookings.filter((booking) => booking.status === 'pending').length}
                  </p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Courses</p>
                  <p className="text-2xl font-black text-cyan-700 mt-2">{myTutorCourses.length}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resources</p>
                  <p className="text-2xl font-black text-emerald-700 mt-2">{myTutorResources.length}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Average Rating</p>
                  <p className="text-2xl font-black text-slate-900 mt-2">{tutorAverageRatingFromReviews.toFixed(1)}</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div>
                    <h3 className="font-black text-2xl text-slate-900">Tutor Revenue Dashboard</h3>
                    <p className="text-slate-500 mt-2 max-w-2xl">
                      Earnings, payment history, source breakdown, and revenue charts are available on a dedicated page.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('earnings')}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all"
                  >
                    Go to Tutor Revenue Dashboard
                  </button>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                  <h3 className="font-black text-2xl text-slate-900">Session Management</h3>
                  <div className="flex flex-wrap items-end gap-3">
                    <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {filteredTutorBookings.length} sessions shown
                    </span>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                      <select
                        value={tutorBookingStatusFilter}
                        onChange={(event) => setTutorBookingStatusFilter(event.target.value as BookingStatusFilter)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-widest bg-white text-slate-700"
                      >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time</span>
                      <select
                        value={tutorSessionTimelineFilter}
                        onChange={(event) => setTutorSessionTimelineFilter(event.target.value as SessionTimelineFilter)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-widest bg-white text-slate-700"
                      >
                        <option value="all">Any Time</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="past">Past</option>
                      </select>
                    </label>
                  </div>
                </div>

                {filteredTutorBookings.length === 0 ? (
                  <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-500">No sessions match your filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTutorBookings.map((booking) => {
                      const isLoading = activeBookingActionId === booking.id;
                      const paymentStatus = getBookingPaymentStatus(booking);
                      const isPaidBooking = paymentStatus === 'paid';
                      const canComplete = booking.status === 'confirmed' && isPaidBooking;
                      const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed';
                      const canReschedule = booking.status !== 'cancelled' && booking.status !== 'completed' && canStudentManageBeforeStart(booking);
                      const canSubmitMeetingLink = isPaidBooking && booking.status !== 'cancelled' && booking.status !== 'completed';
                      const canStartMeeting = booking.status === 'confirmed' && isPaidBooking && isValidMeetingLink(booking.meetingLink);

                      return (
                        <div key={booking.id} className="relative rounded-3xl border border-slate-200 bg-slate-50 p-5 pr-14 space-y-4">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleHideBookingForCurrentUser(booking)}
                            className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 flex items-center justify-center"
                            aria-label="Hide session card"
                            title="Hide session card"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                            <div>
                              <p className="text-lg font-black text-slate-900">{booking.subject} Session</p>
                              <p className="text-xs font-semibold text-slate-500 mt-1">Session ID: {booking.id}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getBookingPaymentPillClassName(paymentStatus)}`}>
                                payment {paymentStatus}
                              </span>
                              <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                                {booking.status}
                              </span>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</p>
                              <p className="font-bold text-slate-800 mt-1">{booking.date}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time Slot</p>
                              <p className="font-bold text-slate-800 mt-1">{booking.timeSlot || 'Not specified'}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3 xl:col-span-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Student</p>
                              <p className="font-bold text-slate-800 mt-1">{getBookingStudentName(booking)}</p>
                            </div>
                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meeting Link</p>
                              <p className={`font-bold mt-1 ${isValidMeetingLink(booking.meetingLink) ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {isValidMeetingLink(booking.meetingLink) ? 'Ready' : 'Not submitted'}
                              </p>
                            </div>
                          </div>

                          {paymentStatus === 'failed' && (
                            <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                              {booking.paymentFailureReason || 'Payment failed for this booking. Ask the student to retry checkout.'}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isLoading || !canComplete}
                              onClick={() => handleTutorBookingStatusChange(booking, 'completed')}
                              className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              Mark as Completed
                            </button>
                            <button
                              type="button"
                              disabled={isLoading || !canCancel}
                              onClick={() => handleTutorBookingStatusChange(booking, 'cancelled')}
                              className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                              Cancel Booking
                            </button>
                            <button
                              type="button"
                              disabled={isLoading || !canReschedule}
                              onClick={() => handleTutorRescheduleBooking(booking)}
                              className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              disabled={isLoading || !canSubmitMeetingLink}
                              onClick={() => handleTutorMeetingLinkUpdate(booking)}
                              className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                            >
                              Submit Meeting Link
                            </button>
                            {canStartMeeting ? (
                              <a
                                href={booking.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700"
                              >
                                Start Meeting
                              </a>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-300 text-slate-600"
                              >
                                Start Meeting
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-black text-2xl text-slate-900">Performance</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('earnings')}
                    className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
                  >
                    Open Tutor Revenue Dashboard
                  </button>
                </div>

                <div className="grid sm:grid-cols-3 gap-4 mb-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sessions Completed</p>
                    <p className="text-2xl font-black text-emerald-600 mt-2">{tutorCompletedPaidBookings.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Average Rating</p>
                    <p className="text-2xl font-black text-indigo-600 mt-2">{tutorAverageRatingFromReviews.toFixed(1)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Written Feedback</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">{tutorPerformanceFeedback.length}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-500">Recent Feedback</h4>
                  {tutorPerformanceFeedback.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      No written feedback yet.
                    </p>
                  ) : (
                    tutorPerformanceFeedback.map((review) => (
                      <div key={review.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-black text-slate-900">{review.studentName}</p>
                          <span className="text-xs font-black text-amber-600">{review.rating.toFixed(1)} / 5</span>
                        </div>
                        <p className="text-sm text-slate-600">{review.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && currentUser && isStudent && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200">
                      {(currentUser.firstName + ' ' + currentUser.lastName).charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">Student Dashboard</h2>
                      <p className="text-slate-500 font-medium">Focus on sessions, courses, certificates, and learning progress.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Browse Courses
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-8">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Booked Sessions</p>
                    <p className="text-3xl font-black text-slate-900 mt-2">{studentDashboardBookings.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ready to Join</p>
                    <p className="text-3xl font-black text-emerald-600 mt-2">
                      {studentDashboardBookings.filter((booking) => isValidMeetingLink(booking.meetingLink)).length}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Enrolled Courses</p>
                    <p className="text-3xl font-black text-indigo-600 mt-2">{studentEnrolledCourses.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg. Progress</p>
                    <p className="text-3xl font-black text-violet-600 mt-2">
                      {studentEnrolledCourses.length
                        ? Math.round(
                          studentEnrolledCourses.reduce((sum, entry) => sum + entry.enrollment.progress, 0) /
                            studentEnrolledCourses.length
                        )
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid xl:grid-cols-5 gap-8">
                <div className="xl:col-span-3 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-2xl text-slate-900">My Sessions</h3>
                      <Calendar className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <span className="text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {filteredStudentBookings.length} sessions shown
                      </span>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                        <select
                          value={studentBookingStatusFilter}
                          onChange={(event) => setStudentBookingStatusFilter(event.target.value as BookingStatusFilter)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-widest bg-white text-slate-700"
                        >
                          <option value="all">All Statuses</option>
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Time</span>
                        <select
                          value={studentSessionTimelineFilter}
                          onChange={(event) => setStudentSessionTimelineFilter(event.target.value as SessionTimelineFilter)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-widest bg-white text-slate-700"
                        >
                          <option value="all">Any Time</option>
                          <option value="upcoming">Upcoming</option>
                          <option value="past">Past</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  {filteredStudentBookings.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold text-slate-500">No sessions match your filters.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredStudentBookings.map((booking) => {
                        const isLoading = activeBookingActionId === booking.id;
                        const isSubmittingRating = activeRatingActionBookingId === booking.id;
                        const paymentStatus = getBookingPaymentStatus(booking);
                        const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed' && canStudentManageBeforeStart(booking);
                        const hasValidMeetingLink = isValidMeetingLink(booking.meetingLink);
                        const canJoinMeeting = hasValidMeetingLink && booking.status !== 'cancelled';
                        const existingReview = studentReviewsBySessionId.get(booking.id);
                        const ratingDraft = sessionRatingDrafts[booking.id] || { rating: 0, feedback: '' };

                        return (
                          <div key={booking.id} className="relative rounded-3xl border border-slate-200 bg-slate-50 p-5 pr-14 space-y-4">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleHideBookingForCurrentUser(booking)}
                              className="absolute right-4 top-4 h-8 w-8 rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-60 flex items-center justify-center"
                              aria-label="Hide session card"
                              title="Hide session card"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                              <div>
                                <p className="text-lg font-black text-slate-900">{booking.subject} Session</p>
                                <p className="text-xs text-slate-500 font-semibold mt-1">
                                  {booking.date}
                                  {booking.timeSlot ? ` • ${booking.timeSlot}` : ''}
                                  {' • Tutor: '}
                                  {getBookingTutorName(booking)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getBookingPaymentPillClassName(paymentStatus)}`}>
                                  payment {paymentStatus}
                                </span>
                                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                                  {booking.status}
                                </span>
                              </div>
                            </div>

                            {!hasValidMeetingLink && paymentStatus === 'paid' && booking.status === 'confirmed' && (
                              <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                Waiting for tutor to submit a valid meeting link.
                              </p>
                            )}

                            {!canStudentManageBeforeStart(booking) && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                              <p className="text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                Session has started or passed. Cancel action is now disabled.
                              </p>
                            )}

                            <div className="flex flex-wrap gap-2">
                              {canCancel && (
                                <button
                                  type="button"
                                  disabled={isLoading}
                                  onClick={() => handleStudentCancelBooking(booking)}
                                  className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                                >
                                  Cancel Booking
                                </button>
                              )}

                              {canJoinMeeting ? (
                                <a
                                  href={booking.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700"
                                >
                                  Join Meeting
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-slate-300 text-slate-600"
                                >
                                  Join Meeting
                                </button>
                              )}
                            </div>

                            {booking.status === 'completed' && (
                              <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Rate This Session</p>

                                {existingReview ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map((value) => (
                                        <Star
                                          key={value}
                                          className={`w-4 h-4 ${value <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
                                        />
                                      ))}
                                    </div>
                                    <p className="text-sm text-slate-700">{existingReview.comment || 'Rating submitted.'}</p>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1">
                                      {[1, 2, 3, 4, 5].map((value) => (
                                        <button
                                          key={value}
                                          type="button"
                                          onClick={() =>
                                            setSessionRatingDrafts((prev) => ({
                                              ...prev,
                                              [booking.id]: {
                                                rating: value,
                                                feedback: prev[booking.id]?.feedback || '',
                                              },
                                            }))
                                          }
                                          className="p-0.5"
                                        >
                                          <Star
                                            className={`w-5 h-5 ${value <= ratingDraft.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
                                          />
                                        </button>
                                      ))}
                                    </div>
                                    <textarea
                                      value={ratingDraft.feedback}
                                      onChange={(event) =>
                                        setSessionRatingDrafts((prev) => ({
                                          ...prev,
                                          [booking.id]: {
                                            rating: prev[booking.id]?.rating || 0,
                                            feedback: event.target.value,
                                          },
                                        }))
                                      }
                                      placeholder="Optional feedback"
                                      rows={3}
                                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    />
                                    <button
                                      type="button"
                                      disabled={isSubmittingRating || ratingDraft.rating < 1}
                                      onClick={() => handleSubmitSessionRating(booking)}
                                      className="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                                    >
                                      {isSubmittingRating ? 'Submitting...' : 'Submit Rating'}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-2xl text-slate-900">Course Progress</h3>
                    <BookOpen className="w-5 h-5 text-slate-400" />
                  </div>

                  {studentEnrolledCourses.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold text-slate-500">No enrolled courses yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {studentEnrolledCourses.map(({ course, enrollment }) => {
                        const isCompleted = enrollment.progress >= 100;

                        return (
                          <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="font-bold text-slate-900 line-clamp-2">{course.title}</p>
                            <p className="text-xs font-semibold text-slate-500 mt-1">{course.subject}</p>

                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Progress</span>
                                <span className="text-sm font-black text-indigo-600">{enrollment.progress}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                  style={{ width: `${enrollment.progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenCourseLearning(course.id)}
                                className="px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-indigo-600 text-white hover:bg-indigo-700"
                              >
                                Continue Learning
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isCompleted) {
                                    alert('Complete all modules to unlock your certificate.');
                                    return;
                                  }
                                  handleShowCertificateModal(enrollment, course.title);
                                }}
                                disabled={!isCompleted}
                                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest ${
                                  isCompleted
                                    ? 'bg-amber-500 text-white hover:bg-amber-600'
                                    : 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                }`}
                              >
                                View Certificate
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'earnings' && currentUser && isTutor && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Tutor Revenue Dashboard</h2>
                    <p className="text-slate-500 mt-1">
                      Production-style payout analytics from paid/completed sessions and paid course purchases.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {tutorHasSessionEarningMethod && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
                          Session Revenue
                        </span>
                      )}
                      {tutorHasCourseEarningMethod && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700">
                          Course Revenue
                        </span>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                        Net after {(PLATFORM_FEE_RATE * 100).toFixed(0)}% platform fee
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenWithdrawalModal}
                      disabled={isLoadingWithdrawalData || withdrawalAvailableBalance <= 0}
                      className={`px-5 py-2.5 rounded-xl font-bold transition-colors ${
                        isLoadingWithdrawalData || withdrawalAvailableBalance <= 0
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      Withdraw Money
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('dashboard')}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50"
                    >
                      Back to Dashboard
                    </button>
                  </div>
                </div>

                {withdrawalNotice && (
                  <div
                    className={`mt-5 rounded-2xl border px-4 py-3 ${
                      withdrawalNotice.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    <p className="text-sm font-bold">{withdrawalNotice.message}</p>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Net Earnings</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">{formatLkr(withdrawalTotalEarnings)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Withdrawn Amount</p>
                    <p className="text-2xl font-black text-emerald-700 mt-2">{formatLkr(withdrawalWithdrawnAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Pending Withdrawals</p>
                    <p className="text-2xl font-black text-amber-700 mt-2">{formatLkr(withdrawalPendingAmount)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Available Balance</p>
                    <p className="text-2xl font-black text-emerald-600 mt-2">{formatLkr(withdrawalAvailableBalance)}</p>
                  </div>
                </div>

                {isLoadingWithdrawalData && (
                  <p className="text-xs font-semibold text-slate-500 mt-3">Loading withdrawal balances...</p>
                )}

                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Session Earnings</p>
                    <p className="text-2xl font-black text-indigo-700 mt-2">{formatLkr(tutorSessionNetEarnings)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Course Earnings</p>
                    <p className="text-2xl font-black text-cyan-700 mt-2">{formatLkr(tutorCourseNetEarnings)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Completed Sessions</p>
                    <p className="text-2xl font-black text-emerald-600 mt-2">{tutorCompletedPaidBookings.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paid Course Sales</p>
                    <p className="text-2xl font-black text-cyan-600 mt-2">{tutorPaidCourseEnrollmentsCount}</p>
                  </div>
                </div>

                {!tutorHasSessionEarningMethod && !tutorHasCourseEarningMethod && (
                  <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5">
                    <p className="text-sm font-bold text-slate-700">No earning method is active yet.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Start with session bookings, paid course sales, or both. Analytics will appear automatically.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-2xl text-slate-900 mb-5">Monthly Earnings Trend</h3>
                  {tutorRecentMonthlyEarnings.length === 0 ? (
                    <div className="text-center py-14 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
                      <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-bold text-slate-500">No paid earnings available yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 items-end">
                      {tutorRecentMonthlyEarnings.map((entry) => {
                        const chartMax = Math.max(
                          ...tutorRecentMonthlyEarnings.map((point) => point.totalNetEarnings),
                          1
                        );
                        const sessionHeight = Math.max(10, Math.round((entry.sessionNetEarnings / chartMax) * 150));
                        const courseHeight = Math.max(10, Math.round((entry.courseNetEarnings / chartMax) * 150));

                        return (
                          <div key={entry.monthKey} className="flex flex-col items-center gap-2">
                            <div className="h-44 w-full rounded-xl border border-slate-100 bg-slate-50 p-2 flex items-end justify-center">
                              <div className="flex items-end gap-1">
                                {tutorHasSessionEarningMethod && (
                                  <div
                                    className="w-4 rounded-md bg-indigo-500"
                                    style={{ height: `${sessionHeight}px` }}
                                    title={`Session earnings: ${formatLkr(entry.sessionNetEarnings)}`}
                                  />
                                )}
                                {tutorHasCourseEarningMethod && (
                                  <div
                                    className="w-4 rounded-md bg-cyan-500"
                                    style={{ height: `${courseHeight}px` }}
                                    title={`Course earnings: ${formatLkr(entry.courseNetEarnings)}`}
                                  />
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] font-black text-slate-700">{entry.month}</p>
                            <p className="text-[10px] font-semibold text-slate-500">{formatLkr(entry.totalNetEarnings)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-2xl text-slate-900 mb-5">Earnings Source Breakdown</h3>
                  <div className="space-y-4">
                    {tutorHasSessionEarningMethod && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Sessions</p>
                          <p className="text-xs font-black text-indigo-700">{tutorSessionSharePercent}%</p>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${tutorSessionSharePercent}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatLkr(tutorSessionNetEarnings)} • {tutorCompletedPaidBookings.length} completed sessions
                        </p>
                      </div>
                    )}

                    {tutorHasCourseEarningMethod && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500">Course Sales</p>
                          <p className="text-xs font-black text-cyan-700">{tutorCourseSharePercent}%</p>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${tutorCourseSharePercent}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatLkr(tutorCourseNetEarnings)} • {tutorPaidCourseEnrollmentsCount} paid enrollments
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Paid Transactions</p>
                    <p className="text-2xl font-black text-slate-900 mt-1">{tutorPaidTransactions.length}</p>
                  </div>
                </div>
              </div>

              <div className="grid xl:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-2xl text-slate-900 mb-5">Earnings by Sessions</h3>
                  {!tutorHasSessionEarningMethod ? (
                    <p className="text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      Session-based earning method is not active for this tutor profile.
                    </p>
                  ) : tutorPaidSessionTransactions.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      No paid and completed session transactions yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...tutorPaidSessionTransactions]
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 8)
                        .map((transaction) => (
                          <div key={transaction.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-900">{transaction.itemName}</p>
                                <p className="text-xs text-slate-500 mt-1">{transaction.dateLabel} • {transaction.studentName}</p>
                              </div>
                              <p className="text-sm font-black text-emerald-700">{formatLkr(transaction.netEarning)}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <h3 className="font-black text-2xl text-slate-900 mb-5">Earnings by Course Sales</h3>
                  {!tutorHasCourseEarningMethod ? (
                    <p className="text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      Course-based earning method is not active for this tutor profile.
                    </p>
                  ) : tutorPaidCourseTransactions.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      No paid course purchase transactions yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {[...tutorPaidCourseTransactions]
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 8)
                        .map((transaction) => (
                          <div key={transaction.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-900">{transaction.itemName}</p>
                                <p className="text-xs text-slate-500 mt-1">{transaction.dateLabel} • {transaction.studentName}</p>
                              </div>
                              <p className="text-sm font-black text-emerald-700">{formatLkr(transaction.netEarning)}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-black text-2xl text-slate-900">Withdrawal History</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Review payout requests, statuses, and processing updates in one place.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenWithdrawalModal}
                    disabled={isLoadingWithdrawalData || withdrawalAvailableBalance <= 0}
                    className={`px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-colors ${
                      isLoadingWithdrawalData || withdrawalAvailableBalance <= 0
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    Withdraw Money
                  </button>
                </div>

                {isLoadingWithdrawalData ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((row) => (
                      <div key={row} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : withdrawalRequests.length === 0 ? (
                  <div className="text-center py-14 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-500">No withdrawal requests yet.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Submit your first request once your available balance is above zero.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[900px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Requested</th>
                          <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Amount</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Payout Method</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Details</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Processed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {withdrawalRequests.map((request) => {
                          const requestedDate = Date.parse(String(request.requestedAt || ''));
                          const processedDate = Date.parse(String(request.processedAt || ''));

                          return (
                            <tr key={request.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                                {Number.isNaN(requestedDate)
                                  ? 'N/A'
                                  : new Date(requestedDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                              </td>
                              <td className="px-4 py-3 text-sm font-black text-slate-900 text-right whitespace-nowrap">
                                {formatLkr(request.amount)}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">
                                {getWithdrawalPayoutMethodLabel(request.payoutMethodType)}
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]">
                                <p className="font-semibold line-clamp-2">{request.payoutMethodDetails || 'N/A'}</p>
                                {request.note && <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">Note: {request.note}</p>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getWithdrawalStatusPillClassName(request.status)}`}>
                                  {getWithdrawalStatusLabel(request.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-600 whitespace-nowrap">
                                {Number.isNaN(processedDate)
                                  ? '--'
                                  : new Date(processedDate).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                    })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-black text-2xl text-slate-900">Payment History</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Stripe-style transaction timeline for session bookings and course purchases.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</span>
                      <select
                        value={tutorTransactionFilter}
                        onChange={(event) => setTutorTransactionFilter(event.target.value as TutorTransactionFilter)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-widest bg-white text-slate-700"
                      >
                        <option value="all">All</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="refunded_or_cancelled">Refunded/Cancelled</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sort</span>
                      <select
                        value={tutorTransactionSortOrder}
                        onChange={(event) => setTutorTransactionSortOrder(event.target.value as TutorTransactionSortOrder)}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold uppercase tracking-widest bg-white text-slate-700"
                      >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                      </select>
                    </label>
                  </div>
                </div>

                {isLoadingUserData ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((row) => (
                      <div key={row} className="h-14 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : filteredTutorTransactions.length === 0 ? (
                  <div className="text-center py-14 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-500">No transactions found for current filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full min-w-[960px]">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Date</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Session/Course</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Student</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Payment Type</th>
                          <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Amount</th>
                          <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Platform Fee</th>
                          <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Net Earning</th>
                          <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredTutorTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap">{transaction.dateLabel}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-bold text-slate-900">{transaction.itemName}</p>
                              {transaction.paymentReference && (
                                <p className="text-[11px] text-slate-500 mt-1">Ref: {transaction.paymentReference}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-700">{transaction.studentName}</td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">
                                {transaction.paymentType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-black text-slate-900 text-right">{formatLkr(transaction.amount)}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-600 text-right">{formatLkr(transaction.platformFee)}</td>
                            <td className="px-4 py-3 text-sm font-black text-emerald-700 text-right">{formatLkr(transaction.netEarning)}</td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getTransactionStatusPillClassName(transaction.status)}`}>
                                {getTransactionStatusLabel(transaction.status)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && currentUser && (
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl text-indigo-600 mb-6">
                  <Edit className="w-8 h-8" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Account Settings</h2>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">Manage your profile information, preferences, and account details.</p>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-8">

                {/* Profile Image Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                    <Camera className="w-6 h-6 text-indigo-600" />
                    Profile Picture
                  </h3>
                  <div className="flex flex-col sm:flex-row items-center gap-8">
                    <div className="relative group cursor-pointer" onClick={() => setShowImageModal(true)}>
                      {currentUserAvatarUrl ? (
                        <img
                          src={currentUserAvatarUrl}
                          alt="Avatar"
                          className="w-32 h-32 rounded-full object-cover border-4 border-indigo-50 shadow-xl"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="w-32 h-32 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-xl border-4 border-indigo-50" style={{ display: currentUserAvatarUrl ? 'none' : 'flex' }}>
                        {(currentUser.firstName + ' ' + currentUser.lastName).charAt(0)}
                      </div>
                      <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">Avatar</h4>
                      <p className="text-slate-500 text-sm mb-4">Upload a professional headshot. PNG or JPEG, max 5MB.</p>
                      <button
                        type="button"
                        onClick={() => setShowImageModal(true)}
                        className="px-6 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors text-sm"
                      >
                        Change Picture
                      </button>
                    </div>
                  </div>
                </div>

                {/* Profile Info Section */}
                <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <h3 className="text-2xl font-bold text-slate-900 mb-8 flex items-center gap-3">
                    <User className="w-6 h-6 text-indigo-600" />
                    Basic Information
                  </h3>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">First Name</label>
                      <input
                        type="text"
                        required
                        value={profileData.firstName}
                        onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="Jane"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Last Name</label>
                      <input
                        type="text"
                        required
                        value={profileData.lastName}
                        onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="email"
                          value={currentUser.email}
                          disabled
                          className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 font-medium cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700">Phone Number (Optional)</label>
                      <div className="relative">
                        <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="tel"
                          value={profileData.phone}
                          onChange={e => handleProfilePhoneChange(e.target.value)}
                          className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                          placeholder="+94771234567"
                          inputMode="tel"
                        />
                      </div>
                      <p className="text-xs text-slate-400">Use Sri Lankan format: +94XXXXXXXXX</p>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">Password & Security</h4>
                        <p className="text-sm text-slate-500">Update your account password to keep your profile secure.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (showChangePasswordPanel) {
                            setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          }
                          setShowChangePasswordPanel((prev) => !prev);
                        }}
                        className="px-5 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors"
                      >
                        {showChangePasswordPanel ? 'Close Password Panel' : 'Change Password'}
                      </button>
                    </div>

                    {showChangePasswordPanel && (
                      <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 space-y-4">
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Password</label>
                            <input
                              type="password"
                              value={changePasswordData.currentPassword}
                              onChange={(e) => setChangePasswordData({ ...changePasswordData, currentPassword: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                              placeholder="Current password"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Password</label>
                            <input
                              type="password"
                              value={changePasswordData.newPassword}
                              onChange={(e) => setChangePasswordData({ ...changePasswordData, newPassword: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                              placeholder="New password"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirm Password</label>
                            <input
                              type="password"
                              value={changePasswordData.confirmPassword}
                              onChange={(e) => setChangePasswordData({ ...changePasswordData, confirmPassword: e.target.value })}
                              className={`w-full px-4 py-3 rounded-xl border outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white ${changePasswordData.confirmPassword.length > 0 && changePasswordData.newPassword !== changePasswordData.confirmPassword
                                  ? 'border-rose-300'
                                  : 'border-slate-200'
                                }`}
                              placeholder="Confirm password"
                            />
                          </div>
                        </div>

                        {changePasswordData.confirmPassword.length > 0 && (
                          <p className={`text-sm font-semibold ${changePasswordData.newPassword === changePasswordData.confirmPassword ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {changePasswordData.newPassword === changePasswordData.confirmPassword
                              ? 'Passwords match.'
                              : 'Passwords do not match.'}
                          </p>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setShowChangePasswordPanel(false);
                              setChangePasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                            }}
                            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={isChangingPassword}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          >
                            {isChangingPassword ? 'Updating Password...' : 'Update Password'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {currentUser.role === 'tutor' && (
                    <div className="space-y-3 mt-6">
                      <label className="text-sm font-bold text-slate-700">Professional Bio</label>
                      <textarea
                        required
                        value={profileData.bio}
                        onChange={e => setProfileData({ ...profileData, bio: e.target.value })}
                        className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all resize-none min-h-[140px]"
                        placeholder="Tell students about yourself, your teaching experience, methodology, and what makes your classes unique..."
                      />
                    </div>
                  )}
                </div>

                {currentUser.role === 'tutor' && (
                  <>
                    {/* Education & Qualifications Section */}
                    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                          <Award className="w-6 h-6 text-indigo-600" />
                          Education & Rates
                        </h3>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3 md:col-span-2">
                          <label className="text-sm font-bold text-slate-700">Highest Qualifications</label>
                          <textarea
                            required
                            value={profileData.education}
                            onChange={e => setProfileData({ ...profileData, education: e.target.value })}
                            className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all min-h-[100px]"
                            placeholder="e.g. BSc in Computer Science, University of Colombo&#10;MSc in AI, Stanford University"
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-bold text-slate-700">Hourly Rate (LKR)</label>
                          <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">LKR</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              value={profileData.pricePerHour}
                              onChange={e => setProfileData({ ...profileData, pricePerHour: parseFloat(e.target.value) || 0 })}
                              className="w-full pl-16 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                              placeholder="2500.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-sm font-bold text-slate-700">Primary Teaching Level</label>
                          <select
                            required
                            value={profileData.teachingLevel}
                            onChange={e => setProfileData({ ...profileData, teachingLevel: e.target.value })}
                            className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all appearance-none"
                          >
                            <option value="" disabled>Select your primary audience</option>
                            <option value="School">School Level</option>
                            <option value="University">University Level</option>
                            <option value="School and University">School and University</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Subjects Section */}
                    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      <h3 className="text-2xl font-bold text-slate-900 mb-3 flex items-center gap-3">
                        <BookOpen className="w-6 h-6 text-indigo-600" />
                        Subjects Taught
                      </h3>
                      <p className="text-slate-500 mb-6">Select the STEM/ICT subjects you are qualified to teach.</p>

                      <div className="flex flex-wrap gap-3">
                        {STEM_SUBJECTS.map(s => {
                          const isSelected = profileData.subjects.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                const newSubs = isSelected
                                  ? profileData.subjects.filter(x => x !== s)
                                  : [...profileData.subjects, s];
                                setProfileData({ ...profileData, subjects: newSubs });
                              }}
                              className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${isSelected
                                  ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm'
                                  : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:bg-slate-50'
                                }`}
                            >
                              {isSelected ? <CheckCircle className="w-4 h-4 text-indigo-600" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Availability Section */}
                    <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                            <Calendar className="w-6 h-6 text-indigo-600" />
                            Availability
                          </h3>
                          <p className="text-slate-500 mt-2">Manage your regular weekly schedule for tutoring sessions.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University') {
                              setActiveTab('manageAvailability');
                            } else {
                              alert('Advanced schedule manager is currently available for School level tutors only.');
                            }
                          }}
                          className="hidden sm:flex items-center gap-2 bg-slate-50 text-indigo-600 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                        >
                          <Edit className="w-4 h-4" /> Manage Slots
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                        {availabilityByDay.map(({ day, count }, i) => (
                          <div key={day} className={`flex flex-col items-center p-4 rounded-2xl border-2 ${count > 0 ? 'border-indigo-100 bg-indigo-50/30' : i < 5 ? 'border-indigo-100 bg-indigo-50/20' : 'border-slate-100 bg-slate-50'}`}>
                            <span className="text-sm font-bold text-slate-700 mb-2">{day}</span>
                            {count > 0 ? (
                              <span className="text-xs font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">{count} Slot{count > 1 ? 's' : ''}</span>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">Off</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'School and University') {
                            setActiveTab('manageAvailability');
                          } else {
                            alert('Advanced schedule manager is currently available for School level tutors only.');
                          }
                        }}
                        className="w-full sm:hidden mt-4 flex items-center justify-center gap-2 bg-slate-50 text-indigo-600 px-5 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors"
                      >
                        <Edit className="w-4 h-4" /> Manage Slots
                      </button>
                    </div>
                  </>
                )}

                {/* Submit Actions */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab('dashboard')}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-lg text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    Back to Dashboard
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="flex-[2] bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 disabled:opacity-50 shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  >
                    {isUpdatingProfile ? (
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      <>
                        Save Settings
                        <Check className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Danger Zone */}
                <div className="bg-rose-50/60 border border-rose-200 rounded-[2rem] p-6 md:p-7">
                  <h3 className="text-xl font-black text-rose-700 mb-2">Danger Zone</h3>
                  <p className="text-sm text-rose-700/90 mb-5">
                    Deleting your account is permanent and cannot be undone.
                    {currentUser.role === 'tutor'
                      ? ' Your tutor profile and learning content records will be removed.'
                      : ' Your bookings and learning records will be removed.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || isUpdatingProfile}
                    className="px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Manage Availability Page */}
          {activeTab === 'manageAvailability' && isTutor && currentUser && (
            <TutorAvailabilityManagePage
              tutor={currentTutor}
              onSaveAvailability={handleSaveTutorAvailability}
              onBack={() => setActiveTab('dashboard')}
            />
          )}

          {/* About Page */}
          {activeTab === 'about' && (
            <AboutPage setActiveTab={setActiveTab} />
          )}

        </main>
      )}

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
                    <h3 className="text-2xl sm:text-3xl lg:text-3xl font-bold text-white leading-tight mb-4 sm:mb-5">Welcome back to your learning journey.</h3>
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
                      {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                      {authMode === 'login'
                        ? 'Enter your details to access your account.'
                        : 'Join TutorSphere and start your learning journey.'
                      }
                    </p>
                  </div>

                  {authMode === 'signup' && (
                    <>
                      {/* Social Logins */}
                      <div className="grid grid-cols-1 gap-3 mb-6">
                        <button type="button" className="flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all font-bold text-sm text-slate-700">
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
                    </>
                  )}

                  <form onSubmit={handleAuth} className="space-y-4">
                    {authMode === 'signup' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">First Name</label>
                            <div className="relative group">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                              <input
                                required
                                type="text"
                                value={authData.firstName || ''}
                                onChange={e => setAuthData({ ...authData, firstName: e.target.value })}
                                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                                placeholder="Enter first name"
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
                                value={authData.lastName || ''}
                                onChange={e => setAuthData({ ...authData, lastName: e.target.value })}
                                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                                placeholder="Enter last name"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          required
                          type="email"
                          value={authData.email}
                          onChange={e => setAuthData({ ...authData, email: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                          placeholder="Enter email address"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                      </div>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                        <input
                          required
                          type="password"
                          value={authData.password}
                          onChange={e => setAuthData({ ...authData, password: e.target.value })}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                          placeholder="••••••••"
                        />
                      </div>
                      {authMode === 'login' && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleOpenForgotPassword}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 uppercase tracking-wider"
                          >
                            Forgot Password?
                          </button>
                        </div>
                      )}
                    </div>
                    {authMode === 'signup' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <input
                            required
                            type="password"
                            value={authData.confirmPassword || ''}
                            onChange={e => setAuthData({ ...authData, confirmPassword: e.target.value })}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    )}

                    {authMode === 'login' && (
                      <div className="flex items-center gap-2 ml-1">
                        <input
                          type="checkbox"
                          id="remember"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="remember" className="text-xs text-slate-500 font-medium cursor-pointer">Remember me for 30 days</label>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all mt-3 active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {authMode === 'login' ? 'Sign In' : 'Sign Up'}
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </form>

                  <div className="mt-10 text-center">
                    <p className="text-slate-500 text-sm font-medium">
                      {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                      <button
                        type="button"
                        onClick={() => {
                          if (authMode === 'login') {
                            setRememberMe(false);
                            setActiveTab('registerSelect');
                          } else {
                            setRememberMe(false);
                            setAuthMode('login');
                          }
                        }}
                        className="ml-2 text-indigo-600 font-bold hover:text-indigo-700 transition-colors"
                      >
                        {authMode === 'login' ? 'Sign Up' : 'Sign In'}
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
                      <div className={`max-w-[80%] p-3 rounded-2xl text-sm relative group ${msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-100 text-slate-700 rounded-tl-none'
                        }`}>
                        <div className="whitespace-pre-line break-words">{msg.text}</div>
                        {msg.role === 'bot' && msg.meta !== 'typing' && (
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
                    disabled={isChatTyping}
                    className="flex-1 px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  <button type="submit" disabled={isChatTyping} className="bg-indigo-600 text-white p-2 rounded-xl disabled:opacity-60">
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
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 pt-16 pb-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
            <div className="lg:col-span-1 space-y-6">
              <div className="flex items-center gap-2 text-white">
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="text-xl font-bold tracking-tight">TutorSphere</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Connecting Sri Lankan students with verified STEM and ICT experts for a brighter academic future.
              </p>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-6">Platform</h4>
              <ul className="space-y-4 text-sm">
                <li><button onClick={() => setActiveTab('tutors')} className="hover:text-indigo-400 transition-colors">Find Tutors</button></li>
                <li><button onClick={() => setActiveTab('courses')} className="hover:text-indigo-400 transition-colors">Explore Courses</button></li>
                <li><button onClick={() => setIsChatOpen(true)} className="hover:text-indigo-400 transition-colors">Q&A Support</button></li>
                <li><button onClick={() => setActiveTab('registerSelect')} className="hover:text-indigo-400 transition-colors">Become a Tutor</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-6">Company</h4>
              <ul className="space-y-4 text-sm">
                <li><button onClick={() => setActiveTab('about')} className="hover:text-indigo-400 transition-colors">About Us</button></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-indigo-400 transition-colors">Terms of Service</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-6">Contact</h4>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>support@tutorsphere.lk</span>
                </li>
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>Colombo, Sri Lanka</span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>+94 11 234 5678</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex justify-center text-sm">
            <p>© {new Date().getFullYear()} TutorSphere. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* CERTIFICATE MODAL */}
      <CertificateModal
        isOpen={!!certificateModalData}
        onClose={() => setCertificateModalData(null)}
        onDownload={handleDownloadCertificate}
        enrollment={certificateModalData?.enrollment || null}
        courseTitle={certificateModalData?.courseTitle || ''}
        studentName={`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim()}
      />

      <AnimatePresence>
        {isWithdrawalModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[355] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleCloseWithdrawalModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="w-full max-w-lg rounded-3xl border border-emerald-200 bg-white shadow-2xl shadow-emerald-100/50 overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <form onSubmit={handleSubmitWithdrawalRequest}>
                <div className="p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">Request Withdrawal</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Submit a payout request from your available balance.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleCloseWithdrawalModal}
                      disabled={isSubmittingWithdrawal}
                      className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-60"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Available Balance</p>
                    <p className="text-xl font-black text-emerald-700 mt-1">{formatLkr(withdrawalAvailableBalance)}</p>
                  </div>

                  {withdrawalNotice?.type === 'error' && (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                      <p className="text-sm font-bold text-rose-700">{withdrawalNotice.message}</p>
                    </div>
                  )}

                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Amount (LKR)</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={withdrawalAvailableBalance > 0 ? withdrawalAvailableBalance : undefined}
                        value={withdrawalForm.amount}
                        onChange={(event) => setWithdrawalForm((prev) => ({ ...prev, amount: event.target.value }))}
                        placeholder="0.00"
                        className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500">Payout Method</span>
                      <select
                        value={withdrawalForm.payoutMethodType}
                        onChange={(event) =>
                          setWithdrawalForm((prev) => ({
                            ...prev,
                            payoutMethodType: event.target.value as WithdrawalRequest['payoutMethodType'],
                          }))
                        }
                        className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-bold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="paypal">PayPal</option>
                      </select>
                    </label>

                    {withdrawalForm.payoutMethodType === 'bank_transfer' && (
                      <div className="grid sm:grid-cols-2 gap-4">
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Account Holder Name</span>
                          <input
                            type="text"
                            value={withdrawalForm.bankAccountHolder}
                            onChange={(event) =>
                              setWithdrawalForm((prev) => ({
                                ...prev,
                                bankAccountHolder: event.target.value,
                              }))
                            }
                            placeholder="Account holder full name"
                            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                            required
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Bank Name</span>
                          <input
                            type="text"
                            value={withdrawalForm.bankName}
                            onChange={(event) =>
                              setWithdrawalForm((prev) => ({
                                ...prev,
                                bankName: event.target.value,
                              }))
                            }
                            placeholder="e.g. Commercial Bank"
                            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                            required
                          />
                        </label>

                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Branch</span>
                          <input
                            type="text"
                            value={withdrawalForm.bankBranch}
                            onChange={(event) =>
                              setWithdrawalForm((prev) => ({
                                ...prev,
                                bankBranch: event.target.value,
                              }))
                            }
                            placeholder="e.g. Colombo Fort"
                            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                            required
                          />
                        </label>

                        <label className="block sm:col-span-2">
                          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Account Number</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={withdrawalForm.bankAccountNumber}
                            onChange={(event) =>
                              setWithdrawalForm((prev) => ({
                                ...prev,
                                bankAccountNumber: event.target.value,
                              }))
                            }
                            placeholder="Enter account number"
                            className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                            required
                          />
                        </label>
                      </div>
                    )}

                    {withdrawalForm.payoutMethodType === 'paypal' && (
                      <label className="block">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">PayPal Email</span>
                        <input
                          type="email"
                          value={withdrawalForm.paypalEmail}
                          onChange={(event) =>
                            setWithdrawalForm((prev) => ({
                              ...prev,
                              paypalEmail: event.target.value,
                            }))
                          }
                          placeholder="name@example.com"
                          className="mt-2 w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 font-semibold outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500"
                          required
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseWithdrawalModal}
                      disabled={isSubmittingWithdrawal}
                      className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingWithdrawal || isLoadingWithdrawalData || withdrawalAvailableBalance <= 0}
                      className={`px-5 py-2.5 rounded-xl font-black uppercase tracking-widest transition-colors ${
                        isSubmittingWithdrawal || isLoadingWithdrawalData || withdrawalAvailableBalance <= 0
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      {isSubmittingWithdrawal ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bankTransferEtaNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[358] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBankTransferEtaNotice(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="w-full max-w-md rounded-3xl border border-indigo-200 bg-white shadow-2xl shadow-indigo-100/60 overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xl font-black text-slate-900">Bank Transfer Requested</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{bankTransferEtaNotice}</p>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBankTransferEtaNotice(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bookingCancelNotice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[360] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBookingCancelNotice(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="w-full max-w-md rounded-3xl border border-emerald-200 bg-white shadow-2xl shadow-emerald-100/60 overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="p-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>

                <div className="mt-4 space-y-2">
                  <p className="text-xl font-black text-slate-900">Booking Cancelled</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{bookingCancelNotice}</p>
                </div>

                <div className="mt-6 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingCancelNotice(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
