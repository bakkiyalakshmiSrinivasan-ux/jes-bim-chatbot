# JES BIM Report Assistant — Deployment Guide

## Step 1: Set Up Notion Integration

1. Go to **https://www.notion.so/my-integrations**
2. Click **"New integration"**
3. Name it: `JES BIM Chatbot`
4. Select your workspace
5. Copy the **Internal Integration Token** (starts with `ntn_`)
6. Go to your **SSOT Hub** in Notion
7. Click **"..." menu** → **"Connections"** → Add your integration
8. Repeat for each database (DB-A through DB-11)

### Add these properties to DB-B (People & Resources):
- `Email` (type: Email)
- `Password Hash` (type: Rich Text)
- `App Role` (type: Select — options: Admin, Manager, Viewer)

## Step 2: Get Claude API Key

1. Go to **https://console.anthropic.com**
2. Create an account or sign in
3. Go to **Settings → API Keys**
4. Create a new key, copy it (starts with `sk-ant-`)

## Step 3: Deploy to Vercel

### Option A: Deploy via Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to the project
cd jes-bim-chatbot

# Install dependencies
npm install

# Deploy
vercel

# Follow the prompts, then set environment variables:
vercel env add NOTION_TOKEN
vercel env add CLAUDE_API_KEY
vercel env add JWT_SECRET
vercel env add NOTION_PROJECTS_DB
vercel env add NOTION_PEOPLE_DB
vercel env add NOTION_KPI_DB

# Deploy to production
vercel --prod
```

### Option B: Deploy via GitHub
1. Push this folder to a GitHub repo
2. Go to **https://vercel.com**
3. Click **"Import Project"** → Select your repo
4. Add environment variables in the Vercel dashboard
5. Click **Deploy**

## Step 4: Set Environment Variables

In your Vercel dashboard → Project → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `NOTION_TOKEN` | Your Notion integration token |
| `CLAUDE_API_KEY` | Your Anthropic API key |
| `JWT_SECRET` | Any random secret string (e.g., `jes-bim-2026-secret-key`) |
| `NOTION_PROJECTS_DB` | `e642d6b7-290f-8375-ae5f-87bf8a8e43bf` |
| `NOTION_PEOPLE_DB` | `68c2d6b7-290f-8263-9096-87330e998c62` |
| `NOTION_KPI_DB` | `2192d6b7-290f-83d2-b922-07458dde6e6b` |
| `NOTION_DELIVERABLES_DB` | `83c2d6b7-290f-83a0-badb-07009e91a5a6` |
| `NOTION_MANMONTHS_DB` | `c9d2d6b7-290f-836b-b73a-875cd6c9dfd7` |
| `NOTION_ISSUES_DB` | `e6c2d6b7-290f-8392-9548-07f322013a0d` |
| `NOTION_SCHEDULE_DB` | `a2b2d6b7-290f-8240-a83c-072a7fdc9734` |

## Step 5: Create Admin User

After deploying, create the first admin user:

1. Open your deployed app URL
2. Click "Sign Up"
3. Create an account with your email
4. The first user will be a Viewer by default
5. Go to Notion → DB-B (People & Resources)
6. Find your entry and change `App Role` to **Admin**
7. Now you can manage other users from the app

## Step 6: Embed in Your Website (Optional)

Add this to any webpage to embed the chatbot:
```html
<iframe
  src="https://your-app.vercel.app"
  style="position:fixed;bottom:20px;right:20px;width:420px;height:650px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999;"
></iframe>
```

## Costs
- Vercel Free Tier: $0/month
- Notion API: Free
- Claude API: ~$5-15/month (usage-based)
