import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { Readable } from 'stream';

export type AzureUploadedFile = {
  blobUrl: string;
  blobName: string;
};

export type EnsureSmallUploadOptions = {
  skipIfExists?: boolean;
};

export type EnsuredAzureUpload = AzureUploadedFile & {
  uploaded: boolean;
};

export type LargeUploadOptions = {
  blockSizeBytes?: number;
  maxConcurrency?: number;
};

type ImageOutputFormat = 'jpeg' | 'png' | 'webp';

export type ImageOptimizationOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
  outputFormat?: ImageOutputFormat;
};

export type OptimizedImageResult = {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  size: number;
};

const MB = 1024 * 1024;
const DEFAULT_BLOCK_SIZE_BYTES = 8 * MB;
const DEFAULT_MAX_CONCURRENCY = 5;
const DEFAULT_IMAGE_QUALITY = 82;

let cachedBlobServiceClient: BlobServiceClient | null = null;

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

const resolveLargeUploadOptions = (options?: LargeUploadOptions) => {
  const envBlockSizeMb = toSafePositiveInteger(
    process.env.AZURE_BLOB_LARGE_UPLOAD_BLOCK_SIZE_MB,
    DEFAULT_BLOCK_SIZE_BYTES / MB,
    1,
    100
  );
  const envConcurrency = toSafePositiveInteger(
    process.env.AZURE_BLOB_LARGE_UPLOAD_CONCURRENCY,
    DEFAULT_MAX_CONCURRENCY,
    1,
    32
  );

  const blockSizeBytes = toSafePositiveInteger(options?.blockSizeBytes, envBlockSizeMb * MB, 1 * MB, 100 * MB);
  const maxConcurrency = toSafePositiveInteger(options?.maxConcurrency, envConcurrency, 1, 32);

  return {
    blockSizeBytes,
    maxConcurrency,
  };
};

export const getLargeUploadTuning = () => resolveLargeUploadOptions();

const getBlobServiceClient = (): BlobServiceClient => {
  if (cachedBlobServiceClient) {
    return cachedBlobServiceClient;
  }

  const connectionString = String(process.env.AZURE_STORAGE_CONNECTION_STRING || '').trim();
  if (!connectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING environment variable is required for Azure Blob Storage.');
  }

  cachedBlobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  return cachedBlobServiceClient;
};

const toSafeFileSegment = (value: string, fallback: string): string => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const buildUniqueBlobName = (fileName: string): string => {
  const extension = path.extname(fileName || '').toLowerCase();
  const baseName = path.basename(fileName || 'file', extension);
  const safeBase = toSafeFileSegment(baseName, 'file');
  const timestamp = Date.now();
  const suffix = crypto.randomUUID();

  return `${safeBase}-${timestamp}-${suffix}${extension}`;
};

const withFileExtension = (fileName: string, extension: string): string => {
  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const currentExtension = path.extname(fileName || '');
  if (!currentExtension) {
    return `${fileName}${normalizedExtension}`;
  }

  return `${fileName.slice(0, -currentExtension.length)}${normalizedExtension}`;
};

const resolveImageOutput = (
  mimeType: string,
  fileName: string,
  explicitFormat?: ImageOutputFormat
): { format: ImageOutputFormat; mimeType: string; extension: string } => {
  if (explicitFormat === 'png') {
    return { format: 'png', mimeType: 'image/png', extension: '.png' };
  }
  if (explicitFormat === 'webp') {
    return { format: 'webp', mimeType: 'image/webp', extension: '.webp' };
  }
  if (explicitFormat === 'jpeg') {
    return { format: 'jpeg', mimeType: 'image/jpeg', extension: '.jpg' };
  }

  const normalizedMimeType = String(mimeType || '').toLowerCase();
  if (normalizedMimeType === 'image/png') {
    return { format: 'png', mimeType: 'image/png', extension: '.png' };
  }
  if (normalizedMimeType === 'image/webp') {
    return { format: 'webp', mimeType: 'image/webp', extension: '.webp' };
  }
  if (normalizedMimeType === 'image/jpeg' || normalizedMimeType === 'image/jpg') {
    return { format: 'jpeg', mimeType: 'image/jpeg', extension: '.jpg' };
  }

  const extension = path.extname(fileName || '').toLowerCase();
  if (extension === '.png') {
    return { format: 'png', mimeType: 'image/png', extension: '.png' };
  }
  if (extension === '.webp') {
    return { format: 'webp', mimeType: 'image/webp', extension: '.webp' };
  }

  return { format: 'jpeg', mimeType: 'image/jpeg', extension: '.jpg' };
};

