/* @refresh reload */
import { render } from 'solid-js/web'
import './styles/index.css'
import { AppRouter } from './routes/AppRouter.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('#root 요소가 없습니다.')

render(() => <AppRouter />, root)
