/**
 * Camera-resolution shim for MindAR.
 *
 * mind-ar opens its own camera stream with no resolution constraints —
 * the dist requests just `{video: {facingMode: 'environment'}}` — so the
 * browser hands back its default capture (often 640×480, 4:3). The Three.js
 * projection is calibrated to that feed, while our preview stream is
 * 1280×720 (16:9): two different aspect-ratio crops of the same scene, which
 * is why the AR overlay drifted left/right of the QR.
 *
 * This wrapper temporarily augments getUserMedia so any object-form video
 * constraint requested while `run` is in flight also asks for 1280×720
 * (ideal, so unsupported cameras still succeed). With both streams asking
 * for identical settings the browser can share one capture, and the AR feed
 * stays as sharp as the preview.
 */
export async function withIdealCameraResolution<T>(run: () => Promise<T>): Promise<T> {
  const md = navigator.mediaDevices
  const original = md.getUserMedia.bind(md)
  md.getUserMedia = (constraints?: MediaStreamConstraints) => {
    if (constraints && constraints.video && typeof constraints.video === 'object') {
      constraints = {
        ...constraints,
        video: { ...constraints.video, width: { ideal: 1280 }, height: { ideal: 720 } },
      }
    }
    return original(constraints)
  }
  try {
    return await run()
  } finally {
    md.getUserMedia = original
  }
}
