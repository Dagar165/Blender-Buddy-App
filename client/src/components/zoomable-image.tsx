import { useEffect, useRef, useState } from "react";

/**
 * КАРТИНКА, КОТОРУЮ МОЖНО ПРИБЛИЗИТЬ ПАЛЬЦАМИ.
 *
 * ══ ЗАЧЕМ ══
 *
 * Просьба владельца 27.07 про зал славы: «невозможно увеличить изображение,
 * а его прям очень хочется рассмотреть — двумя пальцами раздвинуть
 * и приблизить. Но не так, что чуть-чуть поднял и оно автоматом стало
 * во весь экран, а чтобы можно было в процентах увеличивать, как это
 * во всех мессенджерах со всеми картинками работает».
 *
 * Отсюда всё устройство: масштаб плавный (любое значение от 1 до MAX_SCALE),
 * а не две ступени «мелко/во весь экран». Сколько сейчас — написано
 * числом в углу, пока картинка увеличена.
 *
 * ══ ЧТО УМЕЕТ ══
 *
 * - щипок двумя пальцами — масштаб, и точка между пальцами остаётся
 *   на месте (иначе картинка «убегает» из-под рук);
 * - одним пальцем — таскать, но только когда уже приближено;
 * - двойное касание — приблизить в это место и обратно;
 * - колесо мыши — то же самое на компьютере, чтобы можно было проверять
 *   не только с телефона.
 *
 * ══ ЧЕГО ЗДЕСЬ НАРОЧНО НЕТ ══
 *
 * ⚠️ НИКАКИХ CSS-ПЕРЕХОДОВ. Плавное «доезжание» требует кадров, а в этом
 * приложении есть места, где кадров нет, и переход застревает на первом
 * состоянии — картинка осталась бы навсегда в промежуточном масштабе.
 * Общее правило приложения, см. `JKids_Bot_как_работать_25.07.md`.
 *
 * ⚠️ `touch-action: none` обязателен. Без него Телеграм и браузер забирают
 * жест себе: страница начинает прокручиваться, а мини-апп — сворачиваться.
 * Вертикальный свайп у Телеграма отобран глобально (см. `App.tsx`),
 * но это второй замок, и он нужен именно здесь.
 */

const MIN_SCALE = 1;
const MAX_SCALE = 5;

// Во сколько раз приближает двойное касание. Достаточно, чтобы разглядеть
// сетку на модели, и не так много, чтобы потеряться в пикселях.
const DOUBLE_TAP_SCALE = 2.5;

