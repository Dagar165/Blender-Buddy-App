import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  X,
} from "lucide-react";
import {
  BOARD_SIZE,
  WIN_VALUE,
  addRandomTile,
  bestTile,
  createBoard,
  hasMoves,
  move,
  type Board,
  type Direction,
} from "@/lib/game-2048";
import { hapticSelect, hapticSuccess, hapticTap, hapticWarn } from "@/lib/haptics";
import { getTelegramWebApp } from "@/game/cloud";

/**
 * МИНИ-ИГРА 2048.
 *
 * Замысел владельца 25.07: ребёнок сдал задания и уходит — надо, чтобы он
 * задержался ещё немного, но на чём-то логическом, а не на пустой мотилке.
 * Его условия слово в слово: «прям очень-очень мало ресурса», «8-битная
 * по визуалу, чтобы никаких картинок не грузить», «залипательно, но в общем
 * стиле нашего приложения».
 *
 * Поэтому здесь НЕТ: картинок, шрифтов, библиотек, canvas, таймеров
 * и анимаций. Только шестнадцать клеток обычной разметки и цвет заливки.
 * Весь вес игры — этот файл и `lib/game-2048.ts`, вместе около 10 КБ
 * исходника; в готовой сборке из них остаётся куда меньше, и качать
 * ребёнку нечего.
 *
 * ПОЧЕМУ НЕТ АНИМАЦИЙ (это не лень, а известные грабли — см.
 * `JKids_Bot_как_работать_25.07.md`): окно, которому браузер не даёт кадров,
 * не доигрывает анимацию и застревает на первом кадре. Плитки ОБЯЗАНЫ быть
 * видны, поэтому они просто перерисовываются на месте. Заодно это самый
 * дешёвый для телефона вариант.
 *
 * Цвета плиток заданы числами прямо в коде, а не классами: классы Tailwind
 * собираются заранее и «сложенные на ходу» имена в сборку не попадают —
 * плитки остались бы бесцветными.
 */

// Ниже какого движения пальца свайп не считается — чтобы обычный тычок
// по экрану не двигал всё поле.
const SWIPE_MIN_PX = 24;

const BEST_KEY = "bb_2048_best_v1";

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
};

// 8-битная палитра: плоские цвета, никаких переливов. Растёт от холодного
// к горячему, чтобы по одному взгляду было видно, далеко ли до 2048.
const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: "#d8e6f4", fg: "#334155" },
  4: { bg: "#a9cdec", fg: "#1e293b" },
  8: { bg: "#5aa9e6", fg: "#ffffff" },
  16: { bg: "#3b82f6", fg: "#ffffff" },
  32: { bg: "#7c5cf0", fg: "#ffffff" },
  64: { bg: "#a855f7", fg: "#ffffff" },
  128: { bg: "#f59e0b", fg: "#ffffff" },
  256: { bg: "#f97316", fg: "#ffffff" },
  512: { bg: "#ef4444", fg: "#ffffff" },
  1024: { bg: "#ec4899", fg: "#ffffff" },
  2048: { bg: "#22c55e", fg: "#ffffff" },
};

const TOP_COLOR = { bg: "#0f172a", fg: "#ffffff" };

