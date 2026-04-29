// All packages lazy-loaded inside handler to prevent module-load crashes

// ── Env-var user fallback ─────────────────────────────────────────────────────
// Supports up to 5 pre-configured users via environment variables.
// Each user: USER{N}_EMAIL, USER{N}_PASSWORD (plain), USER{N}_NAME, USER{N}_ROLE
// Also supports ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME for the primary admin.
function getEnvUsers() {
  const users = [];

  // Primary admin shorthand
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    users.push({
      id: 'admin-env',
      email: process.env.ADMIN_EMAIL.toLowerCase().trim(),
      password: process.env.ADMIN_PASSWORD,
      name: process.env.ADMIN_NAME || 'Admin',
      role: 'Admin',
    });
  }

  // USER1 … USER5
  for (let i = 1; i <= 5; i++) {
    const email = process.env[`USER${i}_EMAIL`];
    const pass  = process.env[`USER${i}_PASSWORD`];
    if (email && pass) {
      users.push({
        id: `user${i}-env`,
        email: email.toLowerCase().trim(),
        password: pass,
        name:  process.env[`USER${i}_NAME`]  || `User ${i}`,
        role:  process.env[`USER${i}_ROLE`]  || 'Viewer',
      });
    }
  }

  return users;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const jwt = require('jsonwebtoken');
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailNorm = email.toLowerCase().trim();

    // ── 1. Try env-var users first (always available, fast) ───────────────────
    const envUsers = getEnvUsers();
    const envMatch = envUsers.find(u => u.email === emailNorm);

    if (envMatch) {
      if (envMatch.password !== password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = { id: envMatch.id, name: envMatch.name, email: envMatch.email, role: envMatch.role };
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(200).json({ success: true, token, user });
    }

    // ── 2. Fall back to Notion People DB ─────────────────────────────────────
    if (!process.env.NOTION_PEOPLE_DB || !process.env.NOTION_TOKEN) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { Client } = require('@notionhq/client');
    const bcrypt = require('bcryptjs');
    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    const response = await notion.databases.query({
      database_id: process.env.NOTION_PEOPLE_DB,
      filter: { property: 'Email', email: { equals: emailNorm } }
    });

    if (response.results.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const userPage = response.results[0];
    const props = userPage.properties;

    const storedHash = props['Password Hash']?.rich_text?.[0]?.plain_text;
    if (!storedHash) {
      return res.status(401).json({ error: 'Account not configured. Contact admin.' });
    }

    const isValid = await bcrypt.compare(password, storedHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = {
      id:          userPage.id,
      name:        props['Name']?.title?.[0]?.plain_text || 'User',
      email:       emailNorm,
      role:        props['App Role']?.select?.name || 'Viewer',
      designation: props['Designation']?.select?.name || '',
    };

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({ success: true, token, user });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
