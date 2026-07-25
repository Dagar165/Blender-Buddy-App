import { useEffect, useState, type RefObject } from "react";

/**
 * ТОЧКИ-УКАЗАТЕЛИ у правого края главного экрана: сколько экранов всего
 * и на каком ты сейчас.
 *
 * ЗАЧЕМ (владелец 26.07). Первая версия говорила «Листай вверх» только
 * на первом экране. Со второго не было видно, что есть третий, — и владелец
 * не нашёл ни зал славы, ни движухи: «вообще этого нигде нет. Или я
 * не нашёл, но это тоже много о чём говорит». Подсказка на одном экране
 * из трёх — это не подсказка.
 *
 * Точки решают это насовсем: они видны на КАЖДОМ экране и сразу показывают,
 * что экранов три. Тот же приём, что в приложении, которое он показал
 * как образец.
 *
 * Почему у правого края, а не снизу по центру: снизу стоят вкладки,
 * и ещё один ряд точек над ними читался бы как их часть.
 *
 * Нажимаются: это не только указатель, но и способ перескочить.
 */
export function ScreenDots({
  scrollRef,
  count,
  labels,
}: {
  /** Прокручиваемый контейнер с экранами. */
  scrollRef: RefObject<HTMLDivElement>;
  count: number;
  /** Названия экранов — только для озвучки, на глаз их не видно. */
  labels: string[];
}) {
  const [active, setActive] = useState(0);

  /**
   * Какой экран сейчас перед глазами — считаем по РЕАЛЬНОМУ положению
   * самих экранов, а не по формуле «сколько окон отмотали».
   *
   * Формула не годится: экраны РАЗНОЙ высоты. Первый выше окна, потому что
   * призрак на нём жёсткого размера и не ужимается (прямое требование
   * владельца), а два других ровно в окно. Деление на высоту окна начинает
   * врать сразу же.
   *
   * IntersectionObserver тут тоже пробовали и убрали: он доставляет ответы
   * вместе с кадрами, а в приложении есть места, где кадров нет — тогда
   * подсветка застревает. Обычный слушатель прокрутки надёжнее.
   */
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const update = () => {
      const sections = Array.from(
        node.querySelectorAll<HTMLElement>(":scope > section")
      );
      if (sections.length === 0) return;

      // Активен последний экран, чей верх уже поднялся выше середины окна.
      const line = node.scrollTop + node.clientHeight / 2;
      let index = 0;
      sections.forEach((section, i) => {
        if (section.offsetTop <= line) index = i;
      });

      setActive(Math.max(0, Math.min(count - 1, index)));
    };

    update();
    node.addEventListener("scroll", update, { passive: true });
    return () => node.removeEventListener("scroll", update);
  }, [scrollRef, count]);

  const goTo = (index: number) => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: index * node.clientHeight, behavior: "smooth" });
  };

  return (
    <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-2">
      {Array.from({ length: count }).map((_, index) => (
        <button
          key={index}
          onClick={() => goTo(index)}
          aria-label={labels[index] ?? `Экран ${index + 1}`}
          aria-current={index === active}
          className="pointer-events-auto p-1.5"
        >
          {/* Без `transition`: плавное превращение требует кадров, а окно
              без кадров застревает на первом состоянии — точка навсегда
              осталась бы подсвеченной не там. Та же причина, по которой
              в этом приложении нет анимаций появления. */}
          <span
            className={`block rounded-full ${
              index === active
                ? "w-2 h-5 bg-primary"
                : "w-2 h-2 bg-slate-300 dark:bg-slate-600"
            }`}
          />
        </button>
      ))}
    </div>
  );
}
