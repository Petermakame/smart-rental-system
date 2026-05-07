const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Tenant = require('../models/Tenant');

// ─── Generate JWT Token ───────────────────────────────────────────────────────
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'smartrental2024', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email tayari imetumika' });
    }

    // Only admins can create admin accounts
    const userRole = role === 'admin' ? 'tenant' : (role || 'tenant');

    const user = await User.create({ name, email, password, role: userRole, phone });
    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Akaunti imeundwa kwa mafanikio',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email na password vinahitajika' });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Email au password si sahihi' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Akaunti imezimwa. Wasiliana na admin' });
    }

    const token = signToken(user._id);

    // Set session
    req.session.userId = user._id;
    req.session.userRole = user.role;
    req.session.userName = user.name;

    res.json({
      success: true,
      message: 'Umeingia kwa mafanikio',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      redirect: user.role === 'admin' ? '/admin/dashboard' : '/tenant/dashboard'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
exports.logout = (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Umetoka kwa mafanikio', redirect: '/login' });
};

// ─── GET CURRENT USER ─────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CREATE ADMIN (First time setup) ─────────────────────────────────────────
exports.createAdmin = async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      return res.status(400).json({ success: false, message: 'Admin tayari yupo' });
    }

    const admin = await User.create({
      name: process.env.ADMIN_NAME || 'System Admin',
      email: process.env.ADMIN_EMAIL || 'admin@smartrental.com',
      password: process.env.ADMIN_PASSWORD || 'Admin@2024',
      role: 'admin'
    });

    res.json({ success: true, message: 'Admin ameundwa', email: admin.email });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
