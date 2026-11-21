const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const adminAuth = require('../middleware/adminAuth');

/** 
 * Registration Routes 
 * Called by Flutter App to register device tokens.
 */
router.post('/register-token', notificationController.updateFcmToken);

/** 
 * Admin Webhook 
 * Matching the URL in withdrawalController.js for background notifications.
 */
router.post('/withdrawal-status', adminAuth, notificationController.withdrawalStatusUpdate);

/** 
 * Bulk/Single Notifications 
 * Secure routes called by your PHP Admin Panel (x-api-key required).
 * PHP Example: $apiUrl = "http://your-server-ip:5000/api/notifications/send-bulk";
 */
router.post('/send-bulk', adminAuth, notificationController.sendBulkReminders);
router.post('/trigger-single', adminAuth, notificationController.triggerSingleReminder);

/**
 * Internal Webhook for App API to trigger Admin Socket Events
 */
router.post('/internal-socket-event', notificationController.handleInternalSocketEvent);

module.exports = router;
