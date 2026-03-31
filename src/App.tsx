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
  MessageCircle
} from 'lucide-react';
import Markdown from 'react-markdown';
import CountUp from 'react-countup';
import { localService } from './services/localService';
import { apiService } from './services/apiService';

import { Tutor, User as AppUser, Question, Booking, Course, Resource, SkillLevel, StudyPlan, Review, Quiz, TimeSlot, CourseEnrollment } from './types';
import { TutorProfilePage } from './components/pages/TutorProfilePage';
import { GetStartedSection } from "./components/pages/GetStartedSection";
import { TutorBookingPage } from './components/pages/TutorBookingPage';
import { MOCK_TUTORS, MOCK_COURSES, MOCK_RESOURCES } from './data/mockData';
import { RegistrationSelectionPage } from './components/pages/RegistrationSelectionPage';
import { AboutPage } from './components/pages/AboutPage';
import { TutorAvailabilityManagePage } from './components/pages/TutorAvailabilityManagePage';
import { CourseBrowsingPage } from './components/pages/CourseBrowsingPage';

const STEM_SUBJECTS = ['Maths', 'Science', 'Engineering', 'Tech', 'ICT'];

type Tab = 'home' | 'tutors' | 'questions' | 'manageAvailability' | 'courses' | 'courseLearning' | 'resources' | 'quizzes' | 'registerSelect' | 'registerStudent' | 'registerTutor' | 'register' | 'dashboard' | 'settings' | 'tutorProfile' | 'tutorBooking' | 'about';

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
  register: 'Profile',
  dashboard: 'Dashboard',
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
      'registerSelect',
      'registerStudent',
      'registerTutor',
      'about'
    ];
  }

  if (user.role === 'student') {
    return ['home', 'tutors', 'questions', 'courses', 'resources', 'dashboard', 'settings', 'about'];
  }

  if (user.role === 'tutor') {
    return ['home', 'dashboard', 'manageAvailability', 'register', 'courses', 'resources', 'settings', 'about'];
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

type EditableCourseModule = {
  id?: string;
  title: string;
  videoUrl: string;
  resourcesInput: string;
};

const createEmptyEditableModule = (): EditableCourseModule => ({
  title: '',
  videoUrl: '',
  resourcesInput: '',
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
  const [activeBookingActionId, setActiveBookingActionId] = useState<string | null>(null);

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

  // Load user and activeTab from localStorage on app start
  useEffect(() => {
    const storedSession = localStorage.getItem('session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        setCurrentUser(session.user);
        const restoredTab: Tab = session.activeTab || 'home';
        setActiveTab(isInternalTab(restoredTab) ? 'home' : restoredTab);
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
    if (activeTab === 'registerSelect' || activeTab === 'registerStudent' || activeTab === 'registerTutor') {
      setShowAuthModal(false);
      setAuthMode('login');
    }
  }, [activeTab]);

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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [userCourses, setUserCourses] = useState<string[]>([]);
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollment[]>([]);
  const [courseForm, setCourseForm] = useState(createInitialCourseForm);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [resourceForm, setResourceForm] = useState(createInitialResourceForm);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [activeLearningCourseId, setActiveLearningCourseId] = useState<string | null>(null);
  const [activeVideoModuleId, setActiveVideoModuleId] = useState<string | null>(null);
  const [learningContentTab, setLearningContentTab] = useState<'overview' | 'notes' | 'resources' | 'qa'>('overview');
  const [bookmarkedModules, setBookmarkedModules] = useState<Set<string>>(new Set());
  const [playbackSpeed, setPlaybackSpeed] = useState<'0.75' | '1' | '1.25' | '1.5'>('1');
  const [studentNotes, setStudentNotes] = useState<Record<string, string>>({});
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
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'bot', text: string, audio?: string}[]>([
    { role: 'bot', text: 'Hello! I am your TutorSphere assistant. How can I help you today? You can ask me to find a tutor, suggest a course, or even start a quiz!' }
  ]);
  const [chatInput, setChatInput] = useState('');
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
  const primaryNavTabs: Tab[] = ['home', 'tutors', 'courses', 'resources'];
  const navTabs = currentUser ? availableTabs.filter(tab => primaryNavTabs.includes(tab)) : primaryNavTabs;
  const canUseChatbot = (!currentUser || isStudent) && activeTab === 'home';

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
        setBookings(
          currentUser.role === 'tutor'
            ? userBookings.filter((b) => tutorIdentityIds.includes(b.tutorId))
            : userBookings.filter(b => b.studentId === currentUser.id)
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
        } else {
          setQuestions([]);

          const resolvedTutorId = currentTutor?.id || currentUser.id;
          if (resolvedTutorId) {
            const tutorEnrollments = await apiService.getCourseEnrollments({ tutorId: resolvedTutorId });
            setCourseEnrollments(tutorEnrollments);
          } else {
            setCourseEnrollments([]);
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
        phone: currentUser.phone || '',
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
        subject: tutor.subjects?.[0] || 'General',
        date: new Date().toLocaleDateString(),
        meetingLink: 'https://meet.google.com/xyz-abc'
      });
      setBookings([booking, ...bookings]);
      alert('Session booked successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to book session.');
    }
  };

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
        setAuthData({ email: '', password: '', firstName: '', lastName: '', confirmPassword: '', role: 'student' });
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
      handleOpenCourseLearning(courseId);
      return;
    }

    const selectedCourse = courses.find((course) => course.id === courseId);
    if (!selectedCourse) {
      alert('Course not found. Please refresh and try again.');
      return;
    }

    const isFreeCourse = selectedCourse.isFree || selectedCourse.price <= 0;
    let paymentConfirmed = false;
    let paymentReference = '';

    if (!isFreeCourse) {
      const proceedToPayment = confirm(
        `This is a paid course (LKR ${selectedCourse.price}). Do you want to proceed to payment?`
      );

      if (!proceedToPayment) {
        return;
      }

      const reference = prompt('Enter payment reference/transaction ID to confirm enrollment:')?.trim();
      if (!reference) {
        alert('Payment reference is required for paid course enrollment.');
        return;
      }

      paymentConfirmed = true;
      paymentReference = reference;
    }

    try {
      const updatedCourse = await apiService.enrollInCourse(courseId, currentUser.id, {
        paymentConfirmed: isFreeCourse ? true : paymentConfirmed,
        paymentReference,
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

      alert(
        isFreeCourse
          ? 'Successfully enrolled in this free course!'
          : 'Payment confirmed. Enrollment successful!'
      );
    } catch (error) {
      console.error('Failed to enroll in course:', error);
      const message = error instanceof Error ? error.message : 'Failed to enroll in course. Please try again.';
      alert(message);
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
        alert('Congratulations! Your course completion certificate is now available.');
      }
    } catch (error) {
      console.error('Failed to update course progress:', error);
      alert('Failed to update course progress. Please try again.');
    }
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
  };

  const handleAddCourseModule = () => {
    setCourseForm((prev) => ({
      ...prev,
      modules: [...prev.modules, createEmptyEditableModule()],
    }));
  };

  const handleUpdateCourseModule = (
    moduleIndex: number,
    field: keyof EditableCourseModule,
    value: string
  ) => {
    setCourseForm((prev) => ({
      ...prev,
      modules: prev.modules.map((module, index) =>
        index === moduleIndex ? { ...module, [field]: value } : module
      ),
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
        resourcesInput: module.resources.join(', '),
      })),
    });
  };

  const handleSaveCourse = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can manage courses.');
      return;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to manage courses.');
      return;
    }

    const normalizedModules = courseForm.modules
      .map((module) => ({
        id: module.id || Math.random().toString(36).slice(2, 11),
        title: module.title.trim(),
        videoUrl: module.videoUrl.trim(),
        resources: module.resourcesInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }))
      .filter((module) => module.title && module.videoUrl);

    if (!courseForm.title.trim() || !courseForm.description.trim()) {
      alert('Course title and description are required.');
      return;
    }

    if (normalizedModules.length === 0) {
      alert('Please add at least one module with a title and video URL.');
      return;
    }

    const normalizedPrice = Number(courseForm.price) || 0;
    if (!courseForm.isFree && normalizedPrice <= 0) {
      alert('Paid courses must have a price greater than zero.');
      return;
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
    } catch (error) {
      console.error('Failed to save course:', error);
      const message = error instanceof Error ? error.message : 'Failed to save course.';
      alert(message);
    } finally {
      setIsSavingCourse(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can delete courses.');
      return;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to delete courses.');
      return;
    }

    const confirmed = confirm('Delete this course? This will also remove associated student enrollments.');
    if (!confirmed) {
      return;
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
    } catch (error) {
      console.error('Failed to delete course:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete course.';
      alert(message);
    }
  };

  const handleResetResourceForm = () => {
    setResourceForm(createInitialResourceForm());
    setEditingResourceId(null);
  };

  const handleEditResource = (resource: Resource) => {
    setEditingResourceId(resource.id);
    setResourceForm({
      title: resource.title,
      subject: resource.subject,
      type: resource.type,
      url: resource.url,
      description: resource.description || '',
    });
  };

  const handleSaveResource = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can manage resources.');
      return;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to manage resources.');
      return;
    }

    if (!resourceForm.title.trim() || !resourceForm.url.trim()) {
      alert('Resource title and URL are required.');
      return;
    }

    setIsSavingResource(true);

    const payload: Omit<Resource, 'id'> = {
      tutorId,
      title: resourceForm.title.trim(),
      type: resourceForm.type,
      subject: resourceForm.subject,
      url: resourceForm.url.trim(),
      description: resourceForm.description.trim(),
      isFree: true,
    };

    try {
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

      handleResetResourceForm();
    } catch (error) {
      console.error('Failed to save resource:', error);
      const message = error instanceof Error ? error.message : 'Failed to save resource.';
      alert(message);
    } finally {
      setIsSavingResource(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!currentUser || currentUser.role !== 'tutor') {
      alert('Only tutor accounts can delete resources.');
      return;
    }

    const tutorId = currentTutor?.id || currentUser.id;
    if (!tutorId) {
      alert('Tutor profile is required to delete resources.');
      return;
    }

    const confirmed = confirm('Delete this resource?');
    if (!confirmed) {
      return;
    }

    try {
      await apiService.deleteResource(resourceId, tutorId);
      setResources((prev) => prev.filter((resource) => resource.id !== resourceId));

      if (editingResourceId === resourceId) {
        handleResetResourceForm();
      }

      alert('Resource deleted successfully.');
    } catch (error) {
      console.error('Failed to delete resource:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete resource.';
      alert(message);
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
    localStorage.removeItem('session');
    setCurrentUser(null);
    setActiveLearningCourseId(null);
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

      if (currentUser.role === 'tutor') {
        const tutorId = currentTutor?.id || currentUser.id;
        const hasSubjects = profileData.subjects.length > 0;
        const validTeachingLevel = profileData.teachingLevel === 'School' || profileData.teachingLevel === 'University' || profileData.teachingLevel === 'Both';
        
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

  const handleTutorBookingStatusChange = async (booking: Booking, status: Booking['status']) => {
    if (booking.status === status) {
      return;
    }

    if (status === 'confirmed' && !booking.meetingLink) {
      const meetingLink = prompt('Add meeting link before confirming this booking:')?.trim();
      if (!meetingLink) {
        alert('Meeting link is required to confirm the booking.');
        return;
      }

      await updateTutorBooking(booking.id, { status, meetingLink });
      return;
    }

    await updateTutorBooking(booking.id, { status });
  };

  const handleTutorMeetingLinkUpdate = async (booking: Booking) => {
    const nextMeetingLink = prompt('Enter meeting link:', booking.meetingLink || '')?.trim();
    if (!nextMeetingLink || nextMeetingLink === booking.meetingLink) {
      return;
    }

    await updateTutorBooking(booking.id, { meetingLink: nextMeetingLink });
  };

  const getBookingStatusPillClassName = (status: Booking['status']) => {
    if (status === 'completed') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (status === 'confirmed') return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    if (status === 'pending') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  const getCourseAccessLabel = (course: Course) =>
    course.isFree || course.price <= 0 ? 'Free' : `LKR ${course.price}`;

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

  const isDirectVideoFile = (url: string): boolean => /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.trim());

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900">
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
                    onClick={() => {setAuthMode('login'); setShowAuthModal(true)}} 
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
                        onClick={() => {setActiveTab('dashboard'); setIsUserMenuOpen(false)}}
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
                      <div className="relative bg-black aspect-video flex items-center justify-center group">
                        {directVideoFile ? (
                          <video
                            controls
                            src={currentModule.videoUrl}
                            ref={(video) => {
                              if (video) video.playbackRate = Number(playbackSpeed);
                            }}
                            className="w-full h-full"
                          />
                        ) : embedUrl ? (
                          <iframe
                            src={embedUrl}
                            title={currentModule.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
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

                        {/* Playback Speed Overlay (bottom right) */}
                        {(directVideoFile || embedUrl) && (
                          <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <select
                              value={playbackSpeed}
                              onChange={(e) => setPlaybackSpeed(e.target.value as any)}
                              className="bg-black/60 border border-white/30 text-white text-xs rounded px-2 py-1 backdrop-blur"
                            >
                              <option value="0.75">0.75x</option>
                              <option value="1">1x</option>
                              <option value="1.25">1.25x</option>
                              <option value="1.5">1.5x</option>
                            </select>
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
                                className={`py-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                                  learningContentTab === tab
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
                                    className={`flex-shrink-0 p-3 rounded-xl border-2 transition-all ${
                                      bookmarkedModules.has(currentModule.id)
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
                                      <a
                                        key={`${currentModule.id}-resource-${idx}`}
                                        href={resource}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50 transition-all flex items-center gap-3 group"
                                      >
                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors flex-shrink-0">
                                          <LinkIcon className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-900">Resource {idx + 1}</p>
                                          <p className="text-[10px] text-slate-500 truncate">Click to open</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                                      </a>
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
                                      <p className="text-sm text-indigo-700 font-semibold">{courseTutor.teachingLevel === 'Both' ? 'School & University Tutor' : `${courseTutor.teachingLevel} Tutor`}</p>
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
                                  className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 font-bold uppercase tracking-widest transition-all ${
                                    isCurrentModuleCompleted
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                                      : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                                  }`}
                                >
                                  <svg className={`w-5 h-5 ${isCurrentModuleCompleted ? '' : 'hidden'}`} fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                  </svg>
                                  {isCurrentModuleCompleted ? 'Completed ✓' : 'Mark Complete'}
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
                                <label className="block text-sm font-bold text-slate-900 mb-2">Your Notes</label>
                                <textarea
                                  value={studentNotes[currentModule.id] || ''}
                                  onChange={(e) => setStudentNotes({ ...studentNotes, [currentModule.id]: e.target.value })}
                                  placeholder="Add your personal notes here. They're automatically saved as you type..."
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
                                  {currentModule.resources.map((resource, idx) => (
                                    <a
                                      key={`${currentModule.id}-res-${idx}`}
                                      href={resource}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all flex items-center justify-between group"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
                                          <LinkIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <p className="font-bold text-slate-900">Resource {idx + 1}</p>
                                          <p className="text-xs text-slate-500">External resource</p>
                                        </div>
                                      </div>
                                      <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                    </a>
                                  ))}
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
                            className={`w-full text-left p-3 rounded-lg flex items-start gap-3 transition-all border ${
                              isActive
                                ? 'bg-indigo-100 border-indigo-300 shadow-sm'
                                : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                isCompleted
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

                    {/* Certificate Preview */}
                    {isActiveLearningComplete && (
                      <div className="p-3 bg-white rounded-lg border-2 border-amber-300 space-y-2">
                        <div className="aspect-video bg-gradient-to-br from-amber-50 to-orange-50 rounded flex items-center justify-center">
                          <div className="text-center">
                            <svg className="w-8 h-8 text-amber-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            <p className="text-[9px] font-bold text-amber-700">Certificate Ready</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Download Button */}
                    <div>
                      {activeLearningEnrollment ? (
                        <button
                          onClick={() => handleDownloadCertificate(activeLearningEnrollment, activeLearningCourse.title)}
                          disabled={!isActiveLearningComplete}
                          className={`w-full py-3 rounded-lg border-2 font-bold uppercase tracking-widest text-sm transition-all ${
                            isActiveLearningComplete
                              ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-200'
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {isActiveLearningComplete ? '⬇ Download' : 'Complete First'}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            onConfirmBooking={(slotId) => {
              const tutor = tutors.find(t => t.id === bookingTutorId);
              if (tutor) {
                handleBookSession(tutor, slotId);
              }
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
                {tutorsWithLiveStats.map(tutor => (
                <motion.div 
                  layout
                  whileHover={{ y: -10 }}
                  key={tutor.id}
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
                      <div className="flex gap-3">
                        <button 
                          onClick={() => {
                            setViewingTutorId(tutor.id);
                            setActiveTab('tutorProfile');
                          }}
                          className="px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                        >
                          View Profile
                        </button>
                        {(isStudent || !currentUser) && (
                          <button 
                            onClick={() => setSelectedTutor(selectedTutor?.id === tutor.id ? null : tutor)}
                            className={`px-6 py-3 rounded-2xl font-black text-sm transition-all ${
                              selectedTutor?.id === tutor.id 
                              ? 'bg-slate-900 text-white' 
                              : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700'
                            }`}
                          >
                            {selectedTutor?.id === tutor.id ? 'Close' : 'Book Session'}
                          </button>
                        )}
                      </div>
                    </div>

                    <AnimatePresence>
                      {selectedTutor?.id === tutor.id && (isStudent || !currentUser) && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 pt-6 border-t border-slate-50 space-y-4 overflow-hidden"
                        >
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
              ))}
            </div>
            )}
          </div>
        )}

        {activeTab === 'courses' && (
          <div className="space-y-12">
            {isTutor && (
              <div className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                    <BookMarked className="w-3 h-3 fill-indigo-700" />
                    <span>Tutor Content Studio</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">
                    Manage University Video Courses
                  </h2>
                  <p className="text-slate-600">
                    Create, edit, and publish your own video-based courses for university learners.
                  </p>
                </div>
              </div>
            )}

            {isLoadingCourses ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : isTutor ? (
              <div className="grid xl:grid-cols-5 gap-8">
                <div className="xl:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900">
                      {editingCourseId ? 'Edit Course' : 'Create New Course'}
                    </h3>
                    {editingCourseId && (
                      <button
                        type="button"
                        onClick={handleResetCourseForm}
                        className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveCourse} className="space-y-4">
                    <input
                      type="text"
                      value={courseForm.title}
                      onChange={(e) => setCourseForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Course title"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none focus:ring-4 focus:ring-indigo-500/15"
                      required
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={courseForm.subject}
                        onChange={(e) => setCourseForm((prev) => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                      >
                        {STEM_SUBJECTS.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                      <select
                        value={courseForm.isFree ? 'free' : 'paid'}
                        onChange={(e) =>
                          setCourseForm((prev) => ({
                            ...prev,
                            isFree: e.target.value === 'free',
                            price: e.target.value === 'free' ? 0 : prev.price,
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                      >
                        <option value="paid">Paid Course</option>
                        <option value="free">Free Course</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min="0"
                        value={courseForm.price}
                        onChange={(e) => setCourseForm((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                        placeholder={courseForm.isFree ? 'Free course (price locked)' : 'Price'}
                        disabled={courseForm.isFree}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none disabled:cursor-not-allowed disabled:opacity-70"
                      />
                      <div className="flex items-center px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-widest text-slate-500">
                        {courseForm.isFree ? 'Students can enroll instantly' : 'Payment required before enrollment'}
                      </div>
                    </div>

                    <input
                      type="url"
                      value={courseForm.thumbnail}
                      onChange={(e) => setCourseForm((prev) => ({ ...prev, thumbnail: e.target.value }))}
                      placeholder="Thumbnail image URL (optional)"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                    />

                    <textarea
                      value={courseForm.description}
                      onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Course description"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none min-h-[96px]"
                      required
                    />

                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Video Modules</p>
                        <button
                          type="button"
                          onClick={handleAddCourseModule}
                          className="text-xs font-black uppercase tracking-widest text-indigo-600 hover:underline"
                        >
                          Add Module
                        </button>
                      </div>

                      {courseForm.modules.map((module, moduleIndex) => (
                        <div key={`${module.id || 'new'}-${moduleIndex}`} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Module {moduleIndex + 1}</p>
                            {courseForm.modules.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCourseModule(moduleIndex)}
                                className="text-rose-500 hover:text-rose-700"
                                aria-label="Remove module"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={module.title}
                            onChange={(e) => handleUpdateCourseModule(moduleIndex, 'title', e.target.value)}
                            placeholder="Module title"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none"
                          />
                          <input
                            type="url"
                            value={module.videoUrl}
                            onChange={(e) => handleUpdateCourseModule(moduleIndex, 'videoUrl', e.target.value)}
                            placeholder="Video URL"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none"
                          />
                          <input
                            type="text"
                            value={module.resourcesInput}
                            onChange={(e) => handleUpdateCourseModule(moduleIndex, 'resourcesInput', e.target.value)}
                            placeholder="Module resources (comma-separated)"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingCourse}
                      className="w-full mt-2 py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isSavingCourse ? 'Saving...' : editingCourseId ? 'Update Course' : 'Create Course'}
                    </button>
                  </form>
                </div>

                <div className="xl:col-span-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">My Courses</h3>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{myTutorCourses.length} Total</p>
                  </div>

                  {myTutorCourses.length === 0 ? (
                    <div className="bg-white p-10 rounded-[2rem] border border-dashed border-slate-200 text-center text-slate-500">
                      No courses created yet. Start by publishing your first video course.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {myTutorCourses.map((course) => {
                        const enrolledCount = enrollmentCountByCourseId.get(course.id) ?? course.enrolledStudents.length;
                        return (
                          <div key={course.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{course.subject}</p>
                                <h4 className="text-xl font-black text-slate-900">{course.title}</h4>
                                <p className="text-sm text-slate-500 line-clamp-2">{course.description}</p>
                                <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-bold">
                                  <span>{course.modules.length} module(s)</span>
                                  <span>{enrolledCount} enrolled student(s)</span>
                                  <span className={(course.isFree || course.price <= 0) ? 'text-emerald-600' : 'text-amber-600'}>
                                    {(course.isFree || course.price <= 0) ? 'Free' : `LKR ${course.price || 0}`}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditCourse(course)}
                                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCourse(course.id)}
                                  className="px-4 py-2 rounded-xl bg-rose-50 text-rose-600 font-bold text-xs hover:bg-rose-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
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
                onOpenCourseLearning={handleOpenCourseLearning}
                stemSubjects={STEM_SUBJECTS}
              />
            )}
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold">
                {isTutor ? 'Manage Free Learning Resources' : 'Free Resource Library'}
              </h2>
              <p className="text-slate-600">
                {isTutor
                  ? 'Upload and organize free papers, articles, and notes for your university students.'
                  : 'Access tutor-shared papers, notes, and articles to support your studies.'}
              </p>
            </div>
            {isLoadingResources ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : isTutor ? (
              <div className="grid lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900">
                      {editingResourceId ? 'Edit Resource' : 'Upload Resource'}
                    </h3>
                    {editingResourceId && (
                      <button
                        type="button"
                        onClick={handleResetResourceForm}
                        className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveResource} className="space-y-4">
                    <input
                      type="text"
                      value={resourceForm.title}
                      onChange={(e) => setResourceForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Resource title"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                      required
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={resourceForm.subject}
                        onChange={(e) => setResourceForm((prev) => ({ ...prev, subject: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                      >
                        {STEM_SUBJECTS.map((subject) => (
                          <option key={subject} value={subject}>
                            {subject}
                          </option>
                        ))}
                      </select>
                      <select
                        value={resourceForm.type}
                        onChange={(e) =>
                          setResourceForm((prev) => ({
                            ...prev,
                            type: e.target.value as Resource['type'],
                          }))
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                      >
                        <option value="Paper">Paper</option>
                        <option value="Article">Article</option>
                        <option value="Note">Note</option>
                      </select>
                    </div>

                    <input
                      type="url"
                      value={resourceForm.url}
                      onChange={(e) => setResourceForm((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="Resource URL"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none"
                      required
                    />

                    <textarea
                      value={resourceForm.description}
                      onChange={(e) => setResourceForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Short description (optional)"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white outline-none min-h-[100px]"
                    />

                    <button
                      type="submit"
                      disabled={isSavingResource}
                      className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {isSavingResource ? 'Saving...' : editingResourceId ? 'Update Resource' : 'Upload Resource'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-3 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900">My Free Resources</h3>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{myTutorResources.length} Total</p>
                  </div>

                  {myTutorResources.length === 0 ? (
                    <div className="bg-white p-10 rounded-[2rem] border border-dashed border-slate-200 text-center text-slate-500">
                      No resources uploaded yet. Share your first paper, article, or note.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myTutorResources.map((resource) => (
                        <div key={resource.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <h4 className="font-black text-slate-900">{resource.title}</h4>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">
                              {resource.subject} • {resource.type}
                            </p>
                            {resource.description && (
                              <p className="text-sm text-slate-500">{resource.description}</p>
                            )}
                            <a
                              href={resource.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex text-xs font-bold text-indigo-600 hover:underline mt-1"
                            >
                              Open Resource
                            </a>
                          </div>

                          <div className="flex gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditResource(resource)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteResource(resource.id)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {discoverableResources.map(res => (
                <div key={res.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-2xl">
                      <BookOpen className="text-indigo-600 w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold">{res.title}</h3>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{res.subject} • {res.type}</p>
                      {res.description && <p className="text-xs text-slate-500 mt-1">{res.description}</p>}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (!res.url || res.url === '#') {
                        alert('Resource link is not available yet.');
                        return;
                      }
                      window.open(res.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="text-indigo-600 font-bold flex items-center gap-1 hover:underline"
                  >
                    Download <ArrowRight className="w-4 h-4" />
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
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
            }} 
            STEM_SUBJECTS={STEM_SUBJECTS}
          />
        )}

        {activeTab === 'registerTutor' && !currentUser && (
          <GetStartedSection 
            initialRole="tutor"
            showRoleSelector={false}
            onBack={() => setActiveTab('registerSelect')}
            onAccountCreated={(user) => {
              setCurrentUser(user);
              setActiveTab('dashboard');
              localStorage.setItem('session', JSON.stringify({ user, activeTab: 'dashboard' }));
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
                      onChange={e => setProfileData({...profileData, firstName: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={e => setProfileData({...profileData, lastName: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                      placeholder="Doe"
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
                        onChange={e => setProfileData({...profileData, phone: e.target.value})}
                        className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">Professional Bio</label>
                  <textarea
                    required
                    value={profileData.bio}
                    onChange={e => setProfileData({...profileData, bio: e.target.value})}
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
                      onChange={e => setProfileData({...profileData, education: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all min-h-[100px]"
                      placeholder="e.g. BSc in Computer Science, University of Colombo&#10;MSc in AI, Stanford University"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Hourly Rate (USD)</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                      <input 
                        type="number" 
                        min="0"
                        step="0.01"
                        required
                        value={profileData.pricePerHour}
                        onChange={e => setProfileData({...profileData, pricePerHour: parseFloat(e.target.value) || 0})}
                        className="w-full pl-10 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all" 
                        placeholder="25.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700">Primary Teaching Level</label>
                    <select
                      required
                      value={profileData.teachingLevel}
                      onChange={e => setProfileData({...profileData, teachingLevel: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all appearance-none"
                    >
                      <option value="" disabled>Select your primary audience</option>
                      <option value="School">School Level (K-12)</option>
                      <option value="University">University Level</option>
                      <option value="Both">Both School & University</option>
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
                          setProfileData({...profileData, subjects: newSubs});
                        }}
                        className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${
                          isSelected
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
                      if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'Both') {
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
                      if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'Both') {
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
            </form>
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
                  <p className="font-black text-slate-900">Settings</p>
                  <p className="text-xs text-slate-500 mt-1">Manage subjects and profile settings</p>
                </button>
                {(profileData.teachingLevel === 'School' || profileData.teachingLevel === 'Both') && (
                  <button onClick={() => setActiveTab('manageAvailability')} className="text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                    <p className="font-black text-slate-900">Manage Availability</p>
                    <p className="text-xs text-slate-500 mt-1">Configure your tutoring schedule</p>
                  </button>
                )}
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
                    {bookings.slice(0, 8).map((booking) => {
                      const isLoading = activeBookingActionId === booking.id;
                      const canConfirm = booking.status === 'pending';
                      const canComplete = booking.status === 'confirmed';
                      const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed';

                      return (
                        <div key={booking.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">{booking.subject}</p>
                              <p className="text-xs text-slate-500">{booking.date} • Student ID: {booking.studentId}</p>
                            </div>
                            <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-1 rounded-full border ${getBookingStatusPillClassName(booking.status)}`}>
                              {booking.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {canConfirm && (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleTutorBookingStatusChange(booking, 'confirmed')}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                              >
                                Confirm
                              </button>
                            )}
                            {canComplete && (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleTutorBookingStatusChange(booking, 'completed')}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Mark Completed
                              </button>
                            )}
                            {canCancel && (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleTutorBookingStatusChange(booking, 'cancelled')}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleTutorMeetingLinkUpdate(booking)}
                              className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-60"
                            >
                              {booking.meetingLink ? 'Edit Link' : 'Add Link'}
                            </button>
                            {booking.meetingLink && (
                              <a
                                href={booking.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                              >
                                Open Link
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                    <p className="text-3xl font-black text-slate-900">{currentTutorReviewCount}</p>
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
                  {currentUserAvatarUrl ? (
                    <img 
                      src={currentUserAvatarUrl} 
                      alt={`${currentUser.firstName} ${currentUser.lastName}`} 
                      className="w-20 h-20 rounded-3xl object-cover shadow-xl shadow-indigo-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-200" style={{ display: currentUserAvatarUrl ? 'none' : 'flex' }}>
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
                    {studentEnrolledCourses.length === 0 ? (
                      <div className="col-span-2 text-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                        <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">No courses enrolled yet</p>
                      </div>
                    ) : (
                      studentEnrolledCourses.map(({ course, enrollment }) => (
                        <div key={course.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-all group">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="bg-white p-3 rounded-2xl shadow-sm group-hover:shadow-md transition-all">
                              <BookMarked className="text-indigo-600 w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900 leading-tight">{course.title}</h4>
                              <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mt-1">
                                Progress: {enrollment.progress}% Complete
                              </p>
                              <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${(course.isFree || course.price <= 0) ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {(course.isFree || course.price <= 0) ? 'Free Course' : `Paid • LKR ${course.price}`}
                              </p>
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden mb-4">
                            <div className="h-full bg-emerald-500" style={{ width: `${enrollment.progress}%` }} />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => handleOpenCourseLearning(course.id)}
                              className="w-full border py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-white text-slate-900 border-slate-200 hover:bg-slate-900 hover:text-white"
                            >
                              <Video className="w-4 h-4 text-indigo-500" /> Continue Learning
                            </button>
                            <button
                              onClick={() => {
                                if (enrollment.progress < 100) {
                                  alert('Complete all modules to unlock your certificate.');
                                  return;
                                }
                                handleDownloadCertificate(enrollment, course.title);
                              }}
                              className={`w-full border py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                                enrollment.progress >= 100
                                  ? 'bg-white text-slate-900 border-slate-200 hover:bg-slate-900 hover:text-white'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              <Award className="w-4 h-4 text-amber-500" />
                              {enrollment.progress >= 100 ? 'Download Certificate' : 'Certificate Locked'}
                            </button>
                          </div>
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
                    {currentUserAvatarUrl ? (
                      <img 
                        src={currentUserAvatarUrl} 
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
                      style={{ display: currentUserAvatarUrl ? 'none' : 'block' }}
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
                        <p className="text-2xl font-black text-slate-900">{studentEnrolledCourses.length}</p>
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
                      onChange={e => setProfileData({...profileData, firstName: e.target.value})}
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
                      onChange={e => setProfileData({...profileData, lastName: e.target.value})}
                      className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                      placeholder="Doe"
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
                        onChange={e => setProfileData({...profileData, phone: e.target.value})}
                        className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all"
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>

                {currentUser.role === 'tutor' && (
                  <div className="space-y-3 mt-6">
                    <label className="text-sm font-bold text-slate-700">Professional Bio</label>
                    <textarea
                      required
                      value={profileData.bio}
                      onChange={e => setProfileData({...profileData, bio: e.target.value})}
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
                          onChange={e => setProfileData({...profileData, education: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all min-h-[100px]"
                          placeholder="e.g. BSc in Computer Science, University of Colombo&#10;MSc in AI, Stanford University"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700">Hourly Rate (USD)</label>
                        <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            required
                            value={profileData.pricePerHour}
                            onChange={e => setProfileData({...profileData, pricePerHour: parseFloat(e.target.value) || 0})}
                            className="w-full pl-10 pr-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all" 
                            placeholder="25.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700">Primary Teaching Level</label>
                        <select
                          required
                          value={profileData.teachingLevel}
                          onChange={e => setProfileData({...profileData, teachingLevel: e.target.value})}
                          className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-slate-50/50 focus:bg-white transition-all appearance-none"
                        >
                          <option value="" disabled>Select your primary audience</option>
                          <option value="School">School Level (K-12)</option>
                          <option value="University">University Level</option>
                          <option value="Both">Both School & University</option>
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
                              setProfileData({...profileData, subjects: newSubs});
                            }}
                            className={`px-5 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border-2 ${
                              isSelected
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
                      if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'Both') {
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
                      if (profileData.teachingLevel === 'School' || profileData.teachingLevel === 'Both') {
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
                                value={authData.lastName || ''}
                                onChange={e => setAuthData({...authData, lastName: e.target.value})}
                                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                                placeholder="Doe"
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
                    {authMode === 'signup' && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                          <input 
                            required
                            type="password" 
                            value={authData.confirmPassword || ''}
                            onChange={e => setAuthData({...authData, confirmPassword: e.target.value})}
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all bg-slate-50/50 font-medium"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                    )}

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
                            setActiveTab('registerSelect');
                          } else {
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
    </div>
  );
}
