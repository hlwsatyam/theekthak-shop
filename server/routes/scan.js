const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const { authMiddleware } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const ScanHistory = require('../models/ScanHistory');

 

router.get(
  '/store/:storeId/scan-history',
  authMiddleware,
  async (req, res) => {
    try {
      const { storeId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const history = await ScanHistory.find({ store: storeId })
        .populate('user', 'name') // ✅ ONLY USER NAME
        .sort({ scannedAt: -1 })
        .skip(skip)
        .limit(limit);

      res.json({
        success: true,
        data: history,
        page
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch scan history'
      });
    }
  }
);







router.post(
  '/:storeId',
  authMiddleware,
  async (req, res) => {
    try {
      const { storeId } = req.params;
      const userId = req.user.id;

      const ScanHistory = require('../models/ScanHistory');

      await ScanHistory.create({
        store: storeId,
        user: userId
      });

      res.json({
        success: true,
        message: 'QR scanned successfully'
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Scan failed'
      });
    }
  }
);





module.exports = router;