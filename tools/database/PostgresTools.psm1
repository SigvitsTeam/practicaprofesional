Set-StrictMode -Version Latest

function Get-RequiredCommand {
  param([Parameter(Mandatory = $true)][string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) { throw "No se encontro '$Name' en PATH." }
  return $command.Source
}

function Set-PostgresEnvironment {
  param([Parameter(Mandatory = $true)][string]$DatabaseUrl)

  try { $uri = [Uri]$DatabaseUrl } catch { throw 'La URL PostgreSQL no es valida.' }
  if ($uri.Scheme -notin @('postgres', 'postgresql')) {
    throw 'La URL debe usar el esquema postgres o postgresql.'
  }
  $userInfo = $uri.UserInfo.Split(':', 2)
  if ($userInfo.Count -lt 1 -or [string]::IsNullOrWhiteSpace($userInfo[0])) {
    throw 'La URL PostgreSQL debe identificar el usuario.'
  }

  $sslMatch = [regex]::Match($uri.Query, '(?:^|[?&])sslmode=([^&]+)', 'IgnoreCase')
  $sslMode = if ($sslMatch.Success) {
    [Uri]::UnescapeDataString($sslMatch.Groups[1].Value).ToLowerInvariant()
  } else { '' }
  $localHosts = @('localhost', '127.0.0.1', '::1')
  $isLocal = $uri.Host.ToLowerInvariant() -in $localHosts
  if (-not $isLocal -and $sslMode -and $sslMode -notin @('require', 'verify-ca', 'verify-full')) {
    throw 'Una conexion PostgreSQL remota no puede desactivar ni degradar TLS.'
  }
  if (-not $isLocal -and -not $sslMode) { $sslMode = 'require' }
  if ($isLocal -and -not $sslMode) { $sslMode = 'prefer' }

  $database = [Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($database)) { throw 'La URL PostgreSQL debe identificar la base de datos.' }

  $names = @('PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE')
  $previous = @{}
  foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

  $env:PGHOST = $uri.Host
  $env:PGPORT = if ($uri.IsDefaultPort) { '5432' } else { [string]$uri.Port }
  $env:PGUSER = [Uri]::UnescapeDataString($userInfo[0])
  $env:PGPASSWORD = if ($userInfo.Count -eq 2) { [Uri]::UnescapeDataString($userInfo[1]) } else { '' }
  $env:PGDATABASE = $database
  $env:PGSSLMODE = $sslMode

  return $previous
}

function Restore-PostgresEnvironment {
  param([Parameter(Mandatory = $true)][hashtable]$Previous)
  foreach ($entry in $Previous.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
}

function Invoke-PostgresScalar {
  param(
    [Parameter(Mandatory = $true)][string]$PsqlPath,
    [Parameter(Mandatory = $true)][string]$Sql
  )
  $result = & $PsqlPath --no-password --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command $Sql
  if ($LASTEXITCODE -ne 0) { throw 'La consulta de verificacion PostgreSQL fallo.' }
  return ($result | Out-String).Trim()
}

Export-ModuleMember -Function Get-RequiredCommand, Set-PostgresEnvironment, Restore-PostgresEnvironment, Invoke-PostgresScalar
