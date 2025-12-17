const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();


// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');




const app = express();
app.use((req, res, next) => {
  console.log(`🔥 ${req.method} - ${req.originalUrl}`);
  next();
});
// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));





// Apply rate limiting to all API routes
// app.use('/api/', apiLimiter);



// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theekthak', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(c=>console.log("connect DB")).catch(e=>console.log("error Conn DB"))




const storeRoutes = require('./routes/stores');
const productRoutes = require('./routes/products');
const subscriptionRoutes = require('./routes/subscriptions.js');
const userRoutes = require('./routes/users.js');
const scanRoutes = require('./routes/scan.js');





// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/socialusers', require('./routes/usersRoutes.js'));
app.use('/api/follow', require('./routes/followRoutes.js'));
app.use('/api/posts', require('./routes/postRoutes.js'));
app.use('/api/reels', require('./routes/reelRoutes.js'));
app.use('/api/upload', require('./routes/uploadRoutes.js'));



app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scan', scanRoutes);





app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use(errorHandler);





const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});