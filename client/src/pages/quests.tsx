import { useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Coins, Target } from "lucide-react";
import {
  QUESTS_CONFIG,
  type QuestDefinition,
  type QuestTab,
} from "@/lib/quests-config";
import { getActiveQuestsForTab } from "@/lib/quests-rotation";

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
  quest: QuestDefinition;
  isCompleted: boolean;
  onComplete: (quest: QuestDefinition) => void;
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

function getCompletedCount(quests: QuestDefinition[], completedIds: string[]) {
  return quests.filter((quest) => completedIds.includes(quest.id)).length;
}

function getRewardMessage(tab: QuestTab, quest: QuestDefinition) {
  const label = QUESTS_CONFIG.tabs[tab].sectionTitle;
  return `${label} выполнен: +${quest.xpReward} XP и +${quest.goldReward} gold`;
}

export default function QuestsPage() {
  const {
    dailyProgress,
    weeklyProgress,
    completeDailyQuest,
    completeWeeklyQuest,
    refreshQuestCycles,
  } = useGameState();

  const [activeTab, setActiveTab] = useState<QuestTab>("daily");
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

  const dailyQuests = useMemo(
    () => getActiveQuestsForTab("daily", dailyProgress.cycleKey),
    [dailyProgress.cycleKey]
  );

  const weeklyQuests = useMemo(
    () => getActiveQuestsForTab("weekly", weeklyProgress.cycleKey),
    [weeklyProgress.cycleKey]
  );

  const dailyTabConfig = QUESTS_CONFIG.tabs.daily;
  const weeklyTabConfig = QUESTS_CONFIG.tabs.weekly;
  const activeTabConfig = QUESTS_CONFIG.tabs[activeTab];

  const showReward = (message: string) => {
    setShowRewardMessage(message);

    if (rewardTimeoutRef.current) {
      window.clearTimeout(rewardTimeoutRef.current);
    }

    rewardTimeoutRef.current = window.setTimeout(() => {
      setShowRewardMessage(null);
    }, 3000);
  };

  const handleCompleteDaily = (quest: QuestDefinition) => {
    const wasCompleted = completeDailyQuest(
      quest.id,
      quest.xpReward,
      quest.goldReward
    );

    if (wasCompleted) {
      showReward(getRewardMessage("daily", quest));
    }
  };

  const handleCompleteWeekly = (quest: QuestDefinition) => {
    const wasCompleted = completeWeeklyQuest(
      quest.id,
      quest.xpReward,
      quest.goldReward
    );

    if (wasCompleted) {
      showReward(getRewardMessage("weekly", quest));
    }
  };

  const dailyCompletedIds = dailyProgress.completedIds;
  const weeklyCompletedIds = weeklyProgress.completedIds;

  const dailyCompletedCount = getCompletedCount(dailyQuests, dailyCompletedIds);
  const weeklyCompletedCount = getCompletedCount(weeklyQuests, weeklyCompletedIds);

  const isDailyTab = activeTab === "daily";
  const visibleQuests = isDailyTab ? dailyQuests : weeklyQuests;
  const visibleCompletedIds = isDailyTab ? dailyCompletedIds : weeklyCompletedIds;
  const visibleOnComplete = isDailyTab ? handleCompleteDaily : handleCompleteWeekly;

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
              {QUESTS_CONFIG.page.title}
            </h1>
            <p className="text-slate-500 text-sm font-medium">
              {QUESTS_CONFIG.page.subtitle}
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

        <div className="mb-5 rounded-3xl bg-white p-2 shadow-sm border border-slate-100">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("daily")}
              className={`rounded-2xl px-4 py-3 text-left transition-all ${
                isDailyTab
                  ? "bg-primary text-white shadow-md"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-bold">
                  {dailyTabConfig.tabLabel}
                </span>
                <span
                  className={`min-w-10 rounded-xl px-2 py-1 text-center text-sm font-bold ${
                    isDailyTab
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  {dailyCompletedCount}/{dailyQuests.length}
                </span>
              </div>
              <p
                className={`mt-1 text-xs ${
                  isDailyTab ? "text-white/80" : "text-slate-400"
                }`}
              >
                {dailyTabConfig.tabHint}
              </p>
            </button>

            <button
              onClick={() => setActiveTab("weekly")}
              className={`rounded-2xl px-4 py-3 text-left transition-all ${
                !isDailyTab
                  ? "bg-secondary text-white shadow-md"
                  : "bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-bold">
                  {weeklyTabConfig.tabLabel}
                </span>
                <span
                  className={`min-w-10 rounded-xl px-2 py-1 text-center text-sm font-bold ${
                    !isDailyTab
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700 border border-slate-200"
                  }`}
                >
                  {weeklyCompletedCount}/{weeklyQuests.length}
                </span>
              </div>
              <p
                className={`mt-1 text-xs ${
                  !isDailyTab ? "text-white/80" : "text-slate-400"
                }`}
              >
                {weeklyTabConfig.tabHint}
              </p>
            </button>
          </div>
        </div>

        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-slate-800">
              {activeTabConfig.sectionTitle}
            </h2>
            <p className="text-slate-500 text-sm">
              {activeTabConfig.sectionSubtitle}
            </p>
          </div>

          <div className="text-sm font-bold text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200">
            {isDailyTab
              ? `${dailyCompletedCount}/${dailyQuests.length}`
              : `${weeklyCompletedCount}/${weeklyQuests.length}`}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 10 }}
            className="space-y-4"
          >
            {visibleQuests.map((quest) => {
              const isCompleted = visibleCompletedIds.includes(quest.id);

              return (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  isCompleted={isCompleted}
                  onComplete={visibleOnComplete}
                />
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
