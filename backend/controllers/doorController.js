const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const { Device, AccessLog } = require('../models/Device');

// ─── CHECK DOOR ACCESS (ESP32 calls this) ─────────────────────────────────────
// GET /api/door/access?rfid=XXXXX  OR  ?tenantId=XXXXX  OR  ?fingerprint=1
exports.checkAccess = async (req, res) => {
  try {
    const { rfid, tenantId, fingerprint, deviceName } = req.query;

    let tenant = null;

    // Find tenant by RFID tag
    if (rfid) {
      tenant = await Tenant.findOne({ rfidTag: rfid });
    }
    // Find tenant by fingerprint ID
    else if (fingerprint) {
      tenant = await Tenant.findOne({ fingerprintId: parseInt(fingerprint) });
    }
    // Find tenant by ID directly
    else if (tenantId) {
      tenant = await Tenant.findById(tenantId);
    }

    if (!tenant) {
      await AccessLog.create({
        rfidTag: rfid || null,
        deviceName: deviceName || 'Unknown',
        action: 'access_denied',
        reason: 'RFID/Fingerprint haijasajiliwa'
      });
      return res.json({ access: false, action: 'DENY', message: 'Hakuna mtumiaji' });
    }

    // Check payment status for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const payment = await Payment.findOne({
      tenantId: tenant._id,
      month: currentMonth,
      status: 'paid'
    });

    const hasAccess = !!payment && tenant.status === 'active';

    // Log the access attempt
    await AccessLog.create({
      tenantId: tenant._id,
      rfidTag: rfid || null,
      deviceName: deviceName || 'Door1',
      action: hasAccess ? 'access_granted' : 'access_denied',
      reason: hasAccess ? 'Malipo yamefanyika' : 'Malipo hayana au amezuiwa'
    });

    // Update device status
    if (deviceName) {
      await Device.findOneAndUpdate(
        { deviceName },
        { isLocked: !hasAccess, lastPing: new Date(), isOnline: true }
      );
    }

    res.json({
      access: hasAccess,
      action: hasAccess ? 'ALLOW' : 'DENY',
      tenantName: tenant.name,
      roomNo: tenant.roomNo,
      message: hasAccess
        ? `Karibu ${tenant.name}! Mlango umefunguliwa`
        : `Samahani ${tenant.name}. Lipa kodi kwanza`,
      // For ESP32: simple 1 or 0
      relay: hasAccess ? 1 : 0
    });
  } catch (error) {
    res.status(500).json({ access: false, action: 'DENY', message: error.message, relay: 0 });
  }
};

// ─── MANUAL DOOR CONTROL (Admin) ─────────────────────────────────────────────
exports.controlDoor = async (req, res) => {
  try {
    const { deviceName, action, tenantId } = req.body; // action: 'open' or 'close'

    const device = await Device.findOneAndUpdate(
      { deviceName },
      { isLocked: action === 'close', lastPing: new Date() },
      { new: true }
    );

    await AccessLog.create({
      tenantId: tenantId || null,
      deviceName,
      action: action === 'open' ? 'manual_open' : 'manual_close',
      reason: `Manual control by admin`
    });

    res.json({
      success: true,
      message: `Mlango ${action === 'open' ? 'umefunguliwa' : 'umefungwa'} manually`,
      device,
      relay: action === 'open' ? 1 : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ACCESS LOGS ──────────────────────────────────────────────────────────
exports.getAccessLogs = async (req, res) => {
  try {
    const logs = await AccessLog.find()
      .populate('tenantId', 'name roomNo')
      .sort({ timestamp: -1 })
      .limit(100);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ESP32 HEARTBEAT / PING ───────────────────────────────────────────────────
exports.devicePing = async (req, res) => {
  try {
    const { deviceName, ipAddress, macAddress } = req.body;

    await Device.findOneAndUpdate(
      { deviceName },
      { isOnline: true, lastPing: new Date(), ipAddress, macAddress },
      { upsert: true, new: true }
    );

    res.json({ success: true, serverTime: new Date().toISOString(), message: 'Pong' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
