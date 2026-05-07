const pool = require('../config/database');

// GET /api/door/access?tenantId=1  OR  ?rfid=XXXX  OR  ?fingerprint=1
// ESP32 calls this endpoint
const checkAccess = async (req, res) => {
  try {
    const { tenantId, rfid, fingerprint, deviceId } = req.query;
    let query, params;

    if (rfid) {
      query = `SELECT t.id, t.is_active, t.room_no, u.name,
                 p.status AS pay_status, p.expiry_date
               FROM tenants t JOIN users u ON t.user_id = u.id
               LEFT JOIN payments p ON p.tenant_id = t.id
               WHERE t.rfid_code = $1 ORDER BY p.created_at DESC LIMIT 1`;
      params = [rfid];
    } else if (fingerprint) {
      query = `SELECT t.id, t.is_active, t.room_no, u.name,
                 p.status AS pay_status, p.expiry_date
               FROM tenants t JOIN users u ON t.user_id = u.id
               LEFT JOIN payments p ON p.tenant_id = t.id
               WHERE t.fingerprint_id = $1 ORDER BY p.created_at DESC LIMIT 1`;
      params = [fingerprint];
    } else if (tenantId) {
      query = `SELECT t.id, t.is_active, t.room_no, u.name,
                 p.status AS pay_status, p.expiry_date
               FROM tenants t JOIN users u ON t.user_id = u.id
               LEFT JOIN payments p ON p.tenant_id = t.id
               WHERE t.id = $1 ORDER BY p.created_at DESC LIMIT 1`;
      params = [tenantId];
    } else {
      return res.status(400).json({ access: 'DENY', reason: 'No identifier provided' });
    }

    const result = await pool.query(query, params);
    if (!result.rows.length) {
      await logAccess(null, deviceId, 'DENY', 'Unknown tenant');
      return res.json({ access: 'DENY', reason: 'Tenant not found' });
    }

    const t = result.rows[0];
    const expired = t.expiry_date && new Date(t.expiry_date) < new Date();

    let decision = 'DENY';
    let reason = '';

    if (!t.is_active) {
      reason = 'Account inactive';
    } else if (t.pay_status !== 'paid') {
      reason = 'Payment not made';
    } else if (expired) {
      reason = 'Payment expired';
      await pool.query('UPDATE tenants SET is_active = false WHERE id = $1', [t.id]);
    } else {
      decision = 'ALLOW';
      reason = 'Access granted';
    }

    await logAccess(t.id, deviceId, decision, reason);

    // Response format optimized for ESP32 parsing
    res.json({
      access: decision,
      reason,
      tenant: t.name,
      room: t.room_no,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ access: 'DENY', reason: 'Server error' });
  }
};

// Log every access attempt
const logAccess = async (tenantId, deviceId, decision, reason) => {
  try {
    await pool.query(
      'INSERT INTO access_logs (tenant_id, device_id, decision, reason) VALUES ($1, $2, $3, $4)',
      [tenantId || null, deviceId || null, decision, reason]
    );
  } catch (err) {
    console.error('Log error:', err.message);
  }
};

// GET /api/door/logs - Admin view access logs
const getLogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await pool.query(`
      SELECT al.*, u.name AS tenant_name, t.room_no, d.device_name
      FROM access_logs al
      LEFT JOIN tenants t ON al.tenant_id = t.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN devices d ON al.device_id = d.id
      ORDER BY al.created_at DESC LIMIT $1
    `, [limit]);
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs.' });
  }
};

// POST /api/door/manual - Admin manually open/close door
const manualControl = async (req, res) => {
  try {
    const { device_id, action } = req.body; // action: 'open' | 'lock'
    if (!['open', 'lock'].includes(action)) return res.status(400).json({ error: 'Invalid action.' });

    await pool.query(
      'UPDATE devices SET status = $1, updated_at = NOW() WHERE id = $2',
      [action === 'open' ? 'online' : 'offline', device_id]
    );

    // In real system, you'd send MQTT or HTTP request to ESP32
    res.json({ message: `Door ${action} command sent.`, device_id, action });
  } catch (err) {
    res.status(500).json({ error: 'Failed to control door.' });
  }
};

module.exports = { checkAccess, getLogs, manualControl };
