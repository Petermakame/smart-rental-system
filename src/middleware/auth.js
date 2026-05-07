const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// Verify JWT token from Authorization header or cookie
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid token.' });

    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Require Admin role
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  next();
};

// Require Tenant role (or Admin)
const requireTenantOrAdmin = (req, res, next) => {
  if (!['admin', 'tenant'].includes(req.user?.role)) return res.status(403).json({ error: 'Access denied.' });
  next();
};

// Web session auth (for views)
const requireWebAuth = (req, res, next) => {
  if (!req.session?.userId) return res.redirect('/login');
  next();
};

const requireWebAdmin = (req, res, next) => {
  if (!req.session?.userId || req.session?.role !== 'admin') return res.redirect('/login');
  next();
};

module.exports = { verifyToken, requireAdmin, requireTenantOrAdmin, requireWebAuth, requireWebAdmin };
