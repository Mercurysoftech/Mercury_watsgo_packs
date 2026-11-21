const express = require('express');
const router = express.Router();
const paymentHistoryController = require('../controllers/paymentHistorySimpleController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// All routes require authentication
router.use(authMiddleware);

/**
 * Get all payment history for user's customers
 * @route GET /payment-history
 * @query {number} customerId - Optional: Filter by customer ID
 * @query {string} status - Optional: Filter by payment status ('paid', 'unpaid', 'pending')
 */
router.get('/', paymentHistoryController.getPaymentHistory);

/**
 * Get payment history for specific customer
 * @route GET /payment-history/customer/:customerId
 */
router.get('/customer/:customerId', paymentHistoryController.getCustomerPaymentHistory);

/**
 * Delete payment history record (admin only)
 * @route DELETE /payment-history/:paymentHistoryId
 */
router.delete('/:paymentHistoryId', adminOnly, paymentHistoryController.deletePaymentHistory);

module.exports = router;
