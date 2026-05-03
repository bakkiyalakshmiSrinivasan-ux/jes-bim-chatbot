module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    status: 'ok',
    env: {
      ADMIN_EMAIL: process.env.ADMIN_EMAIL ? `set (${process.env.ADMIN_EMAIL})` : 'NOT SET',
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ? 'set ✓' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'set ✓' : 'NOT SET',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY ? 'set ✓' : 'NOT SET',
      NOTION_TOKEN: process.env.NOTION_TOKEN ? 'set ✓' : 'NOT SET',
      NOTION_PROJECTS_DB: process.env.NOTION_PROJECTS_DB ? 'set ✓' : 'NOT SET',
    }
  });
};
