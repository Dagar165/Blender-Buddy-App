import { useMemo } from "react";
import { useGameState, getStreakInfo } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  PET_PHRASES,
  getNextPetStage,
  getPetStage,
  type PetMood,
} from "@/lib/pet-config";
import { SHOP_ITEMS } from "@/lib/shop-config";

const getPetMood = (input: {
  todayCounted: boolean;
  atRisk: boolean;
  potionActive: boolean;
}): PetMood => {
  if (input.atRisk) return "worried";
  if (input.potionActive) return "potion";
  if (input.todayCounted) return "happy";
  return "idle";
};

// Slower, lower float when the ghost is worried — body language matters.
const MOOD_ANIMATION: Record<PetMood, { y: number[]; duration: number }> = {
  happy: { y: [0, -14, 0], duration: 2.4 },
  potion: { y: [0, -12, 0], duration: 2.8 },
  idle: { y: [0, -10, 0], duration: 3.2 },
  worried: { y: [0, -5, 0], duration: 4 },
};

export default function PetPage() {
  const {
    username,
    xp,
    level,
    inventory,
    streakDays,
    frozenDays,
    pendingClaims,
    potionActive,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
  } = useGameState();

  const streak = getStreakInfo(streakDays, pendingClaims, frozenDays);
  const mood = getPetMood({
    todayCounted: streak.todayCounted,
    atRisk: streak.atRisk,
    potionActive,
  });

  const phrase = useMemo(() => {
    const phrases = PET_PHRASES[mood];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }, [mood]);

  const stage = getPetStage(level);
  const nextStage = getNextPetStage(level);
  const animation = MOOD_ANIMATION[mood];

  const ownedItems = SHOP_ITEMS.filter((item) =>
    inventory.includes(item.name)
  );

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

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        <div className="flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-center mb-4"
          >
            <h1 className="text-3xl font-display font-bold text-primary drop-shadow-sm mb-1">
              Привет, {username}!
            </h1>
            <p className="text-slate-500 font-medium">Готов изучать Blender 3D?</p>
          </motion.div>

          <motion.div
            key={phrase}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative max-w-xs bg-white border border-slate-100 shadow-md shadow-slate-200/60 rounded-2xl px-4 py-2.5 mb-2"
          >
            <p className="text-sm font-bold text-slate-700 text-center">{phrase}</p>
            <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-white border-b border-r border-slate-100 rotate-45" />
          </motion.div>

          <motion.div
            initial={{ scale: 0.92, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="flex items-center justify-center"
          >
            <motion.div
              animate={{ y: animation.y }}
              transition={{
                duration: animation.duration,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="flex items-center justify-center"
              style={{ scale: stage.scale }}
            >
              <img
                src={stage.image}
                alt={stage.name}
                className="w-full max-w-[280px] md:max-w-[330px] h-auto select-none"
                style={{ filter: stage.aura }}
                draggable={false}
              />
            </motion.div>
          </motion.div>

          <div className="flex items-center gap-2 mt-1 mb-4">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-display font-bold text-slate-700">{stage.name}</span>
            {nextStage && (
              <span className="text-xs font-bold text-slate-400">
                · эволюция на {nextStage.fromLevel} ур.
              </span>
            )}
          </div>

          {ownedItems.length > 0 && (
            <div className="w-full max-w-sm bg-white/80 backdrop-blur p-4 rounded-3xl shadow-sm border border-slate-100 mb-4">
              <p className="text-xs font-bold text-slate-400 mb-2.5">
                Вещи призрака · {ownedItems.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {ownedItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      title={item.name}
                      className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-xl shadow-primary/5 border border-slate-100">
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
      </div>
    </motion.div>
  );
}
