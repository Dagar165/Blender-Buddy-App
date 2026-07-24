/**
 * ЛЕТАЮЩИЕ КУБИКИ В КОМНАТЕ ПРИЗРАКА.
 *
 * Замысел владельца: на его лендинге «Молот Тора» по фону летали каркасные
 * кубики, и это красиво. Здесь то же самое, но с жёстким условием, которое
 * он поставил сам: не сломать и не утяжелить загрузку.
 *
 * Поэтому сделано вот так, и менять это не надо:
 * - НЕТ картинок и НЕТ библиотек. Каждый кубик — маленький SVG прямо
 *   в разметке, около полукилобайта на весь файл. Загружать нечего.
 * - Движение — чистый CSS (@keyframes в index.css). Не React, не таймеры,
 *   не requestAnimationFrame. Значит оно не считается на каждом кадре
 *   в JavaScript, не мешает прокрутке и не встаёт, когда окно свёрнуто
 *   и кадров нет (на этом уже обжигался тур).
 * - Анимируются ТОЛЬКО transform и opacity — это браузер делает на
 *   видеокарте. Ни ширины, ни отступы не трогаются, поэтому страница
 *   не пересчитывает вёрстку ни разу.
 * - Кубиков ШЕСТЬ. Не увеличивать: смысл в редком движении на фоне,
 *   а не в снегопаде, который спорит с призраком за внимание.
 * - `pointer-events-none` — сквозь них проходят и поглаживание, и
 *   перетаскивание призрака.
 * - У кого в телефоне включено «уменьшить движение», кубики просто
 *   стоят на месте (правило в index.css).
 */

// Каждый кубик: где стоит, какого размера, как долго летит и когда начал.
// Задержки отрицательные — иначе при открытии экрана все шестеро стартуют
// разом и получается залп, а не жизнь на фоне.
const CUBES = [
  { left: "8%", top: "14%", size: 34, duration: 17, delay: -2, spin: 26 },
  { left: "78%", top: "22%", size: 22, duration: 23, delay: -9, spin: -19 },
  { left: "18%", top: "62%", size: 18, duration: 20, delay: -14, spin: 15 },
  { left: "86%", top: "58%", size: 30, duration: 26, delay: -5, spin: -23 },
  { left: "62%", top: "8%", size: 15, duration: 15, delay: -11, spin: 21 },
  { left: "36%", top: "76%", size: 24, duration: 29, delay: -18, spin: -17 },
];

function WireCube({ size }: { size: number }) {
  // Каркас куба в изометрии: верхняя грань, три ребра вниз и низ.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    >
      <path d="M20 2 38 12 20 22 2 12Z" />
      <path d="M2 12v20l18 10 18-10V12" />
      <path d="M20 22v20" />
    </svg>
  );
}

export function RoomCubes() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {CUBES.map((cube) => (
        <span
          key={cube.left + cube.top}
          className="room-cube absolute text-primary/25 dark:text-sky-300/20"
          style={{
            left: cube.left,
            top: cube.top,
            animationDuration: `${cube.duration}s`,
            animationDelay: `${cube.delay}s`,
            // Каждому свой размах поворота, иначе шестеро качаются в такт.
            ["--cube-spin" as string]: `${cube.spin}deg`,
          }}
        >
          <WireCube size={cube.size} />
        </span>
      ))}
    </div>
  );
}
