const { Client } = require('@notionhq/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const notion = new Client({ auth: process.env.NOTION_TOKEN });

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, password, adminToken } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify admin token if provided (only admins can create Manager accounts)
    let requestorRole = 'Viewer';
    if (adminToken) {
      try {
        const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
        requestorRole = decoded.role;
      } catch (e) {
        // Invalid token, proceed as regular signup
      }
    }

    // Check if user already exists
    const existing = await notion.databases.query({
      database_id: process.env.NOTION_PEOPLE_DB,
      filter: {
        property: 'Email',
        email: { equals: email.toLowerCase().trim() }
      }
    });

    if (existing.results.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Determine role: only Admin can create Manager/Admin accounts
    let assignedRole = 'Viewer';
    if (requestorRole === 'Admin' && req.body.role) {
      assignedRole = req.body.role; // Admin can assign any role
    }

    // Create user in Notion People DB
    const newUser = await notion.pages.create({
      parent: { database_id: process.env.NOTION_PEOPLE_DB },
      properties: {
        'Name': {
          title: [{ text: { content: name.trim() } }]
        },
        'Email': {
          email: email.toLowerCase().trim()
        },
        'Password Hash': {
          rich_text: [{ text: { content: passwordHash } }]
        },
        'App Role': {
          select: { name: assignedRole }
        }
      }
    });

    // Generate JWT
    const user = {
      id: newUser.id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: assignedRole
    };

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      success: true,
      token,
      user
    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
