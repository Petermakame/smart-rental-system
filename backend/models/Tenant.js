const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Jina la mpangaji linahitajika'],
    trim: true
  },
  roomNo: {
    type: String,
    required: [true, 'Namba ya chumba inahitajika'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  rfidTag: {
    type: String,
    default: null,
    trim: true
  },
  fingerprintId: {
    type: Number,
    default: null
  },
  rentAmount: {
    type: Number,
    required: [true, 'Kodi ya kila mwezi inahitajika'],
    min: 0
  },
  moveInDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'blocked', 'inactive'],
    default: 'active'
  },
  doorAccess: {
    type: Boolean,
    default: false  // Access is controlled by payment status
  },
  emergencyContact: {
    name: String,
    phone: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Tenant', tenantSchema);
