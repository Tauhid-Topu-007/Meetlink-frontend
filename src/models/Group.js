const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: true }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [groupMemberSchema],
      default: [],
    },
    color: { type: String, default: '#6366f1' },
  },
  { timestamps: true }
);

groupSchema.index({ ownerId: 1, name: 1 });

module.exports = mongoose.model('Group', groupSchema);
