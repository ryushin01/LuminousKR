/* @refresh reload */
import { render } from 'solid-js/web'
import './styles/index.css'
import { AppRouter } from './routes/AppRouter.tsx'
import { attachRestFonts } from './lib/attachRestFonts'
import restFontsCss from './styles/fonts/luminous-sans-rest.css?url'

const root = document.getElementById('root')
if (!root) throw new Error('#root 요소가 없습니다.')

render(() => <AppRouter />, root)
// 나머지 한글(화면 글자 파일에 없는 글자, 입력한 문장 등)은 첫 화면 뒤에 붙임
attachRestFonts(restFontsCss)
