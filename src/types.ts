export type UserRole = 'student' | 'tutor' | 'admin';

export type NotificationType =
  | 'booking_update'
  | 'session_confirmed'
  | 'session_cancelled'
  | 'session_reschedule_request'
  | 'session_rescheduled'
  | 'session_completed'
  | 'payment_success'
  | 'payment_refunded'
  | 'course_enrolled'
  | 'course_completed'
  | 'profile_update'
  | 'meeting_link_available'
  | 'meeting_link_updated'
  | 'system';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  targetTab?: string;
  relatedEntityId?: string;
}

export interface MessagingUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
  isOnline?: boolean;
  lastSeenAt?: string | null;
}

export interface MessageConversation {
  id: string;
  studentId: string;
  tutorId: string;
  otherParticipant: MessagingUserSummary;
  lastMessagePreview: string;
  lastMessageAt?: string | null;
  lastMessageSenderId?: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageConversationsResponse {
  conversations: MessageConversation[];
  totalUnreadCount: number;
}

export interface ConversationMessagesResponse {
  conversation: MessageConversation;
  messages: DirectMessage[];
  hasMore: boolean;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  avatar?: string;
  avatarBlobName?: string;
  avatarMimeType?: string;
  avatarSize?: number;
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
  aiPricingState?: {
    lastAppliedSuggestedRate?: number;
    lastSuggestionAppliedAt?: string;
    lastAnalyzedSnapshot?: {
      bookingDemandLast30Days: number;
      completedSessions: number;
      cancelledSessions: number;
      completionRate: number;
      cancellationRate: number;
      conversionRate: number;
      averageRating: number;
      totalReviewCount: number;
    };
  };
}

export interface TimeSlot {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  dateKey?: string;
  weekStartKey?: string;
  isBooked: boolean;
}

export interface BookingSessionResource {
  id: string;
  name: string;
  url: string;
  blobName?: string;
  containerName?: string;
  mimeType?: string;
  size?: number;
  uploadedByTutorId?: string;
  uploadedAt?: string;
}

export interface BookingRescheduleRequest {
  requestedDate: string;
  requestedDateKey?: string;
  requestedTimeSlot: string;
  requestedSlotId?: string;
  note?: string;
  requestedAt: string;
  requestedByTutorId: string;
  status: 'pending';
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
  sessionDateKey?: string;
  timeSlot?: string;
  meetingLink?: string;
  expertFeedback?: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentReference?: string;
  paymentFailureReason?: string;
  paidAt?: string;
  refundedAt?: string;
  refundReason?: string;
  sessionDurationHours?: number;
  baseAmount?: number;
  platformFee?: number;
  totalAmount?: number;
  studentPlatformFee?: number;
  studentTotalPaid?: number;
  tutorPlatformFee?: number;
  tutorNetEarning?: number;
  sessionAmount?: number;
  rescheduleRequest?: BookingRescheduleRequest;
  sessionResources?: BookingSessionResource[];
  hiddenForTutor?: boolean;
  hiddenForStudent?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  thumbnailBlobName?: string;
  thumbnailMimeType?: string;
  thumbnailSize?: number;
  modules: CourseModule[];
  enrolledStudents: string[];
}

export interface CourseCoupon {
  id: string;
  courseId: string;
  code: string;
  discountPercentage: number;
  isActive: boolean;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseModuleResource {
  name: string;
  url: string;
  blobName?: string;
  mimeType?: string;
  size?: number;
}

export interface CourseModule {
  id: string;
  title: string;
  videoUrl: string;
  videoBlobName?: string;
  videoMimeType?: string;
  videoSize?: number;
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
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';
  paymentReference?: string;
  paidAt?: string;
  amountPaid?: number;
  originalPrice?: number;
  couponCode?: string;
  discountAmount?: number;
  finalPaidAmount?: number;
  studentName?: string;
  courseTitle?: string;
  tutorId?: string;
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
  blobName?: string;
  mimeType?: string;
  size?: number;
  description?: string;
  isFree: boolean;
  downloadCount: number;
}

export interface Review {
  id: string;
  tutorId: string;
  studentId: string;
  sessionId?: string;
  studentName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface WithdrawalRequest {
  id: string;
  tutorId: string;
  amount: number;
  payoutMethodType: 'bank_transfer' | 'paypal';
  payoutMethodDetails: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  requestedAt: string;
  processedAt?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WithdrawalSummary {
  totalEarnings: number;
  withdrawnAmount: number;
  pendingWithdrawalAmount: number;
  availableBalance: number;
}

export interface TutorRevenueForecastWindow {
  days: 30 | 60 | 90;
  projectedNetEarning: number;
  historicalProjection: number;
  upcomingConfirmedNet: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface TutorRevenuePricingSuggestion {
  currentHourlyRate: number;
  suggestedHourlyRate: number;
  suggestedRange: { min: number; max: number };
  direction: 'increase' | 'decrease' | 'keep';
  reason: string;
  confidence: 'low' | 'medium' | 'high';
  metrics: {
    bookingDemandLast30Days: number;
    completedSessions: number;
    cancelledSessions: number;
    cancellationRate: number;
    completionRate: number;
    conversionRate: number;
    averageRating: number;
    totalReviewCount: number;
  };
}

export interface TutorRevenueTaxMonthlySummary {
  month: string;
  monthKey: string;
  sessionIncome: number;
  courseSales: number;
  platformFees: number;
  refunds: number;
  withdrawals: number;
  netTaxableIncome: number;
}

export interface TutorRevenueInsights {
  generatedAt: string;
  summary: {
    totalEarnings: number;
    availableBalance: number;
    completedSessionEarnings: number;
    pendingEarnings: number;
    withdrawnAmount: number;
    remainingBalance: number;
    pendingWithdrawalAmount: number;
    monthlyEarnings: Array<{
      month: string;
      monthKey: string;
      sessionNetEarnings: number;
      courseNetEarnings: number;
      totalNetEarnings: number;
    }>;
    paymentHistory: Array<{
      id: string;
      timestamp: number;
      dateLabel: string;
      itemName: string;
      studentName: string;
      paymentType: 'session booking' | 'course purchase';
      amount: number;
      platformFee: number;
      netEarning: number;
      status: 'paid' | 'pending' | 'refunded_or_cancelled';
      paymentReference?: string;
    }>;
  };
  forecasting: {
    windows: TutorRevenueForecastWindow[];
    fallback: boolean;
    fallbackMessage?: string;
    methodology: string;
  };
  pricingSuggestion: TutorRevenuePricingSuggestion;
  taxPrep: {
    monthlySummaries: TutorRevenueTaxMonthlySummary[];
    totals: {
      sessionIncome: number;
      courseSales: number;
      platformFees: number;
      refunds: number;
      withdrawals: number;
      netTaxableIncome: number;
    };
  };
  aiInsights: {
    assistant: string;
    source: 'azure' | 'fallback';
    forecastSummary: string;
    pricingSummary: string;
    taxSummary: string;
    actionItems: string[];
    warning?: string;
  };
}
