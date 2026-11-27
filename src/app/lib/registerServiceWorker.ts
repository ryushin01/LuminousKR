/**
 * 한 번 연 뒤에는 연결이 끊겨도 열리도록 서비스 워커(빌드가 만든 sw.js)를 등록합니다. 프로덕션 빌드에서만.
 * 등록하지 못해도(사생활 보호 모드, 시험에서 막음 등) 앱은 그대로 씁니다.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  // 첫 화면을 그리는 데 쓰는 연결과 다투지 않게 다 열린 뒤에 등록합니다.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {})
    // 설치를 마치면 쓸 때만 불러오는 pdf.js·WOFF2 압축기도 받아 두게 합니다(처음 쓰기 전에 연결이 끊겨도 되게).
    // 데이터 절약 모드면 받지 않습니다(쓸 때 저장).
    if (!saveData())
      void navigator.serviceWorker.ready.then((registration) =>
        registration.active?.postMessage('warm'),
      )
  })
}

/** 데이터 절약 모드(Network Information API, 크로미움 계열만 있음) */
function saveData(): boolean {
  const connection: unknown = Reflect.get(navigator, 'connection')
  return (
    typeof connection === 'object' &&
    connection !== null &&
    Reflect.get(connection, 'saveData') === true
  )
}
