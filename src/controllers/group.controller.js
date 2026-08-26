const Group = require('../models/Group');
const Meeting = require('../models/Meeting');
const meetingService = require('../services/meeting.service');

const listMine = async (req, res, next) => {
  try {
    const groups = await Group.find({ ownerId: req.user._id }).sort({ updatedAt: -1 });
    res.json({ groups });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, description, members, color } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }
    const group = await Group.create({
      name: name.trim(),
      description: description || '',
      ownerId: req.user._id,
      members: Array.isArray(members) ? members : [],
      color: color || '#6366f1',
    });
    res.status(201).json({ group });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    const { name, description, members, color } = req.body;
    if (name !== undefined) group.name = name.trim();
    if (description !== undefined) group.description = description;
    if (members !== undefined) group.members = members;
    if (color !== undefined) group.color = color;
    await group.save();
    res.json({ group });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const group = await Group.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    next(err);
  }
};

/** Host schedules a meeting for a group at a specific time */
const scheduleMeeting = async (req, res, next) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const { title, scheduledStart, scheduledEnd, password, waitingRoomEnabled, description } = req.body;
    if (!scheduledStart) {
      return res.status(400).json({ message: 'scheduledStart is required' });
    }

    const start = new Date(scheduledStart);
    if (Number.isNaN(start.getTime()) || start < new Date(Date.now() - 60000)) {
      return res.status(400).json({ message: 'Pick a valid future date and time' });
    }

    const allowedEmails = (group.members || [])
      .map((m) => (m.email || '').toLowerCase().trim())
      .filter(Boolean);

    const meeting = await meetingService.createMeeting(req.user, {
      title: title?.trim() || `${group.name} Meeting`,
      description: description || group.description || '',
      type: 'scheduled',
      isGroup: true,
      groupName: group.name,
      groupId: group._id,
      allowedEmails,
      scheduledStart: start,
      scheduledEnd: scheduledEnd ? new Date(scheduledEnd) : null,
      password: password || '',
      waitingRoomEnabled: waitingRoomEnabled !== false,
      settings: { waitingRoomEnabled: waitingRoomEnabled !== false },
    });

    // Invite members who have email
    const emails = (group.members || []).map((m) => m.email).filter(Boolean);
    if (emails.length) {
      try {
        await meetingService.inviteByEmail(meeting, req.user, emails);
      } catch (e) {
        console.warn('Group invite emails partial fail', e.message);
      }
    }

    const populated = await Meeting.findById(meeting._id)
      .populate('hostId', 'displayName email phone')
      .lean();

    res.status(201).json({
      meeting: populated,
      invitedCount: emails.length,
      group: { id: group._id, name: group.name, memberCount: group.members.length },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listMine, create, update, remove, scheduleMeeting };
