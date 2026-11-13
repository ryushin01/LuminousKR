import { Route, Router } from '@solidjs/router'
import { lazy } from 'solid-js'
import { AppShell } from '../layout/AppShell.tsx'

/** 화면마다 코드를 나눠, 처음에는 홈에 필요한 것만 받습니다. */
const HomePage = lazy(() => import('@/pages/home').then((m) => ({ default: m.HomePage })))
const StudioPage = lazy(() => import('@/pages/studio').then((m) => ({ default: m.StudioPage })))
const ImportPage = lazy(() => import('@/pages/import').then((m) => ({ default: m.ImportPage })))
const PreviewPage = lazy(() => import('@/pages/preview').then((m) => ({ default: m.PreviewPage })))
const ExportPage = lazy(() => import('@/pages/export').then((m) => ({ default: m.ExportPage })))
const GuidePage = lazy(() => import('@/pages/guide').then((m) => ({ default: m.GuidePage })))
const NotFoundPage = lazy(() =>
  import('@/pages/not-found').then((m) => ({ default: m.NotFoundPage })),
)

/** GitHub Pages 하위 경로(/LuminousKR/)에서도 동작하도록 기준 경로를 맞춥니다. */
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

export function AppRouter() {
  return (
    <Router base={base} root={AppShell}>
      <Route path="/" component={HomePage} />
      <Route path="/studio" component={StudioPage} />
      <Route path="/import" component={ImportPage} />
      <Route path="/preview" component={PreviewPage} />
      <Route path="/export" component={ExportPage} />
      <Route path="/guide" component={GuidePage} />
      <Route path="*404" component={NotFoundPage} />
    </Router>
  )
}
