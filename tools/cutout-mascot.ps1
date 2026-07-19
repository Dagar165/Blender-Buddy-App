# Вырезает фон у картинки маскота и ставит персонажа по спецификации.
#
# Зачем: картинки из генератора приходят БЕЗ настоящей прозрачности —
# "шахматка" вокруг персонажа нарисована обычными пикселями. Скрипт находит
# этот фон заливкой от краёв (фоном считается только НЕЙТРАЛЬНО-СЕРЫЙ
# пиксель, поэтому синий призрак не страдает), убирает случайные блики
# и кладёт персонажа на квадратный холст: макушка на 10% сверху,
# рост — 80% высоты.
#
# Запуск:
#   powershell -File tools\cutout-mascot.ps1 -In <вход.png> -Out <выход.png>
# Ключ -KillInside дополнительно убирает шахматку, просвечивающую сквозь
# прозрачные детали (нужен был для стёкол очков на 3-й стадии).
#
# Дальше картинку надо сжать в WebP — см. tools/README-mascot.md.
# Заменяет прежний normalize-mascot.ps1, который искал персонажа
# по прозрачности и на таких картинках не работал.
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$Tol = 26,      # full-background distance
  [int]$Soft = 60,     # partial-alpha distance
  [int]$Gray = 22,     # max channel spread to count as neutral gray
  [switch]$KillInside  # also clear checker seen through glass/transparent parts
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class Cutout
{
    public static string Run(string inPath, string outPath, int tol, int soft, int grayTol, bool killInside)
    {
        using (Bitmap src = new Bitmap(inPath))
        {
            int W = src.Width, H = src.Height;
            Rectangle full = new Rectangle(0, 0, W, H);
            BitmapData data = src.LockBits(full, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            byte[] px = new byte[stride * H];
            Marshal.Copy(data.Scan0, px, 0, px.Length);

            // 1. collect border colours -> the checkerboard / flat background palette
            List<int[]> pal = new List<int[]>();
            for (int i = 0; i < W; i += 3) {
                AddSample(px, stride, i, 2, pal, grayTol);
                AddSample(px, stride, i, H - 3, pal, grayTol);
            }
            for (int j = 0; j < H; j += 3) {
                AddSample(px, stride, 2, j, pal, grayTol);
                AddSample(px, stride, W - 3, j, pal, grayTol);
            }
            if (pal.Count == 0) return "ERROR: border is not a flat/checker background";

            // 2. flood fill from the edges
            byte[] alpha = new byte[W * H];
            for (int i = 0; i < alpha.Length; i++) alpha[i] = 255;
            bool[] seen = new bool[W * H];
            Queue<int> q = new Queue<int>();
            for (int x = 0; x < W; x++) { Push(q, seen, x, 0, W); Push(q, seen, x, H - 1, W); }
            for (int y = 0; y < H; y++) { Push(q, seen, 0, y, W); Push(q, seen, W - 1, y, W); }

            long cleared = 0, softened = 0;
            while (q.Count > 0)
            {
                int id = q.Dequeue();
                int x = id % W, y = id / W;
                int o = y * stride + x * 4;
                int b = px[o], g = px[o + 1], r = px[o + 2];

                // any colour tint means we hit the character, not the grey backdrop
                int spread = Math.Max(r, Math.Max(g, b)) - Math.Min(r, Math.Min(g, b));
                if (spread > grayTol) continue;

                int best = int.MaxValue;
                foreach (int[] c in pal) {
                    int d = Math.Abs(r - c[0]) + Math.Abs(g - c[1]) + Math.Abs(b - c[2]);
                    if (d < best) best = d;
                }
                best /= 3;
                if (best > soft) continue;                 // this is the character, stop

                if (best <= tol) { alpha[id] = 0; cleared++; }
                else { alpha[id] = (byte)(255 * (best - tol) / (soft - tol)); softened++; }

                if (x > 0) Push(q, seen, x - 1, y, W);
                if (x < W - 1) Push(q, seen, x + 1, y, W);
                if (y > 0) Push(q, seen, x, y - 1, W);
                if (y < H - 1) Push(q, seen, x, y + 1, W);
            }

            // 2b. optional: checker showing through transparent parts (glass lenses).
            // Much stricter neutrality test so eye highlights survive.
            long inside = 0;
            if (killInside)
            {
                for (int y = 0; y < H; y++) {
                    int row = y * stride;
                    for (int x = 0; x < W; x++) {
                        int id = y * W + x;
                        if (alpha[id] == 0) continue;
                        int o = row + x * 4;
                        int b2 = px[o], g2 = px[o + 1], r2 = px[o + 2];
                        if (Math.Max(r2, Math.Max(g2, b2)) - Math.Min(r2, Math.Min(g2, b2)) > 8) continue;
                        foreach (int[] c in pal) {
                            if ((Math.Abs(r2 - c[0]) + Math.Abs(g2 - c[1]) + Math.Abs(b2 - c[2])) / 3 <= 14) {
                                alpha[id] = 0; inside++; break;
                            }
                        }
                    }
                }
            }

            // 3. keep only the biggest blob вЂ” drops stray sparkles/watermarks
            int[] label = new int[W * H];
            int bestLabel = 0; long bestSize = 0; int cur = 0;
            for (int start = 0; start < W * H; start++)
            {
                if (label[start] != 0 || alpha[start] < 40) continue;
                cur++;
                long size = 0;
                Queue<int> bq = new Queue<int>();
                bq.Enqueue(start); label[start] = cur;
                while (bq.Count > 0) {
                    int id = bq.Dequeue(); size++;
                    int x = id % W, y = id / W;
                    if (x > 0) TryBlob(bq, label, alpha, id - 1, cur);
                    if (x < W - 1) TryBlob(bq, label, alpha, id + 1, cur);
                    if (y > 0) TryBlob(bq, label, alpha, id - W, cur);
                    if (y < H - 1) TryBlob(bq, label, alpha, id + W, cur);
                }
                if (size > bestSize) { bestSize = size; bestLabel = cur; }
            }
            long dropped = 0;
            for (int id = 0; id < W * H; id++)
                if (alpha[id] > 0 && label[id] != bestLabel) { alpha[id] = 0; dropped++; }

            // 4. write alpha back
            int minX = W, minY = H, maxX = -1, maxY = -1;
            for (int y = 0; y < H; y++) {
                int row = y * stride;
                for (int x = 0; x < W; x++) {
                    byte a = alpha[y * W + x];
                    px[row + x * 4 + 3] = a;
                    if (a >= 40) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }
            Marshal.Copy(px, 0, data.Scan0, px.Length);
            src.UnlockBits(data);
            if (maxX < 0) return "ERROR: nothing left after cutout";

            // 4. place on a square canvas: top of head at 10%, character = 80% of height
            int cw = maxX - minX + 1, ch = maxY - minY + 1;
            int side = Math.Max((int)Math.Ceiling(ch / 0.8), (int)Math.Ceiling(cw / 0.9));
            using (Bitmap dst = new Bitmap(side, side, PixelFormat.Format32bppArgb))
            using (Graphics gr = Graphics.FromImage(dst))
            {
                gr.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                gr.DrawImage(src,
                    new Rectangle((side - cw) / 2, (int)Math.Round(side * 0.1), cw, ch),
                    new Rectangle(minX, minY, cw, ch), GraphicsUnit.Pixel);
                dst.Save(outPath, ImageFormat.Png);
            }
            return string.Format("OK: palette {0}, cleared {1:N0}px, soft edge {2:N0}px, strays dropped {3:N0}px, inside {7:N0}px, character {4}x{5}, canvas {6}",
                pal.Count, cleared, softened, dropped, cw, ch, side, inside);
        }
    }

    static void TryBlob(Queue<int> q, int[] label, byte[] alpha, int id, int cur)
    {
        if (label[id] != 0 || alpha[id] < 40) return;
        label[id] = cur;
        q.Enqueue(id);
    }

    static void AddSample(byte[] px, int stride, int x, int y, List<int[]> pal, int grayTol)
    {
        int o = y * stride + x * 4;
        int b = px[o], g = px[o + 1], r = px[o + 2];
        int mx = Math.Max(r, Math.Max(g, b)), mn = Math.Min(r, Math.Min(g, b));
        if (mx - mn > grayTol) return;                  // not neutral -> not background
        foreach (int[] c in pal)
            if (Math.Abs(r - c[0]) + Math.Abs(g - c[1]) + Math.Abs(b - c[2]) < 30) return;
        pal.Add(new int[] { r, g, b });
    }

    static void Push(Queue<int> q, bool[] seen, int x, int y, int W)
    {
        int id = y * W + x;
        if (seen[id]) return;
        seen[id] = true;
        q.Enqueue(id);
    }
}
'@

[Cutout]::Run((Resolve-Path -LiteralPath $In).Path, $Out, $Tol, $Soft, $Gray, [bool]$KillInside)
if (Test-Path -LiteralPath $Out) { "file: {0:N0} KB" -f ((Get-Item -LiteralPath $Out).Length / 1KB) }


