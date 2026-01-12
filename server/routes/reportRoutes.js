// backend/routes/reportRoutes.js में corrections
const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const Reel = require('../models/reelSchema'); // यह आपका actual model name है
const { authMiddleware } = require('../middleware/auth');

// Report a reel
router.post('/reels/:reelId/report', authMiddleware, async (req, res) => {
  try {
    const { reason, description } = req.body;
    const { reelId } = req.params;
    
    // Check if reel exists
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({ 
        success: false,
        message: 'Reel not found' 
      });
    }
    
    // Check if user already reported this reel
    const existingReport = await Report.findOne({
      reporterId: req.user._id, // req.user._id use करें
      reportedReelId: reelId
    });
    
    if (existingReport) {
      return res.status(400).json({ 
        success: false,
        message: 'You have already reported this reel' 
      });
    }
    
    // Create report
    const report = new Report({
      reporterId: req.user._id,
      reportedReelId: reelId,
      reason,
      description: description || ''
    });
    
    await report.save();
    
    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

// Get user's reports
router.get('/my-reports', authMiddleware, async (req, res) => {
  try {
    const reports = await Report.find({ reporterId: req.user._id })
      .populate('reportedReelId', 'caption videoUrl thumbnail')
      .sort({ createdAt: -1 });
    
    res.json({ 
      success: true,
      reports 
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});

module.exports = router;