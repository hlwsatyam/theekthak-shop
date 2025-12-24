 


const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

// Middleware
const errorHandler = require('./middleware/errorHandler.js');
 

const app = express();

// 🔥 Logger
app.use((req, res, next) => {
  console.log(`🔥 ${req.method} - ${req.originalUrl}`);
  next();
});

// Basic middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limit (optional)
// app.use('/api/', apiLimiter);

// MongoDB
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theekthak')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(() => console.log('❌ MongoDB Connection Error'));

// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/socialusers', require('./routes/usersRoutes.js'));
app.use('/api/follow', require('./routes/followRoutes.js'));
app.use('/api/posts', require('./routes/postRoutes.js'));
app.use('/api/reels', require('./routes/reelRoutes.js'));
app.use('/api/upload', require('./routes/uploadRoutes.js'));

app.use('/api/stores', require('./routes/stores.js'));
app.use('/api/products', require('./routes/products.js'));
app.use('/api/subscriptions', require('./routes/subscriptions.js'));
app.use('/api/users', require('./routes/users.js'));
app.use('/api/scan', require('./routes/scan.js'));
app.use('/api/messageReels', require('./routes/messageReels.js'));



const messageRoutes = require('./routes/messagesFromReel.js');
const Conversation = require('./models/Conversation.js');
const Message = require('./models/Message.js');
app.use('/api/messagesFromReel', messageRoutes);



// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}); 
// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

/* ============================
   🚀 SOCKET.IO SERVER SETUP
============================ */

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: {
//     origin: '*', // frontend URL daal sakte ho
//     methods: ['GET', 'POST']
//   }
// });
 


//   const userSockets = new Map();

// io.on('connection', (socket) => {
//   console.log('New client connected:', socket.id);

//   // User joins with their user ID
//   socket.on('join', (userId) => {
//     userSockets.set(userId, socket.id);
//     socket.userId = userId;
//     console.log(`User ${userId} joined with socket ${socket.id}`);
//   });

//   // Join conversation room
//   socket.on('joinConversation', (conversationId) => {
//     socket.join(conversationId);
//   });

//   // Send message
//   socket.on('sendMessage', (data) => {
//     const { conversationId, receiverId, message } = data;
    
//     // Broadcast to conversation room
//     socket.to(conversationId).emit('newMessage', message);
    
//     // Also send to specific user if they're not in the room
//     const receiverSocketId = userSockets.get(receiverId);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit('newMessageNotification', {
//         conversationId,
//         message
//       });
//     }
//   });

//   // Typing indicator
//   socket.on('typing', (data) => {
//     const { conversationId, receiverId, isTyping } = data;
    
//     socket.to(conversationId).emit('userTyping', {
//       senderId: socket.userId,
//       isTyping
//     });
//   });

//   socket.on('disconnect', () => {
//     // Remove user from map
//     for (const [userId, socketId] of userSockets.entries()) {
//       if (socketId === socket.id) {
//         userSockets.delete(userId);
//         console.log(`User ${userId} disconnected`);
//         break;
//       }
//     }
//   });
// });


 
// asdsa
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

 
const onlineUsers = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // User login
  socket.on('login', (userId) => {
    onlineUsers[userId] = socket.id;
    socket.userId = userId;
    console.log('User logged in:', userId);
  });

  // Start chat
  socket.on('startChat', async (data, callback) => {
    try {
      const { receiverId } = data;
      
      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [socket.userId, receiverId] }
      });

      if (!conversation) {
        conversation = new Conversation({
          participants: [socket.userId, receiverId]
        });
        await conversation.save();
      }

      socket.join(conversation._id.toString());
      callback({ success: true, conversationId: conversation._id });
      
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Get messages
  socket.on('getMessages', async (data, callback) => {
    try {
      const { conversationId } = data;
      
      const messages = await Message.find({ conversation: conversationId })
        .populate('sender', 'username profileImage')
        .sort({ createdAt: 1 })
        .lean();

      // Mark as read
      await Message.updateMany(
        { 
          conversation: conversationId, 
          receiver: socket.userId, 
          isRead: false 
        },
        { isRead: true }
      );

      callback({ success: true, messages });
      
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Send message
  socket.on('sendMessage', async (data, callback) => {
    try {
      const { conversationId, receiverId, message, tempId } = data;
      
      // Save to DB
      const newMessage = new Message({
        conversation: conversationId,
        sender: socket.userId,
        receiver: receiverId,
        message: message.trim()
      });
      await newMessage.save();

      // Populate sender
      const savedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'username profileImage')
        .lean();

      // Update conversation
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: newMessage._id,
        updatedAt: new Date()
      });

      // Send to sender
      callback({ 
        success: true, 
        message: savedMessage, 
        tempId 
      });

      // Send to receiver
      const receiverSocketId = onlineUsers[receiverId];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receiveMessage', savedMessage);
      }

      // Also send to conversation room
      socket.to(conversationId).emit('receiveMessage', savedMessage);
      
    } catch (error) {
      callback({ success: false, error: error.message, tempId });
    }
  });

  // Typing
  socket.on('typing', (data) => {
    const { receiverId, isTyping } = data;
    const receiverSocketId = onlineUsers[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing', { 
        userId: socket.userId, 
        isTyping 
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
    if (socket.userId) {
      delete onlineUsers[socket.userId];
    }
  });
});




















// asdasd
/* ============================
   SERVER START
============================ */

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.IO running on port ${PORT}`);
});

 
