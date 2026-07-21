# Set XAI_API_KEY on Render service evolve-perc-internet (and optional primeminster).
# Requires RENDER_API_KEY in env (https://dashboard.render.com/u/settings#api-keys).
# Usage:
#   $env:RENDER_API_KEY = 'rnd_...'
#   $env:XAI_API_KEY = 'xai-...'   # or load from grok_proxy.local.env
#   .\scripts\set_render_xai.ps1

$ErrorActionPreference = 'Stop'
$token = $env:RENDER_API_KEY
if (-not $token) { throw 'RENDER_API_KEY not set. Create one at https://dashboard.render.com/u/settings#api-keys' }

$xai = $env:XAI_API_KEY
if (-not $xai) {
  $envFile = Join-Path $PSScriptRoot '..\..\evolve_app\grok_proxy.local.env'
  if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^\s*XAI_API_KEY\s*=\s*(.+)\s*$') { $xai = $Matches[1].Trim().Trim('"') }
    }
  }
}
if (-not $xai) { throw 'XAI_API_KEY not set and not found in evolve_app/grok_proxy.local.env' }

$headers = @{ Authorization = "Bearer $token"; Accept = 'application/json' }
$services = Invoke-RestMethod -Uri 'https://api.render.com/v1/services?limit=50' -Headers $headers
$targets = @($services | ForEach-Object { $_.service } | Where-Object {
  $_.name -match 'evolve-perc-internet|primeminster|perc-internet'
})
if (-not $targets.Count) {
  Write-Host 'Services on account:'
  $services | ForEach-Object { Write-Host ' -' $_.service.name $_.service.id }
  throw 'No matching service found'
}

foreach ($svc in $targets) {
  Write-Host "Updating env on $($svc.name) ($($svc.id))..."
  $body = @{
    envVars = @(
      @{ key = 'XAI_API_KEY'; value = $xai }
      @{ key = 'XAI_MODEL'; value = ($env:XAI_MODEL ?? 'grok-3-mini') }
    )
  } | ConvertTo-Json -Depth 5
  Invoke-RestMethod -Method Put -Uri "https://api.render.com/v1/services/$($svc.id)/env-vars" `
    -Headers ($headers + @{ 'Content-Type' = 'application/json' }) `
    -Body $body | Out-Null
  # Trigger deploy
  try {
    Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$($svc.id)/deploys" `
      -Headers ($headers + @{ 'Content-Type' = 'application/json' }) `
      -Body '{}' | Out-Null
    Write-Host "  deploy triggered"
  } catch {
    Write-Host "  env set; trigger deploy manually if needed: $($_.Exception.Message)"
  }
}
Write-Host 'Done. After deploy, check https://evolve-perc-internet.onrender.com/scs/grok-status'
