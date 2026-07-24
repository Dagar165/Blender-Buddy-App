import { useCallback, useEffect, useRef, useState } from "react";
import { TOUR_STEPS, TOUR_STORAGE_KEY } from "@/lib/tour-config";
import { hapticSelect, hapticTap } from "@/lib/haptics";

/**
 * Обучающий тур: затемняем экран, вырезаем дырку вокруг нужного элемента
 * и объясняем, что это. Тексты и порядок — в lib/tour-config.ts.
 *
 * Как сделана подсветка: одна пустая рамка на месте элемента с ОГРОМНОЙ
 * тенью наружу. Тень и есть затемнение всего остального — поэтому дырка
 * всегда точно по элементу, без масок и второго слоя.
 *
 * Карточка встаёт под элементом, а если тот в нижней половине экрана —
 * над ним, чтобы не перекрывать то, о чём рассказывает.
 */

// Отступ подсветки от самого элемента, чтобы он не касался краёв дырки.
const HALO = 8;
// Зазор между подсветкой и карточкой.
const GAP = 22;
// Сколько карточка обязана оставить до края экрана.
const EDGE = 12;
// Экран успевает нарисоваться и доехать прокруткой, прежде чем мерить.
const SETTLE_MS = 380;

type Rect = { top: number; left: number; width: number; height: number };

