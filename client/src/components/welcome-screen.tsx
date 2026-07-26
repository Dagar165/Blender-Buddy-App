import { useState } from "react";
import { createPortal } from "react-dom";
import { getPetStage } from "@/lib/pet-config";
import { useGameState } from "@/hooks/use-game-state";
import {
  WELCOME_BUTTON,
  WELCOME_FOOTNOTE,
  WELCOME_LINES,
  WELCOME_STORAGE_KEY,
  WELCOME_TITLE,
} from "@/lib/welcome-config";
import { hapticTap } from "@/lib/haptics";

/**
 * ПРИВЕТСТВИЕ — единственный экран, который ребёнок видит до всего
 * остального. Тексты живут в `lib/welcome-config.ts`, там же и причина,
 * зачем он понадобился.
 *
 * Показывается ОДИН РАЗ. Отметка лежит в памяти устройства, рядом
 * с отметкой обучающего тура: тур объясняет, ГДЕ что лежит, а этот
 * экран — ЗАЧЕМ это всё. Сначала зачем, потом где.
 *
 * Анимаций появления нет намеренно: экран, который обязан быть виден,
 * не должен зависеть от кадров (разбор — `JKids_Bot_как_работать_25.07.md`).
 * Через createPortal — иначе нижние вкладки накрывают низ.
 */
export function hasSeenWelcome(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) === "done";
  } catch {
    // Нет доступа к памяти — считаем, что видел, чтобы не показывать
    // приветствие каждый заход.
    return true;
  }
}

export function markWelcomeSeen() {
  try {
    window.localStorage.setItem(WELCOME_STORAGE_KEY, "done");
  } catch {
    // Не записалось — переживём, экран покажется ещё раз.
  }
}

export function forgetWelcome() {
  try {
    window.localStorage.removeItem(WELCOME_STORAGE_KEY);
  } catch {
    // Нечего забывать.
  }
}

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  /**
   * Призрак тут — ТОТ ЖЕ, что у ребёнка на главном экране.
   *
   * Поправка владельца 27.07. Сначала стояла жёстко первая стадия: для
   * новичка это верно, но экран возвращается и по кнопке «Показать
   * подсказки заново» — и тогда тридцатый уровень видел бы малыша вместо
   * своего Творца. Приложение не должно забывать, кто перед ним.
   */
  const { level } = useGameState();
  const stage = getPetStage(level);

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-slate-50 dark:bg-background overflow-y-auto">
      <div className="w-full max-w-[460px] mx-auto min-h-full px-6 py-6 flex flex-col justify-center">
        {/* ⚠️ ЖИВОЙ ПРИЗРАК, А НЕ ЗНАЧОК.
            Первая версия ставила сюда иконку-привидение из набора, и владелец
            забраковал сразу: «самый главный первый экран — просто на чёрном
            „Привет, это твой призрак“. А где, какой призрак, что к чему?
            Ничего не понятно и не видно, это очень сильно отталкивает».
            Он прав: экран знакомит с призраком, значит призрак должен быть
            на нём — тот самый, которого ребёнок увидит через секунду.
            Берём первую стадию: с неё все и начинают. */}
        <div className="relative self-center mb-1">
          {/* Подсветка под призраком: без неё он висит в пустоте, а экран
              выглядит как чёрный лист с текстом. */}
          <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-3xl" />
          <img
            src={stage.image}
            alt=""
            draggable={false}
            className="w-44 h-44 object-contain select-none"
          />
        </div>

        <h1 className="font-display text-2xl font-bold text-center text-slate-800 dark:text-slate-100 leading-tight mb-5">
          {WELCOME_TITLE}
        </h1>

        <div className="space-y-3.5 mb-6">
          {WELCOME_LINES.map((line) => (
            <div key={line.text} className="flex items-start gap-3">
              <span className="text-xl leading-none shrink-0 mt-0.5">
                {line.emoji}
              </span>
              <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-snug">
                {line.text}
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            hapticTap("medium");
            markWelcomeSeen();
            onDone();
          }}
          className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-secondary to-orange-400 shadow-lg shadow-secondary/30 active:scale-[0.99] transition-transform"
        >
          {WELCOME_BUTTON}
        </button>

        <p className="mt-3 text-xs text-center text-slate-500 dark:text-slate-400 leading-snug">
          {WELCOME_FOOTNOTE}
        </p>
      </div>
    </div>,
    document.body
  );
}

/**
 * Обёртка, которая решает, показывать приветствие или нет.
 *
 * Отдельным компонентом, чтобы `App.tsx` не оброс ещё одним состоянием:
 * там и так очередь модалок.
 */
export function WelcomeGate({ children }: { children: React.ReactNode }) {
  const [needWelcome, setNeedWelcome] = useState(() => !hasSeenWelcome());

  return (
    <>
      {needWelcome && <WelcomeScreen onDone={() => setNeedWelcome(false)} />}
      {/* Тур запускается только после приветствия: иначе он подсвечивал бы
          кнопки под непрозрачным экраном, и ребёнок увидел бы пустоту. */}
      {!needWelcome && children}
    </>
  );
}
