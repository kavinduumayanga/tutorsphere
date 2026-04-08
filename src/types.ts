export type UserRole = 'student' | 'tutor' | 'admin';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
}

export interface Tutor extends User {
  qualifications: string;
  subjects: string[];
  teachingLevel: 'School' | 'University' | 'School and University';
  pricePerHour: number;
  rating: number;
  reviewCount: number;
  bio: string;
  availability: TimeSlot[];
  isVerified: boolean;
}

export interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
}

export interface Booking {
  id: string;
  studentId: string;
  studentName?: string;
  tutorId: string;
  slotId: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  subject: string;
  date: string;
  timeSlot?: string;
  meetingLink?: string;
  expertFeedback?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentReference?: string;
  paymentFailureReason?: string;
  paidAt?: string;
}

export interface Question {
  id: string;
  studentId: string;
  text: string;
  subject: string;
  answer?: string;
  timestamp: number;
}

export interface Course {
  id: string;
  tutorId: string;
  title: string;
  subject: string;
  description: string;
  isFree: boolean;
  price: number;
  thumbnail: string;
  modules: CourseModule[];
  enrolledStudents: string[];
}

export interface CourseModuleResource {
  name: string;
  url: string;
}

export interface CourseModule {
  id: string;
  title: string;
  videoUrl: string;
  resources: CourseModuleResource[];
}

export interface CourseEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  completedModuleIds: string[];
  progress: number;
  enrolledAt: string;
  completedAt?: string;
  certificateId?: string;
}

export interface Quiz {
  id: string;
  subject: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
}

export interface SkillLevel {
  subject: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Master';
  progress: number; // 0-100
}

export interface StudyPlan {
  id: string;
  studentId: string;
  weeklyGoalHours: number;
  completedHours: number;
  recommendations: string[];
  schedule: { day: string; topic: string }[];
}

export interface Resource {
  id: string;
  tutorId?: string;
  title: string;
  type: 'Paper' | 'Article' | 'Note';
  subject: string;
  url: string;
  description?: string;
  isFree: boolean;
  downloadCount: number;
}

export interface Review {
  id: string;
  tutorId: string;
  studentId: string;
  studentName: string;
  rating: number;
  comment: string;
  date: string;
}
