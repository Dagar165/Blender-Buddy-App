import { useGameState } from "@/hooks/use-game-state";
import { Coins, Star } from "lucide-react";

export function TopBar() {
  const { level, gold } = useGameState();

  return (
    <div className="flex justify-between items-center px-6 py-4 pt-6 bg-transparent">
      <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
        <div className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center font-display font-bold shadow-md shadow-primary/30">
          {level}
        </div>
        <span className="font-bold text-slate-700 text-sm">Уровень</span>
      </div>

      <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
        <span className="font-bold text-slate-700">{gold}</span>
        <span className="text-xs font-bold text-slate-500">Голда</span>
        <Coins className="w-6 h-6 text-yellow-500 drop-shadow-sm" fill="currentColor" />
      </div>
    </div>
  );
}
