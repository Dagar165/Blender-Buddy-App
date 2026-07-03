import { Router as WouterRouter, Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { fetchClaimStatuses } from "@/lib/quest-claim";

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

function AppContent() {
  const bootstrapTelegramCloud = useGameState(
    (state) => state.bootstrapTelegramCloud
  );

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
