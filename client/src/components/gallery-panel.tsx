import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { COMMUNITY_LINK } from "@/lib/community-config";
import { openOutboundLink } from "@/lib/links-config";
import {
  GALLERY_HOW_TO_GET_IN,
  GALLERY_INTRO,
  galleryImageUrl,
  getGalleryItems,
} from "@/lib/gallery-config";
import { hapticTap } from "@/lib/haptics";

/**
 * ЗАЛ СЛАВЫ — работы учеников школы.
 *
 * Что где лежит: сами работы и подписи — в `lib/gallery-config.ts`, туда же
 * написано, как добавлять новые. Здесь только показ.
 *
 * Экран открывается ПО КНОПКЕ из профиля и сам никуда не всплывает —
 * общее правило приложения: не уводить ребёнка от задания, ради которого
 * он пришёл.
 *
 * Анимаций появления нет намеренно (см. `JKids_Bot_как_работать_25.07.md`):
 * окно без кадров застревает на первом кадре, а экран обязан быть виден.
 * Через `createPortal` — иначе нижние вкладки накрывают низ экрана,
 * подробный разбор причины в `movement-panel.tsx`.
 */
export function GalleryPanel({ onClose }: { onClose: () => void }) {
  const items = getGalleryItems();

  /**
   * Какая работа открыта крупно. `null` — открыта сетка.
   *
   * Храним НОМЕР, а не саму работу: по номеру работают стрелки
   * «предыдущая/следующая», и не надо второй раз искать её в списке.
   */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const openWork = openIndex === null ? null : items[openIndex];

  /** Листание по кругу: с последней работы стрелка ведёт на первую. */
  const step = (delta: number) => {
    if (openIndex === null) return;
    hapticTap();
    setOpenIndex((openIndex + delta + items.length) % items.length);
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-50 dark:bg-background overflow-y-auto">
      <div className="w-full max-w-[460px] mx-auto px-5 pt-4 pb-16">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-display text-xl font-bold text-slate-800 dark:text-slate-100">
            Зал славы
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

        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug mb-4">
          {GALLERY_INTRO}
        </p>

        {items.length === 0 ? (
          /* Работ ещё не положили. Пустой экран без объяснения выглядит
             поломкой, поэтому говорим прямо, что тут будет. */
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
            Тут скоро появятся работы ребят.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((item, index) => (
              <button
                key={item.file}
                onClick={() => {
                  hapticTap();
                  setOpenIndex(index);
                }}
                className="text-left active:scale-[0.98] transition-transform"
              >
                {/* Квадратная плитка с обрезкой по центру: работы приходят
                    и вертикальные, и горизонтальные, а сетка из разных
                    по высоте плиток выглядит сломанной. Целиком работу
                    видно, когда её открыли. */}
                <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-muted border border-slate-200 dark:border-border">
                  <img
                    src={galleryImageUrl(item.file, true)}
                    alt={"Работа ученика " + item.nick}
                    /* Грузим по мере прокрутки: работ станет много,
                       и тянуть их все разом незачем. */
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>

                <p className="mt-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                  @{item.nick}
                </p>
                {item.title && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {item.title}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Приписка «скинь работу в чат» — и сразу дверь в этот чат.
            Без двери она не работала: тестировщик-подросток, у которого
            чата не было, сказал прямо — «я не знаю, куда я хочу отправить,
            мне нужно тыкать в профиль, искать там ссылку». Просьба, ради
            которой надо идти искать, — это не просьба. */}
        <p className="mt-5 text-xs text-slate-500 dark:text-slate-400 leading-snug text-center">
          {GALLERY_HOW_TO_GET_IN}
        </p>

        <button
          onClick={() => openOutboundLink(COMMUNITY_LINK)}
          className="mt-3 w-full py-3 rounded-2xl font-bold text-sm text-primary dark:text-blue-300 bg-white dark:bg-card border border-primary/30 flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
        >
          Открыть чат школы <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* РАБОТА КРУПНО. Отдельный слой поверх сетки, тоже без анимаций. */}
      {openWork && (
        <div className="fixed inset-0 z-[70] bg-slate-900/95 flex flex-col">
          <div className="flex items-center gap-3 px-5 pt-4">
            <p className="font-bold text-white truncate">@{openWork.nick}</p>
            <button
              onClick={() => {
                hapticTap();
                setOpenIndex(null);
              }}
              aria-label="Закрыть работу"
              className="ml-auto p-2 rounded-xl bg-white/10 text-white active:scale-95 transition-transform"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* `object-contain` — работу показываем целиком, без обрезки:
              тут она главная, а не плитка в сетке. */}
          <div className="flex-1 min-h-0 flex items-center justify-center px-4">
            <img
              src={galleryImageUrl(openWork.file, false)}
              alt={"Работа ученика " + openWork.nick}
              className="max-w-full max-h-full object-contain rounded-2xl"
            />
          </div>

          <div className="px-5 pb-8 pt-3">
            {openWork.title && (
              <p className="text-sm text-white/80 text-center mb-3">
                {openWork.title}
              </p>
            )}

            {/* Стрелки прячем, когда работа всего одна: кнопка, которая
                возвращает на ту же картинку, выглядит поломкой. */}
            {items.length > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => step(-1)}
                  aria-label="Предыдущая работа"
                  className="p-3 rounded-2xl bg-white/10 text-white active:scale-95 transition-transform"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-mono text-xs text-white/60">
                  {(openIndex ?? 0) + 1} / {items.length}
                </span>
                <button
                  onClick={() => step(1)}
                  aria-label="Следующая работа"
                  className="p-3 rounded-2xl bg-white/10 text-white active:scale-95 transition-transform"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
