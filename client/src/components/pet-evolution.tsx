import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { PetStage } from "@/lib/pet-config";
import { Ghost } from "@/components/ghost";
import { hapticSuccess } from "@/lib/haptics";
import { CommunityHint } from "@/components/community-hint";
import { EVOLUTION_LINES, pickCommunityLine } from "@/lib/community-config";

export type PetEvolutionEvent = {
  from: PetStage;
  to: PetStage;
};

// The transformation plays in three beats: the old form trembles, a flash of
// light, and the evolved form springs in. The button appears only at the end
// so the student watches the whole moment.
type Phase = "old" | "flash" | "new";

const FLASH_AT_MS = 1500;
const NEW_AT_MS = 1950;

function EvolutionScene({
  evolution,
  onClaim,
}: {
  evolution: PetEvolutionEvent;
  onClaim: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("old");

  useEffect(() => {
    const flashTimer = setTimeout(() => setPhase("flash"), FLASH_AT_MS);
    const newTimer = setTimeout(() => setPhase("new"), NEW_AT_MS);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(newTimer);
    };
  }, []);

  useEffect(() => {
    if (phase !== "new") return;

    hapticSuccess();

    confetti({
      particleCount: 130,
      spread: 100,
      origin: { y: 0.4 },
      colors: ["#3B82F6", "#A855F7", "#F97316", "#FACC15"],
    });

    const secondBurst = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 150,
        startVelocity: 30,
        origin: { y: 0.5 },
        colors: ["#A855F7", "#FACC15", "#FFFFFF"],
      });
    }, 300);

    return () => clearTimeout(secondBurst);
  }, [phase]);

  const isNew = phase === "new";

  return (
    <motion.div
      initial={{ scale: 0.7, y: 30, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.85, opacity: 0 }}
      transition={{ type: "spring", bounce: 0.45 }}
      className="bg-white dark:bg-card border border-transparent dark:border-border rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl"
    >
      {/* Отсылка к Blender: превращение подано как рендер новой формы */}
      <p
        className={`text-xs font-bold uppercase tracking-widest mb-2 font-mono transition-colors ${
          isNew ? "text-green-500 dark:text-green-400" : "text-slate-400 dark:text-slate-500"
        }`}
      >
        {isNew ? "Рендер завершён ✓" : "Рендерим новую форму…"}
      </p>

      <div className="relative h-52 flex items-center justify-center overflow-hidden mb-2">
        {!isNew ? (
          <motion.div
            key="old"
            className="select-none"
            style={{ scale: 0.92 }}
            animate={
              phase === "old"
                ? { x: [0, -3, 3, -4, 4, -2, 2, 0], rotate: [0, -2, 2, -2, 2, 0] }
                : { scale: 1.06, opacity: 0.4 }
            }
            transition={
              phase === "old"
                ? { duration: 0.6, repeat: Infinity }
                : { duration: 0.4 }
            }
          >
            <Ghost stage={evolution.from} mood="idle" size={185} />
          </motion.div>
        ) : (
          <motion.div
            key="new"
            className="select-none"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.7 }}
          >
            <Ghost stage={evolution.to} mood="happy" size={195} />
          </motion.div>
        )}

        {/* Вспышка превращения */}
        <AnimatePresence>
          {phase === "flash" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 2.2 }}
              exit={{ opacity: 0, scale: 2.6 }}
              transition={{ duration: 0.45 }}
              className="absolute inset-0 m-auto w-40 h-40 rounded-full bg-gradient-to-tr from-white via-fuchsia-100 to-amber-100 dark:from-slate-100 dark:via-fuchsia-300/70 dark:to-amber-200/70"
              style={{ boxShadow: "0 0 80px 50px rgba(255,255,255,0.95)" }}
            />
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {isNew ? (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 mb-1">
              Эволюция! {evolution.to.name}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Твои задания сделали своё дело — {evolution.from.name} вырос!
            </p>

            <button
              onClick={onClaim}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-lg text-white bg-gradient-to-r from-fuchsia-500 to-purple-500 shadow-lg shadow-fuchsia-300/50 active:scale-95 transition-transform"
            >
              Круть! 🎉
            </button>

            {/* Эволюция бывает четыре раза за всю игру — приглашение здесь
                не примелькается, а рост как повод звучит честно */}
            <CommunityHint
              line={pickCommunityLine(
                EVOLUTION_LINES,
                evolution.to.fromLevel
              )}
              className="mt-3"
            />
          </motion.div>
        ) : (
          <motion.p
            key="suspense"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm font-bold text-slate-500 dark:text-slate-400 py-8"
          >
            Что-то происходит…✨
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function PetEvolution({
  evolution,
  onClaim,
}: {
  evolution: PetEvolutionEvent | null;
  onClaim: () => void;
}) {
  return (
    <AnimatePresence>
      {evolution && (
        <motion.div
          key={evolution.to.fromLevel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-8 bg-slate-900/70 backdrop-blur-sm"
        >
          <EvolutionScene evolution={evolution} onClaim={onClaim} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
