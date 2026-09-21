import {
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
 * Модели оборудования ASOFT — собраны заново по чертёжным листам
 * «характеристики касса.png» и «характеристики касса самообслуживания.png».
 *
 * Читались все десять видов, а не только вид спереди. Именно боковые виды
 * задают форму, которую спереди не видно:
 *
 *   • Киоск — это один сплошной корпус от плиты до верха, а не «голова на
 *     колонне». Передняя плоскость идёт сквозной, ступени уходят назад:
 *     экран 130 мм глубиной, стойка 175 мм, блок оплаты выступает вперёд.
 *   • POS стоит не на трапеции, а на изогнутой шее: передняя кромка вогнутая,
 *     задняя выпуклая, книзу шея разворачивается в плиту. Экран отклонён
 *     назад примерно на 16°, а не на 7°.
 *
 * Размеры — настоящие миллиметры в метрах. С листов взяты: киоск 1536 высоты,
 * 520 корпус, 420 глубина плиты, 12 плита, 18 рамка, 120 × 60 верхний модуль;
 * POS 420 высоты, 230 глубина плиты, 12 плита, 18 рамка. Остальное снято с
 * силуэтов ортогональных видов попиксельно.
 *
 * Расхождение по листу POS: подписи «520 мм» ширины и «420 мм» высоты между
 * собой не сходятся (пропорция самих видов 0,91). Достоверны высота и глубина,
 * ширина взята с силуэта.
 */

const MM = 0.001;

/** Скруглённый параллелепипед — корпусные панели. */
function panel(width, height, depth, radius, material, segments = 4) {
  const mesh = new Mesh(new RoundedBoxGeometry(width, height, depth, segments, radius), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Деталь, заданная боковым профилем.
 *
 * Профиль — замкнутый контур в плоскости «глубина × высота», снятый с вида
 * слева. Он выдавливается по ширине, после чего ширина вершин масштабируется
 * по высоте: так шея POS получает и свой изгиб сбоку, и развал спереди.
 *
 * @param points  [[z, y], …] в миллиметрах, контур против часовой стрелки
 * @param widthAt (yNorm) => ширина детали в метрах на этой высоте
 */
function lofted(points, height, widthAt, radius, material) {
  const curve = new CatmullRomCurve3(
    points.map(([z, y]) => new Vector3(z * MM, y * MM, 0)),
    true,
    'catmullrom',
    0.4
  );

  const shape = new Shape(curve.getPoints(points.length * 8).map((p) => new Vector2(p.x, p.y)));

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

  // Профиль снят в миллиметрах от пола: развал по ширине считаем от доли высоты.
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    position.setX(i, position.getX(i) * widthAt(Math.min(Math.max(y / height, 0), 1)));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();

  const mesh = new Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Самая передняя точка детали на заданной высоте.
 *
 * Профиль проходит через сплайн, поэтому фактическая кромка не совпадает с
 * опорными точками. Гравировку и накладки сажаем по замеру самой геометрии —
 * иначе они либо тонут в корпусе, либо висят перед ним.
 */
function frontZAt(mesh, y, tolerance = 0.006) {
  const position = mesh.geometry.attributes.position;
  const local = y - mesh.position.y;
  let front = -Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getY(i) - local) > tolerance) continue;
    front = Math.max(front, position.getZ(i));
  }
  return front === -Infinity ? mesh.position.z : front + mesh.position.z;
}

function at(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

/** Крепёжное отверстие плиты и винт задней панели — мелочь, но она читается. */
function stud(material, radius, depth = 0.003) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, depth, 14), material);
  mesh.receiveShadow = true;
  return mesh;
}

/* ─── POS-терминал ─────────────────────────────────────────────────────────── */

/**
 * Полная высота 420 мм, глубина плиты 230 мм.
 *
 * Пропорции сняты с фронтального фото (819 × 809, 0,61 мм/пиксель):
 * корпус 613 × 460 пикселей, матрица 553 × 392 при полях 26…34, шея 219 → 250,
 * плита 360. Отсюда важное: шея остаётся узкой по всей высоте и лишь слегка
 * разворачивается книзу (133 → 152 мм), а широкая — отдельная плита 219 мм.
 * Раньше шея расширялась до ширины плиты и читалась сплошным клином.
 */
