import { describe, expect, it, vi } from 'vitest'
import { createCosmosRenderer, isSoftwareRenderer, planetFor } from './renderer.ts'

const DEBUG_RENDERER = 0x9246
const COMPLETION_STATUS_KHR = 0x91b1

/** WebGL2 컨텍스트 흉내: 렌더러 이름, 병렬 컴파일 지원, 몇 번 물어야 컴파일이 끝나는지 */
function fakeGl(options: { renderer: string; parallel: boolean; readyAfter?: number }) {
  let asked = 0
  const calls: string[] = []
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    LINK_STATUS: 3,
    RENDERER: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    getExtension: (name: string) => {
      if (name === 'WEBGL_debug_renderer_info') return { UNMASKED_RENDERER_WEBGL: DEBUG_RENDERER }
      if (name === 'KHR_parallel_shader_compile') return options.parallel ? {} : null
      if (name === 'WEBGL_lose_context') return { loseContext: () => calls.push('lose') }
      return null
    },
    getParameter: (name: number) => (name === DEBUG_RENDERER ? options.renderer : 'WebKit WebGL'),
    createShader: () => ({}),
    createProgram: () => ({}),
    shaderSource: () => {},
    compileShader: () => calls.push('compile'),
    attachShader: () => {},
    linkProgram: () => calls.push('link'),
    getProgramParameter: (_program: unknown, name: number) => {
      if (name === COMPLETION_STATUS_KHR) {
        asked += 1
        calls.push('poll')
        return asked > (options.readyAfter ?? 0)
      }
      calls.push('link-status')
      return true
    },
    isContextLost: () => false,
    useProgram: () => {},
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    getUniformLocation: () => ({}),
    deleteProgram: () => {},
    deleteShader: () => {},
    deleteBuffer: () => {},
  }
  const canvas = { getContext: () => gl } as unknown as HTMLCanvasElement
  return { gl: gl as unknown as WebGL2RenderingContext, canvas, calls }
}

const GPU = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)'

describe('우주 배경 렌더러', () => {
  it('GPU 없이 CPU로 그리는 렌더러를 알아봅니다', () => {
    const software = [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver',
    ]
    for (const renderer of software) {
      expect(isSoftwareRenderer(fakeGl({ renderer, parallel: false }).gl)).toBe(true)
    }
    expect(isSoftwareRenderer(fakeGl({ renderer: GPU, parallel: true }).gl)).toBe(false)
  })

  it('소프트웨어 렌더러면 셰이더를 만들지 않고 null(CSS 배경)을 돌려줍니다', async () => {
    const { canvas, calls } = fakeGl({ renderer: 'llvmpipe', parallel: false })
    await expect(createCosmosRenderer(canvas, async () => {})).resolves.toBeNull()
    expect(calls).toEqual(['lose'])
  })

  it('병렬 컴파일을 쓸 수 있으면 끝날 때까지 프레임마다 묻고, 끝난 뒤에야 링크 결과를 봅니다', async () => {
    const { canvas, calls } = fakeGl({ renderer: GPU, parallel: true, readyAfter: 2 })
    const waitFrame = vi.fn(async () => {})
    const renderer = await createCosmosRenderer(canvas, waitFrame)
    expect(renderer).not.toBeNull()
    expect(waitFrame).toHaveBeenCalledTimes(2)
    expect(calls).toEqual(['compile', 'compile', 'link', 'poll', 'poll', 'poll', 'link-status'])
  })

  it('넓은 화면은 오른쪽 위, 좁은 화면은 위쪽 가운데에 행성을 둡니다', () => {
    expect(planetFor(1440, 900)).toMatchObject({ y: 0.13, radius: 0.17 })
    expect(planetFor(390, 844)).toMatchObject({ y: 0.3, radius: 0.13 })
  })
})
