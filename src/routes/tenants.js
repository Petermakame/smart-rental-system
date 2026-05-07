const router = require('express').Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET all tenants (admin only)
router.get('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  try {
    const result = await pool.query(`
      SELECT t.*, u.name, u.email, u.phone 
      FROM tenants t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.room_no
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single tenant
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, u.name, u.email, u.phone 
      FROM tenants t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.id = $1
    `, [req.params.id]);
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create tenant
router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { name, email, password, room_no, phone, rfid_code } = req.body;
  
  try {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, email, hashed, 'tenant']
    );
    
    // Create tenant
    const tenant = await pool.query(
      'INSERT INTO tenants (user_id, room_no, phone, rfid_code, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [user.rows[0].id, room_no, phone, rfid_code, true]
    );
    
    res.status(201).json({ id: tenant.rows[0].id, message: 'Tenant created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update tenant
router.put('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { room_no, phone, rfid_code, is_active } = req.body;
  
  try {
    await pool.query(
      'UPDATE tenants SET room_no = COALESCE($1, room_no), phone = COALESCE($2, phone), rfid_code = COALESCE($3, rfid_code), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5',
      [room_no, phone, rfid_code, is_active, req.params.id]
    );
    res.json({ message: 'Tenant updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE tenant
router.delete('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  try {
    await pool.query('DELETE FROM tenants WHERE id = $1', [req.params.id]);
    res.json({ message: 'Tenant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;