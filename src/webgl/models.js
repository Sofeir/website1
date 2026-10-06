import {
  BufferAttribute,
  CatmullRomCurve3,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  PlaneGeometry,
  Shape,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Модели оборудования ASOFT — собраны по восьми студийным рендерам:
 * четыре ракурса POS-терминала и четыре ракурса кассы самообслуживания.
 *
 * Геометрия снята с рендеров попиксельно, а не «на глаз». Метод: силуэт по
 * порогу относительно фона, затем перевод контура в миллиметры по полной
 * высоте машины (420 мм у POS, 1536 мм у киоска). Вид спереди даёт ширины,
 * боковые — глубины и углы, вид сзади — задние панели.
 *
 * Главное, что показали боковые ракурсы и чего не было в прежних моделях:
 *
 *   • Корпус обеих машин — клин, а не плита. У POS толщина растёт с 20 мм
 *     вверху до 75 мм внизу, у киоска — с 52 до 155 мм. Лицевая плоскость
 *     наклонена, задняя почти отвесная; отсюда и клин.
 *   • Стойка POS — изогнутое лезвие: оно выходит из задней части плиты,
 *     идёт вверх-вперёд и втыкается в затылок корпуса, а плита уезжает
 *     вперёд под экран. Прежняя прямая «шея» по центру плиты — ошибка.
 *   • Колонна киоска стоит отвесно спереди и заваливается назад книзу;
 *     корпус свешивается вперёд на 95 мм, образуя заметный уступ.
 *
 * Все размеры — настоящие миллиметры, переведённые в метры. Полные высоты
 * (420 и 1536 мм) оставлены прежними: по высоте сцена считает дистанцию
 * камеры, и менять её нельзя.
 */

const MM = 0.001;

/**
 * Направление, от которого считается запечённый блик. Задано в осях детали:
 * сверху, слева и на зрителя — так же, как ставят свет в предметной съёмке.
 */
const GLOSS = (() => {
  const v = { x: -0.42, y: 0.78, z: 0.46 };
  const len = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / len, y: v.y / len, z: v.z / len };
})();

/**
 * Рельеф детали: тон каждой вершины зависит от её нормали в осях самой детали.
 *
 * Это не освещение. Направление «света» здесь вморожено в геометрию, поэтому
 * при повороте модели рисунок поворачивается вместе с ней: грань, которая была
 * светлее, остаётся ровно такой же светлой под любым углом и в любом кадре.
 * Ни бликов, ни пятен, ни мерцания — только постоянная разница тонов между
 * гранями, за счёт которой корпус перестаёт быть плоской чёрной заливкой.
 *
 * Плоские грани при этом не осветляются вовсе — ни верхние, ни лицевые.
 * Подсвечена только фаска, и она даёт рёбра, по которым форма и читается.
 */
export function relief(geometry) {
  const normal = geometry.attributes.normal;
  const count = normal.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);

    // Глянец, запечённый в геометрию.
    //
    // Настоящий глянец — это отражение, и оно по определению зависит от того,
    // откуда смотрят: при повороте блик поехал бы по корпусу. Поэтому блик
    // здесь считается не от камеры и не от источника, а от нормали в осях
    // самой детали и фиксированного направления. Результат выглядит как
    // полированный пластик, но намертво привязан к поверхности: повернёшь
    // модель — повернётся вместе с ней, ничего никуда не поползёт.
    //
    // Две доли, как у настоящего отражения: широкая мягкая даёт общий налив
    // формы, узкая — собственно блеск на скруглениях.
    const dot = nx * GLOSS.x + ny * GLOSS.y + nz * GLOSS.z;
    const facing = Math.max(dot, 0);

    let tone = 1;
    tone += 0.55 * facing ** 2; // мягкий налив по форме
    tone += 1.6 * facing ** 6; // подсветка ближе к блику
    tone += 11 * facing ** 11; // сам блеск — узкая яркая полоса на скруглении
    tone -= 0.24 * Math.max(-dot, 0); // отвёрнутое темнеет

    const value = Math.min(Math.max(tone, 0.62), 8);
    colors[i * 3] = value;
    colors[i * 3 + 1] = value;
    colors[i * 3 + 2] = value;
  }

  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

