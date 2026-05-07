const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect, restrictTo } = require('../middleware/auth');

// Public route for ESP32 payment verification
router.get('/verify/:tenantId', paymentController.verifyPayment);

router.use(protect);

router.get('/', restrictTo('admin'), paymentController.getAllPayments);
router.get('/stats', restrictTo('admin'), paymentController.getPaymentStats);
router.get('/tenant/:tenantId', paymentController.getTenantPayments);
router.post('/', restrictTo('admin'), paymentController.recordPayment);
router.put('/:id/status', restrictTo('admin'), paymentController.updatePaymentStatus);

module.exports = router;
