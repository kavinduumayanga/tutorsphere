import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { Readable } from "stream";
import { randomBytes } from "crypto";
import dotenv from "dotenv";
import multer from "multer";
import Busboy from "busboy";
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
  blobExists,
  deleteFile as deleteBlobFile,
  downloadBlobToBuffer,
  extractBlobNameFromUrl,
  getLargeUploadTuning,
  optimizeImageBuffer,
  replaceFile,
  uploadLargeFileStream,
  uploadSmallFile,
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
const AZURE_BLOB_CONTAINER_SESSION_RESOURCES = String(process.env.AZURE_BLOB_CONTAINER_SESSION_RESOURCES || '').trim();
const AZURE_BLOB_CONTAINER_RECORDED_LESSONS = String(process.env.AZURE_BLOB_CONTAINER_RECORDED_LESSONS || '').trim();
const AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES = String(process.env.AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES || '').trim();

const toSafePositiveInteger = (
  value: unknown,
  fallbackValue: number,
  minimumValue: number,
  maximumValue?: number
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimumValue) {
    return fallbackValue;
  }

  const rounded = Math.floor(parsed);
  if (maximumValue !== undefined) {
    return Math.min(rounded, maximumValue);
  }

  return rounded;
};

const AVATAR_IMAGE_MAX_WIDTH = toSafePositiveInteger(process.env.AZURE_IMAGE_AVATAR_MAX_WIDTH, 512, 64, 4096);
const AVATAR_IMAGE_MAX_HEIGHT = toSafePositiveInteger(process.env.AZURE_IMAGE_AVATAR_MAX_HEIGHT, 512, 64, 4096);
const THUMBNAIL_IMAGE_MAX_WIDTH = toSafePositiveInteger(process.env.AZURE_IMAGE_THUMBNAIL_MAX_WIDTH, 1280, 64, 8192);
const THUMBNAIL_IMAGE_MAX_HEIGHT = toSafePositiveInteger(process.env.AZURE_IMAGE_THUMBNAIL_MAX_HEIGHT, 720, 64, 8192);
const OPTIMIZED_IMAGE_QUALITY = toSafePositiveInteger(process.env.AZURE_IMAGE_QUALITY, 82, 40, 95);

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

type UploadResponseFileMeta = {
  originalname: string;
  size: number;
  mimetype: string;
};

