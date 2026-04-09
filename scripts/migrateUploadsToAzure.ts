import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import mongoose from '../src/database.js';
import { connectDB } from '../src/database.js';
import { User } from '../src/models/User.js';
import { Tutor } from '../src/models/Tutor.js';
import { Course } from '../src/models/Course.js';
import { Resource } from '../src/models/Resource.js';
import {
  blobExists,
  ensureSmallFileUploaded,
  getBlobUrl,
} from '../src/server/storage/azureBlobService.js';

type UploadCategory =
  | 'profile-images'
  | 'course-thumbnails'
  | 'videos'
  | 'resources'
  | 'recorded-lessons'
  | 'tutor-certificates';

type MigrationStats = {
  totalFound: number;
  uploaded: number;
  updated: number;
  skipped: number;
  failed: number;
  deleted: number;
  plannedUploads: number;
  plannedUpdates: number;
  plannedDeletes: number;
};

type LocalFileInfo = {
  absolutePath: string;
  relativePath: string;
  fileName: string;
  size: number;
  mimeType: string;
  categoryHint?: UploadCategory;
};

type LocalFileIndex = {
  byAbsolute: Map<string, LocalFileInfo>;
  byRelative: Map<string, LocalFileInfo>;
  byBaseName: Map<string, LocalFileInfo[]>;
};

type MigratedFile = {
  localPath: string;
  relativePath: string;
  category: UploadCategory;
  containerName: string;
  blobName: string;
  blobUrl: string;
  mimeType: string;
  size: number;
  uploaded: boolean;
};

const CATEGORY_ENV_MAP: Record<UploadCategory, string> = {
  'profile-images': 'AZURE_BLOB_CONTAINER_PROFILE_IMAGES',
  'course-thumbnails': 'AZURE_BLOB_CONTAINER_COURSE_THUMBNAILS',
  videos: 'AZURE_BLOB_CONTAINER_VIDEOS',
  resources: 'AZURE_BLOB_CONTAINER_RESOURCES',
  'recorded-lessons': 'AZURE_BLOB_CONTAINER_RECORDED_LESSONS',
  'tutor-certificates': 'AZURE_BLOB_CONTAINER_TUTOR_CERTIFICATES',
};

const KNOWN_UPLOAD_FOLDERS = new Set<UploadCategory>([
  'profile-images',
  'course-thumbnails',
  'videos',
  'resources',
  'recorded-lessons',
  'tutor-certificates',
]);

const PREFIX_CATEGORY_MAP: Array<{ prefixes: string[]; category: UploadCategory }> = [
  { prefixes: ['avatar-', 'profile-'], category: 'profile-images' },
  { prefixes: ['thumbnail-', 'course-thumbnail-', 'thumb-'], category: 'course-thumbnails' },
  { prefixes: ['video-', 'module-video-'], category: 'videos' },
  { prefixes: ['resource-', 'file-', 'document-'], category: 'resources' },
  { prefixes: ['recorded-lesson-', 'lesson-recording-', 'recording-'], category: 'recorded-lessons' },
  { prefixes: ['certificate-', 'tutor-certificate-'], category: 'tutor-certificates' },
];

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi', '.mkv']);
const DOC_EXTENSIONS = new Set([
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
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
};

const stats: MigrationStats = {
  totalFound: 0,
  uploaded: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  deleted: 0,
  plannedUploads: 0,
  plannedUpdates: 0,
  plannedDeletes: 0,
};

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has('--dry-run');
const KEEP_LOCAL = args.has('--keep-local') || args.has('--no-cleanup');
const CLEANUP_LOCAL = !DRY_RUN && !KEEP_LOCAL;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const UPLOADS_ROOT = path.join(PROJECT_ROOT, 'uploads');

const migratedFilesByPath = new Map<string, MigratedFile>();
const dbReferenceCountByPath = new Map<string, number>();
const dbUpdatedCountByPath = new Map<string, number>();
const referencedLocalPaths = new Set<string>();

const logInfo = (message: string, details?: unknown) => {
  if (details !== undefined) {
    console.log(`[uploads-migration] ${message}`, details);
    return;
  }

  console.log(`[uploads-migration] ${message}`);
};

const logWarn = (message: string, details?: unknown) => {
  if (details !== undefined) {
    console.warn(`[uploads-migration] ${message}`, details);
    return;
  }

  console.warn(`[uploads-migration] ${message}`);
};

const logError = (message: string, details?: unknown) => {
  if (details !== undefined) {
    console.error(`[uploads-migration] ${message}`, details);
    return;
  }

  console.error(`[uploads-migration] ${message}`);
};

const normalizeSlashes = (value: string): string => value.replace(/\\/g, '/');
const normalizeAbsoluteKey = (value: string): string => normalizeSlashes(path.resolve(value));

const toSafeFileSegment = (value: string, fallback: string): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const isCloudUrl = (value: string): boolean => /^https?:\/\//i.test(value.trim());

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const detectMimeType = (fileName: string): string => {
  const extension = path.extname(fileName || '').toLowerCase();
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream';
};

const resolveCategoryFromFile = (
  relativePath: string,
  fileName: string,
  explicitCategory?: UploadCategory
): UploadCategory | undefined => {
  if (explicitCategory) {
    return explicitCategory;
  }

  const normalizedRelative = normalizeSlashes(relativePath).replace(/^\/+/, '');
  const segments = normalizedRelative.split('/').filter(Boolean);
  const topFolder = (segments[0] || '').toLowerCase() as UploadCategory;
  if (KNOWN_UPLOAD_FOLDERS.has(topFolder)) {
    return topFolder;
  }

  const normalizedFileName = fileName.toLowerCase();
  for (const entry of PREFIX_CATEGORY_MAP) {
    if (entry.prefixes.some((prefix) => normalizedFileName.startsWith(prefix))) {
      return entry.category;
    }
  }

  const extension = path.extname(fileName).toLowerCase();
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'videos';
  }

  if (DOC_EXTENSIONS.has(extension)) {
    return 'resources';
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    // Fallback for unknown image names. Path-based references should already carry stronger hints.
    return 'course-thumbnails';
  }

  return undefined;
};

