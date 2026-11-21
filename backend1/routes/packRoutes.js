const express = require('express');
const router = express.Router();
const packController = require('../controllers/packController');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', packController.getAllPacks);
router.post('/', packController.createPack);
router.put('/:id', packController.updatePack);
router.delete('/:id', packController.deletePack);

module.exports = router;
