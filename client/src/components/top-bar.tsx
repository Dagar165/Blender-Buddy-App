import { useGameState, getStreakInfo } from "@/hooks/use-game-state";
import { Coins, Flame } from "lucide-react";

export function TopBar() {
  const { level, gold, streakDays, frozenDays, pendingClaims } = useGameState();
  const streak = getStreakInfo(streakDays, pendingClaims, frozenDays);

  const flameColor = streak.todayCounted
    ? "text-orange-500"
    : streak.atRisk
      ? "text-amber-400"
      : "text-slate-300 dark:text-slate-600";

  const pill =
    "flex items-center gap-2 bg-white/80 dark:bg-card/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-slate-100 dark:border-border";

  return (
    <div className="flex justify-between items-center px-6 py-4 pt-6 bg-transparent">
      <div className={pill}>
        <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-display font-bold shadow-md shadow-primary/30">
          {level}
        </div>
        <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">Уровень</span>
      </div>

      <div className={`${pill} !px-3 !gap-1`}>
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
      </div>

      <div className={pill}>
        <span className="font-bold text-slate-700 dark:text-slate-200">{gold}</span>
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Голда</span>
        <Coins className="w-6 h-6 text-yellow-500 drop-shadow-sm" fill="currentColor" />
      </div>
    </div>
  );
}