const getContainerNameForCategory = (category: UploadCategory): string => {
  const envKey = CATEGORY_ENV_MAP[category];
  const value = String(process.env[envKey] || '').trim();
  if (!value) {
    throw new Error(`${envKey} is required for uploads migration.`);
  }

  return value;
};

const buildDeterministicBlobName = (category: UploadCategory, relativePath: string): string => {
  const normalizedRelative = normalizeSlashes(relativePath).replace(/^\/+/, '') || path.basename(relativePath);
  const extension = path.extname(normalizedRelative).toLowerCase();
  const baseName = path.basename(normalizedRelative, extension);
  const safeBase = toSafeFileSegment(baseName, 'file');
  const hash = crypto
    .createHash('sha1')
    .update(`${category}:${normalizedRelative}`)
    .digest('hex')
    .slice(0, 16);

  return `legacy-migration/${category}/${safeBase}-${hash}${extension}`;
};

const collectFilesRecursive = async (rootDir: string): Promise<string[]> => {
  const allFiles: string[] = [];

  const traverse = async (currentPath: string) => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await traverse(fullPath);
      } else if (entry.isFile()) {
        allFiles.push(fullPath);
      }
    }
  };

  if (await fileExists(rootDir)) {
    await traverse(rootDir);
  }

  return allFiles;
};

const buildLocalFileIndex = async (filePaths: string[]): Promise<LocalFileIndex> => {
  const byAbsolute = new Map<string, LocalFileInfo>();
  const byRelative = new Map<string, LocalFileInfo>();
  const byBaseName = new Map<string, LocalFileInfo[]>();

  for (const absolutePath of filePaths) {
    const normalizedAbsolute = normalizeAbsoluteKey(absolutePath);
    const relativePath = normalizeSlashes(path.relative(UPLOADS_ROOT, absolutePath));
    const fileName = path.basename(absolutePath);
    const fileStat = await fs.stat(absolutePath);
    const categoryHint = resolveCategoryFromFile(relativePath, fileName);
    const fileInfo: LocalFileInfo = {
      absolutePath,
      relativePath,
      fileName,
      size: fileStat.size,
      mimeType: detectMimeType(fileName),
      categoryHint,
    };

    byAbsolute.set(normalizedAbsolute, fileInfo);
    byRelative.set(relativePath.toLowerCase(), fileInfo);

    const baseNameKey = fileName.toLowerCase();
    const existing = byBaseName.get(baseNameKey) || [];
    existing.push(fileInfo);
    byBaseName.set(baseNameKey, existing);

    logInfo(`file found: ${relativePath}`, {
      size: fileInfo.size,
      categoryHint: fileInfo.categoryHint || 'unresolved',
    });
  }

  return { byAbsolute, byRelative, byBaseName };
};

