const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

exports.getOrCreateConversation = async (req, res) => {
  try {
    const { receiverId } = req.body;
    
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Receiver ID is required' });
    }

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, receiverId] }
    });

    if (!conversation) {
      // Create new conversation
      conversation = new Conversation({
        participants: [req.user._id, receiverId]
      });
      await conversation.save();
    }

    // Get receiver info
    const receiver = await User.findById(receiverId).select('username name profileImage');

    res.json({
      success: true,
      conversation: {
        _id: conversation._id,
        receiver,
        unreadCount: conversation.unreadCount
      }
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getConversations = async (req, res) => {
  console.log("first")
  try {
    const conversations = await Conversation.find({
      participants: req.user._id
    })
    .populate('participants', 'username name profileImage')
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

    res.json({
      success: true,
      conversations: formattedConversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Get messages
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username name profileImage')
      .populate('receiver', 'username name profileImage')
      .populate('reel')
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
    conversation.unreadCount = 0;
    await conversation.save();

    const total = await Message.countDocuments({ conversation: conversationId });

    res.json({
      success: true,
      messages: messages.reverse(),
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, receiverId, message, reelId } = req.body;

    let conversation = conversationId;
    
    // If no conversationId, create/find one
    if (!conversationId) {
      const existingConv = await Conversation.findOne({
        participants: { $all: [req.user._id, receiverId] }
      });
      
      if (existingConv) {
        conversation = existingConv._id;
      } else {
        const newConv = new Conversation({
          participants: [req.user._id, receiverId]
        });
        await newConv.save();
        conversation = newConv._id;
      }
    }

    // Create message
    const newMessage = new Message({
      conversation,
      sender: req.user._id,
      receiver: receiverId,
      message,
      reel: reelId
    });

    await newMessage.save();

    // Update conversation
    await Conversation.findByIdAndUpdate(conversation, {
      lastMessage: newMessage._id,
      $inc: { unreadCount: 1 },
      updatedAt: Date.now()
    });

    // Populate message data
    await newMessage.populate('sender', 'username name profileImage');
    await newMessage.populate('reel');

    // Emit socket event if available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(receiverId).emit('newMessage', {
        conversationId: conversation,
        message: newMessage
      });
    }

    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        receiver: req.user._id,
        isRead: false
      },
      { isRead: true }
    );

    await Conversation.findByIdAndUpdate(conversationId, {
      unreadCount: 0
    });

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};