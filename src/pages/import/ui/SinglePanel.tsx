import { createSignal, createUniqueId } from 'solid-js'
import { ALL_JAMO_KEYS, type JamoKey, jamoLabel } from '@/entities/font'
import { Icon } from '@/shared/ui/icon'
import { SelectField } from '@/shared/ui/select-field'
import type { Importer } from '../model/importer.ts'
import styles from './ImportPage.module.css'

/** 양식 없이 그림 한 장을 자모 하나로 (화이트보드·종이에 그린 자모 사진 등) */
export function SinglePanel(props: { importer: Importer }) {
  const inputId = createUniqueId()
  const [key, setKey] = createSignal<JamoKey>('L11')
  return (
    <div class={styles.stack}>
      <SelectField
        label="넣을 자모"
        value={key()}
        onChange={setKey}
        options={ALL_JAMO_KEYS.map((k) => ({ value: k, label: jamoLabel(k) }))}
        hint="그림에서 잉크가 있는 범위를 이 자모의 틀에 맞춰 놓습니다."
      />
      <span class={styles.fileButton}>
        <input
          id={inputId}
          class="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) void props.importer.addSingleFile(file, key())
            event.currentTarget.value = ''
          }}
        />
        <label for={inputId} class={styles.fileLabel}>
          <Icon name="upload" size={18} />
          그림 한 장 고르기
        </label>
      </span>
    </div>
  )
}
