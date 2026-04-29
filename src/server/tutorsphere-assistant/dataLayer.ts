import { Booking } from '../../models/Booking.js';
import { Course } from '../../models/Course.js';
import { Resource } from '../../models/Resource.js';
import { Tutor } from '../../models/Tutor.js';
import { SafePlatformSnapshot } from '../faq-chatbot/types.js';

const sanitizeText = (value: unknown): string => String(value ?? '').trim();

const getNestedValue = (source: any, path: string): unknown => {
  return path.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, source);
};

const toNameFromEmail = (email: string): string => {
  const safeEmail = sanitizeText(email);
  if (!safeEmail || !safeEmail.includes('@')) {
    return '';
  }

  const localPart = safeEmail.split('@')[0] ?? '';
  const normalizedLocalPart = localPart.replace(/[._-]+/g, ' ').trim();
  if (!normalizedLocalPart) {
    return safeEmail;
  }

  return normalizedLocalPart
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const toTutorName = (tutor: any): string => {
  const candidateNamePaths = [
    'name',
    'fullName',
    'full_name',
    'displayName',
    'tutorProfile.name',
    'user.name',
    'user.fullName',
    'user.full_name',
    'user.displayName',
  ];

  for (const path of candidateNamePaths) {
    const value = sanitizeText(getNestedValue(tutor, path));
    if (value) {
      return value;
    }
  }

  const candidateFirstNames = [
    sanitizeText(tutor?.firstName),
    sanitizeText(getNestedValue(tutor, 'user.firstName')),
  ];
  const candidateLastNames = [
    sanitizeText(tutor?.lastName),
    sanitizeText(getNestedValue(tutor, 'user.lastName')),
  ];

  for (let index = 0; index < candidateFirstNames.length; index += 1) {
    const fullName = `${candidateFirstNames[index]} ${candidateLastNames[index]}`.trim();
    if (fullName) {
      return fullName;
    }
  }

  const candidateEmailPaths = ['email', 'user.email'];
  for (const path of candidateEmailPaths) {
    const email = sanitizeText(getNestedValue(tutor, path));
    const derivedName = toNameFromEmail(email);
    if (derivedName) {
      return derivedName;
    }
    if (email) {
      return email;
    }
  }

  return 'Tutor';
};

const sanitizeSubjectList = (subjects: unknown): string[] => {
  if (!Array.isArray(subjects)) {
    return [];
  }

  return subjects
    .map((subject) => sanitizeText(subject))
    .filter(Boolean)
    .slice(0, 8);
};

export const buildSafePlatformSnapshot = async (): Promise<SafePlatformSnapshot> => {
  const [
    totalCourses,
    totalTutors,
    totalResources,
    totalBookings,
    courses,
    tutors,
    resources,
    bookingStatusRows,
    bookingSubjectRows,
  ] = await Promise.all([
    Course.countDocuments(),
    Tutor.countDocuments(),
    Resource.countDocuments(),
    Booking.countDocuments(),
    Course.find(
      {},
      {
        _id: 0,
        id: 1,
        title: 1,
        subject: 1,
        isFree: 1,
        price: 1,
        modules: 1,
      }
    )
      .sort({ updatedAt: -1 })
      .limit(12)
      .lean(),
    Tutor.find(
      {},
      {
        _id: 0,
        name: 1,
        fullName: 1,
        full_name: 1,
        displayName: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        tutorProfile: 1,
        user: 1,
        subjects: 1,
        teachingLevel: 1,
        pricePerHour: 1,
        isVerified: 1,
        rating: 1,
        reviewCount: 1,
      }
    )
      .sort({ rating: -1 })
      .limit(12)
      .lean(),
    Resource.find(
      {},
      {
        _id: 0,
        title: 1,
        subject: 1,
        type: 1,
        isFree: 1,
        downloadCount: 1,
      }
    )
      .sort({ updatedAt: -1 })
      .limit(16)
      .lean(),
    Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Booking.aggregate([
      {
        $match: {
          subject: { $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: '$subject',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const bookingStatusCounts = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const row of bookingStatusRows) {
    const status = sanitizeText(row?._id).toLowerCase();
    const count = Number(row?.count) || 0;
    if (status in bookingStatusCounts) {
      bookingStatusCounts[status as keyof typeof bookingStatusCounts] = count;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      courses: totalCourses,
      tutors: totalTutors,
      resources: totalResources,
      bookings: totalBookings,
    },
    bookingStatusCounts,
    topBookedSubjects: bookingSubjectRows
      .map((row) => ({
        subject: sanitizeText(row?._id),
        count: Number(row?.count) || 0,
      }))
      .filter((entry) => entry.subject && entry.count > 0),
    courses: courses.map((course: any) => ({
      id: sanitizeText(course?.id),
      title: sanitizeText(course?.title),
      subject: sanitizeText(course?.subject),
      accessType: course?.isFree || Number(course?.price) <= 0 ? 'free' : 'paid',
      price: Number(course?.price) || 0,
      moduleCount: Array.isArray(course?.modules) ? course.modules.length : 0,
    })),
    tutors: tutors.map((tutor: any) => ({
      name: toTutorName(tutor),
      subjects: sanitizeSubjectList(tutor?.subjects),
      teachingLevel: sanitizeText(tutor?.teachingLevel),
      pricePerHour: Number(tutor?.pricePerHour) || 0,
      isVerified: Boolean(tutor?.isVerified),
      rating: Number(tutor?.rating) || 0,
      reviewCount: Number(tutor?.reviewCount) || 0,
    })),
    resources: resources.map((resource: any) => ({
      title: sanitizeText(resource?.title),
      subject: sanitizeText(resource?.subject),
      type: sanitizeText(resource?.type),
      downloadCount: Number(resource?.downloadCount) || 0,
    })),
  };
};