const resolveLocalPathFromReference = (rawValue: string, fileIndex: LocalFileIndex): string | undefined => {
  const value = String(rawValue || '').trim();
  if (!value) {
    return undefined;
  }

  const normalizedValue = normalizeSlashes(value);
  const candidatePaths = new Set<string>();

  if (path.isAbsolute(value)) {
    candidatePaths.add(value);
  }

  if (normalizedValue.startsWith('/uploads/')) {
    candidatePaths.add(path.join(UPLOADS_ROOT, normalizedValue.slice('/uploads/'.length)));
  }

  if (normalizedValue.startsWith('uploads/')) {
    candidatePaths.add(path.join(PROJECT_ROOT, normalizedValue));
  }

  if (normalizedValue.startsWith('./uploads/')) {
    candidatePaths.add(path.join(PROJECT_ROOT, normalizedValue.slice(2)));
  }

  const uploadsMarker = '/uploads/';
  const markerIndex = normalizedValue.toLowerCase().indexOf(uploadsMarker);
  if (markerIndex >= 0) {
    const trailing = normalizedValue.slice(markerIndex + uploadsMarker.length);
    candidatePaths.add(path.join(UPLOADS_ROOT, trailing));
  }

  const fileName = path.basename(normalizedValue);
  if (fileName && fileName !== '/' && fileName !== '.') {
    candidatePaths.add(path.join(UPLOADS_ROOT, fileName));
  }

  for (const candidatePath of candidatePaths) {
    const normalizedCandidate = normalizeAbsoluteKey(candidatePath);
    const byAbsoluteMatch = fileIndex.byAbsolute.get(normalizedCandidate);
    if (byAbsoluteMatch) {
      return byAbsoluteMatch.absolutePath;
    }

    const relativeCandidate = normalizeSlashes(path.relative(UPLOADS_ROOT, candidatePath));
    if (!relativeCandidate.startsWith('..')) {
      const byRelativeMatch = fileIndex.byRelative.get(relativeCandidate.toLowerCase());
      if (byRelativeMatch) {
        return byRelativeMatch.absolutePath;
      }
    }
  }

  const baseNameMatches = fileIndex.byBaseName.get(fileName.toLowerCase());
  if (baseNameMatches && baseNameMatches.length === 1) {
    return baseNameMatches[0].absolutePath;
  }

  if (baseNameMatches && baseNameMatches.length > 1) {
    logWarn(`multiple local file candidates found for reference "${value}"; skipping automatic match.`);
    return undefined;
  }

  return undefined;
};

const isLikelyLegacyLocalReference = (value: string, fileIndex: LocalFileIndex): boolean => {
  const normalized = normalizeSlashes(String(value || '').trim());
  if (!normalized || normalized === '#') {
    return false;
  }

  if (isCloudUrl(normalized) || normalized.startsWith('blob:') || normalized.startsWith('data:')) {
    return false;
  }

  if (
    normalized.startsWith('/uploads/')
    || normalized.startsWith('uploads/')
    || normalized.startsWith('./uploads/')
    || normalized.toLowerCase().includes('/uploads/')
  ) {
    return true;
  }

  if (path.isAbsolute(normalized) && normalized.toLowerCase().includes('/uploads/')) {
    return true;
  }

  const baseName = path.basename(normalized).toLowerCase();
  if (!baseName || baseName === '.' || baseName === '/') {
    return false;
  }

  if (fileIndex.byBaseName.has(baseName)) {
    return true;
  }

  return PREFIX_CATEGORY_MAP.some((entry) => entry.prefixes.some((prefix) => baseName.startsWith(prefix)));
};

const registerDbReference = (localPath: string) => {
  const key = normalizeAbsoluteKey(localPath);
  const currentCount = dbReferenceCountByPath.get(key) || 0;
  dbReferenceCountByPath.set(key, currentCount + 1);
  referencedLocalPaths.add(key);
};

const registerDbUpdateSuccess = (localPath: string) => {
  const key = normalizeAbsoluteKey(localPath);
  const currentCount = dbUpdatedCountByPath.get(key) || 0;
  dbUpdatedCountByPath.set(key, currentCount + 1);
};

