import { useEffect, useRef, useState } from "react";
import { TOUR_STEPS, TOUR_STORAGE_KEY, type TourStep } from "@/lib/tour-config";
import { hapticSelect, hapticTap } from "@/lib/haptics";

/**
 * Обучающий тур: затемняем экран, вырезаем дырку вокруг нужного элемента
 * и объясняем, что это. Тексты и порядок — в lib/tour-config.ts.
 *
 * ГЛАВНОЕ ПРАВИЛО, купленное тремя неудачными заходами:
 * **тур НЕ ПРОКРУЧИВАЕТ экран. Никогда.**
 *
 * Первая версия подвозила каждый элемент к середине экрана. Выглядело это
 * так: экран дёргается, вокруг всё затемнено, ребёнок не понимает, куда его
 * перенесло и о чём вообще речь. Владелец сказал прямо: «как будто экран
 * не прокрутился… должно быть сразу понятно, о чём идёт речь».
 *
 * Поэтому теперь так: экран один раз ставится в начало, дальше стоит
 * неподвижно, а шаг, элемент которого целиком не помещается в окно,
 * ПРОПУСКАЕТСЯ. Лучше рассказать про четыре вещи, которые ребёнок видит
 * своими глазами, чем про пять, одна из которых где-то за краем.
 *
 * Отсюда же следует: чем короче главный экран, тем больше шагов доживает
 * до показа. Если однажды шагов станет мало — не возвращать прокрутку,
 * а укорачивать экран.
 */

// Отступ подсветки от самого элемента, чтобы он не касался краёв дырки.
const HALO = 8;
// Зазор между подсветкой и карточкой.
const GAP = 18;
// Сколько карточка обязана оставить до края экрана.
const EDGE = 12;
// Столько ждём после прокрутки в начало, прежде чем мерить.
const SETTLE_MS = 260;
// Ниже этой высоты окна тур не показываем совсем: карточке негде встать.
const MIN_VIEWPORT = 420;

type Rect = { top: number; left: number; width: number; height: number };
type Spot = { step: TourStep; rect: Rect };

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

// Ставим страницу в начало: тур ничего не прокручивает, значит показывать
// он будет ровно то, что видно сверху.
function scrollAppToTop() {
  const anchor = findTarget("pet-room");
  let node: HTMLElement | null = anchor?.parentElement ?? null;

  while (node) {
    const overflow = window.getComputedStyle(node).overflowY;

    if (overflow === "auto" || overflow === "scroll") {
      node.scrollTop = 0;
      return;
    }

    node = node.parentElement;
  }

  window.scrollTo(0, 0);
}

/**
 * Что из шагов реально видно на экране прямо сейчас.
 *
 * Условие ровно одно: элемент помещается в окно ЦЕЛИКОМ. Наполовину
 * уехавший подсвечивать нельзя — рамка обрежется краем и превратится
 * в непонятную оранжевую полосу (владелец увидел именно это и назвал
 * «странно подсвечивается»).
 *
 * Считаем по настоящим границам окна, БЕЗ запаса на отступ. Первая версия
 * требовала отступ от края и из-за этого выбрасывала как раз то, что видно
 * всегда: верхнюю панель (она в десяти точках от верха) и нижние вкладки
 * (они прижаты к низу). Оставалось два шага из пяти.
 */
function collectSpots(viewportHeight: number): Spot[] {
  const spots: Spot[] = [];

  for (const step of TOUR_STEPS) {
    const element = findTarget(step.target);
    if (!element) continue;

    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    if (box.top < 0 || box.bottom > viewportHeight) continue;

    spots.push({
      step,
      rect: {
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      },
    });
  }

  return spots;
}

export function hasSeenTour(): boolean {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY) === "done";
  } catch {
    // Нет доступа к памяти устройства — считаем, что видел: лучше не показать
    // тур, чем показывать его при каждом открытии.
    return true;
  }
}

export function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, "done");
  } catch {
    // Не записалось — тур покажется ещё раз, это не страшно.
  }
}

export function forgetTour() {
  try {
    window.localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // Ничего не делаем: кнопка «показать заново» просто не сработает.
  }
}

