import { useEffect, useMemo, useState } from "react";
import { useGameState, getStreakInfo } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion, AnimatePresence } from "framer-motion";
import {
  PET_PHRASES,
  RETURN_AFTER_DAYS,
  RETURN_PHRASES,
  PET_STAGES,
  getNextPetStage,
  getPetStage,
  type PetMood,
} from "@/lib/pet-config";
import { Ghost } from "@/components/ghost";
import { SHOP_ITEMS } from "@/lib/shop-config";
import { TIP_VISIBLE_MS } from "@/lib/tips-config";

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

// Плавающее сердечко после поглаживания
type Heart = { id: number; x: number; withXp: boolean };

// Гизмо осей из угла 3D-окна Blender — просто украшение-отсылка
function AxisGizmo() {
  return (
    <svg
      className="absolute top-2.5 right-2.5 opacity-90 pointer-events-none"
      width="40"
      height="40"
      viewBox="0 0 46 46"
    >
      <circle cx="23" cy="23" r="22" className="fill-white/80 dark:fill-slate-900/60" />
      <line x1="23" y1="23" x2="38" y2="29" stroke="#e3402e" strokeWidth="1.7" />
      <line x1="23" y1="23" x2="10" y2="30" stroke="#6fa21c" strokeWidth="1.7" />
      <line x1="23" y1="23" x2="23" y2="7" stroke="#3b83bd" strokeWidth="1.7" />
      <circle cx="38" cy="29" r="4.4" fill="#e3402e" />
      <circle cx="10" cy="30" r="4.4" fill="#6fa21c" />
      <circle cx="23" cy="7" r="4.4" fill="#3b83bd" />
    </svg>
  );
}

