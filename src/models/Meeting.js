const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const participantSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    displayName: { type: String, required: true },
    email: { type: String },
    role: {
      type: String,
      enum: ['host', 'co-host', 'participant', 'viewer'],
      default: 'participant',
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isMuted: { type: Boolean, default: false },
    isVideoOff: { type: Boolean, default: false },
    isHandRaised: { type: Boolean, default: false },
    permissions: {
      canShareScreen: { type: Boolean, default: true },
      canChat: { type: Boolean, default: true },
      canUnmute: { type: Boolean, default: true },
      canTurnOnVideo: { type: Boolean, default: true },
    },
  },
  { _id: false }
);

const invitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true },
    token: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired', 'cancelled'],
      default: 'pending',
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentAt: { type: Date, default: Date.now },
    respondedAt: { type: Date },
  },
  { _id: true }
);

const recordingSchema = new mongoose.Schema(
  {
    recordingId: { type: String, required: true },
    status: {
      type: String,
      enum: ['recording', 'processing', 'ready', 'failed', 'deleted'],
      default: 'recording',
    },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    durationSeconds: { type: Number },
    storageKey: { type: String },
    sizeBytes: { type: Number },
    mimeType: { type: String, default: 'video/webm' },
  },
  { _id: true }
);

const meetingSchema = new mongoose.Schema(
  {
    meetingId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000, default: '' },
    type: {
      type: String,
      enum: ['instant', 'scheduled', 'recurring', 'persistent', 'group'],
      default: 'instant',
    },
    isGroup: { type: Boolean, default: false },
    groupName: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', default: null },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coHosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Scheduling
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },
    actualStart: { type: Date },
    actualEnd: { type: Date },
    durationMinutes: { type: Number, default: 0 },
    timezone: { type: String, default: 'UTC' },
    recurrence: {
      frequency: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'none',
      },
      interval: { type: Number, default: 1 },
      daysOfWeek: [{ type: Number }], // 0-6
      endDate: { type: Date },
      count: { type: Number },
    },
    // Security & access
    passwordHash: { type: String, select: false },
    hasPassword: { type: Boolean, default: false },
    waitingRoomEnabled: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
    invitationToken: { type: String, index: true },
    invitationExpires: { type: Date },
    // Settings / permissions
    settings: {
      allowScreenShare: { type: Boolean, default: true },
      allowChat: { type: Boolean, default: true },
      allowReactions: { type: Boolean, default: true },
      allowRaiseHand: { type: Boolean, default: true },
      muteOnEntry: { type: Boolean, default: false },
      videoOffOnEntry: { type: Boolean, default: false },
      onlyHostCanShare: { type: Boolean, default: false },
      onlyHostCanUnmute: { type: Boolean, default: false },
      recordingEnabled: { type: Boolean, default: true },
      maxParticipants: { type: Number, default: 0 }, // 0 = unlimited
    },
    participants: [participantSchema],
    invitations: [invitationSchema],
    recordings: [recordingSchema],
    // Relations
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    // Resources / files shared in meeting
    resources: [
      {
        name: String,
        url: String,
        type: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

meetingSchema.index({ hostId: 1, status: 1 });
meetingSchema.index({ scheduledStart: 1 });
meetingSchema.index({ 'participants.userId': 1 });
meetingSchema.index({ invitationToken: 1 });

// Generate short unique meeting ID
meetingSchema.statics.generateMeetingId = async function () {
  let id;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 15) {
    id = uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase();
    exists = await this.exists({ meetingId: id });
    attempts++;
  }
  if (exists) throw new Error('Could not generate unique meeting ID');
  return id;
};

meetingSchema.statics.generateInvitationToken = function () {
  return crypto.randomBytes(24).toString('hex');
};

meetingSchema.methods.addParticipant = function (user, role = 'participant') {
  const existing = this.participants.find(
    (p) => p.userId.toString() === user._id.toString() && p.isActive
  );
  if (existing) return existing;

  const participant = {
    userId: user._id,
    displayName: user.displayName || user.username,
    email: user.email,
    role: this.hostId.toString() === user._id.toString() ? 'host' : role,
    joinedAt: new Date(),
    isActive: true,
    isMuted: this.settings.muteOnEntry,
    isVideoOff: this.settings.videoOffOnEntry,
  };
  this.participants.push(participant);
  return participant;
};

meetingSchema.methods.removeParticipant = function (userId) {
  const p = this.participants.find(
    (x) => x.userId.toString() === userId.toString() && x.isActive
  );
  if (p) {
    p.leftAt = new Date();
    p.isActive = false;
    p.durationMinutes = Math.max(
      0,
      Math.floor((p.leftAt - p.joinedAt) / 60000)
    );
  }
  return p;
};

meetingSchema.methods.isHostOrCoHost = function (userId) {
  const uid = String(userId && userId._id ? userId._id : userId);
  const hostRaw = this.hostId && this.hostId._id ? this.hostId._id : this.hostId;
  if (hostRaw && String(hostRaw) === uid) return true;
  return (this.coHosts || []).some((id) => {
    const cid = id && id._id ? id._id : id;
    return cid && String(cid) === uid;
  });
};

/** Group-only meetings: only host or invited emails may join */
meetingSchema.methods.canUserJoin = function (user) {
  if (this.isHostOrCoHost(user._id)) return true;
  if (!this.isGroup) return true;
  const allowed = this.allowedEmails || [];
  if (!allowed.length) return true; // open group meeting (no roster)
  const email = (user.email || '').toLowerCase().trim();
  return allowed.includes(email);
};

meetingSchema.methods.getActiveParticipants = function () {
  return this.participants.filter((p) => p.isActive);
};

module.exports = mongoose.model('Meeting', meetingSchema);