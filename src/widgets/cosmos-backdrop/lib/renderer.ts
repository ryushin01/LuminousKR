import { FRAGMENT_SHADER, VERTEX_SHADER } from './shader.ts'

export type CosmosRenderer = {
  render(timeSeconds: number, dim: number): void
  resize(width: number, height: number): void
  dispose(): void
}

/** 화면 너비에 맞춰 행성 위치·크기를 고릅니다 (좁은 화면에서는 위쪽 가운데로). */
export function planetFor(width: number, height: number): { x: number; y: number; radius: number } {
  const aspect = width / Math.max(1, height)
  if (aspect < 0.9) return { x: aspect * 0.18, y: 0.3, radius: 0.13 }
  return { x: aspect * 0.24, y: 0.13, radius: 0.17 }
}

/** GPU 없이 CPU로 그리는 렌더러 이름 (Chrome SwiftShader, Mesa llvmpipe·softpipe, Windows 기본 렌더러) */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i

/**
 * 소프트웨어 렌더러인지. 전체 화면 셰이더를 CPU로 그리면 화면이 버벅이고 컴파일만 몇 초 걸리므로 쓰지 않습니다.
 * (failIfMajorPerformanceCaveat만으로는 Chrome의 SwiftShader를 거르지 못함)
 */
export function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const name = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) as unknown
  return typeof name === 'string' && SOFTWARE_RENDERER.test(name)
}

/** 다음 화면 그리기까지 기다립니다 (컴파일이 끝났는지 다시 볼 때). */
export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()))

/** KHR_parallel_shader_compile의 완료 상태 상수 */
const COMPLETION_STATUS_KHR = 0x91b1

/**
 * 셰이더 프로그램이 다 만들어질 때까지 기다립니다.
 * KHR_parallel_shader_compile이 있으면 드라이버가 따로 컴파일하는 동안 메인 스레드를 막지 않고 프레임마다 묻습니다.
 * 없으면 링크 결과를 물을 때 그 자리에서 컴파일을 마칩니다(이때도 첫 화면을 그린 뒤라 첫 표시는 늦추지 않음).
 */
async function waitForProgram(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  parallel: boolean,
  waitFrame: () => Promise<void>,
): Promise<boolean> {
  if (parallel) {
    while (!gl.getProgramParameter(program, COMPLETION_STATUS_KHR)) {
      await waitFrame()
      if (gl.isContextLost()) return false
    }
  }
  return gl.getProgramParameter(program, gl.LINK_STATUS) === true
}

/**
 * WebGL2 배경 그리기를 준비합니다. WebGL2를 못 쓰거나(소프트웨어 렌더러 포함) 셰이더를 만들지 못하면 null
 * (CSS 배경으로 대신함).
 * 컴파일을 기다리는 동안 화면을 막지 않도록 비동기로 돌려줍니다.
 */
export async function createCosmosRenderer(
  canvas: HTMLCanvasElement,
  waitFrame: () => Promise<void> = nextFrame,
): Promise<CosmosRenderer | null> {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
    // GPU 없이 소프트웨어로 그려야 하면 만들지 않고 CSS 배경으로 대신합니다(아래 이름 검사와 함께).
    failIfMajorPerformanceCaveat: true,
  })
  if (!gl) return null
  if (isSoftwareRenderer(gl)) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return null
  }
  const vertex = gl.createShader(gl.VERTEX_SHADER)
  const fragment = gl.createShader(gl.FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  // 완료 상태를 물으려면 컴파일 전에 확장을 켭니다.
  const parallel = gl.getExtension('KHR_parallel_shader_compile') !== null
  gl.shaderSource(vertex, VERTEX_SHADER)
  gl.shaderSource(fragment, FRAGMENT_SHADER)
  // 컴파일·링크 결과는 바로 묻지 않습니다(물으면 그 자리에서 끝날 때까지 기다림).
  gl.compileShader(vertex)
  gl.compileShader(fragment)
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)

  const release = () => {
    gl.deleteProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
  }
  if (!(await waitForProgram(gl, program, parallel, waitFrame))) {
    release()
    return null
  }
  gl.useProgram(program)

  // 화면 전체를 덮는 삼각형 하나
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const uResolution = uniform('uResolution')
  const uTime = uniform('uTime')
  const uDim = uniform('uDim')
  const uPlanet = uniform('uPlanet')
  const uRadius = uniform('uRadius')

  return {
    resize(width, height) {
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      gl.uniform2f(uResolution, width, height)
      const planet = planetFor(width, height)
      gl.uniform2f(uPlanet, planet.x, planet.y)
      gl.uniform1f(uRadius, planet.radius)
    },
    render(timeSeconds, dim) {
      gl.uniform1f(uTime, timeSeconds)
      gl.uniform1f(uDim, dim)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      gl.deleteBuffer(buffer)
      release()
    },
  }
}
