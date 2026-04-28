require('dotenv').config();
require('./config/db');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ========================
// Security Middleware
// ========================
app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:4200',
  credentials: true,
}));

// Rate limiting — protects against brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' },
});

// ========================
// Body Parsing
// ========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// Routes
// ========================
const authRoutes = require('./routes/auth.routes');
const resourceRoutes = require('./routes/resource.routes');
const categoryRoutes = require('./routes/category.routes');
const savedRoutes = require('./routes/saved.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const accountRoutes = require('./routes/account.routes');
const adminRoutes = require('./routes/admin.routes');
const submissionRoutes = require('./routes/submission.routes');
const messageRoutes = require('./routes/message.routes');

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/messages', messageRoutes);

// ========================
// Health Check
// ========================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Community Resource Finder API is running' });
});

// ========================
// 404 Handler
// ========================
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ========================
// Global Error Handler
// ========================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ========================
// Start Server
// ========================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;