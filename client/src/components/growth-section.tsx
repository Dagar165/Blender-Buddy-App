import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Coins, Medal, Package, Trophy } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import {
  buildAchievementSnapshot,
  evaluateAchievements,
} from "@/lib/achievements-config";
import { SHOP_ITEMS } from "@/lib/shop-config";
import { hapticTap } from "@/lib/haptics";

/**
 * «МОЙ РОСТ» — второй экран главной, куда свайпают с призрака.
 *
 * ЗАЧЕМ ПЕРЕЕХАЛО СЮДА (владелец 26.07). Всё это жило в профиле, и он
 * назвал профиль «очень нагроможденным», а главный экран — «коротким»:
 * свайпнёшь вверх, а там только полоса опыта. Причина была в том, что
 * профиль смешивал четыре разные вещи — кто я, как я расту, куда сходить
 * и настройки. Рост — это про игру, поэтому его место рядом с призраком,
 * а не в настройках.
 *
 * Порядок блоков не случайный: сверху то, что меняется каждый день
 * (опыт), ниже то, что копится неделями (статистика, медали, вещи).
 * Ребёнок заходит смотреть на первое, а не на последнее.
 *
 * Медали и инвентарь остаются свёрнутыми. Причина та же, что и раньше:
 * пятнадцать медалей раскрытым списком — это пять рядов, и экран
 * перестаёт быть экраном. Счёт «сколько из скольких» виден и свёрнутым,
 * ради него сюда и заходят.
 */
