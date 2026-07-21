import { create } from "zustand";
import { persist } from "zustand/middleware";
import confetti from "canvas-confetti";
import type { ClaimStatus } from "@/lib/quest-claim";
import {
  DOUBLE_POTION_COST,
  DOUBLE_POTION_MAX,
  STREAK_FREEZE_COST,
  STREAK_FREEZE_MAX,
} from "@/lib/shop-config";
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

/**
 * Кривая опыта (пересчитана 19.07.2026 по решению владельца).
 *
 * Считали так: идеальный будний день = шаг проекта недели (150 XP)
 * + разминка (40) + квиз (20) + поглаживания (10) + доля самого проекта
 * (400 XP за неделю ≈ 57) ≈ 277 XP, плюс бонус серии до +50% и зелье ×2 →
 * около 540–570 XP в день у отличника. 30-й уровень стоит ~23 000 XP, то есть
 * берётся примерно за 43 дня — полтора месяца при соблюдении ВСЕХ критериев,
 * как и просил владелец (20.07: разминка добавила ~40 XP в день, срок
 * сдвинулся с 50 дней к 43 — это ещё внутри «полтора-два месяца»).
 *
 * Если будешь менять награды за шаги (projects-config.ts) — пересчитай и это.
 *
 * Форма кривой: цена уровня растёт линейно (120 XP за 2-й, +48 XP за каждый
 * следующий). Первые уровни намеренно быстрые — новичок должен сразу увидеть
 * движение; растянута середина и верх.
 *
 * Если менять — держи в голове обе стороны: и отличника с зельями (~460 XP/день),
 * и обычного ребёнка с одним заданием (~80 XP/день).
 */
export const LEVEL_THRESHOLDS = [
  0,     // level 1
  120,   // level 2
  290,   // level 3
  500,   // level 4
  770,   // level 5
  1080,  // level 6
  1440,  // level 7
  1850,  // level 8
  2300,  // level 9
  2800,  // level 10
  3360,  // level 11
  3960,  // level 12
  4600,  // level 13
  5300,  // level 14
  6050,  // level 15
  6840,  // level 16
  7680,  // level 17
  8570,  // level 18
  9500,  // level 19
  10490, // level 20
  11520, // level 21
  12600, // level 22
  13730, // level 23
  14900, // level 24
  16130, // level 25
  17400, // level 26
  18720, // level 27
  20090, // level 28
  21500, // level 29
  22970, // level 30
];

// Streak: a day counts once a daily quest SUBMITTED that day is approved.
// Crediting by submission date keeps curator review lag from burning streaks.
export const STREAK_BONUS_PER_DAY = 5;
export const STREAK_BONUS_CAP = 50;
const STREAK_DAYS_KEPT = 120;

// Petting the ghost grants a tiny XP treat, capped per day so the real
// progress still comes from quests.
export const PETTING_DAILY_LIMIT = 10;

// Через сколько нажатий призрак выдаст следующий совет по Blender.
const randomTipInterval = () =>
  TIP_MIN_TAPS + Math.floor(Math.random() * (TIP_MAX_TAPS - TIP_MIN_TAPS + 1));

type LevelData = {
  level: number;
  currentLevelStartXp: number;
  nextLevelXp: number;
  progressInLevel: number;
  requiredForNextLevel: number;
  xpToNextLevel: number;
  xpProgress: number;
};

