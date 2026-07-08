/**
 * ВИКТОРИНА ДНЯ — правила редактирования (для владельца):
 * - каждый день приложение само выбирает QUIZ_PER_DAY вопросов из списка
 *   (у всех учеников в один день — одинаковые вопросы)
 * - question / options / explanation можно менять свободно
 * - correctIndex — номер правильного варианта, СЧИТАЯ С НУЛЯ (0 = первый)
 * - id у существующих вопросов не менять; новый вопрос = новый id
 * - explanation показывается после ответа — сюда клади «зачем это» и
 *   мягкий призыв открыть Blender и попробовать
 */

export const QUIZ_PER_DAY = 5;
export const QUIZ_XP_PER_CORRECT = 4;
export const QUIZ_GOLD_PER_CORRECT = 2;

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "q-extrude",
    question: "Что делает Extrude (клавиша E) в режиме редактирования?",
    options: [
      "Удаляет выделенные грани",
      "Выдавливает новую геометрию из выделения",
      "Сглаживает поверхность",
    ],
    correctIndex: 1,
    explanation:
      "Extrude «вытягивает» новые грани из выделенных — так из куба растят почти любую форму. Открой Blender, выдели грань и нажми E!",
  },
  {
    id: "q-bevel",
    question: "Для чего нужен Bevel (Ctrl+B)?",
    options: [
      "Скруглить или срезать острые края",
      "Соединить два объекта",
      "Покрасить грань",
    ],
    correctIndex: 0,
    explanation:
      "В реальном мире нет идеально острых углов — Bevel делает модель живой. Попробуй на кубе: Ctrl+B и покрути колесо мыши.",
  },
  {
    id: "q-loopcut",
    question: "Что добавляет Loop Cut (Ctrl+R)?",
    options: [
      "Случайный шум на поверхность",
      "Новый объект в сцену",
      "Кольцевой разрез по модели",
    ],
    correctIndex: 2,
    explanation:
      "Loop Cut добавляет «кольцо» новых рёбер — главный способ добавить детализацию там, где нужно. Проверь на цилиндре!",
  },
  {
    id: "q-move",
    question: "Какая клавиша перемещает объект?",
    options: ["G", "M", "P"],
    correctIndex: 0,
    explanation:
      "G — от слова Grab («схватить»). А если после G нажать X, Y или Z — объект поедет строго по оси. Попробуй: G, потом Z.",
  },
  {
    id: "q-scale",
    question: "Какая клавиша масштабирует (меняет размер)?",
    options: ["R", "S", "T"],
    correctIndex: 1,
    explanation:
      "S — Scale. Вместе с осями ещё полезнее: S, затем Z, — растянет только по высоте. G/R/S — три кита работы в Blender.",
  },
  {
    id: "q-rotate",
    question: "Какая клавиша вращает объект?",
    options: ["R", "O", "W"],
    correctIndex: 0,
    explanation:
      "R — Rotate. Нажми R, потом X, и введи 90 — объект повернётся ровно на 90° по оси X. Точнее, чем мышкой!",
  },
  {
    id: "q-tab",
    question: "Что переключает клавиша Tab в окне 3D?",
    options: [
      "Открывает настройки",
      "Скрывает объект",
      "Object Mode ↔ Edit Mode",
    ],
    correctIndex: 2,
    explanation:
      "В Object Mode двигают целые объекты, в Edit Mode правят вершины, рёбра и грани. Tab — самая нажимаемая клавиша 3дшника.",
  },
  {
    id: "q-add",
    question: "Как быстро добавить новый объект в сцену?",
    options: ["Shift+A", "Ctrl+N", "Alt+O"],
    correctIndex: 0,
    explanation:
      "Shift+A открывает меню Add — кубы, сферы, свет, камеры. Открой Blender и добавь Monkey (Сюзанну) — талисман Blender!",
  },
  {
    id: "q-subsurf",
    question: "Что делает модификатор Subdivision Surface?",
    options: [
      "Разрезает объект пополам",
      "Сглаживает модель, добавляя полигоны",
      "Убирает все материалы",
    ],
    correctIndex: 1,
    explanation:
      "Он «дробит» каждую грань на несколько и сглаживает форму — так из угловатой болванки получается плавное яблоко.",
  },
  {
    id: "q-roughness",
    question: "За что отвечает Roughness в материале?",
    options: [
      "За цвет объекта",
      "За прозрачность",
      "За матовость/глянцевость поверхности",
    ],
    correctIndex: 2,
    explanation:
      "Roughness = шероховатость: 0 — зеркальный глянец, 1 — полностью матовый. Покрути ползунок на сфере и посмотри на блик!",
  },
  {
    id: "q-metallic",
    question: "Что произойдёт, если выкрутить Metallic на 1?",
    options: [
      "Поверхность станет вести себя как металл",
      "Объект станет тяжелее",
      "Объект начнёт светиться",
    ],
    correctIndex: 0,
    explanation:
      "Metallic меняет саму природу отражений: металл отражает окружение с собственным цветом. Сравни Metallic 0 и 1 на одном шаре.",
  },
  {
    id: "q-render-engines",
    question: "Чем Cycles отличается от Eevee?",
    options: [
      "Cycles — только для игр",
      "Cycles точнее считает свет, но медленнее",
      "Ничем, это одно и то же",
    ],
    correctIndex: 1,
    explanation:
      "Eevee рисует быстро и «примерно», Cycles честно трассирует лучи света — фотореализм, но дольше. Отрендери сцену в обоих и сравни!",
  },
  {
    id: "q-render-key",
    question: "Какая клавиша запускает рендер кадра?",
    options: ["F12", "F5", "Пробел"],
    correctIndex: 0,
    explanation:
      "F12 — и Blender рисует финальную картинку с камеры. Свои лучшие рендеры сохраняй — из них соберётся твоё портфолио.",
  },
  {
    id: "q-uv",
    question: "Что такое UV-развёртка?",
    options: [
      "Защита модели от вирусов",
      "Способ ускорить рендер",
      "Раскладка 3D-поверхности на плоскость для текстур",
    ],
    correctIndex: 2,
    explanation:
      "Представь, что модель — картонная коробка, которую разрезали и разложили на столе. Так текстура «знает», куда ложиться.",
  },
  {
    id: "q-shade-smooth",
    question: "Что делает Shade Smooth?",
    options: [
      "Добавляет тысячи новых полигонов",
      "Визуально сглаживает, не меняя геометрию",
      "Удаляет острые углы навсегда",
    ],
    correctIndex: 1,
    explanation:
      "Shade Smooth — «оптический обман»: полигоны те же, а выглядит гладко. Правая кнопка по объекту → Shade Smooth. Дёшево и красиво!",
  },
  {
    id: "q-origin",
    question: "Что такое Origin (оранжевая точка) у объекта?",
    options: [
      "Центр, вокруг которого объект вращается и масштабируется",
      "Место, где объект создали",
      "Точка подключения материала",
    ],
    correctIndex: 0,
    explanation:
      "Сдвинь Origin к краю двери — и она начнёт открываться как настоящая, вокруг петель. Object → Set Origin.",
  },
  {
    id: "q-camera",
    question: "Что попадёт в финальный рендер?",
    options: [
      "Всё, что видно на экране",
      "Только то, что видит активная камера",
      "Только выделенные объекты",
    ],
    correctIndex: 1,
    explanation:
      "Рендер = взгляд камеры. Нажми 0 на цифровой клавиатуре, чтобы посмотреть «глазами камеры», и выстрой красивый кадр.",
  },
  {
    id: "q-mesh",
    question: "Из чего состоит любая 3D-модель (меш)?",
    options: [
      "Из пикселей",
      "Из вершин, рёбер и граней",
      "Из слоёв краски",
    ],
    correctIndex: 1,
    explanation:
      "Вершины соединяются рёбрами, рёбра образуют грани — вот и вся магия 3D. В Edit Mode можно двигать каждую вершину отдельно.",
  },
  {
    id: "q-undo",
    question: "Как отменить последнее действие?",
    options: ["Ctrl+Z", "Alt+F4", "Shift+Delete"],
    correctIndex: 0,
    explanation:
      "Ctrl+Z — лучший друг новичка. Не бойся экспериментировать: в Blender почти всё можно отменить. Смелее!",
  },
  {
    id: "q-duplicate",
    question: "Как продублировать объект?",
    options: ["Shift+D", "Ctrl+C без вставки", "F2"],
    correctIndex: 0,
    explanation:
      "Shift+D создаёт копию и сразу даёт её подвинуть. Так из одного дерева делают лес за минуту. Попробуй размножить кубики!",
  },
];

// Детерминированный выбор вопросов дня: у всех учеников один и тот же набор.
const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
};

export const getTodaysQuizQuestions = (dateKey: string): QuizQuestion[] => {
  return [...QUIZ_QUESTIONS]
    .sort((a, b) => hashString(dateKey + a.id) - hashString(dateKey + b.id))
    .slice(0, QUIZ_PER_DAY);
};
