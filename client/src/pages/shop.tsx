import { useState } from "react";
import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import { Coins, Snowflake, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { hapticSelect, hapticSuccess, hapticWarn } from "@/lib/haptics";
import { CARE_SUPPLIES, SUPPLY_MAX, getCareNeed } from "@/lib/care-config";
import {
  SHOP_ITEMS,
  STREAK_FREEZE_COST,
  STREAK_FREEZE_MAX,
  DOUBLE_POTION_COST,
  DOUBLE_POTION_MAX,
  getClothingSlot,
  type ShopItem,
} from "@/lib/shop-config";
import { getWornItems, isItemWorn } from "@/game/wardrobe";

type ShopTab = "supplies" | "clothes" | "help";

const SHOP_TABS: { id: ShopTab; label: string; hint: string }[] = [
  {
    id: "supplies",
    label: "Припасы",
    hint: "Еда, чистота и игры — тратятся при уходе за призраком",
  },
  {
    id: "clothes",
    label: "Одежда",
    hint: "Покупается один раз, надевается и снимается сколько угодно",
  },
  {
    id: "help",
    label: "Помощь",
    hint: "Страховка серии и удвоение награды за задание",
  },
];

export default function ShopPage() {
  const {
    gold,
    inventory,
    equipped,
    supplies,
    streakFreezes,
    doublePotions,
    potionActive,
    buyItem,
    wearItem,
    takeOffItem,
    buySupply,
    buyStreakFreeze,
    buyDoublePotion,
  } = useGameState();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ShopTab>("supplies");

  const showNoGoldToast = () => {
    hapticWarn();
    toast({
      title: "Недостаточно голды!",
      description: "Выполняй больше заданий, чтобы заработать голду.",
      variant: "destructive",
    });
  };

  const handleBuy = (item: ShopItem) => {
    const success = buyItem(item.id, item.cost, item.name);
    if (success) {
      hapticSuccess();
      toast({
        title: "Куплено! 🎉",
        description: `${item.name} — сразу на призраке. Посмотри на главном экране.`,
      });
    } else {
      showNoGoldToast();
    }
  };

  // Надеть: место освобождается само. Ученику про это говорим вслух, иначе
  // «наушники надел — шляпа пропала» читается как потеря покупки.
  const handleWear = (item: ShopItem) => {
    const replaced = getWornItems(equipped).find(
      (worn) => worn.slot === item.slot && worn.id !== item.id
    );

    if (!wearItem(item.id)) return;

    hapticSuccess();
    toast({
      title: `Надето: ${item.name}`,
      description: replaced
        ? `${replaced.name} — обратно в шкаф: на одном месте помещается одна вещь.`
        : "Посмотри на призрака на главном экране.",
    });
  };

  const handleTakeOff = (item: ShopItem) => {
    takeOffItem(item.id);
    hapticSelect();
    toast({
      title: `Снято: ${item.name}`,
      description: "Вещь никуда не делась — надень её снова когда захочешь.",
    });
  };

  const handleBuySupply = (supplyId: string, name: string) => {
    if (buySupply(supplyId)) {
      hapticSuccess();
      toast({
        title: "Куплено! 🎉",
        description: `${name} лежит в запасе — используй на главном экране.`,
      });
    } else {
      showNoGoldToast();
    }
  };

  const handleBuyFreeze = () => {
    if (buyStreakFreeze()) {
      hapticSuccess();
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
      hapticSuccess();
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
        {/* Три раздела подряд одной простынёй читались как каша. Теперь
            вкладки, как на экране заданий: на глазах всегда один раздел. */}
        <div className="mb-4 rounded-3xl bg-white dark:bg-card p-2 shadow-sm border border-slate-100 dark:border-border">
          <div className="grid grid-cols-3 gap-2">
            {SHOP_TABS.map(({ id, label }) => {
              const isActive = activeTab === id;

              return (
                <button
                  key={id}
                  onClick={() => {
                    if (!isActive) hapticSelect();
                    setActiveTab(id);
                  }}
                  className={`rounded-2xl px-2 py-2.5 text-center font-display text-sm font-bold transition-all ${
                    isActive
                      ? "bg-secondary text-white shadow-md"
                      : "bg-slate-50 text-slate-600 dark:bg-muted dark:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
            {SHOP_TABS.find((tab) => tab.id === activeTab)?.hint}
          </p>
        </div>

        <div className={activeTab === "supplies" ? "grid grid-cols-2 gap-3" : "hidden"}>
          {CARE_SUPPLIES.map((supply, i) => {
            const owned = supplies[supply.id] ?? 0;
            const atCap = owned >= SUPPLY_MAX;
            const canAfford = gold >= supply.cost;
            const need = getCareNeed(supply.need);

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                key={supply.id}
                className="bg-white dark:bg-card p-3 rounded-3xl shadow-md shadow-slate-200/50 dark:shadow-black/30 border border-transparent dark:border-border flex flex-col"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl leading-none">{supply.emoji}</span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                      {supply.name}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                      {need.title} +{supply.restores}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug flex-1 mb-2">
                  {supply.description}
                </p>

                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mb-2">
                  В запасе: {owned} из {SUPPLY_MAX}
                </p>

                <button
                  onClick={() => handleBuySupply(supply.id, supply.name)}
                  disabled={atCap || !canAfford}
                  className={`w-full py-2 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    atCap
                      ? "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                      : canAfford
                        ? "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30"
                        : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                  }`}
                >
                  {atCap ? (
                    "Полный запас"
                  ) : (
                    <>
                      {supply.cost}{" "}
                      <Coins
                        className={`w-4 h-4 ${canAfford ? "" : "text-amber-400"}`}
                      />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className={activeTab === "help" ? "space-y-3" : "hidden"}>
          {consumables.map((item, i) => {
            const Icon = item.icon;
            const buyDisabled = item.atCap || !item.canAfford;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                key={item.key}
                className="bg-white dark:bg-card p-4 rounded-3xl shadow-md shadow-slate-200/50 dark:shadow-black/30 border border-transparent dark:border-border"
              >
                {/* Иконка и текст в строку, кнопка — отдельной строкой снизу:
                    так описание идёт во всю ширину, а не по одному слову */}
                <div className="flex items-start gap-4">
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
                </div>

                <button
                  onClick={item.onBuy}
                  disabled={buyDisabled}
                  className={`w-full mt-3 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    item.atCap
                      ? "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                      : item.canAfford
                        ? "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30"
                        : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                  }`}
                >
                  {/* Всегда просто цена — как в играх. «Накопи ещё N» путало:
                      число читалось как стоимость товара. Что не по карману,
                      видно по серой кнопке. */}
                  {item.atCap ? (
                    "Максимум"
                  ) : (
                    <>
                      {item.cost}{" "}
                      <Coins
                        className={`w-4 h-4 ${
                          item.canAfford ? "" : "text-amber-400"
                        }`}
                      />
                    </>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        <div className={activeTab === "clothes" ? "grid grid-cols-2 gap-4" : "hidden"}>
          {SHOP_ITEMS.map((item, i) => {
            const isOwned = inventory.includes(item.name);
            const isWorn = isItemWorn(equipped, item);
            const canAfford = gold >= item.cost;
            const Icon = item.icon;
            const slot = getClothingSlot(item.slot);

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

                {item.legendary && (
                  <span className="mb-1 rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                    Легендарная
                  </span>
                )}

                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1 h-10 flex items-center">{item.name}</h3>

                {/* Место вещи: без него непонятно, почему шляпа снялась,
                    когда надели наушники */}
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {slot.name}
                </p>

                {/* Куплено — не значит надето. Купленная вещь остаётся в шкафу
                    и ждёт своей очереди на место. */}
                <button
                  onClick={() => {
                    if (!isOwned) return handleBuy(item);
                    return isWorn ? handleTakeOff(item) : handleWear(item);
                  }}
                  disabled={!isOwned && !canAfford}
                  className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    isWorn
                      ? "bg-green-50 text-green-600 border border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30"
                      : isOwned
                        ? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-slate-200 dark:border-border"
                        : canAfford
                          ? "bg-gradient-to-r from-secondary to-orange-400 text-white shadow-md shadow-secondary/30"
                          : "bg-slate-100 text-slate-400 dark:bg-muted dark:text-slate-500"
                  }`}
                >
                  {isOwned ? (
                    isWorn ? (
                      "Снять ✓"
                    ) : (
                      "Надеть"
                    )
                  ) : (
                    <>
                      {item.cost}{" "}
                      <Coins
                        className={`w-4 h-4 ${canAfford ? "" : "text-amber-400"}`}
                      />
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
