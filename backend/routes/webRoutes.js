const express = require('express');
const router = express.Router();
const { requireSession, requireAdmin, requireTenant } = require('../middleware/auth');
const Tenant = require('../models/Tenant');
const Payment = require('../models/Payment');
const { AccessLog } = require('../models/Device');
const User = require('../models/User');

// ─── Public Pages ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect(req.session.userRole === 'admin' ? '/admin/dashboard' : '/tenant/dashboard');
  }
  res.redirect('/login');
});

router.get('/login', (req, res) => res.render('auth/login', { title: 'Ingia - Smart Rental', error: null }));
router.get('/register', (req, res) => res.render('auth/register', { title: 'Sajili - Smart Rental', error: null }));

// ─── Admin Pages ──────────────────────────────────────────────────────────────
router.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const totalTenants = await Tenant.countDocuments();
    const paidThisMonth = await Payment.countDocuments({ month: currentMonth, status: 'paid' });
    const revenueData = await Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const recentLogs = await AccessLog.find().populate('tenantId', 'name roomNo').sort({ timestamp: -1 }).limit(5);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: { name: req.session.userName, role: req.session.userRole },
      stats: {
        totalTenants,
        paidThisMonth,
        unpaidThisMonth: totalTenants - paidThisMonth,
        totalRevenue: revenueData[0]?.total || 0,
        currentMonth
      },
      recentLogs
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

router.get('/admin/tenants', requireAdmin, async (req, res) => {
  const tenants = await Tenant.find().populate('userId', 'email isActive');
  res.render('admin/tenants', {
    title: 'Wasimamizi wa Wapangaji',
    user: { name: req.session.userName, role: req.session.userRole },
    tenants
  });
});

router.get('/admin/payments', requireAdmin, async (req, res) => {
  const payments = await Payment.find().populate('tenantId', 'name roomNo').sort({ createdAt: -1 });
  const tenants = await Tenant.find({}, 'name roomNo');
  res.render('admin/payments', {
    title: 'Malipo',
    user: { name: req.session.userName, role: req.session.userRole },
    payments,
    tenants
  });
});

router.get('/admin/access-logs', requireAdmin, async (req, res) => {
  const logs = await AccessLog.find().populate('tenantId', 'name roomNo').sort({ timestamp: -1 }).limit(200);
  res.render('admin/access-logs', {
    title: 'Historia ya Mlango',
    user: { name: req.session.userName, role: req.session.userRole },
    logs
  });
});

// ─── Tenant Pages ─────────────────────────────────────────────────────────────
router.get('/tenant/dashboard', requireTenant, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ userId: req.session.userId });
    const payments = await Payment.find({ tenantId: tenant?._id }).sort({ createdAt: -1 }).limit(6);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentPayment = payments.find(p => p.month === currentMonth);

    res.render('tenant/dashboard', {
      title: 'Dashibodi yangu',
      user: { name: req.session.userName, role: req.session.userRole },
      tenant,
      payments,
      currentPayment,
      currentMonth
    });
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
