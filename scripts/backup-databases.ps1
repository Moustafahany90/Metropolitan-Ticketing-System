# ============================================================
# Backup both databases (ticketing + maintenance) from the
# running Postgres container using pg_dump.
#
# Usage:
#   powershell -File scripts/backup-databases.ps1
#   powershell -File scripts/backup-databases.ps1 -Container met-ticketing-pg -OutDir D:\backups
# ============================================================
param(
  [string]$Container = "mts-db",
  [string]$User = "ticketing",
  [string]$OutDir
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not $OutDir) {
  $OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) "backups\$timestamp"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Write-Host "Backing up databases from container '$Container' into: $OutDir"

foreach ($db in @("ticketing", "maintenance")) {
  $file = Join-Path $OutDir "$db.sql"
  Write-Host "  - $db -> $file"
  cmd /c "docker exec $Container pg_dump -U $User -d $db > `"$file`""
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed for database '$db'" }
}

# Record the source revision for traceability.
try {
  $rev = (git -C (Split-Path -Parent $PSScriptRoot) rev-parse HEAD) 2>$null
  if ($rev) { Set-Content -Path (Join-Path $OutDir "GIT_REV.txt") -Value $rev }
} catch { }

$tsFile = Join-Path (Split-Path -Parent $PSScriptRoot) "backups\LATEST.txt"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $tsFile) | Out-Null
Set-Content -Path $tsFile -Value $OutDir

Write-Host "Backup complete."
Write-Host "  ticketing:   $(Join-Path $OutDir 'ticketing.sql')"
Write-Host "  maintenance: $(Join-Path $OutDir 'maintenance.sql')"
