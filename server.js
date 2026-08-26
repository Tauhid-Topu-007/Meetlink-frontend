const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const config = require('./src/config');
const connectDB = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');
const socketHandler = require('./src/socket/socketHandler');

const authRoutes = require('./src/routes/auth.routes');
const meetingRoutes = require('./src/routes/meeting.routes');
const notificationRoutes = require('./src/routes/notification.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const chatRoutes = require('./src/routes/chat.routes');
const groupRoutes = require('./src/routes/group.routes');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: config.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 5e6,
  transports: ['websocket', 'polling'],
});

// Security & middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || config.corsOrigins.includes(origin) || config.env === 'development') {
        return cb(null, true);
      }
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (config.env !== 'production') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// DB
connectDB();

// Static uploads (chat images/files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/groups', groupRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '2.1.0',
    env: config.env,
    timestamp: new Date().toISOString(),
    features: [
      'unlimited-participants',
      'unlimited-duration',
      'chat-file-upload',
      'attendance-excel',
      'waiting-room',
      'host-controls',
    ],
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'MeetLink API',
    version: '2.1.0',
    description: 'Advanced Real-Time Communication & Collaboration Platform',
    endpoints: {
      auth: '/api/auth',
      meetings: '/api/meetings',
      notifications: '/api/notifications',
      attendance: '/api/attendance/:meetingId',
      attendanceExcel: '/api/attendance/:meetingId/excel',
      chatUpload: '/api/chat/upload',
      health: '/health',
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.url}` });
});

app.use(errorHandler);

// Socket.IO
socketHandler(io);

// Global error guards
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));
process.on('unhandledRejection', (err) => console.error('Unhandled Rejection:', err));

server.listen(config.port, () => {
  console.log(`
🚀 MeetLink Backend v2.0.0
📡 Port: ${config.port}
🌐 Client: ${config.clientUrl}
🔒 CORS: ${config.corsOrigins.join(', ')}
  `);
});

module.exports = { app, server, io };