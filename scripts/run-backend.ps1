param(
    [switch]$SkipInstall,
    [switch]$SkipMigrations,
    [switch]$SkipSeed,
    [switch]$UseVenv,
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $BackendDir

$VenvDir = Join-Path $BackendDir ".venv"
$VenvPythonExe = Join-Path $VenvDir "Scripts\python.exe"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-EnvLine {
    param(
        [string[]]$Lines,
        [string]$Name,
        [string]$ExpectedValue = ""
    )

    $prefix = "$Name="
    $match = $Lines | Where-Object { $_.TrimStart().StartsWith($prefix) } | Select-Object -First 1
    if (-not $match) {
        return $false
    }

    if ($ExpectedValue -eq "") {
        return ($match.Substring($prefix.Length).Trim().Length -gt 0)
    }

    return ($match.Substring($prefix.Length).Trim() -eq $ExpectedValue)
}

Write-Step "Checking backend workspace"
if (-not (Test-Path "requirements.txt")) {
    throw "requirements.txt was not found. Run this script from the backend folder or keep it inside backend/scripts."
}

$Port = 8080

if (-not (Test-Path ".env")) {
    Write-Warning "backend/.env was not found. The API will use defaults and environment variables from the shell."
    if (-not $env:UBOOK_DATABASE_URL) {
        $env:UBOOK_DATABASE_URL = "sqlite:///./dev.db"
        Write-Host "Using local SQLite database fallback: dev.db"
    }
    if (-not $env:UBOOK_ENVIRONMENT) {
        $env:UBOOK_ENVIRONMENT = "development"
    }
}

Write-Step "Preparing Python virtual environment"
if ($UseVenv) {
    if (-not (Test-Path $VenvPythonExe)) {
        python -m venv .venv
    }
    $PythonExe = $VenvPythonExe
}
elseif ($env:CONDA_PREFIX) {
    $PythonExe = (Get-Command python).Source
    Write-Host "Using active Conda environment: $env:CONDA_DEFAULT_ENV"
}
elseif ($env:VIRTUAL_ENV) {
    $PythonExe = (Get-Command python).Source
    Write-Host "Using active Python virtual environment: $env:VIRTUAL_ENV"
}
else {
    if (-not (Test-Path $VenvPythonExe)) {
        python -m venv .venv
    }
    $PythonExe = $VenvPythonExe
    Write-Host "Using backend .venv"
}

if (-not $SkipInstall) {
    Write-Step "Installing backend dependencies"
    & $PythonExe -m pip install --upgrade pip
    & $PythonExe -m pip install -r requirements.txt
}

if (Test-Path ".env") {
    $envLines = Get-Content ".env"
    if (Test-EnvLine -Lines $envLines -Name "UBOOK_STORAGE_PROVIDER" -ExpectedValue "cloudinary") {
        $hasCloudinaryUrl = Test-EnvLine -Lines $envLines -Name "UBOOK_CLOUDINARY_URL"
        $hasCloudinaryKeys = (
            (Test-EnvLine -Lines $envLines -Name "UBOOK_CLOUDINARY_CLOUD_NAME") -and
            (Test-EnvLine -Lines $envLines -Name "UBOOK_CLOUDINARY_API_KEY") -and
            (Test-EnvLine -Lines $envLines -Name "UBOOK_CLOUDINARY_API_SECRET")
        )

        if (-not ($hasCloudinaryUrl -or $hasCloudinaryKeys)) {
            throw "UBOOK_STORAGE_PROVIDER=cloudinary is set, but Cloudinary credentials are incomplete. Add UBOOK_CLOUDINARY_URL or the three separate Cloudinary keys."
        }
    }
}

if (-not $SkipMigrations) {
    Write-Step "Running database migrations"
    & $PythonExe -c "from alembic.config import main; main(argv=['upgrade', 'head'])"
}

if (-not $SkipSeed) {
    Write-Step "Seeding development data"
    & $PythonExe -m app.scripts.seed
}

Write-Step "Starting UBOOK backend"
Write-Host "Backend: http://${HostName}:$Port"
Write-Host "Swagger: http://${HostName}:$Port/api/docs"
Write-Host ""

& $PythonExe -m uvicorn app.main:app --reload --host $HostName --port $Port
