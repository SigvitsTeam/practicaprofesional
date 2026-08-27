[CmdletBinding()]
param(
  [string]$DatabaseUrl = $env:DIRECT_URL,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\backups')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'PostgresTools.psm1') -Force

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) { throw 'DIRECT_URL o -DatabaseUrl es obligatorio.' }
$pgDump = Get-RequiredCommand 'pg_dump'
$psql = Get-RequiredCommand 'psql'
$resolvedOutput = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
$temporaryPath = $null

$previous = Set-PostgresEnvironment $DatabaseUrl
try {
  $version = Invoke-PostgresScalar -PsqlPath $psql -Sql 'SHOW server_version;'
  $safeDatabase = ($env:PGDATABASE -replace '[^a-zA-Z0-9_-]', '_')
  $timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
  $fileName = "${safeDatabase}_${timestamp}.dump"
  $finalPath = Join-Path $resolvedOutput $fileName
  $temporaryPath = "${finalPath}.partial"

  & $pgDump --format=custom --compress=9 --no-owner --no-acl --verbose --file $temporaryPath
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump termino con error.' }
  $backup = Get-Item -LiteralPath $temporaryPath
  if ($backup.Length -le 0) { throw 'pg_dump produjo un archivo vacio.' }
  Move-Item -LiteralPath $temporaryPath -Destination $finalPath

  $hash = (Get-FileHash -LiteralPath $finalPath -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  $fileName" | Set-Content -LiteralPath "${finalPath}.sha256" -Encoding ascii -NoNewline
  [ordered]@{
    format = 'pg_dump-custom'
    createdAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    host = $env:PGHOST
    port = $env:PGPORT
    database = $env:PGDATABASE
    serverVersion = $version
    file = $fileName
    bytes = (Get-Item -LiteralPath $finalPath).Length
    sha256 = $hash
  } | ConvertTo-Json | Set-Content -LiteralPath "${finalPath}.manifest.json" -Encoding utf8

  Write-Output $finalPath
} finally {
  if ($temporaryPath -and (Test-Path -LiteralPath $temporaryPath)) {
    Remove-Item -LiteralPath $temporaryPath -Force
  }
  Restore-PostgresEnvironment $previous
}
