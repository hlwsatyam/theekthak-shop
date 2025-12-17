const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Reel = require('../models/reelSchema');
const { auth, optionalAuth } = require('../middleware/authx');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { promisify } = require('util');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const statAsync = promisify(fs.stat);

// Configure multer for reel uploads (videos only)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/reels/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept videos only
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed for reels'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB max for videos
  }
});

// Helper function to generate thumbnail
const generateThumbnail = (videoPath, thumbnailPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: path.basename(thumbnailPath),
        folder: path.dirname(thumbnailPath),
        size: '640x360'
      })
      .on('end', () => resolve(thumbnailPath))
      .on('error', (err) => reject(err));
  });
};

// Helper function to get video duration
const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) reject(err);
      resolve(metadata.format.duration);
    });
  });
};

// Create a new reel
router.post('/', auth, upload.single('video'), async (req, res) => {
  try {
    const { caption, description, tags, visibility } = req.body;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No video uploaded'
      });
    }

    const videoPath = req.file.path;
    const videoFilename = req.file.filename;
    const videoUrl = `/uploads/reels/${videoFilename}`;

    // Generate thumbnail
    const thumbnailFilename = `thumb_${path.parse(videoFilename).name}.jpg`;
    const thumbnailPath = path.join('uploads/reels/', thumbnailFilename);
    const thumbnailUrl = `/uploads/reels/${thumbnailFilename}`;

    // Generate thumbnail and get duration
    await generateThumbnail(videoPath, thumbnailPath);
    const duration = await getVideoDuration(videoPath);

    // Check duration (max 60 seconds for reels)
    if (duration > 60) {
      // Clean up uploaded file
      fs.unlinkSync(videoPath);
      return res.status(400).json({
        success: false,
        message: 'Reel duration cannot exceed 60 seconds'
      }); 
    }

    const reel = new Reel({
      user: userId,
      videoUrl,
      thumbnailUrl,
      duration: Math.round(duration),
      caption,
      description,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      visibility: visibility || 'public'
    });

    await reel.save();

    // Populate user details
    await reel.populate('user', 'username name profileImage');

    res.status(201).json({
      success: true,
      message: 'Reel created successfully',
      data: reel
    });

  } catch (error) {
    console.error('Create reel error:', error);
    
    // Clean up uploaded file if exists
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create reel',
      error: error.message
    });
  }
});

// Get all reels (with pagination and filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query based on visibility
    let query = { visibility: 'public' };

    // If user is authenticated
    if (req.user) {
      query = {
        $or: [
          { visibility: 'public' },
          { user: req.user.id },
          { 
            visibility: 'followers_only',
            user: { $in: await getFollowingUsers(req.user.id) }
          }
        ]
      };
    }

    // Filter by user if specified
    if (req.query.userId) {
      query.user = req.query.userId;
    }

    // Filter by duration if specified
    if (req.query.maxDuration) {
      query.duration = { $lte: parseInt(req.query.maxDuration) };
    }

    // Get trending reels (most views/likes)
    if (req.query.sort === 'trending') {
      const reels = await Reel.find(query)
        .populate('user', 'username name profileImage followersCount')
        .sort({ viewsCount: -1, likesCount: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Reel.countDocuments(query);

      return res.json({
        success: true,
        data: reels,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }

    // Get reels with pagination
    const reels = await Reel.find(query)
      .populate('user', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Increment view count for each reel (for analytics)
    if (reels.length > 0 && req.user) {
      // You might want to track individual views
      // For now, just log that views were incremented
    }

    const total = await Reel.countDocuments(query);

    res.json({
      success: true,
      data: reels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get reels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reels',
      error: error.message
    });
  }
});

// Get a single reel
router.get('/:reelId', optionalAuth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.reelId)
      .populate('user', 'username name profileImage followersCount followingCount')
      .lean();

    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    // Check visibility
    if (reel.visibility === 'private' && 
        (!req.user || reel.user._id.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'This reel is private'
      });
    }

    // Check followers_only visibility
    if (reel.visibility === 'followers_only' && req.user) {
      const isFollowing = await checkIfFollowing(req.user.id, reel.user._id);
      if (!isFollowing && reel.user._id.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'This reel is only visible to followers'
        });
      }
    }

    // Increment view count
    if (req.user) {
      await Reel.findByIdAndUpdate(reel._id, {
        $inc: { viewsCount: 1 }
      });
      reel.viewsCount += 1;
    }

    // Get related reels
    const relatedReels = await Reel.find({
      _id: { $ne: reel._id },
      user: reel.user,
      visibility: 'public'
    })
    .populate('user', 'username name profileImage')
    .limit(3)
    .lean();

    res.json({
      success: true,
      data: {
        ...reel,
        relatedReels
      }
    });

  } catch (error) {
    console.error('Get reel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reel',
      error: error.message
    });
  }
});

// Update a reel
router.put('/:reelId', auth, async (req, res) => {
  try {
    const { caption, description, tags, visibility } = req.body;
    const reelId = req.params.reelId;

    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    // Check ownership
    if (reel.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this reel'
      });
    }

    // Update fields
    if (caption !== undefined) reel.caption = caption;
    if (description !== undefined) reel.description = description;
    if (tags !== undefined) reel.tags = tags.split(',').map(tag => tag.trim());
    if (visibility !== undefined) reel.visibility = visibility;

    await reel.save();

    res.json({
      success: true,
      message: 'Reel updated successfully',
      data: reel
    });

  } catch (error) {
    console.error('Update reel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reel',
      error: error.message
    });
  }
});

