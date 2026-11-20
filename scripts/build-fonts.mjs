/**
 * 한글 웹 폰트 만들기: `pnpm fonts` (확인만: `pnpm fonts --check`)
 *
 * scripts/fonts/config.json에 적은 원본 글꼴에서 굵기마다 두 가지를 만듭니다.
 *
 * 1. 화면 글자 파일 `<slug>/<slug>-<굵기>-ui.woff2`
 *    소스의 문자열·JSX 글자에 쓰인 한글·기호만 담습니다. `<slug>.css`에 들어가 첫 화면 CSS와 함께 받습니다.
 * 2. 조각 파일 `<slug>/<slug>-<굵기>-<번호>.woff2`
 *    Google Fonts 한국어 글꼴과 같은 글자 묶음(최대 124조각)으로 나눈 파일입니다. `<slug>-rest.css`에 들어가
 *    첫 화면 뒤에 붙고, 1에 없는 글자(사용자가 입력한 글자 등)를 쓸 때 그 글자가 든 조각만 받습니다.
 *
 * 화면 글자가 바뀌면 다시 실행합니다. `--check`는 1에 빠진 글자가 있으면 실패합니다(단위 테스트에서 씀).
 * 조각 파일은 글자가 바뀌어도 그대로라 없는 것만 만듭니다. 원본 글꼴을 바꿨으면 `--all`로 모두 다시 만듭니다.
 * `--list`는 글꼴을 만들지 않고, 1에 넣을 글자(ASCII 제외)를 코드 포인트 차례로 출력합니다.
 */
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodeHTML } from 'entities'
import fontverter from 'fontverter'
import { Blob, Face } from 'harfbuzzjs'
import subsetFont from 'subset-font'

// TypeScript 파서가 있으면 문자열·JSX 글자만, 없으면(TypeScript 7 등) 주석까지 원문 전체를 셈(빠지는 글자가 없게)
const ts = await import('typescript').then((m) => m.default ?? m).catch(() => null)
const AST = typeof ts?.createSourceFile === 'function'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => readFile(path.join(ROOT, file), 'utf8')
// --config <경로>로 설정 파일을 고를 수 있음(앱이 여럿인 저장소). 경로는 저장소 루트 기준
const configArg = process.argv.indexOf('--config')
const configPath = configArg > -1 ? process.argv[configArg + 1] : 'scripts/fonts/config.json'
const config = JSON.parse(await read(configPath))
const SLICES = JSON.parse(await read('scripts/fonts/ko-slices.json'))
const CHECK = process.argv.includes('--check')
const ALL = process.argv.includes('--all')
const OUT = path.join(ROOT, config.outDir)
// 나머지 조각은 따로 둘 수 있음(Next.js처럼 public에 두고 주소로 붙일 때)
const REST = path.join(ROOT, config.restDir ?? config.outDir)
const HEADER = '/* pnpm fonts로 만든 파일입니다. 직접 고치지 마세요. */\n'

/** 'U+ac00-ac0f, U+ac11' 같은 unicode-range를 코드 포인트 집합으로 */
function parseRange(text) {
  const set = new Set()
  for (const part of text.split(',')) {
    const [a, b] = part.trim().replace(/^U\+/i, '').split('-')
    if (!a) continue
    const lo = parseInt(a.replaceAll('?', '0'), 16)
    const hi = parseInt((b ?? a).replaceAll('?', 'f'), 16)
    for (let c = lo; c <= hi; c++) set.add(c)
  }
  return set
}

/** 코드 포인트 집합을 이어진 구간으로 묶은 unicode-range로 */
function toRange(set) {
  const cps = [...set].sort((x, y) => x - y)
  const out = []
  for (let i = 0; i < cps.length; i++) {
    let j = i
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++
    const hex = (c) => c.toString(16)
    out.push(i === j ? `U+${hex(cps[i])}` : `U+${hex(cps[i])}-${hex(cps[j])}`)
    i = j
  }
  return out.join(', ')
}

/** 원문에 적힌 이스케이프(JS의 \uAC00·\u{1F370}, HTML의 &#xAC00;·&#44032;)를 글자로 풂 */
function unescapeAll(text) {
  // 글자 범위를 벗어난 값은 이스케이프가 아닌 것으로 보고 그대로 둠
  const from = (code, raw) => (code <= 0x10ffff ? String.fromCodePoint(code) : raw)
  return text
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (raw, hex) => from(parseInt(hex, 16), raw))
    .replace(/\\u([0-9a-fA-F]{4})/g, (raw, hex) => from(parseInt(hex, 16), raw))
    .replace(/&#x([0-9a-fA-F]+);/g, (raw, hex) => from(parseInt(hex, 16), raw))
    .replace(/&#(\d+);/g, (raw, dec) => from(Number(dec), raw))
}

async function* walk(dir) {
  if (!(await stat(dir)).isDirectory()) {
    yield dir
    return
  }
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (file !== OUT && file !== REST && entry.name !== 'node_modules') yield* walk(file)
    } else yield file
  }
}

