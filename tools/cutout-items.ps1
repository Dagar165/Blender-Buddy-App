param(
  [Parameter(Mandatory=$true)][string]$Path,
  [Parameter(Mandatory=$true)][string]$OutDir,
  [int]$FillT = 14,     # flood fill treats maxChannel <= this as background
  [int]$Lo = 5,         # alpha 0 at or below
  [int]$Hi = 26,        # alpha 255 at or above
  [int]$MinArea = 1500, # drop specks smaller than this
  [int]$Pad = 6,        # transparent margin around each crop
  [int]$GapClose = 0    # dilate/erode radius to close tiny notches (0 = off)
)

# Cuts objects off a BLACK backdrop and writes one transparent PNG per object.
#
# Why it works this way (same lessons as tools/cutout-sheet.ps1):
# - alpha is a RAMP, not a yes/no decision: a binary edge reads as stair-steps
#   on curved silhouettes and was the "torn outline" bug on the ghost art;
# - the brightness field is BLURRED before thresholding, otherwise JPEG noise
#   makes the edge flicker pixel by pixel;
# - flood fill comes from the border, so dark pixels INSIDE an object (the
#   glasses lenses read 23,18,38 - almost black) stay opaque;
# - edge colours are un-premultiplied: a JPEG over black already has the fade
#   baked in, and without dividing it back out every sprite keeps a dark fringe
#   that shows up on light backgrounds.

Add-Type -AssemblyName System.Drawing

