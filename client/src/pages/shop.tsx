import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import { Coins, Snowflake, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  SHOP_ITEMS,
  STREAK_FREEZE_COST,
  STREAK_FREEZE_MAX,
  DOUBLE_POTION_COST,
  DOUBLE_POTION_MAX,
} from "@/lib/shop-config";

export default function ShopPage() {
  const {
    gold,
    inventory,
    streakFreezes,
    doublePotions,
    potionActive,
    buyItem,
    buyStreakFreeze,
    buyDoublePotion,
  } = useGameState();
  const { toast } = useToast();

  const showNoGoldToast = () => {
    toast({
      title: "Недостаточно голды!",
      description: "Выполняй больше заданий, чтобы заработать голду.",
      variant: "destructive",
    });
  };

  const handleBuy = (id: string, cost: number, name: string) => {
    const success = buyItem(id, cost, name);
    if (success) {
      toast({
        title: "Товар куплен! 🎉",
        description: `${name} добавлен в твой инвентарь.`,
      });
    } else {
      showNoGoldToast();
    }
  };

  const handleBuyFreeze = () => {
    if (buyStreakFreeze()) {
      toast({
        title: "Заморозка куплена! ❄️",
        description:
          "Если пропустишь день, она сработает сама и спасёт твою серию.",
      });
    } else if (gold >= STREAK_FREEZE_COST) {
      toast({
        title: "Больше нельзя",
        description: `Заморозок в запасе не может быть больше ${STREAK_FREEZE_MAX}.`,
      });
    } else {
      showNoGoldToast();
    }
  };

  const handleBuyPotion = () => {
    if (buyDoublePotion()) {
      toast({
        title: "Зелье куплено! 🧪",
        description: "Выпей его на странице заданий перед следующим заданием.",
      });
    } else if (gold >= DOUBLE_POTION_COST) {
      toast({
        title: "Больше нельзя",
        description: `Зелий в запасе не может быть больше ${DOUBLE_POTION_MAX}.`,
      });
    } else {
      showNoGoldToast();
    }
  };

  const freezeAtCap = streakFreezes >= STREAK_FREEZE_MAX;
  const potionAtCap = doublePotions >= DOUBLE_POTION_MAX;

  const consumables = [
    {
      key: "freeze",
      icon: Snowflake,
      iconClasses: "bg-cyan-100 text-cyan-500",
      name: "Заморозка серии",
      description:
        "Страховка на один пропущенный день: серия не сгорит, заморозка сработает сама.",
      ownedLabel: `В запасе: ${streakFreezes} из ${STREAK_FREEZE_MAX}`,
      cost: STREAK_FREEZE_COST,
      atCap: freezeAtCap,
      canAfford: gold >= STREAK_FREEZE_COST,
      onBuy: handleBuyFreeze,
    },
    {
      key: "potion",
      icon: FlaskConical,
      iconClasses: "bg-fuchsia-100 text-fuchsia-500",
      name: "Зелье ×2",
      description:
        "Удваивает награду за следующее одобренное задание. Выпей его на странице заданий.",
      ownedLabel: `В запасе: ${doublePotions} из ${DOUBLE_POTION_MAX}${
        potionActive ? " · сейчас действует 🧪" : ""
      }`,
      cost: DOUBLE_POTION_COST,
      atCap: potionAtCap,
      canAfford: gold >= DOUBLE_POTION_COST,
      onBuy: handleBuyPotion,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-slate-50 dark:bg-background"
    >
      <TopBar />

      <div className="px-6 pb-24 overflow-y-auto">
        <p className="mb-5 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          Голду дают за задания. Всё, что купишь, достанется призраку!
        </p>

        <h2 className="mb-3 text-lg font-display font-bold text-slate-800 dark:text-slate-100">Припасы</h2>

        <div className="space-y-3 mb-8">
          {consumables.map((item, i) => {
            const Icon = item.icon;
            const buyDisabled = item.atCap || !item.canAfford;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                key={item.key}
                className="bg-white dark:bg-card p-4 rounded-3xl shadow-md shadow-slate-200/50 dark:shadow-black/30 border border-transparent dark:border-border flex items-center gap-4"
              >
                <div
                  className={`w-14 h-14 shrink-0 rounded-2xl ${item.iconClasses} flex items-center justify-center`}
                >
                  <Icon className="w-7 h-7" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                    {item.description}
                  </p>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1">{item.ownedLabel}</p>
                </div>

                <button
                  onClick={item.onBuy}
                  disabled={buyDisabled}
                  className={`shrink-0 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center gap-1.5 ${
                    item.atCap
                      ? "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                      : item.canAfford
                        ? "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30"
                        : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                  }`}
                >
                  {item.atCap ? (
                    "Максимум"
                  ) : item.canAfford ? (
                    <>
                      {item.cost} <Coins className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Накопи ещё {item.cost - gold}{" "}
                      <Coins className="w-4 h-4 text-amber-400" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <h2 className="mb-3 text-lg font-display font-bold text-slate-800 dark:text-slate-100">
          Одежда для призрака
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {SHOP_ITEMS.map((item, i) => {
            const isOwned = inventory.includes(item.name);
            const canAfford = gold >= item.cost;
            const Icon = item.icon;

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                key={item.id}
                className="bg-white dark:bg-card p-4 rounded-3xl shadow-md shadow-slate-200/50 dark:shadow-black/30 flex flex-col items-center text-center border-2 border-transparent dark:border-border hover:border-orange-100 dark:hover:border-orange-500/30 transition-colors"
              >
                <div className={`w-16 h-16 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-8 h-8" />
                </div>

                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-3 h-10 flex items-center">{item.name}</h3>

                <button
                  onClick={() => !isOwned && handleBuy(item.id, item.cost, item.name)}
                  disabled={isOwned || (!canAfford && !isOwned)}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    isOwned
                      ? "bg-green-50 text-green-600 border border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30"
                      : canAfford
                        ? "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30"
                        : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                  }`}
                >
                  {isOwned ? (
                    "Надето ✓"
                  ) : canAfford ? (
                    <>
                      {item.cost} <Coins className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Накопи ещё {item.cost - gold}{" "}
                      <Coins className="w-4 h-4 text-amber-400" />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
