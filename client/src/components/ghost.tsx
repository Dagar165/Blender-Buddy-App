import { motion } from "framer-motion";
import type { PetMood, PetStage } from "@/lib/pet-config";
import { CLOTHING_FRAME, GHOST_LAYER } from "@/lib/shop-config";
import type { WornOverlay } from "@/game/wardrobe";

// The mascot is a transparent-background image with clothing overlays drawn
// on the SAME canvas template, so layers line up and scale together
// automatically. Emotion effects float on top so the base art stays static.

// Картинки — квадратные, персонаж занимает ~80% высоты холста (спецификация).
// Новые файлы перед подключением прогонять через tools/cutout-mascot.ps1 —
// тогда никакого CSS-зума не нужно (зум ломал нажатие на iOS).

// Одежда различается только слоем (`layer` в shop-config): шляпа поверх
// наушников, наушники поверх очков. Сам призрак стоит на слое GHOST_LAYER —
// то, что ниже, рисуется ЗА ним, так ранец оказывается за спиной, а не поверх
// груди. z-index тут обязателен: без него любая абсолютная картинка всплывает
// над обычной, и «за спиной» не получилось бы в принципе.
//
// Холст одежды ШИРЕ квадрата призрака (CLOTHING_FRAME) и прижат к его низу:
// над макушкой у картинок призрака всего 12% высоты, а шляпе нужен запас.
// Поэтому вещи и позиционируются от НИЗА, а не через inset-0.
const OVERLAY_WIDTH = `${CLOTHING_FRAME * 100}%`;
const OVERLAY_LEFT = `${((1 - CLOTHING_FRAME) / 2) * 100}%`;

export function Ghost({
  stage,
  mood = "idle",
  size = 280,
  overlays = [],
}: {
  stage: PetStage;
  mood?: PetMood;
  size?: number;
  overlays?: WornOverlay[];
}) {
  return (
    <div className="relative" style={{ width: size }}>
      {overlays.map((overlay) => (
        <img
          key={overlay.itemId}
          src={overlay.src}
          draggable={false}
          className="absolute h-auto select-none pointer-events-none"
          style={{
            width: OVERLAY_WIDTH,
            left: OVERLAY_LEFT,
            bottom: 0,
            zIndex: overlay.layer,
            // Сначала масштаб вокруг середины головы, потом сдвиг — CSS читает
            // список справа налево, а сдвиг мерится в исходном размере
            // элемента, поэтому масштаб на него не влияет.
            transform: `translate(${overlay.dxPercent}%, ${overlay.dyPercent}%) scale(${overlay.scale})`,
            transformOrigin: overlay.transformOrigin,
          }}
        />
      ))}

      <img
        src={stage.image}
        alt={stage.name}
        draggable={false}
        className="relative w-full h-auto select-none"
        style={{ filter: stage.aura, zIndex: GHOST_LAYER }}
      />

      {/* Эффекты эмоций поверх всего: z-20 выше самого верхнего слоя одежды,
          иначе шапка накрыла бы слезинку и нотку в углах кадра */}
      {mood === "worried" && (
        <motion.span
          className="absolute z-20 top-[6%] right-[16%] text-2xl pointer-events-none"
          animate={{ y: [0, 7, 0], opacity: [0.9, 0.45, 0.9] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          💧
        </motion.span>
      )}

      {mood === "potion" && (
        <>
          <motion.span
            className="absolute z-20 top-[10%] left-[14%] text-2xl pointer-events-none"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ✨
          </motion.span>
          <motion.span
            className="absolute z-20 top-[34%] right-[10%] text-xl pointer-events-none"
            animate={{ opacity: [1, 0.2, 1], scale: [1.15, 0.8, 1.15] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ✨
          </motion.span>
        </>
      )}

      {mood === "happy" && (
        <motion.span
          className="absolute z-20 top-[4%] left-[16%] text-xl pointer-events-none"
          animate={{ y: [0, -6, 0], rotate: [-10, 10, -10] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          🎵
        </motion.span>
      )}
    </div>
  );
}
