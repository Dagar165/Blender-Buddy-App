import { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { getStreakInfo } from "@/game/streak";
import { TopBar } from "@/components/top-bar";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { hapticTap } from "@/lib/haptics";
import { Link } from "wouter";
import { CheckCircle, ChevronRight, Clock, Scroll } from "lucide-react";
import { getActiveQuestsForTab } from "@/lib/quests-rotation";
import { CarePanel } from "@/components/care-panel";
import {
  CARE_NEEDS,
  getCarePhrase,
  getNeedLevel,
  type CareNeedId,
} from "@/lib/care-config";
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
import { SHOP_ITEMS, getClothingSlot } from "@/lib/shop-config";
import { getWornOverlays, isItemWorn } from "@/game/wardrobe";
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

// Гизмо осей из угла 3D-окна Blender. Отсылка — но нажимаемая: под ней
// прячется маленький урок про X, Y и Z, который пригодится в самом Blender.
function AxisGizmo() {
  return (
    <svg
      className="opacity-90 pointer-events-none"
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
    equipped,
    streakDays,
    frozenDays,
    pendingClaims,
    dailyProgress,
    weeklyProgress,
    potionActive,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
    care,
    petGhost,
    markVisit,
  } = useGameState();

  const [hearts, setHearts] = useState<Heart[]>([]);
  // Подсказки в комнате: что за ступень пути и что за оси в углу.
  const [hint, setHint] = useState<"stage" | "axes" | null>(null);
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

  // Призрака можно крутить пальцем. Тестировщик: «отчаянно хочется покрутить
  // персонажа, интерфейс блендера располагает». Тянем — поворачивается и
  // наклоняется, отпускаем — пружинит обратно. Заодно это и есть тот самый
  // отклик, которого не хватало: приложение слушается пальца.
  const swing = useMotionValue(0);
  const rotateY = useTransform(swing, [-140, 140], [-26, 26]);
  const tilt = useTransform(swing, [-140, 140], [7, -7]);
  // Чтобы бросок пальцем не засчитался как поглаживание.
  const draggingRef = useRef(false);

  const openHint = (which: "stage" | "axes") => {
    hapticTap();
    setHint((current) => (current === which ? null : which));
  };

  const handlePet = () => {
    if (draggingRef.current) return;

    hapticTap();

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

  // Как призрак себя чувствует: считается от времени последнего ухода.
  const careLevels = useMemo(() => {
    const levels = {} as Record<CareNeedId, number>;

    for (const need of CARE_NEEDS) {
      levels[need.id] = getNeedLevel(care[need.id] ?? null, need.decayHours);
    }

    return levels;
  }, [care]);

  const carePhrase = useMemo(
    () => getCarePhrase(careLevels, Date.now() / 60000),
    [careLevels]
  );

  // Что призрак говорит прямо сейчас. Порядок важен: свежий совет по Blender
  // важнее всего, потом встреча после паузы, потом просьба поесть или
  // прибраться, и только потом дежурная фраза настроения.
  const phrase = tip ?? greeting ?? carePhrase ?? moodPhrase;

  const stage = getPetStage(level);
  const nextStage = getNextPetStage(level);
  const stageNumber = PET_STAGES.indexOf(stage) + 1;
  const animation = MOOD_ANIMATION[mood];

  const ownedItems = SHOP_ITEMS.filter((item) =>
    inventory.includes(item.name)
  );

  // Картинки надетых вещей: в порядке слоёв и с поправкой размера под стадию.
  const wornOverlays = useMemo(
    () => getWornOverlays(equipped, stage),
    [equipped, stage]
  );

  // Что делать прямо сейчас. Тестировщики говорили: «непонятно, куда тыкать
  // с первого взгляда» — главный экран красивый, но немой. Одна строка-кнопка
  // отвечает на этот вопрос и уводит туда, где происходит дело.
  const todo = useMemo(() => {
    const pendingDailyIds = pendingClaims
      .filter((claim) => claim.questType === "daily")
      .map((claim) => claim.questId);

    const quests = getActiveQuestsForTab(
      "daily",
      dailyProgress.cycleKey,
      weeklyProgress.cycleKey,
      weeklyProgress.weekDoneIds ?? [],
      pendingDailyIds
    );

    const waiting = quests.filter((quest) => {
      if (dailyProgress.completedIds.includes(quest.id)) return false;

      return !pendingClaims.some(
        (claim) =>
          claim.questId === quest.id &&
          claim.questType === "daily" &&
          claim.cycleKey === dailyProgress.cycleKey
      );
    });

    if (waiting.length > 0) {
      return {
        tone: "action" as const,
        text:
          waiting.length === 1
            ? `Осталось задание: ${waiting[0].title}`
            : `Сегодня ${waiting.length} задания — начни с первого`,
      };
    }

    const onReview = quests.some((quest) =>
      pendingClaims.some(
        (claim) =>
          claim.questId === quest.id && claim.cycleKey === dailyProgress.cycleKey
      )
    );

    return onReview
      ? { tone: "waiting" as const, text: "Куратор проверяет — награда придёт" }
      : { tone: "done" as const, text: "Задания дня сделаны. Красавчик!" };
  }, [
    dailyProgress.cycleKey,
    dailyProgress.completedIds,
    weeklyProgress.cycleKey,
    weeklyProgress.weekDoneIds,
    pendingClaims,
  ]);

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
            {/* Угол HUD, как в Blender: имя активного объекта.
                Нажимается — объясняет, что это за ступень пути */}
            <button
              onClick={() => openHint("stage")}
              className={`absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-white/85 dark:bg-slate-900/70 border rounded-full px-2.5 py-1 text-[10px] font-bold text-orange-600 dark:text-orange-300 select-none transition-transform active:scale-95 ${
                hint === "stage"
                  ? "border-orange-400 dark:border-orange-400"
                  : "border-orange-200 dark:border-orange-500/40"
              }`}
            >
              <span className="w-2 h-2 rounded-[3px] bg-orange-500 shrink-0" />
              {stage.name}
            </button>

            <button
              onClick={() => openHint("axes")}
              className="absolute top-2.5 right-2.5 z-20 rounded-full transition-transform active:scale-95"
              aria-label="Что это за оси"
            >
              <AxisGizmo />
            </button>

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

              {/* mt-9, а не mt-3: шляпа торчит выше макушки на 12% кадра,
                  и на прежнем отступе её кончик со звездой уезжал под пузырь
                  с репликой. Опускаем призрака, а не убираем пузырь. */}
              <div className="relative flex items-center justify-center mt-9">
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

                {/* Внешний слой парит, внутренний слушается пальца:
                    два разных transform на одном элементе конфликтуют */}
                <motion.div
                  animate={{ y: animation.y }}
                  transition={{
                    duration: animation.duration,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{ perspective: 700 }}
                >
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.55}
                    dragMomentum={false}
                    onDragStart={() => {
                      draggingRef.current = true;
                      hapticTap("soft");
                    }}
                    onDragEnd={() => {
                      // Небольшая пауза: палец отрывается позже, чем кончается
                      // перетаскивание, иначе бросок засчитается поглаживанием.
                      window.setTimeout(() => {
                        draggingRef.current = false;
                      }, 60);
                    }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePet}
                    className="flex items-center justify-center select-none cursor-pointer touch-pan-y"
                    style={{
                      x: swing,
                      rotateY,
                      rotate: tilt,
                      // Оранжевый контур «выбранного объекта», как в Blender
                      filter: "drop-shadow(0 0 2px rgba(249, 115, 22, 0.75))",
                    }}
                  >
                    <Ghost
                      stage={stage}
                      mood={mood}
                      size={240}
                      overlays={wornOverlays}
                    />
                  </motion.div>
                </motion.div>
              </div>

              <span className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white/85 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/70 rounded-full px-4 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-300 shadow-sm select-none">
                Нажми — погладь · потяни — покрути
              </span>
            </div>

            {/* Подсказки поверх комнаты: тап мимо — закрыть */}
            <AnimatePresence>
              {hint && (
                <motion.div
                  key={hint}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setHint(null)}
                  className="absolute inset-0 z-30 flex items-center justify-center px-4 bg-slate-900/45 backdrop-blur-[2px]"
                >
                  <motion.div
                    initial={{ scale: 0.92, y: 8 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.95 }}
                    transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                    className="w-full max-w-[17rem] rounded-2xl bg-white dark:bg-card border border-slate-200 dark:border-border shadow-xl p-4"
                  >
                    {hint === "stage" ? (
                      <>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-secondary mb-1">
                          Ступень {stageNumber} из {PET_STAGES.length} · путь творца
                        </p>
                        <h4 className="font-display font-bold text-slate-800 dark:text-slate-100 mb-1.5">
                          {stage.name}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {stage.about}
                        </p>
                        <p className="mt-2.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                          {nextStage
                            ? `Дальше: ${nextStage.name} на ${nextStage.fromLevel} уровне`
                            : "Это последняя ступень — выше некуда"}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-primary mb-1.5">
                          Оси координат
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2.5">
                          Такой значок висит в углу окна Blender и показывает,
                          куда смотрит сцена. Три оси — три направления:
                        </p>
                        <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                          <li className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#e3402e] shrink-0" />
                            <b className="font-mono">X</b> — вправо и влево
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#6fa21c] shrink-0" />
                            <b className="font-mono">Y</b> — вперёд и назад
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#3b83bd] shrink-0" />
                            <b className="font-mono">Z</b> — вверх и вниз
                          </li>
                        </ul>
                        <p className="mt-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 leading-snug">
                          В Blender нажми G, а потом X, Y или Z — объект поедет
                          строго вдоль этой оси и никуда не съедет.
                        </p>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CarePanel />

          {/* Единственная оранжевая кнопка главного экрана */}
          <Link
            href="/quests"
            onClick={() => hapticTap("medium")}
            className={`w-full max-w-sm mt-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-all active:scale-[0.98] ${
              todo.tone === "action"
                ? "bg-gradient-to-r from-secondary to-orange-400 border-transparent text-white shadow-lg shadow-secondary/30"
                : todo.tone === "waiting"
                  ? "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300"
                  : "bg-green-50 border-green-200 text-green-700 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-300"
            }`}
          >
            {todo.tone === "action" ? (
              <Scroll className="w-5 h-5 shrink-0" />
            ) : todo.tone === "waiting" ? (
              <Clock className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 shrink-0" />
            )}

            <span className="flex-1 min-w-0 text-sm font-bold leading-snug">
              {todo.text}
            </span>

            <ChevronRight className="w-5 h-5 shrink-0 opacity-70" />
          </Link>

          <div className="flex items-center gap-2 mt-4 mb-4 text-xs font-bold text-slate-400 dark:text-slate-500">
            <span>Стадия {stageNumber} из {PET_STAGES.length}</span>
            {nextStage && <span>· эволюция на {nextStage.fromLevel} ур. ✨</span>}
          </div>

          {/* Гардероб одной строкой: надетое — в цвете и с ободком, остальное
              лежит бледным. Пока картинок одежды нет, это единственное место,
              где видно, что именно сейчас на призраке. Переодеться — в магазине. */}
          {ownedItems.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mb-4 max-w-xs">
              {ownedItems.map((item) => {
                const Icon = item.icon;
                const worn = isItemWorn(equipped, item);

                return (
                  <div
                    key={item.id}
                    title={`${item.name} · ${getClothingSlot(item.slot).name}${
                      worn ? " · надето" : ""
                    }`}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      worn
                        ? `${item.bg} ${item.color} ring-2 ring-secondary`
                        : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500 opacity-70"
                    }`}
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
