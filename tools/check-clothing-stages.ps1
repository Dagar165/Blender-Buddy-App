param(
  [Parameter(Mandatory=$true)][string]$StageDir,   # ghost-stage-N.png
  [Parameter(Mandatory=$true)][string]$SpriteDir,  # уже позиционированные спрайты
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Sprites = "glasses.png,hat.png",        # порядок рисования: снизу вверх
  [string]$Behind = "",                            # рисуется ПОД призраком
  [double]$Frame = 1.18,
  [string]$HeadScales = "1,1,0.93,0.92,0.92",      # по стадиям 1..5
  [string]$Dxs = "0,0,0,0,0",                      # сдвиг в % квадрата призрака
  [string]$Dys = "0,0,0,0,0",
  [int]$Cell = 420
)

# Повторяет ровно то, что делает браузер: холст одежды в $Frame раз больше
# квадрата призрака, прижат к его низу и центрирован по горизонтали.
# Масштаб вещей головы применяется вокруг точки 26% высоты ПРИЗРАКА.

Add-Type -AssemblyName System.Drawing

$scales = $HeadScales.Split(",")
$names = $Sprites.Split(",")
$stages = 1..5

$bmp = New-Object System.Drawing.Bitmap ($Cell * 5), $Cell
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(11, 18, 32))
$font = New-Object System.Drawing.Font("Consolas", 13)
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(230, 120, 220, 120))

foreach ($n in $stages) {
  $ghost = [System.Drawing.Bitmap]::FromFile((Join-Path $StageDir "ghost-stage-$n.png"))
  $C = $ghost.Width
  $F = [int]($C * $Frame)
  $offX = [int](($F - $C) / 2)
  $offY = $F - $C

  $frameBmp = New-Object System.Drawing.Bitmap $F, $F
  $fg = [System.Drawing.Graphics]::FromImage($frameBmp)
  $fg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scale = [double]$scales[$n - 1]
  # точка 26% высоты призрака в координатах холста одежды
  $originY = $offY + 0.26 * $C
  $originX = $F / 2.0

  $dx = [double]($Dxs.Split(","))[$n - 1] / 100.0 * $C
  $dy = [double]($Dys.Split(","))[$n - 1] / 100.0 * $C

  foreach ($s in $Behind.Split(",")) {
    if (-not $s.Trim()) { continue }
    $sprite = [System.Drawing.Bitmap]::FromFile((Join-Path $SpriteDir $s.Trim()))
    $w = $F * $scale
    $fg.DrawImage($sprite, [int]($originX - $originX * $scale + $dx), [int]($originY - $originY * $scale + $dy), [int]$w, [int]$w)
    $sprite.Dispose()
  }

  $fg.DrawImage($ghost, $offX, $offY, $C, $C)

  foreach ($s in $names) {
    $sprite = [System.Drawing.Bitmap]::FromFile((Join-Path $SpriteDir $s.Trim()))
    $w = $F * $scale
    $x = $originX - $originX * $scale + $dx
    $y = $originY - $originY * $scale + $dy
    $fg.DrawImage($sprite, [int]$x, [int]$y, [int]$w, [int]$w)
    $sprite.Dispose()
  }
  $fg.Dispose()

  $g.DrawImage($frameBmp, ($n - 1) * $Cell, 0, $Cell, $Cell)
  $g.DrawString("stage $n  x$scale", $font, $brush, ($n - 1) * $Cell + 6, 6)
  $frameBmp.Dispose(); $ghost.Dispose()
}

$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output "wrote $Out"
