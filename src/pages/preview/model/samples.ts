export type SampleId = 'squirrel' | 'kiss' | 'stars' | 'stroke'

/** 견본 글 (저작권이 끝났거나 짧은 시험 문장, 직접 쓴 글) */
export const SAMPLES: Record<SampleId, { label: string; text: string; source?: string }> = {
  squirrel: { label: '다람쥐', text: '다람쥐 헌 쳇바퀴에 타고파' },
  kiss: {
    label: '키스의 고유 조건',
    text: '키스의 고유 조건은 입술끼리 만나야 하고 특별한 기술은 필요치 않다',
  },
  stars: {
    label: '별 헤는 밤',
    text: '계절이 지나가는 하늘에는\n가을로 가득 차 있습니다.\n\n나는 아무 걱정도 없이\n가을 속의 별들을 다 헤일 듯합니다.',
    source: '윤동주, 「별 헤는 밤」 (1941)',
  },
  stroke: {
    label: '획에서 시작',
    text: '모든 글자는 획에서 시작합니다. 점 하나와 선 하나가 모여 자모가 되고, 자모가 모여 11,172자의 음절이 됩니다. 뼈대를 고치면 그 자모가 들어간 모든 글자가 함께 빛납니다.',
  },
}

export const SAMPLE_IDS = Object.keys(SAMPLES) as SampleId[]