const POS = {
  height: 0.42,
  // Глубина плиты и ножки снята с вида слева (лист «характеристики касса»,
  // 1,214 мм/пиксель по полной высоте 420 мм). Подпись «230 мм» на листе с его
  // же видами не сходится, поэтому глубина взята из пропорции самого вида.
  plate: { w: 0.219, h: 0.016, d: 0.154 },
  neck: { h: 0.107, topW: 0.133, bottomW: 0.152 },
  head: { w: 0.374, h: 0.29, d: 0.042, tilt: 0.28 },
  bezel: 0.018,
  module: { w: 0.042, h: 0.11, d: 0.062 },
};

/**
 * Боковой профиль ножки — по виду слева, не «на глаз».
 *
 * Ножка там тонкая: 52 мм глубины под корпусом и 74 мм у плиты, с почти
 * отвесной передней кромкой и завалом назад по задней. Только у самого низа
 * она разворачивается в опору. Прошлый профиль давал 150 мм у плиты — отсюда
 * и была «слишком толстая ножка».
 *
 * Координаты в миллиметрах, ноль — центр плиты, +Z вперёд. Сама ножка стоит
 * ближе к задней кромке плиты: на виде её центр на 28 мм позади центра опоры.
 */
const POS_NECK_PROFILE = [
  [10, 107],
  [9, 82],
  [8, 54],
  [8, 26],
  [14, 8],
  [22, 0],
  [-78, 0],
  [-72, 9],
  [-66, 28],
  [-58, 56],
  [-50, 82],
  [-42, 107],
];

export function buildPos({ shell, shellMatte, bezel, metal }, screenMaterial, wordmarkMaterial) {
  const root = new Group();

  const plate = panel(POS.plate.w, POS.plate.h, POS.plate.d, 0.005, shellMatte);
  at(plate, 0, POS.plate.h / 2, 0);
  root.add(plate);

  // Шея: один изогнутый объём, а не трапеция. Ширина разворачивается книзу.
  const neck = lofted(
    POS_NECK_PROFILE,
    POS.neck.h,
    (t) => POS.neck.bottomW + (POS.neck.topW - POS.neck.bottomW) * t ** 0.78,
    0.006,
    shell
  );
  at(neck, 0, POS.plate.h, 0);
  root.add(neck);

  if (wordmarkMaterial) {
    // Гравировка ASOFT на передней кромке шеи, сразу под экраном.
    const wordmarkY = POS.plate.h + POS.neck.h * 0.8;
    const wordmark = new Mesh(new PlaneGeometry(0.066, 0.016), wordmarkMaterial);
    at(wordmark, 0, wordmarkY, frontZAt(neck, wordmarkY) + 0.0015);
    wordmark.rotation.x = -0.24;
    root.add(wordmark);
  }

  // Голова висит на шее и отклонена назад на 16° — как на видах 2 и 3.
  const head = new Group();
  // Корпус вынесен вперёд от ножки: на видах 2 и 3 экран висит перед стойкой.
  head.position.set(0, POS.plate.h + POS.neck.h - 0.014, 0.026);
  head.rotation.x = -POS.head.tilt;
  root.add(head);

  const housing = panel(POS.head.w, POS.head.h, POS.head.d, 0.011, shell, 5);
  at(housing, 0, POS.head.h / 2, 0);
  head.add(housing);

  const screenW = 0.337;
  const screenH = 0.239;

  // Лицевая плоскость целиком — чёрная рамка, корпус остаётся только кромкой
  // по контуру. На фото поля вокруг матрицы такие же тёмные, как экран выключен.
  const frame = panel(POS.head.w - 0.005, POS.head.h - 0.005, 0.014, 0.009, bezel);
  at(frame, 0, POS.head.h / 2, POS.head.d / 2 - 0.005);
  head.add(frame);

  const screen = new Mesh(new PlaneGeometry(screenW, screenH), screenMaterial);
  at(screen, 0, POS.head.h / 2, POS.head.d / 2 + 0.0035);
  head.add(screen);

  // Модуль оплаты: отдельный блок у правой кромки, вынесен назад и наружу.
  const module = panel(POS.module.w, POS.module.h, POS.module.d, 0.006, shell);
  at(module, POS.head.w / 2 + POS.module.w / 2 - 0.002, POS.head.h / 2 + 0.015, -0.012);
  head.add(module);

  const moduleX = POS.head.w / 2 + POS.module.w / 2 - 0.002;

  const pad = panel(0.026, 0.03, 0.004, 0.002, bezel, 1);
  at(pad, moduleX, POS.head.h / 2 - 0.014, 0.026);
  head.add(pad);

  const reader = panel(0.005, 0.076, 0.004, 0.001, metal, 1);
  at(reader, moduleX + POS.module.w / 2 - 0.004, POS.head.h / 2 + 0.02, 0.004);
  head.add(reader);

  return { root, screen };
}

