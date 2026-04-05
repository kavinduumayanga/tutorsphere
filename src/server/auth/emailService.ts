import nodemailer from 'nodemailer';

type PasswordResetEmailInput = {
  to: string;
  otpCode: string;
  expiryMinutes: number;
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (transporter) {
    return transporter;
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!gmailUser || !gmailAppPassword) {
    throw new Error('Missing Gmail SMTP credentials. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  return transporter;
};

const getEmailFrom = (): string => {
  const emailFrom = process.env.EMAIL_FROM?.trim();
  const gmailUser = process.env.GMAIL_USER?.trim();
  const fromAddress = emailFrom || gmailUser;

  if (!fromAddress) {
    throw new Error('Missing EMAIL_FROM or GMAIL_USER for sender address.');
  }

  return fromAddress;
};

export const sendPasswordResetOtpEmail = async ({
  to,
  otpCode,
  expiryMinutes,
}: PasswordResetEmailInput): Promise<void> => {
  const sender = getEmailFrom();
  const activeTransporter = getTransporter();

  await activeTransporter.sendMail({
    from: `TutorSphere <${sender}>`,
    to,
    subject: 'TutorSphere password reset verification code',
    text: [
      'Hello,',
      '',
      'We received a request to reset your TutorSphere password.',
      `Use this one-time password (OTP): ${otpCode}`,
      `This code expires in ${expiryMinutes} minute(s).`,
      '',
      'If you did not request this change, you can safely ignore this email.',
      '',
      'TutorSphere Security',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <p>Hello,</p>
        <p>We received a request to reset your TutorSphere password.</p>
        <p>Your one-time password (OTP) is:</p>
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0; color: #4f46e5;">${otpCode}</p>
        <p>This code expires in <strong>${expiryMinutes} minute(s)</strong>.</p>
        <p>If you did not request this change, you can safely ignore this email.</p>
        <p style="margin-top: 24px;">TutorSphere Security</p>
      </div>
    `,
  });
};
