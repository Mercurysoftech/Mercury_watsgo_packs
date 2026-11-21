const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Webhook endpoint MUST be before authMiddleware (verified by signature instead of JWT)
// Note: handleWebhook handles signature verification itself
router.post('/webhook', subscriptionController.handleWebhook);

// All other routes require authentication
router.use(authMiddleware);

// Get current user's subscription status
router.get('/status', subscriptionController.getSubscriptionStatus);

// Get all available plans
router.get('/plans', subscriptionController.getPlans);

// Create subscription plan (admin only)
router.post('/plans', adminOnly, subscriptionController.createSubscriptionPlan);

// Create subscription for user (admin only)
router.post('/create', adminOnly, subscriptionController.createSubscription);

// Cancel subscription
router.post('/cancel', subscriptionController.cancelSubscription);

// Manual activation (admin only)
router.post('/activate', adminOnly, subscriptionController.activateSubscription);

// Verify subscription session (manual fallback for webhooks)
router.get('/verify/:subscriptionId', authMiddleware, subscriptionController.verifySubscription);

// Get invoices / payment history
router.get('/invoices', subscriptionController.getInvoices);

// Get single invoice details
router.get('/invoices/:id', subscriptionController.getInvoiceDetail);

// Download invoice as PDF
router.get('/invoices/:id/download', subscriptionController.downloadInvoicePDF);

module.exports = router;
