import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import ghostLevel1 from "@/assets/mascot/ghost-level-1.png";

export default function PetPage() {
  const {
    username,
    xp,
    level,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
  } = useGameState();

  const progressLabel =
    requiredForNextLevel > 0
      ? `${progressInLevel} / ${requiredForNextLevel} XP`
      : "MAX";

  const subLabel =
    requiredForNextLevel > 0
      ? `До следующего уровня: ${xpToNextLevel} XP`
      : "Максимальный уровень достигнут";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full bg-gradient-to-b from-blue-50 via-white to-blue-50/30"
    >
      <TopBar />

      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-display font-bold text-primary drop-shadow-sm mb-1">
            Привет, {username}!
          </h1>
          <p className="text-slate-500 font-medium">Готов изучать Blender 3D?</p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.92, y: 8, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          <img
            src={ghostLevel1}
            alt="Маскот первого уровня"
            className="w-full max-w-[260px] md:max-w-[300px] h-auto select-none drop-shadow-[0_16px_32px_rgba(59,130,246,0.18)]"
            draggable={false}
          />
        </motion.div>

        <div className="w-full max-w-sm mt-12 bg-white p-6 rounded-3xl shadow-xl shadow-primary/5 border border-slate-100">
          <div className="flex justify-between items-end mb-2 gap-4">
            <h3 className="font-display font-bold text-slate-700 text-lg">
              Следующий уровень
            </h3>
            <span className="text-sm font-bold text-primary whitespace-nowrap">
              {progressLabel}
            </span>
          </div>

          <div className="mb-1 text-xs text-slate-400 font-medium">
            Всего XP: {xp}
          </div>

          <div className="mb-3 text-xs text-slate-400 font-medium">
            {subLabel}
          </div>

          <div className="relative h-6 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpProgress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-blue-400 rounded-full"
            >
              <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30" />
            </motion.div>
          </div>

          <div className="flex justify-between mt-2 text-xs font-bold text-slate-400">
            <span>Уровень {level}</span>
            <span>Уровень {requiredForNextLevel > 0 ? level + 1 : level}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
