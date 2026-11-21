const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authMiddleware, checkPermission } = require('../middleware/auth');

router.get('/dashboard', authMiddleware, checkPermission('reports'), reportController.getDashboardReports);
router.get('/export/csv', authMiddleware, checkPermission('reports'), reportController.exportReport);
router.get('/export/pdf', authMiddleware, checkPermission('reports'), reportController.exportReportPDF);

module.exports = router;
