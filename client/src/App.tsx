import { Router as WouterRouter, Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useGameState, type GameState } from "@/hooks/use-game-state";
import { fetchClaimStatuses } from "@/lib/quest-claim";
import { toast } from "@/hooks/use-toast";
import {
  ACHIEVEMENTS_CONFIG,
  buildAchievementSnapshot,
  evaluateAchievements,
} from "@/lib/achievements-config";

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

// Celebrates achievements the student unlocked but hasn't been shown yet.
function checkNewAchievements(state: GameState) {
  const unlockedIds = evaluateAchievements(buildAchievementSnapshot(state))
    .filter((entry) => entry.unlocked)
    .map((entry) => entry.definition.id);

  const unseen = unlockedIds.filter(
    (id) => !state.seenAchievements.includes(id)
  );

  if (unseen.length === 0) return;

  state.markAchievementsSeen(unseen);

  const first = ACHIEVEMENTS_CONFIG.find((def) => def.id === unseen[0]);

  toast({
    title:
      unseen.length === 1 && first
        ? `Новое достижение! ${first.emoji}`
        : `Новые достижения: ${unseen.length} 🏅`,
    description:
      unseen.length === 1 && first
        ? `«${first.title}» — ${first.description}`
        : "Загляни в профиль — там появились новые медали!",
  });

  confetti({
    particleCount: 90,
    spread: 75,
    origin: { y: 0.3 },
    colors: ["#3B82F6", "#F97316", "#FACC15", "#A855F7"],
  });
}

function AppContent() {
  const bootstrapTelegramCloud = useGameState(
    (state) => state.bootstrapTelegramCloud
  );

  useEffect(() => {
    checkNewAchievements(useGameState.getState());

    return useGameState.subscribe((state) => {
      checkNewAchievements(state);
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
