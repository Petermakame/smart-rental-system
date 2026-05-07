const router = require('express').Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET all payments
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT p.*, t.room_no, u.name as tenant_name 
      FROM payments p 
      JOIN tenants t ON p.tenant_id = t.id 
      JOIN users u ON t.user_id = u.id 
      ORDER BY p.created_at DESC
    `;
    
    // If tenant, only show their payments
    if (req.user.role === 'tenant') {
      const tenant = await pool.query('SELECT id FROM tenants WHERE user_id = $1', [req.user.id]);
      if (tenant.rows.length) {
        query = `
          SELECT * FROM payments 
          WHERE tenant_id = $1 
          ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [tenant.rows[0].id]);
        return res.json(result.rows);
      }
    }
    
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create payment
router.post('/', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { tenant_id, amount, months = 1, payment_method, reference } = req.body;
  
  try {
    // Calculate expiry date
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + months);
    
    const result = await pool.query(
      `INSERT INTO payments (tenant_id, amount, payment_method, reference, status, expiry_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [tenant_id, amount, payment_method, reference, 'paid', expiry]
    );
    
    // Update tenant payment status
    await pool.query(
      'UPDATE tenants SET is_active = true, updated_at = NOW() WHERE id = $1',
      [tenant_id]
    );
    
    res.status(201).json({ id: result.rows[0].id, message: 'Payment recorded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update payment status
router.put('/:id', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  
  const { status } = req.body;
  
  try {
    await pool.query(
      'UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, req.params.id]
    );
    res.json({ message: 'Payment status updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;