const toUploadedAssetResponse = (
  uploaded: { blobUrl: string; blobName: string },
  file: UploadResponseFileMeta,
  containerName?: string
) => ({
  path: uploaded.blobUrl,
  url: uploaded.blobUrl,
  blobUrl: uploaded.blobUrl,
  blobName: uploaded.blobName,
  containerName: String(containerName || '').trim() || undefined,
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

type FileValidationShape = {
  originalname: string;
  mimetype: string;
};

type StreamUploadConfig = {
  fieldName: string;
  maxFileSizeMB: number;
  missingFileMessage: string;
  invalidTypeMessage: string;
  sizeExceededMessage: string;
  genericErrorMessage: string;
  containerName: string;
  containerEnvKey: string;
  isAllowedFile: (file: FileValidationShape) => boolean;
};

const createStreamUploadHandler = (config: StreamUploadConfig) => {
  return async (req: express.Request, res: express.Response) => {
    try {
      const containerName = getRequiredContainerName(config.containerName, config.containerEnvKey);
      const maxFileSizeBytes = config.maxFileSizeMB * 1024 * 1024;
      const { blockSizeBytes, maxConcurrency } = getLargeUploadTuning();

      let hasTargetFile = false;
      let receivedBytes = 0;
      let parseFailure: Error | null = null;
      let asyncUploadFailure: Error | null = null;
      let uploadPromise: Promise<{ blobUrl: string; blobName: string }> | null = null;
      let uploadFileMeta: UploadResponseFileMeta | null = null;

      const uploadResult = await new Promise<{ uploaded: { blobUrl: string; blobName: string }; fileMeta: UploadResponseFileMeta }>((resolve, reject) => {
        const busboy = Busboy({
          headers: req.headers,
          limits: {
            files: 1,
            fileSize: maxFileSizeBytes,
            fields: 32,
          },
        });

        busboy.on('file', (fieldName: string, file: Readable, info: any) => {
          const originalname = String(info?.filename || 'file').trim() || 'file';
          const mimetype = String(info?.mimeType || info?.mimetype || 'application/octet-stream').trim() || 'application/octet-stream';

          if (fieldName !== config.fieldName) {
            file.resume();
            return;
          }

          hasTargetFile = true;
          const validationFile: FileValidationShape = { originalname, mimetype };
          if (!config.isAllowedFile(validationFile)) {
            parseFailure = new Error(config.invalidTypeMessage);
            file.resume();
            return;
          }

          uploadFileMeta = {
            originalname,
            mimetype,
            size: 0,
          };

          file.on('data', (chunk: Buffer) => {
            receivedBytes += chunk.length;
          });

          file.on('limit', () => {
            parseFailure = new Error(config.sizeExceededMessage);
          });

          file.on('error', (error) => {
            asyncUploadFailure = error instanceof Error ? error : new Error(config.genericErrorMessage);
          });

          uploadPromise = uploadLargeFileStream(
            file,
            originalname,
            containerName,
            mimetype,
            { blockSizeBytes, maxConcurrency }
          );

          uploadPromise.catch((error) => {
            asyncUploadFailure = error instanceof Error ? error : new Error(config.genericErrorMessage);
          });
        });

        busboy.on('error', (error) => reject(error));

        busboy.on('finish', () => {
          if (parseFailure && !uploadPromise) {
            return reject(parseFailure);
          }

          if (!hasTargetFile) {
            return reject(new Error(config.missingFileMessage));
          }

          if (!uploadPromise || !uploadFileMeta) {
            return reject(new Error(config.genericErrorMessage));
          }

          uploadFileMeta.size = receivedBytes;

          uploadPromise
            .then(async (uploaded) => {
              if (parseFailure || asyncUploadFailure) {
                try {
                  await deleteBlobFile(uploaded.blobName, containerName);
                } catch (cleanupError) {
                  console.warn('Failed to cleanup partially uploaded blob after stream upload error:', {
                    blobName: uploaded.blobName,
                    containerName,
                    cleanupError,
                  });
                }

                return reject(parseFailure || asyncUploadFailure || new Error(config.genericErrorMessage));
              }

              resolve({
                uploaded,
                fileMeta: uploadFileMeta as UploadResponseFileMeta,
              });
            })
            .catch((error) => reject(error));
        });

        req.pipe(busboy);
      });

      return res.json(toUploadedAssetResponse(uploadResult.uploaded, uploadResult.fileMeta));
    } catch (error) {
      const message = error instanceof Error ? error.message : config.genericErrorMessage;
      const isClientError = [
        config.missingFileMessage,
        config.invalidTypeMessage,
        config.sizeExceededMessage,
      ].includes(message);

      if (isClientError) {
        return res.status(400).json({ error: message });
      }

      console.error(`${config.fieldName} stream upload error:`, error);
      return res.status(500).json({ error: config.genericErrorMessage });
    }
  };
};

const optimizeAvatarImageUpload = async (
  file: Express.Multer.File
): Promise<UploadResponseFileMeta & { buffer: Buffer; optimizedFileName: string }> => {
  const optimized = await optimizeImageBuffer(
    file.buffer,
    file.originalname || 'avatar',
    file.mimetype,
    {
      maxWidth: AVATAR_IMAGE_MAX_WIDTH,
      maxHeight: AVATAR_IMAGE_MAX_HEIGHT,
      quality: OPTIMIZED_IMAGE_QUALITY,
    }
  );

  return {
    originalname: file.originalname,
    mimetype: optimized.mimeType,
    size: optimized.size,
    optimizedFileName: optimized.fileName,
    buffer: optimized.buffer,
  };
};

const optimizeThumbnailImageUpload = async (file: Express.Multer.File): Promise<UploadResponseFileMeta & { buffer: Buffer; optimizedFileName: string }> => {
  const optimized = await optimizeImageBuffer(
    file.buffer,
    file.originalname || 'thumbnail',
    file.mimetype,
    {
      maxWidth: THUMBNAIL_IMAGE_MAX_WIDTH,
      maxHeight: THUMBNAIL_IMAGE_MAX_HEIGHT,
      quality: OPTIMIZED_IMAGE_QUALITY,
    }
  );

  return {
    originalname: file.originalname,
    mimetype: optimized.mimeType,
    size: optimized.size,
    optimizedFileName: optimized.fileName,
    buffer: optimized.buffer,
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
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
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
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
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

const handleCourseResourceUpload = createSingleFileUploadMiddleware({
  fieldName: 'resource',
  maxFileSizeMB: 50,
  invalidTypeMessage: 'Unsupported resource file type. Upload PDF, image, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, ZIP, or RAR files.',
  sizeExceededMessage: 'Module resource file must be less than 50MB.',
  genericErrorMessage: 'Course resource upload failed.',
  isAllowedFile: isResourceUpload,
});

const handleTutorResourceUpload = createSingleFileUploadMiddleware({
  fieldName: 'resource',
  maxFileSizeMB: 50,
  invalidTypeMessage: 'Unsupported resource file type. Upload PDF, image, DOC/DOCX, PPT/PPTX, XLS/XLSX, TXT, CSV, ZIP, or RAR files.',
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

const handleCourseVideoUpload = createStreamUploadHandler({
  fieldName: 'video',
  maxFileSizeMB: 500,
  missingFileMessage: 'No video file was uploaded.',
  invalidTypeMessage: 'Only video files are allowed for module video uploads.',
  sizeExceededMessage: 'Module video must be less than 500MB.',
  genericErrorMessage: 'Failed to upload course video.',
  containerName: AZURE_BLOB_CONTAINER_VIDEOS,
  containerEnvKey: 'AZURE_BLOB_CONTAINER_VIDEOS',
  isAllowedFile: isVideoUpload,
});

const handleRecordedLessonUpload = createStreamUploadHandler({
  fieldName: 'lesson',
  maxFileSizeMB: 1024,
  missingFileMessage: 'No recorded lesson file was uploaded.',
  invalidTypeMessage: 'Only video files are allowed for recorded lessons.',
  sizeExceededMessage: 'Recorded lesson video must be less than 1GB.',
  genericErrorMessage: 'Failed to upload recorded lesson file.',
  containerName: AZURE_BLOB_CONTAINER_RECORDED_LESSONS,
  containerEnvKey: 'AZURE_BLOB_CONTAINER_RECORDED_LESSONS',
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

type BookingReceiptPdfInput = {
  platformName: string;
  bookingId: string;
  studentName: string;
  tutorName: string;
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  durationLabel: string;
  hourlyRateLabel: string;
  totalPaidLabel: string;
  paymentStatusLabel: string;
  transactionReference: string;
  generatedDateLabel: string;
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

const formatLkrCurrency = (value: number): string => {
  const normalized = roundCurrency(Math.max(0, Number.isFinite(value) ? value : 0));

  try {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(normalized);
  } catch {
    return `LKR ${normalized.toFixed(2)}`;
  }
};

const toTitleCase = (value: string): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const buildBookingReceiptPdf = (input: BookingReceiptPdfInput): Buffer => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cardLeft = 34;
  const cardTop = 122;
  const cardWidth = pageWidth - (cardLeft * 2);
  const cardHeight = pageHeight - cardTop - 40;
  const cardRight = cardLeft + cardWidth;

  doc.setFillColor(248, 250, 252);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 104, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text(input.platformName, 40, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text('Booking Payment Receipt', 40, 74);
  doc.text(`Generated: ${input.generatedDateLabel}`, pageWidth - 40, 50, { align: 'right' });
  doc.text(`Receipt ID: ${input.bookingId}`, pageWidth - 40, 74, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(cardLeft, cardTop, cardWidth, cardHeight, 12, 12, 'FD');

  let y = cardTop + 34;
  const valueColumnX = cardLeft + 196;
  const valueColumnWidth = cardRight - valueColumnX - 24;

  const drawSectionHeader = (title: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    doc.text(title.toUpperCase(), cardLeft + 20, y);

    y += 10;
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.8);
    doc.line(cardLeft + 20, y, cardRight - 20, y);
    y += 16;
  };

  const drawField = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), cardLeft + 20, y);

    const safeValue = String(value || 'N/A').trim() || 'N/A';
    const valueLines = doc.splitTextToSize(safeValue, valueColumnWidth);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(valueLines, valueColumnX, y);

    const rowHeight = Math.max(20, valueLines.length * 14);
    y += rowHeight;

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.6);
    doc.line(cardLeft + 20, y + 2, cardRight - 20, y + 2);
    y += 16;
  };

  drawSectionHeader('Session Details');
  drawField('Student Name', input.studentName);
  drawField('Tutor Name', input.tutorName);
  drawField('Session Title', input.sessionTitle);
  drawField('Date', input.sessionDate);
  drawField('Time', input.sessionTime);
  drawField('Duration', input.durationLabel);
  drawField('Hourly Rate', input.hourlyRateLabel);

  drawSectionHeader('Payment Details');
  drawField('Total Paid Amount', input.totalPaidLabel);
  drawField('Payment Status', input.paymentStatusLabel);
  drawField('Transaction Reference ID', input.transactionReference);
  drawField('Generated Date', input.generatedDateLabel);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text('This is a system-generated receipt from TutorSphere.', pageWidth / 2, pageHeight - 16, { align: 'center' });

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

const resolveTutorAvatarResponseUrl = async (
  req: express.Request,
  tutor: { avatar?: string },
  user?: { id: string; avatar?: string }
): Promise<string | undefined> => {
  if (user) {
    const linkedUserAvatar = await buildAvatarResponseUrl(req, user);
    if (linkedUserAvatar) {
      return linkedUserAvatar;
    }
  }

  const tutorAvatar = String(tutor.avatar || '').trim();
  return tutorAvatar || undefined;
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

const escapeRegexPattern = (value: string): string => {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

const normalizeEmailAddress = (value: unknown): string => {
  return String(value || '').trim().toLowerCase();
};

const normalizeNameValue = (value: unknown): string => {
  return String(value || '').replace(/\s+/g, ' ').trim();
};

const splitNameParts = (rawName: string): { firstName: string; lastName: string } => {
  const normalizedName = normalizeNameValue(rawName);
  if (!normalizedName) {
    return { firstName: 'Tutor', lastName: 'Account' };
  }

  const [firstNameRaw, ...lastNameParts] = normalizedName.split(' ');
  const firstName = firstNameRaw || 'Tutor';
  const lastName = lastNameParts.join(' ').trim() || 'Account';

  return { firstName, lastName };
};

const resolveTutorNameParts = (tutor: any): { firstName: string; lastName: string } => {
  const firstName = normalizeNameValue(tutor?.firstName);
  const lastName = normalizeNameValue(tutor?.lastName);

  if (firstName || lastName) {
    return {
      firstName: firstName || 'Tutor',
      lastName: lastName || 'Account',
    };
  }

  const fullName = normalizeNameValue(tutor?.name);
  if (fullName) {
    return splitNameParts(fullName);
  }

  const emailLocalPart = normalizeEmailAddress(tutor?.email).split('@')[0] || '';
  const readableLocalPart = normalizeNameValue(emailLocalPart.replace(/[._-]+/g, ' '));
  if (readableLocalPart) {
    return splitNameParts(readableLocalPart);
  }

  return { firstName: 'Tutor', lastName: 'Account' };
};

const createTemporaryTutorPassword = (): string => {
  return `${randomBytes(12).toString('hex')}Aa1!`;
};

async function syncTutorProfilesToUserAccounts() {
  try {
    const tutors = await Tutor.find();
    if (tutors.length === 0) {
      return;
    }

    let usersCreated = 0;
    let usersUpdated = 0;
    let tutorsNormalized = 0;
    let skipped = 0;
    let idMismatches = 0;
    let conflicts = 0;
    let failed = 0;

    for (const tutor of tutors) {
      try {
        const tutorId = String((tutor as any).id || '').trim();
        const tutorEmail = normalizeEmailAddress((tutor as any).email);

        if (!tutorId || !tutorEmail) {
          skipped += 1;
          continue;
        }

        const { firstName, lastName } = resolveTutorNameParts(tutor);
        const normalizedTutorName = `${firstName} ${lastName}`.trim();
        const tutorAvatar = String((tutor as any).avatar || '').trim();

        const userByTutorId = await User.findOne({ id: tutorId });
        const userByEmail = await User.findOne({
          email: { $regex: new RegExp(`^${escapeRegexPattern(tutorEmail)}$`, 'i') },
        });

        let resolvedUser: any = userByTutorId || userByEmail || null;

        if (!resolvedUser) {
          const passwordHash = await hashPassword(createTemporaryTutorPassword());
          await User.create({
            id: tutorId,
            firstName,
            lastName,
            email: tutorEmail,
            password: passwordHash,
            role: 'tutor',
            ...(tutorAvatar ? { avatar: tutorAvatar } : {}),
          });
          usersCreated += 1;
        } else {
          if (
            userByTutorId
            && userByEmail
            && String((userByTutorId as any)._id) !== String((userByEmail as any)._id)
          ) {
            conflicts += 1;
            resolvedUser = userByTutorId;
            console.warn(
              `[Startup] Tutor account sync found duplicate users for tutor ${tutorId} (${tutorEmail}); keeping user id ${String((userByTutorId as any).id || tutorId)}.`
            );
          } else if (
            !userByTutorId
            && userByEmail
            && String((userByEmail as any).id || '').trim() !== tutorId
          ) {
            idMismatches += 1;
            console.warn(
              `[Startup] Tutor account sync found existing user id ${String((userByEmail as any).id)} for tutor id ${tutorId} via email ${tutorEmail}.`
            );
          }

          let userNeedsUpdate = false;

          if (resolvedUser.role !== 'tutor') {
            resolvedUser.role = 'tutor';
            userNeedsUpdate = true;
          }

          const existingUserEmail = normalizeEmailAddress(resolvedUser.email);
          if (!existingUserEmail) {
            resolvedUser.email = tutorEmail;
            userNeedsUpdate = true;
          } else if (existingUserEmail !== tutorEmail && !userByEmail) {
            resolvedUser.email = tutorEmail;
            userNeedsUpdate = true;
          }

          if (!normalizeNameValue(resolvedUser.firstName)) {
            resolvedUser.firstName = firstName;
            userNeedsUpdate = true;
          }

          if (!normalizeNameValue(resolvedUser.lastName)) {
            resolvedUser.lastName = lastName;
            userNeedsUpdate = true;
          }

          if (!String(resolvedUser.avatar || '').trim() && tutorAvatar) {
            resolvedUser.avatar = tutorAvatar;
            userNeedsUpdate = true;
          }

          if (userNeedsUpdate) {
            await resolvedUser.save();
            usersUpdated += 1;
          }
        }

        let tutorNeedsUpdate = false;
        if (String((tutor as any).role || '').trim() !== 'tutor') {
          (tutor as any).role = 'tutor';
          tutorNeedsUpdate = true;
        }

        if (normalizeEmailAddress((tutor as any).email) !== tutorEmail) {
          (tutor as any).email = tutorEmail;
          tutorNeedsUpdate = true;
        }

        if (!normalizeNameValue((tutor as any).name)) {
          (tutor as any).name = normalizedTutorName;
          tutorNeedsUpdate = true;
        }

        if (tutorNeedsUpdate) {
          await tutor.save();
          tutorsNormalized += 1;
        }
      } catch (tutorError) {
        failed += 1;
        console.warn('[Startup] Tutor account sync skipped one tutor due to an error:', tutorError);
      }
    }

    if (usersCreated || usersUpdated || tutorsNormalized || skipped || idMismatches || conflicts || failed) {
      console.log(
        `[Startup] Tutor account sync summary: scanned=${tutors.length}, usersCreated=${usersCreated}, usersUpdated=${usersUpdated}, tutorsNormalized=${tutorsNormalized}, skipped=${skipped}, idMismatches=${idMismatches}, conflicts=${conflicts}, failed=${failed}`
      );
    }
  } catch (error) {
    console.log('Tutor account sync skipped or failed:', (error as Error).message);
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

const isValidEmailAddress = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const ALLOWED_CORS_ORIGINS = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const DEV_ALLOWED_ORIGIN_PATTERN = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?$/i;

type SessionAuthContext = {
  userId: string;
  role: string;
};

const getSessionAuthContext = (req: express.Request): SessionAuthContext => {
  const userId = String((req.session as any)?.userId || '').trim();
  const role = String((req.session as any)?.role || '').trim().toLowerCase();
  return { userId, role };
};

const requireAuthenticatedSession = (
  req: express.Request,
  res: express.Response
): SessionAuthContext | null => {
  const context = getSessionAuthContext(req);
  if (!context.userId) {
    res.status(401).json({ error: 'Authentication required. Please sign in again.' });
    return null;
  }

  return context;
};

const requireRoleForSession = (
  context: SessionAuthContext,
  res: express.Response,
  allowedRoles: string[],
  deniedMessage: string
): boolean => {
  if (!allowedRoles.includes(context.role)) {
    res.status(403).json({ error: deniedMessage });
    return false;
  }

  return true;
};

const requireSessionUserMatch = (
  context: SessionAuthContext,
  res: express.Response,
  expectedUserId: string,
  deniedMessage: string
): boolean => {
  if (!expectedUserId || context.userId !== expectedUserId) {
    res.status(403).json({ error: deniedMessage });
    return false;
  }

  return true;
};

const requireAnySession: express.RequestHandler = (req, res, next) => {
  const context = requireAuthenticatedSession(req, res);
  if (!context) {
    return;
  }
  next();
};

const requireTutorSession: express.RequestHandler = (req, res, next) => {
  const context = requireAuthenticatedSession(req, res);
  if (!context) {
    return;
  }

  if (!requireRoleForSession(context, res, ['tutor'], 'Only tutor accounts can perform this action.')) {
    return;
  }

  next();
};

const requireStudentSession: express.RequestHandler = (req, res, next) => {
  const context = requireAuthenticatedSession(req, res);
  if (!context) {
    return;
  }

  if (!requireRoleForSession(context, res, ['student'], 'Only student accounts can perform this action.')) {
    return;
  }

  next();
};

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

  // Ensure every tutor profile has a real login account in Users.
  await syncTutorProfilesToUserAccounts();

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

  if (isProduction && ALLOWED_CORS_ORIGINS.length === 0) {
    throw new Error('ALLOWED_ORIGINS must be configured in production for secure CORS handling.');
  }

  const allowedCorsOrigins = new Set(ALLOWED_CORS_ORIGINS);

  // Honor reverse-proxy headers (App Service / load balancers) for protocol and host awareness.
  app.set('trust proxy', 1);

  app.use(express.json());
  app.use(
    cors({
      credentials: true,
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (allowedCorsOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        if (!isProduction && DEV_ALLOWED_ORIGIN_PATTERN.test(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
    })
  );
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof Error && error.message === 'Not allowed by CORS') {
      return res.status(403).json({ error: 'CORS origin blocked.' });
    }

    return next(error);
  });

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

  app.post('/api/uploads/course-thumbnail', requireTutorSession, handleCourseThumbnailUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No thumbnail file was uploaded.' });
      }

      const optimizedThumbnail = await optimizeThumbnailImageUpload(req.file);

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS,
        'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS'
      );
      const uploaded = await uploadSmallFile(
        optimizedThumbnail.buffer,
        optimizedThumbnail.optimizedFileName,
        containerName,
        optimizedThumbnail.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, optimizedThumbnail, containerName));
    } catch (error) {
      console.error('Course thumbnail upload error:', error);
      res.status(500).json({ error: 'Failed to upload course thumbnail.' });
    }
  });

  app.post('/api/uploads/course-video', requireTutorSession, handleCourseVideoUpload);

  app.post('/api/uploads/course-resource', requireTutorSession, handleCourseResourceUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No resource file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );
      const uploaded = await uploadSmallFile(
        req.file.buffer,
        req.file.originalname || 'resource',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file, containerName));
    } catch (error) {
      console.error('Course resource upload error:', error);
      res.status(500).json({ error: 'Failed to upload course resource file.' });
    }
  });

  app.post('/api/uploads/tutor-resource', requireTutorSession, handleTutorResourceUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No resource file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_RESOURCES,
        'AZURE_BLOB_CONTAINER_RESOURCES'
      );
      const uploaded = await uploadSmallFile(
        req.file.buffer,
        req.file.originalname || 'resource',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file, containerName));
    } catch (error) {
      console.error('Tutor resource upload error:', error);
      res.status(500).json({ error: 'Failed to upload tutor resource file.' });
    }
  });

  app.post('/api/uploads/session-resource', requireTutorSession, handleTutorResourceUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No resource file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_SESSION_RESOURCES,
        'AZURE_BLOB_CONTAINER_SESSION_RESOURCES'
      );
      console.info('Session resource upload started', {
        containerName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });

      const uploaded = await uploadSmallFile(
        req.file.buffer,
        req.file.originalname || 'session-resource',
        containerName,
        req.file.mimetype
      );

      const uploadedBlobExists = await blobExists(uploaded.blobName, containerName);
      if (!uploadedBlobExists) {
        console.error('Session resource upload verification failed', {
          containerName,
          blobName: uploaded.blobName,
          blobUrl: uploaded.blobUrl,
        });
        return res.status(500).json({ error: 'Uploaded session resource could not be verified in Azure Blob Storage.' });
      }

      console.info('Session resource upload success', {
        containerName,
        blobName: uploaded.blobName,
        blobUrl: uploaded.blobUrl,
      });

      res.json(toUploadedAssetResponse(uploaded, req.file, containerName));
    } catch (error) {
      console.error('Session resource upload error:', error);
      res.status(500).json({ error: 'Failed to upload booking session resource file.' });
    }
  });

  app.post('/api/uploads/tutor-certificate', requireTutorSession, handleTutorCertificateUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No certificate file was uploaded.' });
      }

      const containerName = getRequiredContainerName(
        AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES,
        'AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES'
      );
      const uploaded = await uploadSmallFile(
        req.file.buffer,
        req.file.originalname || 'certificate',
        containerName,
        req.file.mimetype
      );

      res.json(toUploadedAssetResponse(uploaded, req.file, containerName));
    } catch (error) {
      console.error('Tutor certificate upload error:', error);
      res.status(500).json({ error: 'Failed to upload tutor certificate file.' });
    }
  });

  app.post('/api/uploads/recorded-lesson', requireTutorSession, handleRecordedLessonUpload);

  // Auth APIs
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { firstName, lastName, email, password, role, tutorProfile, autoLogin } = req.body || {};
      const normalizedFirstName = String(firstName || '').trim();
      const normalizedLastName = String(lastName || '').trim();
      const normalizedEmail = normalizeEmailAddress(email);
      const normalizedPassword = String(password || '');
      const normalizedRole = role === 'tutor' ? 'tutor' : 'student';
      const escapedEmail = escapeRegexPattern(normalizedEmail);
      const parsedTutorProfile =
        typeof tutorProfile === 'object' && tutorProfile !== null
          ? (tutorProfile as Record<string, unknown>)
          : {};
      const resolvedTutorProfile: Record<string, unknown> = {
        qualifications: parsedTutorProfile.qualifications ?? req.body?.qualifications ?? req.body?.education,
        education: parsedTutorProfile.education ?? req.body?.education,
        subjects: parsedTutorProfile.subjects ?? req.body?.subjects,
        teachingLevel: parsedTutorProfile.teachingLevel ?? req.body?.teachingLevel,
        pricePerHour: parsedTutorProfile.pricePerHour ?? req.body?.pricePerHour ?? req.body?.hourlyRate,
        hourlyRate: parsedTutorProfile.hourlyRate ?? req.body?.hourlyRate,
        bio: parsedTutorProfile.bio ?? req.body?.bio,
      };

      if (!normalizedFirstName || !normalizedLastName || !normalizedEmail || !normalizedPassword) {
        return res.status(400).json({ error: "First name, last name, email, and password are required" });
      }

      if (!isValidEmailAddress(normalizedEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      if (normalizedFirstName.length > 80 || normalizedLastName.length > 80) {
        return res.status(400).json({ error: 'First name and last name must be 80 characters or fewer.' });
      }

      const strengthError = validatePasswordStrength(normalizedPassword);
      if (strengthError) {
        return res.status(400).json({ error: strengthError });
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
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        password: hashedPassword,
        role: normalizedRole,
      });

      await newUser.save();

      if (normalizedRole === 'tutor') {
        try {
          const rawTutorSubjects = resolvedTutorProfile.subjects;
          const { isValid, normalizedSubjects } = validateAndNormalizeTutorSubjects(rawTutorSubjects);
          const hasProvidedSubjects = Array.isArray(rawTutorSubjects) && rawTutorSubjects.length > 0;

          if (hasProvidedSubjects && !isValid) {
            await User.deleteOne({ id });
            return res.status(400).json({ error: INVALID_TUTOR_SUBJECTS_ERROR });
          }

          const normalizedTutorSubjects = isValid ? normalizedSubjects : [ALLOWED_TUTOR_SUBJECTS[0]];
          const rawTutorQualifications = String(
            resolvedTutorProfile.qualifications ?? resolvedTutorProfile.education ?? ''
          ).trim();
          const normalizedTutorQualifications = rawTutorQualifications || 'Not specified';
          const normalizedTutorBio = String(resolvedTutorProfile.bio ?? '').trim();
          const normalizedTutorPrice = toFinitePrice(
            resolvedTutorProfile.pricePerHour ?? resolvedTutorProfile.hourlyRate
          );

          await Tutor.findOneAndUpdate(
            { id },
            {
              $set: {
                id,
                name: `${normalizedFirstName} ${normalizedLastName}`.trim() || 'Tutor',
                email: normalizedEmail,
                role: 'tutor',
                qualifications: normalizedTutorQualifications,
                subjects: normalizedTutorSubjects,
                teachingLevel: normalizeTeachingLevel(resolvedTutorProfile.teachingLevel),
                pricePerHour: normalizedTutorPrice,
                bio: normalizedTutorBio,
              },
              $setOnInsert: {
                rating: 0,
                reviewCount: 0,
                availability: [],
                isVerified: false,
              },
            },
            { upsert: true, new: true }
          );
        } catch (tutorSignupError) {
          await User.deleteOne({ id });
          throw tutorSignupError;
        }
      }

      if (Boolean(autoLogin) && req.session) {
        (req.session as any).userId = newUser.id;
        (req.session as any).role = newUser.role;
        req.session.cookie.maxAge = undefined;
      }

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

      const normalizedEmail = normalizeEmailAddress(email);
      const escapedEmail = escapeRegexPattern(normalizedEmail);

      if (!isValidEmailAddress(normalizedEmail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

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
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      const normalizedUserId = String(userId || '').trim();
      const currentPasswordValue = String(currentPassword || '');
      const newPasswordValue = String(newPassword || '');
      const confirmPasswordValue = String(confirmPassword || '');

      if (!normalizedUserId || !currentPasswordValue || !newPasswordValue || !confirmPasswordValue) {
        return res.status(400).json({ error: 'User ID, current password, new password, and confirm password are required.' });
      }

      if (!requireSessionUserMatch(sessionContext, res, normalizedUserId, 'You can only change your own password.')) {
        return;
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

  app.post('/api/auth/logout', (req, res) => {
    const clearSessionCookie = () => {
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: isProduction,
        sameSite: sameSiteMode,
      });
    };

    if (!req.session) {
      clearSessionCookie();
      return res.json({ message: 'Signed out successfully.' });
    }

    req.session.destroy((error) => {
      if (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ error: 'Failed to sign out. Please try again.' });
      }

      clearSessionCookie();
      return res.json({ message: 'Signed out successfully.' });
    });
  });

  app.put("/api/auth/user/:id", handleAvatarUpload, async (req, res) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, phone } = req.body;
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      if (!requireSessionUserMatch(sessionContext, res, id, 'You can only update your own profile.')) {
        return;
      }

      const user = await User.findOne({ id });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (firstName !== undefined) {
        const normalizedFirstName = String(firstName || '').trim();
        if (!normalizedFirstName) {
          return res.status(400).json({ error: 'First name cannot be empty.' });
        }
        if (normalizedFirstName.length > 80) {
          return res.status(400).json({ error: 'First name must be 80 characters or fewer.' });
        }
        user.firstName = normalizedFirstName;
      }

      if (lastName !== undefined) {
        const normalizedLastName = String(lastName || '').trim();
        if (!normalizedLastName) {
          return res.status(400).json({ error: 'Last name cannot be empty.' });
        }
        if (normalizedLastName.length > 80) {
          return res.status(400).json({ error: 'Last name must be 80 characters or fewer.' });
        }
        user.lastName = normalizedLastName;
      }

      if (phone !== undefined) {
        user.phone = String(phone || '').trim();
      }

      if (req.file) {
        const optimizedAvatar = await optimizeAvatarImageUpload(req.file);
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
          optimizedAvatar.buffer,
          optimizedAvatar.optimizedFileName,
          containerName,
          optimizedAvatar.mimetype
        );

        user.avatar = uploadedAvatar.blobUrl;
        (user as any).avatarBlobName = uploadedAvatar.blobName;
        (user as any).avatarMimeType = optimizedAvatar.mimetype;
        (user as any).avatarSize = optimizedAvatar.size;

        if (user.role === 'tutor') {
          await Tutor.findOneAndUpdate(
            { id: user.id },
            { $set: { avatar: uploadedAvatar.blobUrl } },
            { new: false }
          );
        }
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
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  });

  app.delete("/api/auth/user/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      if (!requireSessionUserMatch(sessionContext, res, id, 'You can only delete your own account.')) {
        return;
      }

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

      req.session?.destroy((destroyError) => {
        if (destroyError) {
          console.warn('Failed to destroy session after account deletion:', destroyError);
        }
      });
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: isProduction,
        sameSite: sameSiteMode,
      });

      res.json({ message: "Account deleted successfully" });
    } catch (error) {
      console.error("Delete user account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/auth/user/:id/avatar", async (req, res) => {
    try {
      const { id } = req.params;
      const user = await User.findOne({ id });
      if (!user || !user.avatar) {
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
      res.set('Content-Type', 'image/jpeg');
      res.send(user.avatar);
    } catch (error) {
      console.error("Get avatar error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get('/api/notifications', async (req, res) => {
    try {
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId.trim() : '';
      if (requestedUserId && requestedUserId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only access your own notifications.' });
      }

      const userId = sessionContext.userId;

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
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      const requestedUserId = toNotificationText(req.body?.userId);
      if (requestedUserId && requestedUserId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only create notifications for your own account.' });
      }

      const userId = requestedUserId || sessionContext.userId;
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
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      const requestedUserId = toNotificationText(req.body?.userId);
      if (requestedUserId && requestedUserId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only update your own notifications.' });
      }

      const userId = sessionContext.userId;

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
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      const requestedUserId = toNotificationText(req.body?.userId || req.query.userId);
      if (requestedUserId && requestedUserId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only update your own notifications.' });
      }

      const userId = sessionContext.userId;
      const notificationId = toNotificationText(req.params.id);

      if (!notificationId) {
        return res.status(400).json({ error: 'Notification id is required.' });
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
      const tutorProfileDocs = await Tutor.find();
      const tutorProfiles = tutorProfileDocs.map((doc) =>
        typeof (doc as any).toObject === 'function' ? (doc as any).toObject() : doc
      );
      const tutorProfileIds = tutorProfiles
        .map((profile) => String((profile as any)?.id || '').trim())
        .filter(Boolean);

      const tutorUsersWithoutProfiles = await User.find(
        tutorProfileIds.length > 0
          ? { role: 'tutor', id: { $nin: tutorProfileIds } }
          : { role: 'tutor' },
        { id: 1, firstName: 1, lastName: 1, email: 1, avatar: 1 }
      );

      const fallbackTutors = tutorUsersWithoutProfiles.map((userDoc: any) => {
        const fullName = `${String(userDoc?.firstName || '').trim()} ${String(userDoc?.lastName || '').trim()}`.trim();
        return {
          id: String(userDoc?.id || '').trim(),
          name: fullName || 'Tutor',
          email: normalizeEmailAddress(userDoc?.email),
          role: 'tutor',
          qualifications: 'Not specified',
          subjects: [],
          teachingLevel: 'School',
          pricePerHour: 0,
          rating: 0,
          reviewCount: 0,
          bio: '',
          availability: [],
          isVerified: false,
          avatar: String(userDoc?.avatar || '').trim() || undefined,
        };
      });

      const tutors = [...tutorProfiles, ...fallbackTutors];

      if (tutors.length === 0) {
        return res.json([]);
      }

      const tutorIds = tutors
        .map((tutor) => String((tutor as any).id || '').trim())
        .filter(Boolean);

      const linkedUsers = tutorIds.length > 0
        ? await User.find({ id: { $in: tutorIds } }, { id: 1, avatar: 1 })
        : [];

      const userById = new Map<string, { id: string; avatar?: string }>(
        linkedUsers.map((userDoc: any) => [
          String(userDoc?.id || '').trim(),
          {
            id: String(userDoc?.id || '').trim(),
            avatar: String(userDoc?.avatar || '').trim() || undefined,
          },
        ])
      );

      const tutorResponses = await Promise.all(
        tutors.map(async (tutorSource) => {
          const tutor =
            typeof (tutorSource as any).toObject === 'function'
              ? (tutorSource as any).toObject()
              : { ...(tutorSource as any) };

          const tutorId = String((tutor as any)?.id || '').trim();
          const linkedUser = tutorId ? userById.get(tutorId) : undefined;
          const resolvedAvatar = await resolveTutorAvatarResponseUrl(req, tutor as any, linkedUser);

          if (resolvedAvatar) {
            (tutor as any).avatar = resolvedAvatar;
          } else {
            delete (tutor as any).avatar;
          }

          return tutor;
        })
      );

      return res.json(tutorResponses);
    } catch (error) {
      console.error("Get tutors error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/tutors/:id", async (req, res) => {
    try {
      const tutor = await Tutor.findOne({ id: req.params.id });

      if (tutor) {
        const linkedUser = await User.findOne({ id: req.params.id }, { id: 1, avatar: 1, role: 1 });
        const tutorResponse =
          typeof (tutor as any).toObject === 'function'
            ? (tutor as any).toObject()
            : tutor;

        const resolvedAvatar = await resolveTutorAvatarResponseUrl(
          req,
          tutorResponse as any,
          linkedUser
            ? {
                id: String((linkedUser as any).id || '').trim(),
                avatar: String((linkedUser as any).avatar || '').trim() || undefined,
              }
            : undefined
        );

        if (resolvedAvatar) {
          (tutorResponse as any).avatar = resolvedAvatar;
        } else {
          delete (tutorResponse as any).avatar;
        }

        res.json(tutorResponse);
      } else {
        const tutorUser = await User.findOne(
          { id: req.params.id, role: 'tutor' },
          { id: 1, firstName: 1, lastName: 1, email: 1, avatar: 1 }
        );

        if (!tutorUser) {
          return res.status(404).json({ error: "Tutor not found" });
        }

        const fullName = `${String((tutorUser as any)?.firstName || '').trim()} ${String((tutorUser as any)?.lastName || '').trim()}`.trim();
        const fallbackTutor: Record<string, unknown> = {
          id: String((tutorUser as any)?.id || '').trim(),
          name: fullName || 'Tutor',
          email: normalizeEmailAddress((tutorUser as any)?.email),
          role: 'tutor',
          qualifications: 'Not specified',
          subjects: [],
          teachingLevel: 'School',
          pricePerHour: 0,
          rating: 0,
          reviewCount: 0,
          bio: '',
          availability: [],
          isVerified: false,
        };

        const resolvedAvatar = await resolveTutorAvatarResponseUrl(
          req,
          fallbackTutor as any,
          {
            id: String((tutorUser as any)?.id || '').trim(),
            avatar: String((tutorUser as any)?.avatar || '').trim() || undefined,
          }
        );

        if (resolvedAvatar) {
          fallbackTutor.avatar = resolvedAvatar;
        }

        return res.json(fallbackTutor);
      }
    } catch (error) {
      console.error("Get tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/tutors", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const tutorData = (req.body || {}) as Record<string, unknown>;
      const tutorId = sessionContext.userId;

      if (toNotificationText(tutorData.id) && toNotificationText(tutorData.id) !== tutorId) {
        return res.status(403).json({ error: 'You can only create your own tutor profile.' });
      }

      const tutorAccount = await User.findOne({ id: tutorId, role: 'tutor' });
      if (!tutorAccount) {
        return res.status(403).json({ error: 'Only tutor accounts can create tutor profiles.' });
      }

      const existingTutor = await Tutor.findOne({ id: tutorId });
      if (existingTutor) {
        return res.status(409).json({ error: 'Tutor profile already exists. Use update instead.' });
      }

      const { isValid, normalizedSubjects } = validateAndNormalizeTutorSubjects(tutorData.subjects);

      if (!isValid) {
        return res.status(400).json({ error: INVALID_TUTOR_SUBJECTS_ERROR });
      }

      const tutorDisplayName = normalizeNameValue(
        String(tutorData.name || `${String((tutorAccount as any)?.firstName || '').trim()} ${String((tutorAccount as any)?.lastName || '').trim()}`)
      );
      const parsedTutorRating = Number(tutorData.rating);
      const parsedTutorReviewCount = Number(tutorData.reviewCount);
      const normalizedTutorQualifications = String(
        tutorData.qualifications ?? tutorData.education ?? ''
      ).trim();
      const normalizedTutorBio = String(tutorData.bio ?? '').trim();

      const tutor = new Tutor({
        id: tutorId,
        name: tutorDisplayName || 'Tutor',
        email: normalizeEmailAddress(tutorData.email) || normalizeEmailAddress(tutorAccount.email),
        role: 'tutor',
        qualifications: normalizedTutorQualifications || 'Not specified',
        subjects: normalizedSubjects,
        teachingLevel: normalizeTeachingLevel(tutorData.teachingLevel),
        pricePerHour: toFinitePrice(tutorData.pricePerHour ?? tutorData.hourlyRate),
        rating: Number.isFinite(parsedTutorRating) ? Math.max(0, Math.min(5, parsedTutorRating)) : 0,
        reviewCount: Number.isFinite(parsedTutorReviewCount) ? Math.max(0, Math.round(parsedTutorReviewCount)) : 0,
        bio: normalizedTutorBio,
        availability: Array.isArray(tutorData.availability) ? tutorData.availability : [],
        isVerified: Boolean(tutorData.isVerified),
      });
      await tutor.save();
      res.json(tutor);
    } catch (error) {
      console.error("Create tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/tutors/:id", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      if (req.params.id !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only update your own tutor profile.' });
      }

      const tutorAccount = await User.findOne({ id: sessionContext.userId, role: 'tutor' });
      if (!tutorAccount) {
        return res.status(403).json({ error: 'Only tutor accounts can update tutor profiles.' });
      }

      let tutor = await Tutor.findOne({ id: req.params.id });
      const incomingTutorData: Record<string, unknown> = {
        ...((req.body || {}) as Record<string, unknown>),
      };
      const requestedTeachingLevel = incomingTutorData.teachingLevel;
      delete incomingTutorData.teachingLevel;

      if (toNotificationText((incomingTutorData as any)?.id) && toNotificationText((incomingTutorData as any).id) !== sessionContext.userId) {
        return res.status(400).json({ error: 'Tutor profile id cannot be reassigned.' });
      }

      delete (incomingTutorData as any).id;
      delete (incomingTutorData as any).role;

      if (
        Object.prototype.hasOwnProperty.call(incomingTutorData, 'education')
        && !Object.prototype.hasOwnProperty.call(incomingTutorData, 'qualifications')
      ) {
        incomingTutorData.qualifications = incomingTutorData.education;
      }

      if (
        Object.prototype.hasOwnProperty.call(incomingTutorData, 'hourlyRate')
        && !Object.prototype.hasOwnProperty.call(incomingTutorData, 'pricePerHour')
      ) {
        incomingTutorData.pricePerHour = incomingTutorData.hourlyRate;
      }

      delete (incomingTutorData as any).education;
      delete (incomingTutorData as any).hourlyRate;

      if (Object.prototype.hasOwnProperty.call(incomingTutorData, 'name')) {
        const normalizedName = normalizeNameValue(incomingTutorData.name);
        if (normalizedName) {
          incomingTutorData.name = normalizedName;
        } else {
          delete (incomingTutorData as any).name;
        }
      }

      if (Object.prototype.hasOwnProperty.call(incomingTutorData, 'qualifications')) {
        const normalizedQualifications = String(incomingTutorData.qualifications ?? '').trim();
        incomingTutorData.qualifications = normalizedQualifications || 'Not specified';
      }

      if (Object.prototype.hasOwnProperty.call(incomingTutorData, 'pricePerHour')) {
        incomingTutorData.pricePerHour = toFinitePrice(incomingTutorData.pricePerHour);
      }

      if (Object.prototype.hasOwnProperty.call(incomingTutorData, 'bio')) {
        incomingTutorData.bio = String(incomingTutorData.bio ?? '').trim();
      }

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

        const parsedTutorRating = Number(incomingTutorData.rating);
        const parsedTutorReviewCount = Number(incomingTutorData.reviewCount);
        const tutorDisplayName = normalizeNameValue(
          String(incomingTutorData.name || `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`)
        );
        const tutorQualifications = String(incomingTutorData.qualifications ?? '').trim();
        const tutorBio = String(incomingTutorData.bio ?? '').trim();

        tutor = new Tutor({
          id: user.id,
          name: tutorDisplayName || 'Tutor',
          email: normalizeEmailAddress(incomingTutorData.email) || normalizeEmailAddress(user.email),
          role: 'tutor',
          qualifications: tutorQualifications || 'Not specified',
          subjects: normalizedSubjects,
          teachingLevel: normalizeTeachingLevel(requestedTeachingLevel || 'School'),
          pricePerHour: toFinitePrice(incomingTutorData.pricePerHour),
          rating: Number.isFinite(parsedTutorRating) ? Math.max(0, Math.min(5, parsedTutorRating)) : 0,
          reviewCount: Number.isFinite(parsedTutorReviewCount) ? Math.max(0, Math.round(parsedTutorReviewCount)) : 0,
          bio: tutorBio,
          availability: Array.isArray(incomingTutorData.availability) ? incomingTutorData.availability : [],
          isVerified: Boolean(incomingTutorData.isVerified),
        });

        await tutor.save();
        res.json(tutor);
      }
    } catch (error) {
      console.error("Update tutor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/tutors/:id", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      if (req.params.id !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only delete your own tutor profile.' });
      }

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

  app.post("/api/reviews", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const reviewData = req.body || {};
      const tutorId = String(reviewData.tutorId || '').trim();
      const requestedStudentId = String(reviewData.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;
      const studentName = String(reviewData.studentName || '').trim();
      const sessionId = String(reviewData.sessionId || '').trim();
      const rating = Number(reviewData.rating);
      const comment = String(reviewData.comment || '').trim();
      const date = String(reviewData.date || new Date().toISOString().split('T')[0]).trim();

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only submit your own reviews.')) {
        return;
      }

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

  app.put("/api/reviews/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingReview = await Review.findOne({ id: req.params.id });
      if (!existingReview) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingReview.studentId || '').trim(), 'You can only update your own reviews.')) {
        return;
      }

      const updatePayload: Record<string, unknown> = {};

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'rating')) {
        const rating = Number(req.body?.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
          return res.status(400).json({ error: 'rating must be between 1 and 5.' });
        }
        updatePayload.rating = rating;
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'comment')) {
        updatePayload.comment = String(req.body?.comment || '').trim();
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'date')) {
        updatePayload.date = String(req.body?.date || '').trim() || new Date().toISOString().split('T')[0];
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'studentName')) {
        const normalizedStudentName = String(req.body?.studentName || '').trim();
        if (!normalizedStudentName) {
          return res.status(400).json({ error: 'studentName cannot be empty.' });
        }
        updatePayload.studentName = normalizedStudentName;
      }

      if (Object.keys(updatePayload).length === 0) {
        return res.json(existingReview);
      }

      const review = await Review.findOneAndUpdate(
        { id: req.params.id },
        { $set: updatePayload },
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

  app.delete("/api/reviews/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingReview = await Review.findOne({ id: req.params.id });
      if (!existingReview) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingReview.studentId || '').trim(), 'You can only delete your own reviews.')) {
        return;
      }

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

  app.post("/api/courses", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const courseData = req.body || {};
      const requestedTutorId = String(courseData?.tutorId || '').trim();

      if (requestedTutorId && requestedTutorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only create courses for your own tutor account.' });
      }

      const tutorId = sessionContext.userId;

      const tutorUser = await User.findOne({ id: tutorId, role: 'tutor' });
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
        tutorId,
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

  app.put("/api/courses/:id", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only update courses as the signed-in tutor.' });
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

  app.delete("/api/courses/:id", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only delete courses as the signed-in tutor.' });
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

  app.get('/api/courses/:id/coupons', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : '';
      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only view coupons for your own courses.' });
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

  app.post('/api/courses/:id/coupons', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId = String(req.body?.actorId || '').trim();
      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only create coupons for your own courses.' });
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

  app.put('/api/courses/:id/coupons/:couponId', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId = String(req.body?.actorId || '').trim();
      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only update coupons for your own courses.' });
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

  app.patch('/api/courses/:id/coupons/:couponId/status', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId = String(req.body?.actorId || '').trim();
      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only update coupons for your own courses.' });
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

  app.delete('/api/courses/:id/coupons/:couponId', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId = sessionContext.userId;
      const requestedActorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : '';
      if (requestedActorId && requestedActorId !== actorId) {
        return res.status(403).json({ error: 'You can only delete coupons for your own courses.' });
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

  app.post('/api/courses/:id/coupons/validate', requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const requestedStudentId = String(req.body?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;
      const couponCode = normalizeCouponCode(req.body?.couponCode);

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only validate coupons for your own account.')) {
        return;
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

  app.post("/api/courses/:id/enroll", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const { paymentConfirmed, paymentReference, couponCode } = req.body || {};
      const requestedStudentId = String(req.body?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only enroll courses for your own account.')) {
        return;
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

  app.post("/api/courses/:id/unenroll", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const requestedStudentId = String(req.body?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only unenroll your own account.')) {
        return;
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
      const sessionContext = requireAuthenticatedSession(req, res);
      if (!sessionContext) {
        return;
      }

      const requestedStudentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
      const courseId = typeof req.query.courseId === 'string' ? req.query.courseId.trim() : '';
      const requestedTutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';

      let studentId = requestedStudentId;
      let tutorId = requestedTutorId;

      if (sessionContext.role === 'student') {
        if (requestedTutorId) {
          return res.status(403).json({ error: 'Student accounts cannot query tutor enrollment views.' });
        }

        if (requestedStudentId && requestedStudentId !== sessionContext.userId) {
          return res.status(403).json({ error: 'You can only access your own enrollments.' });
        }

        studentId = sessionContext.userId;
      } else if (sessionContext.role === 'tutor') {
        if (requestedTutorId && requestedTutorId !== sessionContext.userId) {
          return res.status(403).json({ error: 'You can only access enrollments for your own tutor account.' });
        }

        tutorId = sessionContext.userId;
      } else {
        return res.status(403).json({ error: 'Unsupported account role for enrollment access.' });
      }

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

  app.put("/api/course-enrollments/:id/progress", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const { completedModuleIds } = req.body || {};
      const requestedStudentId = String(req.body?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only update your own learning progress.')) {
        return;
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

  app.get('/api/withdrawals/summary', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const requestedTutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';

      if (requestedTutorId && requestedTutorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only access your own withdrawal summary.' });
      }

      const tutorId = sessionContext.userId;

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

  app.get('/api/withdrawals', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const requestedTutorId = typeof req.query.tutorId === 'string' ? req.query.tutorId.trim() : '';

      if (requestedTutorId && requestedTutorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only access your own withdrawals.' });
      }

      const tutorId = sessionContext.userId;

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

  app.post('/api/withdrawals', requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const requestedTutorId = String(req.body?.tutorId || '').trim();
      const tutorId = requestedTutorId || sessionContext.userId;
      const payoutMethodDetails = String(req.body?.payoutMethodDetails || '').trim();
      const payoutMethodType = normalizeWithdrawalPayoutMethodType(req.body?.payoutMethodType);
      const amount = toFinitePrice(req.body?.amount);

      if (!requireSessionUserMatch(sessionContext, res, tutorId, 'You can only create withdrawals for your own account.')) {
        return;
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

  app.get("/api/course-enrollments/:id/certificate", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const enrollment = await CourseEnrollment.findOne({ id: req.params.id });
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      const requestedStudentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
      const requestStudentId = requestedStudentId || sessionContext.userId;
      if (!requireSessionUserMatch(sessionContext, res, requestStudentId, 'You can only access your own certificate.')) {
        return;
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

  app.post("/api/resources", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resourceData = req.body || {};
      const normalizedTitle = typeof resourceData?.title === 'string' ? resourceData.title.trim() : '';
      const normalizedSubject = typeof resourceData?.subject === 'string' ? resourceData.subject.trim() : '';
      const normalizedType = typeof resourceData?.type === 'string' ? resourceData.type.trim() : '';
      const normalizedResourceUrl = typeof resourceData?.url === 'string' ? resourceData.url.trim() : '';
      const normalizedDescription =
        typeof resourceData?.description === 'string' ? resourceData.description.trim() : '';
      const normalizedBlobName = typeof resourceData?.blobName === 'string' ? resourceData.blobName.trim() : '';
      const normalizedMimeType = typeof resourceData?.mimeType === 'string' ? resourceData.mimeType.trim() : '';
      const parsedResourceSize = Number(resourceData?.size);

      const requestedTutorId = String(resourceData?.tutorId || '').trim();
      if (requestedTutorId && requestedTutorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only create resources for your own tutor account.' });
      }

      const tutorId = sessionContext.userId;

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

      const tutorUser = await User.findOne({ id: tutorId, role: 'tutor' });
      if (!tutorUser) {
        return res.status(400).json({ error: "Invalid tutorId. Tutor account not found." });
      }

      const id = createEntityId();
      const resource = new Resource({
        ...resourceData,
        tutorId,
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

  app.put("/api/resources/:id", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        sessionContext.userId;

      if (actorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only update resources for your own account.' });
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

  app.delete("/api/resources/:id", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        sessionContext.userId;

      if (actorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only delete resources for your own account.' });
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

  const normalizeBookingPaymentStatus = (value: unknown): 'pending' | 'paid' | 'failed' | 'refunded' => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'paid') return 'paid';
    if (normalized === 'failed') return 'failed';
    if (normalized === 'refunded') return 'refunded';
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

  const parseBookingTimeTokenToMinutes = (value: unknown): number | null => {
    const token = String(value || '').trim();
    if (!token) {
      return null;
    }

    const twelveHourMatch = token.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (twelveHourMatch) {
      let hours = Number(twelveHourMatch[1]);
      const minutes = Number(twelveHourMatch[2]);
      const meridiem = String(twelveHourMatch[3] || '').toUpperCase();

      if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        return null;
      }

      if (hours === 12) {
        hours = meridiem === 'AM' ? 0 : 12;
      } else if (meridiem === 'PM') {
        hours += 12;
      }

      return (hours * 60) + minutes;
    }

    const twentyFourHourMatch = token.match(/^(\d{1,2}):(\d{2})$/);
    if (!twentyFourHourMatch) {
      return null;
    }

    const hours = Number(twentyFourHourMatch[1]);
    const minutes = Number(twentyFourHourMatch[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    return (hours * 60) + minutes;
  };

  const parseBookingTimeRange = (value: unknown): { startMinutes: number; endMinutes: number } | null => {
    const raw = String(value || '').trim();
    if (!raw) {
      return null;
    }

    const tokens = raw
      .split('-')
      .map((token) => token.trim())
      .filter(Boolean);

    if (tokens.length !== 2) {
      return null;
    }

    const startMinutes = parseBookingTimeTokenToMinutes(tokens[0]);
    const endMinutes = parseBookingTimeTokenToMinutes(tokens[1]);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return null;
    }

    return { startMinutes, endMinutes };
  };

  const parseSessionStartDateTime = (dateValue: unknown, timeSlotValue: unknown): Date | null => {
    const rawDate = String(dateValue || '').trim();
    if (!rawDate) {
      return null;
    }

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    const timeRange = parseBookingTimeRange(timeSlotValue);
    if (!timeRange) {
      date.setHours(0, 0, 0, 0);
      return date;
    }

    const hours = Math.floor(timeRange.startMinutes / 60);
    const minutes = timeRange.startMinutes % 60;
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const bookingTimeRangesOverlap = (
    a: { startMinutes: number; endMinutes: number },
    b: { startMinutes: number; endMinutes: number }
  ): boolean => {
    return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
  };

  const resolveSessionRoleForRequest = async (
    req: express.Request,
    context: SessionAuthContext
  ): Promise<string> => {
    const roleFromSession = String(context.role || '').trim().toLowerCase();
    if (roleFromSession === 'student' || roleFromSession === 'tutor' || roleFromSession === 'admin') {
      return roleFromSession;
    }

    if (!context.userId) {
      return '';
    }

    try {
      const user = await User.findOne({ id: context.userId }, { role: 1 });
      const resolvedRole = String(user?.role || '').trim().toLowerCase();
      if ((resolvedRole === 'student' || resolvedRole === 'tutor' || resolvedRole === 'admin') && req.session) {
        (req.session as any).role = resolvedRole;
      }
      return resolvedRole;
    } catch (error) {
      console.warn('Session role hydration warning:', error);
      return roleFromSession;
    }
  };

  const hasTutorBookingConflict = async (input: {
    tutorId: string;
    date: string;
    slotId?: string;
    timeSlot?: string;
    excludeBookingId?: string;
  }): Promise<boolean> => {
    const tutorId = String(input.tutorId || '').trim();
    const date = String(input.date || '').trim();
    const slotId = String(input.slotId || '').trim();
    const timeSlot = String(input.timeSlot || '').trim();
    const excludeBookingId = String(input.excludeBookingId || '').trim();

    if (!tutorId || !date) {
      return false;
    }

    const baseQuery: Record<string, any> = {
      tutorId,
      date,
      status: { $in: ['pending', 'confirmed'] },
      paymentStatus: { $nin: ['failed', 'refunded'] },
    };

    if (excludeBookingId) {
      baseQuery.id = { $ne: excludeBookingId };
    }

    if (slotId) {
      const slotConflict = await Booking.findOne({
        ...baseQuery,
        slotId,
      });

      if (slotConflict) {
        return true;
      }
    }

    const targetRange = parseBookingTimeRange(timeSlot);
    if (!targetRange) {
      return false;
    }

    const existingBookings = await Booking.find(baseQuery, { id: 1, timeSlot: 1 });
    for (const booking of existingBookings) {
      if (excludeBookingId && String((booking as any).id || '').trim() === excludeBookingId) {
        continue;
      }

      const existingRange = parseBookingTimeRange((booking as any).timeSlot);
      if (!existingRange) {
        continue;
      }

      if (bookingTimeRangesOverlap(targetRange, existingRange)) {
        return true;
      }
    }

    return false;
  };

  const getBookingSessionResourceContainerCandidates = (resource: unknown): string[] => {
    const explicitContainerName = String((resource as any)?.containerName || '').trim();

    const candidates = [
      explicitContainerName,
      String(AZURE_BLOB_CONTAINER_SESSION_RESOURCES || '').trim(),
      String(AZURE_BLOB_CONTAINER_RESOURCES || '').trim(),
    ].filter(Boolean);

    return Array.from(new Set(candidates));
  };

  const resolveBookingSessionResourceLocation = async (
    resource: unknown
  ): Promise<{ url: string; blobName?: string; containerName?: string; blobExistsInAzure: boolean } | null> => {
    const resourceUrl = String((resource as any)?.url || '').trim();
    const explicitBlobName = String((resource as any)?.blobName || '').trim();
    const containerCandidates = getBookingSessionResourceContainerCandidates(resource);

    for (const containerName of containerCandidates) {
      const inferredBlobName = explicitBlobName || extractBlobNameFromUrl(resourceUrl, containerName) || '';
      if (!inferredBlobName) {
        continue;
      }

      try {
        if (await blobExists(inferredBlobName, containerName)) {
          return {
            url: resourceUrl,
            blobName: inferredBlobName,
            containerName,
            blobExistsInAzure: true,
          };
        }
      } catch (error) {
        console.warn('Session resource blob URL resolution warning:', error);
      }
    }

    if (isHttpUrl(resourceUrl)) {
      for (const containerName of containerCandidates) {
        const inferredBlobName = explicitBlobName || extractBlobNameFromUrl(resourceUrl, containerName) || '';
        if (inferredBlobName) {
          return {
            url: resourceUrl,
            blobName: inferredBlobName,
            containerName,
            blobExistsInAzure: false,
          };
        }
      }

      return {
        url: resourceUrl,
        blobName: explicitBlobName || undefined,
        containerName: containerCandidates[0] || undefined,
        blobExistsInAzure: false,
      };
    }

    return null;
  };

  const normalizeBookingSessionResources = async (value: unknown): Promise<Array<Record<string, unknown>>> => {
    if (!Array.isArray(value)) {
      return [];
    }

    const normalized = await Promise.all(
      value.map(async (resource) => {
        const name = String((resource as any)?.name || '').trim();
        const url = String((resource as any)?.url || '').trim();
        const normalizedId = String((resource as any)?.id || '').trim() || createEntityId();
        const blobName = String((resource as any)?.blobName || '').trim();
        const containerName = String((resource as any)?.containerName || '').trim();
        const mimeType = String((resource as any)?.mimeType || '').trim();
        const uploadedByTutorId = String((resource as any)?.uploadedByTutorId || '').trim();
        const uploadedAt = String((resource as any)?.uploadedAt || '').trim();
        const parsedSize = Number((resource as any)?.size);

        const resolvedLocation = await resolveBookingSessionResourceLocation({
          url,
          blobName,
          containerName,
        });

        const effectiveUrl = resolvedLocation?.url || url;

        if (!name || !effectiveUrl) {
          return null;
        }

        const normalizedBlobName = resolvedLocation?.blobName || blobName || undefined;
        const normalizedContainerName = resolvedLocation?.containerName || containerName || undefined;
        const blobExistsInAzure = Boolean(resolvedLocation?.blobExistsInAzure);

        if (normalizedBlobName && normalizedContainerName && !blobExistsInAzure) {
          console.warn('Session resource normalization detected missing blob in Azure', {
            bookingResourceId: normalizedId,
            containerName: normalizedContainerName,
            blobName: normalizedBlobName,
            url: effectiveUrl,
          });
        }

        return {
          id: normalizedId,
          name,
          url: effectiveUrl,
          blobName: normalizedBlobName,
          containerName: normalizedContainerName,
          mimeType: mimeType || undefined,
          size: Number.isFinite(parsedSize) && parsedSize >= 0 ? parsedSize : undefined,
          uploadedByTutorId: uploadedByTutorId || undefined,
          uploadedAt: uploadedAt || undefined,
        };
      })
    );

    return normalized.filter(Boolean) as Array<Record<string, unknown>>;
  };

  const syncBookingSlotLockState = async (
    previousBooking: any,
    nextBooking: any,
    reason: string
  ) => {
    const wasSlotLocked =
      normalizeBookingStatus(previousBooking?.status) === 'confirmed' &&
      normalizeBookingPaymentStatus(previousBooking?.paymentStatus) === 'paid';
    const isSlotLocked =
      normalizeBookingStatus(nextBooking?.status) === 'confirmed' &&
      normalizeBookingPaymentStatus(nextBooking?.paymentStatus) === 'paid';

    try {
      if (
        wasSlotLocked &&
        (!isSlotLocked || previousBooking?.slotId !== nextBooking?.slotId || previousBooking?.tutorId !== nextBooking?.tutorId)
      ) {
        await Tutor.updateOne(
          { id: previousBooking?.tutorId, 'availability.id': previousBooking?.slotId },
          { $set: { 'availability.$.isBooked': false } }
        );
      }

      if (isSlotLocked) {
        await Tutor.updateOne(
          { id: nextBooking?.tutorId, 'availability.id': nextBooking?.slotId },
          { $set: { 'availability.$.isBooked': true } }
        );
      }
    } catch (availabilitySyncError) {
      console.warn(`Booking slot sync warning (${reason}):`, availabilitySyncError);
    }
  };

  // Booking APIs
  app.get("/api/bookings", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resolvedRole = await resolveSessionRoleForRequest(req, sessionContext);

      if (resolvedRole !== 'student' && resolvedRole !== 'tutor') {
        return res.status(403).json({ error: 'Unsupported account role for booking access.' });
      }

      const bookings = await Booking.find(
        resolvedRole === 'tutor'
          ? { tutorId: sessionContext.userId }
          : { studentId: sessionContext.userId }
      );

      const now = Date.now();
      const staleRescheduleBookingIds = new Set<string>();
      const normalizedBookings = bookings.map((bookingDoc) => {
        const booking =
          typeof (bookingDoc as any)?.toObject === 'function'
            ? (bookingDoc as any).toObject()
            : bookingDoc;

        const currentStatus = normalizeBookingStatus((booking as any)?.status);
        const request = (booking as any)?.rescheduleRequest;

        if (!request || typeof request !== 'object') {
          return booking;
        }

        const requestStatus = String((request as any)?.status || '').trim().toLowerCase();
        const requestedDate = String((request as any)?.requestedDate || '').trim();
        const requestedTimeSlot = String((request as any)?.requestedTimeSlot || '').trim();
        const requestedByTutorId = String((request as any)?.requestedByTutorId || '').trim();
        const requestedAt = String((request as any)?.requestedAt || '').trim();
        const currentDate = String((booking as any)?.date || '').trim();
        const currentTimeSlot = String((booking as any)?.timeSlot || '').trim();
        const requestedStart = parseSessionStartDateTime(requestedDate, requestedTimeSlot);

        const isValidPendingRequest =
          requestStatus === 'pending' &&
          currentStatus !== 'cancelled' &&
          currentStatus !== 'completed' &&
          Boolean(requestedDate) &&
          Boolean(requestedTimeSlot) &&
          Boolean(requestedByTutorId) &&
          Boolean(requestedAt) &&
          !(requestedDate === currentDate && requestedTimeSlot === currentTimeSlot) &&
          (!requestedStart || requestedStart.getTime() > now);

        if (!isValidPendingRequest) {
          delete (booking as any).rescheduleRequest;
          const bookingId = String((booking as any)?.id || '').trim();
          if (bookingId) {
            staleRescheduleBookingIds.add(bookingId);
          }
          return booking;
        }

        (booking as any).rescheduleRequest = {
          ...request,
          requestedDate,
          requestedTimeSlot,
          requestedByTutorId,
          requestedAt,
          requestedSlotId: String((request as any)?.requestedSlotId || '').trim() || undefined,
          note: String((request as any)?.note || '').trim() || undefined,
          status: 'pending',
        };

        return booking;
      });

      if (staleRescheduleBookingIds.size > 0) {
        await Booking.updateMany(
          { id: { $in: Array.from(staleRescheduleBookingIds) } },
          { $unset: { rescheduleRequest: '' } }
        );
      }

      res.json(normalizedBookings);
    } catch (error) {
      console.error("Get bookings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/bookings/:id/resources/:resourceRef/download", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resolvedRole = await resolveSessionRoleForRequest(req, sessionContext);
      const requestedBookingId = String(req.params.id || '').trim();
      const requestedResourceRef = decodeURIComponent(String(req.params.resourceRef || '').trim());

      if (!requestedBookingId || !requestedResourceRef) {
        return res.status(400).json({ error: 'Booking id and resource reference are required.' });
      }

      const canMatchObjectId = /^[a-fA-F0-9]{24}$/.test(requestedBookingId);
      const booking = await Booking.findOne(
        canMatchObjectId
          ? { $or: [{ id: requestedBookingId }, { _id: requestedBookingId }] }
          : { id: requestedBookingId }
      );

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      const isOwner = booking.studentId === sessionContext.userId || booking.tutorId === sessionContext.userId;
      const isAdmin = resolvedRole === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'You can only access resources for your own bookings.' });
      }

      const sessionResources = Array.isArray((booking as any).sessionResources)
        ? (booking as any).sessionResources
        : [];

      const matchedResource = sessionResources.find((resource: any) => {
        const id = String(resource?.id || '').trim();
        const blobName = String(resource?.blobName || '').trim();
        const url = String(resource?.url || '').trim();

        return (
          (id && id === requestedResourceRef) ||
          (blobName && blobName === requestedResourceRef) ||
          (url && url === requestedResourceRef)
        );
      });

      if (!matchedResource) {
        return res.status(404).json({ error: 'Session resource not found.' });
      }

      const resolvedLocation = await resolveBookingSessionResourceLocation(matchedResource);
      if (!resolvedLocation || !resolvedLocation.blobName || !resolvedLocation.containerName) {
        return res.status(404).json({ error: 'Session resource is unavailable for download.' });
      }

      console.info('Booking session resource download lookup', {
        bookingId: (booking as any).id,
        resourceRef: requestedResourceRef,
        resolvedContainerName: resolvedLocation.containerName,
        resolvedBlobName: resolvedLocation.blobName,
        blobExistsInAzure: resolvedLocation.blobExistsInAzure,
      });

      if (!resolvedLocation.blobExistsInAzure) {
        return res.status(404).json({ error: 'Session resource blob is missing in Azure Blob Storage.' });
      }

      const downloaded = await downloadBlobToBuffer(resolvedLocation.blobName, resolvedLocation.containerName);
      const fileNameRaw = String((matchedResource as any)?.name || 'session-resource').trim() || 'session-resource';
      const safeFileName = fileNameRaw.replace(/[\r\n]/g, '').replace(/"/g, '');

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', downloaded.mimeType || String((matchedResource as any)?.mimeType || '').trim() || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Length', String(downloaded.buffer.length));
      return res.send(downloaded.buffer);
    } catch (error) {
      console.error('Download booking session resource error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete("/api/bookings/:id/resources/:resourceRef", requireTutorSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const requestedBookingId = String(req.params.id || '').trim();
      const requestedResourceRef = decodeURIComponent(String(req.params.resourceRef || '').trim());

      if (!requestedBookingId || !requestedResourceRef) {
        return res.status(400).json({ error: 'Booking id and resource reference are required.' });
      }

      const canMatchObjectId = /^[a-fA-F0-9]{24}$/.test(requestedBookingId);
      const booking = await Booking.findOne(
        canMatchObjectId
          ? { $or: [{ id: requestedBookingId }, { _id: requestedBookingId }] }
          : { id: requestedBookingId }
      );

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      if (booking.tutorId !== sessionContext.userId) {
        return res.status(403).json({ error: 'You can only remove resources from your own sessions.' });
      }

      const existingResources = Array.isArray((booking as any).sessionResources)
        ? (booking as any).sessionResources
        : [];

      const matchedResource = existingResources.find((resource: any) => {
        const id = String(resource?.id || '').trim();
        const blobName = String(resource?.blobName || '').trim();
        const url = String(resource?.url || '').trim();

        return (
          (id && id === requestedResourceRef) ||
          (blobName && blobName === requestedResourceRef) ||
          (url && url === requestedResourceRef)
        );
      });

      if (!matchedResource) {
        return res.status(404).json({ error: 'Session resource not found.' });
      }

      const resolvedLocation = await resolveBookingSessionResourceLocation(matchedResource);
      console.info('Booking session resource delete requested', {
        bookingId: (booking as any).id,
        tutorId: sessionContext.userId,
        resourceRef: requestedResourceRef,
        resolvedContainerName: resolvedLocation?.containerName,
        resolvedBlobName: resolvedLocation?.blobName,
        blobExistsInAzure: resolvedLocation?.blobExistsInAzure,
      });

      if (resolvedLocation?.blobName && resolvedLocation?.containerName && resolvedLocation.blobExistsInAzure) {
        await deleteBlobFile(resolvedLocation.blobName, resolvedLocation.containerName);
      }

      const filteredResources = existingResources.filter((resource: any) => {
        const id = String(resource?.id || '').trim();
        const blobName = String(resource?.blobName || '').trim();
        const url = String(resource?.url || '').trim();

        return !(
          (id && id === requestedResourceRef) ||
          (blobName && blobName === requestedResourceRef) ||
          (url && url === requestedResourceRef)
        );
      });

      const updatedBooking = await Booking.findOneAndUpdate(
        { id: String((booking as any).id || '').trim() },
        { $set: { sessionResources: filteredResources } },
        { new: true }
      );

      if (!updatedBooking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      console.info('Booking session resource delete saved', {
        bookingId: updatedBooking.id,
        resourceCount: Array.isArray((updatedBooking as any).sessionResources)
          ? (updatedBooking as any).sessionResources.length
          : 0,
      });

      return res.json(updatedBooking);
    } catch (error) {
      console.error('Delete booking session resource error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/bookings/:id/receipt", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resolvedRole = await resolveSessionRoleForRequest(req, sessionContext);
      const requestedBookingId = String(req.params.id || '').trim();

      if (!requestedBookingId) {
        return res.status(400).json({ error: 'Booking id is required.' });
      }

      const canMatchObjectId = /^[a-fA-F0-9]{24}$/.test(requestedBookingId);
      const booking = await Booking.findOne(
        canMatchObjectId
          ? { $or: [{ id: requestedBookingId }, { _id: requestedBookingId }] }
          : { id: requestedBookingId }
      );

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found.' });
      }

      const isOwner = booking.studentId === sessionContext.userId || booking.tutorId === sessionContext.userId;
      const isAdmin = resolvedRole === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'You can only download receipts for your own bookings.' });
      }

      const paymentStatus = normalizeBookingPaymentStatus((booking as any).paymentStatus);
      if (paymentStatus !== 'paid' && paymentStatus !== 'refunded') {
        return res.status(400).json({ error: 'A receipt is available only for paid bookings.' });
      }

      const [studentUser, tutorUser, tutorProfile] = await Promise.all([
        User.findOne({ id: booking.studentId }, { firstName: 1, lastName: 1 }),
        User.findOne({ id: booking.tutorId }, { firstName: 1, lastName: 1 }),
        Tutor.findOne({ id: booking.tutorId }, { pricePerHour: 1 }),
      ]);

      const studentName =
        toNotificationText((booking as any).studentName) ||
        getDisplayNameFromParts(studentUser?.firstName, studentUser?.lastName, 'Student');
      const tutorName = getDisplayNameFromParts(tutorUser?.firstName, tutorUser?.lastName, 'Tutor');
      const sessionTitle = `${toNotificationText((booking as any).subject, 'Tutoring')} Session`;
      const sessionDate = toNotificationText((booking as any).date, 'N/A');
      const sessionTime = toNotificationText((booking as any).timeSlot, 'N/A');

      const parsedStoredDuration = Number((booking as any).sessionDurationHours);
      const parsedRange = parseBookingTimeRange((booking as any).timeSlot);
      const durationHours =
        Number.isFinite(parsedStoredDuration) && parsedStoredDuration > 0
          ? roundCurrency(parsedStoredDuration)
          : parsedRange
            ? roundCurrency((parsedRange.endMinutes - parsedRange.startMinutes) / 60)
            : 0;

      const durationLabel = durationHours > 0 ? `${durationHours.toFixed(2)} hour(s)` : 'N/A';

      const parsedSessionAmount = Number((booking as any).sessionAmount);
      const parsedTutorRate = Number((tutorProfile as any)?.pricePerHour);
      const totalPaidAmount =
        Number.isFinite(parsedSessionAmount) && parsedSessionAmount >= 0
          ? roundCurrency(parsedSessionAmount)
          : Number.isFinite(parsedTutorRate) && parsedTutorRate >= 0 && durationHours > 0
            ? roundCurrency(parsedTutorRate * durationHours)
            : 0;

      const hourlyRateAmount =
        Number.isFinite(parsedTutorRate) && parsedTutorRate >= 0
          ? roundCurrency(parsedTutorRate)
          : totalPaidAmount > 0 && durationHours > 0
            ? roundCurrency(totalPaidAmount / durationHours)
            : 0;

      const receiptBookingId = toNotificationText((booking as any).id, requestedBookingId);
      const receiptTransactionReference = toNotificationText((booking as any).paymentReference, receiptBookingId);
      const generatedDateLabel = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const pdfBuffer = buildBookingReceiptPdf({
        platformName: String(process.env.APP_NAME || 'TutorSphere').trim() || 'TutorSphere',
        bookingId: receiptBookingId,
        studentName,
        tutorName,
        sessionTitle,
        sessionDate,
        sessionTime,
        durationLabel,
        hourlyRateLabel: durationHours > 0 || hourlyRateAmount > 0 ? formatLkrCurrency(hourlyRateAmount) : 'N/A',
        totalPaidLabel: formatLkrCurrency(totalPaidAmount),
        paymentStatusLabel: toTitleCase(paymentStatus),
        transactionReference: receiptTransactionReference,
        generatedDateLabel,
      });

      if (!pdfBuffer || pdfBuffer.length < 8 || pdfBuffer.subarray(0, 5).toString() !== '%PDF-') {
        throw new Error('Generated receipt content is not a valid PDF buffer.');
      }

      const safeBookingId = sanitizeFileSegment(receiptBookingId) || 'booking';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="booking-receipt-${safeBookingId}.pdf"`);
      res.setHeader('Content-Length', String(pdfBuffer.length));
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Download booking receipt error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/bookings", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resolvedRole = await resolveSessionRoleForRequest(req, sessionContext);
      if (resolvedRole !== 'student') {
        return res.status(403).json({ error: 'Only student accounts can perform this action.' });
      }

      const bookingData = req.body || {};
      const requestedStudentId = String(bookingData.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;
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
      const parsedSessionDurationHours = Number(bookingData.sessionDurationHours);
      const sessionDurationHours =
        Number.isFinite(parsedSessionDurationHours) && parsedSessionDurationHours > 0
          ? Math.round(parsedSessionDurationHours * 100) / 100
          : undefined;
      const parsedSessionAmount = Number(bookingData.sessionAmount);
      const sessionAmount =
        Number.isFinite(parsedSessionAmount) && parsedSessionAmount >= 0
          ? Math.round(parsedSessionAmount * 100) / 100
          : undefined;
      let status = normalizeBookingStatus(bookingData.status);

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only create bookings for your own account.')) {
        return;
      }

      if (!studentId || !tutorId || !slotId || !subject || !date) {
        return res.status(400).json({ error: 'studentId, tutorId, slotId, subject, and date are required.' });
      }

      if ((status === 'confirmed' || status === 'completed') && paymentStatus !== 'paid') {
        return res.status(400).json({ error: 'Confirmed bookings require a successful payment.' });
      }

      if (paymentStatus === 'paid' && !paymentReference) {
        return res.status(400).json({ error: 'Payment reference is required for paid bookings.' });
      }

      if (paymentStatus === 'refunded') {
        return res.status(400).json({ error: 'Bookings cannot start with refunded payment status.' });
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

      const hasConflict = await hasTutorBookingConflict({
        tutorId,
        date,
        slotId,
        timeSlot,
      });

      if (hasConflict) {
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
        sessionDurationHours,
        sessionAmount,
        sessionResources: [],
        hiddenForTutor: false,
        hiddenForStudent: false,
      });
      await booking.save();

      await syncBookingSlotLockState({}, booking, 'create');

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

  app.put("/api/bookings/:id", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resolvedRole = await resolveSessionRoleForRequest(req, sessionContext);
      const existingBooking = await Booking.findOne({ id: req.params.id });
      if (!existingBooking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      const isTutorActor = resolvedRole === 'tutor' && existingBooking.tutorId === sessionContext.userId;
      const isStudentActor = resolvedRole === 'student' && existingBooking.studentId === sessionContext.userId;

      if (!isTutorActor && !isStudentActor) {
        return res.status(403).json({ error: 'You can only update your own bookings.' });
      }

      if (req.body?.studentId !== undefined && String(req.body.studentId).trim() !== existingBooking.studentId) {
        return res.status(400).json({ error: 'Booking student cannot be changed.' });
      }

      if (req.body?.tutorId !== undefined && String(req.body.tutorId).trim() !== existingBooking.tutorId) {
        return res.status(400).json({ error: 'Booking tutor cannot be changed.' });
      }

      const incomingRescheduleDecision = String(req.body?.rescheduleDecision || '').trim().toLowerCase();
      const incomingRescheduleRequest = req.body?.rescheduleRequest;

      if (isStudentActor) {
        const incomingKeys = Object.keys(req.body || {});
        const allowedStudentKeys = new Set(['status', 'hiddenForStudent', 'rescheduleDecision']);
        const disallowedKeys = incomingKeys.filter((key) => !allowedStudentKeys.has(key));

        if (disallowedKeys.length > 0) {
          return res.status(403).json({ error: 'Students can only cancel, hide, or respond to reschedule requests.' });
        }

        if (req.body?.status !== undefined && normalizeBookingStatus(req.body.status) !== 'cancelled') {
          return res.status(403).json({ error: 'Students can only change booking status to cancelled.' });
        }

        if (incomingRescheduleDecision && incomingRescheduleDecision !== 'accept' && incomingRescheduleDecision !== 'decline') {
          return res.status(400).json({ error: 'rescheduleDecision must be either accept or decline.' });
        }
      }

      if (isTutorActor && incomingRescheduleDecision) {
        return res.status(403).json({ error: 'Tutors cannot respond to student reschedule decisions.' });
      }

      if (incomingRescheduleRequest !== undefined) {
        if (!isTutorActor) {
          return res.status(403).json({ error: 'Only tutors can request a session reschedule.' });
        }

        if (normalizeBookingStatus(existingBooking.status) === 'cancelled' || normalizeBookingStatus(existingBooking.status) === 'completed') {
          return res.status(400).json({ error: 'Only active sessions can be rescheduled.' });
        }

        if (normalizeBookingPaymentStatus(existingBooking.paymentStatus) !== 'paid') {
          return res.status(400).json({ error: 'Only paid sessions can be rescheduled.' });
        }

        const requestedDate = String(incomingRescheduleRequest?.requestedDate || '').trim();
        const requestedTimeSlot = String(incomingRescheduleRequest?.requestedTimeSlot || '').trim();
        const requestedSlotId = String(incomingRescheduleRequest?.requestedSlotId || existingBooking.slotId || '').trim();
        const requestedNote = String(incomingRescheduleRequest?.note || '').trim();

        if (!requestedDate || !requestedTimeSlot || !requestedSlotId) {
          return res.status(400).json({ error: 'requestedDate, requestedTimeSlot, and requestedSlotId are required.' });
        }

        const requestedStart = parseSessionStartDateTime(requestedDate, requestedTimeSlot);
        if (requestedStart && requestedStart.getTime() <= Date.now()) {
          return res.status(400).json({ error: 'Rescheduled session must be in the future.' });
        }

        const hasConflict = await hasTutorBookingConflict({
          tutorId: existingBooking.tutorId,
          date: requestedDate,
          slotId: requestedSlotId,
          timeSlot: requestedTimeSlot,
          excludeBookingId: existingBooking.id,
        });

        if (hasConflict) {
          return res.status(409).json({ error: 'The requested reschedule time conflicts with another booking.' });
        }

        const requestPayload = {
          requestedDate,
          requestedTimeSlot,
          requestedSlotId,
          note: requestedNote || undefined,
          requestedAt: new Date().toISOString(),
          requestedByTutorId: sessionContext.userId,
          status: 'pending',
        };

        const booking = await Booking.findOneAndUpdate(
          { id: req.params.id },
          { $set: { rescheduleRequest: requestPayload } },
          { new: true }
        );

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        const [studentUser, tutorUser] = await Promise.all([
          User.findOne({ id: booking.studentId }, { firstName: 1, lastName: 1 }),
          User.findOne({ id: booking.tutorId }, { firstName: 1, lastName: 1 }),
        ]);

        const studentDisplayName =
          toNotificationText(booking.studentName) ||
          getDisplayNameFromParts(studentUser?.firstName, studentUser?.lastName, 'Student');
        const tutorDisplayName = getDisplayNameFromParts(tutorUser?.firstName, tutorUser?.lastName, 'Tutor');
        const currentSessionLabel = formatSessionLabel(existingBooking);
        const requestedSessionLabel = formatSessionLabel({
          subject: booking.subject,
          date: requestedDate,
          timeSlot: requestedTimeSlot,
        });

        await createUserNotifications([
          {
            userId: booking.studentId,
            type: 'session_reschedule_request',
            title: 'Reschedule request',
            message: `${tutorDisplayName} requested to move your ${currentSessionLabel} to ${requestedSessionLabel}.${requestedNote ? ` Note: ${requestedNote}` : ''} Please accept or decline this request.`,
            targetTab: 'studentSessions',
            link: '/studentSessions',
            relatedEntityId: booking.id,
          },
          {
            userId: booking.tutorId,
            type: 'booking_update',
            title: 'Reschedule request sent',
            message: `Reschedule request for ${studentDisplayName}'s ${currentSessionLabel} was sent. Waiting for student approval.`,
            targetTab: 'tutorSessions',
            link: '/tutorSessions',
            relatedEntityId: booking.id,
          },
        ]);

        return res.json(booking);
      }

      if (incomingRescheduleDecision) {
        if (!isStudentActor) {
          return res.status(403).json({ error: 'Only students can respond to reschedule requests.' });
        }

        const activeRescheduleRequest = (existingBooking as any)?.rescheduleRequest;
        if (!activeRescheduleRequest || String(activeRescheduleRequest.status || '').trim().toLowerCase() !== 'pending') {
          return res.status(400).json({ error: 'No pending reschedule request was found for this session.' });
        }

        const requestedDate = String(activeRescheduleRequest.requestedDate || '').trim();
        const requestedTimeSlot = String(activeRescheduleRequest.requestedTimeSlot || '').trim();
        const requestedSlotId = String(activeRescheduleRequest.requestedSlotId || existingBooking.slotId || '').trim();

        if (incomingRescheduleDecision === 'accept') {
          const requestedStart = parseSessionStartDateTime(requestedDate, requestedTimeSlot);
          if (requestedStart && requestedStart.getTime() <= Date.now()) {
            return res.status(400).json({ error: 'This rescheduled time is no longer valid because it is in the past.' });
          }

          const hasConflict = await hasTutorBookingConflict({
            tutorId: existingBooking.tutorId,
            date: requestedDate,
            slotId: requestedSlotId,
            timeSlot: requestedTimeSlot,
            excludeBookingId: existingBooking.id,
          });

          if (hasConflict) {
            return res.status(409).json({ error: 'The requested reschedule time is no longer available.' });
          }

          const booking = await Booking.findOneAndUpdate(
            { id: req.params.id },
            {
              $set: {
                date: requestedDate,
                timeSlot: requestedTimeSlot,
                slotId: requestedSlotId,
              },
              $unset: {
                rescheduleRequest: '',
              },
            },
            { new: true }
          );

          if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
          }

          await syncBookingSlotLockState(existingBooking, booking, 'reschedule accept');

          const [studentUser, tutorUser] = await Promise.all([
            User.findOne({ id: booking.studentId }, { firstName: 1, lastName: 1 }),
            User.findOne({ id: booking.tutorId }, { firstName: 1, lastName: 1 }),
          ]);

          const studentDisplayName =
            toNotificationText(existingBooking.studentName) ||
            getDisplayNameFromParts(studentUser?.firstName, studentUser?.lastName, 'Student');
          const nextSessionLabel = formatSessionLabel(booking);

          await createUserNotifications([
            {
              userId: booking.studentId,
              type: 'session_rescheduled',
              title: 'Reschedule accepted',
              message: `You accepted the reschedule request. Your session is now set to ${nextSessionLabel}.`,
              targetTab: 'studentSessions',
              link: '/studentSessions',
              relatedEntityId: booking.id,
            },
            {
              userId: booking.tutorId,
              type: 'session_rescheduled',
              title: 'Reschedule accepted',
              message: `${studentDisplayName} accepted the reschedule request. Session moved to ${nextSessionLabel}.`,
              targetTab: 'tutorSessions',
              link: '/tutorSessions',
              relatedEntityId: booking.id,
            },
          ]);

          return res.json(booking);
        }

        const wasPaid = normalizeBookingPaymentStatus(existingBooking.paymentStatus) === 'paid';
        const nextPaymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' = wasPaid
          ? 'refunded'
          : normalizeBookingPaymentStatus(existingBooking.paymentStatus);

        const booking = await Booking.findOneAndUpdate(
          { id: req.params.id },
          {
            $set: {
              status: 'cancelled',
              paymentStatus: nextPaymentStatus,
              ...(wasPaid
                ? {
                    refundedAt: new Date().toISOString(),
                    refundReason: 'Payment refunded because the student declined the reschedule request.',
                  }
                : {}),
            },
            $unset: {
              rescheduleRequest: '',
            },
          },
          { new: true }
        );

        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }

        await syncBookingSlotLockState(existingBooking, booking, 'reschedule decline');

        const [studentUser, tutorUser] = await Promise.all([
          User.findOne({ id: booking.studentId }, { firstName: 1, lastName: 1 }),
          User.findOne({ id: booking.tutorId }, { firstName: 1, lastName: 1 }),
        ]);

        const studentDisplayName =
          toNotificationText(existingBooking.studentName) ||
          getDisplayNameFromParts(studentUser?.firstName, studentUser?.lastName, 'Student');
        const previousSessionLabel = formatSessionLabel(existingBooking);

        const notifications: NotificationDraft[] = [
          {
            userId: booking.studentId,
            type: 'session_cancelled',
            title: 'Session cancelled',
            message: `You declined the reschedule request. Your ${previousSessionLabel} has been cancelled.`,
            targetTab: 'studentSessions',
            link: '/studentSessions',
            relatedEntityId: booking.id,
          },
          {
            userId: booking.tutorId,
            type: 'session_cancelled',
            title: 'Session cancelled',
            message: `${studentDisplayName} declined the reschedule request. ${previousSessionLabel} was cancelled.`,
            targetTab: 'tutorSessions',
            link: '/tutorSessions',
            relatedEntityId: booking.id,
          },
        ];

        if (wasPaid) {
          notifications.push(
            {
              userId: booking.studentId,
              type: 'payment_refunded',
              title: 'Payment refunded',
              message: `Your payment for ${previousSessionLabel} has been refunded.`,
              targetTab: 'studentSessions',
              link: '/studentSessions',
              relatedEntityId: booking.id,
            },
            {
              userId: booking.tutorId,
              type: 'payment_refunded',
              title: 'Session payment refunded',
              message: `Payment for ${studentDisplayName}'s ${previousSessionLabel} was refunded.`,
              targetTab: 'tutorSessions',
              link: '/tutorSessions',
              relatedEntityId: booking.id,
            }
          );
        }

        await createUserNotifications(notifications);
        return res.json(booking);
      }

      const incomingStatus = req.body?.status;
      const incomingPaymentStatus = req.body?.paymentStatus;
      let status = incomingStatus !== undefined
        ? normalizeBookingStatus(incomingStatus)
        : normalizeBookingStatus(existingBooking.status);
      let paymentStatus = incomingPaymentStatus !== undefined
        ? normalizeBookingPaymentStatus(incomingPaymentStatus)
        : normalizeBookingPaymentStatus(existingBooking.paymentStatus);

      const nextTutorId = String(req.body?.tutorId ?? existingBooking.tutorId).trim();
      const nextSlotId = String(req.body?.slotId ?? existingBooking.slotId).trim();
      const nextDate = String(req.body?.date ?? existingBooking.date).trim();
      const nextTimeSlot = req.body?.timeSlot !== undefined
        ? String(req.body?.timeSlot || '').trim()
        : String(existingBooking.timeSlot || '').trim();

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

      if (paymentStatus === 'refunded' && status !== 'cancelled') {
        status = 'cancelled';
      }

      if ((status === 'confirmed' || status === 'completed') && paymentStatus !== 'paid') {
        return res.status(400).json({ error: 'Only paid bookings can be confirmed or completed.' });
      }

      if (status === 'cancelled' && paymentStatus === 'paid') {
        paymentStatus = 'refunded';
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
      const refundedAt = req.body?.refundedAt !== undefined
        ? String(req.body.refundedAt || '').trim()
        : String((existingBooking as any).refundedAt || '').trim();
      const refundReason = req.body?.refundReason !== undefined
        ? String(req.body.refundReason || '').trim()
        : String((existingBooking as any).refundReason || '').trim();

      const scheduleRelevantChange =
        req.body?.tutorId !== undefined ||
        req.body?.slotId !== undefined ||
        req.body?.date !== undefined ||
        req.body?.timeSlot !== undefined ||
        req.body?.status !== undefined ||
        req.body?.paymentStatus !== undefined;

      if (scheduleRelevantChange && (status === 'pending' || status === 'confirmed') && paymentStatus !== 'failed' && paymentStatus !== 'refunded') {
        const hasConflict = await hasTutorBookingConflict({
          tutorId: nextTutorId,
          date: nextDate,
          slotId: nextSlotId,
          timeSlot: nextTimeSlot,
          excludeBookingId: req.params.id,
        });

        if (hasConflict) {
          return res.status(409).json({ error: 'This time slot is already booked.' });
        }
      }

      const updateSet: Record<string, any> = {
        ...req.body,
        status,
        paymentStatus,
      };
      const updateUnset: Record<string, ''> = {};
      delete updateSet.rescheduleDecision;
      delete updateSet.rescheduleRequest;

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

      if (req.body?.sessionResources !== undefined) {
        if (!isTutorActor) {
          return res.status(403).json({ error: 'Only tutors can upload session resources.' });
        }

        const normalizedSessionResources = await normalizeBookingSessionResources(req.body.sessionResources);
        updateSet.sessionResources = normalizedSessionResources;
        console.info('Booking session resource update requested', {
          bookingId: existingBooking.id,
          tutorId: existingBooking.tutorId,
          resourceCount: normalizedSessionResources.length,
          resources: normalizedSessionResources.map((resource) => ({
            id: String((resource as any)?.id || '').trim(),
            containerName: String((resource as any)?.containerName || '').trim() || undefined,
            blobName: String((resource as any)?.blobName || '').trim() || undefined,
            url: String((resource as any)?.url || '').trim() || undefined,
          })),
        });
      }

      if (status === 'cancelled' || status === 'completed') {
        updateUnset.rescheduleRequest = '';
      }

      if (paymentStatus === 'paid') {
        updateSet.paymentReference = paymentReference;
        updateSet.paidAt = paidAt || String(existingBooking.paidAt || '').trim() || new Date().toISOString();
        updateUnset.paymentFailureReason = '';
        updateUnset.refundedAt = '';
        updateUnset.refundReason = '';
      } else if (paymentStatus === 'refunded') {
        if (paymentReference) {
          updateSet.paymentReference = paymentReference;
        }

        updateSet.paidAt = paidAt || String(existingBooking.paidAt || '').trim() || new Date().toISOString();
        updateSet.refundedAt = refundedAt || new Date().toISOString();
        updateSet.refundReason = refundReason || 'Payment refunded due to session cancellation.';
        updateUnset.paymentFailureReason = '';
      } else if (paymentStatus === 'failed') {
        updateSet.paymentFailureReason = paymentFailureReason || 'Payment failed before confirmation.';
        updateUnset.paymentReference = '';
        updateUnset.paidAt = '';
        updateUnset.refundedAt = '';
        updateUnset.refundReason = '';
      } else {
        updateUnset.paymentReference = '';
        updateUnset.paymentFailureReason = '';
        updateUnset.paidAt = '';
        updateUnset.refundedAt = '';
        updateUnset.refundReason = '';
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
        if (req.body?.sessionResources !== undefined) {
          const persistedResources = Array.isArray((booking as any).sessionResources)
            ? (booking as any).sessionResources
            : [];
          console.info('Booking session resource update saved', {
            bookingId: booking.id,
            resourceCount: persistedResources.length,
          });
        }

        await syncBookingSlotLockState(existingBooking, booking, 'update');

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

        if (nextPaymentStatus === 'refunded' && previousPaymentStatus !== 'refunded') {
          notifications.push(
            {
              userId: booking.studentId,
              type: 'payment_refunded',
              title: 'Payment refunded',
              message: `Your payment for ${previousSessionLabel} has been refunded.`,
              targetTab: 'studentSessions',
              link: '/studentSessions',
              relatedEntityId: booking.id,
            },
            {
              userId: booking.tutorId,
              type: 'payment_refunded',
              title: 'Session payment refunded',
              message: `Payment for ${studentDisplayName}'s ${previousSessionLabel} has been refunded.`,
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

  app.delete("/api/bookings/:id", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const resolvedRole = await resolveSessionRoleForRequest(req, sessionContext);
      const existingBooking = await Booking.findOne({ id: req.params.id });
      if (!existingBooking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const isTutorActor = resolvedRole === 'tutor' && existingBooking.tutorId === sessionContext.userId;
      const isStudentActor = resolvedRole === 'student' && existingBooking.studentId === sessionContext.userId;
      if (!isTutorActor && !isStudentActor) {
        return res.status(403).json({ error: 'You can only delete your own bookings.' });
      }

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
  app.get("/api/questions", requireAnySession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const questions = await Question.find(
        sessionContext.role === 'student'
          ? { studentId: sessionContext.userId }
          : {}
      );
      res.json(questions);
    } catch (error) {
      console.error("Get questions error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/questions", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const questionData = req.body || {};
      const requestedStudentId = String(questionData?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only create questions for your own account.')) {
        return;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const question = new Question({ ...questionData, studentId, id, timestamp: Date.now() });
      await question.save();
      res.json(question);
    } catch (error) {
      console.error("Create question error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/questions/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingQuestion = await Question.findOne({ id: req.params.id });
      if (!existingQuestion) {
        return res.status(404).json({ error: 'Question not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingQuestion.studentId || '').trim(), 'You can only update your own questions.')) {
        return;
      }

      const updatePayload: Record<string, unknown> = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'text')) {
        const text = String(req.body?.text || '').trim();
        if (!text) {
          return res.status(400).json({ error: 'Question text cannot be empty.' });
        }
        updatePayload.text = text;
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'subject')) {
        const subject = String(req.body?.subject || '').trim();
        if (!subject) {
          return res.status(400).json({ error: 'Question subject cannot be empty.' });
        }
        updatePayload.subject = subject;
      }

      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'answer')) {
        updatePayload.answer = String(req.body?.answer || '').trim();
      }

      if (Object.keys(updatePayload).length === 0) {
        return res.json(existingQuestion);
      }

      const question = await Question.findOneAndUpdate(
        { id: req.params.id },
        { $set: updatePayload },
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

  app.delete("/api/questions/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingQuestion = await Question.findOne({ id: req.params.id });
      if (!existingQuestion) {
        return res.status(404).json({ error: 'Question not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingQuestion.studentId || '').trim(), 'You can only delete your own questions.')) {
        return;
      }

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
  app.get("/api/quizzes", requireAnySession, async (req, res) => {
    try {
      const quizzes = await Quiz.find();
      res.json(quizzes);
    } catch (error) {
      console.error("Get quizzes error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/quizzes", requireAnySession, async (req, res) => {
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

  app.put("/api/quizzes/:id", requireAnySession, async (req, res) => {
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

  app.delete("/api/quizzes/:id", requireAnySession, async (req, res) => {
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
  app.get("/api/study-plans/:studentId", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      if (!requireSessionUserMatch(sessionContext, res, req.params.studentId, 'You can only access your own study plan.')) {
        return;
      }

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

  app.post("/api/study-plans", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const studyPlanData = req.body || {};
      const requestedStudentId = String(studyPlanData?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only create your own study plan.')) {
        return;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const studyPlan = new StudyPlan({ ...studyPlanData, studentId, id });
      await studyPlan.save();
      res.json(studyPlan);
    } catch (error) {
      console.error("Create study plan error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/study-plans/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingStudyPlan = await StudyPlan.findOne({ id: req.params.id });
      if (!existingStudyPlan) {
        return res.status(404).json({ error: 'Study plan not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingStudyPlan.studentId || '').trim(), 'You can only update your own study plan.')) {
        return;
      }

      const updatePayload = { ...req.body };
      delete (updatePayload as any).studentId;

      const studyPlan = await StudyPlan.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
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

  app.delete("/api/study-plans/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingStudyPlan = await StudyPlan.findOne({ id: req.params.id });
      if (!existingStudyPlan) {
        return res.status(404).json({ error: 'Study plan not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingStudyPlan.studentId || '').trim(), 'You can only delete your own study plan.')) {
        return;
      }

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
  app.get("/api/skill-levels/:studentId", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      if (!requireSessionUserMatch(sessionContext, res, req.params.studentId, 'You can only access your own skill levels.')) {
        return;
      }

      const skillLevels = await SkillLevel.find({ studentId: req.params.studentId });
      res.json(skillLevels);
    } catch (error) {
      console.error("Get skill levels error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/skill-levels", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const skillLevelData = req.body || {};
      const requestedStudentId = String(skillLevelData?.studentId || '').trim();
      const studentId = requestedStudentId || sessionContext.userId;

      if (!requireSessionUserMatch(sessionContext, res, studentId, 'You can only create your own skill levels.')) {
        return;
      }

      const id = Math.random().toString(36).substr(2, 9);
      const skillLevel = new SkillLevel({ ...skillLevelData, studentId, id });
      await skillLevel.save();
      res.json(skillLevel);
    } catch (error) {
      console.error("Create skill level error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/skill-levels/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingSkillLevel = await SkillLevel.findOne({ id: req.params.id });
      if (!existingSkillLevel) {
        return res.status(404).json({ error: 'Skill level not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingSkillLevel.studentId || '').trim(), 'You can only update your own skill levels.')) {
        return;
      }

      const updatePayload = { ...req.body };
      delete (updatePayload as any).studentId;

      const skillLevel = await SkillLevel.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
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

  app.delete("/api/skill-levels/:id", requireStudentSession, async (req, res) => {
    try {
      const sessionContext = getSessionAuthContext(req);
      const existingSkillLevel = await SkillLevel.findOne({ id: req.params.id });
      if (!existingSkillLevel) {
        return res.status(404).json({ error: 'Skill level not found' });
      }

      if (!requireSessionUserMatch(sessionContext, res, String(existingSkillLevel.studentId || '').trim(), 'You can only delete your own skill levels.')) {
        return;
      }

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
