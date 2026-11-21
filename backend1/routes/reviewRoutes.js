const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authMiddleware, checkPermission } = require('../middleware/auth');

router.get('/all', authMiddleware, checkPermission('reviews'), reviewController.getAllReviews);

module.exports = router;
