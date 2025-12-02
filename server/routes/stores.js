const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const multer = require('multer');
const path = require('path');

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname))
  }
});

const upload = multer({ storage: storage });

// Create store
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { name, description, address, latitude, longitude, owner } = req.body;

    const store = new Store({
      name,
      description,
      address,
      owner,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      image: req.file ? req.file.filename : null
    });

    await store.save();
    res.status(201).json(store);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get nearby stores
router.get('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, maxDistance = 10000 } = req.query;

    const stores = await Store.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).populate('owner', 'name email');

    res.json(stores);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's stores
router.get('/user/:userId', async (req, res) => {
  try {
    const stores = await Store.find({ owner: req.params.userId });
    res.json(stores);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;