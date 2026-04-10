param(
  [switch]$NoBrowser,
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverUrl = "http://127.0.0.1:8787/login"
$serveCommand = "Set-Location '$projectRoot'; npm.cmd run app:serve"

function Test-AppServer {
  param(
    [string]$Url
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-ForServer {
  param(
    [string]$Url,
    [int]$Attempts = 30
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    if (Test-AppServer -Url $Url) {
      return $true
    }
    Start-Sleep -Milliseconds 750
  }

  return $false
}

function Open-Browser {
  param(
    [string]$Url
  )

  if ($NoBrowser) {
    return
  }

  Start-Process $Url | Out-Null
}

if ($ForceRestart) {
  try {
    $listeners = Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction Stop |
      Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $listeners) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }

    if ($listeners) {
      Start-Sleep -Seconds 1
    }
  } catch {
  }
}

if (-not (Test-AppServer -Url $serverUrl)) {
  Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    $serveCommand
  ) -WorkingDirectory $projectRoot | Out-Null

  if (-not (Wait-ForServer -Url $serverUrl)) {
    throw "Inbox Journey did not start successfully. Check the new server window for errors."
  }
}

Open-Browser -Url $serverUrl
Write-Host "Inbox Journey is ready at $serverUrl"
