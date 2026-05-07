const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// POST /api/auth/register
const register = async (req, res) => {
  try {
    const { name, email, password, role = 'tenant' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required.' });
    if (!['admin', 'tenant'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });

    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashed, role]
    );

    res.status(201).json({ message: 'User registered successfully.', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed.' });
  }
};

// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required.' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials.' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Also set session for web pages
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;

    res.json({
      message: 'Login successful.',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      redirect: user.role === 'admin' ? '/admin/dashboard' : '/tenant/dashboard',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed.' });
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  req.session.destroy();
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully.' });
};

// GET /api/auth/me
const me = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = { register, login, logout, me };
