/**
 * ЗАЛ СЛАВЫ — сжимает работы учеников под телефон.
 *
 * Владелец складывает оригиналы на рабочем столе, папка на каждого ребёнка,
 * названная его ником в Телеграме:
 *
 *   Desktop\Бот-тамагочик\Галерея\Dobrojelatel123\что_угодно.jpg
 *
 * Скрипт проходит по всем папкам и на КАЖДУЮ работу делает два файла
 * в `client/public/gallery/`:
 *
 *   Dobrojelatel123-1-small.webp   ~500 px  — для сетки превью
 *   Dobrojelatel123-1.webp        ~1200 px  — когда работу открыли целиком
 *
 * ЗАЧЕМ ДВА РАЗМЕРА. В сетке работа видна размером с ноготь — грузить туда
 * картинку на 1200 точек значит потратить мегабайты ради пикселей, которых
 * не видно. Мелкая весит в разы меньше, а крупная подгружается только тогда,
 * когда ребёнок реально ткнул в работу.
 *
 * ПОЧЕМУ webp, А НЕ jpg. При том же качестве весит примерно вдвое меньше.
 * Тот же формат, в котором лежит призрак и одежда.
 *
 * ПОРЯДОК РАБОТ внутри одного ребёнка — по имени файла, по алфавиту.
 * Значит номера (-1, -2) закрепляются за файлами: добавили ПОЗЖЕ файл
 * с именем в конце алфавита — он станет -2, а старая работа останется -1.
 * Поэтому оригиналы из папки удалять нельзя, иначе номера съедут.
 *
 * ЗАПУСК (sharp в зависимостях проекта не лежит — он нужен раз в месяц,
 * тащить его в сборку смысла нет):
 *
 *   npm install sharp --no-save
 *   node tools/gallery-webp.mjs
 *
 * После прогона скрипт печатает готовый кусок для `gallery-config.ts` —
 * его надо вставить туда руками. Сделано намеренно: подписи к работам
 * пишет человек, и перезаписывать их машиной нельзя.
 */

import { readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, extname } from "node:path";
import sharp from "sharp";

/** Где владелец держит оригиналы. */
const SOURCE_DIR =
  "C:\\Users\\MaxxPC\\Desktop\\Бот-тамагочик\\Галерея";

/**
 * Куда кладём готовое. Это `public`, а НЕ `src/assets` — важно:
 * из `src` картинки попадают в сборку и грузятся всем подряд,
 * из `public` они лежат отдельными файлами и подтягиваются только тогда,
 * когда ребёнок открыл зал славы. Кто туда не заходил — не платит ничем.
 */
const OUT_DIR = "client/public/gallery";

/** Длинная сторона крупной картинки. Больше телефону всё равно не нужно. */
const FULL_SIZE = 1200;

/** Длинная сторона превью для сетки. */
const SMALL_SIZE = 500;

/**
 * Качество. 80 — та точка, где на фотографии рендера глазом уже не отличить
 * от оригинала, а вес ещё падает. Ниже 75 на градиентах вылезают разводы,
 * а у нас почти все работы — это свет и градиенты.
 */
const FULL_QUALITY = 80;
const SMALL_QUALITY = 75;

const PICTURES = [".jpg", ".jpeg", ".png", ".webp"];

if (!existsSync(SOURCE_DIR)) {
  console.error("Нет папки с работами: " + SOURCE_DIR);
  process.exit(1);
}

// Чистим папку целиком: иначе работы, убранные из оригиналов, останутся
// висеть в приложении навсегда, и никто не поймёт, откуда они взялись.
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const authors = readdirSync(SOURCE_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const report = [];

for (const nick of authors) {
  const files = readdirSync(join(SOURCE_DIR, nick))
    .filter((name) => PICTURES.includes(extname(name).toLowerCase()))
    .sort();

  if (files.length === 0) {
    console.log(nick + ": картинок нет, пропускаю");
    continue;
  }

  const made = [];

  for (let i = 0; i < files.length; i++) {
    const source = join(SOURCE_DIR, nick, files[i]);
    const base = nick + "-" + (i + 1);

    // `fit: inside` — вписываем в квадрат, пропорции не трогаем.
    // `withoutEnlargement` — маленькую работу НЕ растягиваем: растянутая
    // выглядит мыльной, лучше пусть будет мелкой и резкой.
    await sharp(source)
      .resize(FULL_SIZE, FULL_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: FULL_QUALITY })
      .toFile(join(OUT_DIR, base + ".webp"));

    await sharp(source)
      .resize(SMALL_SIZE, SMALL_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: SMALL_QUALITY })
      .toFile(join(OUT_DIR, base + "-small.webp"));

    made.push(base);
    console.log(nick + ": " + files[i] + "  ->  " + base + ".webp");
  }

  report.push({ nick, made });
}

console.log("\n\nГотово. Вставить в client/src/lib/gallery-config.ts:\n");
for (const author of report) {
  console.log("  {");
  console.log('    nick: "' + author.nick + '",');
  console.log("    works: [");
  for (const base of author.made) {
    console.log('      { file: "' + base + '" },');
  }
  console.log("    ],");
  console.log("  },");
}
