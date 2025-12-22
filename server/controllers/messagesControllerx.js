const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

exports.getOrCreateConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;
    
    if (!receiverId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Receiver ID is required' 
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, receiverId] }
    });
console.log(req.user._id, receiverId)
    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [req.user._id, receiverId]
      });
      await conversation.save();
    }

    // Get conversation with populated data
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate({
        path: 'participants',
        select: 'username name profileImage'
      })
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username name profileImage'
        }
      });

    res.status(200).json({
      success: true,
      conversation: {
        _id: populatedConversation._id,
        otherParticipant: populatedConversation.participants.find(
          p => p._id.toString() !== req.user._id.toString()
        ),
        lastMessage: populatedConversation.lastMessage,
        unreadCount: populatedConversation.unreadCount,
        updatedAt: populatedConversation.updatedAt
      }
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate({
      path: 'participants',
      select: 'username name profileImage'
    })
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'username name profileImage'
      }
    })
    .sort({ updatedAt: -1 });

    // Format conversations
    const formattedConversations = conversations.map(conv => {
      const otherParticipant = conv.participants.find(
        p => p._id.toString() !== req.user._id.toString()
      );
      
      return {
        _id: conv._id,
        otherParticipant,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount,
        updatedAt: conv.updatedAt
      };
    });

    res.status(200).json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user is part of conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Get messages
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username name profileImage')
      .populate('receiver', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        receiver: req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    // Update unread count
    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCount: 0,
      updatedAt: Date.now()
    });

    const total = await Message.countDocuments({ conversation: conversationId });

    res.status(200).json({
      success: true,
      messages: messages.reverse(), // Return in chronological order
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
      conversationId
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message, reelId } = req.body;
    
    if (!receiverId || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Receiver ID and message are required' 
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, receiverId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [req.user._id, receiverId]
      });
      await conversation.save();
    }

    // Create message
    const newMessage = new Message({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: receiverId,
      message: message.trim(),
      reel: reelId
    });

    await newMessage.save();

    // Update conversation
    await Conversation.findByIdAndUpdate(conversation._id, {
      lastMessage: newMessage._id,
      $inc: { unreadCount: 1 },
      updatedAt: Date.now()
    });

    // Populate message data
    await newMessage.populate('sender', 'username name profileImage');
    await newMessage.populate('receiver', 'username name profileImage');
    if (reelId) {
      await newMessage.populate('reel');
    }

    // Emit socket event if available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(receiverId).emit('newMessage', newMessage);
    }

    res.status(201).json({
      success: true,
      message: newMessage,
      conversationId: conversation._id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    await Message.updateMany(
      {
        conversation: conversationId,
        receiver: req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCount: 0,
      updatedAt: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      message: 'Messages marked as read' 
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({ 
        success: false, 
        message: 'Conversation not found' 
      });
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: conversationId });
    
    // Delete the conversation
    await conversation.deleteOne();

    res.status(200).json({ 
      success: true, 
      message: 'Conversation deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};