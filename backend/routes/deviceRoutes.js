const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/', deviceController.getAllDevices);
router.post('/', deviceController.createDevice);
router.put('/:id', deviceController.updateDevice);
router.delete('/:id', deviceController.deleteDevice);

module.exports = router;
