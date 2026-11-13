export type { Contour, Point, Rect, Segment } from './types.ts'
export {
  add,
  cross,
  distance,
  dot,
  length,
  lerp,
  normalize,
  rectOfPoints,
  rectsOverlap,
  scale,
  signedArea,
  sub,
  turnAngle,
  unionRect,
} from './vector.ts'
export { catmullRomToCubics, cubicPoint, flattenCubic, flattenEllipse } from './spline.ts'
export type { Cubic } from './spline.ts'
export { DEFAULT_FIT, fitClosedPolygon } from './fit-curve.ts'
export type { FitOptions } from './fit-curve.ts'
export { contoursBounds, contoursToSvgPath, roundContours, transformContours } from './path-data.ts'
export type { Transform } from './path-data.ts'