/** 화면에 나올 수 있는 글자: 코드의 문자열·템플릿·JSX 글자와 JSON 등 자료 파일의 글자(주석은 뺌) */
async function screenText() {
  const parts = [config.extra ?? '']
  for (const dir of config.scan) {
    for await (const file of walk(path.join(ROOT, dir))) {
      if (/\.(test|spec|stories)\.[jt]sx?$/.test(file)) continue
      if (/\.[cm]?[jt]sx?$/.test(file)) {
        const text = await readFile(file, 'utf8')
        if (!AST) {
          // 어디가 JSX인지 모르므로 엔티티를 푼 원문도 셈(더 셀 뿐 빠지지 않음)
          parts.push(text, decodeHTML(text))
          continue
        }
        const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
        // 부모 연결을 켜서 문자열이 JSX 속성값인지 알아봄
        const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
        const visit = (node) => {
          // JSX 글자와 속성값은 HTML처럼 이름 있는 엔티티(&lsquo; 등)가 글자로 바뀌어 화면에 나옴.
          // 보통 JS 문자열 속 '&hearts;'는 그 글자 그대로 나오므로 풀지 않음
          if (ts.isJsxText(node) || (ts.isStringLiteral(node) && ts.isJsxAttribute(node.parent)))
            parts.push(decodeHTML(node.text))
          else if (
            ts.isStringLiteralLike(node) ||
            ts.isTemplateHead(node) ||
            ts.isTemplateMiddle(node) ||
            ts.isTemplateTail(node)
          )
            parts.push(node.text)
          ts.forEachChild(node, visit)
        }
        visit(source)
      } else if (file.endsWith('.json')) {
        // 이스케이프된 글자(\ud7a3 등)도 풀어서 세도록 문자열 값을 모음
        const text = await readFile(file, 'utf8')
        const collect = (value) => {
          if (typeof value === 'string') parts.push(value)
          else if (value && typeof value === 'object')
            for (const item of Object.values(value)) collect(item)
        }
        try {
          collect(JSON.parse(text))
        } catch {
          parts.push(text)
        }
      } else if (new RegExp(`\\.(${config.dataExtensions.join('|')})$`).test(file)) {
        const text = await readFile(file, 'utf8')
        parts.push(file.endsWith('.html') ? decodeHTML(text) : text)
      }
    }
  }
  const set = new Set()
  for (const ch of unescapeAll(parts.join(''))) {
    const cp = ch.codePointAt(0)
    // 영문·숫자(ASCII)는 영문 글꼴이 맡음
    if (cp > 0x7e) set.add(cp)
  }
  return set
}

function cmapOf(sfnt) {
  const face = new Face(new Blob(sfnt), 0)
  const set = new Set(face.collectUnicodes())
  return set
}

/**
 * OFL 글꼴은 사본마다 저작권과 사용 허락을 지녀야 하므로 줄인 파일에도 저작권(0)·라이선스 설명(13)·라이선스 주소(14)를
 * 남깁니다. HarfBuzz는 기본으로 0~6만 남기므로 13·14를 더 남기라고 넘깁니다.
 */
const LICENSE_NAME_IDS = [0, 13, 14]
const subset = (font, text) =>
  subsetFont(font, text, { targetFormat: 'woff2', preserveNameIds: [13, 14] })

/** sfnt(OTF·TTF)의 name 표에 있는 Windows 플랫폼 이름 ID들 */
function nameIdsOf(sfnt) {
  const view = new DataView(sfnt.buffer, sfnt.byteOffset, sfnt.byteLength)
  const ids = new Set()
  for (let i = 0; i < view.getUint16(4); i++) {
    const entry = 12 + i * 16
    if (view.getUint32(entry) !== 0x6e616d65) continue // 'name'
    const table = view.getUint32(entry + 8)
    for (let j = 0; j < view.getUint16(table + 2); j++) {
      const record = table + 6 + j * 12
      if (view.getUint16(record) === 3) ids.add(view.getUint16(record + 6))
    }
  }
  return ids
}

/** 원본에 있는 저작권·라이선스 이름 항목 가운데 줄인 파일에 없는 것 */
async function lackingLicenseNames(originalIds, file) {
  const ids = nameIdsOf(await fontverter.convert(await readFile(file), 'sfnt'))
  return LICENSE_NAME_IDS.filter((id) => originalIds.has(id) && !ids.has(id))
}

