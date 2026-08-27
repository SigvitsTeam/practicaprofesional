[CmdletBinding()]
param(
  [string]$EnvironmentFile = (Join-Path $PSScriptRoot '..\..\deploy\config\staging.env'),
  [string[]]$ComposeFiles = @(
    (Join-Path $PSScriptRoot '..\..\deploy\compose.yaml'),
    (Join-Path $PSScriptRoot '..\..\deploy\compose.staging.yaml')
  ),
  [Parameter(Mandatory = $true)][switch]$ConfirmStaging,
  [int]$TimeoutSeconds = 180,
  [string]$EvidenceDirectory = (Join-Path $PSScriptRoot '..\..\evidence\recovery')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $ConfirmStaging) { throw 'El simulacro requiere -ConfirmStaging.' }
$docker = (Get-Command docker -ErrorAction Stop).Source
$resolvedEnv = (Resolve-Path -LiteralPath $EnvironmentFile).Path
$environmentText = Get-Content -LiteralPath $resolvedEnv -Raw
if ($environmentText -notmatch '(?m)^SIGVITS_ENVIRONMENT=staging\s*$') {
  throw 'El archivo no identifica explicitamente SIGVITS_ENVIRONMENT=staging.'
}

$composeArgs = @('compose', '--env-file', $resolvedEnv)
foreach ($file in $ComposeFiles) { $composeArgs += @('-f', (Resolve-Path -LiteralPath $file).Path) }
$resolvedEvidence = [IO.Path]::GetFullPath($EvidenceDirectory)
[IO.Directory]::CreateDirectory($resolvedEvidence) | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')

& $docker @composeArgs ps | Out-File -LiteralPath (Join-Path $resolvedEvidence "before_${stamp}.txt") -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw 'No se pudo inspeccionar la composicion de staging.' }

$startedAt = Get-Date
& $docker @composeArgs stop --timeout 30 api worker
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron detener API y worker de staging.' }
& $docker @composeArgs up --detach --no-build api worker
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron reiniciar API y worker de staging.' }

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$apiHealthy = $false
$workerHealthy = $false
do {
  Start-Sleep -Seconds 3
  $apiId = (& $docker @composeArgs ps --quiet api | Out-String).Trim()
  $workerId = (& $docker @composeArgs ps --quiet worker | Out-String).Trim()
  if ($apiId) {
    $apiHealthy = ((& $docker inspect --format '{{.State.Health.Status}}' $apiId | Out-String).Trim() -eq 'healthy')
  }
  if ($workerId) {
    $workerHealthy = ((& $docker inspect --format '{{.State.Health.Status}}' $workerId | Out-String).Trim() -eq 'healthy')
  }
} until (($apiHealthy -and $workerHealthy) -or (Get-Date) -ge $deadline)

& $docker @composeArgs logs --no-color --since 10m api worker | Out-File -LiteralPath (Join-Path $resolvedEvidence "logs_${stamp}.txt") -Encoding utf8
& $docker @composeArgs ps | Out-File -LiteralPath (Join-Path $resolvedEvidence "after_${stamp}.txt") -Encoding utf8

$result = [ordered]@{
  environment = 'staging'
  startedAtUtc = $startedAt.ToUniversalTime().ToString('o')
  completedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  apiHealthy = $apiHealthy
  workerHealthy = $workerHealthy
  withinTimeout = $apiHealthy -and $workerHealthy
}
$resultPath = Join-Path $resolvedEvidence "result_${stamp}.json"
$result | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding utf8
if (-not ($apiHealthy -and $workerHealthy)) { throw "El simulacro excedio el timeout. Evidencia: $resultPath" }
Write-Output $resultPath

