import 'server-only';

import {
  getRequiredEmailEnv,
  getRequiredEnvValue,
  getRequiredJwtSecret,
  getRequiredJwtSecretBytes,
} from './env-core';

export {
  getRequiredEmailEnv,
  getRequiredEnvValue,
  getRequiredJwtSecret,
  getRequiredJwtSecretBytes,
} from './env-core';

export function validateSecurityEnvironment(): void {
  getRequiredEmailEnv('ADMIN_EMAIL');
  getRequiredEnvValue('ADMIN_PASSWORD', { trim: false });
  getRequiredJwtSecret('ADMIN_JWT_SECRET');
  getRequiredJwtSecret('INVESTOR_JWT_SECRET');
  getRequiredEmailEnv('ADMIN_ALERT_EMAIL');
  getRequiredEnvValue('GREY_API_KEY');
}
