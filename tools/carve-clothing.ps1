# Ставит целую вещь на призрака И обрезает её по его силуэту с дальней стороны.
#
# Зачем: владелец один раз вырезал наушники по голове руками, и вышло хорошо —
# дальняя чашка честно прячется за затылком. Но такой вырез привязан к РАЗМЕРУ:
# растянешь картинку, и срез уедет с головы. Здесь вырез делается заново под
# любой размер, поэтому подбирать размер можно свободно.
#
# Режется только правая половина (дальняя): ближняя чашка должна лежать
# ПОВЕРХ головы, её трогать нельзя.
param(
  [Parameter(Mandatory=$true)][string]$Ghost,
  [Parameter(Mandatory=$true)][string]$Sprite,
  [Parameter(Mandatory=$true)][double[]]$Widths,
  [double]$Cx = 50.5,
  [double]$Cy = 27,
  [double]$CutFrom = 52,      # правее этой доли холста режем (в % холста одежды)
  # Дужка идёт ПОВЕРХ головы, её резать нельзя — иначе на макушке появляется
  # ступенька. Режем только ниже этой линии, там живут чашки.
  [double]$CutBelow = 33,
  [double]$Frame = 1.18,
  [string]$Out = "",
  [string]$BakeTo = "",
  [int]$Cell = 460,
  [int]$BakeSize = 900
)

Add-Type -AssemblyName System.Drawing

function Get-Trimmed([string]$path) {
  $bmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $path).Path)
  $rect = New-Object System.Drawing.Rectangle 0,0,$bmp.Width,$bmp.Height
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bytes = New-Object byte[] ($data.Stride * $bmp.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
  $bmp.UnlockBits($data)
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $data.Stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bytes[$row + $x*4 + 3] -gt 16) {
        if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $w = $maxX + 1 - $minX; $h = $maxY + 1 - $minY
  $trim = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($trim)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0,0,$w,$h), (New-Object System.Drawing.Rectangle $minX,$minY,$w,$h), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $bmp.Dispose()
  return $trim
}

$item = Get-Trimmed $Sprite
$ghostBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Ghost).Path)

# Холст одежды стороной $F: призрак — квадрат $C, прижат к низу и по центру.
function Build([int]$F, [double]$w) {
  $C = $F / $Frame
  $offX = ($F - $C) / 2.0
  $offY = $F - $C

  $canvas = New-Object System.Drawing.Bitmap $F, $F
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $dw = $C * $w / 100.0
  $dh = $dw * $item.Height / $item.Width
  $g.DrawImage($item, [int][math]::Round($offX + $C * $Cx / 100.0 - $dw / 2.0), [int][math]::Round($offY + $C * $Cy / 100.0 - $dh / 2.0), [int][math]::Round($dw), [int][math]::Round($dh))
  $g.Dispose()

  # Маска призрака в тех же координатах.
  $mask = New-Object System.Drawing.Bitmap $F, $F
  $mg = [System.Drawing.Graphics]::FromImage($mask)
  $mg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $mg.DrawImage($ghostBmp, [int]$offX, [int]$offY, [int]$C, [int]$C)
  $mg.Dispose()

  $rect = New-Object System.Drawing.Rectangle 0,0,$F,$F
  $cd = $canvas.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $md = $mask.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $cb = New-Object byte[] ($cd.Stride * $F)
  $mb = New-Object byte[] ($md.Stride * $F)
  [System.Runtime.InteropServices.Marshal]::Copy($cd.Scan0, $cb, 0, $cb.Length)
  [System.Runtime.InteropServices.Marshal]::Copy($md.Scan0, $mb, 0, $mb.Length)

  $from = [int]($F * $CutFrom / 100.0)
  $below = [int]($F * $CutBelow / 100.0)
  for ($y = $below; $y -lt $F; $y++) {
    $row = $y * $cd.Stride
    for ($x = $from; $x -lt $F; $x++) {
      $i = $row + $x*4
      if ($cb[$i + 3] -eq 0) { continue }
      $ga = $mb[$i + 3]
      if ($ga -eq 0) { continue }
      # Вычитаем: где призрак плотный — вещи нет совсем, по его мягкому краю
      # вещь тает так же мягко, иначе получается ступенька.
      $left = [int](255 - $ga)
      $a = [int]$cb[$i + 3]
      if ($a -gt $left) { $cb[$i + 3] = [byte]$left }
    }
  }

  [System.Runtime.InteropServices.Marshal]::Copy($cb, 0, $cd.Scan0, $cb.Length)
  $canvas.UnlockBits($cd)
  $mask.UnlockBits($md)
  $mask.Dispose()
  return $canvas
}

if ($BakeTo) {
  $baked = Build $BakeSize $Widths[0]
  $baked.Save($BakeTo, [System.Drawing.Imaging.ImageFormat]::Png)
  $baked.Dispose()
  Write-Output ("baked {0} w={1} cx={2} cy={3} cut={4}" -f $BakeTo, $Widths[0], $Cx, $Cy, $CutFrom)
}

if ($Out) {
  $pad = 14; $labelH = 34
  $strip = New-Object System.Drawing.Bitmap ($Widths.Count * ($Cell + $pad) + $pad), ($Cell + $labelH + $pad * 2)
  $g = [System.Drawing.Graphics]::FromImage($strip)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 20, 32))
  $font = New-Object System.Drawing.Font "Consolas", 15, ([System.Drawing.FontStyle]::Bold)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 120, 230, 150))

  for ($i = 0; $i -lt $Widths.Count; $i++) {
    $x0 = $pad + $i * ($Cell + $pad)
    $y0 = $pad + $labelH
    $g.DrawString(("width {0}%" -f $Widths[$i]), $font, $brush, $x0, $pad)
    $g.DrawImage($ghostBmp, (New-Object System.Drawing.Rectangle $x0, $y0, $Cell, $Cell))
    $piece = Build ([int]($Cell * $Frame)) $Widths[$i]
    $cw = [int]($Cell * $Frame)
    $g.DrawImage($piece, (New-Object System.Drawing.Rectangle ($x0 - [int]($Cell * ($Frame - 1) / 2)), ($y0 - [int]($Cell * ($Frame - 1))), $cw, $cw))
    $piece.Dispose()
  }

  $g.Dispose()
  $strip.Save((Join-Path (Get-Location) $Out), [System.Drawing.Imaging.ImageFormat]::Png)
  $strip.Dispose()
  Write-Output "saved $Out"
}

$item.Dispose()
$ghostBmp.Dispose()