/* ─── Касса самообслуживания ───────────────────────────────────────────────── */

/**
 * Корпус читается как один слэб: передняя плоскость сквозная от плиты до
 * верха, ступени уходят назад. Глубины сняты с вида слева: экран 130 мм,
 * стойка 175 мм, блок оплаты выступает вперёд на 22 мм.
 */
const SCO = {
  height: 1.536,
  plate: { w: 0.52, h: 0.012, d: 0.42 },
  column: { w: 0.355, h: 0.688, d: 0.175 },
  head: { w: 0.52, h: 0.776, d: 0.13, tilt: 0.035 },
  bezel: 0.018,
  scanner: { w: 0.12, h: 0.06 },
  pay: { w: 0.24, h: 0.29, out: 0.022, bottom: 0.35 },
};

export function buildSelfCheckout(
  { shell, shellMatte, bezel, accent, lens, metal },
  screenMaterial,
  wordmarkMaterial
) {
  const root = new Group();

  const columnTop = SCO.plate.h + SCO.column.h; // 700 мм
  const headTop = columnTop + SCO.head.h; // 1476 мм
  // 12 + 688 + 776 + 60 = 1536 мм — паспортная высота сходится точно.

  // Передняя плоскость корпуса, общая для стойки и экрана.
  const front = SCO.column.d / 2;

  const plate = panel(SCO.plate.w, SCO.plate.h, SCO.plate.d, 0.006, shellMatte);
  at(plate, 0, SCO.plate.h / 2, front - SCO.plate.d / 2 + 0.03);
  root.add(plate);

  for (const [x, z] of [
    [-0.223, 0.17],
    [0.223, 0.17],
    [-0.223, -0.17],
    [0.223, -0.17],
  ]) {
    const hole = stud(bezel, 0.011);
    at(hole, x, SCO.plate.h - 0.001, plate.position.z + z);
    root.add(hole);
  }

  const column = panel(SCO.column.w, SCO.column.h, SCO.column.d, 0.008, shell);
  at(column, 0, SCO.plate.h + SCO.column.h / 2, 0);
  root.add(column);

  // Блок оплаты: выступ на передней плоскости стойки, 350…640 мм над полом.
  const payY = SCO.pay.bottom + SCO.pay.h / 2;
  const payHousing = panel(SCO.pay.w, SCO.pay.h, SCO.column.d + SCO.pay.out, 0.008, shell);
  at(payHousing, 0, payY, SCO.pay.out / 2);
  root.add(payHousing);

  const payFront = front + SCO.pay.out;

  const recess = panel(0.19, 0.155, 0.026, 0.006, bezel);
  at(recess, 0, payY + 0.012, payFront - 0.014);
  root.add(recess);

  const terminal = panel(0.138, 0.108, 0.024, 0.005, shellMatte);
  at(terminal, 0, payY + 0.016, payFront - 0.004);
  root.add(terminal);

  const keypad = panel(0.106, 0.056, 0.005, 0.003, metal, 1);
  at(keypad, 0, payY + 0.028, payFront + 0.007);
  root.add(keypad);

  const slot = panel(0.05, 0.005, 0.005, 0.001, metal, 1);
  at(slot, 0, payY - 0.026, payFront + 0.007);
  root.add(slot);

  if (wordmarkMaterial) {
    const wordmark = new Mesh(new PlaneGeometry(0.094, 0.023), wordmarkMaterial);
    at(wordmark, 0, columnTop - 0.042, front + 0.002);
    root.add(wordmark);
  }

  // Голова: тот же передний план, что у стойки, поэтому корпус читается сплошным.
  const head = new Group();
  head.position.set(0, columnTop, front - SCO.head.d / 2);
  head.rotation.x = -SCO.head.tilt;
  root.add(head);

  const housing = panel(SCO.head.w, SCO.head.h, SCO.head.d, 0.012, shell, 5);
  at(housing, 0, SCO.head.h / 2, 0);
  head.add(housing);

  // Задняя панель с винтами по углам — вид 4.
  const backPlate = panel(SCO.head.w - 0.012, SCO.head.h - 0.03, 0.006, 0.008, shellMatte);
  at(backPlate, 0, SCO.head.h / 2, -SCO.head.d / 2 - 0.001);
  head.add(backPlate);

  for (const [x, y] of [
    [-0.225, 0.062],
    [0.225, 0.062],
    [-0.225, SCO.head.h - 0.062],
    [0.225, SCO.head.h - 0.062],
  ]) {
    const screw = stud(bezel, 0.0055, 0.002);
    screw.rotation.x = Math.PI / 2;
    at(screw, x, y, -SCO.head.d / 2 - 0.004);
    head.add(screw);
  }

  // Матрица: сверху поле 57 мм, снизу 55 мм — под подпись.
  const screenW = SCO.head.w - SCO.bezel * 2 - 0.035;
  const screenH = 0.664;
  const screenY = SCO.head.h - 0.057 - screenH / 2;

  // Как и у POS, лицевая плоскость целиком чёрная — корпус виден только кромкой.
  const frame = panel(SCO.head.w - 0.006, SCO.head.h - 0.006, 0.014, 0.01, bezel);
  at(frame, 0, SCO.head.h / 2, SCO.head.d / 2 - 0.005);
  head.add(frame);

  const screen = new Mesh(new PlaneGeometry(screenW, screenH), screenMaterial);
  at(screen, 0, screenY, SCO.head.d / 2 + 0.0035);
  head.add(screen);

  // Верхний модуль: сканер в зелёной оправе, 120 × 60 мм, во всю глубину —
  // на виде сверху и на виде сзади он виден с обеих сторон корпуса.
  const scannerY = SCO.head.h + SCO.scanner.h / 2 - 0.006;

  // Зелёная — только оправа: корпус сканера перекрывает её почти целиком и
  // оставляет по контуру светящуюся кромку, как на видах 1, 5 и на выноске.
  const collar = panel(
    SCO.scanner.w + 0.012,
    SCO.scanner.h + 0.008,
    SCO.head.d + 0.004,
    0.016,
    accent,
    5
  );
  at(collar, 0, scannerY, 0);
  head.add(collar);

  const scanner = panel(SCO.scanner.w, SCO.scanner.h - 0.004, SCO.head.d + 0.016, 0.012, bezel, 5);
  at(scanner, 0, scannerY, 0);
  head.add(scanner);

  const camera = new Mesh(new CylinderGeometry(0.007, 0.007, 0.004, 16), lens);
  camera.rotation.x = Math.PI / 2;
  camera.castShadow = true;
  at(camera, 0, scannerY, SCO.head.d / 2 + 0.006);
  head.add(camera);

  return { root, screen };
}

export const BUILDERS = {
  pos: buildPos,
  'self-checkout': buildSelfCheckout,
};
