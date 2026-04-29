#!/bin/bash
# ============================================
# JES BIM AI — One-command deploy to Vercel
# Run this script once from this folder
# ============================================

echo "📦 Installing Vercel CLI..."
npm install -g vercel

echo ""
echo "🔑 You'll be asked to log in to Vercel (browser will open)"
echo ""

vercel --prod \
  --yes \
  --env NOTION_TOKEN \
  --env CLAUDE_API_KEY \
  --env JWT_SECRET \
  --env NOTION_PROJECTS_DB \
  --env NOTION_PEOPLE_DB \
  --env NOTION_KPI_DB \
  --env NOTION_MANMONTHS_DB \
  --env NOTION_ISSUES_DB \
  --env NOTION_DELIVERABLES_DB \
  --env NOTION_SCHEDULE_DB \
  --env ADMIN_EMAIL \
  --env ADMIN_PASSWORD \
  --env ADMIN_NAME

echo ""
echo "✅ Done! Your live URL is shown above."
