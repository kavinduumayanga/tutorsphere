type SecurityConfig = {
  nodeEnv: string;
  isProduction: boolean;
  jwtSecret: string;
  sessionSecret: string;
};

const DEV_JWT_FALLBACK = 'dev_jwt_secret';
const DEV_SESSION_FALLBACK = 'dev_session_secret';

const normalizeEnvValue = (value: unknown): string => String(value || '').trim();

export const getJwtSecret = (): string => {
  const jwtSecret = normalizeEnvValue(process.env.JWT_SECRET);
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured.');
  }
  return jwtSecret;
};

export const getSessionSecret = (): string => {
  const sessionSecret = normalizeEnvValue(process.env.SESSION_SECRET);
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is not configured.');
  }
  return sessionSecret;
};

export const loadSecurityConfig = (): SecurityConfig => {
  const nodeEnv = normalizeEnvValue(process.env.NODE_ENV) || 'development';
  const isProduction = nodeEnv === 'production';

  let jwtSecret = normalizeEnvValue(process.env.JWT_SECRET);
  let sessionSecret = normalizeEnvValue(process.env.SESSION_SECRET);

  if (!jwtSecret && !isProduction) {
    jwtSecret = DEV_JWT_FALLBACK;
    process.env.JWT_SECRET = jwtSecret;
    console.warn('[Startup][Security] JWT_SECRET is missing; using development fallback.');
  }

  if (!sessionSecret && !isProduction) {
    sessionSecret = DEV_SESSION_FALLBACK;
    process.env.SESSION_SECRET = sessionSecret;
    console.warn('[Startup][Security] SESSION_SECRET is missing; using development fallback.');
  }

  const missingInProduction: string[] = [];
  if (!jwtSecret) {
    missingInProduction.push('JWT_SECRET');
  }
  if (!sessionSecret) {
    missingInProduction.push('SESSION_SECRET');
  }

  if (missingInProduction.length > 0) {
    const missing = missingInProduction.join(', ');
    console.error(`[Startup][Security] Missing required environment variables: ${missing}`);
    throw new Error(`Missing required environment variables: ${missing}`);
  }

  console.log(`[Startup] Environment mode: ${isProduction ? 'production' : 'development'}`);
  console.log('[Startup] Required security environment variables are loaded: JWT_SECRET, SESSION_SECRET');

  return {
    nodeEnv,
    isProduction,
    jwtSecret,
    sessionSecret,
  };
};
