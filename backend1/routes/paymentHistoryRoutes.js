const express = require('express');
const router = express.Router();
const paymentHistoryController = require('../controllers/paymentHistoryController');
const { authMiddleware, adminOnly, checkPermission } = require('../middleware/auth');

// All routes require authentication and 'payment-history' permission
router.use(authMiddleware, checkPermission('payment-history'));

/**
 * Get payment statistics
 * @route GET /payment-history/stats
 * @query {string} startDate - Optional: Filter from date (YYYY-MM-DD)
 * @query {string} endDate - Optional: Filter to date (YYYY-MM-DD)
 */
router.get('/stats', paymentHistoryController.getPaymentStats);

/**
 * Export payment history as CSV
 * @route GET /payment-history/export/csv
 * @query {number} customerId - Optional: Filter by customer ID
 */
router.get('/export/csv', paymentHistoryController.exportPaymentHistory);
router.get('/export/pdf-history', paymentHistoryController.exportPaymentHistoryPDF);
router.get('/export/pdf/:paymentId', paymentHistoryController.exportPaymentPDF);

/**
 * Get all payment history for user's customers
 * @route GET /payment-history
 * @query {number} customerId - Optional: Filter by customer ID
 */
router.get('/', paymentHistoryController.getPaymentHistory);

/**
 * Get payment history for specific customer
 * @route GET /payment-history/customer/:customerId
 */
router.get('/customer/:customerId', paymentHistoryController.getCustomerPaymentHistory);

/**
 * Record a new payment (admin only)
 * @route POST /payment-history/record
 * @body {number} customerId - Required
 * @body {number} amount - Required
 * @body {string} paymentStatus - Required: 'success' | 'failed' | 'pending' | 'paid'
 * @body {string} paymentMethod - Optional: 'razorpay' | 'manual' | 'online'
 * @body {string} transactionDate - Optional: YYYY-MM-DD (default: today)
 * @body {string} description - Optional
 */
router.post('/record', paymentHistoryController.recordPayment);

/**
 * Mark customer as paid (admin only)
 * @route POST /payment-history/mark-paid
 * @body {number} customerId - Required
 * @body {number} amount - Optional: Amount to record as payment
 * @body {boolean} recordPayment - Optional: Whether to record a payment transaction (default: false)
 */
router.post('/mark-paid', paymentHistoryController.markCustomerAsPaid);

/**
 * Sync single customer payment status (admin only)
 * @route PUT /payment-history/sync/:customerId
 */
router.put('/sync/:customerId', paymentHistoryController.syncCustomerPaymentStatus);

/**
 * Sync all customers payment statuses (admin only)
 * @route POST /payment-history/sync-all
 */
router.post('/sync-all', paymentHistoryController.syncAllCustomerPaymentStatuses);

/**
 * Update a payment history record (admin only)
 * @route PUT /payment-history/:paymentId
 */
router.put('/:paymentId', paymentHistoryController.updatePaymentRecord);

/**
 * Delete payment history record (admin only)
 * @route DELETE /payment-history/:paymentId
 */
router.delete('/:paymentId', paymentHistoryController.deletePaymentHistory);

/**
 * Reset customer payment status to unpaid (admin only)
 * @route DELETE /payment-history/reset/:customerId
 */
router.delete('/reset/:customerId', paymentHistoryController.resetCustomerPayment);

module.exports = router;
