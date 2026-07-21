import type { GameState } from "@/hooks/use-game-state";

/**
 * Хранилище Telegram: чтение и запись прогресса в облако мини-аппа.
 *
 * Здесь только «водопровод» — как достучаться до Телеграма и что куда
 * положить. Игровых правил тут нет и быть не должно. Данные разложены по
 * шести ключам, чтобы одна большая запись не перетирала всё сразу.
 *
 * ЛОВУШКА при слиянии: значения, которые могут УМЕНЬШАТЬСЯ (голда, припасы),
 * берутся из облака целиком, а не «максимумом» — иначе потраченное воскресает.
 */

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

const CLOUD_PROFILE_KEY = "bb_profile_v1";
const CLOUD_PROGRESS_KEY = "bb_progress_v1";
const CLOUD_RECURRING_KEY = "bb_recurring_v1";
const CLOUD_COMPLETED_KEY = "bb_completed_v1";
const CLOUD_STREAK_KEY = "bb_streak_v1";
const CLOUD_STATS_KEY = "bb_stats_v1";

let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const getTelegramWebApp = () => {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
};

export const getTelegramCloudStorage = (): TelegramCloudStorage | null => {
  const webApp = getTelegramWebApp();
  const cloudStorage = webApp?.CloudStorage;

  if (!cloudStorage) return null;
  if (typeof cloudStorage.getItems !== "function") return null;
  if (typeof cloudStorage.setItem !== "function") return null;

  return cloudStorage as TelegramCloudStorage;
};

export const getTelegramUser = (): TelegramUserData | null => {
  const webApp = getTelegramWebApp();
  return webApp?.initDataUnsafe?.user ?? null;
};

export const getTelegramDisplayName = (user: TelegramUserData | null) => {
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

export const cloudSetItem = (key: string, value: string): Promise<boolean> => {
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

export const readCloudState = async (): Promise<LoadedCloudState | null> => {
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

export const buildCloudPayloads = (state: Pick<
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

export const writeCloudState = async (
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

export const queueCloudSave = (getState: () => GameState) => {
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

/**
 * Немедленная запись в облако с отменой отложенной.
 *
 * Нужна там, где нельзя ждать 700 мс: сброс прогресса и ручная синхронизация.
 * Если этого не сделать, отложенная запись со старыми данными выполнится
 * ПОСЛЕ сброса и вернёт всё как было.
 */
export const flushCloudSave = (state: GameState): Promise<boolean> => {
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }

  return writeCloudState(state);
};
