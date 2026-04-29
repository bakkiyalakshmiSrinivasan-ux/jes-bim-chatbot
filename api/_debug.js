const { Client } = require('@notionhq/client');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const results = {
    claude: null,
    claude_error: null,
    notion_connected: null,
    notion_error: null,
    databases_found: [],
    current_projects_db: process.env.NOTION_PROJECTS_DB,
    projects_db_works: false,
    projects_in_current_db: [],
    all_projects_across_dbs: [],
  };

  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    // Test connection
    const me = await notion.users.me();
    results.notion_connected = `✅ Connected as: ${me.name || 'Bot'}`;

    // Search for all databases the integration can see
    const searchRes = await notion.search({
      filter: { value: 'database', property: 'object' },
      page_size: 50
    });

    results.databases_found = searchRes.results.map(db => ({
      id: db.id,
      name: db.title?.[0]?.plain_text || '(no title)',
      url: `https://notion.so/${db.id.replace(/-/g, '')}`
    }));

    // Test current NOTION_PROJECTS_DB and list all project names in it
    try {
      const test = await notion.databases.query({
        database_id: process.env.NOTION_PROJECTS_DB,
        page_size: 100
      });
      results.projects_db_works = `✅ Works! Found ${test.results.length} record(s)`;
      results.projects_in_current_db = test.results.map(page => {
        const p = page.properties;
        return {
          name: p['Project Name']?.title?.[0]?.plain_text || '(no name)',
          billingModel: p['Billing Model']?.select?.name || '(none)',
          status: p['Status']?.select?.name || '(none)',
        };
      });
    } catch (e2) {
      results.projects_db_works = `❌ ${e2.message}`;
    }

    // Search ALL pages across all databases to find any project-like pages
    const pageSearch = await notion.search({
      filter: { value: 'page', property: 'object' },
      page_size: 50
    });

    results.all_projects_across_dbs = pageSearch.results.map(page => {
      const p = page.properties || {};
      const name = p['Project Name']?.title?.[0]?.plain_text
        || p['Name']?.title?.[0]?.plain_text
        || page.properties ? Object.values(page.properties).find(v => v.type === 'title')?.title?.[0]?.plain_text : null
        || '(unknown)';
      return {
        name,
        parent_db: page.parent?.database_id || 'standalone page',
        url: page.url,
        billing: p['Billing Model']?.select?.name || '—',
      };
    }).filter(p => p.name && p.name !== '(unknown)');

  } catch (e) {
    results.notion_error = e.message;
  }

  // Test Claude
  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say: OK' }]
      })
    });
    results.claude = claudeRes.ok ? '✅ Working' : `❌ HTTP ${claudeRes.status}`;
  } catch (e) {
    results.claude_error = e.message;
  }

  res.status(200).json(results);
};
