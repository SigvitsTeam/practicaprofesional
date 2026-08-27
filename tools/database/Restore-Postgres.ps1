[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [string]$TargetDatabaseUrl = $env:RESTORE_DATABASE_URL,
  [Parameter(Mandatory = $true)][switch]$ConfirmIsolatedTarget,
  [string]$EvidenceDirectory = (Join-Path $PSScriptRoot '..\..\evidence\restore')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PostgresTools.psm1') -Force

if (-not $ConfirmIsolatedTarget) { throw 'Use -ConfirmIsolatedTarget solamente para una base vacia y aislada.' }
if ([string]::IsNullOrWhiteSpace($TargetDatabaseUrl)) {
  throw 'RESTORE_DATABASE_URL o -TargetDatabaseUrl es obligatorio.'
}
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
if ([IO.Path]::GetExtension($resolvedBackup) -ne '.dump') { throw 'El respaldo debe tener extension .dump.' }
$pgRestore = Get-RequiredCommand 'pg_restore'
$psql = Get-RequiredCommand 'psql'

$expectedHashFile = "${resolvedBackup}.sha256"
if (-not (Test-Path -LiteralPath $expectedHashFile)) {
  throw "Falta el checksum obligatorio: $expectedHashFile"
}
$hashRecord = (Get-Content -LiteralPath $expectedHashFile -Raw).Trim()
if ($hashRecord -notmatch '^(?<Hash>[0-9a-fA-F]{64})(?:\s+\*?.+)?$') {
  throw 'El archivo de checksum SHA-256 tiene un formato invalido.'
}
$expectedHash = $Matches.Hash.ToLowerInvariant()
$actualHash = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expectedHash -ne $actualHash) { throw 'El checksum SHA-256 del respaldo no coincide.' }

& $pgRestore --list $resolvedBackup | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'El catalogo del respaldo no es legible.' }

$previous = Set-PostgresEnvironment $TargetDatabaseUrl
try {
  $manifestPath = "${resolvedBackup}.manifest.json"
  if (Test-Path -LiteralPath $manifestPath) {
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.sha256 -and ([string]$manifest.sha256).ToLowerInvariant() -ne $expectedHash) {
      throw 'El manifiesto y el archivo de checksum no corresponden al mismo respaldo.'
    }
    if ($manifest.host -eq $env:PGHOST -and $manifest.database -eq $env:PGDATABASE) {
      throw 'El destino coincide con el origen del respaldo; la restauracion sobre el origen esta prohibida.'
    }
  }

  $userTables = [int](Invoke-PostgresScalar -PsqlPath $psql -Sql "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema') AND tablename <> 'spatial_ref_sys';")
  if ($userTables -ne 0) { throw "El destino no esta vacio ($userTables tablas detectadas)." }

  $startedAt = Get-Date
  & $pgRestore --exit-on-error --single-transaction --no-owner --no-acl --dbname $env:PGDATABASE $resolvedBackup
  if ($LASTEXITCODE -ne 0) { throw 'pg_restore termino con error.' }

  $migrationTable = Invoke-PostgresScalar -PsqlPath $psql -Sql "SELECT coalesce(to_regclass('public._prisma_migrations')::text, '');"
  if ($migrationTable -ne '_prisma_migrations') { throw 'La restauracion no contiene el historial de migraciones.' }
  $restoredTables = [int](Invoke-PostgresScalar -PsqlPath $psql -Sql "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';")

  $resolvedEvidence = [IO.Path]::GetFullPath($EvidenceDirectory)
  [IO.Directory]::CreateDirectory($resolvedEvidence) | Out-Null
  $evidencePath = Join-Path $resolvedEvidence ("restore_{0}.json" -f (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))
  [ordered]@{
    status = 'restored'
    startedAtUtc = $startedAt.ToUniversalTime().ToString('o')
    completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    targetHost = $env:PGHOST
    targetDatabase = $env:PGDATABASE
    restoredTables = $restoredTables
    backupSha256 = (Get-FileHash -LiteralPath $resolvedBackup -Algorithm SHA256).Hash.ToLowerInvariant()
  } | ConvertTo-Json | Set-Content -LiteralPath $evidencePath -Encoding utf8
  Write-Output $evidencePath
} finally {
  Restore-PostgresEnvironment $previous
}
