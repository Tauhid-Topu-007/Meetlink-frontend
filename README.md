# MeetLink Frontend

MeetLink is a modern real-time video conferencing and collaboration platform. This repository contains the React/Vite client application together with the Node.js/Socket.IO server entry point used by the project.

## ✨ Features

- 🔐 User registration and authentication
- 🏠 Authenticated dashboard
- 🎥 Real-time meeting rooms
- 🔗 Join meetings using meeting IDs
- 📅 Meeting scheduling
- 👥 Contacts and groups
- 💬 Real-time communication and chat
- 📁 Chat file/image uploads
- 🎙️ Audio/video communication with peer-to-peer connectivity
- 🖥️ Meeting and host controls
- ⏳ Waiting-room support
- 📊 Attendance management and Excel export
- 🔔 Notifications
- 🎞️ Recording management
- 👤 Profile and account settings
- 🔒 Protected routes and authentication state
- ⚡ Real-time events through Socket.IO
- 🛡️ Backend security middleware and API rate limiting

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite 5
- React Router DOM
- Tailwind CSS
- Framer Motion
- Axios
- Zustand
- Socket.IO Client
- Simple Peer
- Lucide React
- React Hot Toast

### Backend / Real-Time Layer
- Node.js
- Express
- Socket.IO
- MongoDB
- CORS
- Helmet
- Morgan
- Express Rate Limit

## 📂 Project Structure

Meetlink-frontend/
├── src/
│   ├── api/              # API integration
│   ├── components/       # Reusable UI components
│   ├── config/           # Application configuration
│   ├── controllers/      # Client-side controllers
│   ├── middleware/       # Middleware utilities
│   ├── models/           # Application models
│   ├── pages/            # Application pages
│   ├── routes/           # Route definitions
│   ├── services/         # Business/service logic
│   ├── socket/           # Socket.IO real-time functionality
│   ├── store/            # Zustand state management
│   ├── App.jsx           # Main application routes
│   ├── main.jsx          # React entry point
│   └── index.css         # Global styles
├── index.html
├── server.js             # Node.js/Socket.IO server entry point
├── .env.example          # Environment variable template
├── tailwind.config.js
├── vite.config.js
├── package.json
└── package-lock.json

## 🚀 Getting Started

### Prerequisites

Make sure you have installed:

- Node.js 18+
- npm
- MongoDB (local or hosted)

### 1. Clone the repository

git clone https://github.com/Tauhid-Topu-007/Meetlink-frontend.git
cd Meetlink-frontend

### 2. Install dependencies

npm install

### 3. Configure environment variables

Create your local environment file by copying .env.example to .env.

Then update the values in .env, especially the MongoDB connection string and JWT secret.

Example configuration:

NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/meetlink
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
CLIENT_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

> Security: Never commit real secrets, passwords, API keys, or production credentials to GitHub. Use .env.example as the safe configuration template.

### 4. Start the frontend

npm run dev

The Vite development server normally runs at:

http://localhost:5173

### 5. Build for production

npm run build

### 6. Preview the production build

npm run preview

## 🔑 Application Routes

| Route | Purpose | Access |
|---|---|---|
| / | Landing page | Public |
| /login | User login | Public |
| /register | User registration | Public |
| /dashboard | Main dashboard | Protected |
| /admin | Admin dashboard | Admin only |
| /schedule | Meeting scheduling | Protected |
| /contacts | Contact management | Protected |
| /groups | Group management | Protected |
| /profile | User profile | Protected |
| /settings | Application settings | Protected |
| /recordings | Meeting recordings | Protected |
| /join/:meetingId? | Join a meeting | Protected |
| /meeting/:meetingId | Meeting room | Protected |

Protected routes redirect unauthenticated users to the login page.

## 🔌 Backend API

The included server exposes API namespaces including:

/api/auth
/api/meetings
/api/notifications
/api/attendance
/api/chat
/api/groups

Additional endpoints include:

GET /health
GET /

The backend also supports Socket.IO connections for real-time communication.

## ⚡ Real-Time Communication

MeetLink uses Socket.IO and peer-to-peer WebRTC-style communication through Simple Peer to support real-time meeting experiences.

The architecture separates:

- UI components
- application state
- API services
- socket communication
- meeting logic
- routing
- configuration

This makes the application easier to extend and maintain.

## 🏗️ Architecture Overview

React Client
    │
    ├── Vite + Tailwind
    │
    ├── REST API ──────────► Express Server
    │                            │
    │                            └── MongoDB
    │
    └── Socket.IO ─────────► Real-Time Communication
                                 │
                                 └── Meeting Events / Signaling

## 🔒 Security

The server configuration includes several security mechanisms:

- Helmet security headers
- Configurable CORS
- JWT-based authentication configuration
- API rate limiting
- Request body size limits
- Protected frontend routes
- Environment-based configuration

For production deployments, use strong secrets, HTTPS, a secure MongoDB deployment, restricted CORS origins, and a production-grade file/object-storage provider.

## 📦 Available Scripts

npm run dev       # Start Vite development server
npm run build     # Create production build
npm run preview   # Preview production build

## 🌐 Environment Variables

The project provides .env.example with configuration for:

- Application environment and port
- MongoDB
- JWT authentication
- Client URL and CORS
- Optional SMTP email service
- Local/cloud storage configuration
- Rate limiting
- Meeting defaults
- Invitation-token expiry

Keep environment-specific values outside version control.

## 🚧 Future Improvements

Potential areas for continued development include:

- Screen sharing enhancements
- Meeting recording improvements
- Advanced moderation and host controls
- Breakout rooms
- Meeting analytics
- Improved notification workflows
- Cloud object storage integration
- Automated testing and CI/CD
- Accessibility improvements
- Performance optimization for large meetings
- Progressive Web App support

## 👨‍💻 Author

**Tauhidul Islam Topu**

Computer Science & Engineering student and developer interested in full-stack development, Machine Learning, and AI.

## 📄 License

This project is currently provided as a personal/academic project. Add an explicit open-source license if you intend to permit reuse, modification, or redistribution.

## ⭐ Support

If you find the project useful, consider starring the repository and sharing feedback through GitHub issues.

---

**MeetLink — Real-Time Communication & Collaboration Platform**
