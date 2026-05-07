const pool = require('../config/database');

// GET /api/payments
const getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, t.room_no, u.name AS tenant_name, u.email
      FROM payments p
      JOIN tenants t ON p.tenant_id = t.id
      JOIN users u ON t.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
};

// GET /api/payments/tenant/:tenantId
const getByTenant = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.params.tenantId]
    );
    res.json({ payments: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments.' });
  }
};

// POST /api/payments - Record a payment (manual or simulated)
const create = async (req, res) => {
  try {
    const { tenant_id, amount, payment_method = 'cash', reference, months = 1 } = req.body;
    if (!tenant_id || !amount) return res.status(400).json({ error: 'tenant_id and amount required.' });

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + parseInt(months));

    const result = await pool.query(
      `INSERT INTO payments (tenant_id, amount, payment_method, reference, status, expiry_date)
       VALUES ($1, $2, $3, $4, 'paid', $5) RETURNING *`,
      [tenant_id, amount, payment_method, reference || null, expiry]
    );

    // Update tenant access status to active
    await pool.query('UPDATE tenants SET is_active = true, updated_at = NOW() WHERE id = $1', [tenant_id]);

    res.status(201).json({ message: 'Payment recorded. Tenant activated.', payment: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
};

// POST /api/payments/verify - ESP32 calls this to check payment status
const verify = async (req, res) => {
  try {
    const { tenant_id, rfid_code } = req.body;
    let query, params;

    if (rfid_code) {
      query = `SELECT p.status, p.expiry_date, t.is_active, t.id AS tenant_id, t.room_no, u.name
               FROM tenants t
               JOIN users u ON t.user_id = u.id
               LEFT JOIN payments p ON p.tenant_id = t.id
               WHERE t.rfid_code = $1
               ORDER BY p.created_at DESC LIMIT 1`;
      params = [rfid_code];
    } else {
      query = `SELECT p.status, p.expiry_date, t.is_active, t.id AS tenant_id, t.room_no, u.name
               FROM tenants t
               JOIN users u ON t.user_id = u.id
               LEFT JOIN payments p ON p.tenant_id = t.id
               WHERE t.id = $1
               ORDER BY p.created_at DESC LIMIT 1`;
      params = [tenant_id];
    }

    const result = await pool.query(query, params);
    if (!result.rows.length) return res.status(404).json({ access: false, reason: 'Tenant not found' });

    const row = result.rows[0];
    const isExpired = row.expiry_date && new Date(row.expiry_date) < new Date();

    if (!row.is_active) return res.json({ access: false, reason: 'Account deactivated', tenant: row.name });
    if (row.status !== 'paid' || isExpired) {
      // Auto-deactivate if expired
      if (isExpired) await pool.query('UPDATE tenants SET is_active = false WHERE id = $1', [row.tenant_id]);
      return res.json({ access: false, reason: 'Payment expired or unpaid', tenant: row.name });
    }

    res.json({ access: true, reason: 'Payment active', tenant: row.name, room: row.room_no });
  } catch (err) {
    console.error(err);
    res.status(500).json({ access: false, reason: 'Server error' });
  }
};

// PUT /api/payments/:id/status - Admin manually update payment status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['paid', 'unpaid', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    const result = await pool.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found.' });
    res.json({ message: 'Payment status updated.', payment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment.' });
  }
};

module.exports = { getAll, getByTenant, create, verify, updateStatus };