const migrateLocalFile = async (
  localPath: string,
  fileIndex: LocalFileIndex,
  categoryHint?: UploadCategory
): Promise<MigratedFile | null> => {
  const normalizedLocalPath = normalizeAbsoluteKey(localPath);
  const cached = migratedFilesByPath.get(normalizedLocalPath);
  if (cached) {
    return cached;
  }

  const fileInfo = fileIndex.byAbsolute.get(normalizedLocalPath);
  const relativePath = fileInfo
    ? fileInfo.relativePath
    : normalizeSlashes(path.relative(UPLOADS_ROOT, localPath));

  const category = resolveCategoryFromFile(relativePath, path.basename(localPath), categoryHint);
  if (!category) {
    stats.failed += 1;
    logError(`failed item: cannot resolve category for ${relativePath}`);
    return null;
  }

  const containerName = getContainerNameForCategory(category);
  const blobName = buildDeterministicBlobName(category, relativePath);
  const mimeType = fileInfo?.mimeType || detectMimeType(path.basename(localPath));

  if (DRY_RUN) {
    stats.plannedUploads += 1;
    logInfo(`[dry-run] would upload ${relativePath}`, {
      category,
      containerName,
      blobName,
    });

    const simulatedResult: MigratedFile = {
      localPath,
      relativePath,
      category,
      containerName,
      blobName,
      blobUrl: '(dry-run)',
      mimeType,
      size: fileInfo?.size || 0,
      uploaded: false,
    };

    migratedFilesByPath.set(normalizedLocalPath, simulatedResult);
    return simulatedResult;
  }

  const localFileExists = await fileExists(localPath);

  if (!localFileExists) {
    const existingBlob = await blobExists(blobName, containerName);
    if (!existingBlob) {
      stats.failed += 1;
      logError(`failed item: missing local file and no existing blob for ${relativePath}`, {
        blobName,
        containerName,
      });
      return null;
    }

    const blobUrl = await getBlobUrl(blobName, containerName);
    const result: MigratedFile = {
      localPath,
      relativePath,
      category,
      containerName,
      blobName,
      blobUrl,
      mimeType,
      size: fileInfo?.size || 0,
      uploaded: false,
    };

    migratedFilesByPath.set(normalizedLocalPath, result);
    stats.skipped += 1;
    logInfo(`skipped item: local file already removed and blob exists for ${relativePath}`, {
      blobName,
      blobUrl,
    });
    return result;
  }

  const fileBuffer = await fs.readFile(localPath);
  const ensured = await ensureSmallFileUploaded(
    fileBuffer,
    path.basename(localPath),
    containerName,
    blobName,
    mimeType,
    { skipIfExists: true }
  );

  const result: MigratedFile = {
    localPath,
    relativePath,
    category,
    containerName,
    blobName: ensured.blobName,
    blobUrl: ensured.blobUrl,
    mimeType,
    size: fileBuffer.length,
    uploaded: ensured.uploaded,
  };

  migratedFilesByPath.set(normalizedLocalPath, result);

  if (ensured.uploaded) {
    stats.uploaded += 1;
    logInfo(`upload success: ${relativePath}`, {
      blobName: ensured.blobName,
      blobUrl: ensured.blobUrl,
      containerName,
    });
  } else {
    stats.skipped += 1;
    logInfo(`skipped item: blob already exists for ${relativePath}`, {
      blobName: ensured.blobName,
      blobUrl: ensured.blobUrl,
      containerName,
    });
  }

  return result;
};

