import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
import session from "express-session";
import MongoStore from "connect-mongo";
import { jsPDF } from "jspdf";
import { connectDB } from "./src/database.js";
import { User } from "./src/models/User.js";
import { Tutor } from "./src/models/Tutor.js";
import { Review } from "./src/models/Review.js";
import { Course } from "./src/models/Course.js";
import { Resource } from "./src/models/Resource.js";
import { Booking } from "./src/models/Booking.js";
import { Question } from "./src/models/Question.js";
import { Quiz } from "./src/models/Quiz.js";
import { StudyPlan } from "./src/models/StudyPlan.js";
import { SkillLevel } from "./src/models/SkillLevel.js";
import { CourseEnrollment } from "./src/models/CourseEnrollment.js";
import { CourseCoupon } from "./src/models/CourseCoupon.js";
import { CourseCouponUsage } from "./src/models/CourseCouponUsage.js";
import { Notification } from "./src/models/Notification.js";
import { WithdrawalRequest } from "./src/models/WithdrawalRequest.js";
import { MessageConversation } from "./src/models/MessageConversation.js";
import { DirectMessage } from "./src/models/DirectMessage.js";
import { quizChatbotRouter } from "./src/server/quiz-chatbot/chatController.js";
import { faqChatbotRouter } from "./src/server/faq-chatbot/chatController.js";
import { authRouter } from "./src/server/auth/authRoutes.js";
import { messagingRouter } from "./src/server/messages/messageRoutes.js";
import {
  hashPassword,
  shouldUpgradePasswordHash,
  validatePasswordStrength,
  verifyPassword,
} from "./src/server/auth/passwordUtils.js";
import { loadSecurityConfig } from "./src/server/config/securityConfig.js";
import { ALLOWED_TUTOR_SUBJECTS, normalizeTutorSubjects } from "./src/data/tutorSubjects.js";
import {
  deleteFile as deleteBlobFile,
  extractBlobNameFromUrl,
  replaceFile,
  uploadFile,
} from "./src/server/storage/azureBlobService.js";

console.log('[Startup] Loading environment variables...');
const dotenvResult = dotenv.config({ quiet: true });
if (dotenvResult.error) {
  console.warn('[Startup] .env file was not loaded; relying on environment variables from host.');
} else {
  console.log('[Startup] Environment variables loaded.');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_ROOT = path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;
const REMEMBER_ME_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const WITHDRAWAL_PLATFORM_FEE_RATE = 0.12;

const AZURE_BLOB_CONTAINER_PROFILE_IMAGES = String(process.env.AZURE_BLOB_CONTAINER_PROFILE_IMAGES || '').trim();
const AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS = String(process.env.AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS || '').trim();
const AZURE_BLOB_CONTAINER_VIDEOS = String(process.env.AZURE_BLOB_CONTAINER_VIDEOS || '').trim();
const AZURE_BLOB_CONTAINER_RESOURCES = String(process.env.AZURE_BLOB_CONTAINER_RESOURCES || '').trim();
const AZURE_BLOB_CONTAINER_RECORDED_LESSONS = String(process.env.AZURE_BLOB_CONTAINER_RECORDED_LESSONS || '').trim();
const AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES = String(process.env.AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES || '').trim();

const getRequiredContainerName = (containerName: string, envKey: string): string => {
  const normalized = String(containerName || '').trim();
  if (!normalized) {
    throw new Error(`${envKey} environment variable is required for Azure Blob Storage uploads.`);
  }

  return normalized;
};

const resolveBlobNameFromMetadataOrUrl = (
  explicitBlobName: unknown,
  assetUrl: unknown,
  containerName: string
): string | undefined => {
  const normalizedBlobName = String(explicitBlobName || '').trim();
  if (normalizedBlobName) {
    return normalizedBlobName;
  }

  return extractBlobNameFromUrl(String(assetUrl || '').trim(), containerName);
};

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const toUploadedAssetResponse = (
  uploaded: { blobUrl: string; blobName: string },
  file: Express.Multer.File
) => ({
  path: uploaded.blobUrl,
  url: uploaded.blobUrl,
  blobUrl: uploaded.blobUrl,
  blobName: uploaded.blobName,
  originalName: file.originalname,
  size: file.size,
  mimeType: file.mimetype,
});

// Configure multer for file uploads
const storage = multer.memoryStorage();

type UploadMiddlewareConfig = {
  fieldName: string;
  maxFileSizeMB: number;
  invalidTypeMessage: string;
  sizeExceededMessage: string;
  genericErrorMessage: string;
  isAllowedFile: (file: Express.Multer.File) => boolean;
};

const createSingleFileUploadMiddleware = (config: UploadMiddlewareConfig) => {
  const uploader = multer({
    storage,
    limits: { fileSize: config.maxFileSizeMB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!config.isAllowedFile(file as Express.Multer.File)) {
        return cb(new Error(config.invalidTypeMessage));
      }
      cb(null, true);
    },
  });

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    uploader.single(config.fieldName)(req, res, (error: any) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: config.sizeExceededMessage });
        }
        return res.status(400).json({ error: error.message });
      }

      return res.status(400).json({ error: error.message || config.genericErrorMessage });
    });
  };
};

const isImageUpload = (file: Express.Multer.File): boolean => {
  return ['image/png', 'image/jpeg', 'image/webp', 'image/jpg'].includes(file.mimetype);
};

const isVideoUpload = (file: Express.Multer.File): boolean => {
  if (file.mimetype.startsWith('video/')) {
    return true;
  }

  const extension = path.extname(file.originalname).toLowerCase();
  return ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].includes(extension);
};

const isResourceUpload = (file: Express.Multer.File): boolean => {
  const allowedMimeTypes = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
  ]);

  if (allowedMimeTypes.has(file.mimetype)) {
    return true;
  }

  const extension = path.extname(file.originalname).toLowerCase();
  return [
    '.pdf',
    '.doc',
    '.docx',
    '.ppt',
    '.pptx',
    '.xls',
    '.xlsx',
    '.txt',
    '.csv',
    '.zip',
    '.rar',
  ].includes(extension);
};

const isTutorCertificateUpload = (file: Express.Multer.File): boolean => {
  const allowedMimeTypes = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
  ]);

  if (allowedMimeTypes.has(file.mimetype)) {
    return true;
  }

  const extension = path.extname(file.originalname).toLowerCase();
  return ['.pdf', '.png', '.jpg', '.jpeg', '.webp'].includes(extension);
};

const handleAvatarUpload = createSingleFileUploadMiddleware({
  fieldName: 'avatar',
  maxFileSizeMB: 5,
  invalidTypeMessage: 'Only PNG, JPG, and WEBP files are allowed for profile pictures.',
  sizeExceededMessage: 'Profile picture must be less than 5MB.',
  genericErrorMessage: 'Avatar upload failed.',
  isAllowedFile: isImageUpload,
});

const handleCourseThumbnailUpload = createSingleFileUploadMiddleware({
  fieldName: 'thumbnail',
  maxFileSizeMB: 8,
  invalidTypeMessage: 'Only PNG, JPG, and WEBP image files are allowed for course thumbnails.',
  sizeExceededMessage: 'Course thumbnail must be less than 8MB.',
  genericErrorMessage: 'Course thumbnail upload failed.',
  isAllowedFile: isImageUpload,
});

const handleCourseVideoUpload = createSingleFileUploadMiddleware({
  fieldName: 'video',
  maxFileSizeMB: 500,
  invalidTypeMessage: 'Only video files are allowed for module video uploads.',
  sizeExceededMessage: 'Module video must be less than 500MB.',
  genericErrorMessage: 'Course video upload failed.',
  isAllowedFile: isVideoUpload,
});

const handleCourseResourceUpload = createSingleFileUploadMiddleware({
  fieldName: 'resource',
  maxFileSizeMB: 50,
  invalidTypeMessage: 'Unsupported resource file type. Upload PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, ZIP, or RAR files.',
  sizeExceededMessage: 'Module resource file must be less than 50MB.',
  genericErrorMessage: 'Course resource upload failed.',
  isAllowedFile: isResourceUpload,
});

const handleTutorResourceUpload = createSingleFileUploadMiddleware({
  fieldName: 'resource',
  maxFileSizeMB: 50,
  invalidTypeMessage: 'Unsupported resource file type. Upload PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, ZIP, or RAR files.',
  sizeExceededMessage: 'Resource file must be less than 50MB.',
  genericErrorMessage: 'Tutor resource upload failed.',
  isAllowedFile: isResourceUpload,
});

const handleTutorCertificateUpload = createSingleFileUploadMiddleware({
  fieldName: 'certificate',
  maxFileSizeMB: 20,
  invalidTypeMessage: 'Unsupported tutor certificate file type. Upload PDF, PNG, JPG, or WEBP files.',
  sizeExceededMessage: 'Tutor certificate file must be less than 20MB.',
  genericErrorMessage: 'Tutor certificate upload failed.',
  isAllowedFile: isTutorCertificateUpload,
});

const handleRecordedLessonUpload = createSingleFileUploadMiddleware({
  fieldName: 'lesson',
  maxFileSizeMB: 1024,
  invalidTypeMessage: 'Only video files are allowed for recorded lessons.',
  sizeExceededMessage: 'Recorded lesson video must be less than 1GB.',
  genericErrorMessage: 'Recorded lesson upload failed.',
  isAllowedFile: isVideoUpload,
});

const createEntityId = () => Math.random().toString(36).substr(2, 9);

type NotificationDraft = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  targetTab?: string;
  relatedEntityId?: string;
  isRead?: boolean;
};

const toNotificationText = (value: unknown, fallback = ''): string => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};

const getDisplayNameFromParts = (firstName: unknown, lastName: unknown, fallback = 'User'): string => {
  const normalizedFirstName = String(firstName || '').trim();
  const normalizedLastName = String(lastName || '').trim();
  const fullName = `${normalizedFirstName} ${normalizedLastName}`.trim();
  return fullName || fallback;
};

const formatSessionLabel = (booking: { subject?: unknown; date?: unknown; timeSlot?: unknown }): string => {
  const subject = toNotificationText(booking.subject, 'Tutoring');
  const date = toNotificationText(booking.date, 'a scheduled date');
  const timeSlot = toNotificationText(booking.timeSlot);
  return `${subject} session on ${date}${timeSlot ? ` at ${timeSlot}` : ''}`;
};

const normalizeNotificationForResponse = (notification: any) => {
  const createdAtValue = notification?.createdAt ? new Date(notification.createdAt) : null;
  const normalizedId = toNotificationText(notification?.id || notification?._id);

  return {
    ...notification,
    id: normalizedId,
    isRead: Boolean(notification?.isRead),
    createdAt:
      createdAtValue && !Number.isNaN(createdAtValue.getTime())
        ? createdAtValue.toISOString()
        : new Date().toISOString(),
  };
};

const buildNotificationDocument = (input: NotificationDraft): Record<string, unknown> | null => {
  const userId = toNotificationText(input.userId);
  const type = toNotificationText(input.type, 'system');
  const title = toNotificationText(input.title);
  const message = toNotificationText(input.message);

  if (!userId || !title || !message) {
    return null;
  }

  const link = toNotificationText(input.link);
  const targetTab = toNotificationText(input.targetTab);
  const relatedEntityId = toNotificationText(input.relatedEntityId);

  const payload: Record<string, unknown> = {
    id: createEntityId(),
    userId,
    type,
    title,
    message,
    isRead: Boolean(input.isRead),
  };

  if (link) payload.link = link;
  if (targetTab) payload.targetTab = targetTab;
  if (relatedEntityId) payload.relatedEntityId = relatedEntityId;

  return payload;
};

const createUserNotification = async (input: NotificationDraft) => {
  const payload = buildNotificationDocument(input);
  if (!payload) {
    return null;
  }

  try {
    return await Notification.create(payload);
  } catch (error) {
    console.warn('Failed to create notification:', error);
    return null;
  }
};

const createUserNotifications = async (inputs: NotificationDraft[]) => {
  const payloads = inputs
    .map((input) => buildNotificationDocument(input))
    .filter((payload): payload is Record<string, unknown> => Boolean(payload));

  if (payloads.length === 0) {
    return;
  }

  try {
    await Notification.insertMany(payloads, { ordered: false });
  } catch (error) {
    console.warn('Failed to create bulk notifications:', error);
  }
};

const resolveNotificationLookup = (notificationId: string, userId: string) => {
  const normalizedNotificationId = toNotificationText(notificationId);
  const normalizedUserId = toNotificationText(userId);
  const canMatchObjectId = /^[a-fA-F0-9]{24}$/.test(normalizedNotificationId);

  if (canMatchObjectId) {
    return {
      userId: normalizedUserId,
      $or: [{ id: normalizedNotificationId }, { _id: normalizedNotificationId }],
    };
  }

  return {
    userId: normalizedUserId,
    id: normalizedNotificationId,
  };
};

const sanitizeFileSegment = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'certificate';

const formatCertificateDate = (dateValue: Date | string): string => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return String(dateValue);
  }
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const normalizeTeachingLevel = (value: unknown): 'School' | 'University' | 'School and University' => {
  const normalized = String(value || '').trim();
  if (normalized === 'Both' || normalized === 'School & University' || normalized === 'School and University') {
    return 'School and University';
  }
  if (normalized === 'University') {
    return 'University';
  }
  return 'School';
};

const INVALID_TUTOR_SUBJECTS_ERROR =
  `Subjects must be STEM or ICT related. Please select at least one subject from: ${ALLOWED_TUTOR_SUBJECTS.join(', ')}.`;

const validateAndNormalizeTutorSubjects = (subjects: unknown): { isValid: boolean; normalizedSubjects: string[] } => {
  console.log('[TutorSubjectValidation] Received subjects:', subjects);
  console.log('[TutorSubjectValidation] Allowed subjects:', ALLOWED_TUTOR_SUBJECTS);

  const normalizedSubjects = normalizeTutorSubjects(subjects);
  return {
    isValid: normalizedSubjects.length > 0,
    normalizedSubjects,
  };
};

type CertificatePdfInput = {
  studentName: string;
  courseTitle: string;
  subject: string;
  completedDate: string;
  certificateId: string;
  tutorLabel: string;
};

