/**
 * МИНИ-ИГРА 2048 — только правила, без единой строчки про экран.
 *
 * Зачем отдельным файлом: правила игры — это чистая арифметика, и её можно
 * прогнать прямо в консоли, не открывая браузер (см. раздел 5 документа
 * `JKids_Bot_как_работать_25.07.md`). Экран лежит в `components/mini-game.tsx`.
 *
 * Зачем игра вообще (замысел владельца 25.07): ребёнок сделал задания —
 * и уходит. Нужно, чтобы он ещё немного задержался, но не на пустой мотилке,
 * а на чём-то логическом. Отсюда 2048: правила знают все, они честно про
 * голову, и весь код умещается в этот файл — ни картинок, ни библиотек,
 * ни анимаций грузить не надо.
 *
 * Правила, если вдруг кто не играл: двигаешь все плитки в одну сторону,
 * две одинаковые сливаются в одну вдвое большую, после каждого хода
 * появляется новая маленькая. Цель — собрать 2048.
 */

export const BOARD_SIZE = 4;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE;

// Плитка, ради которой всё затевалось. Дойдя до неё, играть можно дальше.
export const WIN_VALUE = 2048;

// Поле — просто 16 чисел подряд. 0 значит «пусто».
// Клетка (строка r, столбец c) лежит по адресу r * 4 + c.
export type Board = number[];

export type Direction = "left" | "right" | "up" | "down";

export type MoveResult = {
  board: Board;
  // Сколько очков принёс ход: сумма всех слившихся плиток.
  gained: number;
  // Сдвинулось ли хоть что-нибудь. Если нет — ход не считается,
  // новая плитка не появляется, иначе поле забивалось бы от тычков в стену.
  moved: boolean;
};

export function emptyBoard(): Board {
  return new Array(CELL_COUNT).fill(0);
}

export function emptyCells(board: Board): number[] {
  const cells: number[] = [];

  for (let cell = 0; cell < board.length; cell += 1) {
    if (board[cell] === 0) cells.push(cell);
  }

  return cells;
}

/**
 * Кладёт новую плитку в случайную пустую клетку: обычно 2, изредка 4.
 * `random` передаётся снаружи, чтобы проверку можно было сделать
 * предсказуемой — в игре сюда идёт обычный Math.random.
 */
export function addRandomTile(board: Board, random: () => number = Math.random): Board {
  const free = emptyCells(board);

  if (free.length === 0) return board;

  const next = [...board];
  const cell = free[Math.floor(random() * free.length)];

  next[cell] = random() < 0.9 ? 2 : 4;

  return next;
}

export function createBoard(random: () => number = Math.random): Board {
  return addRandomTile(addRandomTile(emptyBoard(), random), random);
}

/**
 * Адреса клеток одной линии в том порядке, в каком плитки едут.
 * Первый адрес — та стена, к которой всё прижимается.
 */
function lineIndices(direction: Direction, line: number): number[] {
  const indices: number[] = [];

  for (let i = 0; i < BOARD_SIZE; i += 1) {
    const far = BOARD_SIZE - 1 - i;

    if (direction === "left") indices.push(line * BOARD_SIZE + i);
    else if (direction === "right") indices.push(line * BOARD_SIZE + far);
    else if (direction === "up") indices.push(i * BOARD_SIZE + line);
    else indices.push(far * BOARD_SIZE + line);
  }

  return indices;
}

/**
 * Сжимает одну линию к стене и сливает одинаковые соседние плитки.
 *
 * Важная тонкость правил: плитка, только что получившаяся слиянием, в этом же
 * ходу больше не сливается. Поэтому 2-2-4 даёт 4-4, а не сразу 8 — иначе
 * длинные ряды схлопывались бы в одну плитку и игра теряла бы всякий смысл.
 * Достигается тем, что после слияния мы перешагиваем СРАЗУ через две плитки.
 */
function collapse(values: number[]): { line: number[]; gained: number } {
  const filled = values.filter((value) => value !== 0);
  const line: number[] = [];
  let gained = 0;
  let i = 0;

  while (i < filled.length) {
    const merges = i + 1 < filled.length && filled[i] === filled[i + 1];

    if (merges) {
      const merged = filled[i] * 2;

      line.push(merged);
      gained += merged;
      i += 2;
    } else {
      line.push(filled[i]);
      i += 1;
    }
  }

  while (line.length < BOARD_SIZE) line.push(0);

  return { line, gained };
}

export function move(board: Board, direction: Direction): MoveResult {
  const next = [...board];
  let gained = 0;
  let moved = false;

  for (let line = 0; line < BOARD_SIZE; line += 1) {
    const indices = lineIndices(direction, line);
    const collapsed = collapse(indices.map((cell) => board[cell]));

    gained += collapsed.gained;

    indices.forEach((cell, position) => {
      if (next[cell] !== collapsed.line[position]) moved = true;
      next[cell] = collapsed.line[position];
    });
  }

  return { board: next, gained, moved };
}

/**
 * Остались ли ходы. Есть пустая клетка — да; иначе ищем двух одинаковых
 * соседей: пока такие есть, слить ещё можно.
 */
export function hasMoves(board: Board): boolean {
  if (emptyCells(board).length > 0) return true;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const value = board[row * BOARD_SIZE + col];

      if (col + 1 < BOARD_SIZE && board[row * BOARD_SIZE + col + 1] === value) {
        return true;
      }

      if (row + 1 < BOARD_SIZE && board[(row + 1) * BOARD_SIZE + col] === value) {
        return true;
      }
    }
  }

  return false;
}

export function bestTile(board: Board): number {
  return board.reduce((best, value) => (value > best ? value : best), 0);
}