const migrateUserAvatars = async (fileIndex: LocalFileIndex) => {
  const users = await User.find({}, { avatar: 1, avatarBlobName: 1, avatarMimeType: 1, avatarSize: 1 }).lean();

  for (const user of users) {
    const avatarValue = String((user as any).avatar || '').trim();
    if (!avatarValue) {
      continue;
    }

    if (isCloudUrl(avatarValue)) {
      stats.skipped += 1;
      continue;
    }

    if (!isLikelyLegacyLocalReference(avatarValue, fileIndex)) {
      stats.skipped += 1;
      continue;
    }

    const localPath = resolveLocalPathFromReference(avatarValue, fileIndex);
    if (!localPath) {
      stats.failed += 1;
      logError(`failed item: could not resolve local avatar reference for user ${(user as any)._id}`, {
        avatarValue,
      });
      continue;
    }

    registerDbReference(localPath);
    const migration = await migrateLocalFile(localPath, fileIndex, 'profile-images');
    if (!migration) {
      continue;
    }

    if (DRY_RUN) {
      stats.plannedUpdates += 1;
      logInfo(`[dry-run] would update user avatar ${(user as any)._id}`, {
        from: avatarValue,
        to: migration.blobUrl,
      });
      continue;
    }

    const updatePayload: Record<string, unknown> = {
      avatar: migration.blobUrl,
      avatarBlobName: migration.blobName,
      avatarMimeType: migration.mimeType,
      avatarSize: migration.size,
    };

    const updateResult = await User.updateOne(
      { _id: (user as any)._id, avatar: avatarValue },
      { $set: updatePayload }
    );

    if (updateResult.modifiedCount > 0) {
      stats.updated += 1;
      registerDbUpdateSuccess(localPath);
      logInfo(`db update success: user avatar ${(user as any)._id}`, updatePayload);
    } else {
      stats.skipped += 1;
      logWarn(`skipped item: user avatar was not updated for ${(user as any)._id}`);
    }
  }
};

const migrateTutorAvatars = async (fileIndex: LocalFileIndex) => {
  const tutors = await Tutor.find({}, { avatar: 1 }).lean();

  for (const tutor of tutors) {
    const avatarValue = String((tutor as any).avatar || '').trim();
    if (!avatarValue) {
      continue;
    }

    if (isCloudUrl(avatarValue)) {
      stats.skipped += 1;
      continue;
    }

    if (!isLikelyLegacyLocalReference(avatarValue, fileIndex)) {
      stats.skipped += 1;
      continue;
    }

    const localPath = resolveLocalPathFromReference(avatarValue, fileIndex);
    if (!localPath) {
      stats.failed += 1;
      logError(`failed item: could not resolve local tutor avatar reference for tutor ${(tutor as any)._id}`, {
        avatarValue,
      });
      continue;
    }

    registerDbReference(localPath);
    const migration = await migrateLocalFile(localPath, fileIndex, 'profile-images');
    if (!migration) {
      continue;
    }

    if (DRY_RUN) {
      stats.plannedUpdates += 1;
      logInfo(`[dry-run] would update tutor avatar ${(tutor as any)._id}`, {
        from: avatarValue,
        to: migration.blobUrl,
      });
      continue;
    }

    const updateResult = await Tutor.updateOne(
      { _id: (tutor as any)._id, avatar: avatarValue },
      { $set: { avatar: migration.blobUrl } }
    );

    if (updateResult.modifiedCount > 0) {
      stats.updated += 1;
      registerDbUpdateSuccess(localPath);
      logInfo(`db update success: tutor avatar ${(tutor as any)._id}`, {
        avatar: migration.blobUrl,
      });
    } else {
      stats.skipped += 1;
      logWarn(`skipped item: tutor avatar was not updated for ${(tutor as any)._id}`);
    }
  }
};

