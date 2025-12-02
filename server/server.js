const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
app.use((req, res, next) => {
  console.log(`🔥 ${req.method} - ${req.originalUrl}`);
  next();
});
// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/theekthak', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(c=>console.log("connect DB")).catch(e=>console.log("error Conn DB"))

// Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/stores', require('./routes/stores.js'));
app.use('/api/products', require('./routes/products.js'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});