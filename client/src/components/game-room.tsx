import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft } from "lucide-react";
import {
  GAME_ROOM_NOTE,
  GAME_ROOM_PLACEHOLDERS,
  GAME_ROOM_SOON,
  GAME_ROOM_TITLE,
  MINI_GAMES,
} from "@/lib/games-config";
import { MiniGame } from "@/components/mini-game";
import { hapticTap } from "@/lib/haptics";

/**
 * ИГРОВАЯ КОМНАТА — во весь экран, открывается с кнопки «Настроение».
 *
 * Зачем комната, а не сразу игра, — разбор в шапке `lib/games-config.ts`.
 * Коротко: игр будет несколько, и место под них надо готовить сейчас,
 * пока их одна, а не переделывать потом.
 *
 * Через createPortal и без анимаций появления — по тем же причинам,
 * что и остальные полноэкранные окна (разбор в `movement-panel.tsx`).
 */
export function GameRoom({
  onClose,
  onWin,
}: {
  onClose: () => void;
  /** Сыграл — призрак веселеет. Настроение поднимает вызывающая сторона. */
  onWin: () => void;
}) {
  const [playing, setPlaying] = useState<string | null>(null);

  /**
   * Игра открыта — показываем её саму, а комната ждёт под ней: закрыл
   * игру, вернулся в комнату, а не сразу на главный экран. Так и должно
   * быть, когда игр несколько.
   *
   * `switch` по id — сюда же добавляется каждая новая игра.
   */
  if (playing === "2048") {
    return <MiniGame onClose={() => setPlaying(null)} onPlayed={onWin} />;
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-background overflow-y-auto">
      <div className="w-full max-w-[460px] mx-auto px-5 pt-4 pb-16">
        {/* Выход подписан словом и стоит слева — по той же причине, что
            и в самой игре: голый крестик справа вверху дети принимают
            за крестик Телеграма, который закрывает всё приложение.
            Разбор целиком — в шапке кнопки в `mini-game.tsx`. */}
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="flex items-center gap-1 pl-2 pr-3 py-2 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border text-sm font-bold text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-4 h-4" /> Выйти
          </button>

          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">
            {GAME_ROOM_TITLE}
          </h2>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug mb-4">
          {GAME_ROOM_NOTE}
        </p>

        <div className="space-y-3">
          {MINI_GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => {
                hapticTap();
                setPlaying(game.id);
              }}
              className="w-full flex items-center gap-3 rounded-3xl p-4 border border-violet-200 bg-violet-50/60 dark:border-violet-500/30 dark:bg-violet-500/10 text-left active:scale-[0.99] transition-transform"
            >
              <span className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-white dark:bg-card font-mono text-xs font-bold text-violet-600 dark:text-violet-300">
                {game.badge}
              </span>

              <span className="flex-1 min-w-0">
                <span className="block font-display font-bold text-slate-800 dark:text-slate-100">
                  {game.title}
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 leading-snug">
                  {game.subtitle}
                </span>
              </span>
            </button>
          ))}

          {/* Пустые места под будущие игры. Комната из одной карточки
              читается как «тут всё»; с пустыми местами — как «тут будет
              больше». Число задаётся в `games-config.ts`. */}
          {Array.from({ length: GAME_ROOM_PLACEHOLDERS }).map((_, index) => (
            <div
              key={index}
              className="w-full flex items-center gap-3 rounded-3xl p-4 border-2 border-dashed border-slate-200 dark:border-border"
            >
              <span className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-muted text-slate-300 dark:text-slate-600 font-mono text-xs font-bold">
                ?
              </span>
              <span className="text-sm font-bold text-slate-300 dark:text-slate-600">
                {GAME_ROOM_SOON}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