const fontFace = (family, weight, url, range) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;` +
  `src:url('${url}') format('woff2');unicode-range:${range}}`

const screen = await screenText()
if (process.argv.includes('--list')) {
  console.log(String.fromCodePoint(...[...screen].sort((a, b) => a - b)))
  process.exit(0)
}
const missing = []
let checked = 0

for (const font of config.fonts) {
  const { family, slug } = font
  const dir = path.join(OUT, slug)
  const restDir = path.join(REST, slug)
  await mkdir(dir, { recursive: true })
  await mkdir(restDir, { recursive: true })
  const uiRules = []
  const written = []
  const restRules = []
  const existingUi =
    CHECK && existsSync(path.join(OUT, `${slug}.css`))
      ? await readFile(path.join(OUT, `${slug}.css`), 'utf8')
      : ''

  for (const [weight, src] of Object.entries(font.weights)) {
    const original = await readFile(path.join(ROOT, src))
    const originalSfnt = await fontverter.convert(original, 'sfnt')
    const cmap = cmapOf(originalSfnt)
    const ui = new Set([...screen].filter((cp) => cmap.has(cp)))

    if (CHECK) {
      // CSS의 unicode-range와 실제 화면 글자 파일의 글자 목록을 모두 확인
      const rule = existingUi.split('\n').find((line) => line.includes(`font-weight:${weight};`))
      const declared = rule ? parseRange(rule.match(/unicode-range:([^}]+)/)[1]) : new Set()
      const uiPath = path.join(dir, `${slug}-${weight}-ui.woff2`)
      if (!existsSync(uiPath)) {
        missing.push(`${family} ${weight}: ${path.relative(ROOT, uiPath)} 파일이 없습니다`)
        continue
      }
      const inFile = cmapOf(await fontverter.convert(await readFile(uiPath), 'sfnt'))
      const lack = [...ui].filter((cp) => !declared.has(cp) || !inFile.has(cp))
      if (lack.length) missing.push(`${family} ${weight}: ${String.fromCodePoint(...lack)}`)
      checked = Math.max(checked, ui.size)
      // 화면 글자 파일과 조각 파일 모두 원본의 저작권·라이선스 항목을 지녀야 함
      const originalNames = nameIdsOf(originalSfnt)
      const pieces = SLICES.map(
        (_, index) => `${slug}-${weight}-${String(index).padStart(3, '0')}.woff2`,
      ).filter((name) => existsSync(path.join(restDir, name)))
      for (const file of [uiPath, ...pieces.map((name) => path.join(restDir, name))]) {
        const lackNames = await lackingLicenseNames(originalNames, file)
        if (lackNames.length)
          missing.push(
            `${path.relative(ROOT, file)}: 저작권·라이선스 이름 항목 없음(ID ${lackNames.join('·')})`,
          )
      }
      continue
    }

    const uiName = `${slug}-${weight}-ui.woff2`
    const uiFont = await subset(original, String.fromCodePoint(...ui))
    await writeFile(path.join(dir, uiName), uiFont)
    written.push(path.join(dir, uiName))
    uiRules.push(fontFace(family, weight, `./${slug}/${uiName}`, toRange(ui)))

    for (const [index, range] of SLICES.entries()) {
      const inFont = [...parseRange(range)].filter((cp) => cmap.has(cp))
      if (!inFont.length) continue
      const name = `${slug}-${weight}-${String(index).padStart(3, '0')}.woff2`
      // 이름을 바꾸는 글꼴은 이전 실행에서 이름 바꾸기가 실패했을 수 있어 늘 다시 만듦
      if (ALL || font.rename || !existsSync(path.join(restDir, name))) {
        const piece = await subset(original, String.fromCodePoint(...inFont))
        await writeFile(path.join(restDir, name), piece)
        written.push(path.join(restDir, name))
      }
      // 화면 글자 파일에 있는 글자는 빼서, 같은 글자를 두 파일에서 받지 않게 함
      const rest = new Set(inFont.filter((cp) => !ui.has(cp)))
      if (rest.size)
        restRules.push({
          index,
          weight,
          rule: fontFace(family, weight, `./${slug}/${name}`, toRange(rest)),
        })
    }
    console.log(
      `${family} ${weight}: 화면 글자 ${ui.size}자 (${(uiFont.length / 1024).toFixed(1)}KB)`,
    )
  }

  if (CHECK) continue
  await writeFile(path.join(OUT, `${slug}.css`), `${HEADER}${uiRules.join('\n')}\n`)
  // 같은 조각 번호의 굵기들을 이웃하게 두어 gzip이 반복되는 unicode-range를 줄이게 함
  restRules.sort((a, b) => a.index - b.index || Number(a.weight) - Number(b.weight))
  await writeFile(
    path.join(REST, `${slug}-rest.css`),
    `${HEADER}${restRules.map((r) => r.rule).join('\n')}\n`,
  )
  // OFL 예약 이름이 있는 글꼴은 줄인 파일의 이름표도 바꿈(fontTools 필요: pip install fonttools brotli)
  if (font.rename && written.length)
    execFileSync('python3', [path.join(ROOT, 'scripts/fonts/rename-font.py'), family, ...written], {
      stdio: 'inherit',
    })
}

if (CHECK) {
  if (missing.length) {
    console.error(
      `화면 글자 파일에 빠진 글자가 있거나 줄인 파일에 저작권·라이선스 항목이 없습니다. pnpm fonts로 다시 만드세요.\n${missing.join('\n')}`,
    )
    process.exit(1)
  }
  console.log(
    `OK: 화면 글자 ${checked}자가 모두 화면 글자 파일에 있고, 줄인 파일마다 저작권·라이선스 항목이 있습니다.`,
  )
}
