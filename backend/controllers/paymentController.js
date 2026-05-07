const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');

// ─── GET ALL PAYMENTS ─────────────────────────────────────────────────────────
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('tenantId', 'name roomNo')
      .populate('recordedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: payments.length, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET TENANT PAYMENTS ──────────────────────────────────────────────────────
exports.getTenantPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ tenantId: req.params.tenantId })
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── RECORD PAYMENT ───────────────────────────────────────────────────────────
exports.recordPayment = async (req, res) => {
  try {
    const { tenantId, amount, month, paymentMethod, transactionId, notes } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });

    // Calculate due date and expiry
    const [year, mon] = month.split('-').map(Number);
    const dueDate = new Date(year, mon - 1, 1);
    const expiryDate = new Date(year, mon, 0); // Last day of the month

    // Check if payment for this month already exists
    const existingPayment = await Payment.findOne({ tenantId, month });
    if (existingPayment && existingPayment.status === 'paid') {
      return res.status(400).json({ success: false, message: `Malipo ya mwezi ${month} tayari yanaonekana` });
    }

    const payment = await Payment.create({
      tenantId,
      amount,
      month,
      status: 'paid',
      paymentMethod: paymentMethod || 'manual',
      transactionId: transactionId || null,
      paidAt: new Date(),
      dueDate,
      expiryDate,
      notes: notes || '',
      recordedBy: req.user?.id
    });

    // ─── KEY LOGIC: Update door access based on payment ───────────────────────
    await updateTenantDoorAccess(tenantId);

    res.status(201).json({
      success: true,
      message: 'Malipo yamerekodiwa. Mlango umefunguliwa!',
      payment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── UPDATE PAYMENT STATUS ────────────────────────────────────────────────────
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { status, paidAt: status === 'paid' ? new Date() : null },
      { new: true }
    );
    if (!payment) return res.status(404).json({ success: false, message: 'Malipo hapatikani' });

    // Update door access
    await updateTenantDoorAccess(payment.tenantId);

    res.json({ success: true, message: 'Hali ya malipo imesasishwa', payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── VERIFY PAYMENT (Used by ESP32) ──────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'Mpangaji hapatikani' });

    // Check current month payment
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01"
    const payment = await Payment.findOne({
      tenantId,
      month: currentMonth,
      status: 'paid'
    });

    const isPaid = !!payment;
    res.json({
      success: true,
      tenantId,
      tenantName: tenant.name,
      roomNo: tenant.roomNo,
      currentMonth,
      isPaid,
      doorAccess: tenant.doorAccess,
      status: isPaid ? 'ACTIVE' : 'BLOCKED',
      message: isPaid ? 'Malipo yamilimika. Ruhusa ya mlango ipo' : 'Malipo hayana mwezi huu. Mlango umefungwa'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
exports.getPaymentStats = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const totalTenants = await Tenant.countDocuments();
    const paidThisMonth = await Payment.countDocuments({ month: currentMonth, status: 'paid' });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const overdueCount = await Payment.countDocuments({ status: 'overdue' });

    res.json({
      success: true,
      stats: {
        totalTenants,
        paidThisMonth,
        unpaidThisMonth: totalTenants - paidThisMonth,
        totalRevenue: totalRevenue[0]?.total || 0,
        overdueCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── HELPER: Update tenant door access ───────────────────────────────────────
async function updateTenantDoorAccess(tenantId) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const payment = await Payment.findOne({ tenantId, month: currentMonth, status: 'paid' });
  const doorAccess = !!payment;

  await Tenant.findByIdAndUpdate(tenantId, {
    doorAccess,
    status: doorAccess ? 'active' : 'blocked'
  });

  return doorAccess;
}

module.exports.updateTenantDoorAccess = updateTenantDoorAccess;
