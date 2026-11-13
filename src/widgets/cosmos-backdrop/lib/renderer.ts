import { FRAGMENT_SHADER, VERTEX_SHADER } from './shader.ts'

export type CosmosRenderer = {
  render(timeSeconds: number, dim: number): void
  resize(width: number, height: number): void
  dispose(): void
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/** 화면 너비에 맞춰 행성 위치·크기를 고릅니다 (좁은 화면에서는 위쪽 가운데로). */
export function planetFor(width: number, height: number): { x: number; y: number; radius: number } {
  const aspect = width / Math.max(1, height)
  if (aspect < 0.9) return { x: aspect * 0.18, y: 0.3, radius: 0.13 }
  return { x: aspect * 0.24, y: 0.13, radius: 0.17 }
}

/** WebGL2를 못 쓰면 null (CSS 배경으로 대신함) */
export function createCosmosRenderer(canvas: HTMLCanvasElement): CosmosRenderer | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
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
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
    },
  }
}
