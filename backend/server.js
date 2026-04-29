/**
 * ============================================
 * Smart Data Chatbot Dashboard - Main Server
 * ============================================
 * Entry point for the Express backend.
 * Loads routes, middleware, and starts the server.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve uploaded/generated files
app.use('/reports', express.static(path.join(__dirname, 'reports')));

// --------------- Routes ---------------
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const chatRoutes = require('./routes/chat');
const reportRoutes = require('./routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reports', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --------------- Start Server ---------------
app.listen(PORT, () => {
  console.log(`\n✅  Smart Dashboard API running on http://localhost:${PORT}`);
  console.log(`    Health check: http://localhost:${PORT}/api/health\n`);
});
