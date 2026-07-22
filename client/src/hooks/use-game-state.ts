import { create } from "zustand";
import { persist } from "zustand/middleware";
import confetti from "canvas-confetti";
import type { ClaimStatus } from "@/lib/quest-claim";
import {
  DOUBLE_POTION_COST,
  DOUBLE_POTION_MAX,
  STREAK_FREEZE_COST,
  STREAK_FREEZE_MAX,
  getShopItem,
} from "@/lib/shop-config";
import {
  clearSlot,
  equipInSlot,
  sanitizeEquipped,
  seedEquippedFromInventory,
  type Equipped,
} from "@/game/wardrobe";
import {
  QUIZ_GOLD_PER_CORRECT,
  QUIZ_XP_PER_CORRECT,
} from "@/lib/quiz-config";
import { TIP_MAX_TAPS, TIP_MIN_TAPS, pickTip } from "@/lib/tips-config";
import {
  CARE_NEEDS,
  STARTER_SUPPLIES,
  SUPPLY_MAX,
  applyRestore,
  getCareNeed,
  getCareSupply,
  type CareNeedId,
} from "@/lib/care-config";
import { PET_STAGES, getPetStage } from "@/lib/pet-config";
import { getWeekProject } from "@/lib/projects-config";
import { LEVEL_THRESHOLDS, getLevelData, type LevelData } from "@/game/level";
import {
  dateFromDailyCycleKey,
  formatLocalDate,
  getDailyCycleKey,
  getWeeklyCycleKey,
  parseLocalDate,
  previousDayString,
} from "@/game/dates";
import {
  STREAK_BONUS_CAP,
  chainLengthEndingAt,
  findFreezeGapDay,
  getPendingDailyDays,
  getStreakBonusPercent,
  getStreakInfo,
  mergeStreakDays,
} from "@/game/streak";
import {
  flushCloudSave,
  getTelegramCloudStorage,
  getTelegramDisplayName,
  getTelegramUser,
  queueCloudSave,
  readCloudState,
  writeCloudState,
} from "@/game/cloud";

/**
 * Игровой стейт: всё, что помнит приложение про ученика.
 *
 * Что вынесено в отдельные файлы и сюда НЕ возвращать:
 * - `@/game/level`  — кривая опыта и расчёт уровня;
 * - `@/game/dates`  — местные даты, ключи дня и недели;
 * - `@/game/streak` — арифметика серии дней и заморозок;
 * - `@/game/cloud`  — чтение и запись в облако Telegram.
 *
 * Здесь остались сам стор и действия. Порядок действий в файле — по механикам:
 * задания и награды → покупки → медали и праздники → уход → питомец →
 * квиз и сундук → сохранение и облако.
 */

// Petting the ghost grants a tiny XP treat, capped per day so the real
// progress still comes from quests.
export const PETTING_DAILY_LIMIT = 10;

// Через сколько нажатий призрак выдаст следующий совет по Blender.
const randomTipInterval = () =>
  TIP_MIN_TAPS + Math.floor(Math.random() * (TIP_MAX_TAPS - TIP_MIN_TAPS + 1));


export type RecurringQuestProgress = {
  cycleKey: string;
  completedIds: string[];
  // Только у недельного прогресса: id ДНЕВНЫХ заданий, одобренных за эту
  // неделю. Дневной прогресс обнуляется каждую ночь, а карточке недели надо
  // показать пройденный путь — какие шаги проекта уже сданы. Живёт здесь,
  // потому что здесь уже есть правильный сброс при смене недели.
  weekDoneIds?: string[];
};

// Lifetime counters achievements are computed from.
export type GameStats = {
  approvedQuestsTotal: number;
  goldSpent: number;
  bestStreak: number;
};

const createDefaultStats = (): GameStats => ({
  approvedQuestsTotal: 0,
  goldSpent: 0,
  bestStreak: 0,
});

// A quest the student says is done, waiting for the curator's verdict.
export type PendingClaim = {
  claimId: string;
  questId: string;
  questTitle: string;
  questType: "daily" | "weekly";
  cycleKey: string;
  xpReward: number;
  goldReward: number;
  createdAt: string;
};

// Весть о решении куратора: что показать в плашке и чем она должна быть.
export type ClaimNotice = {
  tone: "approved" | "rejected";
  // Название задания, а при нескольких сразу — сколько их.
  title: string;
  count: number;
  xp: number;
  gold: number;
  // Приписки: бонус серии и сработавшее зелье — их видно в цифрах наверху,
  // но без объяснения они выглядят как ошибка в подсчётах.
  bonusPercent: number;
  potionUsed: boolean;
};


export interface GameState extends LevelData {
  username: string;
  telegramUserId: number | null;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  isUsernameCustomized: boolean;
  cloudSyncAvailable: boolean;

  xp: number;
  gold: number;
  // Что куплено — по названиям вещей (по ним же считаются медали).
  inventory: string[];
  // Что из купленного надето: место → id вещи. См. `@/game/wardrobe`.
  equipped: Equipped;
  completedQuests: string[];

  // Local dates (YYYY-MM-DD) whose daily quests were approved by the curator.
  streakDays: string[];
  // Days covered by a spent streak freeze — they patch one-day gaps in the chain.
  frozenDays: string[];
  streakFreezes: number;

  doublePotions: number;
  // A drunk potion waiting for the next approved claim to double.
  potionActive: boolean;

