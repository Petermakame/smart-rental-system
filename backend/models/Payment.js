const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Kiasi cha malipo kinahitajika'],
    min: 0
  },
  month: {
    type: String,  // e.g., "2024-01"
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'unpaid', 'partial', 'overdue'],
    default: 'unpaid'
  },
  paymentMethod: {
    type: String,
    enum: ['mpesa', 'tigopesa', 'airtel', 'cash', 'bank', 'manual'],
    default: 'manual'
  },
  transactionId: {
    type: String,
    default: null
  },
  paidAt: {
    type: Date,
    default: null
  },
  dueDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,   // When next payment is due
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);
