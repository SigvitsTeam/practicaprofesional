[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')][string]$PreviousReleaseTag,
  [string]$EnvironmentFile = (Join-Path $PSScriptRoot '..\..\deploy\config\production.env'),
  [string[]]$ComposeFiles = @(
    (Join-Path $PSScriptRoot '..\..\deploy\compose.yaml'),
    (Join-Path $PSScriptRoot '..\..\deploy\compose.production.yaml')
  ),
  [Parameter(Mandatory = $true)][switch]$ConfirmProductionRollback,
  [uri]$ApiReadinessUrl = 'http://127.0.0.1:3000/api/health/ready',
  [uri]$FrontendHealthUrl = 'http://127.0.0.1:8080/healthz',
  [ValidateRange(30, 900)][int]$TimeoutSeconds = 180,
  [string]$EvidenceDirectory = (Join-Path $PSScriptRoot '..\..\evidence\rollback')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $ConfirmProductionRollback) { throw 'El rollback requiere -ConfirmProductionRollback.' }
if ($PreviousReleaseTag -in @('latest', 'main', 'master')) { throw 'Use un tag inmutable de release, no una referencia flotante.' }
foreach ($smokeUrl in @($ApiReadinessUrl, $FrontendHealthUrl)) {
  if ($smokeUrl.Scheme -notin @('http', 'https')) { throw 'Las URL de smoke deben usar HTTP(S).' }
}
$docker = (Get-Command docker -ErrorAction Stop).Source
$resolvedEnv = (Resolve-Path -LiteralPath $EnvironmentFile).Path
$environmentText = Get-Content -LiteralPath $resolvedEnv -Raw
if ($environmentText -notmatch '(?m)^SIGVITS_ENVIRONMENT=production\s*$') {
  throw 'El archivo no identifica explicitamente SIGVITS_ENVIRONMENT=production.'
}

$composeArgs = @('compose', '--env-file', $resolvedEnv)
foreach ($file in $ComposeFiles) { $composeArgs += @('-f', (Resolve-Path -LiteralPath $file).Path) }
$resolvedEvidence = [IO.Path]::GetFullPath($EvidenceDirectory)
[IO.Directory]::CreateDirectory($resolvedEvidence) | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$previousEnvironmentTag = $env:RELEASE_TAG
$imageRefVariables = @(
  'SIGVITS_MIGRATOR_IMAGE_REF',
  'SIGVITS_API_IMAGE_REF',
  'SIGVITS_WORKER_IMAGE_REF',
  'SIGVITS_FRONTEND_IMAGE_REF'
)
$previousImageRefs = @{}
foreach ($name in $imageRefVariables) {
  $previousImageRefs[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
  $env:RELEASE_TAG = $PreviousReleaseTag
  # Un full-ref por digest certificado tiene prioridad durante promoción. Para
  # rollback se fuerza deliberadamente el repositorio + tag inmutable anterior.
  foreach ($name in $imageRefVariables) {
    [Environment]::SetEnvironmentVariable($name, '', 'Process')
  }
  & $docker @composeArgs config --images | Out-File -LiteralPath (Join-Path $resolvedEvidence "images_${stamp}.txt") -Encoding utf8
  & $docker @composeArgs pull migrate api worker frontend
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron obtener todas las imagenes de rollback.' }

  $migrationOutput = & $docker @composeArgs run --rm migrate 2>&1
  $migrationExitCode = $LASTEXITCODE
  $migrationOutput | Out-File -LiteralPath (Join-Path $resolvedEvidence "migration_${stamp}.txt") -Encoding utf8
  if ($migrationExitCode -ne 0) {
    throw 'La verificacion migrate deploy de la version anterior fallo; no se reemplazaron los servicios.'
  }

  & $docker @composeArgs up --detach --no-build --wait --wait-timeout $TimeoutSeconds api worker frontend
  if ($LASTEXITCODE -ne 0) { throw 'Los servicios no quedaron saludables despues del rollback.' }

  $apiSmoke = Invoke-WebRequest -Uri $ApiReadinessUrl -Method Get -TimeoutSec 15 -UseBasicParsing
  if ($apiSmoke.StatusCode -ne 200) { throw 'El smoke de readiness de API no devolvio HTTP 200.' }
  $frontendSmoke = Invoke-WebRequest -Uri $FrontendHealthUrl -Method Get -TimeoutSec 15 -UseBasicParsing
  if ($frontendSmoke.StatusCode -ne 200 -or $frontendSmoke.Content.Trim() -ne 'ok') {
    throw 'El smoke no mutante del frontend fallo.'
  }

  & $docker @composeArgs ps | Out-File -LiteralPath (Join-Path $resolvedEvidence "status_${stamp}.txt") -Encoding utf8
  [ordered]@{
    status = 'rolled-back'
    releaseTag = $PreviousReleaseTag
    completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    databaseMigrationRollback = 'not-performed'
    migrationCompatibilityCheck = 'prisma-migrate-deploy-ok'
    apiReadinessSmoke = "HTTP $($apiSmoke.StatusCode)"
    frontendHealthSmoke = "HTTP $($frontendSmoke.StatusCode)"
  } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $resolvedEvidence "result_${stamp}.json") -Encoding utf8
  Write-Output (Join-Path $resolvedEvidence "result_${stamp}.json")
} finally {
  [Environment]::SetEnvironmentVariable('RELEASE_TAG', $previousEnvironmentTag, 'Process')
  foreach ($entry in $previousImageRefs.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
}
