const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceName: {
    type: String,
    required: [true, 'Jina la device linahitajika'],
    trim: true,
    unique: true
  },
  deviceType: {
    type: String,
    enum: ['door_lock', 'rfid_reader', 'fingerprint', 'camera'],
    default: 'door_lock'
  },
  location: {
    type: String,   // e.g., "Door A - Ground Floor"
    trim: true
  },
  ipAddress: {
    type: String,
    default: null
  },
  macAddress: {
    type: String,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: true   // Default: door is locked
  },
  lastPing: {
    type: Date,
    default: null
  },
  assignedRoom: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Access Log sub-schema
const accessLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant'
  },
  rfidTag: String,
  deviceName: String,
  action: {
    type: String,
    enum: ['access_granted', 'access_denied', 'manual_open', 'manual_close']
  },
  reason: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Device = mongoose.model('Device', deviceSchema);
const AccessLog = mongoose.model('AccessLog', accessLogSchema);

module.exports = { Device, AccessLog };
