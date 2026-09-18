#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Paths
$Root        = Split-Path $PSScriptRoot -Parent
$BuildDir    = Join-Path $Root 'build\release'
$FrontendSrc = Join-Path $Root 'frontend'
$BackendSrc  = Join-Path $Root 'backend'
$InstallerDir= Join-Path $Root 'installer'
$OutputDir   = Join-Path $Root 'dist-installer'
$ISCC        = 'C:\Program Files (x86)\Inno Setup 6\ISCC.exe'

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Make HUB - Release Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# [1/6] Prerequisites
Write-Host "[1/6] Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Install from https://nodejs.org/"
}
$nodeVer = (node --version).TrimStart('v').Split('.')[0]
if ([int]$nodeVer -lt 18) {
    Write-Error "Node.js 18+ required. Current: v$nodeVer"
}
Write-Host "  OK: Node.js $(node --version)" -ForegroundColor Green

$SkipISCC = $false
if (-not (Test-Path $ISCC)) {
    Write-Warning "Inno Setup not found at: $ISCC"
    Write-Warning "Installer generation will be skipped."
    Write-Warning "Download from https://jrsoftware.org/isdl.php"
    $SkipISCC = $true
}

$NSSMPath = Join-Path $InstallerDir 'tools\nssm.exe'
if (-not (Test-Path $NSSMPath)) {
    Write-Warning "NSSM not found at: $NSSMPath"
    Write-Warning "Download nssm-2.24.zip from https://nssm.cc/download"
    Write-Warning "Place win64\nssm.exe as installer\tools\nssm.exe"
    $SkipISCC = $true
} else {
    Write-Host "  OK: NSSM found" -ForegroundColor Green
}

Write-Host ""

# [2/6] Clean
Write-Host "[2/6] Cleaning build directory..." -ForegroundColor Yellow
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
New-Item -ItemType Directory -Path $BuildDir          -Force | Out-Null
New-Item -ItemType Directory -Path "$BuildDir\frontend" -Force | Out-Null
New-Item -ItemType Directory -Path "$BuildDir\backend"  -Force | Out-Null
Write-Host "  OK: Cleaned $BuildDir" -ForegroundColor Green
Write-Host ""

# [3/6] Frontend build
Write-Host "[3/6] Building frontend (Vite)..." -ForegroundColor Yellow
Push-Location $FrontendSrc
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }
} finally { Pop-Location }
Copy-Item -Path "$FrontendSrc\dist\*" -Destination "$BuildDir\frontend" -Recurse -Force
Write-Host "  OK: frontend/dist -> build/release/frontend" -ForegroundColor Green
Write-Host ""

# [4/6] Backend build
Write-Host "[4/6] Building backend (TypeScript)..." -ForegroundColor Yellow
Push-Location $BackendSrc
try {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }
} finally { Pop-Location }

$TmpBackend = "$BuildDir\backend"
Copy-Item -Path "$BackendSrc\dist\*"       -Destination $TmpBackend -Recurse -Force
Copy-Item -Path "$BackendSrc\package.json" -Destination $TmpBackend -Force
$lockFile = "$BackendSrc\package-lock.json"
if (Test-Path $lockFile) {
    Copy-Item -Path $lockFile -Destination $TmpBackend -Force
}

Write-Host "  Installing production dependencies..." -ForegroundColor Gray
Push-Location $TmpBackend
try {
    & npm install --omit=dev --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw "npm install --omit=dev failed" }
} finally { Pop-Location }

Write-Host "  OK: backend compiled + node_modules -> build/release/backend" -ForegroundColor Green
Write-Host ""

# [5/6] Portable Node.js
Write-Host "[5/6] Getting portable Node.js..." -ForegroundColor Yellow
# Use the same version as the build machine to ensure native module ABI compatibility
$NodeVersion = (node --version).TrimStart('v')
Write-Host "  Using Node.js v$NodeVersion (matches build machine)" -ForegroundColor Gray
$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeZipUrl  = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"
$NodeZipPath = Join-Path $Root "build\$NodeZipName"
$NodeDestDir = Join-Path $BuildDir 'node'

if (-not (Test-Path $NodeZipPath)) {
    Write-Host "  Downloading: $NodeZipUrl" -ForegroundColor Gray
    Invoke-WebRequest -Uri $NodeZipUrl -OutFile $NodeZipPath -UseBasicParsing
    Write-Host "  OK: Download complete" -ForegroundColor Green
} else {
    Write-Host "  OK: Using cached $NodeZipName" -ForegroundColor Green
}

Write-Host "  Extracting..." -ForegroundColor Gray
$TempExtract = Join-Path $Root 'build\node-tmp'
if (Test-Path $TempExtract) { Remove-Item $TempExtract -Recurse -Force }
Expand-Archive -Path $NodeZipPath -DestinationPath $TempExtract -Force
$ExtractedFolder = Get-ChildItem $TempExtract -Directory | Select-Object -First 1
if (Test-Path $NodeDestDir) { Remove-Item $NodeDestDir -Recurse -Force }
Move-Item -Path $ExtractedFolder.FullName -Destination $NodeDestDir
Remove-Item $TempExtract -Recurse -Force
Write-Host "  OK: Node.js v$NodeVersion -> build/release/node" -ForegroundColor Green
Write-Host ""

# Copy start script
$StartScript = Join-Path $InstallerDir 'start-server.bat'
if (Test-Path $StartScript) {
    Copy-Item $StartScript -Destination $BuildDir -Force
}

# [6/6] Inno Setup
Write-Host "[6/6] Building installer..." -ForegroundColor Yellow

if ($SkipISCC) {
    Write-Host "  SKIP: Inno Setup or NSSM not found" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Release files created at:" -ForegroundColor Cyan
    Write-Host "  $BuildDir" -ForegroundColor White
} else {
    if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

    # Generate a cryptographically-strong JWT secret and pass to ISCC as a define.
    # NOTE: do NOT use Get-Random here. It is a time-seeded System.Random (not a CSPRNG),
    # and -Count on the 16-char hex set returns only a 16-char permutation (~2^44).
    # Use a CSPRNG -> 48 bytes = 96 hex chars (384 bits).
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $secretBytes = New-Object byte[] 48
    $rng.GetBytes($secretBytes)
    $rng.Dispose()
    $JwtSecret = -join ($secretBytes | ForEach-Object { $_.ToString('x2') })

    $IssFile = Join-Path $InstallerDir 'MakeHub.iss'
    & $ISCC $IssFile "/O$OutputDir" "/DJwtSecret=$JwtSecret"
    if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed" }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Build Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Output: $OutputDir" -ForegroundColor Cyan
    Get-ChildItem $OutputDir -Filter '*.exe' | ForEach-Object {
        $sizeMB = [math]::Round($_.Length / 1MB, 1)
        $fname  = $_.Name
        Write-Host "  [EXE] $fname ($sizeMB MB)" -ForegroundColor White
    }
}

Write-Host ""
