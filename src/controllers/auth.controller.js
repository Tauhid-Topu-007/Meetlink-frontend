const authService = require('../services/auth.service');
const User = require('../models/User');

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, displayName, phone } = req.body;
    const result = await authService.register({ username, email, password, displayName, phone });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res) => {
  res.json({ success: true, user: req.user.toPublicJSON() });
};

exports.logoutAll = async (req, res, next) => {
  try {
    await authService.logoutAllDevices(req.user._id);
    res.json({ success: true, message: 'Logged out from all devices' });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['displayName', 'bio', 'avatar', 'phone', 'preferences'];
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) req.user[k] = req.body[k];
    });
    await req.user.save();
    res.json({ success: true, user: req.user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
};