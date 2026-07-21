import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import {
  CARE_LOW,
  CARE_NEEDS,
  getNeedLevel,
  type CareNeedId,
} from "@/lib/care-config";
import { hapticTap, hapticSuccess } from "@/lib/haptics";

/**
 * Три кнопки ухода под комнатой призрака.
 *
 * Нарочно скромные: главная оранжевая кнопка на экране — задания, а это
 * фон повседневности. Но у просевшей потребности загорается точка, и её
 * видно краем глаза — именно она даёт повод заглянуть завтра.
 */

// Шкалы тают минутами, а не секундами — пересчёта раз в минуту хватает.
const TICK_MS = 60_000;

type Flash = { id: number; needId: CareNeedId; gold: number };

export function CarePanel() {
  const care = useGameState((state) => state.care);
  const careFor = useGameState((state) => state.careFor);

  const [, setTick] = useState(0);
  const [flashes, setFlashes] = useState<Flash[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const handleCare = (needId: CareNeedId) => {
    const { goldGranted } = careFor(needId);

    if (goldGranted > 0) hapticSuccess();
    else hapticTap();

    const id = Date.now();
    setFlashes((current) => [...current.slice(-2), { id, needId, gold: goldGranted }]);
    window.setTimeout(() => {
      setFlashes((current) => current.filter((flash) => flash.id !== id));
    }, 1200);
  };

  return (
    <div className="w-full max-w-sm mt-4 grid grid-cols-3 gap-2">
      {CARE_NEEDS.map((need) => {
        const level = getNeedLevel(care[need.id] ?? null, need.decayHours);
        const isLow = level < CARE_LOW;
        const isFull = level >= 95;
        const flash = flashes.find((entry) => entry.needId === need.id);

        return (
          <button
            key={need.id}
            onClick={() => handleCare(need.id)}
            disabled={isFull}
            className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-all active:scale-95 ${
              isFull
                ? "bg-slate-50 border-slate-100 dark:bg-muted/50 dark:border-border opacity-60"
                : isLow
                  ? "bg-white border-amber-300 dark:bg-card dark:border-amber-500/50 shadow-sm"
                  : "bg-white border-slate-200 dark:bg-card dark:border-border shadow-sm"
            }`}
          >
            {/* Точка «мне тут нужно внимание» */}
            {isLow && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}

            <span className="text-xl leading-none">{need.emoji}</span>

            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {isFull ? need.title : need.action}
            </span>

            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                animate={{ width: `${level}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`h-full rounded-full ${
                  level >= 60
                    ? "bg-green-400"
                    : level >= CARE_LOW
                      ? "bg-amber-400"
                      : "bg-rose-400"
                }`}
              />
            </div>

            <AnimatePresence>
              {flash && (
                <motion.span
                  key={flash.id}
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 0, y: -34 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1, ease: "easeOut" }}
                  className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 whitespace-nowrap text-xs font-bold text-yellow-600 dark:text-yellow-400 pointer-events-none"
                >
                  {flash.gold > 0 ? (
                    <>
                      +{flash.gold} <Coins className="w-3 h-3" />
                    </>
                  ) : (
                    <span className="text-rose-500">❤️</span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
