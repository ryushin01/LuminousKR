/**
 * 제목용 글꼴 Luminous Display를 만듭니다.
 *
 * 이 앱의 조합기(src/entities/font)로 기본 프리셋을 조금 굵게 만들어,
 * 화면 문구(src의 .ts·.tsx 문자열·JSX 글자와 index.html)에 쓰인 한글 음절·자모만 담습니다.
 * 결과: src/app/styles/fonts/luminous-display.woff (저장소에 넣어 둡니다)
 *
 * 사용: pnpm fonts:display
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = join(root, 'src/app/styles/fonts/luminous-display.woff')

/** 주석을 지웁니다 (주석의 한글은 화면에 나오지 않으므로 글꼴에 넣지 않음). */
export function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
}

/** 화면 문구에 쓰인 한글 음절과 호환 자모 */
export function collectDisplayChars(dir = join(root, 'src')) {
  const chars = new Set()
  const visit = (path) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name)
      if (statSync(full).isDirectory()) {
        visit(full)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)) {
        for (const char of stripComments(readFileSync(full, 'utf8'))) {
          const code = char.codePointAt(0)
          if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3131 && code <= 0x3163))
            chars.add(char)
        }
      }
    }
  }
  visit(dir)
  for (const char of readFileSync(join(root, 'index.html'), 'utf8')) {
    const code = char.codePointAt(0)
    if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3131 && code <= 0x3163)) chars.add(char)
  }
  return [...chars].sort().join('')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const chars = collectDisplayChars()
  const server = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  })
  try {
    const { buildFont } = await server.ssrLoadModule('/src/entities/font/lib/build-font.ts')
    const { createPresetProject } = await server.ssrLoadModule('/src/entities/font/model/preset.ts')
    const project = createPresetProject()
    project.style.weight = 96
    project.style.contrast = 0.9
    // 큰 제목에서 글자 사이가 벌어져 보이지 않게 좌우 여백을 줄임
    project.metrics.sideBearing = 14
    project.meta.familyName = 'Luminous Display'
    project.meta.familyNameKo = '루미너스 디스플레이'
    project.meta.styleName = 'Bold'
    const result = await buildFont(project, { chars, woff: true })
    writeFileSync(output, Buffer.from(result.woff))
    console.log(
      `${relative(root, output)}: 글자 ${chars.length}자, ${(result.woff.byteLength / 1024).toFixed(1)}KB (${result.durationMs}ms)`,
    )
  } finally {
    await server.close()
  }
}