type RecurringQuestProgress = {
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

type TelegramUserData = {
  id?: number;
  username?: string;
  first_name?: string;
};

type TelegramCloudStorage = {
  setItem: (
    key: string,
    value: string,
    callback?: (error: unknown, stored?: boolean) => void
  ) => void;
  getItems: (
    keys: string[],
    callback: (error: unknown, values?: Record<string, string>) => void
  ) => void;
};

type CloudProfileData = {
  username: string;
  isUsernameCustomized: boolean;
};

type CloudProgressData = {
  xp: number;
  gold: number;
  inventory: string[];
  streakFreezes?: number;
  doublePotions?: number;
  potionActive?: boolean;
};

type CloudRecurringData = {
  dailyProgress: RecurringQuestProgress;
  weeklyProgress: RecurringQuestProgress;
};

type CloudCompletedData = {
  completedQuests: string[];
};

type CloudStreakData = {
  streakDays: string[];
  frozenDays?: string[];
};

type CloudStatsData = {
  stats: GameStats;
  seenAchievements: string[];
  celebratedStageLevel?: number;
  celebratedStages?: number[];
  celebratedLevel?: number;
  care?: Partial<Record<CareNeedId, string | null>>;
  supplies?: Record<string, number>;
  starterSuppliesGiven?: boolean;
};

type LoadedCloudState = {
  profile?: Partial<CloudProfileData>;
  progress?: Partial<CloudProgressData>;
  recurring?: Partial<CloudRecurringData>;
  completed?: Partial<CloudCompletedData>;
  streak?: Partial<CloudStreakData>;
  statsData?: Partial<CloudStatsData>;
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
  inventory: string[];
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
  resetGame: () => void;

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

const CLOUD_PROFILE_KEY = "bb_profile_v1";
const CLOUD_PROGRESS_KEY = "bb_progress_v1";
const CLOUD_RECURRING_KEY = "bb_recurring_v1";
const CLOUD_COMPLETED_KEY = "bb_completed_v1";
const CLOUD_STREAK_KEY = "bb_streak_v1";
const CLOUD_STATS_KEY = "bb_stats_v1";

let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;

const getLevelData = (totalXp: number): LevelData => {
  let level = 1;

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  const currentLevelStartXp = LEVEL_THRESHOLDS[level - 1];
  const nextLevelXp = LEVEL_THRESHOLDS[level] ?? currentLevelStartXp;

  if (level >= LEVEL_THRESHOLDS.length) {
    return {
      level,
      currentLevelStartXp,
      nextLevelXp: currentLevelStartXp,
      progressInLevel: totalXp - currentLevelStartXp,
      requiredForNextLevel: 0,
      xpToNextLevel: 0,
      xpProgress: 100,
    };
  }

  const progressInLevel = totalXp - currentLevelStartXp;
  const requiredForNextLevel = nextLevelXp - currentLevelStartXp;
  const xpToNextLevel = nextLevelXp - totalXp;
  const xpProgress =
    requiredForNextLevel > 0
      ? Math.min(100, (progressInLevel / requiredForNextLevel) * 100)
      : 100;

  return {
    level,
    currentLevelStartXp,
    nextLevelXp,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
  };
};

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

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatLocalDate = (date: Date) => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const getDailyCycleKey = (date = new Date()) => {
  return `daily-${formatLocalDate(date)}`;
};

const getStartOfWeek = (date = new Date()) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  const day = result.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffFromMonday = day === 0 ? 6 : day - 1;

  result.setDate(result.getDate() - diffFromMonday);
  return result;
};

const getWeeklyCycleKey = (date = new Date()) => {
  return `weekly-${formatLocalDate(getStartOfWeek(date))}`;
};

const previousDayString = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year, (month || 1) - 1, date || 1);
  parsed.setDate(parsed.getDate() - 1);
  return formatLocalDate(parsed);
};

const dateFromDailyCycleKey = (cycleKey: string) => {
  return cycleKey.startsWith("daily-") ? cycleKey.slice("daily-".length) : null;
};

// «2026-07-20» → локальная полночь. Через new Date(строка) нельзя: такая
// строка читается как UTC и западнее Гринвича съезжает на день назад.
const parseLocalDate = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
};

const chainLengthEndingAt = (coveredDays: Set<string>, day: string) => {
  let length = 0;
  let cursor = day;

  while (coveredDays.has(cursor)) {
    length += 1;
    cursor = previousDayString(cursor);
  }

  return length;
};

const getStreakBonusPercent = (streak: number) => {
  return Math.min(STREAK_BONUS_CAP, Math.max(0, (streak - 1) * STREAK_BONUS_PER_DAY));
};

const mergeStreakDays = (base: string[], extra: string[]) => {
  return Array.from(new Set([...base, ...extra])).sort().slice(-STREAK_DAYS_KEPT);
};

// A freeze can only patch YESTERDAY: it must reconnect a real chain (there was
// a streak the day before), and only when no pending claim already covers it —
// a claim awaiting review is not a missed day.
const findFreezeGapDay = (
  confirmedDays: Set<string>,
  pendingDays: Set<string>
) => {
  const yesterday = previousDayString(formatLocalDate(new Date()));

  if (confirmedDays.has(yesterday) || pendingDays.has(yesterday)) return null;
  if (chainLengthEndingAt(confirmedDays, previousDayString(yesterday)) === 0) {
    return null;
  }

  return yesterday;
};