export function Tour() {
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  /**
   * Один-единственный замер, на старте. Дальше ничего не пересчитывается:
   * ни на прокрутку (её нет), ни на что-то ещё. Именно постоянный пересчёт
   * давал рывки — каждое событие перерисовывало весь затемняющий слой.
   */
  useEffect(() => {
    if (hasSeenTour() || TOUR_STEPS.length === 0) return;

    // Даём экрану дорисоваться: картинка призрака встаёт не на первом кадре.
    const start = window.setTimeout(() => {
      scrollAppToTop();

      const finish = window.setTimeout(() => {
        const height = window.innerHeight;

        if (height < MIN_VIEWPORT) {
          markTourSeen();
          return;
        }

        const found = collectSpots(height);

        // Показывать нечего — молча закрываем и не мучаем ребёнка.
        if (found.length === 0) {
          markTourSeen();
          return;
        }

        setSpots(found);
      }, SETTLE_MS);

      return () => window.clearTimeout(finish);
    }, 650);

    return () => window.clearTimeout(start);
  }, []);

  // Высота карточки нужна, чтобы понять, влезает ли она под элементом.
  useEffect(() => {
    if (!spots) return;

    const measureCard = () => {
      const height = cardRef.current?.offsetHeight ?? 0;
      setCardHeight((current) => (current === height ? current : height));
    };

    measureCard();

    const timer = window.setTimeout(measureCard, 50);

    return () => window.clearTimeout(timer);
  }, [spots, stepIndex]);

  if (!spots) return null;

  const current = spots[stepIndex];
  if (!current) return null;

  const { rect, step } = current;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const isLast = stepIndex === spots.length - 1;

  const finish = () => {
    hapticTap();
    markTourSeen();
    setSpots(null);
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }

    hapticSelect();
    setStepIndex((index) => index + 1);
  };

  // Рамка подсветки, прижатая к границам окна: за край она не выходит,
  // поэтому обрезанной полосы, которую видел владелец, больше не будет.
  const spot = {
    top: Math.max(EDGE / 2, rect.top - HALO),
    left: Math.max(EDGE / 2, rect.left - HALO),
    right: Math.min(viewportWidth - EDGE / 2, rect.left + rect.width + HALO),
    bottom: Math.min(viewportHeight - EDGE / 2, rect.top + rect.height + HALO),
  };

  /**
   * Карточка встаёт под элементом, если влезает, иначе над ним. А если
   * не влезает ни туда, ни туда — она всё равно ОСТАЁТСЯ НА ЭКРАНЕ целиком
   * и просто ложится на элемент внахлёст. Рамка при этом никуда не девается,
   * так что видно, о чём речь. Прошлая версия в этом случае честно считала
   * место и уезжала кнопками за нижний край — именно это владелец и увидел.
   */
  const spaceBelow = viewportHeight - spot.bottom - GAP - EDGE;
  const spaceAbove = spot.top - GAP - EDGE;
  const known = cardHeight > 0;

  const below = !known || cardHeight <= spaceBelow || spaceBelow >= spaceAbove;
  const wanted = below ? spot.bottom + GAP : spot.top - GAP - cardHeight;

  // Последнее слово всегда за краями экрана.
  const cardTop = Math.max(
    EDGE,
    Math.min(wanted, viewportHeight - cardHeight - EDGE)
  );

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Затемнение — четыре обычные шторки вокруг дырки. Одна рамка
          с тенью в 9999 пикселей телефону обходится заметно дороже. */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 bg-slate-950/78"
        style={{ height: Math.max(0, spot.top) }}
      />
      <div
        className="pointer-events-none absolute left-0 right-0 bottom-0 bg-slate-950/78"
        style={{ top: spot.bottom }}
      />
      <div
        className="pointer-events-none absolute left-0 bg-slate-950/78"
        style={{
          top: spot.top,
          width: Math.max(0, spot.left),
          height: Math.max(0, spot.bottom - spot.top),
        }}
      />
      <div
        className="pointer-events-none absolute right-0 bg-slate-950/78"
        style={{
          top: spot.top,
          left: spot.right,
          height: Math.max(0, spot.bottom - spot.top),
        }}
      />

      <div
        className="pointer-events-none absolute rounded-3xl ring-2 ring-secondary/70"
        style={{
          top: spot.top,
          left: spot.left,
          width: Math.max(0, spot.right - spot.left),
          height: Math.max(0, spot.bottom - spot.top),
        }}
      />

      {/* Карточка без анимации появления. Анимация, которую считает
          библиотека, идёт по кадрам, а окну без кадров их не дают —
          карточка застревала прозрачной поверх тёмного экрана. */}
      <div
        className="absolute left-0 right-0 flex justify-center px-5"
        style={{ top: cardTop }}
      >
        <div
          ref={cardRef}
          className="w-full max-w-[21rem] rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-border dark:bg-card"
        >
          {/* Точки: видно, что это короткая история с концом */}
          <div className="mb-2.5 flex items-center gap-1.5">
            {spots.map((entry, index) => (
              <span
                key={entry.step.target}
                className={`h-1.5 rounded-full ${
                  index === stepIndex
                    ? "w-6 bg-secondary"
                    : "w-1.5 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>

          <h3 className="font-display text-base font-bold text-slate-800 dark:text-slate-100">
            {step.title}
          </h3>

          <p className="mt-1 text-sm leading-snug text-slate-600 dark:text-slate-300">
            {step.text}
          </p>

          <div className="mt-3 flex items-center gap-3">
            {/* «Пропустить» на каждом шаге: тот, кто уже разобрался,
                не должен пролистывать всё, чтобы начать играть */}
            <button
              onClick={finish}
              className="text-sm font-bold text-slate-400 transition-transform active:scale-95 dark:text-slate-500"
            >
              Пропустить
            </button>

            <button
              onClick={next}
              className="ml-auto rounded-2xl bg-gradient-to-r from-secondary to-orange-400 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-secondary/30 transition-transform active:scale-95"
            >
              {isLast ? "Понятно!" : "Дальше"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
