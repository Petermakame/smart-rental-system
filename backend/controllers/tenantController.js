const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Payment = require('../models/Payment');

// ─── GET ALL TENANTS ──────────────────────────────────────────────────────────
exports.getAllTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find().populate('userId', 'name email isActive');
    res.json({ success: true, count: tenants.length, tenants });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET SINGLE TENANT ────────────────────────────────────────────────────────
exports.getTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id).populate('userId', 'name email phone');
    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });
    res.json({ success: true, tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CREATE TENANT ────────────────────────────────────────────────────────────
exports.createTenant = async (req, res) => {
  try {
    const { name, email, password, phone, roomNo, rentAmount, rfidTag, fingerprintId, moveInDate } = req.body;

    // Create user account first
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email tayari imetumika' });
    }

    const user = await User.create({ name, email, password: password || 'Tenant@2024', role: 'tenant', phone });

    // Create tenant profile
    const tenant = await Tenant.create({
      userId: user._id,
      name,
      phone,
      roomNo,
      rentAmount,
      rfidTag: rfidTag || null,
      fingerprintId: fingerprintId || null,
      moveInDate: moveInDate || Date.now(),
      doorAccess: false
    });

    res.status(201).json({
      success: true,
      message: 'Mpangaji ameongezwa kwa mafanikio',
      tenant,
      defaultPassword: password || 'Tenant@2024'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE TENANT ────────────────────────────────────────────────────────────
exports.updateTenant = async (req, res) => {
  try {
    const { name, phone, roomNo, rentAmount, rfidTag, fingerprintId, status, doorAccess } = req.body;

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { name, phone, roomNo, rentAmount, rfidTag, fingerprintId, status, doorAccess },
      { new: true, runValidators: true }
    );

    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });

    // Update user status too
    if (status === 'blocked' || status === 'inactive') {
      await User.findByIdAndUpdate(tenant.userId, { isActive: status === 'active' });
    }

    res.json({ success: true, message: 'Mpangaji amesasishwa', tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE TENANT ────────────────────────────────────────────────────────────
exports.deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });

    await User.findByIdAndDelete(tenant.userId);
    await Tenant.findByIdAndDelete(req.params.id);
    await Payment.deleteMany({ tenantId: req.params.id });

    res.json({ success: true, message: 'Mpangaji amefutwa' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── REGISTER RFID / FINGERPRINT ─────────────────────────────────────────────
exports.registerBiometric = async (req, res) => {
  try {
    const { rfidTag, fingerprintId } = req.body;
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { rfidTag, fingerprintId },
      { new: true }
    );
    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });
    res.json({ success: true, message: 'Biometric imesajiliwa', tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET TENANT BY USER ID ────────────────────────────────────────────────────
exports.getTenantByUserId = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ userId: req.params.userId });
    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });
    res.json({ success: true, tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
