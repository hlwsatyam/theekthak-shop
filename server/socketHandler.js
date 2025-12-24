// server/socketHandler.js
const socketIO = require('socket.io');
const User = require('./models/User');

class SocketHandler {
  constructor(server) {
    this.io = socketIO(server, {
      transports: ['websocket', 'polling'],
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      allowEIO3: true
    });

    this.userSockets = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId
    this.userStatus = new Map(); // userId -> {online: boolean, lastSeen: Date}
    this.userRooms = new Map(); // userId -> Set(roomIds)

    this.initialize();
  }

  initialize() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        // Verify token and get user
        const user = await this.verifyToken(token);
        if (!user) {
          return next(new Error('Authentication error'));
        }

        socket.userId = user._id.toString();
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id} for user: ${socket.userId}`);

      // Register user
      this.registerUser(socket.userId, socket.id);

      // Join user to their personal room
      socket.join(`user_${socket.userId}`);

      // Emit online status to user's friends
      this.broadcastUserStatus(socket.userId, true);

      // Handle joining conversation
      socket.on('joinConversation', (conversationId) => {
        this.joinConversation(socket, conversationId);
      });

      // Handle leaving conversation
      socket.on('leaveConversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        this.removeUserFromRoom(socket.userId, conversationId);
      });

      // Handle typing indicator
      socket.on('typing', (data) => {
        this.handleTyping(socket, data);
      });

      // Handle send message
      socket.on('sendMessage', (data) => {
        this.handleSendMessage(socket, data);
      });

      // Handle read receipt
      socket.on('messageRead', (data) => {
        this.handleMessageRead(socket, data);
      });

      // Handle delete message
      socket.on('deleteMessage', (data) => {
        this.handleDeleteMessage(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle manual reconnection
      socket.on('reconnect', () => {
        console.log(`User ${socket.userId} reconnected`);
        this.registerUser(socket.userId, socket.id);
        socket.join(`user_${socket.userId}`);
        this.broadcastUserStatus(socket.userId, true);
      });

      // Heartbeat for connection monitoring
      socket.on('heartbeat', () => {
        socket.emit('heartbeat', { timestamp: Date.now() });
      });
    });
  }

  async verifyToken(token) {
    // Implement your JWT verification logic here
    // This should return the user object
    try {
      const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
      return await User.findById(decoded.id);
    } catch (error) {
      return null;
    }
  }

  registerUser(userId, socketId) {
    // Remove previous socket connection for this user
    const oldSocketId = this.userSockets.get(userId);
    if (oldSocketId && oldSocketId !== socketId) {
      const oldSocket = this.io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }

    // Register new connection
    this.userSockets.set(userId, socketId);
    this.socketUsers.set(socketId, userId);
    this.userStatus.set(userId, {
      online: true,
      lastSeen: null,
      socketId: socketId
    });

    console.log(`User ${userId} registered with socket ${socketId}`);
  }

  joinConversation(socket, conversationId) {
    const roomName = `conversation_${conversationId}`;
    socket.join(roomName);

    // Track user's rooms
    if (!this.userRooms.has(socket.userId)) {
      this.userRooms.set(socket.userId, new Set());
    }
    this.userRooms.get(socket.userId).add(conversationId);

    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  }

  removeUserFromRoom(userId, conversationId) {
    const userRooms = this.userRooms.get(userId);
    if (userRooms) {
      userRooms.delete(conversationId);
    }
  }

  async handleTyping(socket, data) {
    const { conversationId, isTyping } = data;
    
    // Broadcast to conversation room except sender
    socket.to(`conversation_${conversationId}`).emit('userTyping', {
      userId: socket.userId,
      conversationId,
      isTyping,
      timestamp: Date.now()
    });

    // Also send to receiver's personal room for notifications
    const receiverSocketId = this.userSockets.get(data.receiverId);
    if (receiverSocketId && receiverSocketId !== socket.id) {
      this.io.to(receiverSocketId).emit('typingNotification', {
        userId: socket.userId,
        conversationId,
        isTyping
      });
    }
  }

  async handleSendMessage(socket, data) {
    try {
      const { conversationId, receiverId, message, tempId } = data;
      
      // Save message to database
      const savedMessage = await this.saveMessageToDatabase({
        conversationId,
        senderId: socket.userId,
        receiverId,
        message
      });

      // Prepare message data for broadcasting
      const messageData = {
        ...savedMessage.toObject(),
        tempId, // Include tempId for client-side tracking
        sender: {
          _id: socket.userId,
          username: savedMessage.sender?.username || 'Unknown',
          profileImage: savedMessage.sender?.profileImage
        }
      };

      // Emit to sender for confirmation
      socket.emit('messageSent', {
        tempId,
        message: messageData
      });

      // Broadcast to conversation room
      this.io.to(`conversation_${conversationId}`).emit('newMessage', messageData);

      // Send notification to receiver if not in conversation room
      const receiverSocketId = this.userSockets.get(receiverId);
      if (receiverSocketId && !socket.rooms.has(`conversation_${conversationId}`)) {
        this.io.to(receiverSocketId).emit('newMessageNotification', {
          conversationId,
          message: messageData,
          unreadCount: await this.getUnreadCount(receiverId, conversationId)
        });
      }

      // Update conversation last message
      await this.updateConversation(conversationId, savedMessage._id);

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('messageError', {
        tempId: data.tempId,
        error: 'Failed to send message'
      });
    }
  }

  async handleMessageRead(socket, data) {
    const { messageId, conversationId } = data;
    
    // Update message as read in database
    await this.markMessageAsRead(messageId, socket.userId);

    // Broadcast read receipt to conversation
    socket.to(`conversation_${conversationId}`).emit('messageRead', {
      messageId,
      userId: socket.userId,
      conversationId,
      timestamp: Date.now()
    });
  }

  async handleDeleteMessage(socket, data) {
    const { messageId, conversationId } = data;
    
    // Delete message from database (soft delete)
    await this.deleteMessage(messageId, socket.userId);

    // Broadcast delete event to conversation
    this.io.to(`conversation_${conversationId}`).emit('messageDeleted', {
      messageId,
      userId: socket.userId,
      conversationId
    });
  }

  async handleDisconnect(socket) {
    const userId = socket.userId;
    
    if (userId) {
      // Update user status
      this.userStatus.set(userId, {
        online: false,
        lastSeen: new Date(),
        socketId: null
      });

      // Remove socket mappings
      this.userSockets.delete(userId);
      this.socketUsers.delete(socket.id);

      // Broadcast offline status
      this.broadcastUserStatus(userId, false);

      console.log(`User ${userId} disconnected`);
    }
  }

  broadcastUserStatus(userId, isOnline) {
    // Get user's friends/followers
    const followers = this.getUserFollowers(userId); // Implement this based on your user relations
    
    followers.forEach(followerId => {
      const followerSocketId = this.userSockets.get(followerId);
      if (followerSocketId) {
        this.io.to(followerSocketId).emit('userStatusChange', {
          userId,
          isOnline,
          lastSeen: isOnline ? null : new Date()
        });
      }
    });
  }

  // Database operations (implement these based on your models)
  async saveMessageToDatabase(messageData) {
    const Message = require('./models/Message');
    const message = new Message(messageData);
    return await message.save();
  }

  async markMessageAsRead(messageId, userId) {
    const Message = require('./models/Message');
    return await Message.findByIdAndUpdate(
      messageId,
      { isRead: true },
      { new: true }
    );
  }

  async deleteMessage(messageId, userId) {
    const Message = require('./models/Message');
    return await Message.findByIdAndUpdate(
      messageId,
      { deleted: true, deletedBy: userId },
      { new: true }
    );
  }

  async updateConversation(conversationId, lastMessageId) {
    const Conversation = require('./models/Conversation');
    return await Conversation.findByIdAndUpdate(
      conversationId,
      {
        lastMessage: lastMessageId,
        updatedAt: new Date()
      },
      { new: true }
    );
  }

  async getUnreadCount(userId, conversationId) {
    const Message = require('./models/Message');
    return await Message.countDocuments({
      conversation: conversationId,
      receiver: userId,
      isRead: false
    });
  }

  getUserFollowers(userId) {
    // Implement based on your user relationship model
    // This should return array of follower IDs
    return [];
  }

  // Utility methods
  isUserOnline(userId) {
    const status = this.userStatus.get(userId);
    return status ? status.online : false;
  }

  getUserSocketId(userId) {
    return this.userSockets.get(userId);
  }

  getOnlineUsers() {
    const onlineUsers = [];
    for (const [userId, status] of this.userStatus.entries()) {
      if (status.online) {
        onlineUsers.push(userId);
      }
    }
    return onlineUsers;
  }

  // Cleanup old connections
  cleanupOldConnections() {
    const now = Date.now();
    const hourAgo = now - (60 * 60 * 1000);
    
    for (const [socketId, userId] of this.socketUsers.entries()) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket || !socket.connected) {
        this.socketUsers.delete(socketId);
        this.userSockets.delete(userId);
      }
    }
  }
}

module.exports = SocketHandler;