import { motion } from "framer-motion";
import { Coins, Sparkles, X } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { PET_STAGES } from "@/lib/pet-config";
import { LEVEL_THRESHOLDS } from "@/game/level";
import { hapticSelect, hapticSuccess, hapticTap } from "@/lib/haptics";

/**
 * Панель владельца: посмотреть игру на любом уровне, не проходя её.
 * Кто её видит и как открыть — написано в lib/dev-config.ts.
 * Ученикам не показывается и в обычный игровой цикл не вмешивается.
 */
export function DevPanel({ onClose }: { onClose: () => void }) {
  const {
    level,
    gold,
    telegramUserId,
    devSetLevel,
    devSetGold,
    devReplayEvolution,
  } = useGameState();

  const maxLevel = LEVEL_THRESHOLDS.length;

  const setLevel = (next: number) => {
    hapticSelect();
    devSetLevel(next);
  };

  const setGold = (next: number) => {
    hapticTap();
    devSetGold(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-md bg-white dark:bg-card rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-border shadow-xl p-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-display font-bold text-lg text-slate-800 dark:text-slate-100">
            Панель владельца
          </h2>
          <button
            onClick={onClose}
            className="ml-auto p-2 -m-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 mb-5 font-mono">
          Твой Telegram ID:{" "}
          <span className="text-slate-600 dark:text-slate-300 font-bold">
            {telegramUserId ?? "не виден вне Telegram"}
          </span>
        </p>

        {/* Уровень */}
        <div className="mb-6">
          <div className="flex items-baseline mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Уровень
            </span>
            <span className="ml-auto font-mono font-bold text-2xl text-slate-800 dark:text-slate-100">
              {level}
            </span>
          </div>

          <input
            type="range"
            min={1}
            max={maxLevel}
            value={level}
            onChange={(event) => setLevel(Number(event.target.value))}
            className="w-full accent-primary mb-3"
          />

          <div className="grid grid-cols-5 gap-1.5">
            {PET_STAGES.map((stage) => {
              const isActive =
                level >= stage.fromLevel &&
                (PET_STAGES.find((next) => next.fromLevel > stage.fromLevel)
                  ?.fromLevel ?? Infinity) > level;

              return (
                <button
                  key={stage.fromLevel}
                  onClick={() => setLevel(stage.fromLevel)}
                  className={`py-2 px-1 rounded-xl border text-center transition-colors ${
                    isActive
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-slate-50 dark:bg-muted border-slate-200 dark:border-border text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span className="block font-mono text-sm font-bold">
                    {stage.fromLevel}
                  </span>
                  <span className="block text-[10px] leading-tight truncate">
                    {stage.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Голда */}
        <div className="mb-6">
          <div className="flex items-baseline mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Голда
            </span>
            <span className="ml-auto flex items-center gap-1.5 font-mono font-bold text-2xl text-slate-800 dark:text-slate-100">
              {gold}
              <Coins className="w-5 h-5 text-amber-400" />
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "+1 000", value: gold + 1000 },
              { label: "+10 000", value: gold + 10000 },
              { label: "99 999", value: 99999 },
              { label: "0", value: 0 },
            ].map((option) => (
              <button
                key={option.label}
                onClick={() => setGold(option.value)}
                className="py-2 rounded-xl bg-slate-50 dark:bg-muted border border-slate-200 dark:border-border font-mono text-sm font-bold text-slate-600 dark:text-slate-300"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            hapticSuccess();
            devReplayEvolution();
            onClose();
          }}
          className="w-full py-3 flex items-center justify-center gap-2 rounded-2xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-600 dark:text-violet-300 font-bold"
        >
          <Sparkles className="w-4 h-4" /> Показать эволюцию заново
        </button>

        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          Изменения сразу пишутся в облако Telegram, поэтому переживают
          перезапуск и видны на других устройствах. Задания, серия и достижения
          не трогаются.
        </p>
      </motion.div>
    </div>
  );
}
