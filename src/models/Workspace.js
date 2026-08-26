const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, maxlength: 1000, default: '' },
    logo: { type: String, default: null },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [memberSchema],
    isPublic: { type: Boolean, default: false },
    settings: {
      allowMemberInvites: { type: Boolean, default: true },
      defaultMeetingSettings: {
        waitingRoomEnabled: { type: Boolean, default: true },
        muteOnEntry: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ slug: 1 });
workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);