// Delete a reel
router.delete('/:reelId', auth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    // Check ownership
    if (reel.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this reel'
      });
    }

    // Delete the video and thumbnail files
    if (reel.videoUrl) {
      const videoPath = path.join(__dirname, '..', reel.videoUrl);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }

    if (reel.thumbnailUrl) {
      const thumbPath = path.join(__dirname, '..', reel.thumbnailUrl);
      if (fs.existsSync(thumbPath)) {
        fs.unlinkSync(thumbPath);
      }
    }

    await reel.deleteOne();

    res.json({
      success: true,
      message: 'Reel deleted successfully'
    });

  } catch (error) {
    console.error('Delete reel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete reel',
      error: error.message
    });
  }
});

// Get user's reels
router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query based on visibility
    let query = { user: userId };

    // If viewing own profile or admin
    if (req.user && (req.user.id === userId || req.user.role === 'admin')) {
      // Show all reels
    } else if (req.user) {
      // Show public reels and followers_only if following
      const isFollowing = await checkIfFollowing(req.user.id, userId);
      query = {
        user: userId,
        $or: [
          { visibility: 'public' },
          { 
            visibility: 'followers_only',
            $expr: { $eq: [isFollowing, true] }
          }
        ]
      };
    } else {
      // Anonymous user - only public reels
      query = {
        user: userId,
        visibility: 'public'
      };
    }

    const reels = await Reel.find(query)
      .populate('user', 'username name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Reel.countDocuments(query);

    res.json({
      success: true,
      data: reels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get user reels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user reels',
      error: error.message
    });
  }
});

// Like a reel
router.post('/:reelId/like', auth, async (req, res) => {
  try {
    const reelId = req.params.reelId;
    
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    // Check if already liked (you need to implement a Like model)
    // For now, just increment likes count
    reel.likesCount += 1;
    await reel.save();

    res.json({
      success: true,
      message: 'Reel liked',
      likesCount: reel.likesCount
    });

  } catch (error) {
    console.error('Like reel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like reel',
      error: error.message
    });
  }
});

// Unlike a reel
router.post('/:reelId/unlike', auth, async (req, res) => {
  try {
    const reelId = req.params.reelId;
    
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    if (reel.likesCount > 0) {
      reel.likesCount -= 1;
      await reel.save();
    }

    res.json({
      success: true,
      message: 'Reel unliked',
      likesCount: reel.likesCount
    });

  } catch (error) {
    console.error('Unlike reel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlike reel',
      error: error.message
    });
  }
});

// Share a reel
router.post('/:reelId/share', auth, async (req, res) => {
  try {
    const reelId = req.params.reelId;
    
    const reel = await Reel.findById(reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    // Increment shares count
    reel.sharesCount += 1;
    await reel.save();

    res.json({
      success: true,
      message: 'Reel shared',
      sharesCount: reel.sharesCount,
      shareUrl: `${req.protocol}://${req.get('host')}/reels/${reelId}`
    });

  } catch (error) {
    console.error('Share reel error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share reel',
      error: error.message
    });
  }
});

// Get reel analytics (for reel owner)
router.get('/:reelId/analytics', auth, async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.reelId);
    if (!reel) {
      return res.status(404).json({
        success: false,
        message: 'Reel not found'
      });
    }

    // Check ownership
    if (reel.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view analytics'
      });
    }

    // Basic analytics
    const analytics = {
      viewsCount: reel.viewsCount,
      likesCount: reel.likesCount,
      commentsCount: reel.commentsCount,
      sharesCount: reel.sharesCount,
      duration: reel.duration,
      engagementRate: calculateEngagementRate(reel),
      averageViewTime: 0, // You'll need to implement view time tracking
      createdAt: reel.createdAt,
      lastUpdated: reel.updatedAt
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Get reel analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error: error.message
    });
  }
});

// Get trending reels
router.get('/explore/trending', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    let query = { visibility: 'public' };

    // If user is authenticated
    if (req.user) {
      query = {
        $or: [
          { visibility: 'public' },
          { 
            visibility: 'followers_only',
            user: { $in: await getFollowingUsers(req.user.id) }
          }
        ]
      };
    }

    // Get trending reels (combination of views, likes, and recency)
    const reels = await Reel.find(query)
      .populate('user', 'username name profileImage followersCount')
      .sort({
        // Custom trending algorithm
        // Weighted combination of views, likes, and recency
        // You can adjust these weights based on your needs
        // score = (viewsCount * 0.4) + (likesCount * 0.4) + (sharesCount * 0.2)
      })
      .limit(limit)
      .lean();

    // Calculate trending score
    reels.forEach(reel => {
      const daysSinceCreation = (new Date() - new Date(reel.createdAt)) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.max(0, 1 - (daysSinceCreation / 30)); // 30-day window
      
      reel.trendingScore = (
        (reel.viewsCount * 0.4) +
        (reel.likesCount * 0.4) +
        (reel.sharesCount * 0.2)
      ) * recencyFactor;
    });

    // Sort by trending score
    reels.sort((a, b) => b.trendingScore - a.trendingScore);

    res.json({
      success: true,
      data: reels
    });

  } catch (error) {
    console.error('Get trending reels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending reels',
      error: error.message
    });
  }
});

// Helper functions
async function getFollowingUsers(userId) {
  const Follow = require('../models/followSchema');
  const follows = await Follow.find({ follower: userId }).select('following');
  return follows.map(f => f.following);
}

async function checkIfFollowing(followerId, followingId) {
  const Follow = require('../models/followSchema');
  const follow = await Follow.findOne({
    follower: followerId,
    following: followingId
  });
  return !!follow;
}

function calculateEngagementRate(reel) {
  // Engagement rate = (likes + comments + shares) / views * 100
  if (reel.viewsCount === 0) return 0;
  
  const totalEngagement = reel.likesCount + reel.commentsCount + reel.sharesCount;
  return ((totalEngagement / reel.viewsCount) * 100).toFixed(2);
}

module.exports = router;