const migrateCourses = async (fileIndex: LocalFileIndex) => {
  const courses = await Course.find({}, {
    thumbnail: 1,
    thumbnailBlobName: 1,
    thumbnailMimeType: 1,
    thumbnailSize: 1,
    modules: 1,
  }).lean();

  for (const course of courses) {
    const updatePayload: Record<string, unknown> = {};
    const localPathsUpdatedInCourse = new Set<string>();

    const thumbnailValue = String((course as any).thumbnail || '').trim();
    if (thumbnailValue && !isCloudUrl(thumbnailValue)) {
      if (!isLikelyLegacyLocalReference(thumbnailValue, fileIndex)) {
        stats.skipped += 1;
      } else {
      const localThumbnailPath = resolveLocalPathFromReference(thumbnailValue, fileIndex);
      if (!localThumbnailPath) {
        stats.failed += 1;
        logError(`failed item: could not resolve local course thumbnail for course ${(course as any)._id}`, {
          thumbnailValue,
        });
      } else {
        registerDbReference(localThumbnailPath);
        const thumbnailMigration = await migrateLocalFile(localThumbnailPath, fileIndex, 'course-thumbnails');
        if (thumbnailMigration) {
          updatePayload.thumbnail = thumbnailMigration.blobUrl;
          updatePayload.thumbnailBlobName = thumbnailMigration.blobName;
          updatePayload.thumbnailMimeType = thumbnailMigration.mimeType;
          updatePayload.thumbnailSize = thumbnailMigration.size;
          localPathsUpdatedInCourse.add(localThumbnailPath);
        }
      }
      }
    }

    const originalModules = Array.isArray((course as any).modules)
      ? (course as any).modules
      : [];
    const nextModules = JSON.parse(JSON.stringify(originalModules));
    let modulesChanged = false;

    for (let moduleIndex = 0; moduleIndex < nextModules.length; moduleIndex += 1) {
      const moduleItem = nextModules[moduleIndex];
      if (!moduleItem || typeof moduleItem !== 'object') {
        continue;
      }

      const videoUrlValue = String(moduleItem.videoUrl || '').trim();
      if (videoUrlValue && !isCloudUrl(videoUrlValue)) {
        if (!isLikelyLegacyLocalReference(videoUrlValue, fileIndex)) {
          stats.skipped += 1;
        } else {
        const localVideoPath = resolveLocalPathFromReference(videoUrlValue, fileIndex);
        if (!localVideoPath) {
          stats.failed += 1;
          logError(
            `failed item: could not resolve local module video for course ${(course as any)._id} module ${moduleIndex}`,
            { videoUrlValue }
          );
        } else {
          registerDbReference(localVideoPath);
          const videoMigration = await migrateLocalFile(localVideoPath, fileIndex, 'videos');
          if (videoMigration) {
            moduleItem.videoUrl = videoMigration.blobUrl;
            moduleItem.videoBlobName = videoMigration.blobName;
            moduleItem.videoMimeType = videoMigration.mimeType;
            moduleItem.videoSize = videoMigration.size;
            modulesChanged = true;
            localPathsUpdatedInCourse.add(localVideoPath);
          }
        }
        }
      }

      const moduleResources = Array.isArray(moduleItem.resources) ? moduleItem.resources : [];
      for (let resourceIndex = 0; resourceIndex < moduleResources.length; resourceIndex += 1) {
        const resourceItem = moduleResources[resourceIndex];

        if (typeof resourceItem === 'string') {
          const resourceValue = resourceItem.trim();
          if (!resourceValue || isCloudUrl(resourceValue)) {
            continue;
          }

          if (!isLikelyLegacyLocalReference(resourceValue, fileIndex)) {
            stats.skipped += 1;
            continue;
          }

          const localResourcePath = resolveLocalPathFromReference(resourceValue, fileIndex);
          if (!localResourcePath) {
            stats.failed += 1;
            logError(
              `failed item: could not resolve local course module resource string for course ${(course as any)._id}, module ${moduleIndex}, resource ${resourceIndex}`,
              { resourceValue }
            );
            continue;
          }

          registerDbReference(localResourcePath);
          const resourceMigration = await migrateLocalFile(localResourcePath, fileIndex, 'resources');
          if (!resourceMigration) {
            continue;
          }

          moduleResources[resourceIndex] = resourceMigration.blobUrl;
          modulesChanged = true;
          localPathsUpdatedInCourse.add(localResourcePath);
          continue;
        }

        if (!resourceItem || typeof resourceItem !== 'object') {
          continue;
        }

        const resourceUrlValue = String(resourceItem.url || resourceItem.path || '').trim();
        if (!resourceUrlValue || isCloudUrl(resourceUrlValue)) {
          continue;
        }

        if (!isLikelyLegacyLocalReference(resourceUrlValue, fileIndex)) {
          stats.skipped += 1;
          continue;
        }

        const localResourcePath = resolveLocalPathFromReference(resourceUrlValue, fileIndex);
        if (!localResourcePath) {
          stats.failed += 1;
          logError(
            `failed item: could not resolve local course module resource object for course ${(course as any)._id}, module ${moduleIndex}, resource ${resourceIndex}`,
            { resourceUrlValue }
          );
          continue;
        }

        registerDbReference(localResourcePath);
        const resourceMigration = await migrateLocalFile(localResourcePath, fileIndex, 'resources');
        if (!resourceMigration) {
          continue;
        }

        resourceItem.url = resourceMigration.blobUrl;
        resourceItem.blobName = resourceMigration.blobName;
        resourceItem.mimeType = resourceMigration.mimeType;
        resourceItem.size = resourceMigration.size;

        if (typeof resourceItem.path === 'string' && !isCloudUrl(resourceItem.path)) {
          resourceItem.path = resourceMigration.blobUrl;
        }

        modulesChanged = true;
        localPathsUpdatedInCourse.add(localResourcePath);
      }
    }

    if (modulesChanged) {
      updatePayload.modules = nextModules;
    }

    if (Object.keys(updatePayload).length === 0) {
      continue;
    }

    if (DRY_RUN) {
      stats.plannedUpdates += 1;
      logInfo(`[dry-run] would update course ${(course as any)._id}`, updatePayload);
      continue;
    }

    const updateResult = await Course.updateOne({ _id: (course as any)._id }, { $set: updatePayload });
    if (updateResult.modifiedCount > 0) {
      stats.updated += 1;
      localPathsUpdatedInCourse.forEach((localPath) => registerDbUpdateSuccess(localPath));
      logInfo(`db update success: course ${(course as any)._id}`);
    } else {
      stats.skipped += 1;
      logWarn(`skipped item: no course changes persisted for ${(course as any)._id}`);
    }
  }
};

