const express = require('express');
const router = express.Router();
const multer = require('multer');
 
const Post = require('../models/postSchema');
const Reel = require('../models/reelSchema');
const { authMiddleware:  auth} = require('../middleware/auth');

// Configure multer for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
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
const storagex = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/products/';
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
   cb(null, true);
};
const fileFilterx = (req, file, cb) => {
   cb(null, true);
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: {
    fileSize: 10000 * 1024 * 1024 // 100MB max
  }
});
const uploadx = multer({ 
 storage: storagex, 
  fileFilterx,
  limits: {
    fileSize: 10000 * 1024 * 1024 // 100MB max
  }
});

const path = require('path');
const fs = require('fs');
 const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);



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







router.post('/uploadForEdit', auth, uploadx.single('media'), async (req, res) => {
  try {
    
  
 
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

 console.log(req.file)

    res.status(201).json({
      success: true,
  
      data: req.file
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
});



// Upload endpoint with progress tracking
router.post('/upload', auth, upload.single('media'), async (req, res) => {
  try {
    const { type, caption, description, tags, visibility } = req.body;
    const userId = req.user.id;
 
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    let content;
    
    if (type === 'reel') {










  
 
    const videoPath = path.resolve(req.file.path);
    const videoFilename = req.file.filename;
    const videoUrl = `/uploads/${videoFilename}`;

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





 











      // Create reel
      content = new Reel({
        user: userId,
        
     videoUrl,
      thumbnailUrl,
      duration: Math.round(duration),



        caption,
        description,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        visibility: visibility || 'public'
      });
    } else {
      // Create post
      content = new Post({
        user: userId,
        mediaUrl: `/uploads/${req.file.filename}`,
        mediaType: 'image',
        caption,
        description,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
        visibility: visibility || 'public'
      });
    }

    await content.save();

    res.status(201).json({
      success: true,
      message: `${type === 'reel' ? 'Reel' : 'Post'} uploaded successfully`,
      data: content
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
});

module.exports = router;