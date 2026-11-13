export type Point = { x: number; y: number }

export type Rect = { x0: number; y0: number; x1: number; y1: number }

/** 윤곽선 조각: 직선(L) 또는 3차 베지어(C). 시작점은 앞 조각의 끝점입니다. */
export type Segment =
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }

/** 닫힌 윤곽선 하나. 마지막 조각의 끝점은 start와 같아야 합니다. */
export type Contour = { start: Point; segments: Segment[] }

export const EMPTY_RECT: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
