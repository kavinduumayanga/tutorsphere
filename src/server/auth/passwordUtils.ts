import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(nodeScrypt);
const SCRYPT_KEY_LENGTH = 64;
const HASH_PREFIX = 'scrypt';

export const isPasswordHash = (value: string): boolean => {
  return typeof value === 'string' && value.startsWith(`${HASH_PREFIX}$`);
};

export const shouldUpgradePasswordHash = (storedPassword: string): boolean => {
  return !isPasswordHash(storedPassword);
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `${HASH_PREFIX}$${salt}$${derivedKey.toString('hex')}`;
};

const verifyScryptHash = async (plainPassword: string, storedHash: string): Promise<boolean> => {
  const segments = storedHash.split('$');
  if (segments.length !== 3) {
    return false;
  }

  const [, salt, expectedHashHex] = segments;
  if (!salt || !expectedHashHex) {
    return false;
  }

  const expectedHash = Buffer.from(expectedHashHex, 'hex');
  const computedHash = (await scrypt(plainPassword, salt, SCRYPT_KEY_LENGTH)) as Buffer;

  if (expectedHash.length !== computedHash.length) {
    return false;
  }

  return timingSafeEqual(expectedHash, computedHash);
};

export const verifyPassword = async (plainPassword: string, storedPassword: string): Promise<boolean> => {
  if (!storedPassword) {
    return false;
  }

  if (isPasswordHash(storedPassword)) {
    return verifyScryptHash(plainPassword, storedPassword);
  }

  return plainPassword === storedPassword;
};

export const validatePasswordStrength = (password: string): string | null => {
  if (typeof password !== 'string' || password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (!/[a-z]/.test(password)) {
    return 'Password must include at least one lowercase letter.';
  }

  if (!/[A-Z]/.test(password)) {
    return 'Password must include at least one uppercase letter.';
  }

  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Password must include at least one special character.';
  }

  return null;
};
