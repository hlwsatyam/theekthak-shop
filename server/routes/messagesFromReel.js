const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const messagesController = require('../controllers/messagesControllerx.js');

// Get or create conversation with a user
router.post('/conversation', authMiddleware, messagesController.getOrCreateConversation);

// Get all conversations for current user
router.get('/conversations', authMiddleware, messagesController.getConversations);

// Get messages for a specific conversation
router.get('/conversation/:conversationId', authMiddleware, messagesController.getMessages);

// Send a new message
router.post('/send', authMiddleware, messagesController.sendMessage);

// Mark messages as read
router.post('/:conversationId/read', authMiddleware, messagesController.markAsRead);

// Delete conversation
router.delete('/conversation/:conversationId', authMiddleware, messagesController.deleteConversation);

module.exports = router;