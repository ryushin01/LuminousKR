export const VERTEX_SHADER = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

/**
 * 검은 우주와 일식: 성운(fbm 잡음), 반짝이는 별, 뒤에서 빛이 새어 나오는 행성,
 * 빛이 새는 점에서 가로로 퍼지는 렌즈 플레어
 */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDim;
uniform vec2 uPlanet;
uniform float uRadius;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
  float t = uTime;

  vec2 q = vec2(fbm(uv * 1.4 + vec2(0.0, t * 0.008)), fbm(uv * 1.4 + vec2(5.2, -t * 0.006)));
  float nebula = fbm(uv * 2.2 + q * 1.6 + vec2(t * 0.004, 0.0));
  vec3 col = vec3(0.010, 0.010, 0.016);
  col += vec3(0.075, 0.068, 0.095) * smoothstep(0.42, 1.0, nebula);
  col += vec3(0.05, 0.035, 0.03) * smoothstep(0.6, 1.1, q.x) * 0.6;

  vec2 cell = floor(gl_FragCoord.xy / 2.0);
  float star = hash(cell);
  float twinkle = 0.6 + 0.4 * sin(t * 1.5 + star * 80.0);
  col += vec3(0.85, 0.88, 1.0) * step(0.9965, star) * twinkle * (0.4 + 0.6 * hash(cell + 3.1));

  vec2 d = uv - uPlanet;
  float r = length(d);
  vec2 lightDir = normalize(vec2(-0.55, 0.83));
  float facing = max(dot(d / max(r, 1e-4), lightDir), 0.0);
  float body = smoothstep(uRadius + 0.0025, uRadius - 0.0025, r);
  vec3 surface = vec3(0.022, 0.022, 0.028) + vec3(0.035) * fbm(d * 9.0 + 3.0) * (1.0 - facing * 0.5);
  surface += vec3(0.05, 0.045, 0.04) * pow(facing, 6.0) * smoothstep(uRadius * 0.6, uRadius, r);
  col = mix(col, surface, body);
  float edge = exp(-abs(r - uRadius) * 140.0);
  col += vec3(1.0, 0.86, 0.72) * edge * (0.18 + 1.5 * pow(facing, 4.0));
  float corona = exp(-max(r - uRadius, 0.0) * 10.0) * (1.0 - body);
  col += vec3(0.9, 0.62, 0.42) * corona * (0.06 + 0.5 * pow(facing, 3.0));

  vec2 sun = uPlanet + lightDir * uRadius * 1.005;
  vec2 fd = uv - sun;
  float pulse = 0.92 + 0.08 * sin(t * 0.7);
  float core = exp(-length(fd) * 70.0) * 2.4;
  float halo = exp(-length(fd) * 9.0) * 0.35;
  float streak = exp(-abs(fd.y) * 320.0) * exp(-abs(fd.x) * 1.1) * 1.1;
  float wide = exp(-abs(fd.y) * 60.0) * exp(-abs(fd.x) * 3.0) * 0.25;
  col += (vec3(1.0, 0.97, 0.92) * core + vec3(1.0, 0.8, 0.6) * halo + vec3(0.72, 0.84, 1.0) * (streak + wide)) * pulse;

  col *= mix(1.0, smoothstep(1.35, 0.25, length(uv * vec2(0.75, 1.0))), 0.85);
  col *= uDim;
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`