const buildBrandedCertificatePdf = (input: CertificatePdfInput): Buffer => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Soft background and two-layer frame for a premium certificate look.
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setDrawColor(109, 40, 217);
  doc.setLineWidth(4);
  doc.roundedRect(24, 24, pageWidth - 48, pageHeight - 48, 14, 14, 'S');

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(40, 40, pageWidth - 80, pageHeight - 80, 12, 12, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(109, 40, 217);
  doc.text('TutorSphere', 60, 78);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text('Certificate of Completion', pageWidth - 60, 78, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(148, 163, 184);
  doc.text('PROUDLY PRESENTED TO', pageWidth / 2, 130, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(44);
  doc.setTextColor(15, 23, 42);
  doc.text('Certificate', pageWidth / 2, 180, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.setTextColor(71, 85, 105);
  doc.text('This certifies that', pageWidth / 2, 220, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(17, 24, 39);
  doc.text(input.studentName, pageWidth / 2, 268, { align: 'center', maxWidth: pageWidth - 140 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(15);
  doc.setTextColor(71, 85, 105);
  doc.text('has successfully completed the course', pageWidth / 2, 300, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(30, 41, 59);
  doc.text(input.courseTitle, pageWidth / 2, 338, { align: 'center', maxWidth: pageWidth - 180 });

  const subjectBadge = `Subject: ${input.subject || 'General'}`;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const badgePadding = 14;
  const badgeHeight = 26;
  const badgeWidth = doc.getTextWidth(subjectBadge) + badgePadding * 2;
  const badgeX = (pageWidth - badgeWidth) / 2;
  const badgeY = 356;

  doc.setFillColor(237, 233, 254);
  doc.setDrawColor(167, 139, 250);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 8, 8, 'FD');
  doc.setTextColor(91, 33, 182);
  doc.text(subjectBadge, pageWidth / 2, badgeY + 17, { align: 'center' });

  const detailsStartY = 432;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(`Completed on: ${input.completedDate}`, 90, detailsStartY);
  doc.text(`Certificate ID: ${input.certificateId}`, 90, detailsStartY + 22);
  doc.text(`Tutor: ${input.tutorLabel}`, 90, detailsStartY + 44);

  const signatureLineY = detailsStartY + 12;
  doc.setDrawColor(148, 163, 184);
  doc.line(pageWidth - 280, signatureLineY, pageWidth - 90, signatureLineY);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text('TutorSphere Academic Team', pageWidth - 185, signatureLineY + 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('Issued by TutorSphere Learning Platform', pageWidth / 2, pageHeight - 40, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
};

const calculateProgress = (completedModuleCount: number, totalModuleCount: number): number => {
  if (totalModuleCount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((completedModuleCount / totalModuleCount) * 100)));
};

const toFinitePrice = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const roundCurrency = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const resolveCourseIsFree = (value: unknown, fallbackPrice: number): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallbackPrice <= 0;
};

const normalizeCouponCode = (value: unknown): string => {
  return String(value || '').trim().toUpperCase();
};

const isCouponExpired = (value: unknown): boolean => {
  if (!value) {
    return false;
  }

  const expiresAt = new Date(String(value));
  if (Number.isNaN(expiresAt.getTime())) {
    return false;
  }

  return expiresAt.getTime() < Date.now();
};

const normalizeCouponForResponse = (coupon: any) => {
  const plainCoupon = typeof coupon?.toObject === 'function' ? coupon.toObject() : coupon;
  return {
    ...plainCoupon,
    code: normalizeCouponCode(plainCoupon?.code),
  };
};

const calculateCouponPriceBreakdown = (originalPrice: number, discountPercentage: number) => {
  const normalizedOriginal = Math.max(0, roundCurrency(originalPrice));
  const normalizedDiscountPercentage = Math.min(100, Math.max(0, Number(discountPercentage) || 0));

  const discountAmount = roundCurrency((normalizedOriginal * normalizedDiscountPercentage) / 100);
  const finalPrice = roundCurrency(Math.max(0, normalizedOriginal - discountAmount));

  return {
    originalPrice: normalizedOriginal,
    discountPercentage: normalizedDiscountPercentage,
    discountAmount,
    finalPrice,
  };
};

const resolveApplicableCouponForStudent = async (args: {
  courseId: string;
  studentId: string;
  couponCode: string;
  originalPrice: number;
}) => {
  const normalizedCode = normalizeCouponCode(args.couponCode);
  if (!normalizedCode) {
    return null;
  }

  const coupon = await CourseCoupon.findOne({ courseId: args.courseId, code: normalizedCode });
  if (!coupon) {
    throw new Error('Invalid coupon code for this course.');
  }

  if (!coupon.isActive) {
    throw new Error('This coupon is currently inactive.');
  }

  if (isCouponExpired(coupon.expiresAt)) {
    throw new Error('This coupon has expired.');
  }

  const usageLimit = Number(coupon.usageLimit);
  if (Number.isFinite(usageLimit) && usageLimit > 0 && Number(coupon.usageCount || 0) >= usageLimit) {
    throw new Error('This coupon usage limit has been reached.');
  }

  const alreadyUsed = await CourseCouponUsage.findOne({
    userId: args.studentId,
    courseId: args.courseId,
    couponCode: normalizedCode,
  });

  if (alreadyUsed) {
    throw new Error('You have already used this coupon for this course.');
  }

  const pricing = calculateCouponPriceBreakdown(args.originalPrice, Number(coupon.discountPercentage || 0));

  return {
    coupon,
    couponCode: normalizedCode,
    ...pricing,
  };
};

const normalizeWithdrawalStatus = (value: unknown): 'pending' | 'approved' | 'rejected' | 'paid' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'approved') return 'approved';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'paid') return 'paid';
  return 'pending';
};

const normalizeWithdrawalPayoutMethodType = (value: unknown): 'bank_transfer' | 'paypal' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'paypal') return 'paypal';
  return 'bank_transfer';
};

const resolveEffectiveWithdrawalStatus = (request: { status?: unknown; payoutMethodType?: unknown }) => {
  const normalizedStatus = normalizeWithdrawalStatus(request.status);
  const payoutMethodType = normalizeWithdrawalPayoutMethodType(request.payoutMethodType);

  // Legacy PayPal rows created before auto-approval should not appear as pending.
  if (payoutMethodType === 'paypal' && normalizedStatus === 'pending') {
    return 'approved' as const;
  }

  return normalizedStatus;
};

const calculateTutorSessionNetEarningsForWithdrawal = async (tutorId: string): Promise<number> => {
  const tutor = await Tutor.findOne({ id: tutorId });
  const hourlyRate = toFinitePrice((tutor as any)?.pricePerHour);
  if (hourlyRate <= 0) {
    return 0;
  }

  const completedPaidSessions = await Booking.countDocuments({
    tutorId,
    status: 'completed',
    paymentStatus: 'paid',
  });

  const gross = completedPaidSessions * hourlyRate;
  const net = gross - gross * WITHDRAWAL_PLATFORM_FEE_RATE;
  return roundCurrency(Math.max(0, net));
};

const calculateTutorCourseNetEarningsForWithdrawal = async (tutorId: string): Promise<number> => {
  const tutorCourseIds = await Course.find({ tutorId }).distinct('id');
  if (!tutorCourseIds.length) {
    return 0;
  }

  const normalizedCourseIds = (tutorCourseIds as string[]).filter(Boolean);
  if (!normalizedCourseIds.length) {
    return 0;
  }

  const courses = await Course.find({ id: { $in: normalizedCourseIds } }, { id: 1, price: 1, isFree: 1 });
  const courseById = new Map(courses.map((course) => [course.id, course]));

  const enrollments = await CourseEnrollment.find({ courseId: { $in: normalizedCourseIds } });

  let netEarnings = 0;
  for (const enrollment of enrollments) {
    const paymentStatus = String((enrollment as any)?.paymentStatus || '').trim().toLowerCase();
    if (paymentStatus && paymentStatus !== 'paid') {
      continue;
    }

    let amountPaid = Number((enrollment as any)?.amountPaid);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      const course = courseById.get(enrollment.courseId);
      const fallbackPrice = toFinitePrice((course as any)?.price);
      const isFree = resolveCourseIsFree((course as any)?.isFree, fallbackPrice);
      amountPaid = isFree ? 0 : fallbackPrice;
    }

    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      continue;
    }

    const netAmount = amountPaid - amountPaid * WITHDRAWAL_PLATFORM_FEE_RATE;
    netEarnings += Math.max(0, netAmount);
  }

  return roundCurrency(Math.max(0, netEarnings));
};

const calculateTutorTotalNetEarningsForWithdrawal = async (tutorId: string): Promise<number> => {
  const [sessionNet, courseNet] = await Promise.all([
    calculateTutorSessionNetEarningsForWithdrawal(tutorId),
    calculateTutorCourseNetEarningsForWithdrawal(tutorId),
  ]);

  return roundCurrency(sessionNet + courseNet);
};

const calculateTutorWithdrawalSummary = async (tutorId: string) => {
  const [totalEarnings, withdrawalRequests] = await Promise.all([
    calculateTutorTotalNetEarningsForWithdrawal(tutorId),
    WithdrawalRequest.find({ tutorId }),
  ]);

  let withdrawnAmount = 0;
  let pendingWithdrawalAmount = 0;
  let approvedWithdrawalAmount = 0;

  for (const request of withdrawalRequests) {
    const normalizedStatus = resolveEffectiveWithdrawalStatus(request);
    const amount = toFinitePrice(request.amount);

    if (normalizedStatus === 'paid') {
      withdrawnAmount += amount;
      continue;
    }

    if (normalizedStatus === 'pending') {
      pendingWithdrawalAmount += amount;
      continue;
    }

    if (normalizedStatus === 'approved') {
      approvedWithdrawalAmount += amount;
    }
  }

  const availableBalance = Math.max(0, totalEarnings - withdrawnAmount - pendingWithdrawalAmount - approvedWithdrawalAmount);

  return {
    totalEarnings: roundCurrency(totalEarnings),
    withdrawnAmount: roundCurrency(withdrawnAmount),
    pendingWithdrawalAmount: roundCurrency(pendingWithdrawalAmount),
    availableBalance: roundCurrency(availableBalance),
  };
};

type NormalizedCourseModuleResource = {
  name: string;
  url: string;
  blobName?: string;
  mimeType?: string;
  size?: number;
};

type NormalizedCourseModule = {
  id: string;
  title: string;
  videoUrl: string;
  videoBlobName?: string;
  videoMimeType?: string;
  videoSize?: number;
  resources: NormalizedCourseModuleResource[];
};

const isLikelyResourceUrl = (value: string): boolean => {
  return isHttpUrl(value) || value.startsWith('./') || value.startsWith('../') || value.startsWith('blob:');
};

const getResourceNameFromUrl = (value: string, fallback = 'Resource'): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const parsed = new URL(trimmed);
      const urlFileName = decodeURIComponent(path.basename(parsed.pathname));
      if (urlFileName) {
        return urlFileName;
      }
    }
  } catch {
    // Fall back to non-URL parsing.
  }

  const localFileName = decodeURIComponent(path.basename(trimmed.split('?')[0].split('#')[0]));
  return localFileName || fallback;
};

const normalizeCourseModuleResource = (
  resource: any,
  resourceIndex: number
): NormalizedCourseModuleResource | null => {
  if (typeof resource === 'string') {
    const value = resource.trim();
    if (!value) {
      return null;
    }

    return {
      name: isLikelyResourceUrl(value) ? getResourceNameFromUrl(value, `Resource ${resourceIndex + 1}`) : value,
      url: value,
    };
  }

  const url = String(resource?.url ?? resource?.path ?? '').trim();
  if (!url) {
    return null;
  }

  const name = String(resource?.name ?? '').trim() || getResourceNameFromUrl(url, `Resource ${resourceIndex + 1}`);
  const blobName = String(resource?.blobName ?? '').trim();
  const mimeType = String(resource?.mimeType ?? '').trim();
  const parsedSize = Number(resource?.size);

  const normalizedResource: NormalizedCourseModuleResource = { name, url };
  if (blobName) {
    normalizedResource.blobName = blobName;
  }
  if (mimeType) {
    normalizedResource.mimeType = mimeType;
  }
  if (Number.isFinite(parsedSize) && parsedSize >= 0) {
    normalizedResource.size = parsedSize;
  }

  return normalizedResource;
};

const normalizeCourseModules = (modules: any): NormalizedCourseModule[] => {
  if (!Array.isArray(modules)) {
    return [];
  }

  return modules
    .map((module: any) => {
      const normalizedModule: NormalizedCourseModule = {
        id: String(module?.id || createEntityId()).trim() || createEntityId(),
        title: String(module?.title || '').trim(),
        videoUrl: String(module?.videoUrl || '').trim(),
        resources: (Array.isArray(module?.resources) ? module.resources : [])
          .map((resource: any, resourceIndex: number) => normalizeCourseModuleResource(resource, resourceIndex))
          .filter((resource: NormalizedCourseModuleResource | null): resource is NormalizedCourseModuleResource => Boolean(resource)),
      };

      const videoBlobName = String(module?.videoBlobName ?? '').trim();
      const videoMimeType = String(module?.videoMimeType ?? '').trim();
      const parsedVideoSize = Number(module?.videoSize);

      if (videoBlobName) {
        normalizedModule.videoBlobName = videoBlobName;
      }
      if (videoMimeType) {
        normalizedModule.videoMimeType = videoMimeType;
      }
      if (Number.isFinite(parsedVideoSize) && parsedVideoSize >= 0) {
        normalizedModule.videoSize = parsedVideoSize;
      }

      return normalizedModule;
    })
    .filter((module: NormalizedCourseModule) => module.title && module.videoUrl);
};

const normalizeCourseForResponse = (course: any) => {
  const plainCourse = typeof course?.toObject === 'function' ? course.toObject() : course;
  return {
    ...plainCourse,
    modules: normalizeCourseModules(plainCourse?.modules),
  };
};

const collectCourseVideoBlobNames = (modules: unknown, containerName: string): Set<string> => {
  const blobNames = new Set<string>();
  if (!Array.isArray(modules)) {
    return blobNames;
  }

  for (const module of modules) {
    const blobName = resolveBlobNameFromMetadataOrUrl(
      (module as any)?.videoBlobName,
      (module as any)?.videoUrl,
      containerName
    );

    if (blobName) {
      blobNames.add(blobName);
    }
  }

  return blobNames;
};

const collectCourseResourceBlobNames = (modules: unknown, containerName: string): Set<string> => {
  const blobNames = new Set<string>();
  if (!Array.isArray(modules)) {
    return blobNames;
  }

  for (const module of modules) {
    const resources = Array.isArray((module as any)?.resources) ? (module as any).resources : [];
    for (const resource of resources) {
      const blobName = resolveBlobNameFromMetadataOrUrl(
        (resource as any)?.blobName,
        (resource as any)?.url ?? (resource as any)?.path,
        containerName
      );

      if (blobName) {
        blobNames.add(blobName);
      }
    }
  }

  return blobNames;
};

const deleteBlobNames = async (blobNames: Set<string>, containerName: string, context: string): Promise<void> => {
  await Promise.all(
    Array.from(blobNames).map(async (blobName) => {
      try {
        await deleteBlobFile(blobName, containerName);
      } catch (error) {
        console.warn(`Failed to delete blob for ${context}:`, { blobName, containerName, error });
      }
    })
  );
};

const isStoredAvatarValue = (avatar?: string): avatar is string => {
  return typeof avatar === 'string' && !avatar.includes('\x00');
};

const buildAvatarResponseUrl = async (
  req: express.Request,
  user: { id: string; avatar?: string }
): Promise<string | undefined> => {
  if (!user.avatar) {
    return undefined;
  }

  if (isStoredAvatarValue(user.avatar)) {
    const normalizedAvatar = user.avatar.trim();
    if (normalizedAvatar) {
      return normalizedAvatar;
    }
  }

  return `${req.protocol}://${req.get('host')}/api/auth/user/${user.id}/avatar`;
};

async function migrateUsers() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    const USERS_DB_PATH = path.join(APP_ROOT, "users.json");

    // Check if users.json exists
    try {
      await fs.access(USERS_DB_PATH);
    } catch (error) {
      console.log('users.json not found, skipping migration');
      return;
    }

    const usersData = await fs.readFile(USERS_DB_PATH, "utf-8");
    const users = JSON.parse(usersData);

    let migratedCount = 0;
    for (const userData of users) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const [firstName, ...lastNameParts] = userData.name.split(' ');
        const lastName = lastNameParts.join(' ') || '';
        await User.create({ ...userData, firstName, lastName });
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      console.log(`Migrated ${migratedCount} users from JSON to MongoDB`);
    }
  } catch (error) {
    console.log('Migration skipped or failed:', (error as Error).message);
  }
}

async function migrateMockData() {
  try {
    // Check if mock data already exists
    const tutorCount = await Tutor.countDocuments();
    if (tutorCount > 0) {
      return;
    }

    // Import mock data
    const { MOCK_TUTORS, MOCK_REVIEWS, MOCK_COURSES, MOCK_RESOURCES } = await import('./src/data/mockData.js');

    // Migrate tutors
    for (const tutorData of MOCK_TUTORS) {
      const existingTutor = await Tutor.findOne({ email: tutorData.email });
      if (!existingTutor) {
        await Tutor.create(tutorData);
      }
    }
    console.log(`Migrated ${MOCK_TUTORS.length} tutors`);

    // Migrate reviews
    for (const reviewData of MOCK_REVIEWS) {
      const existingReview = await Review.findOne({ id: reviewData.id });
      if (!existingReview) {
        await Review.create(reviewData);
      }
    }
    console.log(`Migrated ${MOCK_REVIEWS.length} reviews`);

    // Migrate courses
    for (const courseData of MOCK_COURSES) {
      const existingCourse = await Course.findOne({ id: courseData.id });
      if (!existingCourse) {
        await Course.create(courseData);
      }
    }
    console.log(`Migrated ${MOCK_COURSES.length} courses`);

    // Migrate resources
    for (const resourceData of MOCK_RESOURCES) {
      const existingResource = await Resource.findOne({ id: resourceData.id });
      if (!existingResource) {
        await Resource.create(resourceData);
      }
    }
    console.log(`Migrated ${MOCK_RESOURCES.length} resources`);

  } catch (error) {
    console.log('Mock data migration failed:', (error as Error).message);
  }
}

