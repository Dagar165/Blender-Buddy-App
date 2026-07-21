param(
  [Parameter(Mandatory=$true)][string]$Path,      # позиционированный спрайт
  [Parameter(Mandatory=$true)][string]$OutFront,
  [Parameter(Mandatory=$true)][string]$OutBehind,
  [double]$Frame = 1.18,
  # прямоугольник в процентах КВАДРАТА ПРИЗРАКА — что уходит ЗА призрака
  [double]$X0 = 61, [double]$X1 = 85, [double]$Y0 = 21, [double]$Y1 = 48
)

# Делит одну вещь на два слоя: то, что рисуется поверх призрака, и то, что
# прячется за ним. Нужно для наушников: голова повёрнута, и дальняя чашка
# должна уходить за затылок, а не лежать на глазу.

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile($Path)
$S = $src.Width
$C = $S / $Frame
$offX = ($S - $C) / 2
$offY = $S - $C
$px = { param($v) [int]($offX + $v / 100.0 * $C) }
$py = { param($v) [int]($offY + $v / 100.0 * $C) }

$x0 = & $px $X0; $x1 = & $px $X1; $y0 = & $py $Y0; $y1 = & $py $Y1

$front = New-Object System.Drawing.Bitmap $S, $S
$behind = New-Object System.Drawing.Bitmap $S, $S

for ($y = 0; $y -lt $S; $y++) {
  for ($x = 0; $x -lt $S; $x++) {
    $c = $src.GetPixel($x, $y)
    if ($c.A -eq 0) { continue }
    if ($x -ge $x0 -and $x -le $x1 -and $y -ge $y0 -and $y -le $y1) {
      $behind.SetPixel($x, $y, $c)
    } else {
      $front.SetPixel($x, $y, $c)
    }
  }
}

$front.Save($OutFront, [System.Drawing.Imaging.ImageFormat]::Png)
$behind.Save($OutBehind, [System.Drawing.Imaging.ImageFormat]::Png)
$front.Dispose(); $behind.Dispose(); $src.Dispose()
Write-Output "split at ghost% x $X0..$X1  y $Y0..$Y1  -> $OutFront + $OutBehind"