$code = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class DarkCutter
{
  public static List<int[]> Cut(string path, string outDir, string prefix,
                                int fillT, int lo, int hi, int minArea, int pad, int gapClose)
  {
    Bitmap src = (Bitmap)Bitmap.FromFile(path);
    int w = src.Width, h = src.Height;
    Rectangle rect = new Rectangle(0, 0, w, h);
    BitmapData bd = src.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int stride = bd.Stride;
    byte[] buf = new byte[stride * h];
    Marshal.Copy(bd.Scan0, buf, 0, buf.Length);
    src.UnlockBits(bd);
    src.Dispose();

    int n = w * h;
    byte[] R = new byte[n], G = new byte[n], B = new byte[n];
    float[] V = new float[n];

    for (int y = 0; y < h; y++)
    {
      int row = y * stride;
      for (int x = 0; x < w; x++)
      {
        int i = row + x * 4, p = y * w + x;
        byte b = buf[i], g = buf[i + 1], r = buf[i + 2];
        R[p] = r; G[p] = g; B[p] = b;
        int mx = r; if (g > mx) mx = g; if (b > mx) mx = b;
        V[p] = mx;
      }
    }

    // Blur the brightness field so the threshold follows the drawn fade,
    // not the JPEG noise sitting on top of it.
    float[] tmp = new float[n];
    for (int pass = 0; pass < 2; pass++)
    {
      for (int y = 0; y < h; y++)
        for (int x = 0; x < w; x++)
        {
          float s = 0; int c = 0;
          for (int dy = -1; dy <= 1; dy++)
          {
            int yy = y + dy; if (yy < 0 || yy >= h) continue;
            for (int dx = -1; dx <= 1; dx++)
            {
              int xx = x + dx; if (xx < 0 || xx >= w) continue;
              s += V[yy * w + xx]; c++;
            }
          }
          tmp[y * w + x] = s / c;
        }
      Array.Copy(tmp, V, n);
    }

    // Flood fill the backdrop inward from the frame.
    bool[] outside = new bool[n];
    Stack<int> stack = new Stack<int>();
    for (int x = 0; x < w; x++)
    {
      if (V[x] <= fillT) { outside[x] = true; stack.Push(x); }
      int p = (h - 1) * w + x;
      if (V[p] <= fillT) { outside[p] = true; stack.Push(p); }
    }
    for (int y = 0; y < h; y++)
    {
      int p = y * w;
      if (V[p] <= fillT) { outside[p] = true; stack.Push(p); }
      p = y * w + w - 1;
      if (V[p] <= fillT) { outside[p] = true; stack.Push(p); }
    }
    while (stack.Count > 0)
    {
      int p = stack.Pop();
      int x = p % w, y = p / w;
      for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
        {
          int xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          int q = yy * w + xx;
          if (outside[q] || V[q] > fillT) continue;
          outside[q] = true; stack.Push(q);
        }
    }

    // Alpha: ramp where the backdrop meets the object, solid everywhere the
    // fill could not reach.
    byte[] A = new byte[n];
    float span = Math.Max(1, hi - lo);
    for (int p = 0; p < n; p++)
    {
      if (!outside[p]) { A[p] = 255; continue; }
      float t = (V[p] - lo) / span;
      if (t <= 0) A[p] = 0;
      else if (t >= 1) A[p] = 255;
      else A[p] = (byte)Math.Round(t * 255);
    }

    if (gapClose > 0) A = Close(A, w, h, gapClose);

    // Label the pieces (8-connected) so each object lands in its own file.
    int[] label = new int[n];
    for (int p = 0; p < n; p++) label[p] = -1;
    List<int[]> boxes = new List<int[]>();
    int next = 0;

    for (int p0 = 0; p0 < n; p0++)
    {
      if (A[p0] == 0 || label[p0] >= 0) continue;
      int id = next++;
      int minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
      label[p0] = id; stack.Push(p0);
      while (stack.Count > 0)
      {
        int p = stack.Pop();
        int x = p % w, y = p / w;
        area++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++)
          {
            int xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            int q = yy * w + xx;
            if (label[q] >= 0 || A[q] == 0) continue;
            label[q] = id; stack.Push(q);
          }
      }
      boxes.Add(new int[] { id, minX, minY, maxX, maxY, area });
    }

    // Big pieces first, so the numbering in the report is stable and readable.
    boxes.Sort(delegate(int[] a, int[] b) { return b[5].CompareTo(a[5]); });

    List<int[]> kept = new List<int[]>();
    int fileNo = 0;
    foreach (int[] box in boxes)
    {
      if (box[5] < minArea) continue;
      int id = box[0];
      int x0 = Math.Max(0, box[1] - pad), y0 = Math.Max(0, box[2] - pad);
      int x1 = Math.Min(w - 1, box[3] + pad), y1 = Math.Min(h - 1, box[4] + pad);
      int cw = x1 - x0 + 1, ch = y1 - y0 + 1;

      Bitmap outBmp = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
      BitmapData ob = outBmp.LockBits(new Rectangle(0, 0, cw, ch), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      byte[] obuf = new byte[ob.Stride * ch];

      for (int y = 0; y < ch; y++)
        for (int x = 0; x < cw; x++)
        {
          int p = (y0 + y) * w + (x0 + x);
          int i = y * ob.Stride + x * 4;
          if (label[p] != id) { obuf[i + 3] = 0; continue; }
          byte a = A[p];
          // Un-premultiply: the fade is baked against black in the source.
          float f = a > 0 ? 255f / a : 0f;
          obuf[i + 0] = Clamp(B[p] * f);
          obuf[i + 1] = Clamp(G[p] * f);
          obuf[i + 2] = Clamp(R[p] * f);
          obuf[i + 3] = a;
        }

      Marshal.Copy(obuf, 0, ob.Scan0, obuf.Length);
      outBmp.UnlockBits(ob);
      string name = string.Format("{0}{1:00}.png", prefix, ++fileNo);
      outBmp.Save(System.IO.Path.Combine(outDir, name), ImageFormat.Png);
      outBmp.Dispose();

      kept.Add(new int[] { fileNo, x0, y0, cw, ch, box[5] });
    }

    return kept;
  }

  static byte Clamp(float v)
  {
    if (v <= 0) return 0;
    if (v >= 255) return 255;
    return (byte)Math.Round(v);
  }

  static byte[] Close(byte[] A, int w, int h, int r)
  {
    byte[] d = Morph(A, w, h, r, true);
    return Morph(d, w, h, r, false);
  }

  static byte[] Morph(byte[] A, int w, int h, int r, bool dilate)
  {
    byte[] outA = new byte[A.Length];
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++)
      {
        byte best = dilate ? (byte)0 : (byte)255;
        for (int dy = -r; dy <= r; dy++)
        {
          int yy = y + dy; if (yy < 0 || yy >= h) continue;
          for (int dx = -r; dx <= r; dx++)
          {
            int xx = x + dx; if (xx < 0 || xx >= w) continue;
            byte v = A[yy * w + xx];
            if (dilate) { if (v > best) best = v; }
            else { if (v < best) best = v; }
          }
        }
        outA[y * w + x] = best;
      }
    return outA;
  }
}
'@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$result = [DarkCutter]::Cut($Path, $OutDir, "item-", $FillT, $Lo, $Hi, $MinArea, $Pad, $GapClose)

Write-Output ("cut {0} objects into {1}" -f $result.Count, $OutDir)
Write-Output "file  x     y     w     h     area"
foreach ($r in $result) {
  Write-Output ("{0,-5} {1,-5} {2,-5} {3,-5} {4,-5} {5}" -f $r[0], $r[1], $r[2], $r[3], $r[4], $r[5])
}
