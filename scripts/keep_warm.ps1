# Keep-warm Render free-tier service (NOT Flyclient).
# Flyclient is a blockchain light-client protocol — it does not wake Render or speed page HTML.
#
# Usage:
#   .\scripts\keep_warm.ps1                 # loop every 12 minutes
#   .\scripts\keep_warm.ps1 -Once           # single dual probe
#   .\scripts\keep_warm.ps1 -Times 2
param(
  [string]$BaseUrl = $(if ($env:KEEP_WARM_BASE_URL) { $env:KEEP_WARM_BASE_URL } else { 'https://evolve-perc-internet.onrender.com' }),
  [int]$IntervalMinutes = 12,
  [switch]$Once,
  [int]$Times = 0,
  [int]$TimeoutSec = 120
)

$ErrorActionPreference = 'Continue'
$BaseUrl = $BaseUrl.TrimEnd('/')
$paths = @('/health', '/burnham')
if ($Once) { $Times = [Math]::Max(1, $Times) }

function Invoke-WarmPing {
  $results = @()
  foreach ($p in $paths) {
    $uri = "$BaseUrl$p"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $r = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec $TimeoutSec
      $sw.Stop()
      $snippet = if ($r.Content.Length -gt 200) { $r.Content.Substring(0, 200) } else { $r.Content }
      $results += [pscustomobject]@{
        path = $p
        ok = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300)
        status = [int]$r.StatusCode
        ms = [int]$sw.Elapsed.TotalMilliseconds
        hasUi = ($r.Content -match 'kpi-scs|chart-part|LOADING|Burnham|Chronoflux|"ok"\s*:\s*true')
      }
      Write-Host ("{0} {1} {2}ms hasUi={3}" -f $p, $r.StatusCode, [int]$sw.Elapsed.TotalMilliseconds, $results[-1].hasUi)
    } catch {
      $sw.Stop()
      Write-Host ("{0} FAIL {1}ms {2}" -f $p, [int]$sw.Elapsed.TotalMilliseconds, $_.Exception.Message) -ForegroundColor Yellow
      $results += [pscustomobject]@{ path = $p; ok = $false; status = 0; ms = [int]$sw.Elapsed.TotalMilliseconds; hasUi = $false }
    }
  }
  return $results
}

Write-Host "keep-warm base=$BaseUrl interval=${IntervalMinutes}m (Flyclient not applicable)" -ForegroundColor Cyan

if ($Times -gt 0) {
  $allOk = $true
  for ($i = 1; $i -le $Times; $i++) {
    Write-Host "--- ping $i/$Times ---"
    $r = Invoke-WarmPing
    if ($r | Where-Object { -not $_.ok }) { $allOk = $false }
    if ($i -lt $Times) { Start-Sleep -Seconds 2 }
  }
  if (-not $allOk) { exit 1 }
  exit 0
}

while ($true) {
  Invoke-WarmPing | Out-Null
  Start-Sleep -Seconds ($IntervalMinutes * 60)
}
