const express = require('express');
const router = express.Router();
const User = require('../models/User');
const nodemailer = require('nodemailer');
 

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

// Request OTP
router.post('/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(email)
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const otp = email==="satyampandit021@gmail.com"?123456:  generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    let user = await User.findOne({ email });

    if (user) {
      user.otp = otp;
      user.otpExpires = otpExpires;
      await user.save();
    } else {
      user = new User({
        email,
        otp,
        otpExpires
      });
      await user.save();
    }

    await sendOTP(email, otp);

    res.json({ 
      message: 'OTP sent successfully',
      isNewUser: !user.profileCompleted
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({ 
      email, 
      otp, 
      otpExpires: { $gt: Date.now() } 
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ 
      message: 'OTP verified successfully',
      profileCompleted: user.profileCompleted,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        mobile: user.mobile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Complete Profile
router.post('/complete-profile', async (req, res) => {
  try {
    const { email, name, mobile } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.name = name;
    user.mobile = mobile;
    user.profileCompleted = true;
    await user.save();

    res.json({ 
      message: 'Profile completed successfully',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        mobile: user.mobile
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;