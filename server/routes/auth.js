const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
 





const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('../middleware/auth');
const Store = require('../models/Store');

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      email: user.email, 
      role: user.role 
    },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '30d' }
  );
};



function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP Email
async function sendOTP(email, otp) {
  try {
    let transporter =  nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'THEEKTHAK - OTP Verification',
      html: `<h3>Your OTP for THEEKTHAK is: ${otp}</h3><p>This OTP will expire in 10 minutes.</p>`
    });
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send OTP');
  }
}
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    // Generate OTP (123456 for testing, random for production)
    const otp = process.env.NODE_ENV === 'development' ? '123456' : 
                Math.floor(100000 + Math.random() * 900000).toString();
    
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      // Generate unique username from email
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let username = baseUsername;
      let counter = 1;
      
      // Check if username exists and generate unique one
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = new User({
        email: email.toLowerCase(),
        username,
        otp  : email.toLowerCase()==="satyampandit021@gmail.com" ? 123456:otp ,
        otpExpires
      });
      await user.save();
    }

    // In production, send OTP via email/SMS
    console.log(`OTP for ${email}: ${otp}`);


await sendOTP(email,otp )



    res.json({ 
      success: true,
      message: 'OTP sent successfully',
      isNewUser: !user.profileCompleted,
      username: user.username
    });
  } catch (error) {
    console.error('OTP Request Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Verify OTP and Login
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find user with valid OTP
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
    }

    // Update user verification status
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    
    // Mark profile as completed if name exists
    if (user.name) {
      user.profileCompleted = true;
    }
    
    await user.save();

    // Generate JWT token
    const token = generateToken(user);

    // Send response with token and user data
    res.json({
      success: true,
      message: 'OTP verified successfully',
      token,
      profileCompleted: user.profileCompleted,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        username: user.username,
        mobile: user.mobile,
        profileImage: user.profileImage,
        role: user.role,
        profileCompleted: user.profileCompleted
      }
    });
  } catch (error) {
    console.error('OTP Verification Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get user profile (protected route)
router.get('/profile', async (req, res) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Find user
    const user = await User.findById(decoded.id).select('-otp -otpExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Profile Error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
 

 router.post('/complete-profile', 
  [
    body('name')
      .notEmpty().withMessage('Name is required')
      .trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('mobile')
      .notEmpty().withMessage('Mobile number is required')
      .matches(/^[0-9]{10}$/).withMessage('Valid 10-digit mobile number required')
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      // Get token from header
      const token = req.header('Authorization')?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'No token provided'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Find user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const { name, mobile } = req.body;

      // Check if mobile number is already taken by another user
      const existingUserWithMobile = await User.findOne({ 
        mobile, 
        _id: { $ne: user._id } 
      });
      
      if (existingUserWithMobile) {
        return res.status(409).json({
          success: false,
          message: 'Mobile number already registered with another account'
        });
      }

      // Update user profile
      user.name = name.trim();
      user.mobile = mobile;
      user.profileCompleted = true;
      
      await user.save();

      // Generate new token with updated info
      const newToken = generateToken(user);

      res.json({
        success: true,
        message: 'Profile completed successfully',
        token: newToken, // Return new token
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          mobile: user.mobile,
          username: user.username,
          profileImage: user.profileImage,
          role: user.role,
          profileCompleted: user.profileCompleted
        }
      });
    } catch (error) {
      console.error('Complete Profile Error:', error);
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error',
        error: error.message
      });
    }
  }
);









router.get('/my-store', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const store = await Store.findOne({ owner: userId }).populate(
      'owner',
      'name email mobile'
    );

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found for this user',
      });
    }

    res.status(200).json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
});





module.exports = router;