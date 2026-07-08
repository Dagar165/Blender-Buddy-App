import { motion } from "framer-motion";
import type { PetMood, PetStage } from "@/lib/pet-config";

// The mascot is a transparent-background image with clothing overlays drawn
// on the SAME canvas template, so layers line up and scale together
// automatically. Emotion effects float on top so the base art stays static.

// Заглушка-картинка широкоформатная с большими прозрачными полями — персонаж
// занимает лишь треть кадра, поэтому увеличиваем изображение внутри рамки.
// КОГДА ПРИДУТ НОВЫЕ КВАДРАТНЫЕ КАРТИНКИ (персонаж во весь кадр) — поставить 1.
const IMAGE_ZOOM = 1.45;

export function Ghost({
  stage,
  mood = "idle",
  size = 280,
  overlays = [],
}: {
  stage: PetStage;
  mood?: PetMood;
  size?: number;
  overlays?: string[];
}) {
  return (
    <div className="relative" style={{ width: size }}>
      <img
        src={stage.image}
        alt={stage.name}
        draggable={false}
        className="w-full h-auto select-none"
        style={{ filter: stage.aura, transform: `scale(${IMAGE_ZOOM})` }}
      />

      {overlays.map((src) => (
        <img
          key={src}
          src={src}
          draggable={false}
          className="absolute inset-0 w-full h-auto select-none pointer-events-none"
          style={{ transform: `scale(${IMAGE_ZOOM})` }}
        />
      ))}

      {/* Эффекты эмоций поверх картинки */}
      {mood === "worried" && (
        <motion.span
          className="absolute top-[6%] right-[16%] text-2xl pointer-events-none"
          animate={{ y: [0, 7, 0], opacity: [0.9, 0.45, 0.9] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          💧
        </motion.span>
      )}

      {mood === "potion" && (
        <>
          <motion.span
            className="absolute top-[10%] left-[14%] text-2xl pointer-events-none"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          >
            ✨
          </motion.span>
          <motion.span
            className="absolute top-[34%] right-[10%] text-xl pointer-events-none"
            animate={{ opacity: [1, 0.2, 1], scale: [1.15, 0.8, 1.15] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ✨
          </motion.span>
        </>
      )}

      {mood === "happy" && (
        <motion.span
          className="absolute top-[4%] left-[16%] text-xl pointer-events-none"
          animate={{ y: [0, -6, 0], rotate: [-10, 10, -10] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          🎵
        </motion.span>
      )}
    </div>
  );
}
