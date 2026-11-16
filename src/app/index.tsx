/* @refresh reload */
import { render } from 'solid-js/web'
import { startProjectSync } from '@/entities/font'
import { reportAssetLoadFailure } from '@/shared/lib/app-update'
import './styles/index.css'
import { AppRouter } from './routes/AppRouter.tsx'
import { attachRestFonts } from './lib/attachRestFonts'
import restFontsCss from './styles/fonts/luminous-sans-rest.css?url'

const root = document.getElementById('root')
if (!root) throw new Error('#root 요소가 없습니다.')

// 다른 탭의 저장을 받아 맞추고, 탭을 닫기 직전에는 기다리던 저장을 바로 씀
startProjectSync()
// 화면 조각의 CSS·JS를 미리 받지 못하면(배포 뒤 열린 탭, 연결 끊김) 새로 고침을 안내함.
// 오류는 그대로 던져져 화면의 오류 경계가 받습니다.
window.addEventListener('vite:preloadError', reportAssetLoadFailure)
render(() => <AppRouter />, root)
// 나머지 한글(화면 글자 파일에 없는 글자, 입력한 문장 등)은 첫 화면 뒤에 붙임
attachRestFonts(restFontsCss)
