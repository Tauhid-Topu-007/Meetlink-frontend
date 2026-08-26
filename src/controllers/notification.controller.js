const notificationService = require('../services/notification.service');

exports.list = async (req, res, next) => {
  try {
    const result = await notificationService.listForUser(req.user._id, {
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 30,
      unreadOnly: req.query.unreadOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const ids = req.body.ids || [];
    await notificationService.markRead(req.user._id, ids);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await notificationService.markAllRead(req.user._id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};