const getPendingDailyDays = (pendingClaims: PendingClaim[]) => {
  const days = new Set<string>();

  for (const claim of pendingClaims) {
    if (claim.questType !== "daily") continue;
    const day = dateFromDailyCycleKey(claim.cycleKey);
    if (day) days.add(day);
  }

  return days;
};

// True the day after a freeze saved the streak — the UI can tell the student.
export const wasYesterdaySavedByFreeze = (frozenDays: string[]) => {
  return frozenDays.includes(previousDayString(formatLocalDate(new Date())));
};

export type StreakInfo = {
  current: number;
  todayCounted: boolean;
  atRisk: boolean;
  bonusPercent: number;
};

// Pending (not yet reviewed) daily claims light the flame right away; if the
// curator rejects them, the claim disappears and the day is uncovered again.
export const getStreakInfo = (
  streakDays: string[],
  pendingClaims: PendingClaim[],
  frozenDays: string[] = []
): StreakInfo => {
  const covered = new Set([...streakDays, ...frozenDays]);

  for (const claim of pendingClaims) {
    if (claim.questType !== "daily") continue;
    const day = dateFromDailyCycleKey(claim.cycleKey);
    if (day) covered.add(day);
  }

  const today = formatLocalDate(new Date());
  const todayCounted = covered.has(today);
  const current = todayCounted
    ? chainLengthEndingAt(covered, today)
    : chainLengthEndingAt(covered, previousDayString(today));

  return {
    current,
    todayCounted,
    atRisk: !todayCounted && current > 0,
    bonusPercent: getStreakBonusPercent(current),
  };
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

const getTelegramWebApp = () => {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
};

const getTelegramCloudStorage = (): TelegramCloudStorage | null => {
  const webApp = getTelegramWebApp();
  const cloudStorage = webApp?.CloudStorage;

  if (!cloudStorage) return null;
  if (typeof cloudStorage.getItems !== "function") return null;
  if (typeof cloudStorage.setItem !== "function") return null;

  return cloudStorage as TelegramCloudStorage;
};

const getTelegramUser = (): TelegramUserData | null => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user ?? null;
};

const getTelegramDisplayName = (user: TelegramUserData | null) => {
  if (!user) return "";
  if (user.first_name?.trim()) return user.first_name.trim();
  if (user.username?.trim()) return user.username.trim();
  return "";
};

const safeParseJson = <T>(value?: string | null): T | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.warn("Failed to parse cloud payload", error);
    return null;
  }
};

const cloudSetItem = (key: string, value: string): Promise<boolean> => {
  const cloudStorage = getTelegramCloudStorage();

  if (!cloudStorage) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    cloudStorage.setItem(key, value, (error, stored) => {
      if (error) {
        console.warn(`CloudStorage setItem failed for key "${key}"`, error);
        resolve(false);
        return;
      }

      resolve(Boolean(stored));
    });
  });
};

const readCloudState = async (): Promise<LoadedCloudState | null> => {
  const cloudStorage = getTelegramCloudStorage();

  if (!cloudStorage) {
    return null;
  }

  return new Promise((resolve) => {
    cloudStorage.getItems(
      [
        CLOUD_PROFILE_KEY,
        CLOUD_PROGRESS_KEY,
        CLOUD_RECURRING_KEY,
        CLOUD_COMPLETED_KEY,
        CLOUD_STREAK_KEY,
        CLOUD_STATS_KEY,
      ],
      (error, values) => {
        if (error) {
          console.warn("CloudStorage getItems failed", error);
          resolve(null);
          return;
        }

        const profile = safeParseJson<CloudProfileData>(values?.[CLOUD_PROFILE_KEY]);
        const progress = safeParseJson<CloudProgressData>(values?.[CLOUD_PROGRESS_KEY]);
        const recurring = safeParseJson<CloudRecurringData>(values?.[CLOUD_RECURRING_KEY]);
        const completed = safeParseJson<CloudCompletedData>(values?.[CLOUD_COMPLETED_KEY]);
        const streak = safeParseJson<CloudStreakData>(values?.[CLOUD_STREAK_KEY]);
        const statsData = safeParseJson<CloudStatsData>(values?.[CLOUD_STATS_KEY]);

        const hasAnyData = Boolean(
          profile || progress || recurring || completed || streak || statsData
        );

        if (!hasAnyData) {
          resolve(null);
          return;
        }

        resolve({
          profile: profile ?? undefined,
          progress: progress ?? undefined,
          recurring: recurring ?? undefined,
          completed: completed ?? undefined,
          streak: streak ?? undefined,
          statsData: statsData ?? undefined,
        });
      }
    );
  });
};

