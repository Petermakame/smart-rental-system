const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── Protect API routes (JWT) ─────────────────────────────────────────────────
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Tafadhali ingia kwanza' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartrental2024');
    const user = await User.findById(decoded.id).select('-password');

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Mtumiaji hapatikani au amezimwa' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token si sahihi au imekwisha' });
  }
};

// ─── Restrict to specific roles ───────────────────────────────────────────────
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Huna ruhusa ya kufanya hili'
      });
    }
    next();
  };
};

// ─── Session-based protection (for web pages) ────────────────────────────────
exports.requireSession = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

exports.requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.userRole !== 'admin') {
    return res.redirect('/login');
  }
  next();
};

exports.requireTenant = (req, res, next) => {
  if (!req.session.userId || req.session.userRole !== 'tenant') {
    return res.redirect('/login');
  }
  next();
};

// ─── ESP32 API Key middleware (optional security for IoT) ─────────────────────
exports.esp32Auth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validKey = process.env.ESP32_API_KEY || 'esp32_secret_key_2024';

  if (!apiKey || apiKey !== validKey) {
    // Allow without key in development
    if (process.env.NODE_ENV === 'development') return next();
    return res.status(401).json({ success: false, message: 'ESP32 API Key si sahihi' });
  }
  next();
};
