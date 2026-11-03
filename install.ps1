# mrtoro installer for Windows (x64 / amd64 and arm64).
#
#   irm https://raw.githubusercontent.com/khanhnq1611/mrtoro/main/install.ps1 | iex
#
# Downloads the prebuilt mrtoro.exe for this machine from the latest GitHub
# release, puts it in %LOCALAPPDATA%\Programs\mrtoro, and adds that folder to
# your user PATH. Run it again to update (close any running mrtoro first).
#
# The binary is unsigned, so on first launch SmartScreen may show
# "Windows protected your PC": click "More info" and then "Run anyway".

$ErrorActionPreference = "Stop"
# PS 5.1's Invoke-WebRequest renders a progress bar that makes large downloads
# crawl; disable it for the lifetime of this script.
$ProgressPreference = "SilentlyContinue"

$Repo = "khanhnq1611/mrtoro"
$InstallDir = Join-Path $env:LOCALAPPDATA "Programs\mrtoro"

# 1. Which build fits this machine?
$Arch = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }

# 2. Find it in the latest release (fall back to the baseline build on old x64 CPUs).
$Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
$Asset = $null
foreach ($Name in @("mrtoro-windows-$Arch.zip", "mrtoro-windows-$Arch-baseline.zip")) {
    $Asset = $Release.assets | Where-Object { $_.name -eq $Name } | Select-Object -First 1
    if ($Asset) { break }
}
if (-not $Asset) {
    throw "The latest release ($($Release.tag_name)) has no Windows $Arch build. Check https://github.com/$Repo/releases"
}

# 3. Download and extract.
$Zip = Join-Path $env:TEMP $Asset.name
Write-Host "Downloading $($Asset.name) ..."
Invoke-WebRequest -Uri $Asset.browser_download_url -OutFile $Zip
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
try {
    Expand-Archive -Path $Zip -DestinationPath $InstallDir -Force
} catch {
    throw "Could not write to $InstallDir -- close any running mrtoro and try again."
} finally {
    Remove-Item $Zip -Force -ErrorAction SilentlyContinue
}

# Bun names the Windows binary mrtoro.exe; rename just in case it came out bare.
if (-not (Test-Path (Join-Path $InstallDir "mrtoro.exe"))) {
    $Bare = Get-ChildItem -Path $InstallDir -Filter "mrtoro" -File | Select-Object -First 1
    if ($Bare) { Rename-Item -Path $Bare.FullName -NewName "mrtoro.exe" }
}

# 4. Put the folder on your PATH (user scope, so it survives reboots).
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($null -eq $UserPath) { $UserPath = "" }
if ($UserPath -notlike "*$InstallDir*") {
    if ($UserPath -eq "") {
        [Environment]::SetEnvironmentVariable("Path", $InstallDir, "User")
    } else {
        [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    }
    Write-Host "Added $InstallDir to your user PATH."
}

# 5. Verify.
& (Join-Path $InstallDir "mrtoro.exe") --version

Write-Host ""
Write-Host "Done. Open a NEW terminal (so the new PATH is picked up), then:"
Write-Host "  mrtoro                                              # open the TUI"
Write-Host "  mrtoro remote-control login https://<relay-url>     # connect to a relay, see the README"
