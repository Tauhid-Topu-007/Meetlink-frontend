const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
      default: 'pending',
    },
    message: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

connectionSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

module.exports = mongoose.model('Connection', connectionSchema);