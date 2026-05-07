const express = require('express');
const router = express.Router();
const doorController = require('../controllers/doorController');
const { protect, restrictTo, esp32Auth } = require('../middleware/auth');

// Public ESP32 routes (secured by API key)
router.get('/access', doorController.checkAccess);       // ESP32 checks access
router.post('/ping', doorController.devicePing);         // ESP32 heartbeat

// Protected admin routes
router.use(protect);
router.get('/logs', restrictTo('admin'), doorController.getAccessLogs);
router.post('/control', restrictTo('admin'), doorController.controlDoor);

module.exports = router;
