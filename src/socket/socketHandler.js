const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Meeting = require('../models/Meeting');

// In-memory room state (replace with Redis for horizontal scale)
const rooms = new Map(); // meetingId -> { participants: Map(socketId -> info), waiting: Map }

function getOrCreateRoom(meetingId) {
  if (!rooms.has(meetingId)) {
    rooms.set(meetingId, {
      participants: new Map(),
      waiting: new Map(),
      breakout: null, // { active, rooms: [{id,name,members[]}], assignments: Map socketId->boId }
    });
  }
  return rooms.get(meetingId);
}

function breakoutSocketRoom(meetingId, boId) {
  return `${meetingId}:bo:${boId}`;
}

function leaveAllBreakouts(socket, meetingId) {
  const room = rooms.get(meetingId);
  if (!room?.breakout?.rooms) return;
  for (const bo of room.breakout.rooms) {
    socket.leave(breakoutSocketRoom(meetingId, bo.id));
  }
  socket.breakoutRoomId = null;
}

const socketHandler = (io) => {
  // Auth middleware for sockets
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) return next(new Error('Invalid user'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Connected: ${socket.user.displayName} (${socket.id})`);
    socket.join(`user:${socket.user._id}`);

    // --- Join meeting room ---
    socket.on('meeting:join', async (payload, ack) => {
      try {
        const { meetingId, password } = payload || {};
        const meeting = await Meeting.findOne({ meetingId: meetingId?.toUpperCase() }).select(
          '+passwordHash'
        );
        if (!meeting) {
          return ack?.({ success: false, message: 'Meeting not found' });
        }

        const room = getOrCreateRoom(meeting.meetingId);
        const isHost = meeting.isHostOrCoHost(socket.user._id);

        if (meeting.locked && !isHost) {
          return ack?.({ success: false, message: 'Meeting is locked' });
        }

        // Password check for non-hosts
        if (meeting.hasPassword && !isHost) {
          if (!password) {
            return ack?.({ success: false, message: 'Password required' });
          }
          const bcrypt = require('bcryptjs');
          const ok = meeting.passwordHash
            ? await bcrypt.compare(String(password), meeting.passwordHash)
            : false;
          if (!ok) {
            return ack?.({ success: false, message: 'Incorrect meeting password' });
          }
        }

        // Waiting room for non-hosts (live or scheduled)
        const waitingOn =
          meeting.waitingRoomEnabled !== false &&
          (meeting.settings?.waitingRoomEnabled !== false);
        // Prefer explicit false only to disable
        const wrEnabled = !!(meeting.waitingRoomEnabled || meeting.settings?.waitingRoomEnabled);

        if (wrEnabled && !isHost && meeting.status !== 'ended' && meeting.status !== 'cancelled') {
          const waiter = {
            userId: socket.user._id.toString(),
            displayName: socket.user.displayName,
            avatar: socket.user.avatar,
            socketId: socket.id,
          };
          room.waiting.set(socket.id, waiter);
          socket.join(`waiting:${meeting.meetingId}`);
          const payload = {
            userId: socket.user._id,
            displayName: socket.user.displayName,
            socketId: socket.id,
          };
          // Notify everyone already in the meeting room (host)
          io.to(meeting.meetingId).emit('meeting:waiting-join', payload);
          // Also notify host user channel
          if (meeting.hostId) {
            const hid = meeting.hostId._id || meeting.hostId;
            io.to(`user:${hid}`).emit('meeting:waiting-join', payload);
          }
          return ack?.({ success: true, needsApproval: true });
        }

        // Admit
        await admitParticipant(io, socket, meeting, room);
        // Host gets current waiting list
        const waitingList = Array.from(room.waiting.values());
        ack?.({
          success: true,
          needsApproval: false,
          waiting: isHost ? waitingList : [],
          isHost,
        });
      } catch (err) {
        ack?.({ success: false, message: err.message });
      }
    });

    // Host approves waiting user
    socket.on('meeting:approve', async ({ meetingId, socketId: targetSocketId }) => {
      try {
        const meeting = await Meeting.findOne({ meetingId: meetingId?.toUpperCase() });
        if (!meeting || !meeting.isHostOrCoHost(socket.user._id)) return;

        const room = getOrCreateRoom(meeting.meetingId);
        const waitingUser = room.waiting.get(targetSocketId);
        if (!waitingUser) {
          socket.emit('error', { message: 'User is not in the waiting room' });
          return;
        }

        room.waiting.delete(targetSocketId);
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.leave(`waiting:${meeting.meetingId}`);
          await admitParticipant(io, targetSocket, meeting, room);
          targetSocket.emit('meeting:approved', { meetingId: meeting.meetingId });
        }
        io.to(meeting.meetingId).emit('meeting:waiting-update', {
          waiting: Array.from(room.waiting.values()),
        });
      } catch (e) {
        console.error('approve error', e);
      }
    });

    socket.on('meeting:reject', ({ meetingId, socketId: targetSocketId }) => {
      const room = getOrCreateRoom(meetingId?.toUpperCase());
      room.waiting.delete(targetSocketId);
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit('meeting:rejected', { meetingId });
        targetSocket.leave(`waiting:${meetingId}`);
      }
    });

    // --- WebRTC signaling (simple-peer compatible) ---
    socket.on('signal', ({ to, signal, meetingId }) => {
      io.to(to).emit('signal', {
        from: socket.id,
        signal,
        userId: socket.user._id,
        displayName: socket.user.displayName,
      });
    });

    // --- Media / presence controls ---
    socket.on('participant:update', ({ meetingId, updates }) => {
      const room = rooms.get(meetingId?.toUpperCase());
      if (!room) return;
      const p = room.participants.get(socket.id);
      if (p) {
        Object.assign(p, updates);
        socket.to(meetingId.toUpperCase()).emit('participant:updated', {
          socketId: socket.id,
          userId: socket.user._id,
          updates,
        });
      }
    });

    // Host controls
    socket.on('screen:share', ({ meetingId, sharing }) => {
      const id = (meetingId || '').toUpperCase();
      io.to(id).emit('screen:share', {
        socketId: socket.id,
        userId: socket.user._id,
        displayName: socket.user.displayName,
        sharing: !!sharing,
      });
    });

    socket.on('host:mute-all', ({ meetingId }) => {
      const id = meetingId?.toUpperCase();
      const room = rooms.get(id);
      if (!room) return;
      for (const [sid] of room.participants) {
        if (sid !== socket.id) {
          io.to(sid).emit('host:force-mute');
        }
      }
      io.to(id).emit('host:muted-all', { by: socket.user.displayName });
    });

    socket.on('host:mute', ({ meetingId, targetSocketId }) => {
      io.to(targetSocketId).emit('host:force-mute');
      socket.to(meetingId).emit('participant:updated', {
        socketId: targetSocketId,
        updates: { isMuted: true },
      });
    });

    socket.on('host:disable-video', ({ meetingId, targetSocketId }) => {
      io.to(targetSocketId).emit('host:force-video-off');
    });

    socket.on('host:remove', ({ meetingId, targetSocketId }) => {
      const target = io.sockets.sockets.get(targetSocketId);
      if (target) {
        target.emit('host:removed');
        target.leave(meetingId);
        const room = rooms.get(meetingId?.toUpperCase());
        room?.participants.delete(targetSocketId);
        io.to(meetingId).emit('participant:left', { socketId: targetSocketId });
      }
    });

    socket.on('meeting:lock', async ({ meetingId, locked }) => {
      const meeting = await Meeting.findOne({ meetingId: meetingId?.toUpperCase() });
      if (meeting && meeting.isHostOrCoHost(socket.user._id)) {
        meeting.locked = !!locked;
        await meeting.save();
        io.to(meeting.meetingId).emit('meeting:locked', { locked: meeting.locked });
      }
    });

    socket.on('meeting:end', async ({ meetingId }) => {
      try {
        const id = (meetingId || '').toUpperCase();
        const meeting = await Meeting.findOne({ meetingId: id });
        if (!meeting) return;
        if (!meeting.isHostOrCoHost(socket.user._id)) {
          socket.emit('error', { message: 'Only host can end the meeting' });
          return;
        }
        meeting.status = 'ended';
        meeting.actualEnd = new Date();
        meeting.participants.forEach((p) => {
          if (p.isActive) {
            p.isActive = false;
            p.leftAt = new Date();
          }
        });
        await meeting.save();
        io.to(id).emit('meeting:ended', { meetingId: id, endedBy: socket.user.displayName });
        // Disconnect room state
        const room = rooms.get(id);
        if (room) {
          room.participants.clear();
          room.waiting.clear();
          rooms.delete(id);
        }
      } catch (e) {
        console.error('meeting:end error', e);
      }
    });


    // Recording status broadcast
    socket.on('recording:started', ({ meetingId }) => {
      io.to(meetingId?.toUpperCase()).emit('recording:status', { recording: true });
    });
    socket.on('recording:stopped', ({ meetingId }) => {
      io.to(meetingId?.toUpperCase()).emit('recording:status', { recording: false });
    });

    // Chat — supports text, images, and files
    socket.on('chat:message', ({ meetingId, content, replyTo, attachments }) => {
      const payload = {
        id: `${Date.now()}-${socket.id}`,
        meetingId,
        senderId: socket.user._id,
        displayName: socket.user.displayName,
        avatar: socket.user.avatar,
        content: content || '',
        replyTo: replyTo || null,
        attachments: Array.isArray(attachments) ? attachments : [],
        type:
          attachments?.length > 0
            ? attachments.some((a) => a.isImage || a.mimeType?.startsWith('image/'))
              ? 'image'
              : 'file'
            : 'text',
        createdAt: new Date().toISOString(),
      };
      io.to(meetingId?.toUpperCase()).emit('chat:message', payload);
    });

    // Raise hand / reactions
    socket.on('meeting:raise-hand', ({ meetingId, raised }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (room?.participants?.has(socket.id)) {
        const info = room.participants.get(socket.id);
        info.handRaised = !!raised;
        room.participants.set(socket.id, info);
      }
      io.to(id).emit('participant:raise-hand', {
        socketId: socket.id,
        userId: socket.user._id,
        displayName: socket.user.displayName,
        raised: !!raised,
      });
    });

    socket.on('meeting:spotlight', ({ meetingId, socketId: targetId }) => {
      const id = (meetingId || '').toUpperCase();
      const meetingRoom = rooms.get(id);
      // Only host should spotlight — soft check via room role if present
      io.to(id).emit('meeting:spotlight', { socketId: targetId || null });
    });

    socket.on('meeting:reaction', ({ meetingId, emoji }) => {
      io.to(meetingId?.toUpperCase()).emit('meeting:reaction', {
        socketId: socket.id,
        userId: socket.user._id,
        displayName: socket.user.displayName,
        emoji,
        ts: Date.now(),
      });
    });

    // Disconnect

    // ========== Breakout rooms ==========
    socket.on('breakout:create', ({ meetingId, roomCount, roomNames }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (!room) return;

      const count = Math.min(Math.max(parseInt(roomCount, 10) || 2, 1), 20);
      const names = Array.isArray(roomNames) ? roomNames : [];
      const boRooms = [];
      for (let i = 0; i < count; i++) {
        boRooms.push({
          id: `r${i + 1}`,
          name: names[i] || `Room ${i + 1}`,
          members: [],
        });
      }

      // Auto-assign non-host participants round-robin
      const participants = Array.from(room.participants.values());
      const assignees = participants.filter((p) => p.role !== 'host');
      const assignments = {};
      assignees.forEach((p, idx) => {
        const bo = boRooms[idx % boRooms.length];
        bo.members.push({
          socketId: p.socketId,
          userId: p.userId,
          displayName: p.displayName,
        });
        assignments[p.socketId] = bo.id;
      });

      room.breakout = {
        active: false,
        rooms: boRooms,
        assignments,
      };

      io.to(id).emit('breakout:updated', {
        active: false,
        rooms: boRooms,
        assignments,
      });
    });

    socket.on('breakout:assign', ({ meetingId, socketId: targetId, breakoutRoomId }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (!room?.breakout) return;

      // Remove from previous room members
      for (const bo of room.breakout.rooms) {
        bo.members = bo.members.filter((m) => m.socketId !== targetId);
      }
      if (breakoutRoomId) {
        const bo = room.breakout.rooms.find((r) => r.id === breakoutRoomId);
        const p = room.participants.get(targetId);
        if (bo && p) {
          bo.members.push({
            socketId: p.socketId,
            userId: p.userId,
            displayName: p.displayName,
          });
          room.breakout.assignments[targetId] = breakoutRoomId;
        }
      } else {
        delete room.breakout.assignments[targetId];
      }

      io.to(id).emit('breakout:updated', {
        active: room.breakout.active,
        rooms: room.breakout.rooms,
        assignments: room.breakout.assignments,
      });
    });

    socket.on('breakout:open', ({ meetingId, timerMinutes }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (!room?.breakout) return;
      room.breakout.active = true;
      room.breakout.openedAt = Date.now();
      room.breakout.timerMinutes = timerMinutes || 0;

      // Tell each participant which room to join
      for (const [sid, p] of room.participants) {
        const boId = room.breakout.assignments[sid] || null;
        const target = io.sockets.sockets.get(sid);
        if (!target) continue;
        if (boId) {
          leaveAllBreakouts(target, id);
          target.join(breakoutSocketRoom(id, boId));
          target.breakoutRoomId = boId;
          const bo = room.breakout.rooms.find((r) => r.id === boId);
          const peers = (bo?.members || []).filter((m) => m.socketId !== sid);
          target.emit('breakout:joined', {
            breakoutRoomId: boId,
            roomName: bo?.name || boId,
            peers,
            timerMinutes: room.breakout.timerMinutes,
          });
        } else {
          // Host / unassigned stays in main — still notified
          target.emit('breakout:opened', {
            rooms: room.breakout.rooms,
            assignments: room.breakout.assignments,
            timerMinutes: room.breakout.timerMinutes,
          });
        }
      }

      io.to(id).emit('breakout:updated', {
        active: true,
        rooms: room.breakout.rooms,
        assignments: room.breakout.assignments,
        timerMinutes: room.breakout.timerMinutes,
      });
    });

    socket.on('breakout:close', ({ meetingId }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (!room?.breakout) return;
      room.breakout.active = false;

      for (const [sid] of room.participants) {
        const target = io.sockets.sockets.get(sid);
        if (!target) continue;
        leaveAllBreakouts(target, id);
        target.emit('breakout:closed', {
          message: 'Breakout rooms closed. Returning to main session.',
        });
      }

      // Optionally clear assignments but keep room definitions
      io.to(id).emit('breakout:updated', {
        active: false,
        rooms: room.breakout.rooms,
        assignments: room.breakout.assignments,
      });
    });

    socket.on('breakout:broadcast', ({ meetingId, content }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (!room?.breakout?.active || !content) return;
      io.to(id).emit('breakout:broadcast', {
        content: String(content).slice(0, 500),
        from: socket.user.displayName,
        at: new Date().toISOString(),
      });
    });

    // Host joins a breakout room temporarily
    socket.on('breakout:host-join', ({ meetingId, breakoutRoomId }) => {
      const id = (meetingId || '').toUpperCase();
      const room = rooms.get(id);
      if (!room?.breakout || !breakoutRoomId) return;
      leaveAllBreakouts(socket, id);
      socket.join(breakoutSocketRoom(id, breakoutRoomId));
      socket.breakoutRoomId = breakoutRoomId;
      const bo = room.breakout.rooms.find((r) => r.id === breakoutRoomId);
      const peers = (bo?.members || []).filter((m) => m.socketId !== socket.id);
      socket.emit('breakout:joined', {
        breakoutRoomId,
        roomName: bo?.name || breakoutRoomId,
        peers,
        asHost: true,
      });
      socket.to(breakoutSocketRoom(id, breakoutRoomId)).emit('participant:joined', {
        socketId: socket.id,
        userId: socket.user._id.toString(),
        displayName: socket.user.displayName,
        role: 'host',
      });
    });

    socket.on('breakout:host-leave', ({ meetingId }) => {
      const id = (meetingId || '').toUpperCase();
      if (socket.breakoutRoomId) {
        const boRoom = breakoutSocketRoom(id, socket.breakoutRoomId);
        socket.to(boRoom).emit('participant:left', { socketId: socket.id });
        leaveAllBreakouts(socket, id);
      }
      socket.emit('breakout:host-left-room');
    });


    socket.on('disconnect', () => {
      console.log(`🔌 Disconnected: ${socket.user?.displayName}`);
      for (const [meetingId, room] of rooms.entries()) {
        if (room.breakout) {
          delete room.breakout.assignments?.[socket.id];
          for (const bo of room.breakout.rooms || []) {
            bo.members = (bo.members || []).filter((m) => m.socketId !== socket.id);
          }
        }
        if (room.participants.has(socket.id)) {
          room.participants.delete(socket.id);
          io.to(meetingId).emit('participant:left', {
            socketId: socket.id,
            userId: socket.user?._id,
          });
        }
        room.waiting.delete(socket.id);
      }
    });
  });
};

async function admitParticipant(io, socket, meeting, room) {
  const meetingId = meeting.meetingId;
  socket.join(meetingId);

  const info = {
    socketId: socket.id,
    userId: socket.user._id.toString(),
    displayName: socket.user.displayName,
    avatar: socket.user.avatar,
    role: meeting.isHostOrCoHost(socket.user._id) ? (meeting.hostId.toString() === socket.user._id.toString() ? 'host' : 'co-host') : 'participant',
    isMuted: meeting.settings?.muteOnEntry || false,
    isVideoOff: meeting.settings?.videoOffOnEntry || false,
  };

  // Notify existing participants of new peer
  const existing = Array.from(room.participants.values());
  socket.emit('meeting:participants', existing);

  room.participants.set(socket.id, info);
  socket.to(meetingId).emit('participant:joined', info);

  // Persist participant if not already
  try {
    meeting.addParticipant(socket.user, info.role);
    if (meeting.status === 'scheduled') {
      meeting.status = 'live';
      meeting.actualStart = meeting.actualStart || new Date();
    }
    await meeting.save();
  } catch (e) {
    console.error('Failed to persist participant', e.message);
  }
}

module.exports = socketHandler;