const migrateResources = async (fileIndex: LocalFileIndex) => {
  const resources = await Resource.find({}, { url: 1, blobName: 1, mimeType: 1, size: 1 }).lean();

  for (const resource of resources) {
    const urlValue = String((resource as any).url || '').trim();
    if (!urlValue) {
      continue;
    }

    if (isCloudUrl(urlValue)) {
      stats.skipped += 1;
      continue;
    }

    if (!isLikelyLegacyLocalReference(urlValue, fileIndex)) {
      stats.skipped += 1;
      continue;
    }

    const localResourcePath = resolveLocalPathFromReference(urlValue, fileIndex);
    if (!localResourcePath) {
      stats.failed += 1;
      logError(`failed item: could not resolve local resource URL for resource ${(resource as any)._id}`, {
        urlValue,
      });
      continue;
    }

    registerDbReference(localResourcePath);
    const migration = await migrateLocalFile(localResourcePath, fileIndex, 'resources');
    if (!migration) {
      continue;
    }

    const updatePayload = {
      url: migration.blobUrl,
      blobName: migration.blobName,
      mimeType: migration.mimeType,
      size: migration.size,
    };

    if (DRY_RUN) {
      stats.plannedUpdates += 1;
      logInfo(`[dry-run] would update resource ${(resource as any)._id}`, updatePayload);
      continue;
    }

    const updateResult = await Resource.updateOne(
      { _id: (resource as any)._id, url: urlValue },
      { $set: updatePayload }
    );

    if (updateResult.modifiedCount > 0) {
      stats.updated += 1;
      registerDbUpdateSuccess(localResourcePath);
      logInfo(`db update success: resource ${(resource as any)._id}`, updatePayload);
    } else {
      stats.skipped += 1;
      logWarn(`skipped item: resource URL was not updated for ${(resource as any)._id}`);
    }
  }
};

const migrateOrphanLocalFiles = async (localFiles: LocalFileInfo[], fileIndex: LocalFileIndex) => {
  for (const fileInfo of localFiles) {
    const normalizedPath = normalizeAbsoluteKey(fileInfo.absolutePath);
    if (referencedLocalPaths.has(normalizedPath)) {
      continue;
    }

    const migration = await migrateLocalFile(fileInfo.absolutePath, fileIndex, fileInfo.categoryHint);
    if (!migration) {
      continue;
    }

    logInfo(`orphan file migrated to Azure: ${fileInfo.relativePath}`, {
      blobName: migration.blobName,
      containerName: migration.containerName,
    });
  }
};

const removeEmptyDirectories = async (rootDir: string): Promise<void> => {
  const walk = async (currentDir: string): Promise<boolean> => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    let isEmpty = true;
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const childIsEmpty = await walk(entryPath);
        if (childIsEmpty) {
          await fs.rmdir(entryPath);
        } else {
          isEmpty = false;
        }
      } else {
        isEmpty = false;
      }
    }

    return isEmpty;
  };

  if (!(await fileExists(rootDir))) {
    return;
  }

  const rootIsEmpty = await walk(rootDir);
  if (rootIsEmpty) {
    await fs.rmdir(rootDir);
    logInfo('removed empty uploads root directory after migration cleanup.');
  }
};

