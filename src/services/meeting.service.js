const bcrypt = require('bcryptjs');
const Meeting = require('../models/Meeting');
const User = require('../models/User');
const Notification = require('../models/Notification');
const config = require('../config');
const emailService = require('./email.service');

const createMeeting = async (hostUser, data) => {
  const meetingId = await Meeting.generateMeetingId();
  const invitationToken = Meeting.generateInvitationToken();

  let passwordHash = null;
  if (data.password) {
    passwordHash = await bcrypt.hash(data.password, 10);
  }

  const meeting = await Meeting.create({
    meetingId,
    title: data.title || `${hostUser.displayName}'s Meeting`,
    description: data.description || '',
    type: data.type || 'instant',
    isGroup: !!data.isGroup,
    groupName: data.groupName || '',
    groupId: data.groupId || null,
    allowedEmails: Array.isArray(data.allowedEmails)
      ? data.allowedEmails.map((e) => String(e).toLowerCase().trim()).filter(Boolean)
      : [],
    status: data.type === 'scheduled' || data.type === 'recurring' ? 'scheduled' : 'live',
    hostId: hostUser._id,
    scheduledStart: data.scheduledStart || (data.type === 'instant' ? new Date() : null),
    scheduledEnd: data.scheduledEnd || null,
    actualStart: data.type === 'instant' ? new Date() : null,
    timezone: data.timezone || hostUser.preferences?.timezone || 'UTC',
    recurrence: data.recurrence || { frequency: 'none' },
    passwordHash,
    hasPassword: !!data.password,
    waitingRoomEnabled: data.waitingRoomEnabled === undefined ? true : !!data.waitingRoomEnabled,
    invitationToken,
    invitationExpires: new Date(
      Date.now() + config.meeting.inviteTokenExpiresHours * 60 * 60 * 1000
    ),
    settings: {
      ...{
        allowScreenShare: true,
        allowChat: true,
        allowReactions: true,
        allowRaiseHand: true,
        muteOnEntry: false,
        videoOffOnEntry: false,
        onlyHostCanShare: false,
        onlyHostCanUnmute: false,
        recordingEnabled: true,
        maxParticipants: 0,
      },
      ...(data.settings || {}),
    },
    workspaceId: data.workspaceId || null,
    teamId: data.teamId || null,
    participants: [
      {
        userId: hostUser._id,
        displayName: hostUser.displayName,
        email: hostUser.email,
        role: 'host',
        joinedAt: data.type === 'instant' ? new Date() : null,
        isActive: data.type === 'instant',
      },
    ],
  });

  return meeting;
};

const getMeetingById = async (meetingId) => {
  return Meeting.findOne({ meetingId: meetingId.toUpperCase() })
    .populate('hostId', 'displayName email avatar')
    .populate('coHosts', 'displayName email avatar')
    .populate('participants.userId', 'displayName email avatar');
};

const joinMeeting = async (meeting, user, { password, asGuestName } = {}) => {
  if (meeting.status === 'ended' || meeting.status === 'cancelled') {
    const err = new Error('Meeting has ended or been cancelled');
    err.statusCode = 400;
    throw err;
  }
  // Group meeting: only pre-set member emails (or host) can join
  if (meeting.isGroup && typeof meeting.canUserJoin === 'function' && !meeting.canUserJoin(user)) {
    const err = new Error('This is a private group meeting. Only invited group members can join.');
    err.statusCode = 403;
    throw err;
  }
  if (meeting.locked && !meeting.isHostOrCoHost(user._id)) {
    const err = new Error('Meeting is locked. Contact the host.');
    err.statusCode = 403;
    throw err;
  }
  if (meeting.hasPassword && password) {
    const valid = await bcrypt.compare(password, meeting.passwordHash);
    if (!valid) {
      const err = new Error('Incorrect meeting password');
      err.statusCode = 403;
      throw err;
    }
  } else if (meeting.hasPassword && !meeting.isHostOrCoHost(user._id)) {
    const err = new Error('Password required');
    err.statusCode = 403;
    throw err;
  }

  // Waiting room: non-hosts go to waiting if enabled
  if (
    meeting.waitingRoomEnabled &&
    !meeting.isHostOrCoHost(user._id) &&
    meeting.status === 'live'
  ) {
    return { meeting, needsApproval: true };
  }

  meeting.addParticipant(user);
  if (meeting.status === 'scheduled') {
    meeting.status = 'live';
    meeting.actualStart = meeting.actualStart || new Date();
  }
  await meeting.save();
  return { meeting, needsApproval: false };
};

const endMeeting = async (meeting, userId) => {
  if (!meeting.isHostOrCoHost(userId)) {
    const err = new Error('Only host or co-host can end the meeting');
    err.statusCode = 403;
    throw err;
  }
  meeting.status = 'ended';
  meeting.actualEnd = new Date();
  if (meeting.actualStart) {
    meeting.durationMinutes = Math.floor(
      (meeting.actualEnd - meeting.actualStart) / 60000
    );
  }
  meeting.participants.forEach((p) => {
    if (p.isActive) {
      p.leftAt = new Date();
      p.isActive = false;
      p.durationMinutes = Math.floor((p.leftAt - p.joinedAt) / 60000);
    }
  });
  await meeting.save();
  return meeting;
};

const inviteByEmail = async (meeting, hostUser, emails = []) => {
  // Expand allowed roster for restricted group meetings
  const normalized = emails.map((e) => String(e).toLowerCase().trim()).filter(Boolean);
  if (normalized.length) {
    const set = new Set([...(meeting.allowedEmails || []), ...normalized]);
    meeting.allowedEmails = Array.from(set);
    await meeting.save();
  }

  const uniqueEmails = [...new Set(emails.map((e) => e.toLowerCase().trim()))];
  const results = [];

  for (const email of uniqueEmails) {
    const token = Meeting.generateInvitationToken();
    meeting.invitations.push({
      email,
      token,
      status: 'pending',
      invitedBy: hostUser._id,
    });

    const joinLink = `${config.clientUrl}/join/${meeting.meetingId}?token=${token}`;
    try {
      await emailService.sendMeetingInvitation({
        to: email,
        meeting,
        hostName: hostUser.displayName,
        joinLink,
      });
      results.push({ email, status: 'sent' });
    } catch (e) {
      results.push({ email, status: 'failed', error: e.message });
    }

    // In-app notification if user exists
    const invitee = await User.findOne({ email });
    if (invitee) {
      await Notification.create({
        userId: invitee._id,
        type: 'meeting_invite',
        title: `Invitation: ${meeting.title}`,
        body: `${hostUser.displayName} invited you to a meeting`,
        data: { meetingId: meeting.meetingId },
        link: `/join/${meeting.meetingId}`,
      });
    }
  }

  await meeting.save();
  return results;
};

const listUserMeetings = async (userId, { status, type, page = 1, limit = 20 } = {}) => {
  const query = {
    $or: [
      { hostId: userId },
      { coHosts: userId },
      { 'participants.userId': userId },
    ],
  };
  if (status) query.status = status;
  if (type) query.type = type;

  const skip = (page - 1) * limit;
  const [meetings, total] = await Promise.all([
    Meeting.find(query)
      .sort({ scheduledStart: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('hostId', 'displayName avatar')
      .lean(),
    Meeting.countDocuments(query),
  ]);

  return {
    meetings,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

module.exports = {
  createMeeting,
  getMeetingById,
  joinMeeting,
  endMeeting,
  inviteByEmail,
  listUserMeetings,
};