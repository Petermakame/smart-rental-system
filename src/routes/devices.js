const router = require('express').Router();
const pool = require('../config/database');

// ESP32 heartbeat
router.post('/heartbeat', async (req, res) => {
  const { device_id, ip_address } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE devices 
       SET status = 'online', last_seen = NOW(), ip_address = COALESCE($2, ip_address), updated_at = NOW()
       WHERE device_name = $1 OR id::text = $1
       RETURNING id`,
      [device_id, ip_address]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json({ status: 'ok', message: 'Heartbeat received' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register new device
router.post('/register', async (req, res) => {
  const { device_name, location, room_no } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO devices (device_name, location, room_no, status) 
       VALUES ($1, $2, $3, 'offline') RETURNING id`,
      [device_name, location, room_no]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Device registered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all devices
router.get('/', async (req, res) => {
  try {
    const devices = await pool.query('SELECT * FROM devices ORDER BY created_at DESC');
    res.json(devices.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;