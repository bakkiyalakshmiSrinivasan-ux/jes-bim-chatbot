/**
 * ============================================
 * Authentication Routes
 * ============================================
 * POST /api/auth/login    - Login and receive JWT token
 * POST /api/auth/register - Register new user (admin only)
 * GET  /api/auth/me       - Get current user info
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { readData, writeData } = require('../modules/dataHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, user }
 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const users = readData('users');
    const user = users.find((u) => u.username === username);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Compare password with hash
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        email: user.email,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * POST /api/auth/register (Admin only)
 * Body: { username, password, name, email, role }
 */
router.post('/register', authenticateToken, authorizeRoles('admin'), (req, res) => {
  try {
    const { username, password, name, email, role } = req.body;

    if (!username || !password || !name || !role) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const users = readData('users');

    // Check if username already exists
    if (users.find((u) => u.username === username)) {
      return res.status(409).json({ error: 'Username already exists.' });
    }

    // Hash password and create user
    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = {
      id: users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      username,
      password: hashedPassword,
      role,
      name,
      email: email || '',
    };

    users.push(newUser);
    writeData('users', users);

    res.status(201).json({
      message: 'User created successfully.',
      user: { id: newUser.id, username, name, role, email },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

/**
 * GET /api/auth/me - Get current user info from token
 */
router.get('/me', authenticateToken, (req, res) => {
  try {
    const users = readData('users');
    const user = users.find((u) => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
