import { useGameState } from "@/hooks/use-game-state";
import { Mascot } from "@/components/mascot";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";

const XP_PER_LEVEL = 100;

export default function PetPage() {
  const { username, xp } = useGameState();

  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpProgress = ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;

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

        <Mascot />

        <div className="w-full max-w-sm mt-12 bg-white p-6 rounded-3xl shadow-xl shadow-primary/5 border border-slate-100">
          <div className="flex justify-between items-end mb-3">
            <h3 className="font-display font-bold text-slate-700 text-lg">
              Следующий уровень
            </h3>
            <span className="text-sm font-bold text-primary">{xp} XP</span>
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
            <span>Уровень {level + 1}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
