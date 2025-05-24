import dotenv from 'dotenv';

dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  ENABLE_WEBHOOK: process.env.ENABLE_WEBHOOK === 'true',
  WEBHOOK_RETRY_ATTEMPTS: parseInt(process.env.WEBHOOK_RETRY_ATTEMPTS || '3', 10),
  WEBHOOK_RETRY_DELAY: parseInt(process.env.WEBHOOK_RETRY_DELAY || '1000', 10),
  SESSIONS_DATA_PATH: process.env.SESSIONS_DATA_PATH || 'sessions_data',
  MAX_RECONNECT_ATTEMPTS: parseInt(process.env.MAX_RECONNECT_ATTEMPTS || '5', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};