// Два касания считаются двойным, если уложились в это время и в этот радиус.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 30;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const distance = (a: React.Touch, b: React.Touch) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export function ZoomableImage({
  src,
  alt,
  /** Меняется — масштаб сбрасывается. Обычно это номер открытой работы. */
  resetKey,
}: {
  src: string;
  alt: string;
  resetKey?: string | number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Состояние текущего жеста. В ref, а не в state: меняется на каждое
  // движение пальца, а перерисовывать из-за него нечего.
  const gestureRef = useRef<{
    startDistance: number;
    startScale: number;
    startMid: { x: number; y: number };
    startOffset: { x: number; y: number };
  } | null>(null);

  const panRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  // Открыли другую работу — начинаем с обычного размера. Иначе следующая
  // картинка открывалась бы приближенной в случайное место.
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [resetKey, src]);

  /**
   * Насколько далеко можно утащить картинку.
   *
   * Считаем от РЕАЛЬНОГО размера картинки на экране, а не от размера окна:
   * работы приходят и вертикальные, и горизонтальные, и у вертикальной
   * по бокам пусто. От окна граница разрешала бы утащить картинку
   * в эту пустоту и потерять её из виду.
   */
  const limitsFor = (nextScale: number) => {
    const image = imgRef.current;
    const box = boxRef.current;

    if (!image || !box) return { x: 0, y: 0 };

    return {
      x: Math.max(0, (image.offsetWidth * nextScale - box.clientWidth) / 2),
      y: Math.max(0, (image.offsetHeight * nextScale - box.clientHeight) / 2),
    };
  };

  const applyScale = (
    nextScale: number,
    anchor: { x: number; y: number },
    from: { scale: number; offset: { x: number; y: number } }
  ) => {
    const box = boxRef.current;
    if (!box) return;

    const rect = box.getBoundingClientRect();
    // Точка, вокруг которой крутим, — относительно ЦЕНТРА окна: сдвиг
    // картинки тоже считается от центра, иначе математика не сойдётся.
    const m = {
      x: anchor.x - (rect.left + rect.width / 2),
      y: anchor.y - (rect.top + rect.height / 2),
    };

    const factor = nextScale / from.scale;
    const raw = {
      x: m.x - factor * (m.x - from.offset.x),
      y: m.y - factor * (m.y - from.offset.y),
    };

    const limit = limitsFor(nextScale);

    setScale(nextScale);
    setOffset({
      x: clamp(raw.x, -limit.x, limit.x),
      y: clamp(raw.y, -limit.y, limit.y),
    });
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];

      gestureRef.current = {
        startDistance: distance(a, b),
        startScale: scale,
        startMid: {
          x: (a.clientX + b.clientX) / 2,
          y: (a.clientY + b.clientY) / 2,
        },
        startOffset: offset,
      };
      panRef.current = null;
      return;
    }

    if (event.touches.length === 1 && scale > 1) {
      const touch = event.touches[0];
      panRef.current = {
        x: touch.clientX - offset.x,
        y: touch.clientY - offset.y,
      };
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const gesture = gestureRef.current;

    if (event.touches.length === 2 && gesture) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const nextScale = clamp(
        (gesture.startScale * distance(a, b)) / gesture.startDistance,
        MIN_SCALE,
        MAX_SCALE
      );

      // Пальцы могут и двигаться, и разъезжаться одновременно — держимся
      // за середину между ними, а не за ту, что была в начале жеста.
      applyScale(
        nextScale,
        { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
        { scale: gesture.startScale, offset: gesture.startOffset }
      );

      // Середина уехала — пересчитываем опору, иначе картинка тянется
      // за пальцами с запозданием.
      gesture.startMid = {
        x: (a.clientX + b.clientX) / 2,
        y: (a.clientY + b.clientY) / 2,
      };
      return;
    }

    const pan = panRef.current;

    if (event.touches.length === 1 && pan && scale > 1) {
      const touch = event.touches[0];
      const limit = limitsFor(scale);

      setOffset({
        x: clamp(touch.clientX - pan.x, -limit.x, limit.x),
        y: clamp(touch.clientY - pan.y, -limit.y, limit.y),
      });
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (event.touches.length === 0) {
      gestureRef.current = null;
      panRef.current = null;
    }

    // Двойное касание ловим сами: у мини-аппа своего события для этого нет,
    // а `dblclick` на телефоне приходит с задержкой в треть секунды.
    if (event.changedTouches.length !== 1 || event.touches.length !== 0) return;

    const touch = event.changedTouches[0];
    const now = Date.now();
    const last = lastTapRef.current;

    const isDouble =
      last !== null &&
      now - last.time < DOUBLE_TAP_MS &&
      Math.hypot(touch.clientX - last.x, touch.clientY - last.y) <
        DOUBLE_TAP_SLOP_PX;

    if (isDouble) {
      lastTapRef.current = null;

      if (scale > 1) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      } else {
        applyScale(
          DOUBLE_TAP_SCALE,
          { x: touch.clientX, y: touch.clientY },
          { scale, offset }
        );
      }

      return;
    }

    lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
  };

  const handleWheel = (event: React.WheelEvent) => {
    const nextScale = clamp(
      scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
      MIN_SCALE,
      MAX_SCALE
    );

    if (nextScale === 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    applyScale(nextScale, { x: event.clientX, y: event.clientY }, { scale, offset });
  };

  return (
    <div
      ref={boxRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
      className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center"
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }}
        className="max-w-full max-h-full object-contain rounded-2xl select-none"
      />

      {/* Сколько сейчас. Показывается только когда приближено: на обычном
          размере «100%» — лишний шум поверх работы. */}
      {scale > 1.02 && (
        <span className="absolute top-2 right-2 rounded-full bg-slate-900/70 px-2.5 py-1 font-mono text-[11px] font-bold text-white/90">
          {Math.round(scale * 100)}%
        </span>
      )}
    </div>
  );
}