const getBlockBlobClient = async (containerName: string, blobName: string): Promise<BlockBlobClient> => {
  const normalizedContainerName = String(containerName || '').trim();
  if (!normalizedContainerName) {
    throw new Error('Azure Blob container name is required.');
  }

  const blobServiceClient = getBlobServiceClient();
  const containerClient = blobServiceClient.getContainerClient(normalizedContainerName);
  await containerClient.createIfNotExists();

  return containerClient.getBlockBlobClient(blobName);
};

export const uploadSmallFile = async (
  fileBuffer: Buffer,
  fileName: string,
  containerName: string,
  mimeType?: string
): Promise<AzureUploadedFile> => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Cannot upload an empty file.');
  }

  const blobName = buildUniqueBlobName(fileName || 'file');
  const uploaded = await ensureSmallFileUploaded(
    fileBuffer,
    fileName,
    containerName,
    blobName,
    mimeType,
    { skipIfExists: false }
  );

  return {
    blobName: uploaded.blobName,
    blobUrl: uploaded.blobUrl,
  };
};

// Backward-compatible alias used by existing upload flows.
export const uploadFile = uploadSmallFile;

export const uploadLargeFileStream = async (
  fileStream: Readable,
  fileName: string,
  containerName: string,
  mimeType?: string,
  options?: LargeUploadOptions
): Promise<AzureUploadedFile> => {
  if (!fileStream) {
    throw new Error('A readable file stream is required for large uploads.');
  }

  const { blockSizeBytes, maxConcurrency } = resolveLargeUploadOptions(options);
  const blobName = buildUniqueBlobName(fileName || 'file');
  const blockBlobClient = await getBlockBlobClient(containerName, blobName);

  await blockBlobClient.uploadStream(fileStream, blockSizeBytes, maxConcurrency, {
    blobHTTPHeaders: {
      blobContentType: mimeType || 'application/octet-stream',
    },
  });

  return {
    blobName,
    blobUrl: blockBlobClient.url,
  };
};

export const deleteFile = async (blobName: string, containerName: string): Promise<void> => {
  const normalizedBlobName = String(blobName || '').trim();
  if (!normalizedBlobName) {
    return;
  }

  const blockBlobClient = await getBlockBlobClient(containerName, normalizedBlobName);
  await blockBlobClient.deleteIfExists();
};

export const blobExists = async (blobName: string, containerName: string): Promise<boolean> => {
  const normalizedBlobName = String(blobName || '').trim();
  if (!normalizedBlobName) {
    return false;
  }

  const blockBlobClient = await getBlockBlobClient(containerName, normalizedBlobName);
  return blockBlobClient.exists();
};

export const getBlobUrl = async (blobName: string, containerName: string): Promise<string> => {
  const normalizedBlobName = String(blobName || '').trim();
  if (!normalizedBlobName) {
    throw new Error('Blob name is required to resolve blob URL.');
  }

  const blockBlobClient = await getBlockBlobClient(containerName, normalizedBlobName);
  return blockBlobClient.url;
};

export const ensureSmallFileUploaded = async (
  fileBuffer: Buffer,
  fileName: string,
  containerName: string,
  blobName: string,
  mimeType?: string,
  options?: EnsureSmallUploadOptions
): Promise<EnsuredAzureUpload> => {
  const normalizedBlobName = String(blobName || '').trim();
  if (!normalizedBlobName) {
    throw new Error('Blob name is required for deterministic uploads.');
  }

  const blockBlobClient = await getBlockBlobClient(containerName, normalizedBlobName);
  const shouldSkipIfExists = options?.skipIfExists ?? true;

  if (shouldSkipIfExists && (await blockBlobClient.exists())) {
    return {
      blobName: normalizedBlobName,
      blobUrl: blockBlobClient.url,
      uploaded: false,
    };
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Cannot upload an empty file.');
  }

  await blockBlobClient.uploadData(fileBuffer, {
    blobHTTPHeaders: {
      blobContentType: mimeType || 'application/octet-stream',
    },
  });

  return {
    blobName: normalizedBlobName,
    blobUrl: blockBlobClient.url,
    uploaded: true,
  };
};

