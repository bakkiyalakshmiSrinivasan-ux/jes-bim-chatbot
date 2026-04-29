/**
 * ============================================
 * Authentication Middleware
 * ============================================
 * Verifies JWT tokens and checks user roles.
 */

const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Verify that the request has a valid JWT token.
 * Attaches decoded user info to req.user
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Restrict access to specific roles.
 * Usage: authorizeRoles('admin', 'manager')
 */
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden. You do not have permission for this action.',
      });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRoles };
