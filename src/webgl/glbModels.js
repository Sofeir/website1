import {
  DoubleSide,
  EquirectangularReflectionMapping,
  MeshBasicMaterial,
  PMREMGenerator,
  SRGBColorSpace,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

/**
 * Модели оборудования из Blender (blender/asoft-devices.blend → public/models/*.glb).
 *
 * Материалы берутся из файла как есть: GLTFLoader собирает из Principled BSDF
 * физические материалы (шероховатость, металл, лак), и корпус выглядит так же,
 * как в Material Preview у Blender. Свет — то же студийное HDRI, что и во
 * вьюпорте Blender (см. loadStudioEnvironment).
 *
 * Экран — единственное исключение: это источник изображения, а не поверхность,
 * поэтому он рисуется MeshBasicMaterial без освещения и тонмаппинга — картинка
 * на сайте совпадает с файлом пиксель в пиксель.
 */

const loader = new GLTFLoader();

export async function loadProductModel(url, anisotropy = 8) {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;

  const replaced = new Map();
  const shellMaterials = [];
  let screenMaterial = null;
  let wordmarkMaterial = null;

  root.traverse((node) => {
    if (!node.isMesh) return;
    const source = node.material;
    let material = replaced.get(source);

    if (!material) {
      const name = source.name || '';
      if (/Screen/.test(name)) {
        const map = source.map;
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = anisotropy;
        material = new MeshBasicMaterial({ map, toneMapped: false });
        material.name = name;
        screenMaterial = material;
        source.dispose();
      } else {
        material = source;
        material.anisotropy = anisotropy;
        if (material.map) material.map.anisotropy = anisotropy;
        if (/Wordmark/.test(name)) wordmarkMaterial = material;
        else shellMaterials.push(material);
      }
      // Корпус рисуем с обеих сторон: если у детали в Blender развернутся
      // нормали, отсечение задних граней снесёт стенки и машина станет полой.
      material.side = DoubleSide;
      replaced.set(source, material);
    }
    node.material = material;
  });

  return { root, shellMaterials, screenMaterial, wordmarkMaterial };
}

/**
 * Студийное окружение — HDRI `forest.exr` из Blender (Material Preview по
 * умолчанию, CC0, Poly Haven), переведённое в оттенки серого и уменьшенное
 * до 256×128: цвет корпуса задаёт материал, а не небо; корпус матовый, и
 * отражение после префильтрации всё равно размыто — большее разрешение
 * добавило бы только вес.
 */
export async function loadStudioEnvironment(renderer, url) {
  const hdr = await new HDRLoader().loadAsync(url);
  hdr.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(hdr);
  hdr.dispose();
  pmrem.dispose();
  return target.texture;
}