export const replaceFile = async (
  oldBlobName: string | undefined,
  newFileBuffer: Buffer,
  newFileName: string,
  containerName: string,
  mimeType?: string
): Promise<AzureUploadedFile> => {
  const uploaded = await uploadSmallFile(newFileBuffer, newFileName, containerName, mimeType);

  try {
    if (oldBlobName) {
      await deleteFile(oldBlobName, containerName);
    }
  } catch (error) {
    console.warn('Failed to delete old blob after replacement:', {
      oldBlobName,
      containerName,
      error,
    });
  }

  return uploaded;
};

export const replaceFileWithStream = async (
  oldBlobName: string | undefined,
  newFileStream: Readable,
  newFileName: string,
  containerName: string,
  mimeType?: string,
  options?: LargeUploadOptions
): Promise<AzureUploadedFile> => {
  const uploaded = await uploadLargeFileStream(
    newFileStream,
    newFileName,
    containerName,
    mimeType,
    options
  );

  try {
    if (oldBlobName) {
      await deleteFile(oldBlobName, containerName);
    }
  } catch (error) {
    console.warn('Failed to delete old blob after replacement:', {
      oldBlobName,
      containerName,
      error,
    });
  }

  return uploaded;
};

export const optimizeImageBuffer = async (
  inputBuffer: Buffer,
  fileName: string,
  mimeType: string,
  options: ImageOptimizationOptions
): Promise<OptimizedImageResult> => {
  if (!inputBuffer || inputBuffer.length === 0) {
    throw new Error('Cannot optimize an empty image buffer.');
  }

  const maxWidth = toSafePositiveInteger(options.maxWidth, 1024, 1);
  const maxHeight = toSafePositiveInteger(options.maxHeight, 1024, 1);
  const quality = toSafePositiveInteger(options.quality, DEFAULT_IMAGE_QUALITY, 40, 95);
  const output = resolveImageOutput(mimeType, fileName, options.outputFormat);
  const outputFileName = withFileExtension(fileName || 'image', output.extension);

  try {
    const basePipeline = sharp(inputBuffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });

    let transformedBuffer: Buffer;
    if (output.format === 'png') {
      transformedBuffer = await basePipeline
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toBuffer();
    } else if (output.format === 'webp') {
      transformedBuffer = await basePipeline
        .webp({
          quality,
          effort: 4,
        })
        .toBuffer();
    } else {
      transformedBuffer = await basePipeline
        .jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling: '4:2:0',
        })
        .toBuffer();
    }

    return {
      buffer: transformedBuffer,
      fileName: outputFileName,
      mimeType: output.mimeType,
      size: transformedBuffer.length,
    };
  } catch (error) {
    console.warn('Image optimization failed. Falling back to original upload buffer.', {
      fileName,
      mimeType,
      error,
    });

    return {
      buffer: inputBuffer,
      fileName,
      mimeType,
      size: inputBuffer.length,
    };
  }
};

export const extractBlobNameFromUrl = (blobUrl: string | undefined, containerName: string): string | undefined => {
  const normalizedBlobUrl = String(blobUrl || '').trim();
  const normalizedContainerName = String(containerName || '').trim();

  if (!normalizedBlobUrl || !normalizedContainerName) {
    return undefined;
  }

  try {
    const parsed = new URL(normalizedBlobUrl);
    const marker = `/${normalizedContainerName}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return undefined;
    }

    const blobPath = parsed.pathname.slice(markerIndex + marker.length);
    const decoded = decodeURIComponent(blobPath).trim();
    return decoded || undefined;
  } catch {
    return undefined;
  }
};