function readBest(): number {
  try {
    const stored = Number(window.localStorage.getItem(BEST_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function writeBest(value: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Память устройства может быть закрыта — рекорд не главное, игра важнее.
  }
}

type GameState = {
  board: Board;
  score: number;
  over: boolean;
  won: boolean;
};

function freshGame(): GameState {
  return { board: createBoard(), score: 0, over: false, won: false };
}

export function MiniGame({ onClose }: { onClose: () => void }) {
  const [game, setGame] = useState<GameState>(freshGame);
  const [best, setBest] = useState<number>(readBest);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  /**
   * СВАЙП ВНИЗ СВОРАЧИВАЕТ ВСЁ ПРИЛОЖЕНИЕ. Читать целиком, прежде чем
   * «улучшать» управление — здесь уже стоит то, что реально работает.
   *
   * Так устроен сам Телеграм: движение пальцем вниз внутри мини-аппа он
   * считает своим жестом «свернуть» и перехватывает его РАНЬШЕ страницы.
   * Владелец 25.07: «резкий свайп вниз сворачивает сразу, лёгкий опускает
   * на треть экрана». Влево, вправо и вверх при этом работают.
   *
   * Что пробовали и что из этого вышло:
   *
   * 1. `disableVerticalSwipes` (штатный метод Телеграма, Bot API 7.7).
   *    Вызывается ниже, при открытии игры, и возвращается при закрытии.
   *    На айфоне владельца НЕ ПОМОГЛО — поведение не изменилось совсем.
   *    Метод оставлен: где он работает, там будет приятнее, вреда от него нет.
   * 2. Гашение `touchmove` на поле слушателем с `passive: false` — тоже
   *    не помогло: жест перехватывает нативный клиент, а не страница.
   *
   * ПОЭТОМУ ГЛАВНОЕ УПРАВЛЕНИЕ — КНОПКИ-СТРЕЛКИ на экране. Они не зависят
   * ни от версии Телеграма, ни от его жестов вообще. Свайпы оставлены
   * как второй способ: три направления из четырёх работают, и тому,
   * у кого сработал пункт 1, будет удобно.
   *
   * НЕ УДАЛЯТЬ кнопки в пользу «чистых свайпов». Это уже проверено на живом
   * телефоне владельца и не работает.
   */
  useEffect(() => {
    const webApp = getTelegramWebApp();

    if (!webApp) return;

    const canToggle = typeof webApp.disableVerticalSwipes === "function";

    try {
      webApp.expand?.();
      if (canToggle) webApp.disableVerticalSwipes();
    } catch {
      // Старый клиент — играем как есть, приложение от этого не ломается.
    }

    return () => {
      try {
        if (canToggle) webApp.enableVerticalSwipes?.();
      } catch {
        // Вернуть не вышло — не страшно, при закрытии мини-аппа всё сбросится.
      }
    };
  }, []);

  /**
   * Вторая линия обороны. Слушатель ставится вручную с `passive: false`,
   * потому что только такому браузер разрешает погасить движение пальцем;
   * обычный обработчик React этого сделать не может.
   */
  useEffect(() => {
    const node = boardRef.current;

    if (!node) return;

    const swallow = (event: TouchEvent) => event.preventDefault();

    node.addEventListener("touchmove", swallow, { passive: false });
    return () => node.removeEventListener("touchmove", swallow);
  }, []);

  const restart = useCallback(() => {
    hapticTap();
    setGame(freshGame());
  }, []);

  const applyMove = useCallback(
    (direction: Direction) => {
      if (game.over) return;

      const result = move(game.board, direction);

      // Двигать было некуда — ход не считается и новая плитка НЕ появляется,
      // иначе поле забивалось бы от тычков в стенку.
      if (!result.moved) return;

      const board = addRandomTile(result.board);
      const won = game.won || bestTile(board) >= WIN_VALUE;
      const over = !hasMoves(board);

      if (won && !game.won) hapticSuccess();
      else if (over) hapticWarn();
      else if (result.gained > 0) hapticSelect();
      else hapticTap();

      setGame({ board, score: game.score + result.gained, won, over });
    },
    [game]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.key];

      if (!direction) return;

      event.preventDefault();
      applyMove(direction);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyMove]);

  useEffect(() => {
    if (game.score > best) {
      setBest(game.score);
      writeBest(game.score);
    }
  }, [game.score, best]);

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;

    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      applyMove(dx > 0 ? "right" : "left");
    } else {
      applyMove(dy > 0 ? "down" : "up");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-background">
      <div className="w-full max-w-[420px] mx-auto flex flex-col px-5 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-mono text-2xl font-bold tracking-[0.2em] text-slate-800 dark:text-slate-100">
            2048
          </h2>

          {/* «Заново» переехало наверх: внизу теперь стрелки, и место нужнее им */}
          <button
            onClick={restart}
            aria-label="Начать заново"
            className="ml-auto p-2 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            aria-label="Закрыть"
            className="p-2 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-500 dark:text-slate-300 active:scale-95 transition-transform"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <ScoreBox label="Счёт" value={game.score} />
          <ScoreBox label="Рекорд" value={Math.max(best, game.score)} />
        </div>

        {/* Поле. touchAction: none — иначе свайп по плиткам прокручивал бы
            страницу вместо хода. */}
        <div
          ref={boardRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: "none", overscrollBehavior: "contain" }}
          className="relative rounded-2xl bg-slate-300 dark:bg-slate-900 p-2 select-none"
        >
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {game.board.map((value, cell) => (
              <Tile key={cell} value={value} />
            ))}
          </div>

          {game.over && (
            <div className="absolute inset-0 rounded-2xl bg-slate-900/85 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="font-mono text-lg font-bold tracking-widest text-white">
                ХОДОВ НЕТ
              </p>
              <p className="text-sm text-slate-300">
                Собрано {game.score} очков
              </p>
              <button
                onClick={restart}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-secondary to-orange-400 active:scale-95 transition-transform"
              >
                Ещё раз
              </button>
            </div>
          )}
        </div>

        <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400 leading-snug">
          {game.won
            ? "2048 собрана. Дальше — на рекорд."
            : "Жми стрелки — плитки съедут и сложатся."}
        </p>

        {/* Крестовина как на старой приставке: сверху «вверх», под ним ряд
            «влево — вниз — вправо». Это главный способ играть, см. большое
            пояснение про свайпы наверху файла. */}
        <div className="mt-2 mx-auto grid grid-cols-3 gap-2 w-[186px]">
          <span />
          <PadButton label="Вверх" onPress={() => applyMove("up")}>
            <ArrowUp className="w-6 h-6" />
          </PadButton>
          <span />

          <PadButton label="Влево" onPress={() => applyMove("left")}>
            <ArrowLeft className="w-6 h-6" />
          </PadButton>
          <PadButton label="Вниз" onPress={() => applyMove("down")}>
            <ArrowDown className="w-6 h-6" />
          </PadButton>
          <PadButton label="Вправо" onPress={() => applyMove("right")}>
            <ArrowRight className="w-6 h-6" />
          </PadButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Кнопка крестовины. Ход делается на НАЖАТИИ пальца (`onPointerDown`),
 * а не на отпускании: так игра отзывается сразу, а не через задержку,
 * которую браузер держит на всякий случай. `touchAction: none` не даёт
 * Телеграму принять нажатие за начало своего жеста.
 */
function PadButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      style={{ touchAction: "none" }}
      className="h-[52px] rounded-[6px] flex items-center justify-center bg-white dark:bg-card border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-200 active:bg-slate-200 dark:active:bg-slate-700 active:scale-95 transition-transform"
    >
      {children}
    </button>
  );
}

function ScoreBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border px-3 py-2 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="font-mono text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
        {value}
      </p>
    </div>
  );
}

function Tile({ value }: { value: number }) {
  const colors = value === 0 ? null : TILE_COLORS[value] ?? TOP_COLOR;

  // Четырёхзначные числа не влезают тем же кеглем, что двузначные.
  const size =
    value >= 1000 ? "text-lg" : value >= 100 ? "text-xl" : "text-2xl";

  return (
    <div
      className={`aspect-square rounded-[4px] flex items-center justify-center font-mono font-bold ${size} ${
        colors ? "" : "bg-slate-200 dark:bg-slate-800"
      }`}
      style={
        colors ? { backgroundColor: colors.bg, color: colors.fg } : undefined
      }
    >
      {value === 0 ? "" : value}
    </div>
  );
}
