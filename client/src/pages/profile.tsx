import { useGameState } from "@/hooks/use-game-state";
import { TopBar } from "@/components/top-bar";
import { motion } from "framer-motion";
import {
  User,
  Trophy,
  Package,
  RotateCcw,
  PenSquare,
  Medal,
  Coins,
  Sun,
  Moon,
} from "lucide-react";
import { useState } from "react";
import { setTheme, useTheme } from "@/lib/theme";
import {
  buildAchievementSnapshot,
  evaluateAchievements,
} from "@/lib/achievements-config";

export default function ProfilePage() {
  const { username, level, xp, gold, inventory, stats, setUsername, resetGame } =
    useGameState();
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(username);
  const [selectedAchievementId, setSelectedAchievementId] = useState<
    string | null
  >(null);

  const achievements = evaluateAchievements(
    buildAchievementSnapshot({ stats, level, inventory })
  );
  const unlockedCount = achievements.filter((entry) => entry.unlocked).length;
  const selectedAchievement =
    achievements.find(
      (entry) => entry.definition.id === selectedAchievementId
    ) ?? null;

  const handleSaveName = () => {
    if (editName.trim()) {
      setUsername(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full bg-slate-50 dark:bg-background"
    >
      <TopBar />

      <div className="px-6 pb-24 overflow-y-auto">
        <div className="bg-white dark:bg-card rounded-3xl p-6 shadow-lg shadow-slate-200/50 dark:shadow-black/30 border border-transparent dark:border-border relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-0" />

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-20 h-20 bg-gradient-to-tr from-primary to-blue-300 rounded-full flex items-center justify-center text-white shadow-md border-4 border-white dark:border-slate-700">
              <User className="w-10 h-10" />
            </div>

            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-slate-100 dark:bg-muted border-none rounded-lg px-3 py-1 w-full text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-primary outline-none"
                    autoFocus
                    onBlur={handleSaveName}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-display font-bold text-slate-800 dark:text-slate-100 truncate">
                    {username}
                  </h2>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-slate-400 hover:text-primary transition-colors bg-slate-50 dark:bg-muted rounded-full"
                  >
                    <PenSquare className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-md text-xs">Уровень {level}</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{xp} Всего XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Тема: ставится сама при первом входе, но выбор здесь важнее */}
        <div className="bg-white dark:bg-card rounded-3xl shadow-sm border border-slate-100 dark:border-border mb-6 px-5 py-4 flex items-center gap-3">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Тема
          </span>

          <div className="ml-auto flex items-center gap-1 bg-slate-100 dark:bg-muted rounded-xl p-1">
            {([
              { value: "light" as const, label: "Светлая", icon: Sun },
              { value: "dark" as const, label: "Тёмная", icon: Moon },
            ]).map((option) => {
              const OptionIcon = option.icon;
              const isActive = theme === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    isActive
                      ? "bg-white dark:bg-card text-slate-800 dark:text-slate-100 shadow-sm"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <OptionIcon
                    className={`w-4 h-4 ${
                      isActive ? "text-secondary" : ""
                    }`}
                  />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Статистика — строки «название → значение», как панель свойств */}
        <div className="bg-white dark:bg-card rounded-3xl shadow-sm border border-slate-100 dark:border-border mb-6 overflow-hidden">
          {[
            {
              label: "Заданий сделано",
              value: `${stats.approvedQuestsTotal}`,
              hot: false,
              coin: false,
            },
            {
              label: "Рекорд серии",
              value:
                stats.bestStreak > 0 ? `${stats.bestStreak} дн. 🔥` : "—",
              hot: stats.bestStreak > 0,
              coin: false,
            },
            {
              label: "Голды потрачено",
              value: `${stats.goldSpent}`,
              hot: false,
              coin: true,
            },
          ].map((row, index) => (
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
                  row.hot
                    ? "text-orange-500"
                    : "text-slate-800 dark:text-slate-100"
                }`}
              >
                {row.value}
                {row.coin && <Coins className="w-4 h-4 text-amber-400" />}
              </span>
            </div>
          ))}
        </div>

        <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg mb-4 flex items-center gap-2">
          <Medal className="text-secondary" /> Достижения
          <span className="ml-auto text-sm font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-card px-3 py-1 rounded-xl border border-slate-200 dark:border-border">
            {unlockedCount}/{achievements.length}
          </span>
        </h3>

        {selectedAchievement && (
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

        <div className="grid grid-cols-3 gap-3 mb-8">
          {achievements.map((entry) => {
            const isSelected =
              entry.definition.id === selectedAchievementId;

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

        <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 text-lg mb-4 flex items-center gap-2">
          <Package className="text-secondary" /> Мой Инвентарь
        </h3>

        {inventory.length === 0 ? (
          <div className="bg-white dark:bg-card border-2 border-dashed border-slate-200 dark:border-border rounded-3xl p-8 text-center mb-8">
            <p className="text-slate-500 dark:text-slate-400 font-medium">Твой инвентарь пуст.<br/>Посети магазин, чтобы купить крутое снаряжение!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-8">
            {inventory.map((item, i) => (
              <div key={i} className="bg-white dark:bg-card p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-border flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 dark:bg-muted rounded-xl flex items-center justify-center text-primary">
                  <Trophy className="w-5 h-5" />
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{item}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            if (window.confirm("Ты уверен, что хочешь сбросить весь свой прогресс?")) {
              resetGame();
            }
          }}
          className="w-full py-4 flex items-center justify-center gap-2 text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-2xl transition-colors"
        >
          <RotateCcw className="w-5 h-5" /> Сбросить прогресс
        </button>
      </div>
    </motion.div>
  );
}
