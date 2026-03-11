import { create } from "zustand";
import { persist } from "zustand/middleware";
import confetti from "canvas-confetti";

export interface GameState {
  username: string;
  xp: number;
  gold: number;
  inventory: string[];
  completedQuests: string[];

  level: number;
  xpProgress: number; // 0-100

  setUsername: (name: string) => void;
  addXpAndGold: (xp: number, gold: number) => void;
  completeQuest: (questId: string, xp: number, gold: number) => void;
  buyItem: (itemId: string, cost: number, itemName: string) => boolean;
  resetGame: () => void;
}

const XP_PER_LEVEL = 100;

const getLevelData = (xp: number) => ({
  level: Math.floor(xp / XP_PER_LEVEL) + 1,
  xpProgress: ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100,
});

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

export const useGameState = create<GameState>()(
  persist(
    (set, get) => ({
      username: "3D Explorer",
      xp: 0,
      gold: 0,
      inventory: [],
      completedQuests: [],

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

      buyItem: (itemId, cost, itemName) => {
        const state = get();

        if (state.gold >= cost && !state.inventory.includes(itemId)) {
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
          ...getLevelData(0),
        }),
    }),
    {
      name: "3dbuddy-storage",
      partialize: (state) => ({
        username: state.username,
        xp: state.xp,
        gold: state.gold,
        inventory: state.inventory,
        completedQuests: state.completedQuests,
      }),
      merge: (persistedState, currentState) => {
        const typedState = (persistedState as Partial<GameState>) || {};
        const xp = typedState.xp ?? currentState.xp;

        return {
          ...currentState,
          ...typedState,
          ...getLevelData(xp),
        };
      },
    }
  )
);
