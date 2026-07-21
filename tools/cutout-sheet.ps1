# Вырезает фигуры из листа с НАРИСОВАННОЙ шахматкой вместо прозрачности
# и раскладывает их по общему кадру.
#
# Заменяет cutout-mascot.ps1 для наборов картинок. Отличий три, и каждое
# лечит конкретный дефект, который вылез на живом призраке:
#
# 1. ПРОЗРАЧНОСТЬ ПЛАВНАЯ, а не «да/нет». Это главное. У бледного призрака
#    край отличается от серого фона на 5–10 единиц синевы, поэтому любой
#    порог «фон/не фон» рвёт контур ступеньками — так и вышло на первой
#    версии. Теперь заливка считает, НАСКОЛЬКО пиксель непохож на фон,
#    и из этого делает полупрозрачность.
#
# 2. НЕПОХОЖЕСТЬ меряется по САМОМУ отличающемуся каналу, а не по среднему.
#    У фона каналы равны, у призрака синий выше — среднее это размазывает
#    (разница 6 превращается в 2), максимум сохраняет.
#
# 3. ЦВЕТ ПО КРАЮ БЕРЁТСЯ ИЗНУТРИ фигуры. Пиксели на границе — это смесь
#    персонажа с серым фоном; если оставить их как есть, вокруг персонажа
#    светится светло-серый ободок, особенно заметный на тёмной теме.
#
# Запуск:
#   powershell -File tools\cutout-sheet.ps1 -In <лист.png> -OutDir <папка> `
#              -Take 2,3,4,5 -AsStage 2,3,4,5
#
# Кадр берётся общий на все выбранные фигуры: тело 77,97% высоты холста,
# нижний край на 90%, центр по середине — мерка снята с малыша
# (ghost-stage-1.webp). Ломать её нельзя, иначе призрак прыгает при эволюции.
param(
  [Parameter(Mandatory=$true)][string]$In,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int[]]$Take = @(),
  [int[]]$AsStage = @(),
  # Пороги по НАСЫЩЕННОСТИ (max канал минус min). Замер этого листа:
  # у фона она не превышает 8, у 99,7% пикселей <= 5; у бледного края
  # призрака 11–24. Отсюда и взяты числа.
  [int]$Lo = 7,          # <= столько -> фон, полностью прозрачно
  [int]$Hi = 18,         # >= столько -> персонаж; между ними мягкий край
  [int]$Close = 3,        # затягивание мелких выемок по контуру, в пикселях
  [int]$Blur = 3,          # сглаживание карты насыщенности: чем больше, тем мягче край
  [double]$BodyFrac = 0.7797,
  [double]$BottomFrac = 0.900
)

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public static class CutoutSheet
{
    public static string Run(string path, string outDir, int[] take, int[] asStage,
                             int lo, int hi, int closeRadius, int blurPasses,
                             double bodyFrac, double bottomFrac)
    {
        using (Bitmap raw = new Bitmap(path))
        using (Bitmap src = new Bitmap(raw.Width, raw.Height, PixelFormat.Format32bppArgb))
        {
            using (Graphics g0 = Graphics.FromImage(src)) g0.DrawImage(raw, 0, 0, raw.Width, raw.Height);

            int W = src.Width, H = src.Height;
            BitmapData data = src.LockBits(new Rectangle(0,0,W,H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            byte[] px = new byte[stride * H];
            Marshal.Copy(data.Scan0, px, 0, px.Length);
            src.UnlockBits(data);

            StringBuilder sb = new StringBuilder();
            sb.AppendLine("sheet " + W + "x" + H);

            // ---- 0. если прозрачность в файле УЖЕ есть, берём её как есть ----
            // Лучший случай: вырезать нечего, край нарисован автором. Так надо
            // просить у генератора всегда — см. шапку файла.
            long clearPixels = 0;
            for (int i = 3; i < px.Length; i += 4) if (px[i] < 10) clearPixels++;
            bool alreadyCut = clearPixels > (long)(W * (long)H * 0.05);

            // ---- 1. background palette from the border ----
            List<int[]> pal = new List<int[]>();
            if (!alreadyCut) {
                for (int i = 0; i < W; i += 3) { AddSample(px, stride, i, 2, pal); AddSample(px, stride, i, H-3, pal); }
                for (int j = 0; j < H; j += 3) { AddSample(px, stride, 2, j, pal); AddSample(px, stride, W-3, j, pal); }
                if (pal.Count == 0) return "ERROR: border is neither transparent nor a flat/checker background";
                sb.AppendLine("  background shades: " + pal.Count);
            } else {
                sb.AppendLine("  файл уже с прозрачностью — вырезка не нужна");
            }

            // ---- 1а. карта насыщенности, слегка сглаженная ----
            // Фон нейтрально-серый, персонаж всегда хоть немного цветной —
            // поэтому решаем по насыщенности, а не по яркости.
            // Сглаживание обязательно: у бледных мест (мягкий блик на макушке)
            // насыщенность скачет от пикселя к пикселю, и без сглаживания
            // край выходит пятнистым. После сглаживания он честно повторяет
            // растушёвку, нарисованную в самой картинке.
            float[] chroma = new float[W*H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    int o = y*stride + x*4;
                    int b0 = px[o], g0 = px[o+1], r0 = px[o+2];
                    chroma[y*W + x] = Math.Max(r0, Math.Max(g0,b0)) - Math.Min(r0, Math.Min(g0,b0));
                }
            BlurField(chroma, W, H, blurPasses);

            // ---- 2. flood fill from the edges, writing SOFT alpha ----
            // <= lo -> фон, >= hi -> персонаж, между ними — настоящая
            // растушёвка и частичная прозрачность. Заливка останавливается
            // на hi, поэтому внутрь тела не заходит.
            byte[] alpha = new byte[W*H];
            if (alreadyCut) {
                for (int y = 0; y < H; y++)
                    for (int x = 0; x < W; x++)
                        alpha[y*W + x] = px[y*stride + x*4 + 3];
            } else {
            for (int i = 0; i < alpha.Length; i++) alpha[i] = 255;
            bool[] seen = new bool[W*H];
            Queue<int> q = new Queue<int>();
            for (int x = 0; x < W; x++) { Push(q, seen, x, 0, W); Push(q, seen, x, H-1, W); }
            for (int y = 0; y < H; y++) { Push(q, seen, 0, y, W); Push(q, seen, W-1, y, W); }
            long cleared = 0, soft = 0;
            while (q.Count > 0) {
                int id = q.Dequeue();
                int x = id % W, y = id / W;
                int o = y*stride + x*4;
                int b = px[o], gg = px[o+1], r = px[o+2];

                int mx = Math.Max(r, Math.Max(gg, b));
                if (mx < 120) continue;                 // dark pixel: the backdrop is light
                float best = chroma[id];
                if (best >= hi) continue;               // character, stop here

                if (best <= lo) { alpha[id] = 0; cleared++; }
                else {
                    int a = (int)Math.Round(255f * (best - lo) / (hi - lo));
                    // Ниже этого — почти наверняка шум фона, а не край персонажа.
                    if (a < 24) { alpha[id] = 0; cleared++; }
                    else { alpha[id] = (byte)a; soft++; }
                }

                if (x > 0) Push(q, seen, x-1, y, W);
                if (x < W-1) Push(q, seen, x+1, y, W);
                if (y > 0) Push(q, seen, x, y-1, W);
                if (y < H-1) Push(q, seen, x, y+1, W);
            }
            sb.AppendLine(string.Format("  backdrop {0:N0} px, soft edge {1:N0} px", cleared, soft));
            }

            bool[] inside = new bool[W*H];
            for (int i = 0; i < inside.Length; i++) inside[i] = alpha[i] >= 128;

            // ---- 3. split into figures by empty columns ----
            List<int[]> groups = new List<int[]>();
            int start = -1, gap = 0, minGap = Math.Max(3, W / 400);
            for (int x = 0; x < W; x++) {
                bool any = false;
                for (int y = 0; y < H; y++) if (inside[y*W + x]) { any = true; break; }
                if (any) { if (start < 0) start = x; gap = 0; }
                else if (start >= 0) { gap++; if (gap > minGap) { groups.Add(new int[]{start, x-gap}); start = -1; } }
            }
            if (start >= 0) groups.Add(new int[]{start, W-1});

            // Одиночные пылинки по краям листа тоже дают «столбец с содержимым»
            // и сбивают нумерацию фигур — выкидываем всё заметно мелкое.
            int minWidth = W / 40;
            List<int[]> real = new List<int[]>();
            foreach (int[] gr in groups) {
                if (gr[1] - gr[0] + 1 < minWidth) continue;
                long area = 0;
                for (int y = 0; y < H; y++)
                    for (int x = gr[0]; x <= gr[1]; x++)
                        if (inside[y*W + x]) area++;
                if (area < 2000) continue;
                real.Add(gr);
            }
            if (real.Count != groups.Count)
                sb.AppendLine("  dropped specks: " + (groups.Count - real.Count));
            groups = real;
            sb.AppendLine("  figures found: " + groups.Count);

            if (take.Length == 0) {
                take = new int[groups.Count];
                for (int i = 0; i < groups.Count; i++) take[i] = i + 1;
            }
            if (asStage.Length != take.Length) asStage = take;

            // ---- 4. per figure: keep the biggest blob only ----
            foreach (int[] gr in groups) KeepBiggestBlob(inside, W, H, gr[0], gr[1]);
            for (int i = 0; i < alpha.Length; i++)
                if (!inside[i] && alpha[i] >= 128) alpha[i] = 0;   // stray sparkles

            // ---- 5. затянуть мелкие выемки и «мохнатость» по контуру ----
            // По краю персонажа местами идёт почти белый блик: он бесцветный,
            // и по насыщенности неотличим от фона — край в этом месте выходит
            // рваным. Силуэт при этом гладкий, а рвань мелкая, поэтому
            // замыкание (расширить, затем сжать) её убирает, не трогая
            // настоящие впадины — они шире раз в пять.
            // Всё это чинит нашу вырезку. Если прозрачность пришла из файла,
            // трогать её нельзя — там край нарисован автором и уже правильный.
            if (!alreadyCut) {
                CloseGaps(alpha, W, H, closeRadius);

                // ---- 5а. одно мягкое размытие, чтобы не осталось лесенки ----
                Smooth(alpha, W, H);
            }

            // ---- 6. pull edge colour from inside so no grey halo remains ----
            byte[] outPx;
            if (alreadyCut) {
                outPx = px;
            } else {
                bool[] core = new bool[W*H];
                for (int i = 0; i < core.Length; i++) core[i] = alpha[i] >= 250;
                outPx = DeFringe(px, stride, core, alpha, W, H);
            }

            // ---- 7. lay the figures out on one shared frame ----
            List<int[]> boxes = new List<int[]>();
            int n = 0;
            foreach (int[] gr in groups) {
                n++;
                int[] bx = Box(alpha, W, H, gr[0], gr[1], 150);
                boxes.Add(bx);
                sb.AppendLine(string.Format("    #{0}: x {1}..{2} y {3}..{4}  {5}x{6}",
                    n, bx[0], bx[1], bx[2], bx[3], bx[1]-bx[0]+1, bx[3]-bx[2]+1));
            }

            int bandTop = int.MaxValue, bandBottom = -1;
            foreach (int t in take) {
                int[] bx = boxes[t-1];
                if (bx[2] < bandTop) bandTop = bx[2];
                if (bx[3] > bandBottom) bandBottom = bx[3];
            }
            int bandH = bandBottom - bandTop + 1;
            int side = (int)Math.Round(bandH / bodyFrac);
            int canvasBottom = (int)Math.Round(side * bottomFrac);
            sb.AppendLine(string.Format("  band y {0}..{1} ({2} px) -> canvas {3}x{3}, bottom y {4}",
                bandTop, bandBottom, bandH, side, canvasBottom));

            using (Bitmap clean = new Bitmap(W, H, PixelFormat.Format32bppArgb))
            {
                BitmapData cd = clean.LockBits(new Rectangle(0,0,W,H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(outPx, 0, cd.Scan0, outPx.Length);
                clean.UnlockBits(cd);

                for (int k = 0; k < take.Length; k++) {
                    int[] b = boxes[take[k]-1];
                    int cw = b[1]-b[0]+1, ch = b[3]-b[2]+1;
                    int dx = (int)Math.Round(side/2.0 - cw/2.0);
                    int dy = canvasBottom - (bandBottom - b[2]);
                    int pad = 8;
                    int sx = Math.Max(0, b[0]-pad), sy = Math.Max(0, b[2]-pad);
                    int sw = Math.Min(W - sx, cw + 2*pad), sh = Math.Min(H - sy, ch + 2*pad);
                    using (Bitmap dst = new Bitmap(side, side, PixelFormat.Format32bppArgb))
                    using (Graphics g = Graphics.FromImage(dst)) {
                        g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                        g.DrawImage(clean, new Rectangle(dx - (b[0]-sx), dy - (b[2]-sy), sw, sh),
                                    new Rectangle(sx, sy, sw, sh), GraphicsUnit.Pixel);
                        dst.Save(System.IO.Path.Combine(outDir, "stage-" + asStage[k] + ".png"), ImageFormat.Png);
                        sb.AppendLine(string.Format("    figure {0} -> stage-{1}.png ({2}x{3} on {4}x{4})",
                            take[k], asStage[k], cw, ch, side));
                    }
                }
            }

            return sb.ToString();
        }
    }

    // --- helpers ---

    // Box blur of a float field, repeated to approximate a gaussian.
    static void BlurField(float[] a, int W, int H, int passes)
    {
        float[] tmp = new float[W*H];
        for (int p = 0; p < passes; p++) {
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    int id = y*W + x;
                    float s = a[id];
                    s += (x > 0) ? a[id-1] : a[id];
                    s += (x < W-1) ? a[id+1] : a[id];
                    tmp[id] = s / 3f;
                }
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    int id = y*W + x;
                    float s = tmp[id];
                    s += (y > 0) ? tmp[id-W] : tmp[id];
                    s += (y < H-1) ? tmp[id+W] : tmp[id];
                    a[id] = s / 3f;
                }
        }
    }

    // Morphological close on the alpha mask: dilate then erode by the same
    // amount. Notches narrower than 2*radius disappear, wider shapes survive.
    static void CloseGaps(byte[] alpha, int W, int H, int radius)
    {
        if (radius <= 0) return;

        bool[] m = new bool[W*H];
        for (int i = 0; i < m.Length; i++) m[i] = alpha[i] >= 128;

        m = Morph(m, W, H, radius, true);
        m = Morph(m, W, H, radius, false);

        for (int i = 0; i < m.Length; i++)
            if (m[i] && alpha[i] < 255) alpha[i] = 255;
    }

    static bool[] Morph(bool[] src, int W, int H, int passes, bool dilate)
    {
        bool[] cur = src;
        for (int p = 0; p < passes; p++) {
            bool[] next = new bool[W*H];
            for (int y = 0; y < H; y++)
                for (int x = 0; x < W; x++) {
                    int id = y*W + x;
                    bool self = cur[id];
                    bool left = x > 0 ? cur[id-1] : self;
                    bool right = x < W-1 ? cur[id+1] : self;
                    bool up = y > 0 ? cur[id-W] : self;
                    bool down = y < H-1 ? cur[id+W] : self;
                    next[id] = dilate
                        ? (self || left || right || up || down)
                        : (self && left && right && up && down);
                }
            cur = next;
        }
        return cur;
    }

    // Separable 3x3 box blur over the alpha only. Solid interior stays solid
    // (255 surrounded by 255 averages back to 255); only the rim gets smoothed,
    // which is what removes the last single-pixel stair-stepping.
    static void Smooth(byte[] alpha, int W, int H)
    {
        float[] a = new float[W*H];
        for (int i = 0; i < a.Length; i++) a[i] = alpha[i];

        float[] tmp = new float[W*H];
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                int id = y*W + x;
                float s = a[id];
                s += (x > 0) ? a[id-1] : a[id];
                s += (x < W-1) ? a[id+1] : a[id];
                tmp[id] = s / 3f;
            }
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                int id = y*W + x;
                float s = tmp[id];
                s += (y > 0) ? tmp[id-W] : tmp[id];
                s += (y < H-1) ? tmp[id+W] : tmp[id];
                int v = (int)Math.Round(s / 3f);
                alpha[id] = (byte)Math.Max(0, Math.Min(255, v));
            }
    }

    // Edge pixels are a blend of character and grey backdrop. Repaint them
    // with the nearest solid colour from inside, so only alpha carries the edge.
    static byte[] DeFringe(byte[] px, int stride, bool[] core, byte[] alpha, int W, int H)
    {
        byte[] outPx = new byte[px.Length];
        Array.Copy(px, outPx, px.Length);

        int[] srcOf = new int[W*H];
        for (int i = 0; i < srcOf.Length; i++) srcOf[i] = -1;
        Queue<int> q = new Queue<int>();
        for (int i = 0; i < core.Length; i++)
            if (core[i]) { srcOf[i] = i; q.Enqueue(i); }

        while (q.Count > 0) {
            int id = q.Dequeue();
            int x = id % W, y = id / W;
            for (int d = 0; d < 4; d++) {
                int nx = x + (d == 0 ? -1 : d == 1 ? 1 : 0);
                int ny = y + (d == 2 ? -1 : d == 3 ? 1 : 0);
                if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
                int nid = ny*W + nx;
                if (srcOf[nid] >= 0) continue;
                if (alpha[nid] == 0) continue;      // fully transparent, colour irrelevant
                srcOf[nid] = srcOf[id];
                q.Enqueue(nid);
            }
        }

        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++) {
                int id = y*W + x;
                int o = y*stride + x*4;
                if (alpha[id] == 0) { outPx[o] = 0; outPx[o+1] = 0; outPx[o+2] = 0; outPx[o+3] = 0; continue; }
                int from = srcOf[id];
                if (from >= 0 && from != id) {
                    int fo = (from / W)*stride + (from % W)*4;
                    outPx[o] = px[fo]; outPx[o+1] = px[fo+1]; outPx[o+2] = px[fo+2];
                }
                outPx[o+3] = alpha[id];
            }

        return outPx;
    }

    static void KeepBiggestBlob(bool[] inside, int W, int H, int x0, int x1)
    {
        int[] label = new int[W*H];
        int cur = 0, bestLabel = 0; long bestSize = 0;
        for (int y = 0; y < H; y++)
            for (int x = x0; x <= x1; x++) {
                int start = y*W + x;
                if (!inside[start] || label[start] != 0) continue;
                cur++;
                long size = 0;
                Queue<int> bq = new Queue<int>();
                bq.Enqueue(start); label[start] = cur;
                while (bq.Count > 0) {
                    int id = bq.Dequeue(); size++;
                    int cx = id % W, cy = id / W;
                    if (cx > x0) TryBlob(bq, label, inside, id-1, cur);
                    if (cx < x1) TryBlob(bq, label, inside, id+1, cur);
                    if (cy > 0) TryBlob(bq, label, inside, id-W, cur);
                    if (cy < H-1) TryBlob(bq, label, inside, id+W, cur);
                }
                if (size > bestSize) { bestSize = size; bestLabel = cur; }
            }
        for (int y = 0; y < H; y++)
            for (int x = x0; x <= x1; x++) {
                int id = y*W + x;
                if (inside[id] && label[id] != bestLabel) inside[id] = false;
            }
    }

    static void TryBlob(Queue<int> q, int[] label, bool[] inside, int id, int cur)
    {
        if (label[id] != 0 || !inside[id]) return;
        label[id] = cur;
        q.Enqueue(id);
    }

    static int[] Box(byte[] alpha, int W, int H, int x0, int x1, int amin)
    {
        int minX = int.MaxValue, maxX = -1, minY = int.MaxValue, maxY = -1;
        for (int y = 0; y < H; y++)
            for (int x = x0; x <= x1; x++) {
                if (alpha[y*W + x] < amin) continue;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        return new int[]{ minX, maxX, minY, maxY };
    }

    static void AddSample(byte[] px, int stride, int x, int y, List<int[]> pal)
    {
        int o = y*stride + x*4;
        int b = px[o], g = px[o+1], r = px[o+2];
        if (Math.Max(r, Math.Max(g,b)) - Math.Min(r, Math.Min(g,b)) > 8) return;
        foreach (int[] c in pal)
            if (Math.Abs(r-c[0]) + Math.Abs(g-c[1]) + Math.Abs(b-c[2]) < 30) return;
        pal.Add(new int[]{ r, g, b });
    }

    static void Push(Queue<int> q, bool[] seen, int x, int y, int W)
    {
        int id = y*W + x;
        if (seen[id]) return;
        seen[id] = true;
        q.Enqueue(id);
    }
}
'@

if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
[CutoutSheet]::Run((Resolve-Path -LiteralPath $In).Path, (Resolve-Path -LiteralPath $OutDir).Path,
                   $Take, $AsStage, $Lo, $Hi, $Close, $Blur, $BodyFrac, $BottomFrac)



