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

export interface GameState extends LevelData {
  username: string;
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
}

type PersistedGameState = Pick<
  GameState,
  | "username"
  | "xp"
  | "gold"
  | "inventory"
  | "completedQuests"
  | "dailyProgress"
  | "weeklyProgress"
>;

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

export const useGameState = create<GameState>()(
  persist(
    (set, get) => ({
      username: "3D Explorer",
      xp: 0,
      gold: 0,
      inventory: [],
      completedQuests: [],

      dailyProgress: createDailyProgress(),
      weeklyProgress: createWeeklyProgress(),

      ...getLevelData(0),

      setUsername: (name) => set({ username: name }),

      addXpAndGold: (xpToAdd, goldToAdd) => {
        set((state) => {
          const nextXp = state.xp + xpToAdd;

          return {
            xp: nextXp,
            gold: state.gold + goldToAdd,
            ...getLevelData(nextXp),
          };
        });
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

        return true;
      },

      refreshQuestCycles: () => {
        const state = get();
        const recurringPatch = getRecurringProgressPatch(state);

        if (!recurringPatch) return;

        set(recurringPatch);
      },

      buyItem: (itemId, cost, itemName) => {
        const state = get();

        if (state.gold >= cost && !state.inventory.includes(itemName)) {
          triggerRewardConfetti();

          set({
            gold: state.gold - cost,
            inventory: [...state.inventory, itemName],
          });

          return true;
        }

        return false;
      },

      resetGame: () =>
        set({
          xp: 0,
          gold: 0,
          inventory: [],
          completedQuests: [],
          dailyProgress: createDailyProgress(),
          weeklyProgress: createWeeklyProgress(),
          ...getLevelData(0),
        }),
    }),
    {
      name: "3dbuddy-storage",
      partialize: (state): PersistedGameState => ({
        username: state.username,
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
