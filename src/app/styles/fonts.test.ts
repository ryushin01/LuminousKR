import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

/**
 * 주어진 파일만 훑게 한 설정으로 생성기를 돌려, 화면 글자로 모은 것(ASCII 제외, 코드 포인트 차례)을 받습니다.
 * 설정 경로는 저장소 루트 기준이라 상대 경로로 넘깁니다.
 */
function listScreenText(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'luminous-fonts-'))
  const rel = (file: string) => path.relative(process.cwd(), path.join(dir, file))
  try {
    mkdirSync(path.join(dir, 'src'))
    for (const [name, text] of Object.entries(files))
      writeFileSync(path.join(dir, 'src', name), text)
    writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({
        outDir: rel('out'),
        scan: [rel('src')],
        dataExtensions: ['json', 'html'],
        fonts: [],
      }),
    )
    return execFileSync(
      'node',
      ['scripts/build-fonts.mjs', '--config', rel('config.json'), '--list'],
      {
        encoding: 'utf8',
      },
    ).trim()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('한글 웹 폰트', () => {
  it('화면 글자 파일에 소스의 한글·기호가 모두 있고, 줄인 파일도 원본의 저작권·라이선스 항목을 지닌다 (아니면 pnpm fonts)', () => {
    const output = execFileSync('node', ['scripts/build-fonts.mjs', '--check'], {
      encoding: 'utf8',
    })
    expect(output).toContain('OK')
  })

  it('JSX 글자·속성값과 HTML에 쓴 이름 있는 엔티티를 그 글자와 똑같이 셉니다', () => {
    const named = listScreenText({
      'Guide.tsx': 'export const A = () => <p title="&diams;">&lsquo;벌&rsquo; &hearts;</p>\n',
      'index.html': '<p>&mdash;</p>\n',
    })
    const literal = listScreenText({
      'Guide.tsx': 'export const A = () => <p title="♦">‘벌’ ♥</p>\n',
      'index.html': '<p>—</p>\n',
    })
    expect(literal).toBe('—‘’♥♦벌')
    expect(named).toBe(literal)
  })
})
