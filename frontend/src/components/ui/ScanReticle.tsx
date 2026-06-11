// Corner-bracket scan frame shown while the AR tracker hunts for the QR.
// Pure CSS overlay — sits above the camera feed and never intercepts input.
export default function ScanReticle() {
  const corner = 'absolute w-8 h-8 border-accent'
  return (
    <div className="relative w-[58vmin] max-w-[280px] aspect-square animate-pulse" aria-hidden>
      <div className={`${corner} top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl`} />
      <div className={`${corner} top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl`} />
      <div className={`${corner} bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl`} />
      <div className={`${corner} bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl`} />
    </div>
  )
}
