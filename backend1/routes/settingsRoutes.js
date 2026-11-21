const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authMiddleware, adminOnly, checkPermission } = require('../middleware/auth');

// All routes require authentication and 'settings' permission
router.use(authMiddleware, checkPermission('settings'));

// Get settings
router.get('/', settingsController.getSettings);

// Update settings
router.put('/', settingsController.updateSettings);

module.exports = router;