const cleanupLocalFiles = async (localFiles: LocalFileInfo[]) => {
  if (!CLEANUP_LOCAL) {
    logInfo('local cleanup is disabled for this run.');
    return;
  }

  for (const fileInfo of localFiles) {
    const normalizedPath = normalizeAbsoluteKey(fileInfo.absolutePath);
    const migration = migratedFilesByPath.get(normalizedPath);
    if (!migration) {
      stats.failed += 1;
      logError(`failed item: no Azure migration result found for ${fileInfo.relativePath}; local file kept.`);
      continue;
    }

    const requiredDbUpdates = dbReferenceCountByPath.get(normalizedPath) || 0;
    const successfulDbUpdates = dbUpdatedCountByPath.get(normalizedPath) || 0;

    if (requiredDbUpdates > successfulDbUpdates) {
      stats.failed += 1;
      logError(`failed item: not all DB references were updated for ${fileInfo.relativePath}; local file kept.`, {
        requiredDbUpdates,
        successfulDbUpdates,
      });
      continue;
    }

    if (DRY_RUN) {
      stats.plannedDeletes += 1;
      logInfo(`[dry-run] would delete local file ${fileInfo.relativePath}`);
      continue;
    }

    if (!(await fileExists(fileInfo.absolutePath))) {
      stats.skipped += 1;
      continue;
    }

    await fs.unlink(fileInfo.absolutePath);
    stats.deleted += 1;
    logInfo(`deleted local file: ${fileInfo.relativePath}`);
  }

  await removeEmptyDirectories(UPLOADS_ROOT);
};

const printSummary = async () => {
  const remainingFiles = await collectFilesRecursive(UPLOADS_ROOT);

  logInfo('migration summary', {
    totalFound: stats.totalFound,
    uploaded: stats.uploaded,
    updated: stats.updated,
    skipped: stats.skipped,
    failed: stats.failed,
    deleted: stats.deleted,
    dryRun: DRY_RUN,
    plannedUploads: stats.plannedUploads,
    plannedUpdates: stats.plannedUpdates,
    plannedDeletes: stats.plannedDeletes,
    cleanupEnabled: CLEANUP_LOCAL,
    remainingLocalFiles: remainingFiles.length,
  });

  if (remainingFiles.length > 0) {
    logWarn('local upload files still present after migration run.', {
      remainingFiles: remainingFiles.map((filePath) => normalizeSlashes(path.relative(PROJECT_ROOT, filePath))),
    });

    if (!DRY_RUN && CLEANUP_LOCAL) {
      stats.failed += remainingFiles.length;
    }
  }

  if (stats.failed > 0) {
    process.exitCode = 1;
  }
};

const runMigration = async () => {
  logInfo('starting uploads migration to Azure Blob Storage', {
    dryRun: DRY_RUN,
    keepLocal: KEEP_LOCAL,
    cleanupLocal: CLEANUP_LOCAL,
  });

  if (!DRY_RUN) {
    const missingAzureVars = Object.values(CATEGORY_ENV_MAP)
      .concat('AZURE_STORAGE_CONNECTION_STRING')
      .filter((envKey) => !String(process.env[envKey] || '').trim());

    if (missingAzureVars.length > 0) {
      throw new Error(`Missing required Azure environment variables: ${missingAzureVars.join(', ')}`);
    }
  }

  await connectDB();

  const localFilePaths = await collectFilesRecursive(UPLOADS_ROOT);
  stats.totalFound = localFilePaths.length;

  if (localFilePaths.length === 0) {
    logInfo('no local upload files found; only checking DB for legacy local references.');
  }

  const fileIndex = await buildLocalFileIndex(localFilePaths);
  const localFiles = Array.from(fileIndex.byAbsolute.values());

  await migrateUserAvatars(fileIndex);
  await migrateTutorAvatars(fileIndex);
  await migrateCourses(fileIndex);
  await migrateResources(fileIndex);
  await migrateOrphanLocalFiles(localFiles, fileIndex);
  await cleanupLocalFiles(localFiles);

  await printSummary();
};

async function main() {
  dotenv.config({ quiet: true });

  try {
    await runMigration();
  } catch (error) {
    stats.failed += 1;
    logError('migration crashed with an unrecoverable error.', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

void main();
