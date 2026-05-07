const { Device } = require('../models/Device');

exports.getAllDevices = async (req, res) => {
  try {
    const devices = await Device.find();
    res.json({ success: true, devices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const device = await Device.create(req.body);
    res.status(201).json({ success: true, device });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const device = await Device.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, device });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    await Device.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Device imefutwa' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
