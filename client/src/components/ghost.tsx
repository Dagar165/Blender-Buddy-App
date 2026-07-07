import type { PetMood, PetStage } from "@/lib/pet-config";
import {
  ACCESSORIES,
  FACES,
  FACE_PALETTE,
  GHOST_BODY,
  SPARKLES,
  SPRITE_H,
  SPRITE_W,
  type Sprite,
} from "@/lib/pixel-sprites";

// The mascot is drawn as layered pixel sprites (SVG rects) — no image files,
// loads instantly, scales crisply, and clothing overlays share the same grid
// so they always line up with the body.

type PixelRun = { x: number; y: number; w: number; fill: string; key: string };

// Merge horizontal runs of the same color so we emit a handful of rects, not
// one per pixel.
function spriteRuns(sprite: Sprite, layerKey: string): PixelRun[] {
  const runs: PixelRun[] = [];

  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      const fill = sprite.palette[ch];
      if (!fill) {
        x += 1;
        continue;
      }

      let width = 1;
      while (x + width < row.length && row[x + width] === ch) width += 1;

      runs.push({ x, y, w: width, fill, key: `${layerKey}-${y}-${x}` });
      x += width;
    }
  });

  return runs;
}

export function Ghost({
  stage,
  mood = "idle",
  size = 240,
}: {
  stage: PetStage;
  mood?: PetMood;
  size?: number;
}) {
  const bodyPalette: Record<string, string> = {
    O: stage.bodyDark,
    B: stage.bodyLight,
    W: "#FFFFFF",
    K: "#22304a",
    P: "#F9A8D4",
  };

  const faceMood: PetMood = mood === "potion" ? "happy" : mood;

  const layers: Sprite[] = [
    { rows: GHOST_BODY, palette: bodyPalette },
    { rows: FACES[faceMood] ?? FACES.idle, palette: FACE_PALETTE },
    ACCESSORIES[stage.accessory],
  ];
  if (mood === "potion") layers.push(SPARKLES);

  const runs = layers.flatMap((layer, i) => spriteRuns(layer, `l${i}`));
  const height = (size * SPRITE_H) / SPRITE_W;

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {runs.map((r) => (
        <rect key={r.key} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
