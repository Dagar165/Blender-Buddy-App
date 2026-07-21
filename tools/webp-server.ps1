# Converts PNGs to WebP by borrowing the browser's encoder.
#
# Why this exists: the machine has no Node, no Python, no ImageMagick, and
# .NET's System.Drawing cannot write WebP. A browser can. So we serve a tiny
# page over localhost, it draws each PNG on a canvas of the target size,
# calls canvas.toBlob(..., 'image/webp', quality) and POSTs the result back.
#
# Run:
#   powershell -File tools\webp-server.ps1 -InDir <folder with .png> -OutDir <folder>
# then open http://localhost:8791/ in any browser and wait for "ALL DONE".
# The server stops by itself once every file has come back.
#
# NOTE for automation: this must be started as a DETACHED background process
# (PowerShell Start-Job does not survive between tool calls).
param(
  [Parameter(Mandatory=$true)][string]$InDir,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$Size = 768,
  [double]$Quality = 0.9,
  [int]$Port = 8791
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$inFull  = (Resolve-Path -LiteralPath $InDir).Path
$outFull = (Resolve-Path -LiteralPath $OutDir).Path
$files = @(Get-ChildItem -LiteralPath $inFull -Filter *.png | Sort-Object Name)
if ($files.Count -eq 0) { throw "no .png files in $inFull" }

$names = $files | ForEach-Object { $_.Name }
$namesJson = "[" + (($names | ForEach-Object { '"' + ($_ -replace '"','\"') + '"' }) -join ",") + "]"

$page = @"
<!doctype html><meta charset="utf-8"><title>PNG -> WebP</title>
<style>body{font:14px system-ui;padding:20px}li{margin:4px 0}</style>
<h3>PNG -> WebP, $Size x $Size, quality $Quality</h3>
<ul id=log></ul>
<script>
const files = $namesJson;
const SIZE = $Size, Q = $Quality;
const log = document.getElementById('log');
function say(t){ const li=document.createElement('li'); li.textContent=t; log.appendChild(li); }
function load(src){ return new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=src; }); }
(async () => {
  for (const name of files) {
    const img = await load('/src/' + encodeURIComponent(name));
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, SIZE, SIZE);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', Q));
    const buf = await blob.arrayBuffer();
    await fetch('/out/' + encodeURIComponent(name.replace(/\.png$/i, '.webp')), { method:'POST', body: buf });
    say(name + '  ->  ' + Math.round(blob.size/1024) + ' KB');
  }
  say('ALL DONE');
  document.title = 'ALL DONE';
  fetch('/quit');
})();
</script>
"@

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "serving on http://localhost:$Port/  ($($files.Count) files)"

$saved = 0
$running = $true
while ($running) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

  try {
    if ($path -eq "/") {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($page)
      $res.ContentType = "text/html; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    elseif ($path -like "/src/*") {
      $name = $path.Substring(5)
      $file = Join-Path $inFull $name
      if (Test-Path -LiteralPath $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.ContentType = "image/png"
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else { $res.StatusCode = 404 }
    }
    elseif ($path -like "/out/*" -and $req.HttpMethod -eq "POST") {
      $name = $path.Substring(5)
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      [System.IO.File]::WriteAllBytes((Join-Path $outFull $name), $ms.ToArray())
      $saved++
      Write-Host ("saved {0} ({1:N0} KB)" -f $name, ($ms.Length / 1KB))
      $res.StatusCode = 204
    }
    elseif ($path -eq "/quit") {
      $res.StatusCode = 204
      $running = $false
    }
    else { $res.StatusCode = 404 }
  } catch {
    Write-Host "error: $_"
    $res.StatusCode = 500
  }
  $res.Close()
}

$listener.Stop()
Write-Host "done, $saved file(s) written to $outFull"
