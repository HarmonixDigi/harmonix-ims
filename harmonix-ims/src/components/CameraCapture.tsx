import { useEffect, useRef, useState } from 'react'
import { X, Camera } from 'lucide-react'

interface Props {
  onCapture: (file: File) => void
  onClose: () => void
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setStatus('ready')
    }).catch(err => {
      setStatus('error')
      if (err?.name === 'NotAllowedError') {
        setErrorMsg('Camera permission denied. Please allow camera access and try again.')
      } else if (err?.name === 'NotFoundError') {
        setErrorMsg('No camera found on this device.')
      } else {
        setErrorMsg(err?.message ?? 'Could not start camera.')
      }
    })

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapture(file)
    }, 'image/jpeg', 0.92)
  }

  function handleClose() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-800 text-sm">Take Photo</span>
          <button onClick={handleClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>

        {status === 'error' ? (
          <div className="p-6 text-center">
            <div className="text-4xl mb-3">📷</div>
            <p className="text-sm text-red-600 font-medium">{errorMsg}</p>
            <button onClick={handleClose} className="mt-4 w-full py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Close</button>
          </div>
        ) : (
          <>
            <div className="relative bg-black">
              <video ref={videoRef} className="w-full" style={{ maxHeight: '300px', objectFit: 'cover' }} muted playsInline />
              {status === 'starting' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="w-8 h-8 border-3 border-orange border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="px-4 py-4 flex gap-3">
              <button onClick={handleClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={capture} disabled={status !== 'ready'}
                className="flex-1 py-3 bg-teal text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                <Camera size={16} /> Capture
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
