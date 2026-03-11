import { create } from "zustand";
import { persist } from "zustand/middleware";
import confetti from "canvas-confetti";

export const LEVEL_THRESHOLDS = [
  0,    // level 1
  40,   // level 2
  100,  // level 3
  185,  // level 4
  300,  // level 5
  450,  // level 6
  640,  // level 7
  875,  // level 8
  1160, // level 9
  1500, // level 10
];

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

type LoadedCloudState = {
  profile?: Partial<CloudProfileData>;
  progress?: Partial<CloudProgressData>;
  recurring?: Partial<CloudRecurringData>;
  completed?: Partial<CloudCompletedData>;
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

  dailyProgress: RecurringQuestProgress;
  weeklyProgress: RecurringQuestProgress;

  setUsername: (name: string) => void;
  addXpAndGold: (xp: number, gold: number) => void;

  completeQuest: (questId: string, xp: number, gold: number) => void;
  completeDailyQuest: (questId: string, xp: number, gold: number) => boolean;
  completeWeeklyQuest: (questId: string, xp: number, gold: number) => boolean;

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
  | "dailyProgress"
  | "weeklyProgress"
>;

const CLOUD_PROFILE_KEY = "bb_profile_v1";
const CLOUD_PROGRESS_KEY = "bb_progress_v1";
const CLOUD_RECURRING_KEY = "bb_recurring_v1";
const CLOUD_COMPLETED_KEY = "bb_completed_v1";

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

        const hasAnyData = Boolean(profile || progress || recurring || completed);

        if (!hasAnyData) {
          resolve(null);
          return;
        }

        resolve({
          profile: profile ?? undefined,
          progress: progress ?? undefined,
          recurring: recurring ?? undefined,
          completed: completed ?? undefined,
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

  return {
    profilePayload,
    progressPayload,
    recurringPayload,
    completedPayload,
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
  } = buildCloudPayloads(state);

  const results = await Promise.all([
    cloudSetItem(CLOUD_PROFILE_KEY, JSON.stringify(profilePayload)),
    cloudSetItem(CLOUD_PROGRESS_KEY, JSON.stringify(progressPayload)),
    cloudSetItem(CLOUD_RECURRING_KEY, JSON.stringify(recurringPayload)),
    cloudSetItem(CLOUD_COMPLETED_KEY, JSON.stringify(completedPayload)),
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

      dailyProgress: createDailyProgress(),
      weeklyProgress: createWeeklyProgress(),

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

      completeQuest: (questId, xpReward, goldReward) => {
        const state = get();

        if (state.completedQuests.includes(questId)) return;

        const nextXp = state.xp + xpReward;

        triggerRewardConfetti();

        set({
          xp: nextXp,
          gold: state.gold + goldReward,
          completedQuests: [...state.completedQuests, questId],
          ...getLevelData(nextXp),
        });

        queueCloudSave(get);
      },

      completeDailyQuest: (questId, xpReward, goldReward) => {
        const state = get();
        const recurringPatch = getRecurringProgressPatch(state);

        const activeDailyProgress =
          recurringPatch?.dailyProgress ?? state.dailyProgress;

        if (activeDailyProgress.completedIds.includes(questId)) {
          return false;
        }

        const nextXp = state.xp + xpReward;

        triggerRewardConfetti();

        set({
          ...(recurringPatch ?? {}),
          xp: nextXp,
          gold: state.gold + goldReward,
          dailyProgress: {
            ...activeDailyProgress,
            completedIds: [...activeDailyProgress.completedIds, questId],
          },
          ...getLevelData(nextXp),
        });

        queueCloudSave(get);
        return true;
      },

      completeWeeklyQuest: (questId, xpReward, goldReward) => {
        const state = get();
        const recurringPatch = getRecurringProgressPatch(state);

        const activeWeeklyProgress =
          recurringPatch?.weeklyProgress ?? state.weeklyProgress;

        if (activeWeeklyProgress.completedIds.includes(questId)) {
          return false;
        }

        const nextXp = state.xp + xpReward;

        triggerRewardConfetti();

        set({
          ...(recurringPatch ?? {}),
          xp: nextXp,
          gold: state.gold + goldReward,
          weeklyProgress: {
            ...activeWeeklyProgress,
            completedIds: [...activeWeeklyProgress.completedIds, questId],
          },
          ...getLevelData(nextXp),
        });

        queueCloudSave(get);
        return true;
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
          dailyProgress: createDailyProgress(),
          weeklyProgress: createWeeklyProgress(),
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
            !cloudState.completed);

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
        dailyProgress: state.dailyProgress,
        weeklyProgress: state.weeklyProgress,
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
