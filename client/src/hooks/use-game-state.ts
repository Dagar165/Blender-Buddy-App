import { create } from "zustand";
import { persist } from "zustand/middleware";
import confetti from "canvas-confetti";
import type { ClaimStatus } from "@/lib/quest-claim";

export const LEVEL_THRESHOLDS = [
  0,     // level 1
  40,    // level 2
  100,   // level 3
  185,   // level 4
  300,   // level 5
  450,   // level 6
  640,   // level 7
  875,   // level 8
  1160,  // level 9
  1500,  // level 10
  1900,  // level 11
  2350,  // level 12
  2850,  // level 13
  3400,  // level 14
  4000,  // level 15
  4650,  // level 16
  5350,  // level 17
  6100,  // level 18
  6900,  // level 19
  7750,  // level 20
  8650,  // level 21
  9600,  // level 22
  10600, // level 23
  11650, // level 24
  12750, // level 25
  13900, // level 26
  15100, // level 27
  16350, // level 28
  17650, // level 29
  19000, // level 30
];

// Streak: a day counts once a daily quest SUBMITTED that day is approved.
// Crediting by submission date keeps curator review lag from burning streaks.
export const STREAK_BONUS_PER_DAY = 5;
export const STREAK_BONUS_CAP = 50;
const STREAK_DAYS_KEPT = 120;

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
};

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
};

type LoadedCloudState = {
  profile?: Partial<CloudProfileData>;
  progress?: Partial<CloudProgressData>;
  recurring?: Partial<CloudRecurringData>;
  completed?: Partial<CloudCompletedData>;
  streak?: Partial<CloudStreakData>;
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
  };

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
  | "dailyProgress"
  | "weeklyProgress"
  | "pendingClaims"
>;

const CLOUD_PROFILE_KEY = "bb_profile_v1";
const CLOUD_PROGRESS_KEY = "bb_progress_v1";
const CLOUD_RECURRING_KEY = "bb_recurring_v1";
const CLOUD_COMPLETED_KEY = "bb_completed_v1";
const CLOUD_STREAK_KEY = "bb_streak_v1";

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

const triggerRewardConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#3B82F6", "#F97316", "#FACC15"],
    });

    confetti({
      particleCount: 5,
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
  pendingClaims: PendingClaim[]
): StreakInfo => {
  const covered = new Set(streakDays);

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

const createDailyProgress = (): RecurringQuestProgress => ({
  cycleKey: getDailyCycleKey(),
  completedIds: [],
});

const createWeeklyProgress = (): RecurringQuestProgress => ({
  cycleKey: getWeeklyCycleKey(),
  completedIds: [],
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

        const hasAnyData = Boolean(profile || progress || recurring || completed || streak);

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
>) => {
  const profilePayload: CloudProfileData = {
    username: state.username,
    isUsernameCustomized: state.isUsernameCustomized,
  };

  const progressPayload: CloudProgressData = {
    xp: state.xp,
    gold: state.gold,
    inventory: state.inventory,
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
  };

  return {
    profilePayload,
    progressPayload,
    recurringPayload,
    completedPayload,
    streakPayload,
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
  } = buildCloudPayloads(state);

  const results = await Promise.all([
    cloudSetItem(CLOUD_PROFILE_KEY, JSON.stringify(profilePayload)),
    cloudSetItem(CLOUD_PROGRESS_KEY, JSON.stringify(progressPayload)),
    cloudSetItem(CLOUD_RECURRING_KEY, JSON.stringify(recurringPayload)),
    cloudSetItem(CLOUD_COMPLETED_KEY, JSON.stringify(completedPayload)),
    cloudSetItem(CLOUD_STREAK_KEY, JSON.stringify(streakPayload)),
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
          return { approved, rejected, xpGranted: 0, goldGranted: 0, bonusPercent: 0 };
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

        const today = formatLocalDate(new Date());
        const chainToday = chainLengthEndingAt(creditedDays, today);
        const confirmedStreak =
          chainToday > 0
            ? chainToday
            : chainLengthEndingAt(creditedDays, previousDayString(today));
        const bonusPercent = getStreakBonusPercent(confirmedStreak);
        const rewardMultiplier = 1 + bonusPercent / 100;

        let xpGain = 0;
        let goldGain = 0;

        for (const claim of approved) {
          xpGain += Math.round(claim.xpReward * rewardMultiplier);
          goldGain += Math.round(claim.goldReward * rewardMultiplier);

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
        };
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
          dailyProgress: createDailyProgress(),
          weeklyProgress: createWeeklyProgress(),
          pendingClaims: [],
          ...getLevelData(0),
        }));

        queueCloudSave(get);
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
            !cloudState.streak);

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
        dailyProgress: state.dailyProgress,
        weeklyProgress: state.weeklyProgress,
        pendingClaims: state.pendingClaims,
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
