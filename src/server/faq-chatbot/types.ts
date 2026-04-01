export type FaqChatContext = {
  currentTab?: string;
  userRole?: string;
  userName?: string;
};

export type FaqChatRequestBody = {
  message: string;
  context?: FaqChatContext;
};

export type FaqChatResponseBody = {
  reply: string;
};

export type SafeCourseSummary = {
  id: string;
  title: string;
  subject: string;
  accessType: 'free' | 'paid';
  price: number;
  moduleCount: number;
};

export type SafeTutorSummary = {
  name: string;
  subjects: string[];
  teachingLevel: string;
  pricePerHour: number;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
};

export type SafeResourceSummary = {
  title: string;
  subject: string;
  type: string;
  downloadCount: number;
};

export type SafePlatformSnapshot = {
  generatedAt: string;
  totals: {
    courses: number;
    tutors: number;
    resources: number;
    bookings: number;
  };
  bookingStatusCounts: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
  };
  topBookedSubjects: Array<{ subject: string; count: number }>;
  courses: SafeCourseSummary[];
  tutors: SafeTutorSummary[];
  resources: SafeResourceSummary[];
};
