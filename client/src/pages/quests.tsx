import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameState, getStreakInfo } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Clock, Coins, Flame, Target } from "lucide-react";
import { pluralizeDaysRu } from "@/lib/utils";
import {
  QUESTS_CONFIG,
  type QuestDefinition,
  type QuestTab,
} from "@/lib/quests-config";
import { getActiveQuestsForTab } from "@/lib/quests-rotation";
import { fetchClaimStatuses, submitQuestClaim } from "@/lib/quest-claim";

const CLAIM_POLL_INTERVAL_MS = 20_000;

type QuestCardStatus = "available" | "sending" | "pending" | "completed";

type Notice = {
  text: string;
  tone: "success" | "info" | "error";
};

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

const QUEST_BUTTON_LABELS: Record<QuestCardStatus, string> = {
  available: "Выполнить",
  sending: "Отправка…",
  pending: "На проверке",
  completed: "Готово",
};

function QuestCard({
  quest,
  status,
  onComplete,
}: {
  quest: QuestDefinition;
  status: QuestCardStatus;
  onComplete: (quest: QuestDefinition) => void;
}) {
  const isCompleted = status === "completed";
  const isPending = status === "pending" || status === "sending";

  return (
    <motion.div
      variants={item}
      className={`p-5 rounded-3xl border-2 transition-all ${
        isCompleted
          ? "bg-white border-green-100 opacity-60"
          : isPending
            ? "bg-white border-amber-100"
            : "bg-white border-transparent shadow-lg shadow-slate-200/50 hover:border-primary/20"
      }`}
    >
      <div className="flex justify-between items-start mb-2 gap-3">
        <h3 className="font-display font-bold text-lg text-slate-800">
          {quest.title}
        </h3>
        {isCompleted && <CheckCircle className="text-green-500 w-6 h-6 shrink-0" />}
        {isPending && <Clock className="text-amber-500 w-6 h-6 shrink-0" />}
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
          onClick={() => status === "available" && onComplete(quest)}
          disabled={status !== "available"}
          className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 ${
            isCompleted
              ? "bg-slate-100 text-slate-400"
              : isPending
                ? "bg-amber-50 text-amber-600"
                : "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30 hover:shadow-lg"
          }`}
        >
          {QUEST_BUTTON_LABELS[status]}
        </button>
      </div>
    </motion.div>
  );
}

function getCompletedCount(quests: QuestDefinition[], completedIds: string[]) {
  return quests.filter((quest) => completedIds.includes(quest.id)).length;
}

export default function QuestsPage() {
  const {
    username,
    telegramUsername,
    telegramUserId,
    dailyProgress,
    weeklyProgress,
    pendingClaims,
    streakDays,
    addPendingClaim,
    applyClaimResolutions,
    refreshQuestCycles,
  } = useGameState();

  const streak = getStreakInfo(streakDays, pendingClaims);

  const [activeTab, setActiveTab] = useState<QuestTab>("daily");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sendingQuestIds, setSendingQuestIds] = useState<string[]>([]);
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

  const showNotice = useCallback((text: string, tone: Notice["tone"]) => {
    setNotice({ text, tone });

    if (rewardTimeoutRef.current) {
      window.clearTimeout(rewardTimeoutRef.current);
    }

    rewardTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 4000);
  }, []);

  // Poll the worker for curator decisions on pending claims and apply them.
  const syncPendingClaims = useCallback(async () => {
    const currentPending = useGameState.getState().pendingClaims;
    if (currentPending.length === 0) return;

    const statuses = await fetchClaimStatuses(
      currentPending.map((claim) => claim.claimId)
    );
    if (!statuses) return;

    const { approved, rejected, xpGranted, goldGranted, bonusPercent } =
      applyClaimResolutions(statuses);

    if (approved.length > 0) {
      const bonusNote =
        bonusPercent > 0 ? ` (с бонусом серии +${bonusPercent}%)` : "";
      showNotice(
        approved.length === 1
          ? `Куратор подтвердил «${approved[0].questTitle}»: +${xpGranted} XP и +${goldGranted} монет${bonusNote} 🎉`
          : `Куратор подтвердил задания (${approved.length}): +${xpGranted} XP и +${goldGranted} монет${bonusNote} 🎉`,
        "success"
      );
    } else if (rejected.length > 0) {
      showNotice(
        `Задание «${rejected[0].questTitle}» не засчитано — попробуй ещё раз и отправь заново`,
        "info"
      );
    }
  }, [applyClaimResolutions, showNotice]);

  useEffect(() => {
    void syncPendingClaims();

    const interval = window.setInterval(() => {
      void syncPendingClaims();
    }, CLAIM_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [syncPendingClaims]);

  const handleComplete = (tab: QuestTab) => async (quest: QuestDefinition) => {
    if (!telegramUserId) {
      showNotice(
        "Открой приложение через Telegram, чтобы задания засчитывались",
        "error"
      );
      return;
    }

    const cycleKey =
      tab === "daily" ? dailyProgress.cycleKey : weeklyProgress.cycleKey;

    setSendingQuestIds((ids) => [...ids, quest.id]);

    const result = await submitQuestClaim({
      questId: quest.id,
      questTitle: quest.title,
      questType: tab,
      cycleKey,
      xpReward: quest.xpReward,
      goldReward: quest.goldReward,
      username,
      telegramUsername,
      telegramUserId,
    });

    setSendingQuestIds((ids) => ids.filter((id) => id !== quest.id));

    if (!result.ok) {
      showNotice(
        "Не получилось отправить заявку — проверь интернет и попробуй ещё раз",
        "error"
      );
      return;
    }

    addPendingClaim({
      claimId: result.claimId,
      questId: quest.id,
      questTitle: quest.title,
      questType: tab,
      cycleKey,
      xpReward: quest.xpReward,
      goldReward: quest.goldReward,
      createdAt: new Date().toISOString(),
    });

    if (result.status === "approved") {
      // A rare race: the curator approved before we re-asked. Apply now.
      void syncPendingClaims();
      return;
    }

    showNotice(
      "Заявка отправлена куратору! Награда придёт после проверки ✅",
      "success"
    );
  };

  const dailyCompletedIds = dailyProgress.completedIds;
  const weeklyCompletedIds = weeklyProgress.completedIds;

  const dailyCompletedCount = getCompletedCount(dailyQuests, dailyCompletedIds);
  const weeklyCompletedCount = getCompletedCount(weeklyQuests, weeklyCompletedIds);

  const isDailyTab = activeTab === "daily";
  const visibleQuests = isDailyTab ? dailyQuests : weeklyQuests;
  const visibleCompletedIds = isDailyTab ? dailyCompletedIds : weeklyCompletedIds;
  const visibleCycleKey = isDailyTab
    ? dailyProgress.cycleKey
    : weeklyProgress.cycleKey;
  const visibleOnComplete = handleComplete(activeTab);

  const getQuestStatus = (quest: QuestDefinition): QuestCardStatus => {
    if (visibleCompletedIds.includes(quest.id)) return "completed";
    if (sendingQuestIds.includes(quest.id)) return "sending";

    const isPending = pendingClaims.some(
      (claim) =>
        claim.questId === quest.id &&
        claim.questType === activeTab &&
        claim.cycleKey === visibleCycleKey
    );

    return isPending ? "pending" : "available";
  };

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

        <div
          className={`mb-4 flex items-center gap-3 rounded-2xl border p-3 ${
            streak.todayCounted
              ? "bg-orange-50 border-orange-200"
              : streak.atRisk
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-slate-200"
          }`}
        >
          <Flame
            className={`w-8 h-8 shrink-0 drop-shadow-sm ${
              streak.todayCounted
                ? "text-orange-500"
                : streak.atRisk
                  ? "text-amber-400"
                  : "text-slate-300"
            }`}
            fill="currentColor"
          />
          <div>
            <p className="text-sm font-bold text-slate-800">
              {streak.current === 0
                ? "Серия дней не начата"
                : `Серия: ${streak.current} ${pluralizeDaysRu(streak.current)}${
                    streak.todayCounted ? " 🔥" : ""
                  }`}
            </p>
            <p className="text-xs text-slate-500">
              {streak.current === 0
                ? "Выполни ежедневное задание сегодня, чтобы зажечь огонёк"
                : streak.atRisk
                  ? "Выполни ежедневное задание сегодня, иначе серия сгорит!"
                  : streak.bonusPercent > 0
                    ? `Бонус серии: +${streak.bonusPercent}% к наградам`
                    : "Продолжи завтра — получишь +5% к наградам"}
            </p>
          </div>
        </div>

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-4 p-3 rounded-2xl text-center font-bold text-sm border ${
                notice.tone === "success"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : notice.tone === "info"
                    ? "bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-red-100 text-red-700 border-red-200"
              }`}
            >
              {notice.text}
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
            {visibleQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                status={getQuestStatus(quest)}
                onComplete={visibleOnComplete}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
