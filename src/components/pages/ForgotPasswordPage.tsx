import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, Lock, Mail, ShieldCheck, XCircle } from 'lucide-react';
import { apiService } from '../../services/apiService';

type ForgotPasswordStep = 'email' | 'otp' | 'reset' | 'done';
type LoadingAction = 'email' | 'otp' | 'resend' | 'reset' | null;

type ForgotPasswordPageProps = {
  onBackToHome: () => void;
  onOpenLogin: () => void;
};

const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const REDIRECT_DELAY_MS = 1800;

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const normalizeOtpValue = (value: string): string => {
  return value.replace(/[^0-9]/g, '').slice(0, 6);
};

const getPasswordStrengthMessage = (password: string): string | null => {
  if (password.length < 8) {
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

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onBackToHome,
  onOpenLogin,
}) => {
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [otpExpiryMinutes, setOtpExpiryMinutes] = useState(10);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isConfirmPasswordEntered = confirmPassword.length > 0;
  const isPasswordMatch = isConfirmPasswordEntered && newPassword === confirmPassword;

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (step !== 'done') {
      return;
    }

    const timer = window.setTimeout(() => {
      onOpenLogin();
    }, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [onOpenLogin, step]);

  const stepTitle = useMemo(() => {
    if (step === 'email') return 'Forgot Password';
    if (step === 'otp') return 'Verify OTP';
    if (step === 'reset') return 'Set New Password';
    return 'Password Updated';
  }, [step]);

  const handleRequestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setLoadingAction('email');

    try {
      const response = await apiService.requestPasswordReset(normalizedEmail);
      setEmail(normalizedEmail);
      setOtp('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpExpiryMinutes(Math.max(1, Number(response.otpExpiryMinutes || 10)));
      setResendCooldown(Math.max(0, Number(response.cooldownSeconds || DEFAULT_RESEND_COOLDOWN_SECONDS)));
      setSuccessMessage(response.message);
      setStep('otp');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to request OTP.';
      setErrorMessage(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleOtpChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOtp(normalizeOtpValue(event.target.value));
  };

  const handleOtpPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    setOtp(normalizeOtpValue(pastedText));
  };

  const handleVerifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    const normalizedOtp = normalizeOtpValue(otp);
    if (normalizedOtp !== otp) {
      setOtp(normalizedOtp);
    }

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setErrorMessage('Please enter the 6-digit OTP code.');
      return;
    }

    setLoadingAction('otp');

    try {
      const response = await apiService.verifyPasswordResetOtp(email, normalizedOtp);
      setResetToken(response.resetToken);
      setSuccessMessage(response.message || 'OTP verified successfully.');
      setStep('reset');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify OTP.';
      setErrorMessage(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loadingAction === 'resend') {
      return;
    }

    resetMessages();
    setLoadingAction('resend');

    try {
      const response = await apiService.resendPasswordResetOtp(email);
      setOtp('');
      setOtpExpiryMinutes(Math.max(1, Number(response.otpExpiryMinutes || 10)));
      setResendCooldown(Math.max(0, Number(response.cooldownSeconds || DEFAULT_RESEND_COOLDOWN_SECONDS)));
      setSuccessMessage(response.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend OTP.';
      setErrorMessage(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!resetToken) {
      setErrorMessage('Your reset session is missing. Verify OTP again.');
      setStep('otp');
      return;
    }

    const passwordStrengthMessage = getPasswordStrengthMessage(newPassword);
    if (passwordStrengthMessage) {
      setErrorMessage(passwordStrengthMessage);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirm password do not match.');
      return;
    }

    setLoadingAction('reset');

    try {
      const response = await apiService.resetPassword(email, resetToken, newPassword, confirmPassword);
      setSuccessMessage(response.message || 'Password changed successfully. Redirecting to login...');
      setStep('done');
      setOtp('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password.';
      setErrorMessage(message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-10">
      <div className="bg-white border border-slate-100 rounded-[2rem] shadow-xl shadow-slate-200/50 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 sm:px-8 py-8 text-white">
          <div className="inline-flex items-center gap-2 text-indigo-100 text-xs font-bold uppercase tracking-widest mb-3">
            <ShieldCheck className="w-4 h-4" />
            Secure Recovery
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{stepTitle}</h1>
          <p className="mt-2 text-indigo-100 text-sm">
            {step === 'email' && 'Enter your account email to receive a one-time verification code.'}
            {step === 'otp' && `Enter the OTP sent to ${email}. It expires in about ${otpExpiryMinutes} minutes.`}
            {step === 'reset' && 'Set a strong new password to secure your account.'}
            {step === 'done' && 'Your password has been updated. Taking you back to login.'}
          </p>
        </div>

        <div className="px-6 sm:px-8 py-7 sm:py-8 space-y-5">
          {errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm font-medium">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm font-medium flex items-start gap-2">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Email Address</span>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Enter your email"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loadingAction === 'email'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loadingAction === 'email' ? 'Sending OTP...' : 'Send OTP'}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} noValidate className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">One-Time Password (OTP)</span>
                <input
                  type="text"
                  value={otp}
                  onChange={handleOtpChange}
                  onPaste={handleOtpPaste}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="w-full px-4 py-3 text-center tracking-[0.4em] rounded-2xl border border-slate-200 bg-slate-50/70 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-lg font-bold"
                  placeholder="000000"
                />
              </label>

              <button
                type="submit"
                disabled={loadingAction === 'otp'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loadingAction === 'otp' ? 'Verifying OTP...' : 'Verify OTP'}
                <ArrowRight className="w-5 h-5" />
              </button>

              <div className="flex items-center justify-between gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setOtp('');
                    setResendCooldown(0);
                    resetMessages();
                  }}
                  className="text-slate-600 hover:text-slate-900 font-semibold transition-colors"
                >
                  Change Email
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0 || loadingAction === 'resend'}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  {loadingAction === 'resend'
                    ? 'Resending...'
                    : resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : 'Resend OTP'}
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                <Clock className="w-4 h-4" />
                OTPs are single-use and expire quickly for your account security.
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</span>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Enter a strong password"
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm New Password</span>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    className={`w-full pl-12 pr-4 py-3 rounded-2xl border outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 ${
                      !isConfirmPasswordEntered
                        ? 'border-slate-200 bg-slate-50/70'
                        : isPasswordMatch
                          ? 'border-emerald-300 bg-emerald-50/60'
                          : 'border-rose-300 bg-rose-50/60'
                    }`}
                    placeholder="Re-enter your new password"
                  />
                </div>
              </label>

              {isConfirmPasswordEntered && (
                <div
                  aria-live="polite"
                  className={`flex items-center gap-2 text-xs font-semibold ${
                    isPasswordMatch ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {isPasswordMatch ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  <span>{isPasswordMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                </div>
              )}

              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
              </p>

              <button
                type="submit"
                disabled={loadingAction === 'reset'}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-2xl font-bold transition-all disabled:opacity-60"
              >
                {loadingAction === 'reset' ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-slate-600 font-medium">Redirecting to sign in...</p>
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Go to login now
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onBackToHome}
            className="w-full text-slate-600 hover:text-slate-900 py-2 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};
