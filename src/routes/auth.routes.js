const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', protect, authController.me);
router.post('/logout-all', protect, authController.logoutAll);
router.patch('/profile', protect, authController.updateProfile);

module.exports = router;