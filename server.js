require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend/public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'smartrental2024secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── View Engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'frontend/views'));

// ─── Database Connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartrental')
  .then(() => console.log('✅ MongoDB Connected Successfully'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./backend/routes/authRoutes'));
app.use('/api/tenants',  require('./backend/routes/tenantRoutes'));
app.use('/api/payments', require('./backend/routes/paymentRoutes'));
app.use('/api/door',     require('./backend/routes/doorRoutes'));
app.use('/api/devices',  require('./backend/routes/deviceRoutes'));

// Web routes (UI pages)
app.use('/', require('./backend/routes/webRoutes'));

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Smart Rental System running on port ${PORT}`);
  console.log(`📍 Visit: http://localhost:${PORT}`);
});

module.exports = app;
