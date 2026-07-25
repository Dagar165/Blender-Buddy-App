import { createPortal } from "react-dom";
import { ArrowRight, ExternalLink, X } from "lucide-react";
import {
  MARATHON_DIFFERENCE,
  MARATHON_GETS,
  MARATHON_SIGNUP_NOTE,
  MARATHON_SIGNUP_OPEN,
  MARATHON_SIGNUP_URL,
} from "@/lib/marathon-config";
import { COMMUNITY_LINK } from "@/lib/community-config";
import { openOutboundLink } from "@/lib/links-config";
import { hapticTap } from "@/lib/haptics";

/**
 * «НАШИ ДВИЖУХИ» — единственное место, где про марафон и чат рассказано
 * подробно, а не одной фразой.
 *
 * Зачем понадобился (владелец 25.07): призрак сказал в пузыре «у нас бывают
 * марафоны», а пойти и узнать подробнее было НЕКУДА. «Зашёл в приложение
 * и вообще не понял, как мне про марафон узнать». Одна фраза без двери —
 * это дразнилка, а не рассказ.
 *
 * ГЛАВНОЕ ПРАВИЛО ЭТОГО ЭКРАНА — он объясняет РАЗНИЦУ, а не формат.
 * Первая версия текстов описывала марафон («неделя, один проект, эфиры»),
 * и владелец справедливо спросил: чем это отличается от того, что уже
 * происходит в приложении? Ничем — по описанию. Поэтому здесь сверху стоит
 * табличка «тут / там»: слева то, что ребёнок уже знает по боту, справа то,
 * чего в боте нет. Без этой пары ценность не читается и интереса не будет.
 *
 * Экран открывается ПО КНОПКЕ и нигде не всплывает сам: правило «тише
 * оранжевой кнопки» действует и здесь — приложение не должно уводить
 * ребёнка от задания, ради которого он пришёл.
 *
 * Анимаций появления нет намеренно (см. `JKids_Bot_как_работать_25.07.md`):
 * окно без кадров застревает на первом кадре, а экран обязан быть виден.
 */
export function MovementPanel({ onClose }: { onClose: () => void }) {
  /**
   * ПОЧЕМУ ЧЕРЕЗ createPortal, А НЕ ПРОСТО ТАК — правило для всех
   * полноэкранных окон в этом приложении.
   *
   * Владелец 25.07: «не влезает, вниз дальше не прокручивается». Нижние
   * вкладки накрывали конец экрана. Причин оказалось ДВЕ, и лечить надо обе:
   *
   * 1. Вкладки тоже `z-50`, и рисуются ПОЗЖЕ — при равном слое побеждают они.
   *    Отсюда `z-[60]` ниже (такой же, как у обучающего тура).
   * 2. Этого мало. Экраны обёрнуты в анимацию появления, а она задаёт
   *    прозрачность — и родитель с прозрачностью ЗАПИРАЕТ слой внутри себя.
   *    Тогда никакой `z-60` не помогает: он сравнивается только с соседями
   *    внутри этой обёртки, а вкладки живут снаружи.
   *
   * Портал вешает окно прямо в корень страницы, минуя всех родителей, —
   * и оно перестаёт зависеть от того, во что его вложили. Заодно это
   * лечит случай, когда окну не дают кадров и прозрачность застревает
   * на нуле (см. `JKids_Bot_как_работать_25.07.md`).
   *
   * Отступ снизу — под домашнюю полоску айфона.
   */
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-background overflow-y-auto">
      <div className="w-full max-w-[460px] mx-auto px-5 pt-4 pb-16">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">
            Наши движухи
          </h2>

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

        {/* МАРАФОН */}
        <div className="rounded-3xl bg-white dark:bg-card border border-slate-200 dark:border-border p-5 mb-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">
            Марафон
          </p>
          <h3 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
            Молот Тора за неделю
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-snug">
            Бесплатно. Без карт и подписок.
          </p>

          {/* Разница «тут / там» — сердце экрана */}
          <div className="mt-4 space-y-2">
            {MARATHON_DIFFERENCE.map((row) => (
              <div
                key={row.there}
                className="rounded-2xl border border-slate-100 dark:border-border bg-slate-50 dark:bg-muted p-3"
              >
                <p className="text-xs text-slate-400 dark:text-slate-500 leading-snug">
                  {row.here}
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 leading-snug">
                  <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-secondary" />
                  {row.there}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Что заберёшь
          </p>
          <ul className="mt-1.5 space-y-1">
            {MARATHON_GETS.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 leading-snug"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
                {line}
              </li>
            ))}
          </ul>

          {MARATHON_SIGNUP_OPEN && MARATHON_SIGNUP_URL ? (
            <>
              <button
                onClick={() =>
                  openOutboundLink({
                    id: "marathon",
                    emoji: "🔨",
                    title: "Марафон",
                    subtitle: "",
                    url: MARATHON_SIGNUP_URL,
                    // Анкета открывается в браузере, не в Телеграме.
                    kind: "web",
                  })
                }
                className="mt-4 w-full py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-secondary to-orange-400 shadow-lg shadow-secondary/30 active:scale-[0.99] transition-transform"
              >
                Записаться в лист ожидания
              </button>

              <p className="mt-2 text-xs text-center text-slate-500 dark:text-slate-400 leading-snug">
                {MARATHON_SIGNUP_NOTE}
              </p>
            </>
          ) : (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-snug">
              Набора сейчас нет. Как откроется — скажу.
            </p>
          )}
        </div>

        {/* ЧАТ ШКОЛЫ */}
        <button
          onClick={() => openOutboundLink(COMMUNITY_LINK)}
          className="w-full rounded-3xl bg-white dark:bg-card border border-slate-200 dark:border-border p-5 text-left active:scale-[0.99] transition-transform"
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
            Каждый день
          </p>
          <h3 className="font-display text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight">
            Чат школы
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-snug">
            Там скидывают работы, спрашивают, когда застряли, и голосуют,
            что моделить дальше.
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary dark:text-blue-300">
            Открыть чат <ExternalLink className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    </div>,
    document.body
  );
}
