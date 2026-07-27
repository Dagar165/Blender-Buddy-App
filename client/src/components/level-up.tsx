import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { hapticSuccess } from "@/lib/haptics";

// Обычное повышение уровня. Полноэкранный блокирующий момент нарочно оставлен
// за эволюцией — она редкая и потому ценная. Здесь короткая заметная плашка:
// видно, что уровень вырос, но она не перебивает то, чем ребёнок занят.
//
// ⚠️ Портал и `z-[80]` — чтобы плашку было видно и поверх открытой игры.
// Одного номера слоя мало: разбор в шапке `claim-notice.tsx`.

const VISIBLE_MS = 2600;

export function LevelUp({
  level,
  onDone,
}: {
  level: number | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!level) return;

    hapticSuccess();

    confetti({
      particleCount: 45,
      spread: 70,
      startVelocity: 28,
      origin: { y: 0.3 },
      colors: ["#3B82F6", "#F97316", "#FACC15"],
    });

    const timer = setTimeout(onDone, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [level, onDone]);

  return createPortal(
    <AnimatePresence>
      {level && (
        <motion.button
          key={level}
          onClick={onDone}
          initial={{ opacity: 0, y: -24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-3 pl-3 pr-5 py-3 rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border shadow-xl shadow-primary/20 dark:shadow-black/50"
        >
          <motion.span
            animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="w-11 h-11 shrink-0 rounded-xl bg-gradient-to-tr from-primary to-blue-300 text-white font-display font-bold text-lg flex items-center justify-center shadow-md"
          >
            {level}
          </motion.span>

          <span className="text-left">
            <span className="block font-display font-bold text-slate-800 dark:text-slate-100 leading-tight">
              Уровень {level}!
            </span>
            <span className="block text-xs font-bold text-slate-400 dark:text-slate-500">
              Призрак стал сильнее ✨
            </span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body
  );
}
