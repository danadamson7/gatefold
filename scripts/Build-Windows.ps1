# Runs on a Windows x64 computer using built-in Windows PowerShell 5.1 or newer.
# Downloads build tooling locally: it never needs administrator privileges.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

function Download-ToFile {
    param([string]$Uri, [string]$Path)
    Write-Host "Downloading $Uri"
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Invoke-WebRequest -Uri $Uri -OutFile $Path -UseBasicParsing
}
function Require-Success {
    param([string]$Description)
    if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit code $LASTEXITCODE)." }
}
function Extract-Entry {
    param($Entry, [string]$OutputPath)
    $folder = Split-Path -Parent $OutputPath
    if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }
    $inStream = $Entry.Open()
    try {
        $outStream = [System.IO.File]::Open($OutputPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
        try { $inStream.CopyTo($outStream) } finally { $outStream.Dispose() }
    } finally { $inStream.Dispose() }
}
try {
    if (-not [Environment]::Is64BitOperatingSystem) {
        throw 'This build kit requires 64-bit Windows 10 or 11.'
    }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $repo = Split-Path -Parent $PSScriptRoot
    Set-Location $repo
    $tools = Join-Path $repo '.build-tools'
    New-Item -ItemType Directory -Path $tools -Force | Out-Null

    # Portable Node.js; users do not need to install Node.js manually.
    $nodeVersion = 'v22.16.0'
    $nodeName = "node-$nodeVersion-win-x64"
    $nodeHome = Join-Path $tools $nodeName
    $nodeExe = Join-Path $nodeHome 'node.exe'
    if (-not (Test-Path $nodeExe)) {
        Write-Host '[1/4] Getting Node.js build environment...'
        $nodeZip = Join-Path $tools "$nodeName.zip"
        if (-not (Test-Path $nodeZip)) {
            Download-ToFile -Uri "https://nodejs.org/dist/$nodeVersion/$nodeName.zip" -Path $nodeZip
        }
        Expand-Archive -Path $nodeZip -DestinationPath $tools -Force
    }
    if (-not (Test-Path $nodeExe)) { throw 'Node.js could not be prepared.' }
    $env:Path = "$nodeHome;$env:Path"
    $npm = Join-Path $nodeHome 'npm.cmd'
    & $nodeExe --version
    Require-Success 'Node.js verification'

    # The upstream build configuration requires an FFmpeg executable bundled
    # for playback of WMA, APE and some ALAC audio. Download from BtbN's
    # official FFmpeg GitHub releases and verify against release checksums.
    $ffmpegDir = Join-Path $repo 'vendor/ffmpeg/win32'
    $ffmpegExe = Join-Path $ffmpegDir 'ffmpeg.exe'
    if (-not (Test-Path $ffmpegExe)) {
        Write-Host '[2/4] Getting LGPL FFmpeg for optional audio formats...'
        $asset = 'ffmpeg-master-latest-win64-lgpl.zip'
        $release = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest'
        $zip = Join-Path $tools $asset
        $shaFile = Join-Path $tools 'ffmpeg-checksums.sha256'
        Download-ToFile -Uri "$release/$asset" -Path $zip
        Download-ToFile -Uri "$release/checksums.sha256" -Path $shaFile
        $checksumLine = Get-Content $shaFile | Where-Object { $_ -match [regex]::Escape($asset) } | Select-Object -First 1
        if (-not $checksumLine) { throw 'FFmpeg release checksum was not found.' }
        $checksumMatch = [regex]::Match($checksumLine, '^\s*([0-9a-fA-F]{64})\s+\*?')
        if (-not $checksumMatch.Success) { throw 'Unexpected FFmpeg checksum file format.' }
        $expected = $checksumMatch.Groups[1].Value.ToLowerInvariant()
        $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLowerInvariant()
        if ($expected -ne $actual) { throw 'FFmpeg download checksum mismatch. Aborting.' }

        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
        try {
            $exeEntry = $archive.Entries | Where-Object { $_.FullName -match '(^|/)bin/ffmpeg\.exe$' } | Select-Object -First 1
            if (-not $exeEntry) { throw 'FFmpeg was not present in the downloaded archive.' }
            Extract-Entry -Entry $exeEntry -OutputPath $ffmpegExe
            $licenseEntry = $archive.Entries | Where-Object { $_.FullName -match '(^|/)(LICENSE|COPYING|LICENSE\.txt|LICENSE\.md)$' } | Select-Object -First 1
            if ($licenseEntry) { Extract-Entry -Entry $licenseEntry -OutputPath (Join-Path $ffmpegDir 'FFMPEG-LICENSE.txt') }
        } finally { $archive.Dispose() }
    }
    if (-not (Test-Path $ffmpegExe)) { throw 'FFmpeg is missing; the installer would be incomplete.' }

    Write-Host '[3/4] Installing Gatefold application dependencies...'
    & $npm ci --no-audit --no-fund
    Require-Success 'Dependency installation'
    & $npm test
    Require-Success 'Regression tests'

    Write-Host '[4/4] Creating the Gatefold Windows setup executable...'
    $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    & $npm run dist:win -- --x64
    Require-Success 'Electron Windows packaging'

    $installer = Join-Path $repo 'dist/Gatefold-Setup-1.0.5.exe'
    if (-not (Test-Path $installer)) {
        throw 'Packaging completed without producing the expected setup .exe file.'
    }
    $destination = Join-Path $repo 'Gatefold-Setup-1.0.5.exe'
    Copy-Item $installer $destination -Force
    Write-Host ''
    Write-Host "SUCCESS: $destination" -ForegroundColor Green
    exit 0
} catch {
    Write-Host ''
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Check the internet connection and retry, or share the error with ChatGPT.'
    exit 1
}
