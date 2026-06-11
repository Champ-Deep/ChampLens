/**
 * Sizing for the AR video plane so it always fully covers the tracked QR.
 *
 * MindAR convention: 1 unit = the width of the compiled target image. Our
 * targets are compiled from the square QR PNG (see backend
 * workers/compileMindAR.ts), so the QR occupies exactly 1×1 in anchor space.
 *
 * The plane keeps the video's native aspect ratio (no distortion, no crop)
 * and is scaled up until BOTH dimensions span the QR — the same idea as CSS
 * `object-fit: cover`, applied to the target instead of the video. A small
 * bleed pushes the edges slightly past the QR so tracking jitter never
 * exposes the code underneath.
 *
 * Previous behavior (planeWidth=1, planeHeight=1/aspect) only covered the
 * QR for portrait videos; a 16:9 landscape video left ~44% of the QR visible.
 */

/** The QR target spans 1×1 in MindAR anchor units (square source image). */
export const QR_TARGET_SIZE = 1

/** Overscan factor so the plane edges sit just past the QR during jitter. */
export const DEFAULT_COVER_BLEED = 1.08

export interface PlaneSize {
  width: number
  height: number
}

export function computeCoverPlaneSize(
  videoAspect: number,
  bleed: number = DEFAULT_COVER_BLEED,
): PlaneSize {
  // Guard against bad metadata (0 / NaN / Infinity) — fall back to 16:9.
  const aspect = Number.isFinite(videoAspect) && videoAspect > 0 ? videoAspect : 16 / 9
  return {
    width: Math.max(QR_TARGET_SIZE, QR_TARGET_SIZE * aspect) * bleed,
    height: Math.max(QR_TARGET_SIZE, QR_TARGET_SIZE / aspect) * bleed,
  }
}
