const express = require('express');
const router = express.Router();
const withdrawalController = require('../controllers/withdrawalController');
const { authMiddleware, checkPermission } = require('../middleware/auth');

router.get('/', authMiddleware, checkPermission('withdrawals'), withdrawalController.getAllRequests);
router.put('/:id/status', authMiddleware, checkPermission('withdrawals'), withdrawalController.updateStatus);

module.exports = router;
