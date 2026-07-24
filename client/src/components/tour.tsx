import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
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

  // Довозим элемент до середины экрана и только потом мерим: иначе подсветка
  // окажется за краем, а ребёнок будет смотреть в пустоту.
  useEffect(() => {
    if (!running || !step) return;

    const element = findTarget(step.target);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });

    const timer = window.setTimeout(updateRect, SETTLE_MS);

    return () => window.clearTimeout(timer);
  }, [running, step, updateRect]);

  // Экран мог повернуться или проехать — держим дырку на месте.
  useEffect(() => {
    if (!running) return;

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
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

  if (!running || !step) return null;

  const viewportHeight = window.innerHeight;
  // Элемент в нижней половине — карточку поднимаем над ним.
  const cardBelow = rect ? rect.top + rect.height / 2 < viewportHeight / 2 : true;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60]">
      {rect ? (
        <motion.div
          layout
          transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
          className="pointer-events-none absolute rounded-3xl ring-2 ring-secondary/70"
          style={{
            top: rect.top - HALO,
            left: rect.left - HALO,
            width: rect.width + HALO * 2,
            height: rect.height + HALO * 2,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.74)",
          }}
        />
      ) : (
        // Метка не нашлась — просто затемняем всё.
        <div className="absolute inset-0 bg-slate-950/74" />
      )}

      {/* Внешний слой держит положение карточки, внутренний — анимацию.
          Вместе на одном элементе они не уживаются: сдвиг из анимации
          затирает выравнивание по центру. */}
      <div
        className={`absolute left-0 right-0 flex justify-center px-5 ${
          rect ? "" : "-translate-y-1/2"
        }`}
        style={
          rect
            ? cardBelow
              ? {
                  top: Math.min(
                    rect.top + rect.height + HALO + 14,
                    viewportHeight - 40
                  ),
                }
              : {
                  bottom: Math.min(
                    viewportHeight - rect.top + HALO + 14,
                    viewportHeight - 40
                  ),
                }
            : { top: "50%" }
        }
      >
      {/* Ключ по шагу: карточка пересобирается и въезжает заново. Нарочно
          без AnimatePresence — уходящая копия ждала бы конца анимации,
          а в свёрнутом окне Телеграма кадры не идут и шаг бы застревал. */}
        <motion.div
          key={step.target}
          initial={{ opacity: 0, y: cardBelow ? -10 : 10 }}
          animate={{ opacity: 1, y: 0 }}
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
        </motion.div>
      </div>
    </div>
  );
}