function findTarget(target: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

function measure(element: HTMLElement): Rect {
  const box = element.getBoundingClientRect();

  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  };
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
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [running, setRunning] = useState(false);
  // Высоту карточки узнаём после отрисовки: без неё нельзя понять, влезает
  // ли она под элементом. Раньше она просто прижималась к низу — и на
  // высоком экране кнопки «Пропустить» и «Дальше» уезжали за край.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  const step = TOUR_STEPS[stepIndex] ?? null;

  // Запускаем не сразу: на первом кадре картинки ещё не встали на места,
  // и подсветка легла бы мимо.
  useEffect(() => {
    if (hasSeenTour() || TOUR_STEPS.length === 0) return;

    const timer = window.setTimeout(() => setRunning(true), 700);

    return () => window.clearTimeout(timer);
  }, []);

  const updateRect = useCallback(() => {
    if (!step) return;

    const element = findTarget(step.target);

    // Метки нет — покажем шаг без подсветки, посреди экрана.
    setRect(element ? measure(element) : null);
  }, [step]);

  /**
   * Довозим элемент до середины экрана и только потом мерим.
   *
   * Прокрутка МГНОВЕННАЯ, не плавная, и это важно. Плавная ехала под
   * затемнением почти полсекунды, всё это время подсветка стояла на старом
   * месте, а перемер на каждое движение прокрутки перерисовывал весь слой
   * десятки раз в секунду — отсюда и были рывки. Теперь экран уже стоит,
   * когда ребёнок видит подсветку.
   */
  useEffect(() => {
    if (!running || !step) return;

    const element = findTarget(step.target);
    element?.scrollIntoView({ block: "center", behavior: "auto" });

    const timer = window.setTimeout(updateRect, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [running, step, updateRect]);

  /**
   * Слушаем ТОЛЬКО поворот экрана. Слушателя прокрутки здесь нарочно нет:
   * пока идёт тур, ребёнок ничего прокрутить не может — экран накрыт целиком, —
   * а свою единственную прокрутку мы меряем строкой выше. Раньше слушатель
   * был, и он же был причиной заторов.
   */
  useEffect(() => {
    if (!running) return;

    window.addEventListener("resize", updateRect);

    return () => window.removeEventListener("resize", updateRect);
  }, [running, updateRect]);

  const finish = () => {
    hapticTap();
    markTourSeen();
    setRunning(false);
  };

  const next = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }

    hapticSelect();
    setStepIndex((index) => index + 1);
  };

  // Меряем карточку после каждой смены шага: тексты разной длины.
  useEffect(() => {
    if (!running) return;

    const measureCard = () => {
      const height = cardRef.current?.offsetHeight ?? 0;
      setCardHeight((current) => (current === height ? current : height));
    };

    measureCard();

    const timer = window.setTimeout(measureCard, 60);

    return () => window.clearTimeout(timer);
  }, [running, stepIndex, rect]);

  if (!running || !step) return null;

  const viewportHeight = window.innerHeight;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  /**
   * Куда поставить карточку. Правило простое: она должна ПОМЕЩАТЬСЯ целиком.
   * Сначала пробуем под элементом, потом над ним, и только если не влезает
   * ни туда, ни туда — ставим по центру экрана поверх затемнения.
   * Раньше карточка всегда шла вниз и на длинном тексте обрезалась.
   */
  const spaceBelow = rect ? viewportHeight - (rect.top + rect.height) - GAP : 0;
  const spaceAbove = rect ? rect.top - GAP : 0;
  const known = cardHeight > 0;

  const placement: "below" | "above" | "center" = !rect
    ? "center"
    : !known || cardHeight <= spaceBelow - EDGE
      ? "below"
      : cardHeight <= spaceAbove - EDGE
        ? "above"
        : "center";

  const cardTop =
    rect && placement === "below"
      ? rect.top + rect.height + GAP
      : rect && placement === "above"
        ? rect.top - GAP - cardHeight
        : Math.max(EDGE, (viewportHeight - cardHeight) / 2);

  return (
    <div className="fixed inset-0 z-[60]">
      {rect ? (
        /**
         * Подсветка ставится СРАЗУ на место, без плавного переезда. Оба
         * способа плавности здесь уже подвели, и оба одинаково:
         * анимация библиотеки застревала на первом кадре, а плавный переход
         * CSS ехал из левого верхнего угла — React переиспользует этот же
         * прямоугольник под затемнение, и переход стартовал от него.
         * В обоих случаях ребёнок видел рамку не на том месте.
         * Мгновенный перескок читается не хуже и сломаться не может.
         */
        <>
          {/* Затемнение — ЧЕТЫРЕ обычные шторки вокруг дырки, по краям
              экрана. Раньше здесь была одна рамка с тенью в 9999 пикселей
              во все стороны: приём известный, но телефон рисует такую тень
              заметно дороже четырёх прямоугольников, а перерисовывалась она
              на каждое движение прокрутки. Отсюда шли рывки. */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 bg-slate-950/75"
            style={{ height: Math.max(0, rect.top - HALO) }}
          />
          <div
            className="pointer-events-none absolute left-0 right-0 bottom-0 bg-slate-950/75"
            style={{ top: rect.top + rect.height + HALO }}
          />
          <div
            className="pointer-events-none absolute left-0 bg-slate-950/75"
            style={{
              top: rect.top - HALO,
              width: Math.max(0, rect.left - HALO),
              height: rect.height + HALO * 2,
            }}
          />
          <div
            className="pointer-events-none absolute right-0 bg-slate-950/75"
            style={{
              top: rect.top - HALO,
              left: rect.left + rect.width + HALO,
              height: rect.height + HALO * 2,
            }}
          />

          {/* Сама рамка — только ободок, без заливки и без тени. */}
          <div
            className="pointer-events-none absolute rounded-3xl ring-2 ring-secondary/70"
            style={{
              top: rect.top - HALO,
              left: rect.left - HALO,
              width: rect.width + HALO * 2,
              height: rect.height + HALO * 2,
            }}
          />
        </>
      ) : (
        // Метка не нашлась — просто затемняем всё.
        <div key="tour-dim" className="absolute inset-0 bg-slate-950/74" />
      )}

      {/* Внешний слой держит положение, внутренний — сама карточка. */}
      <div
        className="absolute left-0 right-0 flex justify-center px-5"
        style={{ top: cardTop }}
      >
      {/* Карточка нарочно БЕЗ анимации появления. Любая анимация, которую
          считает библиотека, идёт по кадрам, а окну без кадров их не дают:
          карточка застряла бы прозрачной, и ребёнок смотрел бы в тёмный
          экран. Переход между шагами читается по едущей подсветке. */}
        <div
          ref={cardRef}
          className="w-full max-w-[21rem] rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-border dark:bg-card"
        >
          {/* Точки: сколько всего шагов и где мы сейчас — видно, что это
              короткая история с концом, а не бесконечные всплывашки */}
          <div className="mb-3 flex items-center gap-1.5">
            {TOUR_STEPS.map((entry, index) => (
              <span
                key={entry.target}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex
                    ? "w-6 bg-secondary"
                    : "w-1.5 bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>

          <h3 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100">
            {step.title}
          </h3>

          <p className="mt-1.5 text-sm leading-snug text-slate-600 dark:text-slate-300">
            {step.text}
          </p>

          <div className="mt-4 flex items-center gap-3">
            {/* «Пропустить» есть на каждом шаге: тот, кто уже разобрался,
                не должен пролистывать всё до конца, чтобы начать играть */}
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