  stats: GameStats;
  seenAchievements: string[];
  /**
   * Стадии (их fromLevel), превращение в которые уже отпраздновали.
   *
   * Раньше тут лежало одно число — «докуда дошли», и стадия считалась
   * показанной, если её fromLevel не больше него. Это молча съедало эволюцию
   * каждый раз, когда в pet-config менялись уровни стадий: после переезда
   * 1/3/5/7/10 → 1/5/12/20/30 у того, кто когда-то праздновал старую стадию 5,
   * новая стадия 5 («Ученик») уже считалась виденной и анимация не играла.
   * Список конкретных стадий такого не допускает, а при слиянии облака просто
   * объединяется — как медали.
   */
  celebratedStages: number[];
  // Осталось от прежней версии: нужно, чтобы понять, что праздновал ученик,
  // который ещё не обновлялся. Само по себе больше ничего не решает.
  celebratedStageLevel: number;
  // Последний обычный уровень, для которого уже показали поздравление.
  celebratedLevel: number;

  // Поглаживание призрака: дата и счётчик за сегодня.
  pettingDate: string;
  pettingCount: number;

  // Советы по Blender в пузыре: сколько раз погладили с прошлого совета,
  // на каком нажатии выдать следующий и какой совет идёт по кругу.
  petTapsTotal: number;
  nextTipAt: number;
  tipCursor: number;

  // Когда ученик последний раз открывал приложение (для встречи после паузы).
  lastSeenDate: string;

  // Уход: когда в последний раз закрывали каждую потребность (ISO-время).
  // Храним именно МОМЕНТ, а не уровень: уровень считается от него на лету,
  // поэтому шкалы честно тают при закрытом приложении, а слияние облака
  // «кто позже» не ломает ничего (время только растёт).
  care: Record<CareNeedId, string | null>;

  // Припасы на складе: id припаса → сколько штук. Тратятся при уходе,
  // покупаются в магазине. Считаются как голда — облако главнее.
  supplies: Record<string, number>;
  // Стартовый набор выдаётся один раз, флаг не даёт выдать его снова.
  starterSuppliesGiven: boolean;

  // Викторина дня: на какие вопросы уже отвечено сегодня.
  quizDate: string;
  quizAnswered: string[];

  // Сундук дня: когда открывали последний раз.
  chestDate: string;

  dailyProgress: RecurringQuestProgress;
  weeklyProgress: RecurringQuestProgress;
  pendingClaims: PendingClaim[];
  /**
   * Вердикт куратора, о котором ученику ещё не сказали.
   *
   * Раньше награда просто прилетала: цифры наверху менялись сами, и было
   * непонятно, что произошло — владелец сказал «резко начисляется и непонятно
   * что». Решение куратора приходит опросом в любой момент, поэтому весть
   * о нём живёт в сторе, а не на экране заданий: показать её должно любое
   * место, где ученик сейчас находится.
   *
   * НЕ сохраняется: пропущенная плашка — не потеря, награда уже начислена.
   */
  claimNotice: ClaimNotice | null;
  clearClaimNotice: () => void;

  setUsername: (name: string) => void;
  addXpAndGold: (xp: number, gold: number) => void;

  addPendingClaim: (claim: PendingClaim) => void;
  applyClaimResolutions: (statuses: Record<string, ClaimStatus>) => {
    approved: PendingClaim[];
    rejected: PendingClaim[];
    xpGranted: number;
    goldGranted: number;
    bonusPercent: number;
    potionUsedOn: string | null;
  };

  buyStreakFreeze: () => boolean;
  buyDoublePotion: () => boolean;
  activateDoublePotion: () => boolean;
  autoApplyStreakFreeze: () => void;

  markAchievementsSeen: (ids: string[]) => void;
  markEvolutionSeen: (stageLevel: number) => void;
  markLevelUpSeen: (level: number) => void;
  markVisit: () => number;
  careFor: (needId: CareNeedId, supplyId: string) => boolean;
  buySupply: (supplyId: string) => boolean;
  petGhost: () => { granted: boolean; tip: string | null };
  answerQuizQuestion: (questionId: string, correct: boolean) => boolean;
  openDailyChest: () => number | null;

  refreshQuestCycles: () => void;
  buyItem: (itemId: string, cost: number, itemName: string) => boolean;
  wearItem: (itemId: string) => boolean;
  takeOffItem: (itemId: string) => void;
  resetGame: () => void;

  // Отладочная панель владельца (lib/dev-config.ts) — в обычной игре
  // не вызываются. Пишут в облако СИНХРОННО: уровень и голда могут
  // уменьшаться, а при слиянии облачная копия побеждает.
  devSetLevel: (level: number) => void;
  devSetGold: (gold: number) => void;
  devReplayEvolution: () => void;

  bootstrapTelegramCloud: () => Promise<void>;
  syncCloudState: () => Promise<boolean>;
}

type PersistedGameState = Pick<
  GameState,
  | "username"
  | "telegramUserId"
  | "telegramUsername"
  | "telegramFirstName"
  | "isUsernameCustomized"
  | "xp"
  | "gold"
  | "inventory"
  | "equipped"
  | "completedQuests"
  | "streakDays"
  | "frozenDays"
  | "streakFreezes"
  | "doublePotions"
  | "potionActive"
  | "stats"
  | "seenAchievements"
  | "celebratedStageLevel"
  | "celebratedStages"
  | "celebratedLevel"
  | "pettingDate"
  | "petTapsTotal"
  | "nextTipAt"
  | "tipCursor"
  | "lastSeenDate"
  | "care"
  | "supplies"
  | "starterSuppliesGiven"
  | "pettingCount"
  | "quizDate"
  | "quizAnswered"
  | "chestDate"
  | "dailyProgress"
  | "weeklyProgress"
  | "pendingClaims"
>;