export function GrowthSection() {
  const {
    level,
    inventory,
    stats,
    progressInLevel,
    requiredForNextLevel,
    xpToNextLevel,
    xpProgress,
  } = useGameState();

  const [selectedAchievementId, setSelectedAchievementId] = useState<
    string | null
  >(null);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const achievements = evaluateAchievements(
    buildAchievementSnapshot({ stats, level, inventory })
  );
  const unlockedCount = achievements.filter((entry) => entry.unlocked).length;
  const selectedAchievement =
    achievements.find(
      (entry) => entry.definition.id === selectedAchievementId
    ) ?? null;

  const progressLabel =
    requiredForNextLevel > 0
      ? `${progressInLevel} / ${requiredForNextLevel} XP`
      : "MAX";

  const subLabel =
    requiredForNextLevel > 0
      ? `Осталось ${xpToNextLevel} XP — их дают за задания`
      : "Максимальный уровень достигнут";

  const statRows = [
    {
      label: "Заданий сделано",
      value: `${stats.approvedQuestsTotal}`,
      hot: false,
      coin: false,
    },
    {
      label: "Рекорд серии",
      value: stats.bestStreak > 0 ? `${stats.bestStreak} дн. 🔥` : "—",
      hot: stats.bestStreak > 0,
      coin: false,
    },
    {
      label: "Голды потрачено",
      value: `${stats.goldSpent}`,
      hot: false,
      coin: true,
    },
  ];

  return (
    <div className="w-full max-w-sm mx-auto">
      <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100 mb-3">
        Мой рост
      </h2>

      {/* Полоса XP — как ползунок-значение в Blender: процент прямо в полосе */}
      <div className="bg-white dark:bg-card p-4 rounded-3xl shadow-xl shadow-primary/5 border border-slate-100 dark:border-border mb-4">
        <div className="flex justify-between items-end mb-2 gap-4">
          <h3 className="font-display font-bold text-slate-700 dark:text-slate-200 text-base">
            До уровня {requiredForNextLevel > 0 ? level + 1 : level}
          </h3>
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {progressLabel}
          </span>
        </div>

        <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full bg-gradient-to-b from-blue-400 to-primary rounded-l-lg"
          />
          <div className="absolute inset-0 flex items-center justify-between px-2.5 pointer-events-none">
            <span
              className={`text-[11px] font-bold font-mono ${
                xpProgress >= 16
                  ? "text-white drop-shadow-sm"
                  : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {Math.round(xpProgress)}%
            </span>
          </div>
        </div>

        <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 font-medium">
          {subLabel}
        </div>
      </div>

      {/* Статистика — строки «название → значение», как панель свойств */}
      <div className="bg-white dark:bg-card rounded-3xl shadow-sm border border-slate-100 dark:border-border mb-4 overflow-hidden">
        {statRows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-center px-5 py-3 ${
              index > 0 ? "border-t border-slate-100 dark:border-border" : ""
            }`}
          >
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {row.label}
            </span>
            <span
              className={`ml-auto flex items-center gap-1.5 font-mono text-sm font-bold ${
                row.hot ? "text-orange-500" : "text-slate-800 dark:text-slate-100"
              }`}
            >
              {row.value}
              {row.coin && <Coins className="w-4 h-4 text-amber-400" />}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          hapticTap();
          setAchievementsOpen((open) => !open);
        }}
        className="w-full mb-3 flex items-center gap-2 text-left"
      >
        <Medal className="text-secondary" />
        <span className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg">
          Достижения
        </span>
        <span className="ml-auto text-sm font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-card px-3 py-1 rounded-xl border border-slate-200 dark:border-border">
          {unlockedCount}/{achievements.length}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${
            achievementsOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {achievementsOpen && selectedAchievement && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          key={selectedAchievement.definition.id}
          className={`mb-3 p-4 rounded-2xl border flex items-center gap-3 ${
            selectedAchievement.unlocked
              ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30"
              : "bg-white border-slate-200 dark:bg-card dark:border-border"
          }`}
        >
          <span
            className={`text-3xl ${
              selectedAchievement.unlocked ? "" : "grayscale opacity-50"
            }`}
          >
            {selectedAchievement.definition.emoji}
          </span>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              {selectedAchievement.definition.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedAchievement.definition.description}
            </p>
            <p
              className={`text-xs font-bold mt-1 ${
                selectedAchievement.unlocked
                  ? "text-amber-600 dark:text-amber-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {selectedAchievement.unlocked
                ? "Получено! 🎉"
                : `Прогресс: ${selectedAchievement.value}/${selectedAchievement.target}`}
            </p>
          </div>
        </motion.div>
      )}

      <div
        className={`grid-cols-3 gap-3 mb-5 ${
          achievementsOpen ? "grid" : "hidden"
        }`}
      >
        {achievements.map((entry) => {
          const isSelected = entry.definition.id === selectedAchievementId;

          return (
            <button
              key={entry.definition.id}
              onClick={() =>
                setSelectedAchievementId(
                  isSelected ? null : entry.definition.id
                )
              }
              className={`p-3 rounded-2xl border flex flex-col items-center gap-1.5 transition-all active:scale-95 ${
                entry.unlocked
                  ? "bg-white border-amber-200 shadow-sm shadow-amber-100 dark:bg-card dark:border-amber-500/40 dark:shadow-none"
                  : "bg-slate-50 border-slate-200 dark:bg-muted dark:border-border"
              } ${isSelected ? "ring-2 ring-primary/40" : ""}`}
            >
              <span
                className={`text-3xl ${
                  entry.unlocked ? "" : "grayscale opacity-40"
                }`}
              >
                {entry.definition.emoji}
              </span>
              <span
                className={`text-[11px] font-bold leading-tight text-center ${
                  entry.unlocked
                    ? "text-slate-700 dark:text-slate-200"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {entry.definition.title}
              </span>
              {!entry.unlocked && (
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary/60 rounded-full"
                    style={{ width: `${entry.percent}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => {
          hapticTap();
          setInventoryOpen((open) => !open);
        }}
        className="w-full mb-3 flex items-center gap-2 text-left"
      >
        <Package className="text-secondary" />
        <span className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg">
          Мой инвентарь
        </span>
        <span className="ml-auto text-sm font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-card px-3 py-1 rounded-xl border border-slate-200 dark:border-border">
          {inventory.length}
        </span>
        <ChevronDown
          className={`w-5 h-5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform ${
            inventoryOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {!inventoryOpen ? null : inventory.length === 0 ? (
        <div className="bg-white dark:bg-card border-2 border-dashed border-slate-200 dark:border-border rounded-3xl p-8 text-center">
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Пока пусто.
            <br />
            Всё нужное — в магазине.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Значок у каждой вещи свой — тот же, что на главном экране.
              Одинаковый кубок у всего подряд не давал узнать вещь в лицо.
              Покупки хранятся по НАЗВАНИЮ, поэтому ищем по нему; если владелец
              переименовал вещь в магазине, старая покупка останется с кубком. */}
          {inventory.map((item, i) => {
            const known = SHOP_ITEMS.find((entry) => entry.name === item);
            const Icon = known?.icon ?? Trophy;

            return (
              <div
                key={i}
                className="bg-white dark:bg-card p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-border flex items-center gap-3"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    known
                      ? `${known.bg} ${known.color}`
                      : "bg-slate-50 dark:bg-muted text-primary"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
