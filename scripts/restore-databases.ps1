# ============================================================
# Restore both databases (ticketing + maintenance) into the
# running Postgres container from a backup directory produced
# by scripts/backup-databases.ps1.
#
# WARNING: this drops and recreates the objects contained in the
# dump. Stop the backend service first to avoid write conflicts:
#   docker compose stop backend
#
# Usage:
#   powershell -File scripts/restore-databases.ps1 -BackupDir backups\20260101-120000
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$BackupDir,
  [string]$Container = "mts-db",
  [string]$User = "ticketing"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupDir)) {
  throw "Backup directory not found: $BackupDir"
}

Write-Host "Restoring databases into container '$Container' from: $BackupDir"

foreach ($db in @("ticketing", "maintenance")) {
  $file = Join-Path $BackupDir "$db.sql"
  if (-not (Test-Path -LiteralPath $file)) {
    throw "Missing dump file: $file"
  }
  Write-Host "  - $db <- $file"
  cmd /c "docker exec -i $Container psql -U $User -d $db < `"$file`""
  if ($LASTEXITCODE -ne 0) { throw "psql restore failed for database '$db'" }
}

Write-Host "Restore complete. Start the backend again with: docker compose start backend"
