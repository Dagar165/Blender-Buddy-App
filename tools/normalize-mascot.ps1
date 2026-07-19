# Нормализатор картинок маскота (Windows PowerShell 5.1, без внешних программ).
#
# Что делает: находит персонажа на картинке (по непрозрачным пикселям),
# обрезает пустые поля и кладёт его на КВАДРАТНЫЙ холст по спецификации
# (JKids_Bot_спецификация_картинок.md): макушка ~10% от верха, низ ~90%,
# по горизонтали по центру. Размер холста берётся из самой картинки
# (без растягивания — качество не теряется).
#
# Запуск:  powershell -File tools\normalize-mascot.ps1 -In <входной.png> -Out <выходной.png>
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class MascotNormalizer
{
    // alpha-порог: слабое свечение вокруг персонажа не считаем "телом",
    // иначе рамка расползётся на весь кадр
    const int AlphaThreshold = 24;

    public static string Normalize(string inPath, string outPath)
    {
        using (Bitmap src = new Bitmap(inPath))
        {
            Rectangle full = new Rectangle(0, 0, src.Width, src.Height);
            BitmapData data = src.LockBits(full, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            byte[] px = new byte[data.Stride * src.Height];
            Marshal.Copy(data.Scan0, px, 0, px.Length);
            src.UnlockBits(data);

            int minX = src.Width, minY = src.Height, maxX = -1, maxY = -1;
            for (int y = 0; y < src.Height; y++)
            {
                int row = y * data.Stride;
                for (int x = 0; x < src.Width; x++)
                {
                    if (px[row + x * 4 + 3] >= AlphaThreshold)
                    {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            if (maxX < 0) return "ERROR: не нашёл непрозрачных пикселей";

            int charW = maxX - minX + 1;
            int charH = maxY - minY + 1;
            // персонаж = 80% высоты холста, и не шире 90% (поля под свечение)
            int side = Math.Max((int)Math.Ceiling(charH / 0.8), (int)Math.Ceiling(charW / 0.9));

            using (Bitmap dst = new Bitmap(side, side, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(dst))
                {
                    g.DrawImage(src,
                        new Rectangle((side - charW) / 2, (int)Math.Round(side * 0.1), charW, charH),
                        new Rectangle(minX, minY, charW, charH),
                        GraphicsUnit.Pixel);
                }
                dst.Save(outPath, ImageFormat.Png);
            }
            return string.Format("OK: персонаж {0}x{1}, холст {2}x{2}", charW, charH, side);
        }
    }
}
'@

$result = [MascotNormalizer]::Normalize((Resolve-Path $In).Path, $Out)
$result
if (Test-Path $Out) { "Размер файла: {0:N0} КБ" -f ((Get-Item $Out).Length / 1KB) }
