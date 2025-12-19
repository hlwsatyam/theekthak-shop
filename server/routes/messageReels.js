const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const reelsController = require('../controllers/reelsController');
const messagesController = require('../controllers/messagesController');

// Reels routes
router.get('/reels/feed', authMiddleware, reelsController.getReelsFeed);
router.post('/reels/:reelId/like', authMiddleware, reelsController.likeReel);
router.post('/reels/:reelId/view', authMiddleware, reelsController.incrementViews);
router.get('/reels/:reelId', authMiddleware, reelsController.getReelById);


// routes/users.js
router.post('/fromReel/:userId/follow', authMiddleware, reelsController.followUser);





// Messages routes
router.post('/messages/conversation', authMiddleware, messagesController.getOrCreateConversation);
router.get('/messages/conversations', authMiddleware, messagesController.getConversations);
router.get('/messages/conversation/:conversationId', authMiddleware, messagesController.getMessages);
router.post('/messages/send', authMiddleware, messagesController.sendMessage);
router.post('/messages/:conversationId/read', authMiddleware, messagesController.markAsRead);

module.exports = router;