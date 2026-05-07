const express = require('express');
const router = express.Router();
const tenantController = require('../controllers/tenantController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

router.get('/', restrictTo('admin'), tenantController.getAllTenants);
router.get('/:id', tenantController.getTenant);
router.post('/', restrictTo('admin'), tenantController.createTenant);
router.put('/:id', restrictTo('admin'), tenantController.updateTenant);
router.delete('/:id', restrictTo('admin'), tenantController.deleteTenant);
router.put('/:id/biometric', restrictTo('admin'), tenantController.registerBiometric);
router.get('/user/:userId', tenantController.getTenantByUserId);

module.exports = router;
