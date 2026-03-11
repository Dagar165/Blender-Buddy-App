import { useEffect, useRef, useState } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Coins, Target } from "lucide-react";

type QuestItem = {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  goldReward: number;
};

const DAILY_QUESTS: QuestItem[] = [
  {
    id: "daily-apple",
    title: "Смоделируй яблоко",
    description:
      "Используй Subdivision Surface, чтобы сделать аккуратное лоу-поли яблоко.",
    xpReward: 50,
    goldReward: 20,
  },
  {
    id: "daily-extrude",
    title: "Потренируй Extrude",
    description:
      "Сделай простую форму из куба через Extrude и пару дополнительных граней.",
    xpReward: 70,
    goldReward: 30,
  },
  {
    id: "daily-material",
    title: "Добавь материал",
    description:
      "Назначь объекту материал и настрой базовый цвет, roughness и metallic.",
    xpReward: 60,
    goldReward: 25,
  },
];

const WEEKLY_QUESTS: QuestItem[] = [
  {
    id: "weekly-prop",
    title: "Собери мини-проп",
    description:
      "Сделай один законченный объект: кружку, ящик, лампу или любой другой простой prop.",
    xpReward: 180,
    goldReward: 90,
  },
  {
    id: "weekly-scene",
    title: "Оформи мини-сцену",
    description:
      "Собери небольшую сцену из нескольких объектов, добавь свет и базовую композицию.",
    xpReward: 220,
    goldReward: 120,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function QuestCard({
  quest,
  isCompleted,
  onComplete,
}: {
  quest: QuestItem;
  isCompleted: boolean;
  onComplete: (quest: QuestItem) => void;
}) {
  return (
    <motion.div
      variants={item}
      className={`p-5 rounded-3xl border-2 transition-all ${
        isCompleted
          ? "bg-white border-green-100 opacity-60"
          : "bg-white border-transparent shadow-lg shadow-slate-200/50 hover:border-primary/20"
      }`}
    >
      <div className="flex justify-between items-start mb-2 gap-3">
        <h3 className="font-display font-bold text-lg text-slate-800">
          {quest.title}
        </h3>
        {isCompleted && <CheckCircle className="text-green-500 w-6 h-6 shrink-0" />}
      </div>

      <p className="text-slate-500 text-sm leading-relaxed mb-4">
        {quest.description}
      </p>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          <span className="flex items-center gap-1 bg-blue-50 text-primary px-3 py-1 rounded-xl text-xs font-bold">
            +{quest.xpReward} XP
          </span>
          <span className="flex items-center gap-1 bg-yellow-50 text-yellow-600 px-3 py-1 rounded-xl text-xs font-bold">
            +{quest.goldReward} <Coins className="w-3 h-3" />
          </span>
        </div>

        <button
          onClick={() => !isCompleted && onComplete(quest)}
          disabled={isCompleted}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            isCompleted
              ? "bg-slate-100 text-slate-400"
              : "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30 hover:shadow-lg"
          }`}
        >
          {isCompleted ? "Готово" : "Выполнить"}
        </button>
      </div>
    </motion.div>
  );
}

function getCompletedCount(quests: QuestItem[], completedIds: string[]) {
  return quests.filter((quest) => completedIds.includes(quest.id)).length;
}

export default function QuestsPage() {
  const {
    dailyProgress,
    weeklyProgress,
    completeDailyQuest,
    completeWeeklyQuest,
    refreshQuestCycles,
  } = useGameState();

  const [showRewardMessage, setShowRewardMessage] = useState<string | null>(null);
  const rewardTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    refreshQuestCycles();
  }, [refreshQuestCycles]);

  useEffect(() => {
    return () => {
      if (rewardTimeoutRef.current) {
        window.clearTimeout(rewardTimeoutRef.current);
      }
    };
  }, []);

  const showReward = (message: string) => {
    setShowRewardMessage(message);

    if (rewardTimeoutRef.current) {
      window.clearTimeout(rewardTimeoutRef.current);
    }

    rewardTimeoutRef.current = window.setTimeout(() => {
      setShowRewardMessage(null);
    }, 3000);
  };

  const handleCompleteDaily = (quest: QuestItem) => {
    const wasCompleted = completeDailyQuest(
      quest.id,
      quest.xpReward,
      quest.goldReward
    );

    if (wasCompleted) {
      showReward(`Daily выполнен: +${quest.xpReward} XP и +${quest.goldReward} gold`);
    }
  };

  const handleCompleteWeekly = (quest: QuestItem) => {
    const wasCompleted = completeWeeklyQuest(
      quest.id,
      quest.xpReward,
      quest.goldReward
    );

    if (wasCompleted) {
      showReward(`Weekly выполнен: +${quest.xpReward} XP и +${quest.goldReward} gold`);
    }
  };

  const dailyCompletedIds = dailyProgress.completedIds;
  const weeklyCompletedIds = weeklyProgress.completedIds;

  const dailyCompletedCount = getCompletedCount(DAILY_QUESTS, dailyCompletedIds);
  const weeklyCompletedCount = getCompletedCount(WEEKLY_QUESTS, weeklyCompletedIds);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-slate-50"
    >
      <TopBar />

      <div className="px-6 pb-24 overflow-y-auto">
        <div className="mb-6 flex items-center gap-3">
          <div className="p-3 bg-secondary/10 text-secondary rounded-2xl">
            <Target className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-2xl font-display font-bold text-slate-800">
              Задания
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              Daily и weekly цели без сброса прогресса профиля
            </p>
          </div>
        </div>

        <AnimatePresence>
          {showRewardMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-3 bg-green-100 text-green-700 rounded-2xl text-center font-bold text-sm border border-green-200"
            >
              {showRewardMessage}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-8">
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-800">
                  Daily
                </h2>
                <p className="text-slate-500 text-sm">
                  Обновляются каждый день
                </p>
              </div>

              <div className="text-sm font-bold text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200">
                {dailyCompletedCount}/{DAILY_QUESTS.length}
              </div>
            </div>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {DAILY_QUESTS.map((quest) => {
                const isCompleted = dailyCompletedIds.includes(quest.id);

                return (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    isCompleted={isCompleted}
                    onComplete={handleCompleteDaily}
                  />
                );
              })}
            </motion.div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold text-slate-800">
                  Weekly
                </h2>
                <p className="text-slate-500 text-sm">
                  Обновляются каждую неделю
                </p>
              </div>

              <div className="text-sm font-bold text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200">
                {weeklyCompletedCount}/{WEEKLY_QUESTS.length}
              </div>
            </div>

            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {WEEKLY_QUESTS.map((quest) => {
                const isCompleted = weeklyCompletedIds.includes(quest.id);

                return (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    isCompleted={isCompleted}
                    onComplete={handleCompleteWeekly}
                  />
                );
              })}
            </motion.div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}
