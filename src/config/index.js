require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/meetlink',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production-min-32-chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'MeetLink <noreply@meetlink.app>',
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    path: process.env.STORAGE_PATH || './uploads',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  meeting: {
    defaultDurationMin: parseInt(process.env.DEFAULT_MEETING_DURATION_MIN || '60', 10),
    inviteTokenExpiresHours: parseInt(process.env.INVITE_TOKEN_EXPIRES_HOURS || '48', 10),
  },
};

module.exports = config;