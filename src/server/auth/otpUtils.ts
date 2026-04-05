import { randomBytes, randomInt, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(nodeScrypt);
const HASH_PREFIX = 'scryptv1';
const SECRET_KEY_LENGTH = 64;
const DEFAULT_OTP_EXPIRY_MINUTES = 10;

const hashSecret = async (value: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(value, salt, SECRET_KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
};

const verifySecret = async (value: string, storedHash: string): Promise<boolean> => {
  if (!storedHash || !storedHash.startsWith(`${HASH_PREFIX}$`)) {
    return false;
  }

  const segments = storedHash.split('$');
  if (segments.length !== 3) {
    return false;
  }

  const [, salt, expectedHashHex] = segments;
  if (!salt || !expectedHashHex) {
    return false;
  }

  const expectedHash = Buffer.from(expectedHashHex, 'hex');
  const computedHash = (await scrypt(value, salt, SECRET_KEY_LENGTH)) as Buffer;

  if (expectedHash.length !== computedHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, computedHash);
};

export const generateNumericOtp = (digits = 6): string => {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, '0');
};

export const hashOtp = async (otp: string): Promise<string> => {
  return hashSecret(otp);
};

export const verifyOtp = async (otp: string, storedHash: string): Promise<boolean> => {
  return verifySecret(otp, storedHash);
};

export const createResetSessionToken = (): string => {
  return randomBytes(32).toString('hex');
};

export const hashResetSessionToken = async (token: string): Promise<string> => {
  return hashSecret(token);
};

export const verifyResetSessionToken = async (token: string, storedHash: string): Promise<boolean> => {
  return verifySecret(token, storedHash);
};

export const getOtpExpiryMinutes = (): number => {
  const raw = Number(process.env.OTP_EXPIRY_MINUTES);
  if (!Number.isFinite(raw)) {
    return DEFAULT_OTP_EXPIRY_MINUTES;
  }

  const parsed = Math.floor(raw);
  if (parsed < 1) {
    return 1;
  }

  if (parsed > 30) {
    return 30;
  }

  return parsed;
};
