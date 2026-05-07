const pool = require('../config/database');

const getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM devices ORDER BY created_at DESC');
    res.json({ devices: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch devices.' });
  }
};

const create = async (req, res) => {
  try {
    const { device_name, location, room_no } = req.body;
    if (!device_name) return res.status(400).json({ error: 'device_name required.' });
    const result = await pool.query(
      'INSERT INTO devices (device_name, location, room_no) VALUES ($1, $2, $3) RETURNING *',
      [device_name, location || null, room_no || null]
    );
    res.status(201).json({ device: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create device.' });
  }
};

// ESP32 heartbeat – updates last_seen
const heartbeat = async (req, res) => {
  try {
    const { device_id, ip_address } = req.body;
    await pool.query(
      'UPDATE devices SET status=$1, last_seen=NOW(), ip_address=$2 WHERE id=$3',
      ['online', ip_address || null, device_id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed.' });
  }
};

module.exports = { getAll, create, heartbeat };