const buildCloudPayloads = (state: Pick<
  GameState,
  | "username"
  | "isUsernameCustomized"
  | "xp"
  | "gold"
  | "inventory"
  | "dailyProgress"
  | "weeklyProgress"
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
  | "care"
  | "supplies"
  | "starterSuppliesGiven"
>) => {
  const profilePayload: CloudProfileData = {
    username: state.username,
    isUsernameCustomized: state.isUsernameCustomized,
  };

  const progressPayload: CloudProgressData = {
    xp: state.xp,
    gold: state.gold,
    inventory: state.inventory,
    streakFreezes: state.streakFreezes,
    doublePotions: state.doublePotions,
    potionActive: state.potionActive,
  };

  const recurringPayload: CloudRecurringData = {
    dailyProgress: state.dailyProgress,
    weeklyProgress: state.weeklyProgress,
  };

  const completedPayload: CloudCompletedData = {
    completedQuests: state.completedQuests,
  };

  const streakPayload: CloudStreakData = {
    streakDays: state.streakDays,
    frozenDays: state.frozenDays,
  };

  const statsPayload: CloudStatsData = {
    stats: state.stats,
    seenAchievements: state.seenAchievements,
    celebratedStageLevel: state.celebratedStageLevel,
    celebratedStages: state.celebratedStages,
    celebratedLevel: state.celebratedLevel,
    care: state.care,
    supplies: state.supplies,
    starterSuppliesGiven: state.starterSuppliesGiven,
  };

  return {
    profilePayload,
    progressPayload,
    recurringPayload,
    completedPayload,
    streakPayload,
    statsPayload,
  };
};

const writeCloudState = async (
  state: Pick<
    GameState,
    | "username"
    | "isUsernameCustomized"
    | "xp"
    | "gold"
    | "inventory"
    | "dailyProgress"
    | "weeklyProgress"
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
    | "care"
    | "supplies"
    | "starterSuppliesGiven"
  >
): Promise<boolean> => {
  if (!getTelegramCloudStorage()) {
    return false;
  }

  const {
    profilePayload,
    progressPayload,
    recurringPayload,
    completedPayload,
    streakPayload,
    statsPayload,
  } = buildCloudPayloads(state);

  const results = await Promise.all([
    cloudSetItem(CLOUD_PROFILE_KEY, JSON.stringify(profilePayload)),
    cloudSetItem(CLOUD_PROGRESS_KEY, JSON.stringify(progressPayload)),
    cloudSetItem(CLOUD_RECURRING_KEY, JSON.stringify(recurringPayload)),
    cloudSetItem(CLOUD_COMPLETED_KEY, JSON.stringify(completedPayload)),
    cloudSetItem(CLOUD_STREAK_KEY, JSON.stringify(streakPayload)),
    cloudSetItem(CLOUD_STATS_KEY, JSON.stringify(statsPayload)),
  ]);

  return results.every(Boolean);
};

const queueCloudSave = (getState: () => GameState) => {
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
  }

  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;

    const state = getState();

    if (!state.cloudSyncAvailable) {
      return;
    }

    void writeCloudState(state);
  }, 700);
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

      ...getLevelData(0),

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

        if (approved.length > 0) {
          triggerRewardConfetti();
        }

        const nextXp = state.xp + xpGain;

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

      buyItem: (_itemId, cost, itemName) => {
        const state = get();

        if (state.gold >= cost && !state.inventory.includes(itemName)) {
          triggerRewardConfetti();

          set({
            gold: state.gold - cost,
            inventory: [...state.inventory, itemName],
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
        if (cloudSaveTimer) {
          clearTimeout(cloudSaveTimer);
          cloudSaveTimer = null;
        }
        void writeCloudState(get());
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

        const mergedState: GameState = {
          ...currentState,
          ...typedState,
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
