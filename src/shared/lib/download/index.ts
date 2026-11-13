/** 메모리의 데이터를 파일로 내려받게 합니다. */
export function downloadFile(data: BlobPart, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // 내려받기가 시작된 뒤에 주소를 풉니다.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** 파일 이름에 쓸 수 없는 글자를 바꿉니다. */
export function safeFileName(name: string, fallback = 'luminous'): string {
  const cleaned = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\p{Cc}]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return cleaned.length > 0 ? cleaned : fallback
}
