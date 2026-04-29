/**
 * ============================================
 * Chat Routes
 * ============================================
 * POST /api/chat - Send a message to the chatbot
 */

const express = require('express');
const router = express.Router();
const { processMessage } = require('../modules/chatbot');
const { authenticateToken } = require('../middleware/auth');

// Chatbot requires authentication
router.use(authenticateToken);

/**
 * POST /api/chat
 * Body: { message: "show bench employees" }
 * Returns: { text, data, type, columns? }
 */
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required.' });
    }

    const response = await processMessage(message);
    res.json(response);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({
      text: 'Sorry, something went wrong while processing your request.',
      data: null,
      type: 'error',
    });
  }
});

module.exports = router;
