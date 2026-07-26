import { createPortal } from "react-dom";
import { Trophy, X } from "lucide-react";
import { useGameState } from "@/hooks/use-game-state";
import { SHOP_ITEMS } from "@/lib/shop-config";
import { hapticTap } from "@/lib/haptics";

/**
 * МОЙ ИНВЕНТАРЬ — отдельным окном.
 *
 * Причина ровно та же, что у достижений (см. шапку `achievements-panel.tsx`):
 * список, который раскрывался прямо на экране «Мой рост», делал экран выше
 * окна и ломал свайп между экранами. Хуже того — пока были открыты
 * достижения, до инвентаря вообще нельзя было домотать.
 *
 * На экранах главной блоков, раскрывающихся в высоту, быть не должно.
 */
export function InventoryPanel({ onClose }: { onClose: () => void }) {
  const { inventory } = useGameState();

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-background overflow-y-auto">
      <div className="w-full max-w-[460px] mx-auto px-5 pt-4 pb-16">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">
            Мой инвентарь
          </h2>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-300 bg-white dark:bg-card px-3 py-1 rounded-xl border border-slate-200 dark:border-border">
            {inventory.length}
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

        {inventory.length === 0 ? (
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
                Покупки хранятся по НАЗВАНИЮ, поэтому ищем по нему; если
                владелец переименовал вещь в магазине, старая покупка
                останется с кубком. */}
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
    </div>,
    document.body
  );
}
