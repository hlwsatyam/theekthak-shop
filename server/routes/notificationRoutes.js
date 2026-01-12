// backend/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FirebaseNotificationService = require('../services/firebaseNotificationService');
router.get('/send-to-all', async (req, res) => {
  try {
    const { title, body } = req.query;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'title and body are required in query params',
      });
    }

    const users = await User.find(
      { fcmToken: { $exists: true, $ne: null } },
      { fcmToken: 1, _id: 0 }
    );

    const tokens = users.map(u => u.fcmToken);

    if (!tokens.length) {
      return res.status(400).json({
        success: false,
        message: 'No users with FCM tokens found',
      });
    }

    const response = await FirebaseNotificationService.sendToAllUsers(
      title,
      body,
      { type: 'GLOBAL' },
      tokens
    );

    res.json({
      success: true,
      title,
      body,
      sent: response.successCount,
      failed: response.failureCount,
    });
  } catch (error) {
    console.error('FCM Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;