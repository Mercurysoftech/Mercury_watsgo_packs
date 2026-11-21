const express = require('express');
const router = express.Router();
const deliveryUserController = require('../controllers/deliveryUserController');
const { authMiddleware, checkPermission } = require('../middleware/auth');

// GET routes: any authenticated user can view delivery personnel (needed for Delivery List Modal)
router.get('/', authMiddleware, deliveryUserController.getAll);
router.get('/:id/customers', authMiddleware, deliveryUserController.getAssignedCustomers);
router.get('/:id/export-pdf', authMiddleware, deliveryUserController.exportDeliveryPDF);

// Write routes: require 'delivery-user' permission
router.post('/', authMiddleware, checkPermission('delivery-user'), deliveryUserController.create);
router.put('/:id', authMiddleware, checkPermission('delivery-user'), deliveryUserController.update);
router.delete('/:id', authMiddleware, checkPermission('delivery-user'), deliveryUserController.delete);

module.exports = router;
