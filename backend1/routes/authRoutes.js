const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOtp);

// Protected routes (require authentication)
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.post('/change-password', authMiddleware, authController.changePassword);
router.delete('/delete-account', authMiddleware, authController.deleteAccount);

// User Management routes (Requires 'users' permission)
const { checkPermission } = require('../middleware/auth');
router.get('/users', authMiddleware, checkPermission('users'), authController.getAllUsers);
router.put('/users/:id', authMiddleware, checkPermission('users'), authController.updateUser);
router.delete('/users/:id', authMiddleware, checkPermission('users'), authController.deleteUser);

module.exports = router;
