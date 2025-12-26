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
async function sendOTdP(email, otp) {
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








async function sendOTP(email, otp) {
  try {
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Added for better performance
      pool: true,
      maxConnections: 3
    });

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>THEEKTHAK - OTP Verification</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          border: 1px solid #f0f0f0;
        }
        
        .header {
          background: linear-gradient(135deg, #FFD700 0%, #FFC400 100%);
          padding: 30px 20px;
          text-align: center;
        }
        
        .logo {
          font-size: 28px;
          font-weight: 800;
          color: #333333;
          margin-bottom: 10px;
          letter-spacing: 1px;
        }
        
        .logo span {
          color: #333333;
        }
        
        .tagline {
          color: #333333;
          font-size: 14px;
          opacity: 0.9;
          font-weight: 500;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .greeting {
          color: #333333;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        
        .otp-container {
          background: #FFF8E1;
          border: 2px dashed #FFD700;
          border-radius: 12px;
          padding: 25px;
          text-align: center;
          margin: 30px 0;
        }
        
        .otp-code {
          font-size: 42px;
          font-weight: 800;
          color: #333333;
          letter-spacing: 8px;
          margin: 15px 0;
          font-family: 'Courier New', monospace;
        }
        
        .otp-label {
          color: #666666;
          font-size: 14px;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        
        .message {
          color: #555555;
          line-height: 1.6;
          font-size: 15px;
          margin-bottom: 25px;
        }
        
        .highlight {
          color: #333333;
          font-weight: 600;
          background: #FFF9C4;
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .warning {
          background: #FFFDE7;
          border-left: 4px solid #FFD700;
          padding: 15px;
          border-radius: 8px;
          margin: 25px 0;
        }
        
        .warning-title {
          color: #333333;
          font-weight: 600;
          margin-bottom: 5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .warning-text {
          color: #666666;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .footer {
          background: #FAFAFA;
          padding: 25px 30px;
          text-align: center;
          border-top: 1px solid #f0f0f0;
        }
        
        .footer-text {
          color: #888888;
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 15px;
        }
        
        .download-buttons {
          margin-top: 20px;
        }
        
        .play-store-btn {
          display: inline-block;
          background: #333333;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          transition: all 0.3s ease;
        }
        
        .play-store-btn:hover {
          background: #444444;
          transform: translateY(-2px);
        }
        
        .app-icon {
          width: 120px;
          height: auto;
          margin-bottom: 20px;
          border-radius: 20px;
          box-shadow: 0 4px 12px rgba(255, 200, 0, 0.2);
        }
        
        @media (max-width: 480px) {
          .content {
            padding: 30px 20px;
          }
          
          .otp-code {
            font-size: 36px;
            letter-spacing: 6px;
          }
          
          .header {
            padding: 25px 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <div class="logo">THEEK<span>THAK</span></div>
          <div class="tagline">Your Complete Home Services Partner</div>
        </div>
        
        <div class="content">
          <h2 class="greeting">Hello,</h2>
          
          <p class="message">
            Thank you for choosing <span class="highlight">THEEKTHAK</span>. Use the OTP below to verify your account and start your journey with us.
          </p>
          
          <div class="otp-container">
            <div class="otp-label">Your Verification Code</div>
            <div class="otp-code">${otp}</div>
            <div class="otp-label">Valid for 10 minutes</div>
          </div>
          
          <p class="message">
            Enter this code in the THEEKTHAK app to complete your verification process.
          </p>
          
          <div class="warning">
            <div class="warning-title">
              <span>⚠️</span> Security Notice
            </div>
            <div class="warning-text">
              • Never share this OTP with anyone<br>
              • THEEKTHAK will never ask for your OTP via call or SMS<br>
              • This code expires in 10 minutes for your security
            </div>
          </div>
        </div>
        
        <div class="footer">
          <p class="footer-text">
            If you didn't request this OTP, please ignore this email or contact our support immediately.
          </p>
          
          <div class="download-buttons">
            <a href="https://play.google.com/store/apps/details?id=com.theekthak&hl=en_IN" 
               class="play-store-btn">
               🔗 Download THEEKTHAK App
            </a>
          </div>
          
          <p class="footer-text" style="margin-top: 20px;">
            Need help? Contact us at: support@theekthak.com<br>
            © 2024 THEEKTHAK. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
    `;

    const mailOptions = {
      from: `"THEEKTHAK" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🔐 THEEKTHAK - OTP Verification',
      html: emailHtml,
      // Text fallback for email clients that don't support HTML
      text: `THEEKTHAK OTP Verification\n\nYour OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nDownload our app: https://play.google.com/store/apps/details?id=com.theekthak&hl=en_IN\n\nIf you didn't request this, please ignore.\n\nTHEEKTHAK Team`
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`✅ OTP sent successfully to: ${email}`);
    
    return {
      success: true,
      message: 'OTP sent successfully',
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Error sending OTP email:', {
      to: email,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Throw a more specific error
    throw new Error(`Failed to send OTP: ${error.message}`);
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
    const otp =email.toLowerCase()==="satyampandit021@gmail.com" ? '123456' : 
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
        otp  : otp ,
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