/** GLSL фона сцены. Само оборудование — настоящая геометрия, ему шейдеры не нужны. */

export const backdropVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Фон сцены — тёмная студийная циклорама: тёмно-серый верх, уход почти в чёрный
 * по краям и мягкое пятно света за оборудованием. Матовый чёрный корпус на
 * таком фоне держится контровым светом и бликами по фаскам, а фон остаётся
 * светлее корпуса — иначе машина превратилась бы в пятно.
 */
export const backdropFragment = /* glsl */ `
  precision highp float;

  uniform vec2 uGlowPos;
  uniform vec3 uGlowColor;
  uniform float uGlow;
  uniform float uAspect;

  varying vec2 vUv;

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

    // Вертикальный градиент циклорамы плюс затемнение к углам кадра.
    // Значения подобраны так, чтобы середина кадра после ACES и перевода в sRGB
    // совпала с фоном страницы #141618 — иначе канвас и страница расходятся.
    vec3 color = mix(vec3(0.0165, 0.0216, 0.0216), vec3(0.0550, 0.0673, 0.0648), smoothstep(-0.1, 0.62, vUv.y));
    color *= 1.0 - smoothstep(0.28, 0.95, length(p)) * 0.5;

    // Пятно света за объектом — оно ведёт взгляд и отделяет корпус от фона.
    vec2 g = (vUv - uGlowPos) * vec2(uAspect, 1.35);
    color += exp(-pow(length(g) * 2.4, 2.0)) * uGlow * uGlowColor * 0.9;

    float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.011;

    gl_FragColor = vec4(color, 1.0);
  }
`;
