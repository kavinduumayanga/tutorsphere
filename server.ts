import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import dotenv from "dotenv";
import multer from "multer";
import cors from "cors";
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
import { quizChatbotRouter } from "./src/server/quiz-chatbot/chatController.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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

const toUploadPublicPath = (filePath: string): string => {
  return `/uploads/${path.basename(filePath)}`;
};

const resolveStoredAvatarPath = (storedAvatar?: string): string | null => {
  if (!storedAvatar) {
    return null;
  }

  const directPath = path.resolve(storedAvatar);
  if (directPath.startsWith(UPLOADS_DIR + path.sep)) {
    return directPath;
  }

  try {
    const parsed = new URL(storedAvatar);
    const fileNameFromUrl = path.basename(parsed.pathname);
    if (fileNameFromUrl.startsWith('avatar-')) {
      return path.join(UPLOADS_DIR, fileNameFromUrl);
    }
  } catch {
    // Ignore non-URL values
  }

  const fileName = path.basename(storedAvatar);
  if (fileName.startsWith('avatar-')) {
    return path.join(UPLOADS_DIR, fileName);
  }

  return null;
};

const createEntityId = () => Math.random().toString(36).substr(2, 9);

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

const resolveCourseIsFree = (value: unknown, fallbackPrice: number): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallbackPrice <= 0;
};

type NormalizedCourseModuleResource = {
  name: string;
  url: string;
};

type NormalizedCourseModule = {
  id: string;
  title: string;
  videoUrl: string;
  resources: NormalizedCourseModuleResource[];
};

const isLikelyResourceUrl = (value: string): boolean => {
  return /^https?:\/\//i.test(value) || value.startsWith('/uploads/') || value.startsWith('./') || value.startsWith('../');
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
  return { name, url };
};

const normalizeCourseModules = (modules: any): NormalizedCourseModule[] => {
  if (!Array.isArray(modules)) {
    return [];
  }

  return modules
    .map((module: any) => ({
      id: String(module?.id || createEntityId()).trim() || createEntityId(),
      title: String(module?.title || '').trim(),
      videoUrl: String(module?.videoUrl || '').trim(),
      resources: (Array.isArray(module?.resources) ? module.resources : [])
        .map((resource: any, resourceIndex: number) => normalizeCourseModuleResource(resource, resourceIndex))
        .filter((resource: NormalizedCourseModuleResource | null): resource is NormalizedCourseModuleResource => Boolean(resource)),
    }))
    .filter((module: NormalizedCourseModule) => module.title && module.videoUrl);
};

const normalizeCourseForResponse = (course: any) => {
  const plainCourse = typeof course?.toObject === 'function' ? course.toObject() : course;
  return {
    ...plainCourse,
    modules: normalizeCourseModules(plainCourse?.modules),
  };
};

const isStoredAvatarFilePath = (avatar?: string): avatar is string => {
  return typeof avatar === 'string' && !avatar.includes('\x00');
};

const buildAvatarResponseUrl = async (
  req: express.Request,
  user: { id: string; avatar?: string }
): Promise<string | undefined> => {
  if (!user.avatar) {
    return undefined;
  }

  if (!isStoredAvatarFilePath(user.avatar)) {
    return `${req.protocol}://${req.get('host')}/api/auth/user/${user.id}/avatar`;
  }

  const avatarPath = resolveStoredAvatarPath(user.avatar);
  if (!avatarPath) {
    return `${req.protocol}://${req.get('host')}/api/auth/user/${user.id}/avatar`;
  }

  try {
    await fs.access(avatarPath);
    return `${req.protocol}://${req.get('host')}/api/auth/user/${user.id}/avatar`;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      // Clean stale DB references when the file no longer exists on disk.
      await User.updateOne({ id: user.id, avatar: user.avatar }, { $unset: { avatar: '' } });
      return undefined;
    }
    throw error;
  }
};

