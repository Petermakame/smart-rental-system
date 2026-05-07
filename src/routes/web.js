const router = require('express').Router();
const pool = require('../config/database');
const { requireWebAuth, requireWebAdmin } = require('../middleware/auth');

// ─── Public Routes ─────────────────────────────────────────────
router.get('/', (req, res) => res.redirect('/login'));

router.get('/login', (req, res) => {
  if (req.session?.userId) return res.redirect(req.session.role === 'admin' ? '/admin/dashboard' : '/tenant/dashboard');
  res.render('auth/login', { error: null });
});

router.get('/register', (req, res) => res.render('auth/register', { error: null }));

router.post('/login', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.render('auth/login', { error: 'Invalid credentials.' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.render('auth/login', { error: 'Invalid credentials.' });
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/tenant/dashboard');
  } catch (err) {
    res.render('auth/login', { error: 'Login failed. Try again.' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.clearCookie('token');
  res.redirect('/login');
});

// ─── Admin Routes ──────────────────────────────────────────────
router.get('/admin/dashboard', requireWebAdmin, async (req, res) => {
  try {
    const [tenants, payments, logs, devices] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM tenants'),
      pool.query("SELECT COUNT(*) FROM payments WHERE status='paid'"),
      pool.query('SELECT COUNT(*) FROM access_logs WHERE created_at > NOW() - INTERVAL \'24 hours\''),
      pool.query("SELECT COUNT(*) FROM devices WHERE status='online'"),
    ]);
    res.render('admin/dashboard', {
      user: { name: req.session.name, role: req.session.role },
      stats: {
        tenants: tenants.rows[0].count,
        paid: payments.rows[0].count,
        logs: logs.rows[0].count,
        devices: devices.rows[0].count,
      },
    });
  } catch (err) {
    res.render('error', { message: err.message });
  }
});

router.get('/admin/tenants', requireWebAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT t.*, u.email, u.name,
      p.status AS pay_status, p.expiry_date
    FROM tenants t JOIN users u ON t.user_id = u.id
    LEFT JOIN payments p ON p.tenant_id = t.id
      AND p.id = (SELECT id FROM payments WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1)
    ORDER BY t.room_no
  `);
  res.render('admin/tenants', { user: { name: req.session.name }, tenants: result.rows });
});

router.get('/admin/payments', requireWebAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT p.*, t.room_no, u.name AS tenant_name
    FROM payments p JOIN tenants t ON p.tenant_id = t.id
    JOIN users u ON t.user_id = u.id ORDER BY p.created_at DESC
  `);
  res.render('admin/payments', { user: { name: req.session.name }, payments: result.rows });
});

router.get('/admin/access-logs', requireWebAdmin, async (req, res) => {
  const result = await pool.query(`
    SELECT al.*, u.name AS tenant_name, t.room_no, d.device_name
    FROM access_logs al
    LEFT JOIN tenants t ON al.tenant_id = t.id
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN devices d ON al.device_id = d.id
    ORDER BY al.created_at DESC LIMIT 100
  `);
  res.render('admin/access-logs', { user: { name: req.session.name }, logs: result.rows });
});

// ─── Tenant Routes ─────────────────────────────────────────────
router.get('/tenant/dashboard', requireWebAuth, async (req, res) => {
  if (req.session.role === 'admin') return res.redirect('/admin/dashboard');
  try {
    const tenant = await pool.query('SELECT t.* FROM tenants t JOIN users u ON t.user_id = u.id WHERE u.id = $1', [req.session.userId]);
    if (!tenant.rows.length) return res.render('error', { message: 'Tenant profile not found.' });
    const payments = await pool.query('SELECT * FROM payments WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10', [tenant.rows[0].id]);
    res.render('tenant/dashboard', {
      user: { name: req.session.name },
      tenant: tenant.rows[0],
      payments: payments.rows,
    });
  } catch (err) {
    res.render('error', { message: err.message });
  }
});

module.exports = router;
