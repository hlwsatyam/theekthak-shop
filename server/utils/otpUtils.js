const crypto = require('crypto');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate OTP hash
const generateOTPHash = (email, otp) => {
  return crypto.createHash('sha256').update(email + otp).digest('hex');
};

// Check if OTP is expired
const isOTPExpired = (otpExpires) => {
  return new Date() > new Date(otpExpires);
};

// Send OTP via email (mock function - integrate with email service)
const sendOTPEmail = async (email, otp) => {
  console.log(`OTP for ${email}: ${otp}`);
  
  // In production, you would integrate with an email service like:
  // - SendGrid
  // - AWS SES
  // - Mailgun
  // - Nodemailer
  
  // Example with Nodemailer:
  /*
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'THEEKTHAK - Your OTP Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #FFD700, #FFA500); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">THEEKTHAK</h1>
          <p style="color: white; margin: 5px 0 0 0;">Premium Store Management</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Your Verification Code</h2>
          <p style="color: #666;">Use the following OTP to verify your email:</p>
          <div style="background: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
            <h1 style="color: #FF8C00; font-size: 36px; letter-spacing: 10px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666; font-size: 14px;">
            This OTP is valid for 10 minutes. Do not share this code with anyone.
          </p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© ${new Date().getFullYear()} THEEKTHAK. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
  */
  
  return true; // Return true for development
};

// Send OTP via SMS (mock function - integrate with SMS service)
const sendOTPSMS = async (mobile, otp) => {
  console.log(`SMS OTP for ${mobile}: ${otp}`);
  
  // In production, you would integrate with an SMS service like:
  // - Twilio
  // - MessageBird
  // - AWS SNS
  // - TextLocal
  
  return true; // Return true for development
};

module.exports = {
  generateOTP,
  generateOTPHash,
  isOTPExpired,
  sendOTPEmail,
  sendOTPSMS
};