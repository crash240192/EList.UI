export interface HoleRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Затемнение вокруг viewport с «дыркой» над карточкой (even-odd polygon) */
export function discussionDimClipPath(hole: HoleRect): string {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const L = hole.left;
  const T = hole.top;
  const R = hole.left + hole.width;
  const B = hole.top + hole.height;
  return `polygon(evenodd, 0 0, ${w}px 0, ${w}px ${h}px, 0 ${h}px, 0 0, ${L}px ${T}px, ${R}px ${T}px, ${R}px ${B}px, ${L}px ${B}px, ${L}px ${T}px)`;
}
