# Примерочная: сажает вырезанную вещь на призрака и показывает, что вышло.
#
# Зачем: вещь, нарисованная отдельно, почти никогда не садится с первого раза.
# Скрипт кладёт её по трём числам (ширина и центр в процентах кадра призрака),
# рисует общий кадр для проверки ГЛАЗАМИ и, если попросить, сохраняет готовый
# спрайт уже на своём месте.
#
# ТОЧКА ОТСЧЁТА (решение владельца 22.07): шляпа и очки выверены, всё
# остальное ставится относительно них. Числа, которые стоят сейчас:
#
#   очки       w=40   cx=54     cy=28
#   наушники   w=62   cx=50.5   cy=27   (вырезаны, см. ниже)
#   шляпа      w=59   cx=48.5   cy=8
#
# Наушники НЕ ставятся этим скриптом — им нужен вырез по голове, иначе дальняя
# чашка лежит на лице. Их печёт tools\carve-clothing.ps1 из целой картинки
# «наушники (новые, вырезано).png».
#
# Две попытки, которые не сработали, чтобы их не повторяли:
# 1) резать надвое (split-sprite) — половинки расходятся при подгонке по стадиям;
# 2) вырезать руками один раз — вырез привязан к размеру, при увеличении срез
#    уезжает с головы и висит в воздухе прямым ломтем.
# Вырез надо делать ЗАНОВО под каждый размер — этим и занимается carve-clothing.
#
# Команда целиком:
#   powershell -File tools\fit-clothing.ps1 -Ghost <ghost-stage-2.png> `
#     -SpriteDir <папка с вырезанным> -Out preview.png -Frame 1.18 `
#     -SaveDir <куда спрайты> `
#     -Items "file=item-06.png;w=40;cx=54;cy=28;as=glasses|file=headphones.png;w=48;cx=50.5;cy=27;as=headphones|file=item-02.png;w=59;cx=51.5;cy=8;as=hat"
#
# Порядок в -Items = порядок рисования снизу вверх, он же порядок слоёв
# в shop-config: очки → наушники → шляпа.
#
# ВАЖНО: -Frame обязан совпадать с CLOTHING_FRAME в
# client/src/lib/shop-config.ts, иначе в приложении вещь окажется не там, где
# на этой картинке. Холст вещи выше квадрата призрака и прижат к его низу —
# так шляпе хватает места над макушкой, которого в кадре призрака нет.
#
# Дальше готовые PNG гонятся через tools\webp-server.ps1 и кладутся
# в client/src/assets/mascot.
param(
  [Parameter(Mandatory=$true)][string]$Ghost,
  [Parameter(Mandatory=$true)][string]$SpriteDir,
  [Parameter(Mandatory=$true)][string]$Out,
  # "file=item-02.png;w=46;cx=50;cy=10" separated by "|", drawn in the given order
  [Parameter(Mandatory=$true)][string]$Items,
  [int]$Preview = 900,
  # Sprite canvas as a share of the ghost square: 1.0 = same frame,
  # 1.35 = 35% extra headroom above the ghost for tall hats.
  [double]$Frame = 1.0,
  [string]$SaveDir = ""
)

Add-Type -AssemblyName System.Drawing

$ghostImg = [System.Drawing.Bitmap]::FromFile($Ghost)
$C = $ghostImg.Width            # ghost canvas (square)
$F = [int]($C * $Frame)         # sprite canvas
$offX = [int](($F - $C) / 2)    # ghost square sits centred horizontally...
$offY = $F - $C                 # ...and flush with the BOTTOM of the sprite canvas

$canvas = New-Object System.Drawing.Bitmap $F, $F
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(11, 18, 32))
$g.DrawImage($ghostImg, $offX, $offY, $C, $C)

foreach ($spec in $Items.Split("|")) {
  if (-not $spec.Trim()) { continue }
  $kv = @{}
  foreach ($pair in $spec.Split(";")) {
    $p = $pair.Split("=")
    if ($p.Count -eq 2) { $kv[$p[0].Trim()] = $p[1].Trim() }
  }

  $file = Join-Path $SpriteDir $kv["file"]
  $sprite = [System.Drawing.Bitmap]::FromFile($file)

  # All numbers are % of the GHOST square, so they stay readable no matter
  # how much headroom the sprite canvas adds.
  $dw = [double]$kv["w"] / 100.0 * $C
  $dh = $dw * $sprite.Height / $sprite.Width
  $cx = [double]$kv["cx"] / 100.0 * $C + $offX
  $cy = [double]$kv["cy"] / 100.0 * $C + $offY

  $g.DrawImage($sprite, [int]($cx - $dw/2), [int]($cy - $dh/2), [int]$dw, [int]$dh)

  if ($SaveDir) {
    if (-not (Test-Path $SaveDir)) { New-Item -ItemType Directory -Path $SaveDir | Out-Null }
    $one = New-Object System.Drawing.Bitmap $F, $F
    $g2 = [System.Drawing.Graphics]::FromImage($one)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.DrawImage($sprite, [int]($cx - $dw/2), [int]($cy - $dh/2), [int]$dw, [int]$dh)
    $g2.Dispose()
    $name = if ($kv.ContainsKey("as")) { $kv["as"] } else { [System.IO.Path]::GetFileNameWithoutExtension($kv["file"]) }
    $one.Save((Join-Path $SaveDir "$name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $one.Dispose()
  }

  $sprite.Dispose()
  Write-Output ("placed {0}  w={1}%  centre=({2}%, {3}%)" -f $kv["file"], $kv["w"], $kv["cx"], $kv["cy"])
}

$g.Dispose()
$ghostImg.Dispose()

$small = New-Object System.Drawing.Bitmap $Preview, $Preview
$gs = [System.Drawing.Graphics]::FromImage($small)
$gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gs.DrawImage($canvas, 0, 0, $Preview, $Preview)
$gs.Dispose()
$small.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$small.Dispose()
$canvas.Dispose()

Write-Output "wrote $Out (frame $Frame)"
