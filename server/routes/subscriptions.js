const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Subscription = require('../models/Subscription');
const Store = require('../models/Store');
const {authMiddleware} = require('../middleware/auth');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_RolucMHxrdKOmN',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'uXa4g8k5mWe1bU0Es0PX4MOI'
});

// Create Order for Subscription
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { storeId, plan } = req.body;

    // Validate plan
    const plans = {
      'basic_30': { amount: 19900, days: 30 }, // 199 INR in paise
      'premium_90': { amount: 49900, days: 90 }, // 499 INR
      'enterprise_365': { amount: 149900, days: 365 } // 1499 INR
    };

    if (!plans[plan]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    const store = await Store.findOne({ 
      _id: storeId, 
      owner: req.user.id 
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Check if store already has active subscription
    if (store.subscription.isSubscribed && 
        new Date(store.subscription.endDate) > new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Store already has active subscription'
      });
    }

    const amount = plans[plan].amount;
    const currency = 'INR';

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: amount,
      currency: currency,
      receipt: `receipt_${Date.now()}`,
      notes: {
        storeId: storeId,
        plan: plan,
        userId: req.user.id
      }
    });

    // Create subscription record
    const subscription = new Subscription({
      store: storeId,
      user: req.user.id,
      plan: plan,
      amount: amount / 100, // Convert paise to rupees
      currency: currency,
      razorpayOrderId: "order.id",
      status: 'completed'
    });

    await subscription.save();

    res.json({
      success: true,
      order: {
        id: "order.id",
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      },
      subscriptionId: subscription._id
    });
  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Verify Payment
router.post('/verify-payment', authMiddleware, async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      subscriptionId 
    } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'your_key_secret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      // Update subscription
      const subscription = await Subscription.findById(subscriptionId);
      
      if (!subscription) {
        return res.status(404).json({
          success: false,
          message: 'Subscription not found'
        });
      }

      subscription.razorpayPaymentId = razorpay_payment_id;
      subscription.razorpaySignature = razorpay_signature;
      subscription.status = 'completed';
      subscription.startDate = new Date();
      
      // Calculate end date based on plan
      const plans = {
        'basic_30': 30,
        'premium_90': 90,
        'enterprise_365': 365
      };
      
      const days = plans[subscription.plan];
      subscription.endDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      
      await subscription.save();

      // Update store subscription
      const store = await Store.findById(subscription.store);
      store.subscription = {
        isSubscribed: true,
        plan: subscription.plan.split('_')[0],
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        razorpaySubscriptionId: subscription._id,
        razorpayPaymentId: razorpay_payment_id
      };
      
      await store.save();

      res.json({
        success: true,
        message: 'Payment verified successfully',
        subscription
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }
  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get Subscription Status
router.get('/store/:storeId/status', authMiddleware, async (req, res) => {
  try {
    const store = await Store.findOne({ 
      _id: req.params.storeId, 
      owner: req.user.id 
    }).select('subscription');

    if (!store) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    const now = new Date();
    const isActive = store.subscription.isSubscribed && 
                     new Date(store.subscription.endDate) > now;

    res.json({
      success: true,
      subscription: store.subscription,
      isActive,
      daysRemaining: isActive ? 
        Math.ceil((new Date(store.subscription.endDate) - now) / (1000 * 60 * 60 * 24)) : 0
    });
  } catch (error) {
    console.error('Get Subscription Status Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Get Subscription History
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.id })
      .populate('store', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('Get Subscription History Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error', 
      error: error.message 
    });
  }
});

module.exports = router;