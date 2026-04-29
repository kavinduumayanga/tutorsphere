import dotenv from 'dotenv';

import mongoose from '../src/database.js';
import { connectDB } from '../src/database.js';
import { User } from '../src/models/User.js';
import { Tutor } from '../src/models/Tutor.js';
import { Course } from '../src/models/Course.js';
import { CourseEnrollment } from '../src/models/CourseEnrollment.js';
import { CourseCoupon } from '../src/models/CourseCoupon.js';
import { CourseCouponUsage } from '../src/models/CourseCouponUsage.js';
import { Booking } from '../src/models/Booking.js';
import { Review } from '../src/models/Review.js';
import { Resource } from '../src/models/Resource.js';
import { WithdrawalRequest } from '../src/models/WithdrawalRequest.js';
import { MessageConversation } from '../src/models/MessageConversation.js';
import { DirectMessage } from '../src/models/DirectMessage.js';
import { Notification } from '../src/models/Notification.js';
import { PasswordResetOtp } from '../src/models/PasswordResetOtp.js';
import { Question } from '../src/models/Question.js';
import { StudyPlan } from '../src/models/StudyPlan.js';
import { SkillLevel } from '../src/models/SkillLevel.js';

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has('--execute');
const ALLOW_MULTIPLE_COURSE_TITLE_MATCHES = args.has('--allow-multiple-title-matches');

const TARGET_TUTOR_IDS = new Set(['26vu53adr']);
const TARGET_TUTOR_NAMES = [
  'Test Tutor - 26vu53adr',
  'SmokeTutor QA2026',
  'QA Tutor',
];
const TARGET_COURSE_TITLE = 'Fundamentals of Mathematics';

type DeletionCounters = Record<string, number>;

const counters: DeletionCounters = Object.create(null);

const normalizeSpace = (value: unknown): string => String(value || '').trim().replace(/\s+/g, ' ');

const normalizeForMatch = (value: unknown): string => normalizeSpace(value).toLowerCase();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const incrementCounter = (key: string, count: number) => {
  const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  counters[key] = (counters[key] || 0) + normalizedCount;
};

const deleteManyAndTrack = async (
  counterKey: string,
  model: { countDocuments: (filter: Record<string, unknown>) => Promise<number>; deleteMany: (filter: Record<string, unknown>) => Promise<{ deletedCount?: number }> },
  filter: Record<string, unknown>
): Promise<number> => {
  const plannedCount = await model.countDocuments(filter);
  if (plannedCount <= 0) {
    incrementCounter(counterKey, 0);
    return 0;
  }

  if (DRY_RUN) {
    console.info(`[Cleanup][dry-run] would delete ${plannedCount} document(s) from ${counterKey}`);
    incrementCounter(counterKey, plannedCount);
    return plannedCount;
  }

  const result = await model.deleteMany(filter);
  const deletedCount = Number(result.deletedCount || 0);
  console.info(`[Cleanup] deleted ${deletedCount} document(s) from ${counterKey}`);
  incrementCounter(counterKey, deletedCount);
  return deletedCount;
};

const updateCourseEnrollmentListsForDeletedUsers = async (userIds: string[]): Promise<number> => {
  if (userIds.length === 0) {
    incrementCounter('Course.enrolledStudentsPulled', 0);
    return 0;
  }

  const filter = { enrolledStudents: { $in: userIds } };
  const update = { $pull: { enrolledStudents: { $in: userIds } } };

  if (DRY_RUN) {
    const affected = await Course.countDocuments(filter);
    if (affected > 0) {
      console.info(`[Cleanup][dry-run] would update enrolledStudents in ${affected} course(s)`);
    }
    incrementCounter('Course.enrolledStudentsPulled', affected);
    return affected;
  }

  const result = await Course.updateMany(filter, update);
  const modified = Number(result.modifiedCount || 0);
  if (modified > 0) {
    console.info(`[Cleanup] updated enrolledStudents in ${modified} course(s)`);
  }
  incrementCounter('Course.enrolledStudentsPulled', modified);
  return modified;
};

