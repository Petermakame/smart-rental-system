require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Middleware ───────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));

// ─── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// ─── Body Parsing ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Session ───────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── View Engine ───────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../public/views'));
app.use(express.static(path.join(__dirname, '../public')));

// ─── Routes ────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/payments',require('./routes/payments'));
app.use('/api/door',    require('./routes/door'));
app.use('/api/devices', require('./routes/devices'));
app.use('/',            require('./routes/web'));

// ─── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route not found' });
  res.status(404).render('404');
});

// ─── Error Handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (req.path.startsWith('/api/')) return res.status(500).json({ error: 'Server error' });
  res.status(500).render('error', { message: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Smart Rental System running on http://localhost:${PORT}`);
});

module.exports = app;
