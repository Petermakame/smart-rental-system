const router = require('express').Router();
const pool = require('../config/database');

// ESP32 checks access via RFID
router.get('/access', async (req, res) => {
  const { rfid } = req.query;
  
  if (!rfid) {
    return res.status(400).json({ error: 'RFID code required' });
  }
  
  try {
    // Find tenant by RFID
    const tenant = await pool.query(`
      SELECT t.*, u.name 
      FROM tenants t 
      JOIN users u ON t.user_id = u.id 
      WHERE t.rfid_code = $1
    `, [rfid]);
    
    if (!tenant.rows.length) {
      // Log denied access
      await pool.query(
        'INSERT INTO access_logs (tenant_id, decision, reason) VALUES (NULL, $1, $2)',
        ['DENY', 'RFID not recognized']
      );
      return res.json({ allowed: false, reason: 'RFID not recognized' });
    }
    
    const tenantData = tenant.rows[0];
    
    // Check if tenant is active
    if (!tenantData.is_active) {
      await pool.query(
        'INSERT INTO access_logs (tenant_id, decision, reason) VALUES ($1, $2, $3)',
        [tenantData.id, 'DENY', 'Account inactive']
      );
      return res.json({ allowed: false, reason: 'Account inactive. Please pay rent.' });
    }
    
    // Check for valid payment (expiry date not passed)
    const payment = await pool.query(
      `SELECT * FROM payments 
       WHERE tenant_id = $1 AND status = 'paid' 
       ORDER BY expiry_date DESC LIMIT 1`,
      [tenantData.id]
    );
    
    if (!payment.rows.length || (payment.rows[0].expiry_date && new Date() > payment.rows[0].expiry_date)) {
      await pool.query(
        'INSERT INTO access_logs (tenant_id, decision, reason) VALUES ($1, $2, $3)',
        [tenantData.id, 'DENY', 'Payment expired']
      );
      return res.json({ allowed: false, reason: 'Payment expired. Please renew.' });
    }
    
    // Grant access
    await pool.query(
      'INSERT INTO access_logs (tenant_id, decision, reason) VALUES ($1, $2, $3)',
      [tenantData.id, 'ALLOW', 'Access granted']
    );
    
    res.json({ 
      allowed: true, 
      name: tenantData.name,
      room: tenantData.room_no,
      message: 'Door unlocked'
    });
    
  } catch (err) {
    console.error('Door access error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get access logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await pool.query(`
      SELECT al.*, u.name as tenant_name, t.room_no 
      FROM access_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY al.created_at DESC 
      LIMIT 100
    `);
    res.json(logs.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;