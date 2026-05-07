const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

// Verify JWT token for API routes
const verifyToken = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
    
    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    
    req.user = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Check if user is logged in for web routes
const requireWebAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// Check if user is admin for web routes
const requireWebAdmin = async (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (!result.rows.length || result.rows[0].role !== 'admin') {
      return res.status(403).render('error', { message: 'Access denied. Admin only.' });
    }
    next();
  } catch (err) {
    res.status(500).render('error', { message: err.message });
  }
};

module.exports = { verifyToken, requireWebAuth, requireWebAdmin };