/** Скруглённый параллелепипед — корпусные панели. */
function panel(width, height, depth, radius, material, segments = 4) {
  const geometry = relief(new RoundedBoxGeometry(width, height, depth, segments, radius));
  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Контур, вдавленный внутрь на `amount`.
 *
 * ExtrudeGeometry со скруглением раздувает контур наружу ровно на bevelSize:
 * фаска строится не внутрь сечения, а поверх него. Без компенсации деталь
 * вырастает на радиус фаски со всех сторон — POS становился 437 мм вместо 420.
 * Поэтому в ExtrudeGeometry уходит уменьшенный контур, а фаска возвращает его
 * к замеренному силуэту.
 */
function inset(outline, amount) {
  const n = outline.length;
  // Знак площади даёт направление обхода, а оно — сторону «внутрь».
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
  }
  const sign = area >= 0 ? 1 : -1;

  /**
   * Нормаль ребра, идущего от точки `from` в сторону `step`.
   * Соседа ищем на заметном расстоянии: рядом стоящие точки выборки почти
   * совпадают, и направление ребра между ними вырождается в шум.
   */
  const edgeNormal = (from, step) => {
    const a = outline[from];
    for (let k = 1; k < n; k++) {
      const b = outline[(from + step * k + n * k) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < amount * 0.2) continue;
      const turn = (sign * step) / len;
      return new Vector2(-dy * turn, dx * turn);
    }
    return new Vector2(0, 0);
  };

  return outline.map((point, i) => {
    const bisector = edgeNormal(i, -1).add(edgeNormal(i, 1));
    const length = bisector.length();
    if (length < 1e-9) return point.clone();
    bisector.divideScalar(length);
    return point.clone().addScaledVector(bisector, amount);
  });
}

/**
 * Деталь, заданная боковым профилем.
 *
 * Профиль — замкнутый контур в плоскости «глубина × высота», снятый с вида
 * сбоку. Он выдавливается по ширине, после чего ширина вершин масштабируется
 * по высоте: так одна деталь получает и изгиб сбоку, и развал спереди.
 *
 * @param points  [[z, y], …] в миллиметрах
 * @param height  высота детали в миллиметрах — по ней нормируется развал
 * @param widthAt (t 0..1 снизу вверх) => ширина детали в метрах
 */
function lofted(points, height, widthAt, radius, material) {
  // Длинные прямые участки профиля намеренно разбиты опорными точками:
  // на редкой сетке сплайн выбрасывает петлю за крайние точки, и деталь
  // вырастает за свой габарит — киоск так становился на 21 мм выше паспорта.
  const curve = new CatmullRomCurve3(
    points.map(([z, y]) => new Vector3(z * MM, y * MM, 0)),
    true,
    'catmullrom',
    0.4
  );

  const sampled = curve.getSpacedPoints(points.length * 6).map((p) => new Vector2(p.x, p.y));
  const shape = new Shape(inset(sampled, radius));

  const geometry = new ExtrudeGeometry(shape, {
    depth: 1 - radius * 2,
    bevelEnabled: true,
    bevelSize: radius,
    bevelThickness: radius,
    bevelSegments: 4,
    curveSegments: 1,
  });

  // Выдавливание идёт по Z; разворачиваем так, чтобы ширина легла на X,
  // а профиль остался в плоскости «глубина × высота». Поворот именно на −90°:
  // при +90° глубина профиля инвертируется и деталь встаёт к камере задом.
  geometry.translate(0, 0, -(1 - radius * 2) / 2);
  geometry.rotateY(-Math.PI / 2);

  const h = height * MM;
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(Math.max(position.getY(i) / h, 0), 1);
    position.setX(i, position.getX(i) * widthAt(t));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  relief(geometry);

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Самая передняя точка детали на заданной высоте.
 *
 * Профиль проходит через сплайн, поэтому фактическая кромка не совпадает с
 * опорными точками. Гравировку сажаем по замеру самой геометрии — иначе она
 * либо тонет в корпусе, либо висит перед ним.
 */
function frontZAt(mesh, y, tolerance = 0.006) {
  const position = mesh.geometry.attributes.position;
  const local = y - mesh.position.y;

  // Окно берём от высоты самой детали, а не фиксированное. Сетка вдоль профиля
  // редкая — у колонны киоска шаг около 18 мм, — и в узкую полосу высот
  // попадали только вершины затылка. Тогда «передняя кромка» получалась позади
  // корпуса, и надпись ASOFT тонула внутри колонны.
  mesh.geometry.computeBoundingBox();
  const span = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
  const window = Math.max(tolerance, span * 0.03);

  let front = -Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i) - local) > window) continue;
    front = Math.max(front, position.getZ(i));
  }
  return front === -Infinity ? mesh.position.z : front + mesh.position.z;
}

