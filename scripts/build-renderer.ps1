$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dist = Join-Path $root "dist"
$assets = Join-Path $dist "assets"
$esbuild = Join-Path $root "node_modules\@esbuild\win32-x64\esbuild.exe"

if (-not (Test-Path $esbuild)) {
  throw "esbuild.exe was not found. Run npm install first."
}

New-Item -ItemType Directory -Force -Path $assets | Out-Null

$entry = Join-Path $root "src\main.jsx"
$outfile = Join-Path $assets "app.js"

& $esbuild `
  $entry `
  --bundle `
  --format=esm `
  --platform=browser `
  --target=chrome120 `
  --jsx=automatic `
  "--outfile=$outfile" `
  --loader:.js=jsx `
  --loader:.jsx=jsx `
  --loader:.css=css `
  --minify `
  --sourcemap

if ($LASTEXITCODE -ne 0) {
  throw "Renderer bundling failed with exit code $LASTEXITCODE."
}

Copy-Item -Path (Join-Path $assets "app.css") -Destination (Join-Path $assets "style.css") -Force

@"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>V-LinK</title>
    <link rel="stylesheet" href="./assets/style.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/app.js"></script>
  </body>
</html>
"@ | Set-Content -Path (Join-Path $dist "index.html") -Encoding UTF8

Write-Output "Renderer build complete: $dist"