async function normalizeCourseAccessData() {
  try {
    const courses = await Course.find();
    let updatedCount = 0;

    for (const course of courses) {
      const currentPrice = toFinitePrice(course.price);
      const currentIsFree = resolveCourseIsFree((course as any).isFree, currentPrice);

      let nextPrice = currentPrice;
      let nextIsFree = currentIsFree;

      if (currentIsFree) {
        nextPrice = 0;
      } else if (currentPrice <= 0) {
        nextIsFree = true;
        nextPrice = 0;
      }

      const isFreeChanged = (course as any).isFree !== nextIsFree;
      const priceChanged = course.price !== nextPrice;

      if (!isFreeChanged && !priceChanged) {
        continue;
      }

      course.set({ isFree: nextIsFree, price: nextPrice });
      await course.save();
      updatedCount += 1;
    }

    if (updatedCount > 0) {
      console.log(`Normalized access flags for ${updatedCount} courses`);
    }
  } catch (error) {
    console.log('Course access normalization skipped or failed:', (error as Error).message);
  }
}

async function normalizeResourceDownloadCounts() {
  try {
    await Resource.updateMany(
      {
        $or: [
          { downloadCount: { $exists: false } },
          { downloadCount: null },
          { downloadCount: { $lt: 0 } },
        ],
      },
      { $set: { downloadCount: 0 } }
    );
  } catch (error) {
    console.log('Resource download count normalization skipped or failed:', (error as Error).message);
  }
}

async function normalizeBookingPaymentStates() {
  try {
    // Preserve historical confirmed/completed sessions as paid bookings.
    await Booking.updateMany(
      {
        paymentStatus: { $exists: false },
        status: { $in: ['confirmed', 'completed'] },
      },
      {
        $set: {
          paymentStatus: 'paid',
          paidAt: new Date().toISOString(),
        },
      }
    );

    // Default all other legacy bookings to pending payment.
    await Booking.updateMany(
      {
        paymentStatus: { $exists: false },
        status: { $nin: ['confirmed', 'completed'] },
      },
      {
        $set: {
          paymentStatus: 'pending',
        },
      }
    );
  } catch (error) {
    console.log('Booking payment status normalization skipped or failed:', (error as Error).message);
  }
}

async function normalizeBookingVisibilityFlags() {
  try {
    await Booking.updateMany(
      { hiddenForTutor: { $exists: false } },
      { $set: { hiddenForTutor: false } }
    );

    await Booking.updateMany(
      { hiddenForStudent: { $exists: false } },
      { $set: { hiddenForStudent: false } }
    );
  } catch (error) {
    console.log('Booking visibility normalization skipped or failed:', (error as Error).message);
  }
}

