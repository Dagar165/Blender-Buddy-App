import { useState } from "react";
import { useGameState, getStreakInfo } from "@/hooks/use-game-state";
import { Coins, Flame, Snowflake } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { hapticSelect } from "@/lib/haptics";

/**
 * Верхняя панель: уровень, серия, голда.
 *
 * Цифры сами по себе ничего не объясняют — новый человек видит «3» и не знает,
 * много это или мало и что с этим делать. Поэтому каждая плашка нажимается
 * и разворачивает короткую подсказку: сколько осталось до уровня, что даёт
 * серия, на что тратится голда. Открыта всегда одна — иначе это уже не
 * подсказка, а нагромождение.
 */

type Pill = "level" | "streak" | "gold";

export function TopBar() {
  const {
    level,
    gold,
    streakDays,
    frozenDays,
    pendingClaims,
    streakFreezes,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
  } = useGameState();

  const [open, setOpen] = useState<Pill | null>(null);

  const streak = getStreakInfo(streakDays, pendingClaims, frozenDays);
  const isMaxLevel = requiredForNextLevel <= 0;

  const toggle = (pill: Pill) => {
    hapticSelect();
    setOpen((current) => (current === pill ? null : pill));
  };

  const flameColor = streak.todayCounted
    ? "text-orange-500"
    : streak.atRisk
      ? "text-amber-400"
      : "text-slate-300 dark:text-slate-600";

  const pill =
    "flex items-center gap-2 bg-white/80 dark:bg-card/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border transition-colors active:scale-95";
  const pillIdle = "border-slate-100 dark:border-border";
  const pillOpen = "border-primary/50 dark:border-primary/60";

  return (
    <div className="relative z-40">
      <div className="flex justify-between items-center px-6 py-4 pt-6 bg-transparent">
        <button
          onClick={() => toggle("level")}
          className={`${pill} ${open === "level" ? pillOpen : pillIdle}`}
        >
          <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-display font-bold shadow-md shadow-primary/30">
            {level}
          </div>
          <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
            Уровень
          </span>
        </button>

        <button
          onClick={() => toggle("streak")}
          className={`${pill} !px-3 !gap-1 ${
            open === "streak" ? pillOpen : pillIdle
          }`}
        >
          <Flame
            className={`w-6 h-6 drop-shadow-sm ${flameColor}`}
            fill="currentColor"
          />
          <span
            className={`font-bold ${
              streak.current > 0
                ? "text-slate-700 dark:text-slate-200"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {streak.current}
          </span>
        </button>

        <button
          onClick={() => toggle("gold")}
          className={`${pill} ${open === "gold" ? pillOpen : pillIdle}`}
        >
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {gold}
          </span>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
            Голда
          </span>
          <Coins
            className="w-6 h-6 text-yellow-500 drop-shadow-sm"
            fill="currentColor"
          />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Прозрачная подложка: тап мимо закрывает подсказку */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(null)}
              aria-hidden
            />

            <motion.div
              key={open}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute left-4 right-4 -mt-1 z-20 rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border shadow-xl shadow-slate-300/40 dark:shadow-black/50 p-4"
            >
              {open === "level" && (
                <>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">
                    {isMaxLevel
                      ? `Уровень ${level} — максимальный`
                      : `До ${level + 1} уровня: ${xpToNextLevel} XP`}
                  </p>

                  {!isMaxLevel && (
                    <div className="relative h-2.5 my-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-primary rounded-full"
                        style={{ width: `${xpProgress}%` }}
                      />
                    </div>
                  )}

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                    {isMaxLevel
                      ? "Дальше расти некуда — можно просто получать удовольствие."
                      : `Набрано ${progressInLevel} из ${requiredForNextLevel} XP. Опыт дают задания, квиз и поглаживания призрака.`}
                  </p>
                </>
              )}

              {open === "streak" && (
                <>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">
                    {streak.current === 0
                      ? "Серия не начата"
                      : `Серия: ${streak.current} дней подряд`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                    {streak.current === 0
                      ? "Сделай задание дня — огонёк загорится. Каждый следующий день добавляет +5% к наградам."
                      : streak.bonusPercent > 0
                        ? `Все награды идут с надбавкой +${streak.bonusPercent}%. Пропустишь день — серия сгорит и надбавка обнулится.`
                        : "Продолжи завтра — начнёт капать надбавка к наградам."}
                  </p>

                  {streakFreezes > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                      <Snowflake className="w-3.5 h-3.5" />
                      Заморозок в запасе: {streakFreezes} — сработают сами
                    </p>
                  )}
                </>
              )}

              {open === "gold" && (
                <>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-1">
                    У тебя {gold} голды
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                    Тратится в «Магазине»: одежда призраку, заморозка серии на
                    случай пропуска и зелье ×2 на удвоение награды.
                  </p>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
