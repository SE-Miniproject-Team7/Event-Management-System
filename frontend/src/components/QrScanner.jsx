import { useEffect, useRef, useState } from 'react'

export default function QrScanner({ onDecoded }) {
  const video = useRef(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let controls
    const preview = video.current
    import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (!active) return
      controls = await new BrowserQRCodeReader().decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } }, preview,
        (result, _error, currentControls) => {
          if (result && active) {
            active = false
            currentControls.stop()
            onDecoded(result.getText())
          }
        },
      )
      if (!active) controls.stop()
    }).catch(() => {
      if (active) setError('Camera unavailable or permission denied. Enter the code or upload a QR image instead.')
    })
    return () => {
      active = false
      controls?.stop()
      preview?.srcObject?.getTracks().forEach(track => track.stop())
    }
  }, [onDecoded])
  return <div>
    {error && <p role="alert">{error}</p>}
    <video ref={video} className="checkin-camera" aria-label="QR camera preview" muted playsInline />
    <p>Point the camera at the registration QR code.</p>
  </div>
}
