const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware, checkPermission } = require('../middleware/auth');

// All routes require authentication and 'attendance' permission
router.use(authMiddleware, checkPermission('attendance'));

// GET /api/attendance - get all attendance records (filter by ?date=YYYY-MM-DD)
router.get('/', attendanceController.getAttendance);

// GET /api/attendance/customers?date=YYYY-MM-DD - get customers with their attendance status for a date
router.get('/customers', attendanceController.getCustomersForDate);

// GET /api/attendance/export?date=YYYY-MM-DD&categoryId=X - export delivery list for a category
router.get('/export', attendanceController.exportDailyDeliveryList);

// GET /api/attendance/summary?customerId=X - get attendance summary per customer
router.get('/summary', attendanceController.getAttendanceSummary);

// POST /api/attendance - save single attendance
router.post('/', attendanceController.saveAttendance);

// POST /api/attendance/bulk - save bulk attendance for a date
router.post('/bulk', attendanceController.saveBulkAttendance);

// POST /api/attendance/zone-holiday - mark holiday for entire zone
router.post('/zone-holiday', attendanceController.saveZoneHoliday);

module.exports = router;