const printSummary = () => {
  const summaryRows = Object.entries(counters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`);

  console.info('\n[Cleanup] Summary');
  if (summaryRows.length === 0) {
    console.info('- No changes were required.');
    return;
  }

  for (const row of summaryRows) {
    console.info(`- ${row}`);
  }
};

const runCleanup = async () => {
  const targetNameSet = new Set(TARGET_TUTOR_NAMES.map((name) => normalizeForMatch(name)));
  const tutorNameMatchers = TARGET_TUTOR_NAMES.map((name) => new RegExp(`^\\s*${escapeRegExp(name)}\\s*$`, 'i'));
  const courseTitleMatcher = new RegExp(`^\\s*${escapeRegExp(TARGET_COURSE_TITLE)}\\s*$`, 'i');

  const tutorDocs = await Tutor.find(
    {
      $or: [
        { id: { $in: Array.from(TARGET_TUTOR_IDS) } },
        ...tutorNameMatchers.map((nameRegex) => ({ name: nameRegex })),
      ],
    },
    { id: 1, name: 1, email: 1 }
  );

  const tutorUserDocs = await User.find(
    { role: 'tutor' },
    { id: 1, firstName: 1, lastName: 1, email: 1 }
  );

  const tutorIds = new Set<string>();
  const tutorEmails = new Set<string>();

  for (const tutor of tutorDocs) {
    const normalizedTutorId = normalizeSpace((tutor as any).id);
    if (normalizedTutorId) {
      tutorIds.add(normalizedTutorId);
    }

    const normalizedTutorEmail = normalizeForMatch((tutor as any).email);
    if (normalizedTutorEmail) {
      tutorEmails.add(normalizedTutorEmail);
    }
  }

  for (const tutorUser of tutorUserDocs) {
    const normalizedUserId = normalizeSpace((tutorUser as any).id);
    const normalizedFullName = normalizeForMatch(`${(tutorUser as any).firstName || ''} ${(tutorUser as any).lastName || ''}`);

    if (TARGET_TUTOR_IDS.has(normalizedUserId) || targetNameSet.has(normalizedFullName)) {
      if (normalizedUserId) {
        tutorIds.add(normalizedUserId);
      }

      const normalizedTutorEmail = normalizeForMatch((tutorUser as any).email);
      if (normalizedTutorEmail) {
        tutorEmails.add(normalizedTutorEmail);
      }
    }
  }

  for (const explicitTutorId of TARGET_TUTOR_IDS) {
    if (explicitTutorId) {
      tutorIds.add(explicitTutorId);
    }
  }

  const tutorIdList = Array.from(tutorIds);

  const tutorCourses = tutorIdList.length > 0
    ? await Course.find({ tutorId: { $in: tutorIdList } }, { id: 1, title: 1, tutorId: 1 })
    : [];
  const titleMatchedCourses = await Course.find({ title: courseTitleMatcher }, { id: 1, title: 1, tutorId: 1 });

  const titleMatchedCoursesOutsideTutorScope = titleMatchedCourses.filter(
    (course) => !tutorIds.has(normalizeSpace((course as any).tutorId))
  );

  if (
    titleMatchedCoursesOutsideTutorScope.length > 1
    && !ALLOW_MULTIPLE_COURSE_TITLE_MATCHES
  ) {
    const conflictingCourseIds = titleMatchedCoursesOutsideTutorScope
      .map((course) => normalizeSpace((course as any).id))
      .filter(Boolean)
      .join(', ');

    throw new Error(
      `Safety stop: found ${titleMatchedCoursesOutsideTutorScope.length} courses named "${TARGET_COURSE_TITLE}" outside target tutor scope (${conflictingCourseIds}). Re-run with --allow-multiple-title-matches if this is intentional.`
    );
  }

  const courseIds = new Set<string>();

  for (const course of tutorCourses) {
    const courseId = normalizeSpace((course as any).id);
    if (courseId) {
      courseIds.add(courseId);
    }
  }

  for (const course of titleMatchedCourses) {
    const courseId = normalizeSpace((course as any).id);
    if (courseId) {
      courseIds.add(courseId);
    }
  }

  const courseIdList = Array.from(courseIds);

  const bookingDocs = tutorIdList.length > 0
    ? await Booking.find(
      {
        $or: [
          { tutorId: { $in: tutorIdList } },
          { studentId: { $in: tutorIdList } },
        ],
      },
      { id: 1 }
    )
    : [];
  const bookingIds = bookingDocs
    .map((booking) => normalizeSpace((booking as any).id))
    .filter(Boolean);

  const conversationDocs = tutorIdList.length > 0
    ? await MessageConversation.find(
      {
        $or: [
          { tutorId: { $in: tutorIdList } },
          { participantIds: { $in: tutorIdList } },
        ],
      },
      { id: 1 }
    )
    : [];
  const conversationIds = conversationDocs
    .map((conversation) => normalizeSpace((conversation as any).id))
    .filter(Boolean);

  const userDocsByTutorId = tutorIdList.length > 0
    ? await User.find({ id: { $in: tutorIdList } }, { id: 1, email: 1 })
    : [];

  for (const userDoc of userDocsByTutorId) {
    const emailValue = normalizeForMatch((userDoc as any).email);
    if (emailValue) {
      tutorEmails.add(emailValue);
    }
  }

  console.info('[Cleanup] mode:', DRY_RUN ? 'dry-run' : 'execute');
  console.info('[Cleanup] target tutors requested by name:', TARGET_TUTOR_NAMES.join(' | '));
  console.info('[Cleanup] target tutor ids:', tutorIdList.length ? tutorIdList.join(', ') : '(none matched)');
  console.info('[Cleanup] target course title:', TARGET_COURSE_TITLE);
  console.info('[Cleanup] courses selected for deletion:', courseIdList.length ? courseIdList.join(', ') : '(none matched)');

  if (tutorIdList.length === 0 && courseIdList.length === 0) {
    console.info('[Cleanup] no matching tutors or courses were found.');
    return;
  }

  if (conversationIds.length > 0) {
    await deleteManyAndTrack('DirectMessage', DirectMessage, {
      $or: [
        { conversationId: { $in: conversationIds } },
        { senderId: { $in: tutorIdList } },
        { recipientId: { $in: tutorIdList } },
      ],
    });
    await deleteManyAndTrack('MessageConversation', MessageConversation, { id: { $in: conversationIds } });
  } else if (tutorIdList.length > 0) {
    await deleteManyAndTrack('DirectMessage', DirectMessage, {
      $or: [
        { senderId: { $in: tutorIdList } },
        { recipientId: { $in: tutorIdList } },
      ],
    });
    await deleteManyAndTrack('MessageConversation', MessageConversation, {
      $or: [
        { tutorId: { $in: tutorIdList } },
        { participantIds: { $in: tutorIdList } },
      ],
    });
  }

  if (tutorIdList.length > 0) {
    await deleteManyAndTrack('Booking', Booking, {
      $or: [
        { tutorId: { $in: tutorIdList } },
        { studentId: { $in: tutorIdList } },
      ],
    });

    await deleteManyAndTrack('Review', Review, {
      $or: [
        { tutorId: { $in: tutorIdList } },
        { studentId: { $in: tutorIdList } },
        ...(bookingIds.length > 0 ? [{ sessionId: { $in: bookingIds } }] : []),
      ],
    });

    await deleteManyAndTrack('Resource', Resource, { tutorId: { $in: tutorIdList } });
    await deleteManyAndTrack('WithdrawalRequest', WithdrawalRequest, { tutorId: { $in: tutorIdList } });

    await deleteManyAndTrack('Question', Question, { studentId: { $in: tutorIdList } });
    await deleteManyAndTrack('StudyPlan', StudyPlan, { studentId: { $in: tutorIdList } });
    await deleteManyAndTrack('SkillLevel', SkillLevel, { studentId: { $in: tutorIdList } });
  }

  if (courseIdList.length > 0) {
    await deleteManyAndTrack('CourseEnrollment', CourseEnrollment, { courseId: { $in: courseIdList } });
    await deleteManyAndTrack('CourseCoupon', CourseCoupon, { courseId: { $in: courseIdList } });
    await deleteManyAndTrack('CourseCouponUsage', CourseCouponUsage, { courseId: { $in: courseIdList } });
  }

  if (tutorIdList.length > 0) {
    await deleteManyAndTrack('CourseEnrollment', CourseEnrollment, { studentId: { $in: tutorIdList } });
    await deleteManyAndTrack('CourseCouponUsage', CourseCouponUsage, { userId: { $in: tutorIdList } });
    await updateCourseEnrollmentListsForDeletedUsers(tutorIdList);
  }

  if (tutorIdList.length > 0 || courseIdList.length > 0 || bookingIds.length > 0) {
    const notificationFilterParts: Record<string, unknown>[] = [];

    if (tutorIdList.length > 0) {
      notificationFilterParts.push({ userId: { $in: tutorIdList } });
    }
    if (courseIdList.length > 0) {
      notificationFilterParts.push({ relatedEntityId: { $in: courseIdList } });
    }
    if (bookingIds.length > 0) {
      notificationFilterParts.push({ relatedEntityId: { $in: bookingIds } });
    }

    if (notificationFilterParts.length > 0) {
      await deleteManyAndTrack('Notification', Notification, { $or: notificationFilterParts });
    }
  }

  if (courseIdList.length > 0) {
    await deleteManyAndTrack('Course', Course, { id: { $in: courseIdList } });
  }

  if (tutorIdList.length > 0) {
    await deleteManyAndTrack('Tutor', Tutor, { id: { $in: tutorIdList } });

    const otpFilterParts: Record<string, unknown>[] = [
      { userId: { $in: tutorIdList } },
    ];
    const tutorEmailList = Array.from(tutorEmails).filter(Boolean);
    if (tutorEmailList.length > 0) {
      otpFilterParts.push({ email: { $in: tutorEmailList } });
    }

    await deleteManyAndTrack('PasswordResetOtp', PasswordResetOtp, {
      $or: otpFilterParts,
    });

    await deleteManyAndTrack('User', User, { id: { $in: tutorIdList } });
  }
};

async function main() {
  dotenv.config({ quiet: true });

  try {
    await connectDB();
    await runCleanup();
    printSummary();
  } catch (error) {
    console.error('[Cleanup] failed:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

void main();
