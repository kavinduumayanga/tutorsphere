import express from 'express';
import {
  requestPasswordResetOtp,
  resendPasswordResetOtp,
  resetPasswordWithOtp,
  verifyPasswordResetOtp,
} from './authController.js';

const router = express.Router();

router.post('/forgot-password', requestPasswordResetOtp);
router.post('/resend-otp', resendPasswordResetOtp);
router.post('/verify-otp', verifyPasswordResetOtp);
router.post('/reset-password', resetPasswordWithOtp);

export const authRouter = router;