// Short celebratory burst — long confetti rain hides the whole screen.
const triggerRewardConfetti = () => {
  const duration = 900;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#3B82F6", "#F97316", "#FACC15"],
    });

    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#3B82F6", "#F97316", "#FACC15"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
};



// Новый ученик встречает призрака сытым и довольным: шкалы начинают таять
// с этой минуты, а не с эпохи Unix.
// Стадии, которые ученик точно уже прошёл: все, что ниже текущей.
const seedCelebratedStages = (totalXp: number): number[] => {
  const current = getPetStage(getLevelData(totalXp).level);

  return PET_STAGES.filter((stage) => stage.fromLevel < current.fromLevel).map(
    (stage) => stage.fromLevel
  );
};

const createFreshCare = (): Record<CareNeedId, string | null> => {
  const now = new Date().toISOString();
  return { feed: now, clean: now, play: now };
};

// Слияние с облаком: у каждой потребности побеждает более позднее время —
// значит, где-то за призраком ухаживали, и это уже случилось.
const mergeCare = (
  local: Record<CareNeedId, string | null>,
  cloud: Partial<Record<CareNeedId, string | null>> | undefined
): Record<CareNeedId, string | null> => {
  const merged = { ...local };

  for (const need of CARE_NEEDS) {
    const cloudValue = cloud?.[need.id] ?? null;
    const localValue = local[need.id] ?? null;

    if (!cloudValue) continue;
    if (!localValue || cloudValue > localValue) {
      merged[need.id] = cloudValue;
    }
  }

  return merged;
};

const createDailyProgress = (): RecurringQuestProgress => ({
  cycleKey: getDailyCycleKey(),
  completedIds: [],
});

const createWeeklyProgress = (): RecurringQuestProgress => ({
  cycleKey: getWeeklyCycleKey(),
  completedIds: [],
  weekDoneIds: [],
});

const getRecurringProgressPatch = (
  state: Pick<GameState, "dailyProgress" | "weeklyProgress">
): Partial<Pick<GameState, "dailyProgress" | "weeklyProgress">> | null => {
  const nextDailyKey = getDailyCycleKey();
  const nextWeeklyKey = getWeeklyCycleKey();

  let hasChanges = false;
  const patch: Partial<Pick<GameState, "dailyProgress" | "weeklyProgress">> = {};

  if (state.dailyProgress.cycleKey !== nextDailyKey) {
    patch.dailyProgress = {
      cycleKey: nextDailyKey,
      completedIds: [],
    };
    hasChanges = true;
  }

  if (state.weeklyProgress.cycleKey !== nextWeeklyKey) {
    patch.weeklyProgress = {
      cycleKey: nextWeeklyKey,
      completedIds: [],
      weekDoneIds: [],
    };
    hasChanges = true;
  }

  return hasChanges ? patch : null;
};


