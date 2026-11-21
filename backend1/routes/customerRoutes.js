const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const customerAutopayController = require('../controllers/customerAutopayController');
const { authMiddleware, adminOnly, checkPermission } = require('../middleware/auth');
const { requireActiveSubscription, checkSubscription } = require('../middleware/subscriptionMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Dashboard stats - Allow even if subscription is expired so dashboard can load
router.get('/stats', checkSubscription, checkPermission('dashboard'), customerController.getDashboardStats);

// All other routes require active subscription (limits enforced in controller)
router.use(checkSubscription, checkPermission('customers'));

// Customer Autopay Link
router.post('/autopay-link', customerAutopayController.generateCustomerAutopayLink);

// Check if mobile exists
router.get('/check-mobile', customerController.checkMobileExists);

// Customer CRUD
router.get('/export/csv', customerController.exportCustomers);
router.get('/export/pdf', customerController.exportCustomersPDF);
router.get('/insights', customerController.getCustomerInsights);
router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomer);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.put('/bulk/assign', customerController.bulkAssignDeliveryUser);
router.put('/bulk/assign-area', customerController.bulkAssignByArea);
router.put('/bulk/unassign', customerController.bulkUnassignDeliveryUser);
router.post('/:id/recalculate-distance', customerController.recalculateDistance);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
