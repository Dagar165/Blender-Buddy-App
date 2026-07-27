import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  RotateCcw,
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
import { useGameState } from "@/hooks/use-game-state";
import { getTelegramWebApp } from "@/game/cloud";
import { GAME_CARD_ROTATE_MS, getGameCard } from "@/lib/games-config";
import { COMMUNITY_LINK } from "@/lib/community-config";
import { openOutboundLink } from "@/lib/links-config";

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

/**
 * Сможем ли мы забрать вертикальный свайп у Телеграма на этом клиенте.
 *
 * true  — свайпы наши, кнопки не нужны и не показываются.
 * false — жест останется у Телеграма, и без кнопок играть будет нельзя.
 *
 * Вне Телеграма (обычный браузер, компьютер) возвращаем true: там жеста
 * нет вовсе, а ходить можно стрелками на клавиатуре.
 */
function canOwnSwipes(webApp: any): boolean {
  if (!webApp) return true;

  /**
   * ЛОВУШКА, пойманная на проверке: скрипт Телеграма подключён к странице
   * ВСЕГДА, поэтому объект `WebApp` существует и в обычном браузере — просто
   * все его методы ни к кому не обращаются, а версия там древняя (6.0).
   * Если смотреть только на методы, кнопки вылезали бы на компьютере,
   * где никакого жеста нет и в помине.
   *
   * Настоящий признак «мы внутри Телеграма» — платформа: снаружи `unknown`,
   * внутри `ios`, `android`, `tdesktop` и подобное.
   */
  const platform =
    typeof webApp.platform === "string" ? webApp.platform : "unknown";

  if (platform === "unknown") return true;

  if (typeof webApp.disableVerticalSwipes !== "function") return false;

  // У старых клиентов метод в библиотеке есть, а в самом приложении его нет:
  // он молча ничего не делает. Версию спрашиваем, если умеет отвечать.
  if (
    typeof webApp.isVersionAtLeast === "function" &&
    !webApp.isVersionAtLeast("7.7")
  ) {
    return false;
  }

  return true;
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

/**
 * Сколько ходов считается «поиграл» — после этого призраку поднимается
 * настроение. Порог нужен, чтобы шкала не закрывалась открыл-и-закрыл;
 * десять ходов — это меньше минуты, ребёнка это не мучает.
 */
const MOVES_FOR_MOOD = 10;

export function MiniGame({
  onClose,
  onPlayed,
}: {
  onClose: () => void;
  // Зовётся ОДИН раз за открытие, когда наиграно MOVES_FOR_MOOD ходов.
  onPlayed?: () => void;
}) {
  const [game, setGame] = useState<GameState>(freshGame);
  const [best, setBest] = useState<number>(readBest);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Спрашиваем один раз при открытии: клиент за игру не меняется.
  const [needsPad] = useState(() => !canOwnSwipes(getTelegramWebApp()));

  // Считаем ходы до порога «поиграл». Держим в ref, а не в состоянии:
  // на экране это число не показывается, перерисовывать из-за него нечего.
  const movesRef = useRef(0);
  const playedRef = useRef(false);

  /**
   * Партия доиграна до конца — засчитываем её в счётчик медалей.
   *
   * Ровно ОДИН раз на партию: `countedRef` не даёт посчитать её второй раз,
   * если экран перерисуется, пока висит «ХОДОВ НЕТ». Сбрасывается при
   * начале новой партии (см. restart).
   *
   * Победа не нужна: медаль за то, что доиграл. Владелец 27.07 — «ребёнок
   * проиграл первый раз, но ачивку получил».
   */
  const finishGame = useGameState((state) => state.finishGame);
  const countedRef = useRef(false);

  /**
   * КАРТОЧКА ПОД ПОЛЕМ. Что в ней бывает и как часто — в `games-config.ts`.
   *
   * Считаем ОТ НУЛЯ, а не от случайного места: колода устроена так, что
   * первая карточка обязана быть советом, а нативные идут по счёту. Начни
   * со случайного числа — игра могла бы открыться рекламой.
   */
  const [cardCursor, setCardCursor] = useState(0);
  const card = getGameCard(cardCursor);
  // Нативная — та, что зовёт наружу (марафон или чат). Она и светится.
  const isNativeCard = card.kind !== "tip";

  /**
   * Карточка перелистывается сама. Просьба владельца 27.07: «внизу подсказки
   * и фишки никак не меняются сами, пусть типа таймера будет на них и смена».
   *
   * Таймер ОДИН на всё время игры и снимается при закрытии. Заводить его
   * заново на каждую карточку не надо: так уже обжигались на советах
   * призрака — старый таймер догонял новый текст и стирал его раньше срока
   * (разбор в `pages/pet.tsx`, над `tipTimerRef`).
   */
  useEffect(() => {
    const timer = window.setInterval(
      () => setCardCursor((cursor) => cursor + 1),
      GAME_CARD_ROTATE_MS
    );

    return () => window.clearInterval(timer);
  }, []);

  /**
   * СВАЙП ВНИЗ СВОРАЧИВАЕТ ВСЁ ПРИЛОЖЕНИЕ. Читать целиком, прежде чем
   * «улучшать» управление — здесь уже стоит то, что реально работает.
   *
   * Так устроен сам Телеграм: движение пальцем вниз внутри мини-аппа он
   * считает своим жестом «свернуть» и перехватывает его РАНЬШЕ страницы.
   * Владелец 25.07: «резкий свайп вниз сворачивает сразу, лёгкий опускает
   * на треть экрана». Влево, вправо и вверх при этом работают.
   *
   * ЛЕЧИТСЯ ЭТО ТЕМ, ЧТО НИЖЕ, И ОНО РАБОТАЕТ. `disableVerticalSwipes`
   * (штатный метод Телеграма, Bot API 7.7) выключает жест сворачивания.
   * Проверено на айфоне владельца: свайпы во все стороны работают,
   * приложение не сворачивается.
   *
   * ⚠️ 28.07: ТЕПЕРЬ ЭТО ВКЛЮЧЕНО НА ВСЁ ПРИЛОЖЕНИЕ, один раз при запуске
   * (см. `App.tsx`). Раньше игра забирала жест себе на время партии
   * и ОТДАВАЛА ОБРАТНО при выходе — теперь отдавать нельзя, иначе
   * возврат из игры чинил бы главный экран обратно в сломанный вид:
   * призрака снова нельзя было бы покрутить. Здесь остался только
   * `expand`, а сам вызов продублирован на случай, если игру когда-нибудь
   * откроют раньше, чем отработает запуск.
   *
   * ОСТОРОЖНО, ИСТОРИЯ С ЛОВУШКОЙ. Сразу после выкладки владелец сказал,
   * что ничего не изменилось, — и это было неправдой не по его вине:
   * Телеграм держал в кэше клиент, собранный ДО правки (кэш живёт до десяти
   * минут). Я принял его слова за приговор методу и построил обходной путь.
   * **Вывод: «не помогло» проверяй ПЕРЕЗАПУСКОМ мини-аппа, прежде чем
   * переписывать код.**
   *
   * КНОПКИ-СТРЕЛКИ ТЕПЕРЬ ЗАПАСНЫЕ И ОБЫЧНО НЕ ВИДНЫ. Владелец 25.07:
   * «занимают очень много места, надобности в них нет, просто скроем».
   * Он прав — там, где свайпы работают, кнопки лишние.
   *
   * Но совсем выбрасывать их нельзя, и вот почему: свайп принадлежит
   * Телеграму, и на клиенте, который не умеет `disableVerticalSwipes`,
   * игра снова станет неиграбельной — только теперь без всякого запасного
   * пути. Владелец проверил на СВОЁМ айфоне; у детей будут другие телефоны,
   * другой Android и старые версии, и проверить их все мы не сможем.
   *
   * Поэтому кнопки показываются ТОЛЬКО там, где мы не смогли забрать жест
   * себе (см. `canOwnSwipes`). На айфоне владельца их не будет — место внизу
   * освободилось, как он и просил.
   */
  useEffect(() => {
    const webApp = getTelegramWebApp();

    if (!webApp) return;

    try {
      webApp.expand?.();
      webApp.disableVerticalSwipes?.();
    } catch {
      // Старый клиент — играем как есть, приложение от этого не ломается.
    }
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
    setCardCursor((cursor) => cursor + 1);
    // Новая партия — её ещё не считали.
    countedRef.current = false;
  }, []);

  // Ходов не осталось — партия закончилась. Считаем здесь, а не в applyMove:
  // конец партии может наступить и от кнопки «Ещё раз», и от клавиатуры,
  // а состояние `over` одно на все пути.
  useEffect(() => {
    if (!game.over || countedRef.current) return;

    countedRef.current = true;
    finishGame();
  }, [game.over, finishGame]);

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

      // Поиграл по-настоящему — призраку поднимается настроение. Один раз
      // за открытие: дальше шкала уже полная, звать снова незачем.
      movesRef.current += 1;

      if (!playedRef.current && movesRef.current >= MOVES_FOR_MOOD) {
        playedRef.current = true;
        onPlayed?.();
      }

      setGame({ board, score: game.score + result.gained, won, over });
    },
    [game, onPlayed]
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

  // Через портал и z-[60] — по той же причине, что и «Наши движухи»:
  // нижние вкладки тоже z-50 и рисуются позже, а родительская анимация
  // запирает слой внутри себя. Полный разбор — в шапке movement-panel.tsx.
  // Игра вложена ещё глубже (панель ухода внутри главного экрана),
  // поэтому портал ей нужен тем более.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-50 dark:bg-background">
      <div className="w-full max-w-[420px] mx-auto flex flex-col px-5 pt-4 pb-5">
        {/**
         * ВЫХОД ПОДПИСАН СЛОВОМ И СТОИТ СЛЕВА. Тестировщик-подросток 27.07:
         * «непонятно, куда нажать, чтобы выйти из игры; есть кнопка "закрыть"
         * от Телеграма, нажимаешь на неё — и закрывается всё приложение».
         *
         * Причина путаницы понятна: голый крестик справа вверху стоял ровно
         * там же, где крестик самого Телеграма, и читался как он же. Слово
         * «Выйти» и стрелка влево — это уже другая кнопка, а не вторая такая
         * же. Слева, потому что «назад» ищут слева.
         */}
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="flex items-center gap-1 pl-2 pr-3 py-2 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border text-sm font-bold text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-4 h-4" /> Выйти
          </button>

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

        {game.won && (
          <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400 leading-snug">
            2048 собрана. Дальше — на рекорд.
          </p>
        )}

        {/* Крестовина как на старой приставке. Обычно СКРЫТА: показывается
            только там, где свайп забрать у Телеграма не вышло — иначе игра
            была бы неиграбельной. Разбор целиком — в шапке файла. */}
        {needsPad && (
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
        )}

        {/* Место, освободившееся от кнопок. Ребёнок отдыхает — и всё равно
            уносит отсюда приём из Blender.

            Там, где кнопки всё-таки нужны, карточку НЕ показываем: вместе они
            не влезают в экран (проверено — перебор на 32 точки, поле уезжает
            под край). Играбельность важнее совета.

            ⚠️ СВЕЧЕНИЕ У НАТИВНОЙ КАРТОЧКИ ЗАДАНО СТАТИЧНО, не анимацией
            появления. Окно без кадров (свёрнутый Телеграм, скрытая вкладка)
            не доигрывает ни `transition`, ни `framer-motion`, и карточка
            могла бы навсегда остаться прозрачной — так уже было, разбор
            в `JKids_Bot_как_работать_25.07.md`. Мигает только точка в углу:
            если кадры отнимут, она просто замрёт, а сама карточка видна. */}
        {!needsPad && (
        <div
          className={`relative mt-3 p-4 rounded-2xl border transition-colors ${
            isNativeCard
              ? "bg-violet-50 border-violet-300 shadow-lg shadow-violet-400/30 dark:bg-violet-500/10 dark:border-violet-500/50 dark:shadow-violet-500/20"
              : "bg-white border-slate-200 dark:bg-card dark:border-border"
          }`}
        >
          {/* Точка-маячок: «тут появилось что-то новое» */}
          {isNativeCard && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
          )}

          <p
            className={`font-mono text-[10px] font-bold uppercase tracking-widest mb-1.5 ${
              isNativeCard
                ? "text-violet-500 dark:text-violet-300"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {card.label}
          </p>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
            {card.text}
          </p>

          {/* Позвал в чат — дай дверь. Фраза без входа остаётся пустым
              звуком: то же правило, что и в облаке призрака. */}
          {card.kind === "chat" && (
            <button
              onClick={() => {
                hapticTap();
                openOutboundLink(COMMUNITY_LINK);
              }}
              className="mt-2.5 w-full rounded-xl border border-violet-300 py-2 text-xs font-bold text-violet-600 active:scale-[0.98] transition-transform dark:border-violet-500/50 dark:text-violet-300"
            >
              Открыть наш Телеграм →
            </button>
          )}
        </div>
        )}
      </div>
    </div>,
    document.body
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