function at(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

/** Ножка основания и крепёжное отверстие плиты — мелочь, но она читается. */
function stud(material, radius, depth = 0.003, segments = 14) {
  const mesh = new Mesh(relief(new CylinderGeometry(radius, radius, depth, segments)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* ─── POS-терминал ─────────────────────────────────────────────────────────── */

/**
 * Полная высота 420 мм.
 *
 * С вида спереди (1925 × 2000, 0,246 мм/пиксель): корпус 376 мм ширины,
 * матрица 332 мм, стойка 134 мм вверху и 153 мм внизу, плита 220 мм,
 * модуль оплаты 37 × 112 мм у правой кромки.
 *
 * С вида справа (1233 × 1275, 0,377 мм/пиксель): плита 221 мм глубины,
 * лицевая плоскость наклонена на 17,5°, длина её 293 мм, толщина корпуса
 * 20 мм у верхней кромки и 75 мм у нижней.
 *
 * Сходимость: 293 · cos 17,5° = 279 мм — ровно столько корпус занимает по
 * высоте на виде спереди (1135 пикселей). Два независимых ракурса сошлись,
 * значит и угол, и длина взяты верно.
 */
const POS = {
  height: 0.42,
  plate: { w: 0.22, h: 0.019, d: 0.221, foot: 0.005 },
  arm: { h: 0.162, bottomW: 0.155, topW: 0.124 },
  // Ширина корпуса подогнана под заставку: текстура 872 × 614 снята с вида
  // спереди, где высота матрицы сжата наклоном, поэтому на самой плоскости
  // экрана её пропорция равна 872 / 614 · cos 17,5° = 1,3545. При такой
  // ширине поле вокруг матрицы выходит одинаковым со всех четырёх сторон —
  // 18 мм, — а картинка не растягивается и логотип на ней остаётся круглым.
  head: { w: 0.378, face: 0.293, tilt: (17.5 * Math.PI) / 180, baseY: 0.133, baseZ: 0.0516 },
  screen: { w: 0.342, h: 0.257 },
  module: { w: 0.03, h: 0.112, d: 0.06, x: 0.2055, y: 0.306, z: -0.065, tilt: 0.147 },
};

/**
 * Боковой профиль стойки — с вида справа, в миллиметрах от центра плиты.
 *
 * Стойка стоит не по центру плиты, а в её задней трети: передняя кромка
 * на −45…−25 мм, задняя на −84…−34 мм. Книзу лезвие разворачивается в опору
 * с вогнутой галтелью спереди. Толщина 39 мм у плиты и 24 мм под корпусом.
 * Ноль высоты — верх плиты.
 */
const POS_ARM_PROFILE = [
  [-25, 156],
  [-29, 126],
  [-33.3, 101],
  [-35.9, 86],
  [-38.6, 71],
  [-41.2, 56],
  [-43.5, 41],
  [-44.6, 26],
  [-40.8, 18],
  [-33, 10],
  [-22, 0],
  [-45, 0],
  [-68, 0],
  [-90, 0],
  [-105, 0],
  [-98, 10],
  [-88, 18],
  [-83.9, 26],
  [-79, 41],
  [-73.7, 56],
  [-68.4, 71],
  [-63.1, 86],
  [-57.8, 101],
  [-52.6, 116],
  [-47.3, 131],
  [-41.2, 147],
  [-33.7, 162],
];

/**
 * Профиль корпуса в его собственных осях: лицевая плоскость отвесна и лежит
 * на z = 0, задняя уходит назад. Пересчитан из мировых замеров поворотом на
 * угол наклона, поэтому клин точно тот же, что на рендерах.
 *
 * Затылок снят по участкам выше и ниже модуля оплаты — сам модуль в середине
 * перекрывает силуэт и по нему затылок не прочитать. Через обе точки проходит
 * прямая с наклоном 6,8°: толщина 75 мм у нижней кромки и 20 мм у верхней.
 * Верх закруглён полукругом: на рендере кромка выходит на 8 мм выше углов.
 */
const POS_HEAD_PROFILE = [
  [0, 293],
  [0, 220],
  [0, 146],
  [0, 73],
  [0, 0],
  [-18, 5.6],
  [-36, 11.3],
  [-54, 17],
  [-71.6, 22.6],
  [-58.5, 92],
  [-45.4, 161.5],
  [-32.4, 230.5],
  [-19.3, 299],
  [-17, 302],
  [-11.4, 304.4],
  [-4.6, 303.4],
  [-0.2, 298.6],
];

export function buildPos({ shell, shellMatte, bezel, metal }, screenMaterial, wordmarkMaterial) {
  const root = new Group();

  // Плита стоит на четырёх низких ножках: на всех боковых ракурсах между
  // её дном и полом есть просвет в 5 мм.
  const plateY = POS.plate.foot + POS.plate.h / 2;
  const plate = panel(POS.plate.w, POS.plate.h, POS.plate.d, 0.008, shellMatte);
  at(plate, 0, plateY, 0);
  root.add(plate);

  for (const [x, z] of [
    [-0.078, 0.086],
    [0.078, 0.086],
    [-0.078, -0.088],
    [0.078, -0.088],
  ]) {
    const foot = stud(bezel, 0.015, POS.plate.foot, 16);
    at(foot, x, POS.plate.foot / 2, z);
    root.add(foot);
  }

  const plateTop = POS.plate.foot + POS.plate.h;

  // Стойка: изогнутое лезвие шириной 155 → 124 мм, а не клин во всю плиту.
  const arm = lofted(
    POS_ARM_PROFILE,
    POS.arm.h / MM,
    (t) => POS.arm.bottomW + (POS.arm.topW - POS.arm.bottomW) * t,
    0.01,
    shell
  );
  at(arm, 0, plateTop, 0);
  root.add(arm);

  if (wordmarkMaterial) {
    // Гравировка ASOFT на передней кромке стойки, сразу под корпусом.
    // На рендере она 36 × 9 мм; здесь чуть крупнее — машина в кадре сайта
    // высотой около 200 пикселей, и в натуральный размер надпись нечитаема.
    const wordmarkY = 0.118;
    const wordmark = new Mesh(new PlaneGeometry(0.058, 0.0145), wordmarkMaterial);
    at(wordmark, 0, wordmarkY, frontZAt(arm, wordmarkY) + 0.0012);
    root.add(wordmark);
  }

  // Корпус: клин с отвесной лицевой плоскостью, наклонённый назад на 17,5°.
  const head = new Group();
  head.position.set(0, POS.head.baseY, POS.head.baseZ);
  head.rotation.x = -POS.head.tilt;
  root.add(head);

  const housing = lofted(POS_HEAD_PROFILE, POS.head.face / MM, () => POS.head.w, 0.012, shell);
  head.add(housing);

  // Лицевая плоскость целиком чёрная: на рендере поля вокруг матрицы такие же
  // тёмные, как погашенный экран, а корпус виден только кромкой по контуру.
  // Отдельной накладки-рамки нет. Она была прямоугольной пластиной поверх
  // корпуса, её скругление не совпадало со скруглением самой лицевой грани,
  // и поле вокруг матрицы выходило разной толщины по углам. Теперь матрица
  // лежит прямо на грани, а рамку образует собственная фаска корпуса —
  // она по построению одинакова со всех четырёх сторон.
  // Стекло: тёмная пластина на 6 мм крупнее матрицы. Без неё картинка лежала
  // прямо на корпусе и читалась наклейкой; тонкая тёмная кайма вокруг даёт
  // кромку стекла, и изображение видно именно как экран.
  const glass = panel(POS.screen.w + 0.006, POS.screen.h + 0.006, 0.003, 0.002, bezel, 2);
  at(glass, 0, POS.head.face / 2, 0.0005);
  head.add(glass);

  const screen = new Mesh(new PlaneGeometry(POS.screen.w, POS.screen.h), screenMaterial);
  at(screen, 0, POS.head.face / 2, 0.0026);
  head.add(screen);

  // Порты на правом боку корпуса: площадка почти заподлицо с затылком —
  // на виде справа она читается швом, а не приливом.
  const ports = panel(0.01, 0.07, 0.022, 0.004, shellMatte);
  at(ports, POS.head.w / 2 - 0.002, 0.095, -0.05);
  head.add(ports);

  for (const y of [0.078, 0.112]) {
    const socket = panel(0.004, 0.0065, 0.014, 0.001, bezel, 1);
    at(socket, POS.head.w / 2 + 0.004, y, -0.05);
    head.add(socket);
  }

  // Модуль считывателя карт: отдельный блок у правой кромки. Корпусу он не
  // параллелен — на виде справа его задняя кромка уходит назад на 13 мм по
  // высоте блока, это 8,4°, а не 17,5° корпуса. Поэтому у него свой наклон.
  const reader = new Group();
  reader.position.set(POS.module.x, POS.module.y, POS.module.z);
  reader.rotation.x = -POS.module.tilt;
  root.add(reader);

  const module = panel(POS.module.w, POS.module.h, POS.module.d, 0.007, shell);
  reader.add(module);

  // Канал для проведения карты: тёмный паз во всю высоту вдоль внутреннего
  // ребра модуля. На фото он читается как узкая щель между модулем и корпусом,
  // светлая полоса по кромке и есть его стенка.
  const channel = panel(0.01, POS.module.h - 0.006, 0.006, 0.001, bezel, 1);
  at(channel, -POS.module.w / 2 + 0.005, 0, POS.module.d / 2 - 0.004);
  reader.add(channel);

  const channelEdge = panel(0.0025, POS.module.h - 0.01, 0.003, 0.001, metal, 1);
  at(channelEdge, -POS.module.w / 2 + 0.0012, 0, POS.module.d / 2 + 0.0005);
  reader.add(channelEdge);

  // Площадка бесконтактной оплаты: 13 × 8 мм по центру лицевой грани.
  const tapPad = panel(0.0135, 0.008, 0.004, 0.0015, shellMatte, 1);
  at(tapPad, 0.0015, -0.001, POS.module.d / 2 + 0.0008);
  reader.add(tapPad);

  return { root, screen };
}

/* ─── Касса самообслуживания ───────────────────────────────────────────────── */

/**
 * Полная высота 1536 мм.
 *
 * С вида спереди (1024 × 1536, 1,053 мм/пиксель): корпус 540 мм ширины,
 * матрица 476 × 755 мм, колонна 360 мм, плита 540 мм, сканер 170 мм,
 * блок оплаты 235 × 195 мм на высоте 328…523 мм.
 *
 * С вида сбоку (985 × 979, 1,749 мм/пиксель, глубины приведены к плите
 * 500 мм): лицевая плоскость корпуса наклонена на 10,1°, толщина корпуса
 * 158 мм внизу и 52 мм вверху, колонна 174 мм у плиты и 65 мм под корпусом,
 * задняя плоскость почти отвесна на всю высоту.
 */
const SCO = {
  height: 1.536,
  plate: { w: 0.54, h: 0.014, d: 0.5 },
  column: { h: 0.66, bottomW: 0.352, topW: 0.36 },
  // Заставка 442 × 676, на плоскости экрана это 0,6538 · cos 10,1° = 0,6437.
  // Ширина корпуса подобрана так, чтобы поле вокруг матрицы было одинаковым
  // со всех сторон и равным 16 мм.
  head: { w: 0.5346, face: 0.8106, tilt: (10.1 * Math.PI) / 180, baseY: 0.674, baseZ: 0.161 },
  screen: { w: 0.4986, h: 0.7746 },
  scanner: { w: 0.148, h: 0.056, d: 0.042, z: -0.005 },
  pay: { w: 0.244, h: 0.201, bottom: 0.3255, front: 0.103 },
};

/**
 * Профиль колонны, в миллиметрах от центра плиты. Ноль высоты — верх плиты.
 * Перед отвесный (+91 мм почти до самого верха), зад заваливается назад
 * книзу: с 0 под корпусом до −105 мм у плиты. Отсюда характерный силуэт
 * «паруса», который на прежней прямоугольной колонне пропадал.
 */
const SCO_COLUMN_PROFILE = [
  [66, 660],
  [82, 586],
  [91, 506],
  [91, 386],
  [91, 286],
  [91, 186],
  [91, 86],
  [91, 0],
  [45, 0],
  [0, 0],
  [-55, 0],
  [-105, 0],
  [-88, 136],
  [-68, 286],
  [-45, 436],
  [-18, 586],
  [0, 660],
];

/** Профиль корпуса в его осях: лицевая плоскость на z = 0, зад — клином. */
const SCO_HEAD_PROFILE = [
  [0, 810.6],
  [0, 709],
  [0, 608],
  [0, 506],
  [0, 405],
  [0, 304],
  [0, 203],
  [0, 101],
  [0, 0],
  [-39, 6.9],
  [-78, 13.9],
  [-117, 20.8],
  [-155.5, 27.7],
  [-134, 138],
  [-111, 249.3],
  [-89, 372],
  [-69.2, 495.8],
  [-49.1, 664.9],
  [-46.4, 766],
  [-51.1, 819.6],
  [-34, 817],
  [-17, 814],
];

export function buildSelfCheckout(
  { shell, shellMatte, bezel, accent, lens, metal },
  screenMaterial,
  wordmarkMaterial
) {
  const root = new Group();

  // Плита анкерится в пол: она тонкая и с отверстиями по углам.
  const plate = panel(SCO.plate.w, SCO.plate.h, SCO.plate.d, 0.007, shellMatte);
  at(plate, 0, SCO.plate.h / 2, 0);
  root.add(plate);

  for (const [x, z] of [
    [-0.225, 0.208],
    [0.225, 0.208],
    [-0.225, -0.208],
    [0.225, -0.208],
  ]) {
    const hole = stud(bezel, 0.013, 0.003);
    at(hole, x, SCO.plate.h - 0.001, z);
    root.add(hole);
  }

  const column = lofted(
    SCO_COLUMN_PROFILE,
    SCO.column.h / MM,
    (t) => SCO.column.bottomW + (SCO.column.topW - SCO.column.bottomW) * t,
    0.016,
    shell
  );
  at(column, 0, SCO.plate.h, 0);
  root.add(column);

  // Блок оплаты: выступ на передней плоскости колонны, 328…523 мм над полом.
  const payY = SCO.pay.bottom + SCO.pay.h / 2;
  // Обрамление ниши собрано из четырёх планок, а не из цельной коробки:
  // сплошной блок закрывал бы своей лицевой гранью всё, что стоит за ней,
  // и терминал с приёмником карты просто не был виден — блок читался пустым
  // прямоугольником. Планки оставляют настоящий проём 183 × 146 мм.
  const opening = { w: 0.183, h: 0.146 };
  const barY = (SCO.pay.h - opening.h) / 2;
  const barX = (SCO.pay.w - opening.w) / 2;
  const payDepth = 0.05;
  const payZ = SCO.pay.front - payDepth / 2;

  // Планки перекрываются по углам: иначе на стыках видны скруглённые торцы
  // и обрамление читается набором отдельных пластин, а не одной рамкой.
  for (const [w, h, x, y] of [
    [SCO.pay.w, barY, 0, (opening.h + barY) / 2],
    [SCO.pay.w, barY, 0, -(opening.h + barY) / 2],
    [barX, SCO.pay.h, (opening.w + barX) / 2, 0],
    [barX, SCO.pay.h, -(opening.w + barX) / 2, 0],
  ]) {
    const bar = panel(w, h, payDepth, 0.004, shell);
    at(bar, x, payY + y, payZ);
    root.add(bar);
  }

  // Начинка блока снята с вида спереди (1024 × 1536, 1,053 мм/пиксель):
  // тёмный терминал 183 × 146 мм утоплен в корпус, внутри него панель
  // пин-пада 137 × 94 мм, над ней светлая щель приёма карты 141 × 6 мм
  // на высоте 474 мм, а под терминалом короткий штрих 26 × 4 мм.
  const terminal = panel(0.189, 0.152, 0.022, 0.006, bezel);
  at(terminal, 0, 0.421, SCO.pay.front - 0.016);
  root.add(terminal);

  const padFace = panel(0.137, 0.094, 0.006, 0.004, shellMatte, 1);
  at(padFace, 0, 0.421, SCO.pay.front - 0.007);
  root.add(padFace);

  const cardSlot = panel(0.141, 0.006, 0.005, 0.0015, metal, 1);
  at(cardSlot, 0, 0.474, SCO.pay.front - 0.0055);
  root.add(cardSlot);

  const mark = panel(0.026, 0.004, 0.004, 0.001, metal, 1);
  at(mark, 0, 0.363, SCO.pay.front - 0.0055);
  root.add(mark);

  if (wordmarkMaterial) {
    // Гравировка ASOFT на колонне: 97 × 15 мм на высоте 605 мм.
    const wordmark = new Mesh(new PlaneGeometry(0.21, 0.0525), wordmarkMaterial);
    at(wordmark, 0, 0.575, frontZAt(column, 0.575) + 0.0012);
    root.add(wordmark);
  }

  // Корпус свешивается вперёд с колонны: клин, наклонённый назад на 10,1°.
  const head = new Group();
  head.position.set(0, SCO.head.baseY, SCO.head.baseZ);
  head.rotation.x = -SCO.head.tilt;
  root.add(head);

  const housing = lofted(SCO_HEAD_PROFILE, SCO.head.face / MM, () => SCO.head.w, 0.014, shell);
  head.add(housing);

  const glass = panel(SCO.screen.w + 0.006, SCO.screen.h + 0.006, 0.003, 0.002, bezel, 2);
  at(glass, 0, SCO.head.face / 2, 0.0005);
  head.add(glass);

  const screen = new Mesh(new PlaneGeometry(SCO.screen.w, SCO.screen.h), screenMaterial);
  at(screen, 0, SCO.head.face / 2, 0.0026);
  head.add(screen);

  // Сканер: зелёная оправа выступает над корпусом на 64 мм. Зелёная только
  // рамка — тёмный блок перекрывает её и оставляет светящуюся кромку.
  const scannerY = SCO.head.face + 0.018;

  const collar = panel(SCO.scanner.w, SCO.scanner.h, SCO.scanner.d, 0.018, accent, 5);
  at(collar, 0, scannerY, SCO.scanner.z);
  head.add(collar);

  // Тёмное окно сканера. Раньше оно было на 12 мм ниже оправы и его верхняя
  // грань шла в миллиметре от верхней грани оправы — две почти совпадающие
  // плоскости мерцали при малейшем повороте, отсюда и «дрожащая чёлка».
  // Теперь между ними 10 мм: совпадать нечему.
  const scanner = panel(
    SCO.scanner.w - 0.03,
    SCO.scanner.h - 0.018,
    SCO.scanner.d + 0.006,
    0.012,
    bezel,
    5
  );
  at(scanner, 0, scannerY, SCO.scanner.z);
  head.add(scanner);

  // Камера: светлое кольцо оправы и тёмный объектив внутри. Одним чёрным
  // цилиндром на чёрном окне она не читалась вовсе.
  const cameraZ = SCO.scanner.z + SCO.scanner.d / 2 + 0.005;
  const ring = new Mesh(relief(new CylinderGeometry(0.012, 0.012, 0.003, 24)), metal);
  ring.rotation.x = Math.PI / 2;
  at(ring, 0, scannerY, cameraZ);
  head.add(ring);

  const camera = new Mesh(relief(new CylinderGeometry(0.008, 0.008, 0.004, 24)), lens);
  camera.rotation.x = Math.PI / 2;
  at(camera, 0, scannerY, cameraZ + 0.0015);
  head.add(camera);

  return { root, screen };
}

export const BUILDERS = {
  pos: buildPos,
  'self-checkout': buildSelfCheckout,
};
