const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const { authMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Multer configuration for store images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/stores/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

// Create Store
router.post('/', 
  authMiddleware,
  upload.array('images', 5),
  [
    body('name').notEmpty().withMessage('Store name is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('address').notEmpty().withMessage('Address is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('latitude').isNumeric().withMessage('Valid latitude is required'),
    body('longitude').isNumeric().withMessage('Valid longitude is required'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false,
          errors: errors.array() 
        });
      }

      const { 
        name, 
        description, 
        address, 
        category,
        contactNumber,
        email,
        website,
        latitude,
        longitude 
      } = req.body;
 
      // Check if user already has a store
      const existingStore = await Store.findOne({ owner: req.user.id });
      if (existingStore) {
        return res.status(400).json({
          success: false,
          message: 'You already have a store'
        });
      }
      if (!longitude  || !latitude  ) {
        return res.status(400).json({
          success: false,
          message: 'You need to share ur store location by enabling your geo location!'
        });
      }

      // Check if store name is taken
      const storeExists = await Store.findOne({ name });
      if (storeExists) {
        return res.status(409).json({
          success: false,
          message: 'Store name already taken'
        });
      }

      const images = req.files ? req.files.map(file => file.filename) : [];
 
    if (!images  || !images?.length>0      ) {
        return res.status(410).json({
          success: false,
          message: 'Need a atleast 2 pic of store'
        });
      }
 

      const store = new Store({
        name,
        description,
        address,
        category,
        owner: req.user.id,
        location: {
          type: 'Point',
          coordinates: [parseFloat(longitude), parseFloat(latitude)]
        },
        contactNumber,
        email,
        website,
        images,
        features: {
          hasDelivery: req.body.hasDelivery === 'true',
          hasPickup: req.body.hasPickup === 'true',
          openingHours: req.body.openingHours ? JSON.parse(req.body.openingHours) : {}
        }
      });

      await store.save();


const qrPayload = `www.theekthak.techmintlab.com/store/scan/${store._id}`;

const qrCodeBase64 = await QRCode.toDataURL(qrPayload);

// update store with qr
store.qrCode = qrCodeBase64;
await store.save();


 


      // Update user role to store owner
      const User = require('../models/User');
      await User.findByIdAndUpdate(req.user.id, { role: 'store_owner' });

      res.status(201).json({
        success: true,
        message: 'Store created successfully',
        store
      });
    } catch (error) {
      console.error('Create Store Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  }
);

// Get Nearby Stores
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10000, category } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const query = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseFloat(maxDistance)
        }
      },
      isActive: true
    };

    if (category) {
      query.category = category;
    }

    const stores = await Store.find(query)
      .populate('owner', 'name email username')
      .limit(20);

    res.json({
      success: true,
      count: stores.length,
      stores
    });
  } catch (error) {
    console.error('Nearby Stores Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Search Stores
router.get('/search', async (req, res) => {
  try {
    const { q, category, minRating, hasDelivery, page = 1, limit = 10 } = req.query;

    const query = { isActive: true };

    if (q) {
      query.$text = { $search: q };
    }

    if (category) {
      query.category = category;
    }

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (hasDelivery === 'true') {
      query['features.hasDelivery'] = true;
    }

    const skip = (page - 1) * limit;

    const stores = await Store.find(query)
      .populate('owner', 'name email username')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ rating: -1, createdAt: -1 });

    const total = await Store.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      stores
    });
  } catch (error) {
    console.error('Search Stores Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get Store by ID
router.get('/:id', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id)
      .populate('owner', 'name email username profileImage')
  
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Get Store Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get User's Store
router.get('/my/store', authMiddleware, async (req, res) => {
  console.log(req.user.id)
 
  try {
    const store = await Store.findOne({ owner: req.user.id })
      .populate('owner', 'name email username profileImage');





 

 







      
    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'No store found'
      });
    }

    res.json({
      success: true,
      store
    });
  } catch (error) {
    console.error('Get My Store Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Update Store
router.put('/:id', 
  authMiddleware,
  upload.array('images', 5),
  async (req, res) => {
    try {
      const store = await Store.findById(req.params.id);

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found'
        });
      }

      // Check ownership
      if (store.owner.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update this store'
        });
      }

      const updates = req.body;
      
      // Handle images
      if (req.files && req.files.length > 0) {
        updates.images = [
          ...store.images,
          ...req.files.map(file => file.filename)
        ];
      }

      // Handle location update
      if (updates.latitude && updates.longitude) {
        updates.location = {
          type: 'Point',
          coordinates: [parseFloat(updates.longitude), parseFloat(updates.latitude)]
        };
      }

      // Handle features
      if (updates.features) {
        updates.features = JSON.parse(updates.features);
      }

      const updatedStore = await Store.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      ).populate('owner', 'name email username profileImage');

      res.json({
        success: true,
        message: 'Store updated successfully',
        store: updatedStore
      });
    } catch (error) {
      console.error('Update Store Error:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error', 
        error: error.message 
      });
    }
  }
);

// Delete Store Image
router.delete('/:id/images/:imageName', authMiddleware, async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    if (store.owner.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const imageIndex = store.images.indexOf(req.params.imageName);
    if (imageIndex > -1) {
      store.images.splice(imageIndex, 1);
      await store.save();
    }

    res.json({
      success: true,
      message: 'Image removed successfully'
    });
  } catch (error) {
    console.error('Delete Image Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;