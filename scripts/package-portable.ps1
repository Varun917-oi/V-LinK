$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$electronDist = Join-Path $root "node_modules\electron\dist"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$releaseRoot = Join-Path $root "release"
$portableRoot = Join-Path $releaseRoot "V-LinK-Portable-$stamp"
$appRoot = Join-Path $portableRoot "resources\app"

if (-not (Test-Path (Join-Path $electronDist "electron.exe"))) {
  throw "Electron runtime was not found. Run npm install first."
}

New-Item -ItemType Directory -Force -Path $portableRoot | Out-Null
Copy-Item -Path (Join-Path $electronDist "*") -Destination $portableRoot -Recurse -Force

$electronExe = Join-Path $portableRoot "electron.exe"
$appExe = Join-Path $portableRoot "V-LinK.exe"
if (Test-Path $electronExe) {
  Rename-Item -Path $electronExe -NewName "V-LinK.exe" -Force
}

New-Item -ItemType Directory -Force -Path $appRoot | Out-Null
Copy-Item -Path (Join-Path $root "dist") -Destination $appRoot -Recurse -Force
Copy-Item -Path (Join-Path $root "electron") -Destination $appRoot -Recurse -Force
Copy-Item -Path (Join-Path $root "resources") -Destination $appRoot -Recurse -Force
Copy-Item -Path (Join-Path $root "package.json") -Destination $appRoot -Force

@"
V-LinK Portable

Run:
  V-LinK.exe

This portable build includes:
  - Electron runtime
  - React renderer bundle
  - ADB platform-tools
  - scrcpy

Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@ | Set-Content -Path (Join-Path $portableRoot "README-PORTABLE.txt") -Encoding UTF8

Write-Output "Portable EXE build created:"
Write-Output $appExe
