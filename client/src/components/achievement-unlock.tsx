import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import type { AchievementDefinition } from "@/lib/achievements-config";

// Full-screen "you earned a medal" moment: dark backdrop, centered card,
// stays until the student claims it with the button.
export function AchievementUnlock({
  achievement,
  remainingCount,
  onClaim,
}: {
  achievement: AchievementDefinition | null;
  remainingCount: number;
  onClaim: () => void;
}) {
  const achievementId = achievement?.id;

  useEffect(() => {
    if (!achievementId) return;

    confetti({
      particleCount: 110,
      spread: 95,
      origin: { y: 0.35 },
      colors: ["#3B82F6", "#F97316", "#FACC15", "#A855F7"],
    });

    const secondBurst = setTimeout(() => {
      confetti({
        particleCount: 55,
        spread: 140,
        startVelocity: 32,
        origin: { y: 0.45 },
        colors: ["#F97316", "#FACC15", "#FFFFFF"],
      });
    }, 280);

    return () => clearTimeout(secondBurst);
  }, [achievementId]);

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          key={achievement.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-8 bg-slate-900/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.45 }}
            className="bg-white rounded-3xl p-6 w-full max-w-xs text-center shadow-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
              Новое достижение!
            </p>

            <motion.div
              animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-tr from-amber-100 to-yellow-50 border-4 border-amber-200 flex items-center justify-center shadow-lg shadow-amber-200/60"
            >
              <span className="text-5xl leading-none">{achievement.emoji}</span>
            </motion.div>

            <h2 className="text-2xl font-display font-bold text-slate-800 mb-1">
              {achievement.title}
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              {achievement.description}
            </p>

            <button
              onClick={onClaim}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-lg text-white bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-orange-300/50 active:scale-95 transition-transform"
            >
              Круть! 🎉
            </button>

            {remainingCount > 0 && (
              <p className="text-xs font-bold text-slate-400 mt-3">
                …и ещё {remainingCount} 🏅
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
