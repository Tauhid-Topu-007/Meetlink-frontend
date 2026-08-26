const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    name: String,
    url: String,
    mimeType: String,
    sizeBytes: Number,
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    // Context: one of these should be set
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    channelId: { type: mongoose.Schema.Types.ObjectId },
    // DM
    conversationId: { type: String, index: true }, // sorted userIds join
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: { type: String, maxlength: 10000, default: '' },
    type: {
      type: String,
      enum: ['text', 'file', 'image', 'system', 'poll', 'announcement'],
      default: 'text',
    },
    attachments: [attachmentSchema],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    reactions: [reactionSchema],
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isEdited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    deliveryStatus: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

messageSchema.index({ meetingId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ teamId: 1, channelId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);