const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// GET /api/tenants
const getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.email, u.name,
        p.status AS payment_status, p.expiry_date, p.amount
      FROM tenants t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN payments p ON p.tenant_id = t.id
        AND p.id = (SELECT id FROM payments WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1)
      ORDER BY t.room_no
    `);
    res.json({ tenants: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tenants.' });
  }
};

// GET /api/tenants/:id
const getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT t.*, u.email, u.name FROM tenants t
      JOIN users u ON t.user_id = u.id WHERE t.id = $1
    `, [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found.' });
    res.json({ tenant: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tenant.' });
  }
};

// POST /api/tenants - Create tenant + user account
const create = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { name, email, password, room_no, rfid_code, fingerprint_id, phone } = req.body;
    if (!name || !email || !password || !room_no) {
      return res.status(400).json({ error: 'Name, email, password, room_no are required.' });
    }

    const exists = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already exists.' });

    const hashed = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashed, 'tenant']
    );

    const tenantResult = await client.query(
      'INSERT INTO tenants (user_id, room_no, rfid_code, fingerprint_id, phone) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userResult.rows[0].id, room_no, rfid_code || null, fingerprint_id || null, phone || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Tenant created.', tenant: tenantResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create tenant.' });
  } finally {
    client.release();
  }
};

// PUT /api/tenants/:id
const update = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_no, rfid_code, fingerprint_id, phone, is_active } = req.body;
    const result = await pool.query(
      `UPDATE tenants SET room_no=$1, rfid_code=$2, fingerprint_id=$3, phone=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [room_no, rfid_code, fingerprint_id, phone, is_active, id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Tenant not found.' });
    res.json({ message: 'Tenant updated.', tenant: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tenant.' });
  }
};

// DELETE /api/tenants/:id
const remove = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenant = await client.query('SELECT user_id FROM tenants WHERE id = $1', [req.params.id]);
    if (!tenant.rows.length) return res.status(404).json({ error: 'Tenant not found.' });
    await client.query('DELETE FROM payments WHERE tenant_id = $1', [req.params.id]);
    await client.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    await client.query('DELETE FROM users WHERE id = $1', [tenant.rows[0].user_id]);
    await client.query('COMMIT');
    res.json({ message: 'Tenant deleted.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete tenant.' });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getOne, create, update, remove };
