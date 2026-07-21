param(
  [Parameter(Mandatory=$true)][string]$InDir,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$Port = 8792
)

# Обратная сторона webp-server.ps1: браузер УМЕЕТ читать WebP, а System.Drawing
# нет. Отдаём ему файлы, он рисует каждый на canvas в натуральную величину
# и присылает обратно PNG. Нужно, чтобы мерить и примерять одежду ровно
# по тем картинкам, которые стоят в приложении.

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$inFull  = (Resolve-Path -LiteralPath $InDir).Path
$outFull = (Resolve-Path -LiteralPath $OutDir).Path
$files = @(Get-ChildItem -LiteralPath $inFull -Filter *.webp | Sort-Object Name)
if ($files.Count -eq 0) { throw "no .webp files in $inFull" }

$namesJson = "[" + (($files | ForEach-Object { '"' + $_.Name + '"' }) -join ",") + "]"

$page = @"
<!doctype html><meta charset="utf-8"><title>WebP -> PNG</title>
<ul id=log></ul>
<script>
const files = $namesJson;
const log = document.getElementById('log');
function say(t){ const li=document.createElement('li'); li.textContent=t; log.appendChild(li); }
function load(src){ return new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=src; }); }
(async () => {
  for (const name of files) {
    const img = await load('/src/' + encodeURIComponent(name));
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const buf = await blob.arrayBuffer();
    await fetch('/out/' + encodeURIComponent(name.replace(/\.webp$/i, '.png')) + '?w=' + img.naturalWidth + '&h=' + img.naturalHeight, { method:'POST', body: buf });
    say(name + '  ' + img.naturalWidth + 'x' + img.naturalHeight);
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

$running = $true
while ($running) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request; $res = $ctx.Response
  $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
  try {
    if ($path -eq "/") {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes($page)
      $res.ContentType = "text/html; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
    elseif ($path -like "/src/*") {
      $file = Join-Path $inFull $path.Substring(5)
      if (Test-Path -LiteralPath $file) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.ContentType = "image/webp"
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else { $res.StatusCode = 404 }
    }
    elseif ($path -like "/out/*" -and $req.HttpMethod -eq "POST") {
      $name = $path.Substring(5)
      $ms = New-Object System.IO.MemoryStream
      $req.InputStream.CopyTo($ms)
      [System.IO.File]::WriteAllBytes((Join-Path $outFull $name), $ms.ToArray())
      Write-Host ("saved {0}  {1}  ({2:N0} KB)" -f $name, $req.Url.Query, ($ms.Length / 1KB))
      $res.StatusCode = 204
    }
    elseif ($path -eq "/quit") { $res.StatusCode = 204; $running = $false }
    else { $res.StatusCode = 404 }
  } catch {
    Write-Host "error: $_"
    $res.StatusCode = 500
  }
  $res.Close()
}
$listener.Stop()
Write-Host "done -> $outFull"
