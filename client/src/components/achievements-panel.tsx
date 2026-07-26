import { useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import {
  buildAchievementSnapshot,
  evaluateAchievements,
} from "@/lib/achievements-config";
import { hapticTap } from "@/lib/haptics";

/**
 * ДОСТИЖЕНИЯ — отдельным окном, а не раскрывающимся списком.
 *
 * ПОЧЕМУ ПЕРЕДЕЛАНО (тестировщик-подросток, 27.07). Раньше медали
 * раскрывались прямо на экране «Мой рост». Пятнадцать медалей — это пять
 * рядов, экран становился выше окна, и прокрутка внутри него начинала
 * драться с переключением экранов: «открыл достижения, начал их листать,
 * и меня перекидывало на следующую страницу. Пытался медленно-медленно —
 * всё равно перекидывало». До инвентаря, который лежал ниже, добраться
 * было нельзя вообще, пока достижения открыты.
 *
 * ⚠️ ПРАВИЛО, КОТОРОЕ ИЗ ЭТОГО ВЫРОСЛО: на экранах главной НЕЛЬЗЯ делать
 * блоки, которые раскрываются в высоту. Экран обязан оставаться ростом
 * в окно, иначе ломается свайп. Длинный список — только отдельным окном.
 *
 * Через createPortal и без анимаций появления — по тем же причинам,
 * что и остальные полноэкранные окна, разбор в `movement-panel.tsx`.
 */
export function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const { level, inventory, stats } = useGameState();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const achievements = evaluateAchievements(
    buildAchievementSnapshot({ stats, level, inventory })
  );
  const unlockedCount = achievements.filter((entry) => entry.unlocked).length;
  const selected =
    achievements.find((entry) => entry.definition.id === selectedId) ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-background overflow-y-auto">
      <div className="w-full max-w-[460px] mx-auto px-5 pt-4 pb-16">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">
            Достижения
          </h2>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-card px-3 py-1 rounded-xl border border-slate-200 dark:border-border">
            {unlockedCount}/{achievements.length}
          </span>

          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            aria-label="Закрыть"
            className="ml-auto p-2 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug mb-4">
          Нажми на медаль — покажу, сколько осталось.
        </p>

        {selected && (
          <div
            className={`mb-3 p-4 rounded-2xl border flex items-center gap-3 ${
              selected.unlocked
                ? "bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30"
                : "bg-white border-slate-200 dark:bg-card dark:border-border"
            }`}
          >
            <span
              className={`text-3xl ${
                selected.unlocked ? "" : "grayscale opacity-50"
              }`}
            >
              {selected.definition.emoji}
            </span>
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {selected.definition.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selected.definition.description}
              </p>
              <p
                className={`text-xs font-bold mt-1 ${
                  selected.unlocked
                    ? "text-amber-600 dark:text-amber-300"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {selected.unlocked
                  ? "Получено! 🎉"
                  : `Прогресс: ${selected.value}/${selected.target}`}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {achievements.map((entry) => {
            const isSelected = entry.definition.id === selectedId;

            return (
              <button
                key={entry.definition.id}
                onClick={() =>
                  setSelectedId(isSelected ? null : entry.definition.id)
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
      </div>
    </div>,
    document.body
  );
}
