import 'server-only';

const MINIMUM_JWT_SECRET_LENGTH = 32;
const BASIC_EMAIL_ADDRESS_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getRequiredEnvValue(
  name: string,
  options?: {
    trim?: boolean;
  }
): string {
  const rawValue = process.env[name];

  if (typeof rawValue !== 'string') {
    throw new Error(`${name} is not configured`);
  }

  const shouldTrim = options?.trim !== false;
  const value = shouldTrim ? rawValue.trim() : rawValue;

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function getRequiredEmailEnv(name: string): string {
  const value = getRequiredEnvValue(name).toLowerCase();

  if (!BASIC_EMAIL_ADDRESS_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid email address`);
  }

  return value;
}

export function getRequiredJwtSecret(name: string): string {
  const value = getRequiredEnvValue(name);

  if (value.length < MINIMUM_JWT_SECRET_LENGTH) {
    throw new Error(
      `${name} must be at least ${MINIMUM_JWT_SECRET_LENGTH} characters long`
    );
  }

  return value;
}

export function getRequiredJwtSecretBytes(name: string): Uint8Array {
  return new TextEncoder().encode(getRequiredJwtSecret(name));
}

export function validateSecurityEnvironment(): void {
  getRequiredEmailEnv('ADMIN_EMAIL');
  getRequiredEnvValue('ADMIN_PASSWORD', { trim: false });
  getRequiredJwtSecret('ADMIN_JWT_SECRET');
  getRequiredJwtSecret('INVESTOR_JWT_SECRET');
  getRequiredEmailEnv('ADMIN_ALERT_EMAIL');
  getRequiredEnvValue('GREY_API_KEY');
}
