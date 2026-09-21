import { LinearMipmapLinearFilter, SRGBColorSpace, TextureLoader } from 'three';

/**
 * Изображение на дисплеях оборудования.
 *
 * Заставка вырезана из тех же студийных снимков, что и сами машины
 * (см. scripts/prepare-assets.mjs), и уходит текстурой на 3D-поверхность экрана —
 * значит поворачивается вместе с корпусом, а не живёт слоем поверх сцены.
 */

const loader = new TextureLoader();

/** Шрифт интерфейса может ещё грузиться — без ожидания надпись подменится. */
async function fontsReady() {
  try {
    await document.fonts?.ready;
  } catch {
    // отсутствие Font Loading API не повод остаться без гравировки
  }
}

/**
 * Готовая текстура дисплея: заставка с фотографии продукта.
 * Экран в сцене всегда под углом, поэтому без мипмапов и анизотропии
 * мелкая графика на нём «плывёт».
 */
export async function createScreenTexture(src, anisotropy = 8) {
  const texture = await loader.loadAsync(src);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Гравировка ASOFT на стойке и колонне — она есть на обеих машинах в кадре.
 * Это набранная подпись на корпусе, а не фирменный знак: знак живёт на экране.
 */
export async function createWordmarkTexture() {
  await fontsReady();

  const { CanvasTexture } = await import('three');
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.font = '600 56px "Montserrat", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(206, 212, 216, 0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '14px';
  ctx.fillText('ASOFT', canvas.width / 2 + 7, canvas.height / 2);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