async function startServer() {
  console.log('[Startup] Bootstrapping server runtime...');
  const securityConfig = loadSecurityConfig();
  console.log(`[Startup] Runtime root: ${APP_ROOT}`);
  console.log(`[Startup] Effective mode: ${securityConfig.isProduction ? 'production' : 'development'}`);

  // Connect to MongoDB
  console.log('[Startup] Connecting to MongoDB...');
  await connectDB();
  console.log('[Startup] MongoDB connection established.');

  console.log('[Startup] Running startup data checks...');

  // Migrate existing users from JSON to MongoDB if needed
  await migrateUsers();

  // Migrate mock data to MongoDB if needed
  await migrateMockData();

  // Keep legacy courses compatible with free/paid access rules.
  await normalizeCourseAccessData();

  // Ensure every resource has a persisted, non-negative download count.
  await normalizeResourceDownloadCounts();

  // Keep legacy bookings compatible with payment-aware booking workflows.
  await normalizeBookingPaymentStates();

  // Ensure booking visibility flags exist for soft-hide session cards.
  await normalizeBookingVisibilityFlags();

  console.log('[Startup] Startup data checks completed.');

  const requiredAzureStorageEnvKeys = [
    'AZURE_STORAGE_CONNECTION_STRING',
    'AZURE_BLOB_CONTAINER_PROFILE_IMAGES',
    'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS',
    'AZURE_BLOB_CONTAINER_VIDEOS',
    'AZURE_BLOB_CONTAINER_RESOURCES',
    'AZURE_BLOB_CONTAINER_RECORDED_LESSONS',
    'AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES',
  ];

  const missingAzureStorageKeys = requiredAzureStorageEnvKeys.filter(
    (key) => !String(process.env[key] || '').trim()
  );

  if (missingAzureStorageKeys.length > 0) {
    throw new Error(
      `Missing required Azure Blob Storage environment variables: ${missingAzureStorageKeys.join(', ')}`
    );
  }

  console.log('[Startup] Azure Blob Storage configuration validated.');

  const app = express();
  const port = process.env.PORT || 3000;
  const isProduction = securityConfig.isProduction;
  const sameSiteMode: 'none' | 'lax' = isProduction ? 'none' : 'lax';
  console.log(`[Startup] HTTP bind target set to 0.0.0.0:${port}`);

  // Honor reverse-proxy headers (App Service / load balancers) for protocol and host awareness.
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(cors({ origin: true, credentials: true }));

  const sessionStore = isProduction
    ? MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'app_sessions',
      ttl: Math.floor(REMEMBER_ME_MAX_AGE_MS / 1000),
      autoRemove: 'native',
    })
    : undefined;

  app.use(
    session({
      secret: securityConfig.sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: isProduction,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: sameSiteMode,
      },
    })
  );

  console.log(`[Startup] Cookie mode: secure=${isProduction}, sameSite=${sameSiteMode}, httpOnly=true`);
  console.log(`[Startup] Session store mode: ${isProduction ? 'connect-mongo' : 'memory (development)'}`);
  app.use('/api/quiz-chatbot', quizChatbotRouter);
  app.use('/api/faq-chatbot', faqChatbotRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/messages', messagingRouter);
  console.log('[Startup] Core route setup completed.');

  app.post('/api/uploads/course-thumbnail', handleCourseThumbnailUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No thumbnail file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS,
        'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS'
      );
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname || 'thumbnail',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file));
    } catch (error) {
      console.error('Course thumbnail upload error:', error);
      res.status(500).json({ error: 'Failed to upload course thumbnail.' });
    }
  });

  app.post('/api/uploads/course-video', handleCourseVideoUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_VIDEOS,
        'AZURE_BLOB_CONTAINER_VIDEOS'
      );
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname || 'video',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file));
    } catch (error) {
      console.error('Course video upload error:', error);
      res.status(500).json({ error: 'Failed to upload course video.' });
    }
  });

  app.post('/api/uploads/course-resource', handleCourseResourceUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No resource file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname || 'resource',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file));
    } catch (error) {
      console.error('Course resource upload error:', error);
      res.status(500).json({ error: 'Failed to upload course resource file.' });
    }
  });

  app.post('/api/uploads/tutor-resource', handleTutorResourceUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No resource file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname || 'resource',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file));
    } catch (error) {
      console.error('Tutor resource upload error:', error);
      res.status(500).json({ error: 'Failed to upload tutor resource file.' });
    }
  });

  app.post('/api/uploads/tutor-certificate', handleTutorCertificateUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No certificate file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES,
        'AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES'
      );
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname || 'certificate',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file));
    } catch (error) {
      console.error('Tutor certificate upload error:', error);
      res.status(500).json({ error: 'Failed to upload tutor certificate file.' });
    }
  });

  app.post('/api/uploads/recorded-lesson', handleRecordedLessonUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No recorded lesson file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RECORDED_LESSONS,
        'AZURE_BLOB_CONTAINER_RECORDED_LESSONS'
      );
      const uploaded = await uploadFile(
        req.file.buffer,
        req.file.originalname || 'recorded-lesson',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file));
    } catch (error) {
      console.error('Recorded lesson upload error:', error);
      res.status(500).json({ error: 'Failed to upload recorded lesson file.' });
    }
  });

  // Auth APIs
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { firstName, lastName, email, password, role } = req.body;
      const normalizedEmail = email ? email.trim() : '';
      const normalizedPassword = String(password || '');
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

      if (!firstName || !lastName || !normalizedEmail || !normalizedPassword) {
        return res.status(400).json({ error: "First name, last name, email, and password are required" });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      const hashedPassword = await hashPassword(normalizedPassword);
      const newUser = new User({
        id,
        firstName,
        lastName,
        email: normalizedEmail,
        password: hashedPassword,
        role: role || 'student',
      });

      await newUser.save();

      res.json({
        id,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const normalizedEmail = email.trim();
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const user = await User.findOne({
        email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') },
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (shouldUpgradePasswordHash(user.password)) {
        try {
          user.password = await hashPassword(password);
          await user.save();
        } catch (upgradeError) {
          console.warn('Failed to upgrade legacy password hash during login:', upgradeError);
        }
      }

      let avatarUrl: string | undefined;
      try {
        avatarUrl = await buildAvatarResponseUrl(req, user as { id: string; avatar?: string });
      } catch (avatarError) {
        console.warn('Failed to build avatar URL during login:', avatarError);
        avatarUrl = undefined;
      }

      const persistentSession = Boolean(rememberMe);
      if (req.session) {
        (req.session as any).userId = user.id;
        (req.session as any).role = user.role;
        req.session.cookie.maxAge = persistentSession ? REMEMBER_ME_MAX_AGE_MS : undefined;
      }

      // Fallback to splitting name for old users if firstName is missing
      let fName = user.firstName;
      let lName = user.lastName;
      if (!fName && !lName && (user as any).name) {
        const parts = (user as any).name.split(' ');
        fName = parts[0] || 'User';
        lName = parts.slice(1).join(' ') || '';
      }

      res.json({
        id: user.id,
        firstName: fName || 'User',
        lastName: lName || '',
        email: user.email,
        role: user.role,
        avatar: avatarUrl,
        phone: user.phone,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const { userId, currentPassword, newPassword, confirmPassword } = req.body || {};

      const normalizedUserId = String(userId || '').trim();
      const currentPasswordValue = String(currentPassword || '');
      const newPasswordValue = String(newPassword || '');
      const confirmPasswordValue = String(confirmPassword || '');

      if (!normalizedUserId || !currentPasswordValue || !newPasswordValue || !confirmPasswordValue) {
        return res.status(400).json({ error: 'User ID, current password, new password, and confirm password are required.' });
      }

      if (newPasswordValue !== confirmPasswordValue) {
        return res.status(400).json({ error: 'New password and confirm password do not match.' });
      }

      const strengthError = validatePasswordStrength(newPasswordValue);
      if (strengthError) {
        return res.status(400).json({ error: strengthError });
      }

      const user = await User.findOne({ id: normalizedUserId });
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const isCurrentPasswordValid = await verifyPassword(currentPasswordValue, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }

      const isSameAsCurrentPassword = await verifyPassword(newPasswordValue, user.password);
      if (isSameAsCurrentPassword) {
        return res.status(400).json({ error: 'New password must be different from your current password.' });
      }

      user.password = await hashPassword(newPasswordValue);
      await user.save();

      return res.json({ message: 'Password changed successfully.' });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ error: 'Failed to change password. Please try again.' });
    }
  });

  app.put("/api/auth/user/:id", handleAvatarUpload, async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone } = req.body;

      const user = await User.findOne({ id });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phone !== undefined) user.phone = phone;
      if (req.file) {
        const containerName = getRequiredContainerName(
          AZURE_BLOB_CONTAINER_PROFILE_IMAGES,
          'AZURE_BLOB_CONTAINER_PROFILE_IMAGES'
        );
        const previousAvatarBlobName = resolveBlobNameFromMetadataOrUrl(
          (user as any).avatarBlobName,
          user.avatar,
          containerName
        );

        const uploadedAvatar = await replaceFile(
          previousAvatarBlobName,
          req.file.buffer,
          req.file.originalname || 'avatar',
          containerName,
          req.file.mimetype
        );

        user.avatar = uploadedAvatar.blobUrl;
        (user as any).avatarBlobName = uploadedAvatar.blobName;
        (user as any).avatarMimeType = req.file.mimetype;
        (user as any).avatarSize = req.file.size;
        console.log('Avatar uploaded to Azure Blob:', {
          size: req.file.size,
          mimetype: req.file.mimetype,
          blobName: uploadedAvatar.blobName,
          blobUrl: uploadedAvatar.blobUrl,
        });
      }

      await user.save();

      await createUserNotification({
        userId: user.id,
        type: 'profile_update',
        title: 'Profile updated',
        message: 'Your account profile details were updated successfully.',
        targetTab: 'settings',
        link: '/settings',
      });

      let avatarUrl: string | undefined;
      try {
        avatarUrl = await buildAvatarResponseUrl(req, user as { id: string; avatar?: string });
      } catch (avatarError) {
        console.warn('Failed to build avatar URL after profile update:', avatarError);
        avatarUrl = undefined;
      }
      res.json({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, avatar: avatarUrl, phone: user.phone });
    } catch (error) {
      console.error("Update user error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  });

  app.delete("/api/auth/user/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findOne({ id });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let avatarBlobName: string | undefined;
      try {
        const containerName = getRequiredContainerName(
          AZURE_BLOB_CONTAINER_PROFILE_IMAGES,
          'AZURE_BLOB_CONTAINER_PROFILE_IMAGES'
        );
        avatarBlobName = resolveBlobNameFromMetadataOrUrl(
          (user as any).avatarBlobName,
          user.avatar,
          containerName
        );
      } catch (configError) {
        console.warn('Profile image container configuration missing while deleting user:', configError);
      }

      // Remove role-specific data first to keep dangling references out of the app.
      if (user.role === 'tutor') {
        const tutorCourses = await Course.find({ tutorId: id });
        const tutorCourseIds = tutorCourses.map((course) => course.id);

        const thumbnailContainerName = getRequiredContainerName(
          AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS,
          'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS'
        );
        const videoContainerName = getRequiredContainerName(
          AZURE_BLOB_CONTAINER_VIDEOS,
          'AZURE_BLOB_CONTAINER_VIDEOS'
        );
        const resourceContainerName = getRequiredContainerName(
          AZURE_BLOB_CONTAINER_RESOURCES,
          'AZURE_BLOB_CONTAINER_RESOURCES'
        );

        const courseThumbnailBlobNames = new Set<string>();
        const courseVideoBlobNames = new Set<string>();
        const courseResourceBlobNames = new Set<string>();

        for (const course of tutorCourses) {
          const thumbnailBlobName = resolveBlobNameFromMetadataOrUrl(
            (course as any).thumbnailBlobName,
            (course as any).thumbnail,
            thumbnailContainerName
          );
          if (thumbnailBlobName) {
            courseThumbnailBlobNames.add(thumbnailBlobName);
          }

          const courseVideoNames = collectCourseVideoBlobNames((course as any).modules, videoContainerName);
          courseVideoNames.forEach((blobName) => courseVideoBlobNames.add(blobName));

          const courseResourceNames = collectCourseResourceBlobNames((course as any).modules, resourceContainerName);
          courseResourceNames.forEach((blobName) => courseResourceBlobNames.add(blobName));
        }

        const tutorResources = await Resource.find({ tutorId: id });
        const tutorResourceBlobNames = new Set<string>();
        for (const resource of tutorResources) {
          const blobName = resolveBlobNameFromMetadataOrUrl(
            (resource as any).blobName,
            (resource as any).url,
            resourceContainerName
          );
          if (blobName) {
            tutorResourceBlobNames.add(blobName);
          }
        }

        if (tutorCourseIds.length > 0) {
          await CourseEnrollment.deleteMany({ courseId: { $in: tutorCourseIds } });
        }

        await Course.deleteMany({ tutorId: id });
        await Resource.deleteMany({ tutorId: id });
        await Booking.deleteMany({ tutorId: id });
        await Review.deleteMany({ tutorId: id });

        if (courseThumbnailBlobNames.size > 0) {
          await deleteBlobNames(
            courseThumbnailBlobNames,
            thumbnailContainerName,
            `tutor course thumbnail cleanup (${id})`
          );
        }
        if (courseVideoBlobNames.size > 0) {
          await deleteBlobNames(courseVideoBlobNames, videoContainerName, `tutor course video cleanup (${id})`);
        }
        if (courseResourceBlobNames.size > 0) {
          await deleteBlobNames(
            courseResourceBlobNames,
            resourceContainerName,
            `tutor course resource cleanup (${id})`
          );
        }
        if (tutorResourceBlobNames.size > 0) {
          await deleteBlobNames(tutorResourceBlobNames, resourceContainerName, `tutor resource cleanup (${id})`);
        }
      } else {
        await Booking.deleteMany({ studentId: id });
        await Review.deleteMany({ studentId: id });
        await Question.deleteMany({ studentId: id });
        await CourseEnrollment.deleteMany({ studentId: id });
        await Course.updateMany(
          { enrolledStudents: id },
          { $pull: { enrolledStudents: id } }
        );
        await StudyPlan.deleteMany({ studentId: id });
        await SkillLevel.deleteMany({ studentId: id });
      }

      // Remove tutor profile if one exists (safe no-op for students).
      await Tutor.deleteMany({ id });
      await MessageConversation.deleteMany({ participantIds: id });
      await DirectMessage.deleteMany({ $or: [{ senderId: id }, { recipientId: id }] });
      await Notification.deleteMany({ userId: id });
      await User.deleteOne({ id });

      if (avatarBlobName) {
        try {
          const containerName = getRequiredContainerName(
            AZURE_BLOB_CONTAINER_PROFILE_IMAGES,
            'AZURE_BLOB_CONTAINER_PROFILE_IMAGES'
          );
          await deleteBlobFile(avatarBlobName, containerName);
        } catch (deleteError) {
          console.warn('Failed to remove avatar blob during account deletion:', {
            avatarBlobName,
            deleteError,
          });
        }
      }

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete user account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/user/:id/avatar", async (req, res) => {
    try {
      const { id } = req.params;
      console.log('Avatar request for user:', id);
      const user = await User.findOne({ id });
      console.log('User found:', !!user, 'Has avatar:', !!user?.avatar, 'Avatar value:', user?.avatar);
      if (!user || !user.avatar) {
        console.log('Avatar not found for user:', id);
        return res.status(404).json({ error: "Avatar not found" });
      }

      if (typeof user.avatar === 'string') {
        const normalizedAvatar = user.avatar.trim();
        if (!normalizedAvatar) {
          return res.status(404).json({ error: 'Avatar not found' });
        }

        if (isHttpUrl(normalizedAvatar)) {
          return res.redirect(normalizedAvatar);
        }

        if (isStoredAvatarValue(normalizedAvatar)) {
          return res.status(404).json({
            error: 'Legacy local avatar path is no longer available. Please upload a new profile image.',
          });
        }
      }

      // Legacy binary avatar fallback.
      console.log('Serving legacy binary avatar data');
      res.set('Content-Type', 'image/jpeg');
      res.send(user.avatar);
    } catch (error) {
      console.error("Get avatar error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get('/api/notifications', async (req, res) => {
    try {
      const userId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      const requestedLimit = Number(req.query.limit);
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
        : 25;

      const isReadQuery = typeof req.query.isRead === 'string' ? req.query.isRead.trim().toLowerCase() : '';
      const query: Record<string, unknown> = { userId };
      if (isReadQuery === 'true' || isReadQuery === 'false') {
        query.isRead = isReadQuery === 'true';
      }

      const [notifications, unreadCount] = await Promise.all([
        Notification.find(query).sort({ createdAt: -1 }).limit(limit),
        Notification.countDocuments({ userId, isRead: false }),
      ]);

      return res.json({
        notifications: notifications.map((notification) =>
          normalizeNotificationForResponse(
            typeof (notification as any).toObject === 'function'
              ? (notification as any).toObject()
              : notification
          )
        ),
        unreadCount,
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/notifications', async (req, res) => {
    try {
      const userId = toNotificationText(req.body?.userId);
      const title = toNotificationText(req.body?.title);
      const message = toNotificationText(req.body?.message);
      const type = toNotificationText(req.body?.type, 'system');

      if (!userId || !title || !message) {
        return res.status(400).json({ error: 'userId, title, and message are required.' });
      }

      const user = await User.findOne({ id: userId });
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const notification = await createUserNotification({
        userId,
        type,
        title,
        message,
        link: toNotificationText(req.body?.link) || undefined,
        targetTab: toNotificationText(req.body?.targetTab) || undefined,
        relatedEntityId: toNotificationText(req.body?.relatedEntityId) || undefined,
        isRead: Boolean(req.body?.isRead),
      });

      if (!notification) {
        return res.status(500).json({ error: 'Failed to create notification.' });
      }

      const unreadCount = await Notification.countDocuments({ userId, isRead: false });

      return res.status(201).json({
        notification: normalizeNotificationForResponse(
          typeof (notification as any).toObject === 'function'
            ? (notification as any).toObject()
            : notification
        ),
        unreadCount,
      });
    } catch (error) {
      console.error('Create notification error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/notifications/read-all', async (req, res) => {
    try {
      const userId = toNotificationText(req.body?.userId);
      if (!userId) {
        return res.status(400).json({ error: 'userId is required.' });
      }

      const result = await Notification.updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
      );

      return res.json({
        modifiedCount: Number(result.modifiedCount || 0),
        unreadCount: 0,
      });
    } catch (error) {
      console.error('Mark all notifications as read error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/notifications/:id/read', async (req, res) => {
    try {
      const userId = toNotificationText(req.body?.userId || req.query.userId);
      const notificationId = toNotificationText(req.params.id);

      if (!userId || !notificationId) {
        return res.status(400).json({ error: 'userId and notification id are required.' });
      }

      const notification = await Notification.findOneAndUpdate(
        resolveNotificationLookup(notificationId, userId),
        { $set: { isRead: true } },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found.' });
      }

      const unreadCount = await Notification.countDocuments({ userId, isRead: false });

      return res.json({
        notification: normalizeNotificationForResponse(
          typeof (notification as any).toObject === 'function'
            ? (notification as any).toObject()
            : notification
        ),
        unreadCount,
      });
    } catch (error) {
      console.error('Mark notification as read error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Tutor APIs
  app.get("/api/tutors", async (req, res) => {
    try {
      const tutors = await Tutor.find();
      res.json(tutors);
    } catch (error) {
      console.error("Get tutors error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/tutors/:id", async (req, res) => {
    try {
      const tutor = await Tutor.findOne({ id: req.params.id });
      if (tutor) {
        res.json(tutor);
      } else {
        res.status(404).json({ error: "Tutor not found" });
      }
    } catch (error) {
      console.error("Get tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/tutors", async (req, res) => {
    try {
      const tutorData = req.body || {};
      const { isValid, normalizedSubjects } = validateAndNormalizeTutorSubjects(tutorData.subjects);

      if (!isValid) {
        return res.status(400).json({ error: INVALID_TUTOR_SUBJECTS_ERROR });
      }

      const id = tutorData.id || Math.random().toString(36).substr(2, 9);
      const tutor = new Tutor({
        ...tutorData,
        subjects: normalizedSubjects,
        teachingLevel: normalizeTeachingLevel(tutorData.teachingLevel),
        id,
      });
      await tutor.save();
      res.json(tutor);
    } catch (error) {
      console.error("Create tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/tutors/:id", async (req, res) => {
    try {
      let tutor = await Tutor.findOne({ id: req.params.id });
      const { teachingLevel: requestedTeachingLevel, ...incomingTutorData } = req.body || {};

      if (tutor) {
        const nextTutorPayload: Record<string, unknown> = {
          ...incomingTutorData,
          ...(requestedTeachingLevel !== undefined
            ? { teachingLevel: normalizeTeachingLevel(requestedTeachingLevel) }
            : {}),
        };

        if (Object.prototype.hasOwnProperty.call(incomingTutorData, 'subjects')) {
          const { isValid, normalizedSubjects } = validateAndNormalizeTutorSubjects(incomingTutorData.subjects);
          if (!isValid) {
            return res.status(400).json({ error: INVALID_TUTOR_SUBJECTS_ERROR });
          }

          nextTutorPayload.subjects = normalizedSubjects;
        }

        tutor = await Tutor.findOneAndUpdate(
          { id: req.params.id },
          nextTutorPayload,
          { new: true }
        );
        res.json(tutor);
      } else {
        const user = await User.findOne({ id: req.params.id });
        if (!user) {
          return res.status(404).json({ error: "User not found for tutor profile" });
        }

        const { isValid, normalizedSubjects } = validateAndNormalizeTutorSubjects(incomingTutorData.subjects);
        if (!isValid) {
          return res.status(400).json({ error: INVALID_TUTOR_SUBJECTS_ERROR });
        }

        tutor = new Tutor({
          ...incomingTutorData,
          id: user.id,
          name: incomingTutorData.name || `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
          email: incomingTutorData.email || user.email,
          role: 'tutor',
          qualifications: incomingTutorData.qualifications || 'Not specified',
          subjects: normalizedSubjects,
          teachingLevel: normalizeTeachingLevel(requestedTeachingLevel || 'School'),
          pricePerHour: incomingTutorData.pricePerHour || 0,
          rating: incomingTutorData.rating ?? 0,
          reviewCount: incomingTutorData.reviewCount ?? 0,
          bio: incomingTutorData.bio || 'New tutor on TutorSphere',
          availability: incomingTutorData.availability || [],
          isVerified: incomingTutorData.isVerified ?? false,
        });

        await tutor.save();
        res.json(tutor);
      }
    } catch (error) {
      console.error("Update tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/tutors/:id", async (req, res) => {
    try {
      const tutor = await Tutor.findOneAndDelete({ id: req.params.id });
      if (tutor) {
        res.json({ message: "Tutor deleted successfully" });
      } else {
        res.status(404).json({ error: "Tutor not found" });
      }
    } catch (error) {
      console.error("Delete tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Review APIs
  app.get("/api/reviews", async (req, res) => {
    try {
      const reviews = await Review.find().sort({ date: -1, createdAt: -1 });
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/reviews/:tutorId", async (req, res) => {
    try {
      const reviews = await Review.find({ tutorId: req.params.tutorId }).sort({ date: -1, createdAt: -1 });
      res.json(reviews);
    } catch (error) {
      console.error("Get tutor reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const reviewData = req.body || {};
      const tutorId = String(reviewData.tutorId || '').trim();
      const studentId = String(reviewData.studentId || '').trim();
      const studentName = String(reviewData.studentName || '').trim();
      const sessionId = String(reviewData.sessionId || '').trim();
      const rating = Number(reviewData.rating);
      const comment = String(reviewData.comment || '').trim();
      const date = String(reviewData.date || new Date().toISOString().split('T')[0]).trim();

      if (!tutorId || !studentId || !studentName) {
        return res.status(400).json({ error: 'tutorId, studentId, and studentName are required.' });
      }

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'rating must be between 1 and 5.' });
      }

      if (sessionId) {
        const existingReview = await Review.findOne({ sessionId, studentId });
        if (existingReview) {
          existingReview.tutorId = tutorId;
          existingReview.studentName = studentName;
          existingReview.rating = rating;
          existingReview.comment = comment;
          existingReview.date = date;
          await existingReview.save();
          return res.json(existingReview);
        }
      }

      const id = Math.random().toString(36).substr(2, 9);
      const review = new Review({
        id,
        tutorId,
        studentId,
        studentName,
        sessionId: sessionId || undefined,
        rating,
        comment,
        date,
      });
      await review.save();
      res.json(review);
    } catch (error) {
      console.error("Create review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/reviews/:id", async (req, res) => {
    try {
      const review = await Review.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (review) {
        res.json(review);
      } else {
        res.status(404).json({ error: "Review not found" });
      }
    } catch (error) {
      console.error("Update review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/reviews/:id", async (req, res) => {
    try {
      const review = await Review.findOneAndDelete({ id: req.params.id });
      if (review) {
        res.json({ message: "Review deleted successfully" });
      } else {
        res.status(404).json({ error: "Review not found" });
      }
    } catch (error) {
      console.error("Delete review error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Course APIs
  app.get("/api/courses", async (req, res) => {
    try {
      const tutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';
      const query = tutorId ? { tutorId } : {};
      const courses = await Course.find(query);
      res.json(courses.map((course) => normalizeCourseForResponse(course)));
    } catch (error) {
      console.error("Get courses error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/courses/:id", async (req, res) => {
    try {
      const course = await Course.findOne({ id: req.params.id });
      if (course) {
        res.json(normalizeCourseForResponse(course));
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Get course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/courses", async (req, res) => {
    try {
      const courseData = req.body;

      if (!courseData?.tutorId) {
        return res.status(400).json({ error: "tutorId is required to create a course" });
      }

      const tutorUser = await User.findOne({ id: courseData.tutorId, role: 'tutor' });
      if (!tutorUser) {
        return res.status(400).json({ error: "Invalid tutorId. Tutor account not found." });
      }

      const modules = normalizeCourseModules(courseData.modules);

      if (modules.length === 0) {
        return res.status(400).json({ error: "At least one video module is required." });
      }

      const incomingPrice = toFinitePrice(courseData?.price);
      const isFree = resolveCourseIsFree(courseData?.isFree, incomingPrice);
      const price = isFree ? 0 : incomingPrice;

      if (!isFree && price <= 0) {
        return res.status(400).json({ error: "Paid courses must include a valid price greater than zero." });
      }

      const id = createEntityId();
      const course = new Course({
        ...courseData,
        id,
        isFree,
        price,
        modules,
        enrolledStudents: Array.isArray(courseData.enrolledStudents) ? courseData.enrolledStudents : [],
      });
      await course.save();
      res.json(normalizeCourseForResponse(course));
    } catch (error) {
      console.error("Create course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/courses/:id", async (req, res) => {
    try {
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      if (!actorId) {
        return res.status(401).json({ error: "actorId is required to update a course." });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: "Only tutor accounts can manage courses." });
      }

      const existingCourse = await Course.findOne({ id: req.params.id });
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (existingCourse.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only manage your own courses." });
      }

      const updatePayload = { ...req.body };
      delete updatePayload.actorId;
      delete updatePayload.enrolledStudents;

      if (updatePayload.tutorId && updatePayload.tutorId !== existingCourse.tutorId) {
        return res.status(400).json({ error: "Course owner cannot be changed." });
      }

      const existingIsFree = resolveCourseIsFree((existingCourse as any).isFree, toFinitePrice(existingCourse.price));
      const nextIsFree = typeof updatePayload.isFree === 'boolean' ? updatePayload.isFree : existingIsFree;
      const nextPrice = updatePayload.price !== undefined
        ? toFinitePrice(updatePayload.price)
        : toFinitePrice(existingCourse.price);

      if (!nextIsFree && nextPrice <= 0) {
        return res.status(400).json({ error: "Paid courses must include a valid price greater than zero." });
      }

      updatePayload.isFree = nextIsFree;
      updatePayload.price = nextIsFree ? 0 : nextPrice;

      if (Array.isArray(updatePayload.modules)) {
        const normalizedModules = normalizeCourseModules(updatePayload.modules);

        if (normalizedModules.length === 0) {
          return res.status(400).json({ error: "At least one video module is required." });
        }

        updatePayload.modules = normalizedModules;
      }

      const thumbnailContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS,
        'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS'
      );
      const videoContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_VIDEOS,
        'AZURE_BLOB_CONTAINER_VIDEOS'
      );
      const resourceContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );

      let staleThumbnailBlobName: string | undefined;
      let staleVideoBlobNames = new Set<string>();
      let staleResourceBlobNames = new Set<string>();

      if (updatePayload.thumbnail !== undefined || updatePayload.thumbnailBlobName !== undefined) {
        const existingThumbnailBlobName = resolveBlobNameFromMetadataOrUrl(
          (existingCourse as any).thumbnailBlobName,
          existingCourse.thumbnail,
          thumbnailContainerName
        );
        const nextThumbnailValue =
          typeof updatePayload.thumbnail === 'string' ? updatePayload.thumbnail : existingCourse.thumbnail;
        const nextThumbnailBlobName = resolveBlobNameFromMetadataOrUrl(
          updatePayload.thumbnailBlobName,
          nextThumbnailValue,
          thumbnailContainerName
        );

        if (existingThumbnailBlobName && existingThumbnailBlobName !== nextThumbnailBlobName) {
          staleThumbnailBlobName = existingThumbnailBlobName;
        }
      }

      if (Array.isArray(updatePayload.modules)) {
        const existingVideoBlobNames = collectCourseVideoBlobNames((existingCourse as any).modules, videoContainerName);
        const nextVideoBlobNames = collectCourseVideoBlobNames(updatePayload.modules, videoContainerName);
        staleVideoBlobNames = new Set(
          Array.from(existingVideoBlobNames).filter((blobName) => !nextVideoBlobNames.has(blobName))
        );

        const existingResourceBlobNames = collectCourseResourceBlobNames(
          (existingCourse as any).modules,
          resourceContainerName
        );
        const nextResourceBlobNames = collectCourseResourceBlobNames(updatePayload.modules, resourceContainerName);
        staleResourceBlobNames = new Set(
          Array.from(existingResourceBlobNames).filter((blobName) => !nextResourceBlobNames.has(blobName))
        );
      }

      const course = await Course.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
        { new: true }
      );
      if (course) {
        if (staleThumbnailBlobName) {
          await deleteBlobNames(
            new Set([staleThumbnailBlobName]),
            thumbnailContainerName,
            `course thumbnail replacement (${course.id})`
          );
        }

        if (staleVideoBlobNames.size > 0) {
          await deleteBlobNames(
            staleVideoBlobNames,
            videoContainerName,
            `course video replacement (${course.id})`
          );
        }

        if (staleResourceBlobNames.size > 0) {
          await deleteBlobNames(
            staleResourceBlobNames,
            resourceContainerName,
            `course resource replacement (${course.id})`
          );
        }

        res.json(normalizeCourseForResponse(course));
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Update course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    try {
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      if (!actorId) {
        return res.status(401).json({ error: "actorId is required to delete a course." });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: "Only tutor accounts can delete courses." });
      }

      const existingCourse = await Course.findOne({ id: req.params.id });
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (existingCourse.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only delete your own courses." });
      }

      const thumbnailContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS,
        'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS'
      );
      const videoContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_VIDEOS,
        'AZURE_BLOB_CONTAINER_VIDEOS'
      );
      const resourceContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );

      const thumbnailBlobName = resolveBlobNameFromMetadataOrUrl(
        (existingCourse as any).thumbnailBlobName,
        existingCourse.thumbnail,
        thumbnailContainerName
      );
      const videoBlobNames = collectCourseVideoBlobNames((existingCourse as any).modules, videoContainerName);
      const resourceBlobNames = collectCourseResourceBlobNames((existingCourse as any).modules, resourceContainerName);

      const course = await Course.findOneAndDelete({ id: req.params.id });
      if (course) {
        await CourseEnrollment.deleteMany({ courseId: req.params.id });
        await CourseCoupon.deleteMany({ courseId: req.params.id });
        await CourseCouponUsage.deleteMany({ courseId: req.params.id });

        if (thumbnailBlobName) {
          await deleteBlobNames(
            new Set([thumbnailBlobName]),
            thumbnailContainerName,
            `course thumbnail delete (${req.params.id})`
          );
        }
        if (videoBlobNames.size > 0) {
          await deleteBlobNames(videoBlobNames, videoContainerName, `course video delete (${req.params.id})`);
        }
        if (resourceBlobNames.size > 0) {
          await deleteBlobNames(resourceBlobNames, resourceContainerName, `course resource delete (${req.params.id})`);
        }

        res.json({ message: "Course deleted successfully" });
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Delete course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get('/api/courses/:id/coupons', async (req, res) => {
    try {
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : '';
      if (!actorId) {
        return res.status(401).json({ error: 'actorId is required to view course coupons.' });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: 'Only tutor accounts can manage course coupons.' });
      }

      const course = await Course.findOne({ id: req.params.id });
      if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      if (course.tutorId !== actorId) {
        return res.status(403).json({ error: 'You can only manage coupons for your own courses.' });
      }

      const coupons = await CourseCoupon.find({ courseId: req.params.id }).sort({ createdAt: -1 });
      return res.json(coupons.map((coupon) => normalizeCouponForResponse(coupon)));
    } catch (error) {
      console.error('Get course coupons error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/courses/:id/coupons', async (req, res) => {
    try {
      const actorId = String(req.body?.actorId || '').trim();
      if (!actorId) {
        return res.status(401).json({ error: 'actorId is required to create a coupon.' });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: 'Only tutor accounts can manage course coupons.' });
      }

      const course = await Course.findOne({ id: req.params.id });
      if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      if (course.tutorId !== actorId) {
        return res.status(403).json({ error: 'You can only manage coupons for your own courses.' });
      }

      const code = normalizeCouponCode(req.body?.code);
      if (!code) {
        return res.status(400).json({ error: 'Coupon code is required.' });
      }

      const discountPercentage = Number(req.body?.discountPercentage);
      if (!Number.isFinite(discountPercentage) || discountPercentage < 1 || discountPercentage > 100) {
        return res.status(400).json({ error: 'Discount percentage must be between 1 and 100.' });
      }

      let expiresAt: Date | undefined;
      if (req.body?.expiresAt) {
        const parsedExpiresAt = new Date(String(req.body.expiresAt));
        if (Number.isNaN(parsedExpiresAt.getTime())) {
          return res.status(400).json({ error: 'Invalid coupon expiry date.' });
        }
        expiresAt = parsedExpiresAt;
      }

      let usageLimit: number | undefined;
      if (req.body?.usageLimit !== undefined && req.body?.usageLimit !== null && String(req.body.usageLimit).trim() !== '') {
        const parsedUsageLimit = Number(req.body.usageLimit);
        if (!Number.isInteger(parsedUsageLimit) || parsedUsageLimit <= 0) {
          return res.status(400).json({ error: 'Usage limit must be a positive whole number.' });
        }
        usageLimit = parsedUsageLimit;
      }

      const coupon = await CourseCoupon.create({
        id: createEntityId(),
        courseId: req.params.id,
        code,
        discountPercentage: roundCurrency(discountPercentage),
        isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
        expiresAt,
        usageLimit,
        usageCount: 0,
      });

      return res.status(201).json(normalizeCouponForResponse(coupon));
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: 'Coupon code must be unique within this course.' });
      }

      console.error('Create course coupon error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/courses/:id/coupons/:couponId', async (req, res) => {
    try {
      const actorId = String(req.body?.actorId || '').trim();
      if (!actorId) {
        return res.status(401).json({ error: 'actorId is required to update a coupon.' });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: 'Only tutor accounts can manage course coupons.' });
      }

      const course = await Course.findOne({ id: req.params.id });
      if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      if (course.tutorId !== actorId) {
        return res.status(403).json({ error: 'You can only manage coupons for your own courses.' });
      }

      const existingCoupon = await CourseCoupon.findOne({ id: req.params.couponId, courseId: req.params.id });
      if (!existingCoupon) {
        return res.status(404).json({ error: 'Coupon not found.' });
      }

      const updatePayload: any = {};
      const unsetPayload: any = {};

      if (Object.prototype.hasOwnProperty.call(req.body, 'code')) {
        const code = normalizeCouponCode(req.body.code);
        if (!code) {
          return res.status(400).json({ error: 'Coupon code is required.' });
        }
        updatePayload.code = code;
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'discountPercentage')) {
        const discountPercentage = Number(req.body.discountPercentage);
        if (!Number.isFinite(discountPercentage) || discountPercentage < 1 || discountPercentage > 100) {
          return res.status(400).json({ error: 'Discount percentage must be between 1 and 100.' });
        }
        updatePayload.discountPercentage = roundCurrency(discountPercentage);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'isActive')) {
        updatePayload.isActive = Boolean(req.body.isActive);
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'expiresAt')) {
        if (req.body.expiresAt === null || String(req.body.expiresAt).trim() === '') {
          unsetPayload.expiresAt = '';
        } else {
          const parsedExpiresAt = new Date(String(req.body.expiresAt));
          if (Number.isNaN(parsedExpiresAt.getTime())) {
            return res.status(400).json({ error: 'Invalid coupon expiry date.' });
          }
          updatePayload.expiresAt = parsedExpiresAt;
        }
      }

      if (Object.prototype.hasOwnProperty.call(req.body, 'usageLimit')) {
        if (req.body.usageLimit === null || String(req.body.usageLimit).trim() === '') {
          unsetPayload.usageLimit = '';
        } else {
          const usageLimit = Number(req.body.usageLimit);
          if (!Number.isInteger(usageLimit) || usageLimit <= 0) {
            return res.status(400).json({ error: 'Usage limit must be a positive whole number.' });
          }
          if (usageLimit < Number(existingCoupon.usageCount || 0)) {
            return res.status(400).json({ error: 'Usage limit cannot be lower than current usage count.' });
          }
          updatePayload.usageLimit = usageLimit;
        }
      }

      const nextUpdate: any = {};
      if (Object.keys(updatePayload).length > 0) {
        nextUpdate.$set = updatePayload;
      }
      if (Object.keys(unsetPayload).length > 0) {
        nextUpdate.$unset = unsetPayload;
      }

      if (!nextUpdate.$set && !nextUpdate.$unset) {
        return res.json(normalizeCouponForResponse(existingCoupon));
      }

      const updatedCoupon = await CourseCoupon.findOneAndUpdate(
        { id: req.params.couponId, courseId: req.params.id },
        nextUpdate,
        { new: true }
      );

      if (!updatedCoupon) {
        return res.status(404).json({ error: 'Coupon not found.' });
      }

      return res.json(normalizeCouponForResponse(updatedCoupon));
    } catch (error: any) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: 'Coupon code must be unique within this course.' });
      }

      console.error('Update course coupon error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/courses/:id/coupons/:couponId/status', async (req, res) => {
    try {
      const actorId = String(req.body?.actorId || '').trim();
      if (!actorId) {
        return res.status(401).json({ error: 'actorId is required to update coupon status.' });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: 'Only tutor accounts can manage course coupons.' });
      }

      const course = await Course.findOne({ id: req.params.id });
      if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      if (course.tutorId !== actorId) {
        return res.status(403).json({ error: 'You can only manage coupons for your own courses.' });
      }

      if (typeof req.body?.isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive boolean value is required.' });
      }

      const updatedCoupon = await CourseCoupon.findOneAndUpdate(
        { id: req.params.couponId, courseId: req.params.id },
        { $set: { isActive: req.body.isActive } },
        { new: true }
      );

      if (!updatedCoupon) {
        return res.status(404).json({ error: 'Coupon not found.' });
      }

      return res.json(normalizeCouponForResponse(updatedCoupon));
    } catch (error) {
      console.error('Toggle course coupon status error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/courses/:id/coupons/:couponId', async (req, res) => {
    try {
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : '';
      if (!actorId) {
        return res.status(401).json({ error: 'actorId is required to delete a coupon.' });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: 'Only tutor accounts can manage course coupons.' });
      }

      const course = await Course.findOne({ id: req.params.id });
      if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      if (course.tutorId !== actorId) {
        return res.status(403).json({ error: 'You can only manage coupons for your own courses.' });
      }

      const deletedCoupon = await CourseCoupon.findOneAndDelete({ id: req.params.couponId, courseId: req.params.id });
      if (!deletedCoupon) {
        return res.status(404).json({ error: 'Coupon not found.' });
      }

      return res.json({ message: 'Coupon deleted successfully.' });
    } catch (error) {
      console.error('Delete course coupon error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/courses/:id/coupons/validate', async (req, res) => {
    try {
      const studentId = String(req.body?.studentId || '').trim();
      const couponCode = normalizeCouponCode(req.body?.couponCode);

      if (!studentId) {
        return res.status(400).json({ error: 'studentId is required to validate a coupon.' });
      }

      if (!couponCode) {
        return res.status(400).json({ error: 'Coupon code is required.' });
      }

      const student = await User.findOne({ id: studentId, role: 'student' });
      if (!student) {
        return res.status(400).json({ error: 'Invalid student account.' });
      }

      const course = await Course.findOne({ id: req.params.id });
      if (!course) {
        return res.status(404).json({ error: 'Course not found.' });
      }

      const originalPrice = toFinitePrice(course.price);
      const isFreeCourse = resolveCourseIsFree((course as any).isFree, originalPrice);
      if (isFreeCourse || originalPrice <= 0) {
        return res.status(400).json({ error: 'Coupons can only be used with paid courses.' });
      }

      const couponResult = await resolveApplicableCouponForStudent({
        courseId: course.id,
        studentId,
        couponCode,
        originalPrice,
      });

      if (!couponResult) {
        return res.status(400).json({ error: 'Coupon code is required.' });
      }

      return res.json({
        valid: true,
        couponCode: couponResult.couponCode,
        discountPercentage: couponResult.discountPercentage,
        originalPrice: couponResult.originalPrice,
        discountAmount: couponResult.discountAmount,
        finalPrice: couponResult.finalPrice,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate coupon.';
      return res.status(400).json({ error: message });
    }
  });

  app.post("/api/courses/:id/enroll", async (req, res) => {
    try {
      const { studentId, paymentConfirmed, paymentReference, couponCode } = req.body;

      if (!studentId) {
        return res.status(400).json({ error: "studentId is required for enrollment" });
      }

      const student = await User.findOne({ id: studentId, role: 'student' });
      if (!student) {
        return res.status(400).json({ error: "Invalid studentId. Student account not found." });
      }

      const existingCourse = await Course.findOne({ id: req.params.id });
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      const normalizedCoursePrice = toFinitePrice(existingCourse.price);
      const isFreeCourse = resolveCourseIsFree((existingCourse as any).isFree, normalizedCoursePrice);

      let couponApplication:
        | {
          coupon: any;
          couponCode: string;
          originalPrice: number;
          discountPercentage: number;
          discountAmount: number;
          finalPrice: number;
        }
        | null = null;

      if (!isFreeCourse && normalizeCouponCode(couponCode)) {
        try {
          couponApplication = await resolveApplicableCouponForStudent({
            courseId: req.params.id,
            studentId,
            couponCode: String(couponCode || ''),
            originalPrice: normalizedCoursePrice,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid coupon for this course.';
          return res.status(400).json({ error: message });
        }
      }

      const priceBreakdown = isFreeCourse
        ? {
          originalPrice: 0,
          discountAmount: 0,
          finalPrice: 0,
        }
        : couponApplication
          ? {
            originalPrice: couponApplication.originalPrice,
            discountAmount: couponApplication.discountAmount,
            finalPrice: couponApplication.finalPrice,
          }
          : {
            originalPrice: roundCurrency(normalizedCoursePrice),
            discountAmount: 0,
            finalPrice: roundCurrency(normalizedCoursePrice),
          };

      const requiresPayment = !isFreeCourse && priceBreakdown.finalPrice > 0;

      if (requiresPayment) {
        if (!paymentConfirmed) {
          return res.status(402).json({ error: "This is a paid course. Payment is required before enrollment." });
        }

        if (!String(paymentReference || '').trim()) {
          return res.status(400).json({ error: "Payment reference is required for paid course enrollment." });
        }
      }

      const course = await Course.findOneAndUpdate(
        { id: req.params.id },
        { $addToSet: { enrolledStudents: studentId } },
        { new: true }
      );

      const existingEnrollment = await CourseEnrollment.findOne({ courseId: req.params.id, studentId });
      const nextPaymentStatus: 'pending' | 'paid' = isFreeCourse ? 'paid' : 'paid';
      const nextOriginalPrice = isFreeCourse ? 0 : priceBreakdown.originalPrice;
      const nextDiscountAmount = isFreeCourse ? 0 : priceBreakdown.discountAmount;
      const nextFinalPaidAmount = isFreeCourse ? 0 : priceBreakdown.finalPrice;
      const nextAmountPaid = nextFinalPaidAmount;
      const nextCouponCode = isFreeCourse ? undefined : couponApplication?.couponCode;
      const nextPaidAt = nextPaymentStatus === 'paid' ? new Date() : undefined;
      const normalizedPaymentReference = String(paymentReference || '').trim();
      let createdNewEnrollment = false;

      if (!existingEnrollment) {
        const createdEnrollment = await CourseEnrollment.create({
          id: createEntityId(),
          courseId: req.params.id,
          studentId,
          completedModuleIds: [],
          progress: 0,
          enrolledAt: new Date(),
          paymentStatus: nextPaymentStatus,
          paymentReference: normalizedPaymentReference || undefined,
          paidAt: nextPaidAt,
          amountPaid: nextAmountPaid,
          originalPrice: nextOriginalPrice,
          couponCode: nextCouponCode,
          discountAmount: nextDiscountAmount,
          finalPaidAmount: nextFinalPaidAmount,
        });
        createdNewEnrollment = true;

        if (couponApplication) {
          try {
            await CourseCouponUsage.create({
              id: createEntityId(),
              userId: studentId,
              courseId: req.params.id,
              couponCode: couponApplication.couponCode,
              enrollmentId: createdEnrollment.id,
              usedAt: new Date(),
            });
          } catch (error: any) {
            if (error?.code === 11000) {
              await CourseEnrollment.deleteOne({ id: createdEnrollment.id });
              await Course.updateOne(
                { id: req.params.id },
                { $pull: { enrolledStudents: studentId } }
              );
              return res.status(400).json({ error: 'You have already used this coupon for this course.' });
            }

            throw error;
          }

          const usageLimit = Number(couponApplication.coupon.usageLimit);
          const couponIncrementQuery: any = {
            id: couponApplication.coupon.id,
            courseId: req.params.id,
          };

          if (Number.isFinite(usageLimit) && usageLimit > 0) {
            couponIncrementQuery.usageCount = { $lt: usageLimit };
          }

          const incrementedCoupon = await CourseCoupon.findOneAndUpdate(
            couponIncrementQuery,
            { $inc: { usageCount: 1 } },
            { new: true }
          );

          if (!incrementedCoupon) {
            await CourseCouponUsage.deleteOne({
              userId: studentId,
              courseId: req.params.id,
              couponCode: couponApplication.couponCode,
            });
            await CourseEnrollment.deleteOne({ id: createdEnrollment.id });
            await Course.updateOne(
              { id: req.params.id },
              { $pull: { enrolledStudents: studentId } }
            );
            return res.status(400).json({ error: 'This coupon usage limit has been reached.' });
          }
        }
      } else {
        const shouldBackfillPaymentMetadata =
          !existingEnrollment.paymentStatus ||
          existingEnrollment.amountPaid === undefined ||
          existingEnrollment.amountPaid === null;

        if (shouldBackfillPaymentMetadata) {
          await CourseEnrollment.updateOne(
            { id: existingEnrollment.id },
            {
              $set: {
                paymentStatus: nextPaymentStatus,
                paymentReference: normalizedPaymentReference || undefined,
                paidAt: nextPaidAt,
                amountPaid: nextAmountPaid,
                originalPrice: nextOriginalPrice,
                couponCode: nextCouponCode,
                discountAmount: nextDiscountAmount,
                finalPaidAmount: nextFinalPaidAmount,
              },
            }
          );
        }
      }

      if (createdNewEnrollment) {
        const courseTitle = toNotificationText(existingCourse.title, 'Course');
        const studentDisplayName = getDisplayNameFromParts(student.firstName, student.lastName, 'Student');

        const enrollmentNotifications: NotificationDraft[] = [
          {
            userId: studentId,
            type: 'course_enrolled',
            title: 'Course enrollment successful',
            message: `You are now enrolled in ${courseTitle}.`,
            targetTab: 'courses',
            link: '/courses',
            relatedEntityId: existingCourse.id,
          },
          {
            userId: existingCourse.tutorId,
            type: 'course_enrolled',
            title: 'New course enrollment',
            message: `${studentDisplayName} enrolled in ${courseTitle}.`,
            targetTab: 'dashboard',
            link: '/dashboard',
            relatedEntityId: existingCourse.id,
          },
        ];

        if (nextFinalPaidAmount > 0) {
          enrollmentNotifications.push({
            userId: studentId,
            type: 'payment_success',
            title: 'Course payment successful',
            message: `Payment for ${courseTitle} was completed successfully.`,
            targetTab: 'courses',
            link: '/courses',
            relatedEntityId: existingCourse.id,
          });
        }

        await createUserNotifications(enrollmentNotifications);
      }

      if (course) {
        res.json(normalizeCourseForResponse(course));
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Enroll in course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/courses/:id/unenroll", async (req, res) => {
    try {
      const { studentId } = req.body;
      if (!studentId) {
        return res.status(400).json({ error: "studentId is required for unenrollment" });
      }

      await Course.findOneAndUpdate(
        { id: req.params.id },
        { $pull: { enrolledStudents: studentId } }
      );

      await CourseEnrollment.findOneAndDelete({
        courseId: req.params.id,
        studentId: studentId
      });

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Unenroll from course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/course-enrollments", async (req, res) => {
    try {
      const studentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
      const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
      const tutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';

      const query: Record<string, string> = {};
      if (studentId) query.studentId = studentId;
      if (courseId) query.courseId = courseId;

      let enrollments = await CourseEnrollment.find(query).sort({ updatedAt: -1 });

      if (tutorId) {
        const tutorCourseIds = await Course.find({ tutorId }).distinct('id');
        const tutorCourseSet = new Set(tutorCourseIds as string[]);
        enrollments = enrollments.filter((enrollment) => tutorCourseSet.has(enrollment.courseId));
      }

      const normalizedEnrollments = enrollments.map((enrollment) => enrollment.toObject());
      const enrollmentCourseIds = Array.from(new Set(normalizedEnrollments.map((enrollment) => enrollment.courseId)));
      const enrollmentStudentIds = Array.from(new Set(normalizedEnrollments.map((enrollment) => enrollment.studentId)));

      const enrollmentCourses = await Course.find({ id: { $in: enrollmentCourseIds } });
      const courseById = new Map(enrollmentCourses.map((course) => [course.id, course]));

      const enrollmentStudents = await User.find(
        { id: { $in: enrollmentStudentIds } },
        { id: 1, firstName: 1, lastName: 1 }
      );
      const studentNameById = new Map(
        enrollmentStudents.map((student) => [student.id, `${String(student.firstName || '').trim()} ${String(student.lastName || '').trim()}`.trim()])
      );

      const paymentStatusWhitelist = new Set(['pending', 'paid', 'failed', 'refunded', 'cancelled']);

      const enrichedEnrollments = normalizedEnrollments.map((enrollment: any) => {
        const course = courseById.get(enrollment.courseId);
        const resolvedPrice = toFinitePrice(course?.price);
        const isFreeCourse = resolveCourseIsFree((course as any)?.isFree, resolvedPrice);
        const fallbackAmountPaid = isFreeCourse ? 0 : resolvedPrice;

        const rawPaymentStatus = String(enrollment.paymentStatus || '').trim().toLowerCase();
        const paymentStatus = paymentStatusWhitelist.has(rawPaymentStatus)
          ? rawPaymentStatus
          : 'paid';

        const normalizedAmountPaid = Number.isFinite(Number(enrollment.amountPaid))
          ? Math.max(0, Number(enrollment.amountPaid))
          : fallbackAmountPaid;

        const normalizedOriginalPrice = Number.isFinite(Number(enrollment.originalPrice))
          ? Math.max(0, Number(enrollment.originalPrice))
          : resolvedPrice;

        const normalizedDiscountAmount = Number.isFinite(Number(enrollment.discountAmount))
          ? Math.max(0, Number(enrollment.discountAmount))
          : Math.max(0, normalizedOriginalPrice - normalizedAmountPaid);

        const normalizedFinalPaidAmount = Number.isFinite(Number(enrollment.finalPaidAmount))
          ? Math.max(0, Number(enrollment.finalPaidAmount))
          : normalizedAmountPaid;

        const normalizedCouponCode = normalizeCouponCode(enrollment.couponCode);

        const studentName = studentNameById.get(enrollment.studentId) || 'Student';

        return {
          ...enrollment,
          paymentStatus,
          amountPaid: normalizedFinalPaidAmount,
          originalPrice: normalizedOriginalPrice,
          couponCode: normalizedCouponCode || undefined,
          discountAmount: normalizedDiscountAmount,
          finalPaidAmount: normalizedFinalPaidAmount,
          paidAt: enrollment.paidAt || (paymentStatus === 'paid' ? enrollment.enrolledAt : undefined),
          studentName,
          courseTitle: course?.title || undefined,
          tutorId: course?.tutorId || undefined,
        };
      });

      res.json(enrichedEnrollments);
    } catch (error) {
      console.error("Get course enrollments error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/course-enrollments/:id/progress", async (req, res) => {
    try {
      const { studentId, completedModuleIds } = req.body;

      if (!studentId) {
        return res.status(400).json({ error: "studentId is required to update progress" });
      }

      const enrollment = await CourseEnrollment.findOne({ id: req.params.id });
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      if (enrollment.studentId !== studentId) {
        return res.status(403).json({ error: "You can only update your own learning progress." });
      }

      const course = await Course.findOne({ id: enrollment.courseId });
      if (!course) {
        return res.status(404).json({ error: "Course not found for this enrollment" });
      }

      const validModuleIds = new Set(course.modules.map((module: any) => module.id));
      const normalizedCompletedModuleIds = Array.isArray(completedModuleIds)
        ? Array.from(
          new Set(
            completedModuleIds
              .map((moduleId: any) => String(moduleId).trim())
              .filter((moduleId: string) => validModuleIds.has(moduleId))
          )
        )
        : [];

      const previousProgress = Number(enrollment.progress || 0);
      const nextProgress = calculateProgress(normalizedCompletedModuleIds.length, course.modules.length);
      const updatePayload: any = {
        $set: {
          completedModuleIds: normalizedCompletedModuleIds,
          progress: nextProgress,
        },
      };

      if (nextProgress >= 100) {
        updatePayload.$set.completedAt = enrollment.completedAt || new Date();
        updatePayload.$set.certificateId = enrollment.certificateId || `CERT-${course.id}-${studentId}-${Date.now().toString(36).toUpperCase()}`;
      } else {
        updatePayload.$unset = {
          completedAt: '',
          certificateId: '',
        };
      }

      const updatedEnrollment = await CourseEnrollment.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
        { new: true }
      );

      const completedNow = previousProgress < 100 && nextProgress >= 100;
      if (completedNow && updatedEnrollment) {
        const courseTitle = toNotificationText(course.title, 'Course');
        const student = await User.findOne({ id: studentId }, { firstName: 1, lastName: 1 });
        const studentDisplayName = getDisplayNameFromParts(student?.firstName, student?.lastName, 'Student');

        await createUserNotifications([
          {
            userId: studentId,
            type: 'course_completed',
            title: 'Course completed',
            message: `Congratulations! You completed ${courseTitle}. Your certificate is now available.`,
            targetTab: 'courses',
            link: '/courses',
            relatedEntityId: updatedEnrollment.id,
          },
          {
            userId: course.tutorId,
            type: 'course_completed',
            title: 'Student completed your course',
            message: `${studentDisplayName} completed ${courseTitle}.`,
            targetTab: 'dashboard',
            link: '/dashboard',
            relatedEntityId: updatedEnrollment.id,
          },
        ]);
      }

      res.json(updatedEnrollment);
    } catch (error) {
      console.error("Update enrollment progress error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get('/api/withdrawals/summary', async (req, res) => {
    try {
      const tutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';
      if (!tutorId) {
        return res.status(400).json({ error: 'tutorId is required.' });
      }

      const tutor = await Tutor.findOne({ id: tutorId });
      if (!tutor) {
        return res.status(404).json({ error: 'Tutor not found.' });
      }

      const summary = await calculateTutorWithdrawalSummary(tutorId);
      return res.json(summary);
    } catch (error) {
      console.error('Get withdrawal summary error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/withdrawals', async (req, res) => {
    try {
      const tutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';
      if (!tutorId) {
        return res.status(400).json({ error: 'tutorId is required.' });
      }

      const tutor = await Tutor.findOne({ id: tutorId });
      if (!tutor) {
        return res.status(404).json({ error: 'Tutor not found.' });
      }

      const requests = await WithdrawalRequest.find({ tutorId }).sort({ requestedAt: -1, createdAt: -1 });
      const normalizedRequests = requests.map((request) => {
        const requestObject: any = request.toObject();
        const effectiveStatus = resolveEffectiveWithdrawalStatus(requestObject);

        return {
          ...requestObject,
          status: effectiveStatus,
          processedAt:
            effectiveStatus === 'approved' && !requestObject.processedAt
              ? requestObject.updatedAt || requestObject.requestedAt
              : requestObject.processedAt,
        };
      });

      return res.json(normalizedRequests);
    } catch (error) {
      console.error('Get withdrawals error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/withdrawals', async (req, res) => {
    try {
      const tutorId = String(req.body?.tutorId || '').trim();
      const payoutMethodDetails = String(req.body?.payoutMethodDetails || '').trim();
      const payoutMethodType = normalizeWithdrawalPayoutMethodType(req.body?.payoutMethodType);
      const amount = toFinitePrice(req.body?.amount);

      if (!tutorId) {
        return res.status(400).json({ error: 'tutorId is required.' });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Withdrawal amount must be greater than zero.' });
      }

      if (!payoutMethodDetails || payoutMethodDetails.length < 4) {
        return res.status(400).json({ error: 'Payout method details are required.' });
      }

      const tutor = await Tutor.findOne({ id: tutorId });
      if (!tutor) {
        return res.status(404).json({ error: 'Tutor not found.' });
      }

      const summary = await calculateTutorWithdrawalSummary(tutorId);
      if (amount > summary.availableBalance) {
        return res.status(400).json({ error: 'Withdrawal amount exceeds available balance.' });
      }

      const shouldAutoApprove = payoutMethodType === 'paypal';

      const request = await WithdrawalRequest.create({
        id: createEntityId(),
        tutorId,
        amount: roundCurrency(amount),
        payoutMethodType,
        payoutMethodDetails,
        status: shouldAutoApprove ? 'approved' : 'pending',
        requestedAt: new Date(),
        processedAt: shouldAutoApprove ? new Date() : undefined,
        note: shouldAutoApprove ? 'Automatically approved for PayPal payouts.' : undefined,
      });

      return res.status(201).json(request);
    } catch (error) {
      console.error('Create withdrawal request error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/course-enrollments/:id/certificate", async (req, res) => {
    try {
      const enrollment = await CourseEnrollment.findOne({ id: req.params.id });
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      const requestStudentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
      if (!requestStudentId) {
        return res.status(400).json({ error: "studentId query parameter is required." });
      }

      if (requestStudentId !== enrollment.studentId) {
        return res.status(403).json({ error: "You can only access your own certificate." });
      }

      if (enrollment.progress < 100 || !enrollment.completedAt) {
        return res.status(400).json({ error: "Certificate is available only after course completion." });
      }

      const [course, student] = await Promise.all([
        Course.findOne({ id: enrollment.courseId }),
        User.findOne({ id: enrollment.studentId }),
      ]);

      if (!course || !student) {
        return res.status(404).json({ error: "Course or student not found for this certificate" });
      }

      const completedDate = formatCertificateDate(enrollment.completedAt);
      const certificateId = enrollment.certificateId || `CERT-${course.id}-${enrollment.studentId}-${Date.now().toString(36).toUpperCase()}`;

      if (!enrollment.certificateId) {
        await CourseEnrollment.updateOne({ id: enrollment.id }, { certificateId });
      }

      const studentName = `${student.firstName} ${student.lastName}`.trim() || 'Student';
      const tutorUser = await User.findOne({ id: course.tutorId });
      const tutorLabel = tutorUser
        ? `${tutorUser.firstName} ${tutorUser.lastName}`.trim() || course.tutorId
        : course.tutorId;

      const pdfBuffer = buildBrandedCertificatePdf({
        studentName,
        courseTitle: course.title,
        subject: course.subject,
        completedDate,
        certificateId,
        tutorLabel,
      });

      const fileNameSafeCourse = sanitizeFileSegment(course.title);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileNameSafeCourse}-certificate.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Download certificate error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Resource APIs
  app.get("/api/resources", async (req, res) => {
    try {
      const tutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';
      const freeOnly = req.query.freeOnly === 'true';

      const query: Record<string, any> = {};
      if (tutorId) query.tutorId = tutorId;
      if (freeOnly) query.isFree = true;

      const resources = await Resource.find(query);
      res.json(resources);
    } catch (error) {
      console.error("Get resources error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/resources", async (req, res) => {
    try {
      const resourceData = req.body;
      const normalizedTitle = typeof resourceData?.title === 'string' ? resourceData.title.trim() : '';
      const normalizedSubject = typeof resourceData?.subject === 'string' ? resourceData.subject.trim() : '';
      const normalizedType = typeof resourceData?.type === 'string' ? resourceData.type.trim() : '';
      const normalizedResourceUrl = typeof resourceData?.url === 'string' ? resourceData.url.trim() : '';
      const normalizedDescription =
        typeof resourceData?.description === 'string' ? resourceData.description.trim() : '';
      const normalizedBlobName = typeof resourceData?.blobName === 'string' ? resourceData.blobName.trim() : '';
      const normalizedMimeType = typeof resourceData?.mimeType === 'string' ? resourceData.mimeType.trim() : '';
      const parsedResourceSize = Number(resourceData?.size);

      if (!resourceData?.tutorId) {
        return res.status(400).json({ error: "tutorId is required to create a resource" });
      }

      if (!normalizedTitle) {
        return res.status(400).json({ error: "Resource title is required." });
      }

      if (!normalizedSubject) {
        return res.status(400).json({ error: "Resource subject is required." });
      }

      if (!['Paper', 'Article', 'Note'].includes(normalizedType)) {
        return res.status(400).json({ error: "Resource type must be Paper, Article, or Note." });
      }

      if (!normalizedResourceUrl || !isLikelyResourceUrl(normalizedResourceUrl)) {
        return res.status(400).json({ error: "Resource URL must be a valid URL." });
      }

      const tutorUser = await User.findOne({ id: resourceData.tutorId, role: 'tutor' });
      if (!tutorUser) {
        return res.status(400).json({ error: "Invalid tutorId. Tutor account not found." });
      }

      const id = createEntityId();
      const resource = new Resource({
        ...resourceData,
        id,
        title: normalizedTitle,
        subject: normalizedSubject,
        type: normalizedType,
        url: normalizedResourceUrl,
        blobName: normalizedBlobName || undefined,
        mimeType: normalizedMimeType || undefined,
        size: Number.isFinite(parsedResourceSize) && parsedResourceSize >= 0 ? parsedResourceSize : undefined,
        description: normalizedDescription,
        isFree: true,
        downloadCount: 0,
      });
      await resource.save();
      res.json(resource);
    } catch (error) {
      console.error("Create resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/resources/:id", async (req, res) => {
    try {
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      if (!actorId) {
        return res.status(401).json({ error: "actorId is required to update a resource." });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: "Only tutor accounts can manage resources." });
      }

      const existingResource = await Resource.findOne({ id: req.params.id });
      if (!existingResource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      if (existingResource.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only manage your own resources." });
      }

      const updatePayload = { ...req.body };
      delete updatePayload.actorId;
      delete updatePayload.downloadCount;

      if (updatePayload.url !== undefined) {
        if (typeof updatePayload.url !== 'string') {
          return res.status(400).json({ error: "Resource URL must be a string." });
        }

        updatePayload.url = updatePayload.url.trim();
        if (!updatePayload.url || !isLikelyResourceUrl(updatePayload.url)) {
          return res.status(400).json({ error: "Resource URL must be a valid URL." });
        }
      }

      if (updatePayload.blobName !== undefined) {
        if (typeof updatePayload.blobName !== 'string') {
          return res.status(400).json({ error: "blobName must be a string when provided." });
        }
        updatePayload.blobName = updatePayload.blobName.trim();
      }

      if (updatePayload.mimeType !== undefined) {
        if (typeof updatePayload.mimeType !== 'string') {
          return res.status(400).json({ error: "mimeType must be a string when provided." });
        }
        updatePayload.mimeType = updatePayload.mimeType.trim();
      }

      if (updatePayload.size !== undefined) {
        const parsedSize = Number(updatePayload.size);
        if (!Number.isFinite(parsedSize) || parsedSize < 0) {
          return res.status(400).json({ error: "size must be a non-negative number when provided." });
        }
        updatePayload.size = parsedSize;
      }

      if (updatePayload.title !== undefined) {
        if (typeof updatePayload.title !== 'string') {
          return res.status(400).json({ error: "Resource title must be a string." });
        }

        updatePayload.title = updatePayload.title.trim();
        if (!updatePayload.title) {
          return res.status(400).json({ error: "Resource title cannot be empty." });
        }
      }

      if (updatePayload.subject !== undefined) {
        if (typeof updatePayload.subject !== 'string') {
          return res.status(400).json({ error: "Resource subject must be a string." });
        }

        updatePayload.subject = updatePayload.subject.trim();
        if (!updatePayload.subject) {
          return res.status(400).json({ error: "Resource subject cannot be empty." });
        }
      }

      if (updatePayload.type !== undefined) {
        if (typeof updatePayload.type !== 'string' || !['Paper', 'Article', 'Note'].includes(updatePayload.type)) {
          return res.status(400).json({ error: "Resource type must be Paper, Article, or Note." });
        }
      }

      if (updatePayload.description !== undefined && typeof updatePayload.description === 'string') {
        updatePayload.description = updatePayload.description.trim();
      }

      if (updatePayload.tutorId && updatePayload.tutorId !== existingResource.tutorId) {
        return res.status(400).json({ error: "Resource owner cannot be changed." });
      }

      const resourceContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );
      const existingBlobName = resolveBlobNameFromMetadataOrUrl(
        (existingResource as any).blobName,
        existingResource.url,
        resourceContainerName
      );
      const nextResourceUrl =
        typeof updatePayload.url === 'string' && updatePayload.url.trim()
          ? updatePayload.url.trim()
          : existingResource.url;
      const nextBlobName = resolveBlobNameFromMetadataOrUrl(
        updatePayload.blobName,
        nextResourceUrl,
        resourceContainerName
      );
      const shouldDeleteExistingBlob = Boolean(existingBlobName && existingBlobName !== nextBlobName);

      const resource = await Resource.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
        { new: true }
      );
      if (resource) {
        if (shouldDeleteExistingBlob && existingBlobName) {
          await deleteBlobNames(
            new Set([existingBlobName]),
            resourceContainerName,
            `resource replacement (${resource.id})`
          );
        }
        res.json(resource);
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Update resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/resources/:id/download", async (req, res) => {
    try {
      const resourceKey = String(req.params.id || '').trim();
      if (!resourceKey) {
        return res.status(400).json({ error: "Resource id is required" });
      }

      const canMatchObjectId = /^[a-fA-F0-9]{24}$/.test(resourceKey);
      const lookup = canMatchObjectId
        ? { $or: [{ id: resourceKey }, { _id: resourceKey }] }
        : { id: resourceKey };

      const resource = await Resource.findOneAndUpdate(
        lookup,
        { $inc: { downloadCount: 1 } },
        { new: true }
      );

      if (resource) {
        // Backfill legacy entries missing a stable id so future lookups are consistent.
        if (!resource.id || !String(resource.id).trim()) {
          resource.id = String(resource._id);
          await resource.save();
        }
        res.json(resource);
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Increment resource download error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    try {
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      if (!actorId) {
        return res.status(401).json({ error: "actorId is required to delete a resource." });
      }

      const actorUser = await User.findOne({ id: actorId, role: 'tutor' });
      if (!actorUser) {
        return res.status(403).json({ error: "Only tutor accounts can delete resources." });
      }

      const existingResource = await Resource.findOne({ id: req.params.id });
      if (!existingResource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      if (existingResource.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only delete your own resources." });
      }

      const resourceContainerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );
      const existingBlobName = resolveBlobNameFromMetadataOrUrl(
        (existingResource as any).blobName,
        existingResource.url,
        resourceContainerName
      );

      const resource = await Resource.findOneAndDelete({ id: req.params.id });
      if (resource) {
        if (existingBlobName) {
          await deleteBlobNames(
            new Set([existingBlobName]),
            resourceContainerName,
            `resource delete (${req.params.id})`
          );
        }
        res.json({ message: "Resource deleted successfully" });
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Delete resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const normalizeBookingStatus = (value: unknown): 'pending' | 'confirmed' | 'completed' | 'cancelled' => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'confirmed') return 'confirmed';
    if (normalized === 'completed') return 'completed';
    if (normalized === 'cancelled') return 'cancelled';
    return 'pending';
  };

  const normalizeBookingPaymentStatus = (value: unknown): 'pending' | 'paid' | 'failed' => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'paid') return 'paid';
    if (normalized === 'failed') return 'failed';
    return 'pending';
  };

  const isValidHttpMeetingLink = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Booking APIs
  app.get("/api/bookings", async (req, res) => {
    try {
      const bookings = await Booking.find();
      res.json(bookings);
    } catch (error) {
      console.error("Get bookings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    try {
      const bookingData = req.body || {};
      const studentId = String(bookingData.studentId || '').trim();
      const studentName = String(bookingData.studentName || '').trim();
      const tutorId = String(bookingData.tutorId || '').trim();
      const slotId = String(bookingData.slotId || '').trim();
      const subject = String(bookingData.subject || '').trim();
      const date = String(bookingData.date || '').trim();
      const timeSlot = String(bookingData.timeSlot || '').trim();
      const paymentStatus = normalizeBookingPaymentStatus(bookingData.paymentStatus);
      const paymentReference = String(bookingData.paymentReference || '').trim();
      const paymentFailureReason = String(bookingData.paymentFailureReason || '').trim();
      const paidAt = String(bookingData.paidAt || '').trim();
      const meetingLink = String(bookingData.meetingLink || '').trim();
      const hiddenForTutor = Boolean(bookingData.hiddenForTutor);
      const hiddenForStudent = Boolean(bookingData.hiddenForStudent);
      let status = normalizeBookingStatus(bookingData.status);

      if (!studentId || !tutorId || !slotId || !subject || !date) {
        return res.status(400).json({ error: 'studentId, tutorId, slotId, subject, and date are required.' });
      }

      if ((status === 'confirmed' || status === 'completed') && paymentStatus !== 'paid') {
        return res.status(400).json({ error: 'Confirmed bookings require a successful payment.' });
      }

      if (paymentStatus === 'paid' && !paymentReference) {
        return res.status(400).json({ error: 'Payment reference is required for paid bookings.' });
      }

      if (paymentStatus !== 'paid' && status === 'completed') {
        status = 'pending';
      }

      if (paymentStatus === 'paid' && status === 'pending') {
        status = 'confirmed';
      }

      if (meetingLink && !isValidHttpMeetingLink(meetingLink)) {
        return res.status(400).json({ error: 'Meeting link must be a valid http/https URL.' });
      }

      if (meetingLink && paymentStatus === 'paid' && status === 'pending') {
        status = 'confirmed';
      }

      const conflictingBooking = await Booking.findOne({
        tutorId,
        slotId,
        date,
        status: { $in: ['pending', 'confirmed'] },
        paymentStatus: { $ne: 'failed' },
      });

      if (conflictingBooking) {
        return res.status(409).json({ error: 'This time slot is already booked.' });
      }

      let resolvedStudentName = studentName;
      if (!resolvedStudentName) {
        const studentUser = await User.findOne({ id: studentId });
        if (studentUser) {
          resolvedStudentName = `${studentUser.firstName || ''} ${studentUser.lastName || ''}`.trim();
        }
      }

      const id = Math.random().toString(36).substr(2, 9);
      const booking = new Booking({
        ...bookingData,
        id,
        studentId,
        studentName: resolvedStudentName || undefined,
        tutorId,
        slotId,
        subject,
        date,
        timeSlot: timeSlot || undefined,
        meetingLink: meetingLink || undefined,
        status,
        paymentStatus,
        paymentReference: paymentStatus === 'paid' ? paymentReference : undefined,
        paymentFailureReason: paymentStatus === 'failed' ? (paymentFailureReason || 'Payment failed before confirmation.') : undefined,
        paidAt: paymentStatus === 'paid' ? (paidAt || new Date().toISOString()) : undefined,
        hiddenForTutor,
        hiddenForStudent,
      });
      await booking.save();

      if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
        try {
          await Tutor.updateOne(
            { id: booking.tutorId, "availability.id": booking.slotId },
            { $set: { "availability.$.isBooked": true } }
          );
        } catch (availabilitySyncError) {
          console.warn('Booking slot sync warning (create):', availabilitySyncError);
        }
      }

      const tutorUser = await User.findOne({ id: tutorId }, { firstName: 1, lastName: 1 });
      const tutorDisplayName = getDisplayNameFromParts(tutorUser?.firstName, tutorUser?.lastName, 'Tutor');
      const studentDisplayName = resolvedStudentName || 'Student';
      const sessionLabel = formatSessionLabel({ subject, date, timeSlot });

      const bookingNotifications: NotificationDraft[] = [];

      if (booking.paymentStatus === 'paid' && booking.status === 'confirmed') {
        bookingNotifications.push(
          {
            userId: booking.studentId,
            type: 'session_confirmed',
            title: 'Session confirmed',
            message: `Your ${sessionLabel} with ${tutorDisplayName} is confirmed.`,
            targetTab: 'studentSessions',
            link: '/studentSessions',
            relatedEntityId: booking.id,
          },
          {
            userId: booking.tutorId,
            type: 'payment_success',
            title: 'New paid session booking',
            message: `${studentDisplayName} booked a paid ${sessionLabel}.`,
            targetTab: 'tutorSessions',
            link: '/tutorSessions',
            relatedEntityId: booking.id,
          }
        );
      } else if (booking.paymentStatus === 'failed') {
        bookingNotifications.push({
          userId: booking.studentId,
          type: 'booking_update',
          title: 'Booking payment failed',
          message: `Payment failed for your ${sessionLabel}. Please retry payment to confirm this booking.`,
          targetTab: 'studentSessions',
          link: '/studentSessions',
          relatedEntityId: booking.id,
        });
      } else {
        bookingNotifications.push(
          {
            userId: booking.studentId,
            type: 'booking_update',
            title: 'Booking request submitted',
            message: `Your ${sessionLabel} request with ${tutorDisplayName} was submitted successfully.`,
            targetTab: 'studentSessions',
            link: '/studentSessions',
            relatedEntityId: booking.id,
          },
          {
            userId: booking.tutorId,
            type: 'booking_update',
            title: 'New booking request',
            message: `${studentDisplayName} requested a ${sessionLabel}.`,
            targetTab: 'tutorSessions',
            link: '/tutorSessions',
            relatedEntityId: booking.id,
          }
        );
      }

      await createUserNotifications(bookingNotifications);

      res.json(booking);
    } catch (error) {
      console.error("Create booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/bookings/:id", async (req, res) => {
    try {
      const existingBooking = await Booking.findOne({ id: req.params.id });
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const incomingStatus = req.body?.status;
      const incomingPaymentStatus = req.body?.paymentStatus;
      let status = incomingStatus !== undefined
        ? normalizeBookingStatus(incomingStatus)
        : normalizeBookingStatus(existingBooking.status);
      const paymentStatus = incomingPaymentStatus !== undefined
        ? normalizeBookingPaymentStatus(incomingPaymentStatus)
        : normalizeBookingPaymentStatus(existingBooking.paymentStatus);

      const nextTutorId = String(req.body?.tutorId ?? existingBooking.tutorId).trim();
      const nextSlotId = String(req.body?.slotId ?? existingBooking.slotId).trim();
      const nextDate = String(req.body?.date ?? existingBooking.date).trim();

      if (!nextTutorId || !nextSlotId || !nextDate) {
        return res.status(400).json({ error: 'tutorId, slotId, and date must be valid values.' });
      }

      const normalizedMeetingLink = req.body?.meetingLink !== undefined
        ? String(req.body.meetingLink || '').trim()
        : undefined;

      if (normalizedMeetingLink !== undefined && normalizedMeetingLink && !isValidHttpMeetingLink(normalizedMeetingLink)) {
        return res.status(400).json({ error: 'Meeting link must be a valid http/https URL.' });
      }

      if (normalizedMeetingLink !== undefined && normalizedMeetingLink && status === 'pending' && paymentStatus === 'paid') {
        status = 'confirmed';
      }

      if ((status === 'confirmed' || status === 'completed') && paymentStatus !== 'paid') {
        return res.status(400).json({ error: 'Only paid bookings can be confirmed or completed.' });
      }

      const paymentReference = req.body?.paymentReference !== undefined
        ? String(req.body.paymentReference || '').trim()
        : String(existingBooking.paymentReference || '').trim();

      if (paymentStatus === 'paid' && !paymentReference) {
        return res.status(400).json({ error: 'Payment reference is required for paid bookings.' });
      }

      const paymentFailureReason = req.body?.paymentFailureReason !== undefined
        ? String(req.body.paymentFailureReason || '').trim()
        : String(existingBooking.paymentFailureReason || '').trim();

      const paidAt = req.body?.paidAt !== undefined
        ? String(req.body.paidAt || '').trim()
        : String(existingBooking.paidAt || '').trim();

      const scheduleRelevantChange =
        req.body?.tutorId !== undefined ||
        req.body?.slotId !== undefined ||
        req.body?.date !== undefined ||
        req.body?.status !== undefined ||
        req.body?.paymentStatus !== undefined;

      if (scheduleRelevantChange && (status === 'pending' || status === 'confirmed') && paymentStatus !== 'failed') {
        const conflictingBooking = await Booking.findOne({
          id: { $ne: req.params.id },
          tutorId: nextTutorId,
          slotId: nextSlotId,
          date: nextDate,
          status: { $in: ['pending', 'confirmed'] },
          paymentStatus: { $ne: 'failed' },
        });

        if (conflictingBooking) {
          return res.status(409).json({ error: 'This time slot is already booked.' });
        }
      }

      const updateSet: Record<string, any> = {
        ...req.body,
        status,
        paymentStatus,
      };
      const updateUnset: Record<string, ''> = {};

      if (req.body?.tutorId !== undefined) {
        updateSet.tutorId = nextTutorId;
      }

      if (req.body?.slotId !== undefined) {
        updateSet.slotId = nextSlotId;
      }

      if (req.body?.date !== undefined) {
        updateSet.date = nextDate;
      }

      if (req.body?.timeSlot !== undefined) {
        const normalizedTimeSlot = String(req.body.timeSlot || '').trim();
        if (normalizedTimeSlot) {
          updateSet.timeSlot = normalizedTimeSlot;
        } else {
          delete updateSet.timeSlot;
          updateUnset.timeSlot = '';
        }
      }

      if (normalizedMeetingLink !== undefined) {
        if (normalizedMeetingLink) {
          updateSet.meetingLink = normalizedMeetingLink;
        } else {
          delete updateSet.meetingLink;
          updateUnset.meetingLink = '';
        }
      }

      if (req.body?.hiddenForTutor !== undefined) {
        updateSet.hiddenForTutor = Boolean(req.body.hiddenForTutor);
      }

      if (req.body?.hiddenForStudent !== undefined) {
        updateSet.hiddenForStudent = Boolean(req.body.hiddenForStudent);
      }

      if (paymentStatus === 'paid') {
        updateSet.paymentReference = paymentReference;
        updateSet.paidAt = paidAt || new Date().toISOString();
        updateUnset.paymentFailureReason = '';
      } else if (paymentStatus === 'failed') {
        updateSet.paymentFailureReason = paymentFailureReason || 'Payment failed before confirmation.';
        updateUnset.paymentReference = '';
        updateUnset.paidAt = '';
      } else {
        updateUnset.paymentReference = '';
        updateUnset.paymentFailureReason = '';
        updateUnset.paidAt = '';
      }

      delete updateSet.id;

      const booking = await Booking.findOneAndUpdate(
        { id: req.params.id },
        Object.keys(updateUnset).length > 0
          ? { $set: updateSet, $unset: updateUnset }
          : { $set: updateSet },
        { new: true }
      );

      if (booking) {
        const wasSlotLocked =
          existingBooking.status === 'confirmed' && normalizeBookingPaymentStatus(existingBooking.paymentStatus) === 'paid';
        const isSlotLocked =
          booking.status === 'confirmed' && normalizeBookingPaymentStatus(booking.paymentStatus) === 'paid';

        try {
          if (
            wasSlotLocked &&
            (!isSlotLocked || existingBooking.slotId !== booking.slotId || existingBooking.tutorId !== booking.tutorId)
          ) {
            await Tutor.updateOne(
              { id: existingBooking.tutorId, "availability.id": existingBooking.slotId },
              { $set: { "availability.$.isBooked": false } }
            );
          }

          if (isSlotLocked) {
            await Tutor.updateOne(
              { id: booking.tutorId, "availability.id": booking.slotId },
              { $set: { "availability.$.isBooked": true } }
            );
          }
        } catch (availabilitySyncError) {
          console.warn('Booking slot sync warning (update):', availabilitySyncError);
        }

        const previousStatus = normalizeBookingStatus(existingBooking.status);
        const nextStatus = normalizeBookingStatus(booking.status);
        const previousPaymentStatus = normalizeBookingPaymentStatus(existingBooking.paymentStatus);
        const nextPaymentStatus = normalizeBookingPaymentStatus(booking.paymentStatus);

        const previousMeetingLink = toNotificationText(existingBooking.meetingLink);
        const nextMeetingLink = toNotificationText(booking.meetingLink);
        const hadMeetingLink = Boolean(previousMeetingLink) && isValidHttpMeetingLink(previousMeetingLink);
        const hasMeetingLink = Boolean(nextMeetingLink) && isValidHttpMeetingLink(nextMeetingLink);
        const meetingLinkAdded = !hadMeetingLink && hasMeetingLink;
        const meetingLinkChanged = hadMeetingLink && hasMeetingLink && previousMeetingLink !== nextMeetingLink;

        const scheduleChanged =
          toNotificationText(existingBooking.date) !== toNotificationText(booking.date) ||
          toNotificationText(existingBooking.timeSlot) !== toNotificationText(booking.timeSlot);

        const [studentUser, tutorUser] = await Promise.all([
          User.findOne({ id: booking.studentId }, { firstName: 1, lastName: 1 }),
          User.findOne({ id: booking.tutorId }, { firstName: 1, lastName: 1 }),
        ]);

        const studentDisplayName =
          toNotificationText(existingBooking.studentName) ||
          getDisplayNameFromParts(studentUser?.firstName, studentUser?.lastName, 'Student');
        const tutorDisplayName = getDisplayNameFromParts(tutorUser?.firstName, tutorUser?.lastName, 'Tutor');
        const previousSessionLabel = formatSessionLabel(existingBooking);
        const nextSessionLabel = formatSessionLabel(booking);

        const notifications: NotificationDraft[] = [];

        if (scheduleChanged && nextStatus !== 'cancelled') {
          notifications.push(
            {
              userId: booking.studentId,
              type: 'session_rescheduled',
              title: 'Session rescheduled',
              message: `Your session was rescheduled to ${nextSessionLabel}.`,
              targetTab: 'studentSessions',
              link: '/studentSessions',
              relatedEntityId: booking.id,
            },
            {
              userId: booking.tutorId,
              type: 'session_rescheduled',
              title: 'Session rescheduled',
              message: `Session with ${studentDisplayName} was moved to ${nextSessionLabel}.`,
              targetTab: 'tutorSessions',
              link: '/tutorSessions',
              relatedEntityId: booking.id,
            }
          );
        }

        if (nextPaymentStatus === 'paid' && previousPaymentStatus !== 'paid') {
          notifications.push(
            {
              userId: booking.studentId,
              type: 'payment_success',
              title: 'Payment successful',
              message: `Payment was received for your ${nextSessionLabel}.`,
              targetTab: 'studentSessions',
              link: '/studentSessions',
              relatedEntityId: booking.id,
            },
            {
              userId: booking.tutorId,
              type: 'payment_success',
              title: 'Session payment received',
              message: `Payment was received for ${studentDisplayName}'s ${nextSessionLabel}.`,
              targetTab: 'tutorSessions',
              link: '/tutorSessions',
              relatedEntityId: booking.id,
            }
          );
        }

        if (nextStatus !== previousStatus) {
          if (nextStatus === 'confirmed') {
            if (!meetingLinkAdded) {
              notifications.push({
                userId: booking.studentId,
                type: 'session_confirmed',
                title: 'Session confirmed',
                message: `Your ${nextSessionLabel} with ${tutorDisplayName} is confirmed.`,
                targetTab: 'studentSessions',
                link: '/studentSessions',
                relatedEntityId: booking.id,
              });
            }

            notifications.push({
              userId: booking.tutorId,
              type: 'session_confirmed',
              title: 'Session confirmed',
              message: `${studentDisplayName}'s ${nextSessionLabel} is confirmed.`,
              targetTab: 'tutorSessions',
              link: '/tutorSessions',
              relatedEntityId: booking.id,
            });
          }

          if (nextStatus === 'cancelled') {
            notifications.push(
              {
                userId: booking.studentId,
                type: 'session_cancelled',
                title: 'Session cancelled',
                message: `Your ${previousSessionLabel} was cancelled.`,
                targetTab: 'studentSessions',
                link: '/studentSessions',
                relatedEntityId: booking.id,
              },
              {
                userId: booking.tutorId,
                type: 'session_cancelled',
                title: 'Session cancelled',
                message: `${studentDisplayName}'s ${previousSessionLabel} was cancelled.`,
                targetTab: 'tutorSessions',
                link: '/tutorSessions',
                relatedEntityId: booking.id,
              }
            );
          }

          if (nextStatus === 'completed') {
            notifications.push({
              userId: booking.studentId,
              type: 'session_completed',
              title: 'Session completed',
              message: `Your ${nextSessionLabel} has been marked as completed.`,
              targetTab: 'studentSessions',
              link: '/studentSessions',
              relatedEntityId: booking.id,
            });
          }
        }

        if (meetingLinkAdded) {
          notifications.push({
            userId: booking.studentId,
            type: 'meeting_link_available',
            title: 'Meeting link available',
            message: `Your tutor shared the meeting link for ${nextSessionLabel}. You can join from My Sessions.`,
            targetTab: 'studentSessions',
            link: '/studentSessions',
            relatedEntityId: booking.id,
          });
        } else if (meetingLinkChanged) {
          notifications.push({
            userId: booking.studentId,
            type: 'meeting_link_updated',
            title: 'Meeting link updated',
            message: `The meeting link for ${nextSessionLabel} was updated. Open My Sessions to use the latest link.`,
            targetTab: 'studentSessions',
            link: '/studentSessions',
            relatedEntityId: booking.id,
          });
        }

        await createUserNotifications(notifications);

        res.json(booking);
      } else {
        res.status(404).json({ error: "Booking not found" });
      }
    } catch (error) {
      console.error("Update booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await Booking.findOneAndDelete({ id: req.params.id });
      if (booking) {
        if (booking.status === 'confirmed' && booking.paymentStatus === 'paid') {
          try {
            await Tutor.updateOne(
              { id: booking.tutorId, "availability.id": booking.slotId },
              { $set: { "availability.$.isBooked": false } }
            );
          } catch (availabilitySyncError) {
            console.warn('Booking slot sync warning (delete):', availabilitySyncError);
          }
        }
        res.json({ message: "Booking deleted successfully" });
      } else {
        res.status(404).json({ error: "Booking not found" });
      }
    } catch (error) {
      console.error("Delete booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Question APIs
  app.get("/api/questions", async (req, res) => {
    try {
      const questions = await Question.find();
      res.json(questions);
    } catch (error) {
      console.error("Get questions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/questions", async (req, res) => {
    try {
      const questionData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const question = new Question({ ...questionData, id, timestamp: Date.now() });
      await question.save();
      res.json(question);
    } catch (error) {
      console.error("Create question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/questions/:id", async (req, res) => {
    try {
      const question = await Question.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (question) {
        res.json(question);
      } else {
        res.status(404).json({ error: "Question not found" });
      }
    } catch (error) {
      console.error("Update question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const question = await Question.findOneAndDelete({ id: req.params.id });
      if (question) {
        res.json({ message: "Question deleted successfully" });
      } else {
        res.status(404).json({ error: "Question not found" });
      }
    } catch (error) {
      console.error("Delete question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Quiz APIs
  app.get("/api/quizzes", async (req, res) => {
    try {
      const quizzes = await Quiz.find();
      res.json(quizzes);
    } catch (error) {
      console.error("Get quizzes error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/quizzes", async (req, res) => {
    try {
      const quizData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const quiz = new Quiz({ ...quizData, id });
      await quiz.save();
      res.json(quiz);
    } catch (error) {
      console.error("Create quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await Quiz.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (quiz) {
        res.json(quiz);
      } else {
        res.status(404).json({ error: "Quiz not found" });
      }
    } catch (error) {
      console.error("Update quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/quizzes/:id", async (req, res) => {
    try {
      const quiz = await Quiz.findOneAndDelete({ id: req.params.id });
      if (quiz) {
        res.json({ message: "Quiz deleted successfully" });
      } else {
        res.status(404).json({ error: "Quiz not found" });
      }
    } catch (error) {
      console.error("Delete quiz error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Study Plan APIs
  app.get("/api/study-plans/:studentId", async (req, res) => {
    try {
      const studyPlan = await StudyPlan.findOne({ studentId: req.params.studentId });
      if (studyPlan) {
        res.json(studyPlan);
      } else {
        res.status(404).json({ error: "Study plan not found" });
      }
    } catch (error) {
      console.error("Get study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/study-plans", async (req, res) => {
    try {
      const studyPlanData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const studyPlan = new StudyPlan({ ...studyPlanData, id });
      await studyPlan.save();
      res.json(studyPlan);
    } catch (error) {
      console.error("Create study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/study-plans/:id", async (req, res) => {
    try {
      const studyPlan = await StudyPlan.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (studyPlan) {
        res.json(studyPlan);
      } else {
        res.status(404).json({ error: "Study plan not found" });
      }
    } catch (error) {
      console.error("Update study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/study-plans/:id", async (req, res) => {
    try {
      const studyPlan = await StudyPlan.findOneAndDelete({ id: req.params.id });
      if (studyPlan) {
        res.json({ message: "Study plan deleted successfully" });
      } else {
        res.status(404).json({ error: "Study plan not found" });
      }
    } catch (error) {
      console.error("Delete study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Skill Level APIs
  app.get("/api/skill-levels/:studentId", async (req, res) => {
    try {
      const skillLevels = await SkillLevel.find({ studentId: req.params.studentId });
      res.json(skillLevels);
    } catch (error) {
      console.error("Get skill levels error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/skill-levels", async (req, res) => {
    try {
      const skillLevelData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const skillLevel = new SkillLevel({ ...skillLevelData, id });
      await skillLevel.save();
      res.json(skillLevel);
    } catch (error) {
      console.error("Create skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/skill-levels/:id", async (req, res) => {
    try {
      const skillLevel = await SkillLevel.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (skillLevel) {
        res.json(skillLevel);
      } else {
        res.status(404).json({ error: "Skill level not found" });
      }
    } catch (error) {
      console.error("Update skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/skill-levels/:id", async (req, res) => {
    try {
      const skillLevel = await SkillLevel.findOneAndDelete({ id: req.params.id });
      if (skillLevel) {
        res.json({ message: "Skill level deleted successfully" });
      } else {
        res.status(404).json({ error: "Skill level not found" });
      }
    } catch (error) {
      console.error("Delete skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (!isProduction) {
    console.log('[Startup] Enabling Vite development middleware...');
    try {
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: {
            port: 24679, // Use a different port for WebSocket to avoid conflicts
          },
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('[Startup] Vite middleware enabled.');
    } catch (error) {
      console.error('Failed to start Vite dev server:', (error as Error).message);
      // Continue without Vite middleware - app will still work but without hot reloading
    }
  } else {
    const distDir = path.join(APP_ROOT, 'dist');
    const indexPath = path.join(distDir, 'index.html');
    console.log(`[Startup] Enabling static asset serving from: ${distDir}`);
    try {
      await fs.access(indexPath);
    } catch {
      throw new Error(`Production frontend build missing at ${indexPath}. Run \"npm run build\" before starting.`);
    }
    app.use(express.static(distDir, { index: false }));

    // Let API routes return their own responses; serve SPA for all other GET routes.
    app.get(/^\/(?!api(?:\/|$)).*/, (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  console.log(`[Startup] Starting HTTP listener on 0.0.0.0:${port}...`);
  app.listen(Number(port), "0.0.0.0", () => {
    console.log(`[Startup] Server listening on 0.0.0.0:${port}`);
  });
}

startServer().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('[Startup] Fatal startup error:', message);
  process.exit(1);
});