export const useGameState = create<GameState>()(
  persist(
    (set, get) => ({
      username: "3D Explorer",
      telegramUserId: null,
      telegramUsername: null,
      telegramFirstName: null,
      isUsernameCustomized: false,
      cloudSyncAvailable: false,

      xp: 0,
      gold: 0,
      inventory: [],
      equipped: {},
      completedQuests: [],
      streakDays: [],
      frozenDays: [],
      streakFreezes: 0,
      doublePotions: 0,
      potionActive: false,
      stats: createDefaultStats(),
      seenAchievements: [],
      celebratedStages: [],
      celebratedStageLevel: 1,
      celebratedLevel: 1,
      pettingDate: "",
      petTapsTotal: 0,
      nextTipAt: randomTipInterval(),
      tipCursor: Math.floor(Math.random() * 40),
      lastSeenDate: "",
      care: createFreshCare(),
      supplies: { ...STARTER_SUPPLIES },
      starterSuppliesGiven: false,
      pettingCount: 0,
      quizDate: "",
      quizAnswered: [],
      chestDate: "",

      dailyProgress: createDailyProgress(),
      weeklyProgress: createWeeklyProgress(),
      pendingClaims: [],
      claimNotice: null,

      ...getLevelData(0),

      clearClaimNotice: () => set({ claimNotice: null }),

      setUsername: (name) => {
        const nextName = name.trim() || "3D Explorer";

        set({
          username: nextName,
          isUsernameCustomized: true,
        });

        queueCloudSave(get);
      },

      addXpAndGold: (xpToAdd, goldToAdd) => {
        set((state) => {
          const nextXp = state.xp + xpToAdd;

          return {
            xp: nextXp,
            gold: state.gold + goldToAdd,
            ...getLevelData(nextXp),
          };
        });

        queueCloudSave(get);
      },

      addPendingClaim: (claim) => {
        const state = get();

        if (state.pendingClaims.some((c) => c.claimId === claim.claimId)) {
          return;
        }

        set({ pendingClaims: [...state.pendingClaims, claim] });
      },

      applyClaimResolutions: (statuses) => {
        const state = get();

        const approved: PendingClaim[] = [];
        const rejected: PendingClaim[] = [];
        const remaining: PendingClaim[] = [];

        for (const claim of state.pendingClaims) {
          const status = statuses[claim.claimId];

          if (status === "approved") {
            approved.push(claim);
          } else if (status === "rejected" || status === "unknown") {
            // "unknown" means the record expired server-side — release the
            // quest so the student can claim it again.
            rejected.push(claim);
          } else {
            remaining.push(claim);
          }
        }

        if (approved.length === 0 && rejected.length === 0) {
          return {
            approved,
            rejected,
            xpGranted: 0,
            goldGranted: 0,
            bonusPercent: 0,
            potionUsedOn: null,
          };
        }

        const recurringPatch = getRecurringProgressPatch(state);
        let dailyProgress = recurringPatch?.dailyProgress ?? state.dailyProgress;
        let weeklyProgress =
          recurringPatch?.weeklyProgress ?? state.weeklyProgress;

        // Credit approved daily claims to the streak by their SUBMISSION date,
        // then pay rewards with the bonus of the resulting confirmed streak.
        const creditedDays = new Set(state.streakDays);

        for (const claim of approved) {
          if (claim.questType !== "daily") continue;
          const day = dateFromDailyCycleKey(claim.cycleKey);
          if (day) creditedDays.add(day);
        }

        const streakDays = mergeStreakDays([...creditedDays], []);

        // Spend a streak freeze if it can reconnect the chain across yesterday.
        let streakFreezes = state.streakFreezes;
        let frozenDays = state.frozenDays;
        const chainSet = new Set([...creditedDays, ...frozenDays]);

        if (streakFreezes > 0) {
          const gapDay = findFreezeGapDay(
            chainSet,
            getPendingDailyDays(remaining)
          );

          if (gapDay) {
            streakFreezes -= 1;
            frozenDays = mergeStreakDays(frozenDays, [gapDay]);
            chainSet.add(gapDay);
          }
        }

        const today = formatLocalDate(new Date());
        const chainToday = chainLengthEndingAt(chainSet, today);
        const confirmedStreak =
          chainToday > 0
            ? chainToday
            : chainLengthEndingAt(chainSet, previousDayString(today));
        const bonusPercent = getStreakBonusPercent(confirmedStreak);
        const rewardMultiplier = 1 + bonusPercent / 100;

        const stats: GameStats = {
          ...state.stats,
          approvedQuestsTotal: state.stats.approvedQuestsTotal + approved.length,
          bestStreak: Math.max(state.stats.bestStreak, confirmedStreak),
        };

        // An active ×2 potion doubles the most valuable approved claim.
        let potionActive = state.potionActive;
        let potionClaim: PendingClaim | null = null;

        if (potionActive && approved.length > 0) {
          potionClaim = approved.reduce((best, claim) =>
            claim.xpReward + claim.goldReward > best.xpReward + best.goldReward
              ? claim
              : best
          );
          potionActive = false;
        }

        let xpGain = 0;
        let goldGain = 0;

        for (const claim of approved) {
          const potionMultiplier = claim === potionClaim ? 2 : 1;
          xpGain += Math.round(claim.xpReward * rewardMultiplier * potionMultiplier);
          goldGain += Math.round(claim.goldReward * rewardMultiplier * potionMultiplier);

          // Mark the quest completed only if its cycle is still current;
          // late approvals from a past day/week just pay out the reward.
          if (
            claim.questType === "daily" &&
            claim.cycleKey === dailyProgress.cycleKey &&
            !dailyProgress.completedIds.includes(claim.questId)
          ) {
            dailyProgress = {
              ...dailyProgress,
              completedIds: [...dailyProgress.completedIds, claim.questId],
            };
          }

          // Путь недели: помним одобренные дневные задания до конца недели,
          // даже когда дневной прогресс уже обнулился ночью. Считаем по дню
          // самого задания, чтобы вчерашнее одобрение не попало в новую неделю.
          if (claim.questType === "daily") {
            const claimDay = dateFromDailyCycleKey(claim.cycleKey);
            const claimWeekKey = claimDay
              ? getWeeklyCycleKey(parseLocalDate(claimDay))
              : null;
            const weekDoneIds = weeklyProgress.weekDoneIds ?? [];

            if (
              claimWeekKey === weeklyProgress.cycleKey &&
              !weekDoneIds.includes(claim.questId)
            ) {
              weeklyProgress = {
                ...weeklyProgress,
                weekDoneIds: [...weekDoneIds, claim.questId],
              };
            }
          }

          if (
            claim.questType === "weekly" &&
            claim.cycleKey === weeklyProgress.cycleKey &&
            !weeklyProgress.completedIds.includes(claim.questId)
          ) {
            weeklyProgress = {
              ...weeklyProgress,
              completedIds: [...weeklyProgress.completedIds, claim.questId],
            };
          }
        }

        /**
         * Проект недели закрывается сам, когда одобрен последний шаг.
         *
         * Раньше его надо было сдавать отдельной кнопкой — но последний шаг
         * и есть итоговый рендер, то есть ученик отправлял куратору ту же
         * картинку второй раз и получал за неё вторую награду. Теперь награда
         * приходит как бонус за собранный проект: лишней проверки нет,
         * двойной оплаты за один скриншот тоже.
         */
        const weekProject = getWeekProject(weeklyProgress.cycleKey);
        const weekDone = weeklyProgress.weekDoneIds ?? [];
        const projectFinished = weekProject.steps.every((step) =>
          weekDone.includes(step.id)
        );

        if (
          projectFinished &&
          !weeklyProgress.completedIds.includes(weekProject.id)
        ) {
          xpGain += weekProject.xpReward;
          goldGain += weekProject.goldReward;
          weeklyProgress = {
            ...weeklyProgress,
            completedIds: [...weeklyProgress.completedIds, weekProject.id],
          };
        }

        if (approved.length > 0) {
          triggerRewardConfetti();
        }

        const nextXp = state.xp + xpGain;

        // Одобрение важнее отказа: если куратор разом закрыл несколько заявок,
        // ученик должен сначала увидеть, что ему засчитали.
        const decided = approved.length > 0 ? approved : rejected;
        const claimNotice: ClaimNotice | null =
          decided.length > 0
            ? {
                tone: approved.length > 0 ? "approved" : "rejected",
                title: decided[0].questTitle,
                count: decided.length,
                xp: xpGain,
                gold: goldGain,
                bonusPercent,
                potionUsed: potionClaim !== null,
              }
            : null;

        set({
          xp: nextXp,
          gold: state.gold + goldGain,
          streakDays,
          frozenDays,
          streakFreezes,
          potionActive,
          stats,
          dailyProgress,
          weeklyProgress,
          pendingClaims: remaining,
          claimNotice,
          ...getLevelData(nextXp),
        });

        queueCloudSave(get);
        return {
          approved,
          rejected,
          xpGranted: xpGain,
          goldGranted: goldGain,
          bonusPercent,
          potionUsedOn: potionClaim?.questTitle ?? null,
        };
      },

      buyStreakFreeze: () => {
        const state = get();

        if (state.streakFreezes >= STREAK_FREEZE_MAX) return false;
        if (state.gold < STREAK_FREEZE_COST) return false;

        triggerRewardConfetti();

        set({
          gold: state.gold - STREAK_FREEZE_COST,
          streakFreezes: state.streakFreezes + 1,
          stats: {
            ...state.stats,
            goldSpent: state.stats.goldSpent + STREAK_FREEZE_COST,
          },
        });

        queueCloudSave(get);
        return true;
      },

      buyDoublePotion: () => {
        const state = get();

        if (state.doublePotions >= DOUBLE_POTION_MAX) return false;
        if (state.gold < DOUBLE_POTION_COST) return false;

        triggerRewardConfetti();

        set({
          gold: state.gold - DOUBLE_POTION_COST,
          doublePotions: state.doublePotions + 1,
          stats: {
            ...state.stats,
            goldSpent: state.stats.goldSpent + DOUBLE_POTION_COST,
          },
        });

        queueCloudSave(get);
        return true;
      },

      activateDoublePotion: () => {
        const state = get();

        if (state.potionActive || state.doublePotions === 0) return false;

        set({
          doublePotions: state.doublePotions - 1,
          potionActive: true,
        });

        queueCloudSave(get);
        return true;
      },

      autoApplyStreakFreeze: () => {
        const state = get();

        if (state.streakFreezes === 0) return;

        const gapDay = findFreezeGapDay(
          new Set([...state.streakDays, ...state.frozenDays]),
          getPendingDailyDays(state.pendingClaims)
        );

        if (!gapDay) return;

        set({
          streakFreezes: state.streakFreezes - 1,
          frozenDays: mergeStreakDays(state.frozenDays, [gapDay]),
        });

        queueCloudSave(get);
      },

      markAchievementsSeen: (ids) => {
        const state = get();
        const unseen = ids.filter((id) => !state.seenAchievements.includes(id));

        if (unseen.length === 0) return;

        set({ seenAchievements: [...state.seenAchievements, ...unseen] });
        queueCloudSave(get);
      },

      markEvolutionSeen: (stageLevel) => {
        const state = get();

        if (state.celebratedStages.includes(stageLevel)) return;

        set({
          celebratedStages: [...state.celebratedStages, stageLevel],
          celebratedStageLevel: Math.max(state.celebratedStageLevel, stageLevel),
        });
        queueCloudSave(get);
      },

      // Отмечает визит и говорит, сколько дней ученика не было.
      // Нужно для встречи после паузы — и пригодится системе ухода.
      markVisit: () => {
        const state = get();
        const today = formatLocalDate(new Date());

        if (state.lastSeenDate === today) return 0;

        const daysAway = state.lastSeenDate
          ? Math.round(
              (new Date(today).getTime() - new Date(state.lastSeenDate).getTime()) /
                86400000
            )
          : 0;

        set({ lastSeenDate: today });
        queueCloudSave(get);

        return daysAway;
      },

      markLevelUpSeen: (level) => {
        const state = get();

        if (level <= state.celebratedLevel) return;

        set({ celebratedLevel: level });
        queueCloudSave(get);
      },

      // Уход тратит припас со склада и поднимает шкалу. Голду НЕ приносит:
      // иначе получается бесконечный фарм пальцем — см. care-config.ts.
      careFor: (needId, supplyId) => {
        const state = get();
        const supply = getCareSupply(supplyId);

        if (!supply || supply.need !== needId) return false;
        if ((state.supplies[supplyId] ?? 0) <= 0) return false;

        const need = getCareNeed(needId);

        set({
          supplies: {
            ...state.supplies,
            [supplyId]: state.supplies[supplyId] - 1,
          },
          care: {
            ...state.care,
            [needId]: applyRestore(
              state.care[needId] ?? null,
              need.decayHours,
              supply.restores
            ),
          },
        });

        queueCloudSave(get);

        return true;
      },

      buySupply: (supplyId) => {
        const state = get();
        const supply = getCareSupply(supplyId);

        if (!supply) return false;
        if (state.gold < supply.cost) return false;
        if ((state.supplies[supplyId] ?? 0) >= SUPPLY_MAX) return false;

        set({
          gold: state.gold - supply.cost,
          supplies: {
            ...state.supplies,
            [supplyId]: (state.supplies[supplyId] ?? 0) + 1,
          },
          stats: {
            ...state.stats,
            goldSpent: state.stats.goldSpent + supply.cost,
          },
        });

        queueCloudSave(get);

        return true;
      },

      petGhost: () => {
        const state = get();
        const today = formatLocalDate(new Date());
        const countToday = state.pettingDate === today ? state.pettingCount : 0;

        // Совет выпадает по счётчику нажатий, а не по выданному XP:
        // гладить можно сколько угодно, XP кончается через 10 раз в день.
        const taps = state.petTapsTotal + 1;
        const tipDue = taps >= state.nextTipAt;
        const tip = tipDue ? pickTip(state.tipCursor) : null;

        const tipState = tipDue
          ? {
              petTapsTotal: 0,
              tipCursor: state.tipCursor + 1,
              nextTipAt: randomTipInterval(),
            }
          : { petTapsTotal: taps };

        if (countToday >= PETTING_DAILY_LIMIT) {
          set(tipState);
          queueCloudSave(get);
          return { granted: false, tip };
        }

        const nextXp = state.xp + 1;

        set({
          ...tipState,
          pettingDate: today,
          pettingCount: countToday + 1,
          xp: nextXp,
          ...getLevelData(nextXp),
        });

        queueCloudSave(get);
        return { granted: true, tip };
      },

      answerQuizQuestion: (questionId, correct) => {
        const state = get();
        const today = formatLocalDate(new Date());
        const answered = state.quizDate === today ? state.quizAnswered : [];

        if (answered.includes(questionId)) return false;

        const nextXp = state.xp + (correct ? QUIZ_XP_PER_CORRECT : 0);

        set({
          quizDate: today,
          quizAnswered: [...answered, questionId],
          xp: nextXp,
          gold: state.gold + (correct ? QUIZ_GOLD_PER_CORRECT : 0),
          ...getLevelData(nextXp),
        });

        queueCloudSave(get);
        return true;
      },

      // The chest only appears on days the curator counted real practice —
      // a variable reward, but strictly gated behind actual work.
      openDailyChest: () => {
        const state = get();
        const today = formatLocalDate(new Date());

        if (state.chestDate === today) return null;

        const streak = getStreakInfo(
          state.streakDays,
          state.pendingClaims,
          state.frozenDays
        );
        if (!streak.todayCounted) return null;

        // 5–25 голды, с шансом 10% — джекпот 50
        const gold =
          Math.random() < 0.1 ? 50 : 5 + Math.floor(Math.random() * 21);

        triggerRewardConfetti();

        set({ chestDate: today, gold: state.gold + gold });

        queueCloudSave(get);
        return gold;
      },

      refreshQuestCycles: () => {
        const state = get();
        const recurringPatch = getRecurringProgressPatch(state);

        if (!recurringPatch) return;

        set(recurringPatch);
        queueCloudSave(get);
      },

      // Купленная вещь сразу надевается: ребёнок платит, чтобы УВИДЕТЬ обновку,
      // а не чтобы положить её в шкаф. Если место занято, прежняя вещь
      // снимается сама — снять и переодеться можно в магазине.
      buyItem: (itemId, cost, itemName) => {
        const state = get();
        const item = getShopItem(itemId);

        // Замок по уровню держится здесь, а не только в кнопке магазина:
        // кнопку можно обойти, а покупку — нет.
        if (item && state.level < (item.fromLevel ?? 1)) return false;

        if (state.gold >= cost && !state.inventory.includes(itemName)) {
          triggerRewardConfetti();

          set({
            gold: state.gold - cost,
            inventory: [...state.inventory, itemName],
            equipped: item ? equipInSlot(state.equipped, item) : state.equipped,
            stats: {
              ...state.stats,
              goldSpent: state.stats.goldSpent + cost,
            },
          });

          queueCloudSave(get);
          return true;
        }

        return false;
      },

      wearItem: (itemId) => {
        const state = get();
        const item = getShopItem(itemId);

        if (!item) return false;
        if (!state.inventory.includes(item.name)) return false;

        set({ equipped: equipInSlot(state.equipped, item) });
        queueCloudSave(get);

        return true;
      },

      takeOffItem: (itemId) => {
        const state = get();
        const item = getShopItem(itemId);

        if (!item) return;
        if (state.equipped[item.slot] !== item.id) return;

        set({ equipped: clearSlot(state.equipped, item.slot) });
        queueCloudSave(get);
      },

      resetGame: () => {
        set((state) => ({
          username: state.username,
          telegramUserId: state.telegramUserId,
          telegramUsername: state.telegramUsername,
          telegramFirstName: state.telegramFirstName,
          isUsernameCustomized: state.isUsernameCustomized,
          cloudSyncAvailable: state.cloudSyncAvailable,
          xp: 0,
          gold: 0,
          inventory: [],
          equipped: {},
          completedQuests: [],
          streakDays: [],
          frozenDays: [],
          streakFreezes: 0,
          doublePotions: 0,
          potionActive: false,
          stats: createDefaultStats(),
          seenAchievements: [],
          celebratedStages: [],
          celebratedStageLevel: 1,
          celebratedLevel: 1,
          pettingDate: "",
          pettingCount: 0,
          quizDate: "",
          quizAnswered: [],
          chestDate: "",
          petTapsTotal: 0,
          nextTipAt: randomTipInterval(),
          tipCursor: 0,
          lastSeenDate: formatLocalDate(new Date()),
          care: createFreshCare(),
          supplies: { ...STARTER_SUPPLIES },
          starterSuppliesGiven: true,
          dailyProgress: createDailyProgress(),
          weeklyProgress: createWeeklyProgress(),
          pendingClaims: [],
          ...getLevelData(0),
        }));

        // Сброс обязан немедленно перезаписать облако Telegram: отложенное
        // сохранение может не успеть до закрытия приложения, и тогда старые
        // данные «воскреснут» при следующем запуске из-за max/union-слияния.
        void flushCloudSave(get());
      },

      // Ставит опыт ровно в начало выбранного уровня. Стадии ниже и сама
      // текущая помечаются отпразднованными, иначе на каждый сдвиг ползунка
      // выскакивала бы анимация эволюции — для неё есть отдельная кнопка.
      devSetLevel: (level) => {
        const target = Math.max(
          1,
          Math.min(LEVEL_THRESHOLDS.length, Math.round(level))
        );
        const xp = LEVEL_THRESHOLDS[target - 1];
        const stage = getPetStage(target);

        set({
          xp,
          ...getLevelData(xp),
          celebratedStages: PET_STAGES.filter(
            (candidate) => candidate.fromLevel <= stage.fromLevel
          ).map((candidate) => candidate.fromLevel),
          celebratedStageLevel: stage.fromLevel,
          celebratedLevel: target,
        });

        void flushCloudSave(get());
      },

      devSetGold: (gold) => {
        set({ gold: Math.max(0, Math.round(gold)) });
        void flushCloudSave(get());
      },

      // Забывает текущую стадию — при следующем открытии App.tsx покажет
      // полноэкранную эволюцию в неё.
      devReplayEvolution: () => {
        const state = get();
        const stage = getPetStage(state.level);

        set({
          celebratedStages: PET_STAGES.filter(
            (candidate) => candidate.fromLevel < stage.fromLevel
          ).map((candidate) => candidate.fromLevel),
          celebratedStageLevel: 1,
        });

        void flushCloudSave(get());
      },

      bootstrapTelegramCloud: async () => {
        const telegramUser = getTelegramUser();
        const cloudState = await readCloudState();
        const cloudSyncAvailable = Boolean(getTelegramCloudStorage());

        set((state) => {
          const nextIsUsernameCustomized =
            cloudState?.profile?.isUsernameCustomized ?? state.isUsernameCustomized;

          const telegramDisplayName = getTelegramDisplayName(telegramUser);

          const nextUsername =
            cloudState?.profile?.username ??
            (nextIsUsernameCustomized
              ? state.username
              : telegramDisplayName || state.username);

          const nextXp = cloudState?.progress?.xp ?? state.xp;
          const nextGold = cloudState?.progress?.gold ?? state.gold;
          const nextInventory = cloudState?.progress?.inventory ?? state.inventory;
          // Надетое идёт следом за покупками: облако главнее, как с голдой.
          // Чистка убирает вещи, которых в этом инвентаре нет — иначе после
          // сброса на другом устройстве призрак остался бы в чужой шляпе.
          // Если в облаке лежит запись старого образца (покупки есть, надетого
          // нет) — одеваем призрака по покупкам, чтобы он не разделся сам.
          const localEquipped =
            Object.keys(state.equipped).length > 0
              ? state.equipped
              : seedEquippedFromInventory(nextInventory);
          const nextEquipped = sanitizeEquipped(
            cloudState?.progress?.equipped ?? localEquipped,
            nextInventory
          );
          const nextCompletedQuests =
            cloudState?.completed?.completedQuests ?? state.completedQuests;
          const nextDailyProgress =
            cloudState?.recurring?.dailyProgress ?? state.dailyProgress;
          const nextWeeklyProgress =
            cloudState?.recurring?.weeklyProgress ?? state.weeklyProgress;

          // Streak days only ever accumulate, so a cross-device union is safe.
          const cloudStreakDays = cloudState?.streak?.streakDays;
          const nextStreakDays = Array.isArray(cloudStreakDays)
            ? mergeStreakDays(state.streakDays, cloudStreakDays)
            : state.streakDays;

          const cloudFrozenDays = cloudState?.streak?.frozenDays;
          const nextFrozenDays = Array.isArray(cloudFrozenDays)
            ? mergeStreakDays(state.frozenDays, cloudFrozenDays)
            : state.frozenDays;

          // Consumables follow the balance: the cloud copy wins, like gold.
          const nextStreakFreezes =
            cloudState?.progress?.streakFreezes ?? state.streakFreezes;
          const nextDoublePotions =
            cloudState?.progress?.doublePotions ?? state.doublePotions;
          const nextPotionActive =
            cloudState?.progress?.potionActive ?? state.potionActive;

          // Lifetime counters only grow, so take the max of each across devices.
          const cloudStats = cloudState?.statsData?.stats;
          const nextStats: GameStats = {
            approvedQuestsTotal: Math.max(
              state.stats.approvedQuestsTotal,
              cloudStats?.approvedQuestsTotal ?? 0
            ),
            goldSpent: Math.max(state.stats.goldSpent, cloudStats?.goldSpent ?? 0),
            bestStreak: Math.max(state.stats.bestStreak, cloudStats?.bestStreak ?? 0),
          };

          const coveredNow = new Set([...nextStreakDays, ...nextFrozenDays]);
          const todayStr = formatLocalDate(new Date());
          const chainNow =
            chainLengthEndingAt(coveredNow, todayStr) ||
            chainLengthEndingAt(coveredNow, previousDayString(todayStr));
          nextStats.bestStreak = Math.max(nextStats.bestStreak, chainNow);

          const cloudSeen = cloudState?.statsData?.seenAchievements;
          const nextSeenAchievements = Array.isArray(cloudSeen)
            ? Array.from(new Set([...state.seenAchievements, ...cloudSeen]))
            : state.seenAchievements;

          // Evolutions only move forward — celebrate each stage on one device.
          const nextCelebratedStageLevel = Math.max(
            state.celebratedStageLevel,
            cloudState?.statsData?.celebratedStageLevel ?? 1
          );

          const cloudStages = cloudState?.statsData?.celebratedStages;
          const knownStages = Array.from(
            new Set([
              ...state.celebratedStages,
              ...(Array.isArray(cloudStages) ? cloudStages : []),
            ])
          );
          // Первый запуск после обновления: списка ещё нет, зато есть старое
          // «докуда дошли». Считаем виденными стадии НИЖЕ текущей — их ученик
          // точно проходил, — а ту, на которой он стоит, нарочно оставляем
          // непразднованной. Если её проглотил прежний способ счёта, анимация
          // один раз доиграет; если нет — она и так уже была показана.
          const nextCelebratedStages =
            knownStages.length > 0 ? knownStages : seedCelebratedStages(nextXp);

          const nextCare = mergeCare(state.care, cloudState?.statsData?.care);

          // Припасы тратятся, поэтому «максимум» тут нельзя — воскресит
          // съеденное. Ведём себя как с голдой: облако главнее.
          const cloudSupplies = cloudState?.statsData?.supplies;
          const starterGiven =
            cloudState?.statsData?.starterSuppliesGiven ??
            state.starterSuppliesGiven;
          const suppliesFromCloud = cloudSupplies ?? state.supplies;
          // Стартовый набор — один раз за жизнь аккаунта.
          const nextSupplies = starterGiven
            ? suppliesFromCloud
            : { ...STARTER_SUPPLIES, ...suppliesFromCloud };

          // Поздравления с уровнем — тоже только вперёд.
          const nextCelebratedLevel = Math.max(
            state.celebratedLevel,
            cloudState?.statsData?.celebratedLevel ?? 1
          );

          const mergedState: GameState = {
            ...state,
            username: nextUsername,
            telegramUserId: telegramUser?.id ?? state.telegramUserId,
            telegramUsername: telegramUser?.username ?? state.telegramUsername,
            telegramFirstName: telegramUser?.first_name ?? state.telegramFirstName,
            isUsernameCustomized: nextIsUsernameCustomized,
            cloudSyncAvailable,
            xp: nextXp,
            gold: nextGold,
            inventory: nextInventory,
            equipped: nextEquipped,
            completedQuests: nextCompletedQuests,
            streakDays: nextStreakDays,
            frozenDays: nextFrozenDays,
            streakFreezes: nextStreakFreezes,
            doublePotions: nextDoublePotions,
            potionActive: nextPotionActive,
            stats: nextStats,
            seenAchievements: nextSeenAchievements,
            celebratedStages: nextCelebratedStages,
            celebratedStageLevel: nextCelebratedStageLevel,
            celebratedLevel: nextCelebratedLevel,
            care: nextCare,
            supplies: nextSupplies,
            starterSuppliesGiven: true,
            dailyProgress: nextDailyProgress,
            weeklyProgress: nextWeeklyProgress,
            ...getLevelData(nextXp),
          };

          const recurringPatch = getRecurringProgressPatch(mergedState);

          return {
            ...mergedState,
            ...(recurringPatch ?? {}),
          };
        });

        const shouldSeedCloud =
          cloudSyncAvailable &&
          (!cloudState ||
            !cloudState.profile ||
            !cloudState.progress ||
            !cloudState.recurring ||
            !cloudState.completed ||
            !cloudState.streak ||
            !cloudState.statsData);

        if (shouldSeedCloud) {
          queueCloudSave(get);
        }
      },

      syncCloudState: async () => {
        const state = get();

        if (!state.cloudSyncAvailable) {
          return false;
        }

        return writeCloudState(state);
      },
    }),
    {
      name: "3dbuddy-storage",
      partialize: (state): PersistedGameState => ({
        username: state.username,
        telegramUserId: state.telegramUserId,
        telegramUsername: state.telegramUsername,
        telegramFirstName: state.telegramFirstName,
        isUsernameCustomized: state.isUsernameCustomized,
        xp: state.xp,
        gold: state.gold,
        inventory: state.inventory,
        equipped: state.equipped,
        completedQuests: state.completedQuests,
        streakDays: state.streakDays,
        frozenDays: state.frozenDays,
        streakFreezes: state.streakFreezes,
        doublePotions: state.doublePotions,
        potionActive: state.potionActive,
        stats: state.stats,
        seenAchievements: state.seenAchievements,
        celebratedStageLevel: state.celebratedStageLevel,
        celebratedStages: state.celebratedStages,
        celebratedLevel: state.celebratedLevel,
        care: state.care,
        supplies: state.supplies,
        starterSuppliesGiven: state.starterSuppliesGiven,
        pettingDate: state.pettingDate,
        pettingCount: state.pettingCount,
        quizDate: state.quizDate,
        quizAnswered: state.quizAnswered,
        chestDate: state.chestDate,
        dailyProgress: state.dailyProgress,
        weeklyProgress: state.weeklyProgress,
        pendingClaims: state.pendingClaims,
        petTapsTotal: state.petTapsTotal,
        nextTipAt: state.nextTipAt,
        tipCursor: state.tipCursor,
        lastSeenDate: state.lastSeenDate,
      }),
      merge: (persistedState, currentState) => {
        const typedState = (persistedState as Partial<PersistedGameState>) || {};
        const xp = typedState.xp ?? currentState.xp;

        const inventory = typedState.inventory ?? currentState.inventory;

        const mergedState: GameState = {
          ...currentState,
          ...typedState,
          // Гардероб чистится при каждом запуске: вещь могли убрать из магазина
          // или переселить на другое место, и тогда её id повис бы мёртвым
          // грузом на занятом слоте. А если поля ещё нет совсем — это первый
          // запуск после обновления, и надетое собирается из старых покупок.
          equipped: typedState.equipped
            ? sanitizeEquipped(typedState.equipped, inventory)
            : seedEquippedFromInventory(inventory),
          ...getLevelData(xp),
        };

        const recurringPatch = getRecurringProgressPatch(mergedState);

        return {
          ...mergedState,
          ...(recurringPatch ?? {}),
        };
      },
    }
  )
);
