import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { getStreakInfo, wasYesterdaySavedByFreeze } from "@/game/streak";
import { TopBar } from "@/components/top-bar";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Camera,
  CheckCircle,
  Circle,
  Clock,
  Coins,
  Flame,
  Lock,
  Snowflake,
  Zap,
} from "lucide-react";
import { pluralizeDaysRu } from "@/lib/utils";
import {
  QUESTS_CONFIG,
  type QuestDefinition,
  type QuestTab,
} from "@/lib/quests-config";
import { getActiveQuestsForTab } from "@/lib/quests-rotation";
import {
  hapticFail,
  hapticSelect,
  hapticSuccess,
  hapticTap,
  hapticWarn,
} from "@/lib/haptics";
import {
  getNextStep,
  getPaceIndex,
  getStepStates,
  getWeekProject,
  isProjectDay,
  type WeeklyProject,
} from "@/lib/projects-config";
import { submitQuestClaim } from "@/lib/quest-claim";
import { syncPendingClaims } from "@/game/claims-sync";
import { CommunityHint } from "@/components/community-hint";
import { BeginnerHint } from "@/components/beginner-hint";
import { isBeginner } from "@/lib/learn-config";
import {
  EMPTY_DAY_LINES,
  PROJECT_DONE_LINES,
  pickCommunityLine,
} from "@/lib/community-config";
import {
  QUIZ_GOLD_PER_CORRECT,
  QUIZ_PER_DAY,
  QUIZ_XP_PER_CORRECT,
  getTodaysQuizQuestions,
  type QuizQuestion,
} from "@/lib/quiz-config";

type PageTab = QuestTab | "quiz";

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

