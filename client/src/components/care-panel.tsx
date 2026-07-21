import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, ShoppingBag } from "lucide-react";
import { Link } from "wouter";
import { useGameState } from "@/hooks/use-game-state";
import {
  CARE_LOW,
  CARE_NEEDS,
  getNeedLevel,
  getSuppliesForNeed,
  type CareNeedId,
} from "@/lib/care-config";
import { hapticTap, hapticSuccess, hapticWarn } from "@/lib/haptics";

/**
 * Три кнопки ухода под комнатой призрака.
 *
 * Нарочно скромные: главная оранжевая кнопка на экране — задания, а это
 * фон повседневности. Но у просевшей потребности загорается точка, и её
 * видно краем глаза — именно она даёт повод заглянуть завтра.
 *
 * Нажатие открывает выбор припаса: ухаживать без припасов нельзя, они
 * покупаются за голду. Почему так — см. care-config.ts, правило экономики.
 */

// Шкалы тают минутами, а не секундами — пересчёта раз в минуту хватает.
const TICK_MS = 60_000;

export function CarePanel() {
  const care = useGameState((state) => state.care);
  const supplies = useGameState((state) => state.supplies);
  const careFor = useGameState((state) => state.careFor);

  const [, setTick] = useState(0);
  const [openNeed, setOpenNeed] = useState<CareNeedId | null>(null);
  const [usedEmoji, setUsedEmoji] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const handleUse = (needId: CareNeedId, supplyId: string, emoji: string) => {
    if (!careFor(needId, supplyId)) {
      hapticWarn();
      return;
    }

    hapticSuccess();
    setOpenNeed(null);
    setUsedEmoji(emoji);
    window.setTimeout(() => setUsedEmoji(null), 1200);
  };

  return (
    <div className="relative w-full max-w-sm mt-4">
      <div className="grid grid-cols-3 gap-2">
        {CARE_NEEDS.map((need) => {
          const level = getNeedLevel(care[need.id] ?? null, need.decayHours);
          const isLow = level < CARE_LOW;
          const owned = getSuppliesForNeed(need.id).reduce(
            (sum, supply) => sum + (supplies[supply.id] ?? 0),
            0
          );

          return (
            <button
              key={need.id}
              onClick={() => {
                hapticTap();
                setOpenNeed((current) => (current === need.id ? null : need.id));
              }}
              className={`relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 transition-all active:scale-95 ${
                openNeed === need.id
                  ? "bg-white border-primary/60 dark:bg-card dark:border-primary/60 shadow-sm"
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
                {need.title}
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

              <span
                className={`text-[10px] font-bold ${
                  owned > 0
                    ? "text-slate-400 dark:text-slate-500"
                    : "text-rose-400"
                }`}
              >
                {owned > 0 ? `припасов: ${owned}` : "нет припасов"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Что использовать */}
      <AnimatePresence>
        {openNeed && (
          <motion.div
            key={openNeed}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-2 rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card p-3 shadow-lg shadow-slate-200/50 dark:shadow-black/40"
          >
            <div className="space-y-2">
              {getSuppliesForNeed(openNeed).map((supply) => {
                const count = supplies[supply.id] ?? 0;

                return (
                  <button
                    key={supply.id}
                    onClick={() =>
                      count > 0 && handleUse(openNeed, supply.id, supply.emoji)
                    }
                    disabled={count === 0}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 border text-left transition-all active:scale-[0.98] ${
                      count > 0
                        ? "bg-slate-50 border-slate-200 dark:bg-muted dark:border-border"
                        : "bg-slate-50/50 border-dashed border-slate-200 dark:bg-muted/40 dark:border-border opacity-60"
                    }`}
                  >
                    <span className="text-lg leading-none">{supply.emoji}</span>

                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                        {supply.name}
                      </span>
                      <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                        +{supply.restores} к шкале
                      </span>
                    </span>

                    <span
                      className={`shrink-0 text-xs font-bold ${
                        count > 0
                          ? "text-slate-600 dark:text-slate-300"
                          : "text-slate-300 dark:text-slate-600"
                      }`}
                    >
                      {count} шт.
                    </span>
                  </button>
                );
              })}
            </div>

            <Link
              href="/shop"
              onClick={() => hapticTap()}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-primary dark:text-blue-300 border border-primary/30 dark:border-blue-400/30 active:scale-[0.98] transition-transform"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Купить припасы
              <Coins className="w-3.5 h-3.5 text-yellow-500" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Что скормили — короткий отклик, чтобы нажатие «прозвучало» */}
      <AnimatePresence>
        {usedEmoji && (
          <motion.span
            initial={{ opacity: 1, y: 0, scale: 0.8 }}
            animate={{ opacity: 0, y: -46, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl pointer-events-none"
          >
            {usedEmoji}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
