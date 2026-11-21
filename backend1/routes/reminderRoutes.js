const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { requireActiveSubscription, checkSubscription } = require('../middleware/subscriptionMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Check subscription but don't strictly block everything yet (so free plan can open whatsapp)
router.use(checkSubscription);

// Send reminder (single send is allowed on free plan locally)
router.post('/send', reminderController.sendReminder);

// Get all reminder history (for reports)
router.get('/history', reminderController.getAllReminderHistory);

// Get reminder history for a customer
router.get('/history/:customerId', reminderController.getReminderHistory);

// --- Premium Features ---
// Block the following for free plans explicitly using requireActiveSubscription inline

// Send bulk reminders
router.post('/send-bulk', requireActiveSubscription, reminderController.sendBulkReminders);

// Schedule reminder
router.post('/schedule', requireActiveSubscription, reminderController.scheduleReminder);
router.post('/schedule-bulk', requireActiveSubscription, reminderController.scheduleBulkReminders);
router.post('/auto-schedule', requireActiveSubscription, reminderController.autoScheduleReminders);

// Get all scheduled reminders
router.get('/scheduled', reminderController.getScheduledReminders);

// Delete reminder log
router.delete('/:id', reminderController.deleteReminder);

module.exports = router;