// Статус карточки читается цветной полоской слева, как в утверждённом дизайне:
// оранжевая «сделай», жёлтая «на проверке», зелёная «готово» (сжата в строку).
function QuestCard({
  quest,
  status,
  onComplete,
}: {
  quest: QuestDefinition;
  status: QuestCardStatus;
  onComplete: (quest: QuestDefinition) => void;
}) {
  if (status === "completed") {
    return (
      <motion.div
        variants={item}
        className="px-4 py-3 rounded-2xl bg-white/70 dark:bg-card/60 border border-slate-100 dark:border-border border-l-4 border-l-green-400 flex items-center gap-3"
      >
        <CheckCircle className="text-green-500 w-5 h-5 shrink-0" />
        <h3 className="flex-1 min-w-0 truncate font-bold text-sm text-slate-400 dark:text-slate-500 line-through">
          {quest.title}
        </h3>
        <span className="shrink-0 text-xs font-bold text-green-500">
          +{quest.xpReward} XP
        </span>
      </motion.div>
    );
  }

  if (status === "pending" || status === "sending") {
    return (
      <motion.div
        variants={item}
        className="p-4 rounded-3xl bg-white dark:bg-card border border-slate-100 dark:border-border border-l-4 border-l-amber-400"
      >
        {/* Номер шага виден и на проверке: карточка остаётся в списке дня,
            и без него непонятно, что именно ждёт куратора */}
        {quest.stepLabel && (
          <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
            {quest.stepLabel}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display font-bold text-base text-slate-800 dark:text-slate-100">
            {quest.title}
          </h3>
          <span className="shrink-0 flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1 rounded-full text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5" />
            {status === "sending" ? "Отправка…" : "Проверяется"}
          </span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
          Награда придёт сама после ✅ куратора
        </p>
      </motion.div>
    );
  }

  // Разминка — второстепенная: у неё синяя полоска и контурная кнопка,
  // чтобы на экране осталась ОДНА оранжевая кнопка — главное дело дня.
  const isWarmup = quest.kind === "warmup";

  return (
    <motion.div
      variants={item}
      className={`p-5 rounded-3xl bg-white dark:bg-card border border-slate-100 dark:border-border border-l-4 shadow-lg shadow-slate-200/50 dark:shadow-black/30 ${
        isWarmup ? "border-l-primary/50" : "border-l-secondary"
      }`}
    >
      {quest.stepLabel && (
        <p
          className={`font-mono text-[11px] font-bold uppercase tracking-wide mb-1 flex items-center gap-1 ${
            quest.kind === "warmup"
              ? "text-slate-400 dark:text-slate-500"
              : "text-secondary"
          }`}
        >
          {quest.kind === "warmup" && <Zap className="w-3 h-3" />}
          {quest.stepLabel}
        </p>
      )}

      <h3
        className={`font-display font-bold text-slate-800 dark:text-slate-100 ${
          isWarmup ? "text-base" : "text-lg"
        }`}
      >
        {quest.title}
      </h3>

      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-1.5 mb-3">
        {quest.description}
      </p>

      {/* Что показать куратору — ребёнок должен знать это заранее */}
      {quest.result && (
        <div className="flex gap-2 mb-3 px-3 py-2 rounded-xl bg-slate-50 dark:bg-muted">
          <Camera className="w-4 h-4 shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
            <span className="font-bold">На скриншоте: </span>
            {quest.result}
          </p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mb-3">
        <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-500/10 text-primary px-3 py-1 rounded-xl text-xs font-bold">
          +{quest.xpReward} XP
        </span>
        <span className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 px-3 py-1 rounded-xl text-xs font-bold">
          +{quest.goldReward} <Coins className="w-3 h-3" />
        </span>
      </div>

      <button
        onClick={() => onComplete(quest)}
        className={`w-full py-3 rounded-2xl font-bold text-[15px] transition-all active:scale-[0.98] ${
          isWarmup
            ? "border-2 border-primary/40 text-primary dark:text-blue-300 dark:border-blue-400/40 hover:bg-blue-50 dark:hover:bg-blue-500/10"
            : "text-white bg-gradient-to-r from-secondary to-orange-400 shadow-md shadow-secondary/30 hover:shadow-lg"
        }`}
      >
        Выполнил! → на проверку
      </button>
    </motion.div>
  );
}

// Путь недели: пять шагов проекта с их состоянием. Без него неделя выглядит
// одним простым заданием, которое можно сделать как попало — а это итог
// пяти дней, и это должно быть видно до того, как ребёнок нажмёт кнопку.
function WeekPath({
  project,
  doneIds,
  pendingIds,
  openUpTo,
}: {
  project: WeeklyProject;
  doneIds: string[];
  pendingIds: string[];
  openUpTo: number;
}) {
  const states = getStepStates(project, doneIds, pendingIds, openUpTo);
  const doneCount = states.filter((state) => state === "done").length;

  return (
    <motion.div
      variants={item}
      className="p-5 rounded-3xl bg-white dark:bg-card border border-slate-100 dark:border-border shadow-lg shadow-slate-200/50 dark:shadow-black/30"
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-secondary">
          Путь создателя
        </p>
        <span className="font-mono text-[11px] font-bold text-slate-400 dark:text-slate-500">
          {doneCount} из {project.steps.length}
        </span>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mb-4">
        Один шаг в день, по очереди. Отстал — нагонишь, награда та же.
        Соберёшь все пять — проект закроется сам и принесёт{" "}
        <b className="text-slate-600 dark:text-slate-300">
          +{project.xpReward} XP и +{project.goldReward} голды
        </b>
        .
      </p>

      <div className="space-y-1.5">
        {project.steps.map((step, index) => {
          const state = states[index];
          const isDone = state === "done";
          const isPending = state === "pending";
          const isNext = state === "next";
          const isSoon = state === "soon";
          const isLocked = state === "locked" || isSoon;

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 border ${
                isNext
                  ? "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30"
                  : isDone
                    ? "bg-green-50/60 border-green-100 dark:bg-green-500/10 dark:border-green-500/25"
                    : isPending
                      ? "bg-amber-50/60 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/25"
                      : "bg-slate-50 border-slate-100 dark:bg-muted dark:border-border"
              }`}
            >
              <span
                className={`shrink-0 w-5 text-center font-mono text-[11px] font-bold ${
                  isNext
                    ? "text-secondary"
                    : isDone
                      ? "text-green-600 dark:text-green-400"
                      : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {index + 1}
              </span>

              {isDone ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-green-500" />
              ) : isPending ? (
                <Clock className="w-4 h-4 shrink-0 text-amber-500" />
              ) : isLocked ? (
                <Lock className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
              ) : (
                <Circle className="w-4 h-4 shrink-0 text-secondary" />
              )}

              <span
                className={`flex-1 min-w-0 truncate text-sm ${
                  isNext
                    ? "font-bold text-slate-800 dark:text-slate-100"
                    : isDone
                      ? "text-slate-400 dark:text-slate-500 line-through"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {step.title}
              </span>

              {isNext && (
                <span className="shrink-0 text-[11px] font-bold text-secondary">
                  сейчас
                </span>
              )}
              {isSoon && (
                <span className="shrink-0 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                  завтра
                </span>
              )}
              {isPending && (
                <span className="shrink-0 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  на проверке
                </span>
              )}
            </div>
          );
        })}
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
    level,
    telegramUsername,
    telegramUserId,
    dailyProgress,
    weeklyProgress,
    pendingClaims,
    streakDays,
    frozenDays,
    streakFreezes,
    doublePotions,
    potionActive,
    quizDate,
    quizAnswered,
    chestDate,
    addPendingClaim,
    activateDoublePotion,
    autoApplyStreakFreeze,
    answerQuizQuestion,
    openDailyChest,
    refreshQuestCycles,
  } = useGameState();

  const streak = getStreakInfo(streakDays, pendingClaims, frozenDays);
  const savedByFreeze = wasYesterdaySavedByFreeze(frozenDays);

  const [activeTab, setActiveTab] = useState<PageTab>("daily");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sendingQuestIds, setSendingQuestIds] = useState<string[]>([]);
  // Что выбрал ученик в квизе в этой сессии (для подсветки своего ответа)
  const [quizPicks, setQuizPicks] = useState<Record<string, number>>({});
  const rewardTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    refreshQuestCycles();
    autoApplyStreakFreeze();
  }, [refreshQuestCycles, autoApplyStreakFreeze]);

  useEffect(() => {
    return () => {
      if (rewardTimeoutRef.current) {
        window.clearTimeout(rewardTimeoutRef.current);
      }
    };
  }, []);

  // Шаги проекта, уже закрытые за эту неделю: сданные и ждущие куратора.
  // От них зависит, какой шаг выдать сегодня.
  const weekDoneIds = weeklyProgress.weekDoneIds ?? [];
  const weekPendingIds = useMemo(
    () =>
      pendingClaims
        .filter((claim) => claim.questType === "daily")
        .map((claim) => claim.questId),
    [pendingClaims]
  );

  // Задание дня — очередной шаг проекта недели, поэтому нужен и ключ недели.
  const dailyQuests = useMemo(
    () =>
      getActiveQuestsForTab(
        "daily",
        dailyProgress.cycleKey,
        weeklyProgress.cycleKey,
        weekDoneIds,
        weekPendingIds
      ),
    [
      dailyProgress.cycleKey,
      weeklyProgress.cycleKey,
      weekDoneIds,
      weekPendingIds,
    ]
  );

  const weeklyQuests = useMemo(
    () => getActiveQuestsForTab("weekly", weeklyProgress.cycleKey),
    [weeklyProgress.cycleKey]
  );

  // Путь недели: сам проект и его сданные шаги.
  const weekProject = useMemo(
    () => getWeekProject(weeklyProgress.cycleKey),
    [weeklyProgress.cycleKey]
  );
  const weekStepsDone = weekProject.steps.filter((step) =>
    (weeklyProgress.weekDoneIds ?? []).includes(step.id)
  ).length;

  // Сегодняшний шаг уже сдан, а следующий ещё закрыт календарём —
  // об этом надо сказать, иначе вкладка «День» выглядит пустой и сломанной.
  const nextStepLocked = useMemo(() => {
    const dateKey = dailyProgress.cycleKey.slice("daily-".length);
    if (!isProjectDay(dateKey)) return false;

    const next = getNextStep(
      weekProject,
      weeklyProgress.weekDoneIds ?? [],
      weekPendingIds
    );

    return Boolean(next && next.index > getPaceIndex(dateKey));
  }, [
    dailyProgress.cycleKey,
    weekProject,
    weeklyProgress.weekDoneIds,
    weekPendingIds,
  ]);

  const dailyTabConfig = QUESTS_CONFIG.tabs.daily;
  const weeklyTabConfig = QUESTS_CONFIG.tabs.weekly;

  // Викторина дня: сегодняшняя дата берётся из «печати» дневного цикла
  const todayKey = dailyProgress.cycleKey.slice("daily-".length);
  const quizQuestions = useMemo(
    () => getTodaysQuizQuestions(dailyProgress.cycleKey),
    [dailyProgress.cycleKey]
  );
  const answeredToday = quizDate === todayKey ? quizAnswered : [];
  const chestOpenedToday = chestDate === todayKey;

  const showNotice = useCallback((text: string, tone: Notice["tone"]) => {
    setNotice({ text, tone });

    if (rewardTimeoutRef.current) {
      window.clearTimeout(rewardTimeoutRef.current);
    }

    rewardTimeoutRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 4000);
  }, []);

  // Опрос куратора и весть о его решении переехали в App.tsx и плашку
  // сверху: ответ должен догонять ученика на любой вкладке, а не только здесь.
  // Тут остался один заход — сразу после отправки, на случай, когда куратор
  // успел нажать ✅ раньше, чем мы спросили.

  const handleComplete = (tab: QuestTab) => async (quest: QuestDefinition) => {
    hapticTap("medium");

    if (!telegramUserId) {
      hapticFail();
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
      hapticFail();
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

    hapticSuccess();
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
  const isQuizTab = activeTab === "quiz";
  const visibleQuests = isDailyTab ? dailyQuests : weeklyQuests;
  const visibleCompletedIds = isDailyTab ? dailyCompletedIds : weeklyCompletedIds;
  const visibleCycleKey = isDailyTab
    ? dailyProgress.cycleKey
    : weeklyProgress.cycleKey;
  const visibleOnComplete = handleComplete(isDailyTab ? "daily" : "weekly");

  const handleQuizAnswer = (question: QuizQuestion, optionIndex: number) => {
    const isCorrect = optionIndex === question.correctIndex;
    const accepted = answerQuizQuestion(question.id, isCorrect);

    if (accepted) {
      if (isCorrect) hapticSuccess();
      else hapticWarn();
      setQuizPicks((picks) => ({ ...picks, [question.id]: optionIndex }));
    }
  };

  const handleOpenChest = () => {
    const gold = openDailyChest();
    if (gold !== null) {
      hapticSuccess();
      showNotice(
        gold >= 50
          ? `ДЖЕКПОТ! Из сундука выпало ${gold} голды! 🎁🎉`
          : `Сундук дня открыт: +${gold} голды 🎁`,
        "success"
      );
    }
  };

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
      className="flex flex-col h-full bg-slate-50 dark:bg-background"
    >
      <TopBar />

      <div className="px-6 pb-24 overflow-y-auto">
        <div
          className={`mb-4 flex items-center gap-3 rounded-2xl border p-3 ${
            streak.todayCounted
              ? "bg-orange-50 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/30"
              : streak.atRisk
                ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30"
                : "bg-white border-slate-200 dark:bg-card dark:border-border"
          }`}
        >
          <Flame
            className={`w-8 h-8 shrink-0 drop-shadow-sm ${
              streak.todayCounted
                ? "text-orange-500"
                : streak.atRisk
                  ? "text-amber-400"
                  : "text-slate-300 dark:text-slate-600"
            }`}
            fill="currentColor"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {streak.current === 0
                ? "Серия дней не начата"
                : `Серия: ${streak.current} ${pluralizeDaysRu(streak.current)}${
                    streak.todayCounted ? " 🔥" : ""
                  }`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {streak.current === 0
                ? "Выполни ежедневное задание сегодня, чтобы зажечь огонёк"
                : streak.atRisk
                  ? streakFreezes > 0
                    ? "Сделай задание сегодня — или серию прикроет заморозка ❄️"
                    : "Выполни ежедневное задание сегодня, иначе серия сгорит!"
                  : savedByFreeze
                    ? "Вчера серию спасла заморозка ❄️ Продолжай сегодня!"
                    : streak.bonusPercent > 0
                      ? `Бонус серии: +${streak.bonusPercent}% к наградам`
                      : "Продолжи завтра — получишь +5% к наградам"}
            </p>
          </div>

          {streakFreezes > 0 && (
            <div className="shrink-0 flex items-center gap-1 bg-cyan-50 border border-cyan-200 text-cyan-600 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-300 px-2.5 py-1.5 rounded-xl">
              <Snowflake className="w-4 h-4" />
              <span className="text-xs font-bold">{streakFreezes}</span>
            </div>
          )}
        </div>

        {((streak.todayCounted && !chestOpenedToday) ||
          potionActive ||
          doublePotions > 0) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {streak.todayCounted && !chestOpenedToday && (
              <button
                onClick={handleOpenChest}
                className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30 transition-all active:scale-95 hover:bg-yellow-200 dark:hover:bg-yellow-500/25"
              >
                🎁 Открыть сундук дня
              </button>
            )}

            {potionActive ? (
              <span className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:border-fuchsia-500/30">
                🧪 Зелье ×2 активно
              </span>
            ) : (
              doublePotions > 0 && (
                <button
                  onClick={() => {
                    hapticTap("medium");
                    activateDoublePotion();
                  }}
                  className="px-4 py-2.5 rounded-2xl text-sm font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/30 transition-all active:scale-95 hover:bg-fuchsia-200 dark:hover:bg-fuchsia-500/25"
                >
                  🧪 Выпить зелье ×2
                  {doublePotions > 1 ? ` (${doublePotions})` : ""}
                </button>
              )
            )}
          </div>
        )}

        <AnimatePresence>
          {notice && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mb-4 p-3 rounded-2xl text-center font-bold text-sm border ${
                notice.tone === "success"
                  ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30"
                  : notice.tone === "info"
                    ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30"
                    : "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30"
              }`}
            >
              {notice.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-5 rounded-3xl bg-white dark:bg-card p-2 shadow-sm border border-slate-100 dark:border-border">
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                tab: "daily" as PageTab,
                label: dailyTabConfig.tabLabel,
                count: `${dailyCompletedCount}/${dailyQuests.length}`,
                activeClass: "bg-primary text-white shadow-md",
              },
              {
                tab: "weekly" as PageTab,
                label: weeklyTabConfig.tabLabel,
                // Неделя измеряется шагами проекта, а не сдачами: сдавать
                // отдельно нечего, проект закрывается последним шагом.
                count: `${weekStepsDone}/${weekProject.steps.length}`,
                activeClass: "bg-secondary text-white shadow-md",
              },
              {
                tab: "quiz" as PageTab,
                label: "Квиз",
                count: `${answeredToday.length}/${QUIZ_PER_DAY}`,
                activeClass: "bg-violet-500 text-white shadow-md",
              },
            ].map(({ tab, label, count, activeClass }) => {
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => {
                    if (!isActive) hapticSelect();
                    setActiveTab(tab);
                  }}
                  className={`rounded-2xl px-3 py-3 text-center transition-all ${
                    isActive
                      ? activeClass
                      : "bg-slate-50 text-slate-600 dark:bg-muted dark:text-slate-300"
                  }`}
                >
                  <span className="block font-display text-base font-bold">
                    {label}
                  </span>
                  <span
                    className={`mt-1 inline-block rounded-lg px-2 py-0.5 text-xs font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-white text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Одна строка связки: без неё ребёнок не поймёт, что день ведёт
              к неделе. Заголовков разделов по-прежнему нет. */}
          <p className="mt-2 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
            {activeTab === "quiz"
              ? "Пять вопросов в день — быстрая проверка себя"
              : activeTab === "weekly"
                ? "Проект недели собирается из пяти дневных шагов"
                : "Шаг к проекту недели плюс короткая разминка"}
          </p>
        </div>

        {/* Новичку — раньше заданий: он должен упереться в уроки с нуля
            прежде, чем в «собери меч из кубов». Вне AnimatePresence, чтобы
            не мигала при переключении вкладок. */}
        {isBeginner(level) && (
          <div className="mb-4">
            <BeginnerHint level={level} />
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={container}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: 10 }}
            className="space-y-4"
          >
            {isQuizTab
              ? quizQuestions.map((question) => {
                  const isAnswered = answeredToday.includes(question.id);
                  const picked = quizPicks[question.id];

                  return (
                    <motion.div
                      key={question.id}
                      variants={item}
                      className="p-5 rounded-3xl bg-white dark:bg-card border border-slate-100 dark:border-border border-l-4 border-l-violet-400 shadow-lg shadow-slate-200/50 dark:shadow-black/30"
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <Brain className="w-5 h-5 mt-0.5 shrink-0 text-violet-500" />
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                          {question.question}
                        </h3>
                      </div>

                      <div className="space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const isCorrect =
                            optionIndex === question.correctIndex;
                          const isPicked = picked === optionIndex;

                          return (
                            <button
                              key={optionIndex}
                              disabled={isAnswered}
                              onClick={() =>
                                handleQuizAnswer(question, optionIndex)
                              }
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                                isAnswered
                                  ? isCorrect
                                    ? "bg-green-50 border-green-300 text-green-700 font-bold dark:bg-green-500/15 dark:border-green-500/40 dark:text-green-300"
                                    : isPicked
                                      ? "bg-red-50 border-red-300 text-red-600 dark:bg-red-500/15 dark:border-red-500/40 dark:text-red-300"
                                      : "bg-slate-50 border-slate-200 text-slate-400 dark:bg-muted dark:border-border dark:text-slate-500"
                                  : "bg-slate-50 border-slate-200 text-slate-700 dark:bg-muted dark:border-border dark:text-slate-200 hover:border-violet-300 dark:hover:border-violet-500/50 active:scale-[0.99]"
                              }`}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>

                      {isAnswered && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-3 p-3 rounded-xl bg-violet-50 border border-violet-100 dark:bg-violet-500/10 dark:border-violet-500/30"
                        >
                          {picked !== undefined && (
                            <p
                              className={`text-xs font-bold mb-1 ${
                                picked === question.correctIndex
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-500 dark:text-red-400"
                              }`}
                            >
                              {picked === question.correctIndex
                                ? `Верно! +${QUIZ_XP_PER_CORRECT} XP и +${QUIZ_GOLD_PER_CORRECT} монеты 🎉`
                                : "Не угадал — но теперь запомнишь!"}
                            </p>
                          )}
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {question.explanation}
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })
              : (
                  <>
                    {isDailyTab && nextStepLocked && (
                      <motion.div variants={item} className="space-y-2">
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-border bg-white dark:bg-card px-4 py-3">
                          <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-400 dark:text-slate-500" />
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">
                            На сегодня всё — следующий шаг откроется завтра.
                            Проект идёт по шагу в день: так он и получается
                            аккуратным, и не съедает весь вечер.
                          </p>
                        </div>

                        {/* «Хочу ещё» упирается в закрытую дверь — вот вторая,
                            открытая: там всегда что-то происходит */}
                        {/* Число месяца как счётчик: фраза меняется день ото
                            дня, а не повторяется одна и та же всю неделю */}
                        <CommunityHint
                          line={pickCommunityLine(
                            EMPTY_DAY_LINES,
                            Number(todayKey.slice(-2)) || 1
                          )}
                        />
                      </motion.div>
                    )}

                    {!isDailyTab && (
                      <>
                        <WeekPath
                          project={weekProject}
                          doneIds={weekDoneIds}
                          pendingIds={weekPendingIds}
                          openUpTo={getPaceIndex(
                            dailyProgress.cycleKey.slice("daily-".length)
                          )}
                        />

                        {/* Проект собран — сильнейшая точка за всю неделю:
                            ребёнок только что сделал настоящую вещь */}
                        {weekStepsDone === weekProject.steps.length && (
                          <motion.div variants={item}>
                            {/* Проекты сменяются по неделям, значит и фраза
                                на финише будет каждую неделю другой */}
                            <CommunityHint
                              line={pickCommunityLine(
                                PROJECT_DONE_LINES,
                                weekProject.id.length
                              )}
                            />
                          </motion.div>
                        )}
                      </>
                    )}

                    {visibleQuests.map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        status={getQuestStatus(quest)}
                        onComplete={visibleOnComplete}
                      />
                    ))}
                  </>
                )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
