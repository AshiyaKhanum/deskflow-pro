import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';

/**
 * A "required with dev fallback" value: convenient for local development, but the
 * fallback is deliberately NEVER used in production - a missing secret in production
 * must be a hard crash at boot, not a silent insecure default.
 */
function requiredWithDevFallback(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (nodeEnv === 'production') {
    throw new Error(`Missing required environment variable: ${name} (no insecure default is used in production)`);
  }
  if (nodeEnv === 'test') return devFallback; // test/setup.ts sets its own values anyway
  return devFallback;
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT ?? 8000),
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/deskflow',
  jwtSecret: requiredWithDevFallback('JWT_SECRET', 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  isTest: nodeEnv === 'test',
};
