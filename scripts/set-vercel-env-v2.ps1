# Auto-generated v2 Vercel env-var setter. Run from jes-bim-chatbot folder.
$envs = @{
    "NOTION_PROJECTS_DB" = "ee55983748e64b5382823ab5d1a0a192"
    "NOTION_PEOPLE_DB" = "57cfd1f84a654c7dbe0448f07cd12725"
    "NOTION_CLIENTS_DB" = "2db7bd36cbd64d6d859b9bdf9dde62d8"
    "NOTION_DELIVERABLES_DB" = "a637527fa2b04ccd85c29c2bd9714a51"
    "NOTION_SCHEDULE_DB" = "3502d6b7290f81a1a435cbb39587a1da"
    "NOTION_INPUTS_DB" = "3502d6b7290f819f9941c83920e850b6"
    "NOTION_ISSUES_DB" = "3502d6b7290f81918496f8a7c66b336c"
    "NOTION_COMMS_DB" = "3502d6b7290f8115ab00daba52d73f7d"
    "NOTION_DOCUMENTS_DB" = "3502d6b7290f8110b12ee7f16a849065"
    "NOTION_MODEL_UPDATES_DB" = "3502d6b7290f8192867ae2fdb7a02c9c"
    "NOTION_COMMERCIAL_DB" = "3502d6b7290f81b9a0e6cd3b275887ba"
    "NOTION_MANMONTHS_DB" = "3502d6b7290f81fb9a84f307e68f43ee"
    "NOTION_VARIATIONS_DB" = "3502d6b7290f819ca667ee7f7d3bc0f9"
    "NOTION_KPI_DB" = "3502d6b7290f819b8da8d7d014812a45"
    "NOTION_TIMESHEETS_DB" = "3502d6b7290f8189aa10d0aebaa1ba15"
}
foreach ($key in $envs.Keys) {
    Write-Host "[$key] -> $($envs[$key])" -ForegroundColor Yellow
    & vercel env rm $key production --yes 2>$null | Out-Null
    $envs[$key] | & vercel env add $key production 2>&1 | Out-Null
}
Write-Host "Done. Run: vercel --prod" -ForegroundColor Cyan
