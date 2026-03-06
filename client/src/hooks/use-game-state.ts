import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import confetti from 'canvas-confetti';

export interface GameState {
  username: string;
  xp: number;
  gold: number;
  inventory: string[];
  completedQuests: string[];
  
  // Computed values (getters)
  level: number;
  xpProgress: number; // Percentage 0-100 towards next level
  
  // Actions
  setUsername: (name: string) => void;
  addXpAndGold: (xp: number, gold: number) => void;
  completeQuest: (questId: string, xp: number, gold: number) => void;
  buyItem: (itemId: string, cost: number, itemName: string) => boolean;
  resetGame: () => void;
}

const XP_PER_LEVEL = 100;

const triggerRewardConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#3B82F6', '#F97316', '#FACC15']
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#3B82F6', '#F97316', '#FACC15']
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
      username: '3D Explorer',
      xp: 0,
      gold: 0,
      inventory: [],
      completedQuests: [],
      
      get level() {
        return Math.floor(get().xp / XP_PER_LEVEL) + 1;
      },
      
      get xpProgress() {
        return (get().xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100;
      },

      setUsername: (name) => set({ username: name }),
      
      addXpAndGold: (xpToAdd, goldToAdd) => {
        set((state) => ({
          xp: state.xp + xpToAdd,
          gold: state.gold + goldToAdd,
        }));
      },
      
      completeQuest: (questId, xpReward, goldReward) => {
        const state = get();
        if (state.completedQuests.includes(questId)) return;
        
        triggerRewardConfetti();
        
        set({
          xp: state.xp + xpReward,
          gold: state.gold + goldReward,
          completedQuests: [...state.completedQuests, questId],
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
          return true; // Success
        }
        return false; // Failed
      },
      
      resetGame: () => set({
        xp: 0,
        gold: 0,
        inventory: [],
        completedQuests: []
      }),
    }),
    {
      name: '3dbuddy-storage',
    }
  )
);
