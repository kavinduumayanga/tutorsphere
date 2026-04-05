import { Request, Response } from 'express';
import { PasswordResetOtp } from '../../models/PasswordResetOtp.js';
import { User } from '../../models/User.js';
import {
  createResetSessionToken,
  generateNumericOtp,
  getOtpExpiryMinutes,
  hashOtp,
  hashResetSessionToken,
  verifyOtp,
  verifyResetSessionToken,
} from './otpUtils.js';
import { sendPasswordResetOtpEmail } from './emailService.js';
import { hashPassword, validatePasswordStrength } from './passwordUtils.js';

const OTP_LENGTH = 6;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const RESET_TOKEN_EXPIRY_MINUTES = 15;
const MAX_OTP_VERIFY_ATTEMPTS = 5;
const GENERIC_FORGOT_RESPONSE_MESSAGE =
  'If an account with that email exists, a verification code has been sent.';

const createEntityId = (): string => Math.random().toString(36).substr(2, 9);

const escapeRegex = (value: string): string => {
  return value.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

const normalizeEmail = (value: unknown): string => {
  return String(value || '').trim().toLowerCase();
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const genericForgotResponse = () => ({
  message: GENERIC_FORGOT_RESPONSE_MESSAGE,
  cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
  otpExpiryMinutes: getOtpExpiryMinutes(),
});

const findUserByEmail = async (email: string) => {
  const escapedEmail = escapeRegex(email);
  return User.findOne({ email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } });
};

const replaceOpenOtpRequests = async (email: string, excludeMongoId?: string): Promise<void> => {
  const filter: Record<string, any> = {
    email,
    usedAt: null,
    replacedAt: null,
  };

  if (excludeMongoId) {
    filter._id = { $ne: excludeMongoId };
  }

  await PasswordResetOtp.updateMany(filter, { $set: { replacedAt: new Date() } });
};

const issueAndSendOtp = async (email: string, userId: string): Promise<void> => {
  const now = new Date();
  const otpExpiryMinutes = getOtpExpiryMinutes();
  const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
  const otpCode = generateNumericOtp(OTP_LENGTH);
  const otpHash = await hashOtp(otpCode);

  await replaceOpenOtpRequests(email);

  const otpRequest = await PasswordResetOtp.create({
    id: createEntityId(),
    userId,
    email,
    otpHash,
    expiresAt,
    failedAttempts: 0,
    lastSentAt: now,
  });

  try {
    await sendPasswordResetOtpEmail({
      to: email,
      otpCode,
      expiryMinutes: otpExpiryMinutes,
    });
  } catch (error) {
    console.error('Failed to send password reset OTP email:', error);
    await PasswordResetOtp.updateOne(
      { _id: otpRequest._id },
      { $set: { replacedAt: new Date() } }
    );
  }
};

const requestPasswordResetInternal = async (req: Request, res: Response): Promise<Response> => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return res.json(genericForgotResponse());
    }

    const openRequest = await PasswordResetOtp.findOne({
      email,
      usedAt: null,
      replacedAt: null,
    }).sort({ createdAt: -1 });

    if (openRequest?.lastSentAt) {
      const elapsedMs = Date.now() - new Date(openRequest.lastSentAt).getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return res.json(genericForgotResponse());
      }
    }

    await issueAndSendOtp(email, user.id);

    return res.json(genericForgotResponse());
  } catch (error) {
    console.error('Forgot password request error:', error);
    return res.json(genericForgotResponse());
  }
};

export const requestPasswordResetOtp = async (req: Request, res: Response): Promise<Response> => {
  return requestPasswordResetInternal(req, res);
};

export const resendPasswordResetOtp = async (req: Request, res: Response): Promise<Response> => {
  return requestPasswordResetInternal(req, res);
};

export const verifyPasswordResetOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || '').trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Please enter the 6-digit OTP code.' });
    }

    const otpRequest = await PasswordResetOtp.findOne({
      email,
      usedAt: null,
      replacedAt: null,
    }).sort({ createdAt: -1 });

    if (!otpRequest) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Request a new code.' });
    }

    if (otpRequest.verifiedAt) {
      return res.status(400).json({ error: 'OTP is already verified. Request a new code if needed.' });
    }

    if (otpRequest.expiresAt.getTime() < Date.now()) {
      otpRequest.replacedAt = new Date();
      await otpRequest.save();
      return res.status(400).json({ error: 'OTP has expired. Request a new code.' });
    }

    if (otpRequest.failedAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      otpRequest.replacedAt = new Date();
      await otpRequest.save();
      return res.status(429).json({ error: 'Too many failed attempts. Request a new OTP.' });
    }

    const isOtpValid = await verifyOtp(otp, otpRequest.otpHash);

    if (!isOtpValid) {
      otpRequest.failedAttempts += 1;
      if (otpRequest.failedAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        otpRequest.replacedAt = new Date();
      }
      await otpRequest.save();
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }

    const resetToken = createResetSessionToken();
    const resetTokenHash = await hashResetSessionToken(resetToken);

    otpRequest.verifiedAt = new Date();
    otpRequest.failedAttempts = 0;
    otpRequest.resetTokenHash = resetTokenHash;
    otpRequest.resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    await otpRequest.save();

    return res.json({
      message: 'OTP verified successfully.',
      resetToken,
      resetTokenExpiryMinutes: RESET_TOKEN_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  }
};

export const resetPasswordWithOtp = async (req: Request, res: Response): Promise<Response> => {
  try {
    const email = normalizeEmail(req.body?.email);
    const resetToken = String(req.body?.resetToken || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (!resetToken) {
      return res.status(400).json({ error: 'Reset token is required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const passwordStrengthError = validatePasswordStrength(newPassword);
    if (passwordStrengthError) {
      return res.status(400).json({ error: passwordStrengthError });
    }

    const otpRequest = await PasswordResetOtp.findOne({
      email,
      usedAt: null,
      replacedAt: null,
      verifiedAt: { $ne: null },
      resetTokenHash: { $exists: true, $ne: null },
    }).sort({ verifiedAt: -1, createdAt: -1 });

    if (!otpRequest) {
      return res.status(400).json({ error: 'OTP verification is required before resetting password.' });
    }

    if (!otpRequest.resetTokenExpiresAt || otpRequest.resetTokenExpiresAt.getTime() < Date.now()) {
      otpRequest.replacedAt = new Date();
      await otpRequest.save();
      return res.status(400).json({ error: 'Reset session has expired. Request a new OTP.' });
    }

    const tokenValid = await verifyResetSessionToken(resetToken, otpRequest.resetTokenHash || '');
    if (!tokenValid) {
      return res.status(400).json({ error: 'Invalid reset session. Verify OTP again.' });
    }

    const user = await User.findOne({ id: otpRequest.userId });
    if (!user) {
      return res.status(400).json({ error: 'Unable to reset password. Request a new OTP.' });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    otpRequest.usedAt = new Date();
    otpRequest.resetTokenHash = undefined;
    otpRequest.resetTokenExpiresAt = undefined;
    await otpRequest.save();

    await replaceOpenOtpRequests(email, String(otpRequest._id));

    return res.json({ message: 'Password has been reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  }
};
