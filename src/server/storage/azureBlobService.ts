import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import path from 'path';
import crypto from 'crypto';

export type AzureUploadedFile = {
  blobUrl: string;
  blobName: string;
};

let cachedBlobServiceClient: BlobServiceClient | null = null;

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

export const uploadFile = async (
  fileBuffer: Buffer,
  fileName: string,
  containerName: string,
  mimeType?: string
): Promise<AzureUploadedFile> => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Cannot upload an empty file.');
  }

  const blobName = buildUniqueBlobName(fileName || 'file');
  const blockBlobClient = await getBlockBlobClient(containerName, blobName);

  await blockBlobClient.uploadData(fileBuffer, {
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

export const replaceFile = async (
  oldBlobName: string | undefined,
  newFileBuffer: Buffer,
  newFileName: string,
  containerName: string,
  mimeType?: string
): Promise<AzureUploadedFile> => {
  const uploaded = await uploadFile(newFileBuffer, newFileName, containerName, mimeType);

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
