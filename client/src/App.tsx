import { Router as WouterRouter, Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { useGameState, type GameState } from "@/hooks/use-game-state";
import { fetchClaimStatuses } from "@/lib/quest-claim";
import {
  ACHIEVEMENTS_CONFIG,
  buildAchievementSnapshot,
  evaluateAchievements,
  type AchievementDefinition,
} from "@/lib/achievements-config";
import { AchievementUnlock } from "@/components/achievement-unlock";

// Components & Pages
import { BottomNav } from "@/components/bottom-nav";
import PetPage from "@/pages/pet";
import QuestsPage from "@/pages/quests";
import ShopPage from "@/pages/shop";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="relative w-full h-full pb-[80px]">
      <Switch>
        <Route path="/" component={PetPage} />
        <Route path="/quests" component={QuestsPage} />
        <Route path="/shop" component={ShopPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

// Finds achievements the student unlocked but hasn't been shown yet.
function takeNewAchievements(state: GameState): AchievementDefinition[] {
  const unlockedIds = evaluateAchievements(buildAchievementSnapshot(state))
    .filter((entry) => entry.unlocked)
    .map((entry) => entry.definition.id);

  const unseen = unlockedIds.filter(
    (id) => !state.seenAchievements.includes(id)
  );

  if (unseen.length === 0) return [];

  state.markAchievementsSeen(unseen);

  return unseen
    .map((id) => ACHIEVEMENTS_CONFIG.find((def) => def.id === id))
    .filter((def): def is AchievementDefinition => Boolean(def));
}

function AppContent() {
  const bootstrapTelegramCloud = useGameState(
    (state) => state.bootstrapTelegramCloud
  );
  const [achievementQueue, setAchievementQueue] = useState<
    AchievementDefinition[]
  >([]);

  useEffect(() => {
    const enqueue = (state: GameState) => {
      const fresh = takeNewAchievements(state);
      if (fresh.length > 0) {
        setAchievementQueue((queue) => [...queue, ...fresh]);
      }
    };

    enqueue(useGameState.getState());

    return useGameState.subscribe((state) => {
      enqueue(state);
    });
  }, []);

  useEffect(() => {
    try {
      // @ts-ignore
      if (window.Telegram?.WebApp) {
        // @ts-ignore
        window.Telegram.WebApp.ready();
        // @ts-ignore
        window.Telegram.WebApp.expand();
      }
    } catch (e) {
      console.warn("Telegram WebApp initialization failed", e);
    }

    void bootstrapTelegramCloud().then(async () => {
      // Apply any curator decisions made while the app was closed, so rewards
      // land even before the quests tab is opened.
      const { pendingClaims, applyClaimResolutions } = useGameState.getState();
      if (pendingClaims.length === 0) return;

      const statuses = await fetchClaimStatuses(
        pendingClaims.map((claim) => claim.claimId)
      );
      if (statuses) {
        applyClaimResolutions(statuses);
      }
    });
  }, [bootstrapTelegramCloud]);

  return (
    <WouterRouter base="/Blender-Buddy-App">
      <div className="fixed inset-0 w-full h-full bg-background overflow-hidden">
        <div className="w-full h-full bg-background relative overflow-x-hidden overflow-y-auto flex flex-col">
          <Router />
          <BottomNav />
          <Toaster />
          <AchievementUnlock
            achievement={achievementQueue[0] ?? null}
            remainingCount={Math.max(0, achievementQueue.length - 1)}
            onClaim={() => setAchievementQueue((queue) => queue.slice(1))}
          />
        </div>
      </div>
    </WouterRouter>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}

export default App;