async function migrateUsers() {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    const USERS_DB_PATH = path.join(__dirname, "users.json");

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
    console.log('Migration skipped or failed:', error.message);
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
    console.log('Mock data migration failed:', error.message);
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

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Migrate existing users from JSON to MongoDB if needed
  await migrateUsers();

  // Migrate mock data to MongoDB if needed
  await migrateMockData();

  // Keep legacy courses compatible with free/paid access rules.
  await normalizeCourseAccessData();

  // Ensure uploads directory exists before handling multipart avatar uploads
  await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });

  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/api/quiz-chatbot', quizChatbotRouter);

  app.post('/api/uploads/course-thumbnail', handleCourseThumbnailUpload, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No thumbnail file was uploaded.' });
      }

      res.json({
        path: toUploadPublicPath(req.file.path),
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
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

      res.json({
        path: toUploadPublicPath(req.file.path),
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
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

      res.json({
        path: toUploadPublicPath(req.file.path),
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
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

      res.json({
        path: toUploadPublicPath(req.file.path),
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      console.error('Tutor resource upload error:', error);
      res.status(500).json({ error: 'Failed to upload tutor resource file.' });
    }
  });

  // Auth APIs
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { firstName, lastName, email, password, role } = req.body;
      const normalizedEmail = email ? email.trim() : '';
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

      // Check if user already exists
      const existingUser = await User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const id = Math.random().toString(36).substr(2, 9);
      const newUser = new User({ id, firstName, lastName, email: normalizedEmail, password, role: role || 'student' });

      await newUser.save();

      res.json({ id, firstName: newUser.firstName, lastName: newUser.lastName, email, role: newUser.role });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const normalizedEmail = email.trim();
      const escapedEmail = normalizedEmail.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const user = await User.findOne({
        email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') },
        password
      });

      if (user) {
        let avatarUrl: string | undefined;
        try {
          avatarUrl = await buildAvatarResponseUrl(req, user as { id: string; avatar?: string });
        } catch (avatarError) {
          console.warn('Failed to build avatar URL during login:', avatarError);
          avatarUrl = undefined;
        }
        // Fallback to splitting name for old users if firstName is missing
        let fName = user.firstName;
        let lName = user.lastName;
        if (!fName && !lName && (user as any).name) {
          const parts = (user as any).name.split(' ');
          fName = parts[0] || 'User';
          lName = parts.slice(1).join(' ') || '';
        }
        res.json({ id: user.id, firstName: fName || 'User', lastName: lName || '', email: user.email, role: user.role, avatar: avatarUrl, phone: user.phone });
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
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
        const oldAvatarPath = resolveStoredAvatarPath(user.avatar);

        // Delete the old avatar file if it exists
        if (oldAvatarPath && oldAvatarPath !== req.file.path) {
          try {
            await fs.unlink(oldAvatarPath);
            console.log('Old avatar file deleted:', oldAvatarPath);
          } catch (deleteError) {
            const err = deleteError as NodeJS.ErrnoException;
            if (err.code !== 'ENOENT') {
              console.warn('Failed to delete old avatar file:', oldAvatarPath, deleteError);
            }
          }
        }

        user.avatar = req.file.path;
        console.log('Avatar uploaded:', { size: req.file.size, mimetype: req.file.mimetype, path: req.file.path });
      }

      await user.save();

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

      const avatarPath = resolveStoredAvatarPath(user.avatar);

      // Remove role-specific data first to keep dangling references out of the app.
      if (user.role === 'tutor') {
        const tutorCourses = await Course.find({ tutorId: id }, { id: 1 });
        const tutorCourseIds = tutorCourses.map((course) => course.id);

        if (tutorCourseIds.length > 0) {
          await CourseEnrollment.deleteMany({ courseId: { $in: tutorCourseIds } });
        }

        await Course.deleteMany({ tutorId: id });
        await Resource.deleteMany({ tutorId: id });
        await Booking.deleteMany({ tutorId: id });
        await Review.deleteMany({ tutorId: id });
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
      await User.deleteOne({ id });

      if (avatarPath) {
        try {
          await fs.unlink(avatarPath);
        } catch (deleteError) {
          const err = deleteError as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            console.warn('Failed to remove avatar during account deletion:', avatarPath, deleteError);
          }
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

      // Check if avatar is a file path (new format) or binary data (old format)
      if (isStoredAvatarFilePath(user.avatar)) {
        // New format: file path
        try {
          const avatarPath = resolveStoredAvatarPath(user.avatar);
          if (!avatarPath) {
            return res.status(404).json({ error: 'Avatar file not found' });
          }
          console.log('Reading avatar from path:', avatarPath);
          const avatarData = await fs.readFile(avatarPath);

          // Determine content type from file extension
          const ext = path.extname(avatarPath).toLowerCase();
          const contentType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

          res.set('Content-Type', contentType);
          res.send(avatarData);
        } catch (fileError) {
          const err = fileError as NodeJS.ErrnoException;
          if (err.code === 'ENOENT') {
            console.warn('Avatar file missing on disk, clearing stale avatar value for user:', id);
            await User.updateOne({ id, avatar: user.avatar }, { $unset: { avatar: '' } });
            return res.status(404).json({ error: 'Avatar file not found' });
          }

          console.error('Error reading avatar file:', fileError);
          return res.status(500).json({ error: 'Failed to load avatar' });
        }
      } else {
        // Old format: binary data stored in database
        console.log('Serving legacy binary avatar data');
        // For backward compatibility, try to serve as JPEG (most common)
        res.set('Content-Type', 'image/jpeg');
        res.send(user.avatar);
      }
    } catch (error) {
      console.error("Get avatar error:", error);
      res.status(500).json({ error: "Internal server error" });
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
      const tutorData = req.body;
      const id = tutorData.id || Math.random().toString(36).substr(2, 9);
      const tutor = new Tutor({
        ...tutorData,
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
        const nextTutorPayload = {
          ...incomingTutorData,
          ...(requestedTeachingLevel !== undefined
            ? { teachingLevel: normalizeTeachingLevel(requestedTeachingLevel) }
            : {}),
        };

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

        tutor = new Tutor({
          ...incomingTutorData,
          id: user.id,
          name: incomingTutorData.name || `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`,
          email: incomingTutorData.email || user.email,
          role: 'tutor',
          qualifications: incomingTutorData.qualifications || 'Not specified',
          subjects: incomingTutorData.subjects || [],
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
      const reviews = await Review.find();
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/reviews/:tutorId", async (req, res) => {
    try {
      const reviews = await Review.find({ tutorId: req.params.tutorId });
      res.json(reviews);
    } catch (error) {
      console.error("Get tutor reviews error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    try {
      const reviewData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const review = new Review({ ...reviewData, id });
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

      const existingCourse = await Course.findOne({ id: req.params.id });
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (actorId && existingCourse.tutorId !== actorId) {
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

      const course = await Course.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
        { new: true }
      );
      if (course) {
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

      const existingCourse = await Course.findOne({ id: req.params.id });
      if (!existingCourse) {
        return res.status(404).json({ error: "Course not found" });
      }

      if (actorId && existingCourse.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only delete your own courses." });
      }

      const course = await Course.findOneAndDelete({ id: req.params.id });
      if (course) {
        await CourseEnrollment.deleteMany({ courseId: req.params.id });
        res.json({ message: "Course deleted successfully" });
      } else {
        res.status(404).json({ error: "Course not found" });
      }
    } catch (error) {
      console.error("Delete course error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/courses/:id/enroll", async (req, res) => {
    try {
      const { studentId, paymentConfirmed, paymentReference } = req.body;

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

      const isFreeCourse = resolveCourseIsFree((existingCourse as any).isFree, toFinitePrice(existingCourse.price));
      if (!isFreeCourse) {
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
      if (!existingEnrollment) {
        await CourseEnrollment.create({
          id: createEntityId(),
          courseId: req.params.id,
          studentId,
          completedModuleIds: [],
          progress: 0,
          enrolledAt: new Date(),
        });
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

      res.json(enrollments);
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

      res.json(updatedEnrollment);
    } catch (error) {
      console.error("Update enrollment progress error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/course-enrollments/:id/certificate", async (req, res) => {
    try {
      const enrollment = await CourseEnrollment.findOne({ id: req.params.id });
      if (!enrollment) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      const requestStudentId = typeof req.query.studentId === 'string' ? req.query.studentId.trim() : '';
      if (requestStudentId && requestStudentId !== enrollment.studentId) {
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
        return res.status(400).json({ error: "Resource URL must be a valid URL or uploaded file path." });
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
        description: normalizedDescription,
        isFree: true,
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

      const existingResource = await Resource.findOne({ id: req.params.id });
      if (!existingResource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      if (actorId && existingResource.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only manage your own resources." });
      }

      const updatePayload = { ...req.body };
      delete updatePayload.actorId;

      if (updatePayload.url !== undefined) {
        if (typeof updatePayload.url !== 'string') {
          return res.status(400).json({ error: "Resource URL must be a string." });
        }

        updatePayload.url = updatePayload.url.trim();
        if (!updatePayload.url || !isLikelyResourceUrl(updatePayload.url)) {
          return res.status(400).json({ error: "Resource URL must be a valid URL or uploaded file path." });
        }
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

      const resource = await Resource.findOneAndUpdate(
        { id: req.params.id },
        updatePayload,
        { new: true }
      );
      if (resource) {
        res.json(resource);
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Update resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/resources/:id", async (req, res) => {
    try {
      const actorId =
        (typeof req.body?.actorId === 'string' && req.body.actorId.trim()) ||
        (typeof req.query.actorId === 'string' && req.query.actorId.trim()) ||
        '';

      const existingResource = await Resource.findOne({ id: req.params.id });
      if (!existingResource) {
        return res.status(404).json({ error: "Resource not found" });
      }

      if (actorId && existingResource.tutorId !== actorId) {
        return res.status(403).json({ error: "You can only delete your own resources." });
      }

      const resource = await Resource.findOneAndDelete({ id: req.params.id });
      if (resource) {
        res.json({ message: "Resource deleted successfully" });
      } else {
        res.status(404).json({ error: "Resource not found" });
      }
    } catch (error) {
      console.error("Delete resource error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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
      const bookingData = req.body;
      const id = Math.random().toString(36).substr(2, 9);
      const booking = new Booking({ ...bookingData, id });
      await booking.save();
      res.json(booking);
    } catch (error) {
      console.error("Create booking error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.put("/api/bookings/:id", async (req, res) => {
    try {
      const booking = await Booking.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true }
      );
      if (booking) {
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
  if (process.env.NODE_ENV !== "production") {
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
    } catch (error) {
      console.error('Failed to start Vite dev server:', error.message);
      // Continue without Vite middleware - app will still work but without hot reloading
    }
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
