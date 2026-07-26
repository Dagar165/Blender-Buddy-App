import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Coins, Medal, Package } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import {
  buildAchievementSnapshot,
  evaluateAchievements,
} from "@/lib/achievements-config";
import { AchievementsPanel } from "@/components/achievements-panel";
import { InventoryPanel } from "@/components/inventory-panel";
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
 * ⚠️ ГЛАВНОЕ ПРАВИЛО ЭТОГО ЭКРАНА: он обязан помещаться в окно целиком.
 * Медали и инвентарь ОТКРЫВАЮТСЯ ОТДЕЛЬНЫМ ОКНОМ, а не раскрываются
 * списком вниз. Так было сделано сначала — и тестировщик-подросток сразу
 * поймал поломку: длинный список делал экран выше окна, прокрутка внутри
 * дралась со свайпом («листаю достижения, а меня перекидывает на следующую
 * страницу»), а инвентарь под ними становился недостижим вовсе.
 * НЕ возвращать сюда раскрывающиеся блоки.
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

  const [showAchievements, setShowAchievements] = useState(false);
  const [showInventory, setShowInventory] = useState(false);

  const achievements = evaluateAchievements(
    buildAchievementSnapshot({ stats, level, inventory })
  );
  const unlockedCount = achievements.filter((entry) => entry.unlocked).length;

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

      {/* Две двери. Обе открывают отдельное окно — см. правило в шапке. */}
      <div className="bg-white dark:bg-card rounded-3xl shadow-sm border border-slate-100 dark:border-border overflow-hidden">
        <button
          onClick={() => {
            hapticTap();
            setShowAchievements(true);
          }}
          className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-slate-50 dark:active:bg-muted transition-colors"
        >
          <Medal className="w-5 h-5 shrink-0 text-secondary" />
          <span className="flex-1 font-display font-bold text-slate-800 dark:text-slate-100">
            Достижения
          </span>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-300">
            {unlockedCount}/{achievements.length}
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
        </button>

        <button
          onClick={() => {
            hapticTap();
            setShowInventory(true);
          }}
          className="w-full flex items-center gap-3 px-5 py-4 text-left border-t border-slate-100 dark:border-border active:bg-slate-50 dark:active:bg-muted transition-colors"
        >
          <Package className="w-5 h-5 shrink-0 text-secondary" />
          <span className="flex-1 font-display font-bold text-slate-800 dark:text-slate-100">
            Мой инвентарь
          </span>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-300">
            {inventory.length}
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
        </button>
      </div>

      {showAchievements && (
        <AchievementsPanel onClose={() => setShowAchievements(false)} />
      )}
      {showInventory && (
        <InventoryPanel onClose={() => setShowInventory(false)} />
      )}
    </div>
  );
}
