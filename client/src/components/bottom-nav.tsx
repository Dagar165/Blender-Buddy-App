import { Link, useLocation } from "wouter";
import { Ghost, Scroll, ShoppingBag, UserRound } from "lucide-react";
import { motion } from "framer-motion";

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { name: "Питомец", path: "/", icon: Ghost },
    { name: "Задания", path: "/quests", icon: Scroll },
    { name: "Магазин", path: "/shop", icon: ShoppingBag },
    { name: "Профиль", path: "/profile", icon: UserRound },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-100 rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50 pb-safe">
      <div className="flex justify-around items-center p-3">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="relative flex flex-col items-center justify-center w-16 h-14"
            >
              {isActive && (
                <motion.div
                  layoutId="bubble"
                  className="absolute inset-0 bg-primary/10 rounded-2xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}

              <Icon
                className={`w-6 h-6 mb-1 transition-all duration-300 ${
                  isActive ? "text-primary scale-110" : "text-slate-400 hover:text-slate-600"
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={`text-[10px] font-bold transition-colors ${
                  isActive ? "text-primary" : "text-slate-400"
                }`}
              >
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
