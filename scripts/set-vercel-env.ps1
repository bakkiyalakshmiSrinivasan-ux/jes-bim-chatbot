# Sets all 15 JES BIM Notion DB IDs as Vercel env vars in one run.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\set-vercel-env.ps1
# Must be run from the jes-bim-chatbot folder (where `vercel` project link exists).
# Needs Vercel CLI installed (`npm i -g vercel`) and you must be logged in.

$envs = @{
    # TIER 1
    "NOTION_PROJECTS_DB"      = "2b403a9f5f044e589c5fc44491567a02"
    "NOTION_PEOPLE_DB"        = "339d3da19a3640b8a46af7297a857095"
    "NOTION_CLIENTS_DB"       = "0506f85255cf457d829c4a79ac513c7c"
    # TIER 2
    "NOTION_DELIVERABLES_DB"  = "d521b9cd266b45ca9495718e7ca46f84"
    "NOTION_SCHEDULE_DB"      = "a00e7c2c90ef433db48608ec496728c9"
    "NOTION_INPUTS_DB"        = "7eef0591b63242fbb5a2cf0b88fe32fb"
    "NOTION_ISSUES_DB"        = "2a5606216f374fe586c81f1f03e3f211"
    "NOTION_COMMS_DB"         = "1c9d1f151aeb406d9051393127c5b1b4"
    "NOTION_DOCUMENTS_DB"     = "cae34725892b4de5890c9d63110fe640"
    "NOTION_MODEL_UPDATES_DB" = "47e17ce67e0a4b2a92fb05f9155b3ed2"
    # TIER 3
    "NOTION_COMMERCIAL_DB"    = "7d49b5949ddc4bbdabad464beb699a60"
    "NOTION_MANMONTHS_DB"     = "c8645649af824252806015679dcf059f"
    "NOTION_VARIATIONS_DB"    = "69de32e25cd24a59a8246645f7411a0b"
    "NOTION_KPI_DB"           = "0ce34a00397e4843937b0fe4eedd09d8"
    "NOTION_TIMESHEETS_DB"    = "5d2556ccc4854c99aaa1764b5b693ec1"
}

Write-Host ""
Write-Host "Setting 15 Notion DB IDs on Vercel project jes-bim-ai..." -ForegroundColor Cyan
Write-Host ""

foreach ($key in $envs.Keys) {
    $value = $envs[$key]
    # Remove any existing value first (ignore failure if not present), then add.
    Write-Host "[$key]" -ForegroundColor Yellow
    & vercel env rm $key production --yes 2>$null | Out-Null
    & vercel env rm $key preview    --yes 2>$null | Out-Null
    $value | & vercel env add $key production 2>&1 | Out-Null
    $value | & vercel env add $key preview    2>&1 | Out-Null
    Write-Host "  -> $value" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Deploy with:  vercel --prod" -ForegroundColor Cyan
