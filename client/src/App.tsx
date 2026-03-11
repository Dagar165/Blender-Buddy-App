import { Router as WouterRouter, Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

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

function App() {
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
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base="/Blender-Buddy-App">
          <div className="fixed inset-0 w-full h-full bg-background overflow-hidden">
            <div className="w-full h-full bg-background relative overflow-x-hidden overflow-y-auto flex flex-col">
              <Router />
              <BottomNav />
              <Toaster />
            </div>
          </div>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