export default function PetPage() {
  const {
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
    petGhost,
    markVisit,
  } = useGameState();

  const [hearts, setHearts] = useState<Heart[]>([]);
  // Совет по Blender вытесняет обычную фразу на несколько секунд.
  const [tip, setTip] = useState<string | null>(null);
  // Встреча после паузы — показывается один раз за визит.
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    const daysAway = markVisit();

    if (daysAway >= RETURN_AFTER_DAYS) {
      setGreeting(
        RETURN_PHRASES[Math.floor(Math.random() * RETURN_PHRASES.length)]
      );
    }
  }, [markVisit]);

  const handlePet = () => {
    const { granted, tip: freshTip } = petGhost();
    const id = Date.now() + Math.random();

    if (freshTip) {
      setGreeting(null);
      setTip(freshTip);
      window.setTimeout(() => setTip(null), TIP_VISIBLE_MS);
    }

    setHearts((current) => [
      ...current.slice(-5),
      { id, x: Math.round(Math.random() * 80 - 40), withXp: granted },
    ]);

    window.setTimeout(() => {
      setHearts((current) => current.filter((heart) => heart.id !== id));
    }, 1100);
  };

  const streak = getStreakInfo(streakDays, pendingClaims, frozenDays);
  const mood = getPetMood({
    todayCounted: streak.todayCounted,
    atRisk: streak.atRisk,
    potionActive,
  });

  const moodPhrase = useMemo(() => {
    const phrases = PET_PHRASES[mood];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }, [mood]);

  // Что призрак говорит прямо сейчас: совет важнее встречи, встреча — фразы.
  const phrase = tip ?? greeting ?? moodPhrase;

  const stage = getPetStage(level);
  const nextStage = getNextPetStage(level);
  const stageNumber = PET_STAGES.indexOf(stage) + 1;
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
      ? `Осталось ${xpToNextLevel} XP — их дают за задания`
      : "Максимальный уровень достигнут";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full bg-gradient-to-b from-blue-50 via-white to-blue-50/30 dark:from-[#101a2e] dark:via-[#0b1220] dark:to-[#0d1526]"
    >
      <TopBar />

      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="flex flex-col items-center">
          {/* Комната призрака — отсылка к 3D-окну Blender:
              сетка пола, гизмо осей, а призрак «выделен» оранжевым */}
          <div className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-700/60 bg-gradient-to-b from-sky-100 via-blue-50 to-slate-100 dark:from-[#1c2a44] dark:via-[#15203a] dark:to-[#101a30] shadow-xl shadow-primary/10">
            {/* Угол HUD, как в Blender: имя активного объекта */}
            <span className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/85 dark:bg-slate-900/70 border border-orange-200 dark:border-orange-500/40 rounded-full px-2.5 py-1 text-[10px] font-bold text-orange-600 dark:text-orange-300 select-none">
              <span className="w-2 h-2 rounded-[3px] bg-orange-500 shrink-0" />
              {stage.name}
            </span>
            <AxisGizmo />

            {/* Пол-сетка в перспективе */}
            <div
              className="absolute -left-1/3 -right-1/3 -bottom-2 h-[44%] pointer-events-none"
              style={{
                background:
                  "repeating-linear-gradient(90deg, rgba(59,130,246,.14) 0 1.5px, transparent 1.5px 46px), repeating-linear-gradient(0deg, rgba(59,130,246,.10) 0 1.5px, transparent 1.5px 30px)",
                transform: "perspective(340px) rotateX(58deg)",
                transformOrigin: "50% 100%",
              }}
            />

            {/* pt-14 — чтобы пузырь начинался ниже HUD слева и гизмо справа */}
            <div className="relative flex flex-col items-center pt-14 pb-12">
              <motion.div
                key={phrase}
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`relative max-w-[80%] border shadow-md rounded-2xl px-4 py-2.5 z-10 ${
                  tip
                    ? "bg-amber-50 border-amber-200 shadow-amber-200/50 dark:bg-amber-500/15 dark:border-amber-500/40 dark:shadow-black/40"
                    : "bg-white border-slate-100 shadow-slate-200/60 dark:bg-card dark:border-border dark:shadow-black/40"
                }`}
              >
                <p
                  className={`text-sm font-bold text-center ${
                    tip
                      ? "text-amber-700 dark:text-amber-200"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {tip && <span className="mr-1">💡</span>}
                  {phrase}
                </p>
                <div
                  className={`absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 border-b border-r rotate-45 ${
                    tip
                      ? "bg-amber-50 border-amber-200 dark:bg-amber-500/15 dark:border-amber-500/40"
                      : "bg-white border-slate-100 dark:bg-card dark:border-border"
                  }`}
                />
              </motion.div>

              <div className="relative flex items-center justify-center mt-3">
                {/* Сердечки от поглаживания */}
                <AnimatePresence>
                  {hearts.map((heart) => (
                    <motion.div
                      key={heart.id}
                      initial={{ opacity: 1, y: 0, scale: 0.7 }}
                      animate={{ opacity: 0, y: -70, scale: 1.15 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="absolute top-6 z-10 pointer-events-none text-lg font-bold text-rose-500"
                      style={{ left: `calc(50% + ${heart.x}px)` }}
                    >
                      {heart.withXp ? "❤️ +1 XP" : "❤️"}
                    </motion.div>
                  ))}
                </AnimatePresence>

                <motion.div
                  animate={{ y: animation.y }}
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    duration: animation.duration,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  onClick={handlePet}
                  className="flex items-center justify-center select-none cursor-pointer"
                  style={{
                    // Оранжевый контур «выбранного объекта», как в Blender
                    filter: "drop-shadow(0 0 2px rgba(249, 115, 22, 0.75))",
                  }}
                >
                  <Ghost
                    stage={stage}
                    mood={mood}
                    size={240}
                    overlays={ownedItems
                      .map((item) => item.overlay)
                      .filter((src): src is string => Boolean(src))}
                  />
                </motion.div>
              </div>

              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/85 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/70 rounded-full px-4 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-300 shadow-sm select-none">
                Нажми — погладь ❤️ +1 XP
              </span>
            </div>

          </div>

          <div className="flex items-center gap-2 mt-3 mb-4 text-xs font-bold text-slate-400 dark:text-slate-500">
            <span>Стадия {stageNumber} из {PET_STAGES.length}</span>
            {nextStage && <span>· эволюция на {nextStage.fromLevel} ур. ✨</span>}
          </div>

          {ownedItems.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mb-4 max-w-xs">
              {ownedItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    title={item.name}
                    className={`w-8 h-8 rounded-lg ${item.bg} ${item.color} flex items-center justify-center`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Полоса XP — как ползунок-значение в Blender: процент прямо в полосе */}
          <div className="w-full max-w-sm bg-white dark:bg-card p-4 rounded-3xl shadow-xl shadow-primary/5 border border-slate-100 dark:border-border">
            <div className="flex justify-between items-end mb-2 gap-4">
              <h3 className="font-display font-bold text-slate-700 dark:text-slate-200 text-base">
                До уровня {requiredForNextLevel > 0 ? level + 1 : level}
              </h3>
              <span className="text-sm font-bold text-primary whitespace-nowrap">
                {progressLabel}
              </span>
            </div>

            <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute top-0 left-0 h-full bg-gradient-to-b from-blue-400 to-primary rounded-l-lg"
              />
              <div className="absolute inset-0 flex items-center justify-between px-2.5 pointer-events-none">
                <span
                  className={`text-[11px] font-bold font-mono ${
                    xpProgress >= 16
                      ? "text-white drop-shadow-sm"
                      : "text-slate-500 dark:text-slate-300"
                  }`}
                >
                  {Math.round(xpProgress)}%
                </span>
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
              {subLabel}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
